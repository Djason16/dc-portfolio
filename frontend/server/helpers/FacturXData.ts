import { documentTotals, lineTotal, round2, type BillingDocument, type BillingLine } from '~/utils/billing'
import { translate } from '~/plugins/translations/translations'
import { DatabaseHelper } from '../utils/DatabaseHelper'
import { SettingsHelper } from './SettingsHelper'

/*
 * What a Factur-X invoice says (EN 16931 semantic model), read from an invoice of the admin, the owner's settings
 * (admin > My information: name, SIRET, VAT number, billing address) and the bank details of the .env.
 *   const data = await FacturXData.of(doc)            { seller, buyer, lines, taxes, totals, notes, ... } (FacturXXml.ts writes it)
 *   FacturXData.flowOf(client)                         'b2b' (a business with a SIREN: an e-invoice) or 'b2c' (e-reporting)
 * The owner is a micro-entrepreneur under the VAT franchise: a line at 0 % is VAT category E (exempt) with the
 * reason "TVA non applicable, art. 293 B du CGI"; a line with a rate (if he ever charges VAT) is category S.
 */

// A party of the invoice (seller or buyer)
export type Party = {
    name: string, siren: string, siret: string, vatNumber: string, email: string,
    // Electronic invoicing address (BT-34 / BT-49, scheme 0225): the SIREN, or a SIREN with a suffix
    address: { line: string, postalCode: string, city: string, country: string }, einvoiceAddress: string,
}
// A VAT category of the invoice: its base, its VAT and, for an exempt one, the reason
export type TaxGroup = { category: 'S' | 'E', rate: number, basis: number, tax: number, reason: string, allowance: number }
export type InvoiceLine = { id: string, name: string, details: string, quantity: number, unitCode: string, price: number, total: number, category: 'S' | 'E', rate: number }
export type FacturXInvoice = {
    number: string, typeCode: '380' | '386', issueDate: string, dueDate: string, currency: string, flow: 'b2b' | 'b2c',
    // Billing framework of the French reform (BT-23): S1 a services invoice, S4 a final invoice after deposits
    businessProcess: string, title: string,
    seller: Party, buyer: Party, lines: InvoiceLine[], taxes: TaxGroup[],
    totals: { lines: number, allowance: number, basis: number, tax: number, grand: number, prepaid: number, due: number },
    notes: { code: string, text: string }[], paymentTerms: string, iban: string, bic: string, paymentMeans: '58' | '48',
}

export const VAT_EXEMPTION = 'TVA non applicable, art. 293 B du CGI'
// VATEX code of the French VAT franchise (CEF VATEX code list)
export const VAT_EXEMPTION_CODE = 'VATEX-FR-FRANCHISE'

const COUNTRIES: Record<string, string> = { france: 'FR', belgique: 'BE', belgium: 'BE', suisse: 'CH', switzerland: 'CH', luxembourg: 'LU', 'royaume-uni': 'GB', 'united kingdom': 'GB', allemagne: 'DE', germany: 'DE', espagne: 'ES', italie: 'IT', 'pays-bas': 'NL', canada: 'CA' }
const digits = (value: unknown) => String(value || '').replace(/\D/g, '')

/** "62 Rue Danielle-Casanova 93200 Saint-Denis, France" -> { line, postalCode, city, country } */
export const splitAddress = (full: string) => {
    const parts = String(full || '').split(/[,\n]/).map(part => part.trim()).filter(Boolean)
    const last = parts[parts.length - 1] || ''
    const country = parts.length > 1 && !/\d/.test(last) ? (parts.pop(), COUNTRIES[last.toLowerCase()] || 'FR') : 'FR'
    const text = parts.join(', ')
    const code = text.match(/\b\d{4,5}\b(?!.*\b\d{4,5}\b)/)
    if (!code) return { line: text, postalCode: '', city: '', country }
    const before = text.slice(0, code.index).replace(/[,\s]+$/, '')
    const after = text.slice(code.index! + code[0].length).replace(/^[,\s]+/, '')
    return { line: before, postalCode: code[0], city: after, country }
}

// Units of a line -> UN/ECE rec. 20 codes (C62: one, HUR: hour, DAY: day, MON: month, ANN: year)
const UNITS: [RegExp, string][] = [[/^(h|heures?|hours?)$/i, 'HUR'], [/^(j|jours?|days?)$/i, 'DAY'], [/^(mois|months?)$/i, 'MON'], [/^(ans?|années?|years?)$/i, 'ANN']]
const unitCode = (unit: string) => UNITS.find(([pattern]) => pattern.test(String(unit || '').trim()))?.[1] || 'C62'

// The client of the invoice: its copy on the finalized document, completed by its row (country, VAT number, e-invoicing address)
const buyerOf = async (doc: BillingDocument): Promise<Party & { type: string }> => {
    const copy = doc.client || {}
    const row = doc.clientId ? await DatabaseHelper.fetchOne('SELECT * FROM dc_clients WHERE id = ?', [doc.clientId]) : null
    const siret = digits(copy.siret || row?.siret)
    const type = String(copy.type || row?.type || 'individual')
    const name = copy.name || row?.company_name || `${row?.firstname || ''} ${row?.lastname || ''}`.trim()
    const siren = type === 'individual' ? '' : siret.slice(0, 9)
    return {
        type, name, siren, siret, vatNumber: String(copy.tva || row?.vat_number || '').replace(/\s/g, ''), email: copy.email || row?.email || '',
        address: { line: copy.address || row?.address || '', postalCode: copy.postalCode || row?.postal_code || '', city: copy.city || row?.city || '', country: String(copy.country || row?.country || 'FR').toUpperCase() },
        einvoiceAddress: String(copy.einvoiceAddress || row?.einvoice_address || '').trim() || siren,
    }
}

