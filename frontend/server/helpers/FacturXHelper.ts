import type { Document } from './DocumentsHelper'
import { FacturXData, type FacturXInvoice } from './FacturXData'
import { FacturXPdf } from './FacturXPdf'
import { FacturXXml } from './FacturXXml'

/*
 * Factur-X of an invoice (EN 16931, PDF/A-3b): the PDF drawn by the browser of the admin (utils/pdf.ts, the same file as the
 * download) with the XML of the invoice, written by the server from the database (never from the browser).
 *   const res = await FacturXHelper.make(doc, pdfBase64)        { bytes, data } or { error }
 *   const res = await FacturXHelper.make(doc, pdfBase64, tune)  tune(data): changes the data first (the sandbox seller of Super PDP)
 *   const buffer = await FacturXHelper.attachment(docs, file)    a PDF attached to an email: its Factur-X when it is an invoice
 */

// A PDF of the browser: base64 of a file starting with "%PDF", 10 MB at most
const MAX_BYTES = 10 * 1024 * 1024
export const isPdfBase64 = (pdf: unknown): pdf is string => typeof pdf === 'string' && pdf.startsWith('JVBER') && pdf.length * 0.75 <= MAX_BYTES

// What an invoice needs before it can be an e-invoice (the codes are texts of the admin: plugins/translations/pages/admin/einvoice.ts)
const missing = (data: FacturXInvoice) => [
    !data.seller.name && 'einvMissingSellerName',
    data.seller.siren.length !== 9 && 'einvMissingSellerSiret',
    !data.seller.address.city && 'einvMissingSellerAddress',
    !data.buyer.name && 'einvMissingBuyerName',
    data.flow === 'b2b' && !data.buyer.address.city && 'einvMissingBuyerAddress',
].filter(Boolean) as string[]

export const FacturXHelper = {
    async make(doc: Document | null, pdf: unknown, tune?: (data: FacturXInvoice) => void | Promise<void>) {
        if (!doc || doc.type !== 'invoice') return { error: 'Invoice not found', status: 404 }
        if (doc.status === 'draft' || !doc.number) return { error: 'einvFinalizeFirst', status: 409 }
        if (!isPdfBase64(pdf)) return { error: 'billMailBadPdf', status: 400 }
        const data = await FacturXData.of(doc)
        await tune?.(data)
        const errors = missing(data)
        if (errors.length) return { error: errors[0]!, errors, status: 400 }
        const xml = FacturXXml.build(data)
        try {
            const bytes = await FacturXPdf.make(Buffer.from(pdf, 'base64'), xml, { number: data.number, seller: data.seller.name, title: data.title })
            return { bytes, data, xml }
        } catch (error) {
            console.error('Factur-X not made:', (error as Error).message)
            return { error: 'einvPdfFailed', status: 422 }
        }
    },

    /** A PDF attached to an email: the Factur-X of the finalized invoice of the same number, else the PDF as it is */
    async attachment(docs: Document[], file: { name: string, pdf: string }) {
        const original = Buffer.from(file.pdf, 'base64')
        const doc = docs.find(d => d.type === 'invoice' && d.number && d.number === file.name)
        if (!doc) return original
        const res = await this.make(doc, file.pdf).catch(() => null)
        return res && 'bytes' in res && res.bytes ? Buffer.from(res.bytes) : original
    },
}