// The lines with their VAT category; the discount of the document is a document level allowance, shared between the categories
const linesAndTaxes = (doc: BillingDocument) => {
    const lines: InvoiceLine[] = doc.lines.map((line: BillingLine, i: number) => {
        const rate = round2((Number(line.vatRate) || 0) * 100)
        return { id: String(i + 1), name: line.description || '-', details: line.details || '', quantity: Number(line.quantity) || 0, unitCode: unitCode(line.unit),
            price: round2(line.unitPrice), total: lineTotal(line), category: rate ? 'S' : 'E', rate }
    })
    const { subtotal, discount } = documentTotals(doc)
    const groups = new Map<string, TaxGroup>()
    for (const line of lines) {
        const key = `${line.category}${line.rate}`
        const group = groups.get(key) || { category: line.category, rate: line.rate, basis: 0, tax: 0, reason: line.category === 'E' ? VAT_EXEMPTION : '', allowance: 0 }
        group.basis = round2(group.basis + line.total)
        groups.set(key, group)
    }
    const taxes = [...groups.values()]
    // The discount spread over the categories by their share (the last one takes the rounding)
    let left = discount
    taxes.forEach((group, i) => {
        group.allowance = i === taxes.length - 1 ? round2(left) : round2(subtotal ? discount * group.basis / subtotal : 0)
        left = round2(left - group.allowance)
        group.basis = round2(group.basis - group.allowance)
        group.tax = round2(group.basis * group.rate / 100)
    })
    return { lines, taxes, subtotal, discount }
}

export const FacturXData = {
    /** 'b2b': a business client with a SIREN (an e-invoice through the platform), 'b2c': a consumer or no SIREN (e-reporting) */
    flowOf: (client: { type?: string, siret?: string } | null | undefined): 'b2b' | 'b2c' =>
        client && client.type !== 'individual' && digits(client.siret).length >= 9 ? 'b2b' : 'b2c',

    async of(doc: BillingDocument): Promise<FacturXInvoice> {
        const settings = await SettingsHelper.all()
        const { bankIban, bankBic } = useRuntimeConfig()
        const sellerSiret = digits(settings.siret)
        const seller: Party = {
            name: settings.name || '', siren: sellerSiret.slice(0, 9), siret: sellerSiret, vatNumber: String(settings.tva || '').replace(/\s/g, ''), email: settings.email || '',
            address: splitAddress(settings.invoiceAddress || settings.address || ''), einvoiceAddress: sellerSiret.slice(0, 9),
        }
        const buyer = await buyerOf(doc)
        const flow = FacturXData.flowOf({ type: buyer.type, siret: buyer.siret })
        const { lines, taxes, subtotal, discount } = linesAndTaxes(doc)
        const basis = round2(subtotal - discount)
        const tax = round2(taxes.reduce((sum, group) => sum + group.tax, 0))
        const grand = round2(basis + tax)
        const prepaid = round2(Math.min((doc.deductions || []).reduce((sum, d) => sum + (Number(d.amount) || 0), 0), grand))
        const iban = String(bankIban || '').replace(/\s/g, '')
        const rate = doc.options?.interestRate ?? null
        const percent = (value: number) => `${String(round2(value * 100)).replace('.', ',')} %`
        const fr = (key: string, values: Record<string, string> = {}) => translate('fr', key, values)
        // Mandatory mentions of a French invoice, also as notes of the e-invoice (French CIUS: PMT, PMD, AAB); BAR B2C for a consumer
        const notes = [
            { code: 'PMD', text: rate !== null ? fr('billLatePenaltiesRate', { penalty: percent(rate * 3), legal: percent(rate) }) : fr('billLatePenalties') },
            { code: 'PMT', text: fr('billRecoveryFee') },
            { code: 'AAB', text: fr('billNoDiscount') },
            ...(doc.title ? [{ code: 'AAI', text: doc.title }] : []),
            ...(flow === 'b2c' ? [{ code: 'BAR', text: 'B2C' }] : []),
        ]
        return {
            number: doc.number || '', typeCode: doc.kind === 'deposit' || doc.kind === 'installment' ? '386' : '380',
            issueDate: doc.issueDate, dueDate: doc.dueDate || doc.issueDate, currency: doc.currency || 'EUR', flow,
            businessProcess: prepaid > 0 ? 'S4' : 'S1', title: doc.title || '',
            seller, buyer, lines, taxes,
            totals: { lines: subtotal, allowance: discount, basis, tax, grand, prepaid, due: round2(grand - prepaid) },
            notes, paymentTerms: doc.dueDate ? `Paiement à réception, au plus tard le ${doc.dueDate.split('-').reverse().join('/')}` : 'Paiement à réception',
            iban, bic: String(bankBic || '').replace(/\s/g, ''), paymentMeans: iban ? '58' : '48',
        }
    },
}
