import { paymentState } from '~/utils/billing'
import { DatabaseHelper } from '../utils/DatabaseHelper'
import { DocumentsHelper } from './DocumentsHelper'
import { EnvHelper } from './EnvHelper'
import { FacturXData } from './FacturXData'
import { FacturXHelper } from './FacturXHelper'
import { PlatformError, SuperPdpHelper, type EinvoicePlatform } from './SuperPdpHelper'

/*
 * Electronic invoices of the admin (French reform): the settings of Super PDP and the state of each invoice (dc_einvoices).
 *   mode 'manual' (default, free): the API is OFF, nothing is ever sent nor billed; the admin downloads the Factur-X and
 *                                  uploads it on the Super PDP website (credentials in the .env stay unused)
 *   mode 'api': switched ON by the admin only (asked to confirm); the site sends the invoices through the API (SuperPdpHelper,
 *               each one billed by Super PDP), then follows their events. Back to 'manual': every sending stops at once
 * Only the connection test (a free read of the company of the credentials) works while the API is off.
 * B2B (a business client with a SIREN): an e-invoice. B2C (a consumer): not an e-invoice, e-reporting: sent with the
 * processing rule B2C (Super PDP reports it to the tax administration), its payment declared with the status fr:212.
 *
 *   await EinvoiceHelper.settings()                  { mode, configured, env, apiUrl, mock, clientIdHint }
 *   await EinvoiceHelper.send(id, pdfBase64)          the Factur-X sent to Super PDP, its state saved
 *   await EinvoiceHelper.refresh(id)                  its events read again
 *   await EinvoiceHelper.reportPayment(id)            a paid invoice: status fr:212 "Encaissée"
 */

const MODE_KEY = 'einvoiceMode'
export type EinvoiceMode = 'manual' | 'api'

// Events of the platform -> state shown in the admin
const REJECTED = ['api:invalid', 'api:rejected', 'fr:210', 'fr:213', 'fr:501']
const DELIVERED = ['api:sent', 'api:received', 'api:acknowledged', 'api:accepted', 'fr:201', 'fr:202', 'fr:203', 'fr:204', 'fr:205', 'fr:206', 'fr:207', 'fr:208', 'fr:209', 'fr:211', 'fr:212']
const stateOf = (events: { code: string, text: string }[]) => {
    const rejected = events.findLast(e => REJECTED.includes(e.code) || /-(ack-error|rejected)$/.test(e.code))
    if (rejected) return { status: 'rejected', code: rejected.code, message: rejected.text }
    const last = events.at(-1)
    return { status: events.some(e => DELIVERED.includes(e.code)) ? 'accepted' : 'sent', code: last?.code || '', message: last?.text || '' }
}

const save = async (id: string, values: Record<string, unknown>) => {
    const columns = Object.keys(values)
    await DatabaseHelper.execute(`INSERT INTO dc_einvoices (document_id, ${columns.join(', ')}) VALUES (?, ${columns.map(() => '?').join(', ')})
        ON DUPLICATE KEY UPDATE ${columns.map(c => `${c} = VALUES(${c})`).join(', ')}`, [id, ...Object.values(values)])
}
const failure = (error: unknown) => error instanceof PlatformError
    ? { error: error.message, status: error.status }
    : { error: `Super PDP: ${(error as Error).message}`, status: 502 }

export const EinvoiceHelper = {
    async mode(): Promise<EinvoiceMode> {
        const row = await DatabaseHelper.fetchOne('SELECT value FROM dc_settings WHERE `key` = ?', [MODE_KEY])
        return row?.value === 'api' ? 'api' : 'manual'
    },

    /** The settings shown in the admin: never the secret, only the end of the client id */
    async settings() {
        const { url, clientId, env, mock } = SuperPdpHelper.config()
        return { mode: await this.mode(), configured: SuperPdpHelper.configured(), env, apiUrl: url, mock, clientIdHint: clientId ? `…${clientId.slice(-4)}` : '' }
    },

    async setMode(mode: string) {
        const value = mode === 'api' ? 'api' : 'manual'
        if (value === 'api' && !SuperPdpHelper.configured()) return { error: 'einvNoCredentials', status: 400 }
        await DatabaseHelper.execute('INSERT INTO dc_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)', [MODE_KEY, value])
        return { settings: await this.settings() }
    },

    /** Credentials of a Super PDP application, written in the .env of the server (and used at once) */
    async saveCredentials(clientId: unknown, clientSecret: unknown) {
        const id = String(clientId || '').trim()
        const secret = String(clientSecret || '').trim()
        if (!/^[\w.:-]{4,200}$/.test(id) || !/^\S{8,500}$/.test(secret)) return { error: 'einvBadCredentials', status: 400 }
        await EnvHelper.write({ SUPERPDP_CLIENT_ID: id, SUPERPDP_CLIENT_SECRET: secret })
        Object.assign(process.env, { SUPERPDP_CLIENT_ID: id, SUPERPDP_CLIENT_SECRET: secret })
        SuperPdpHelper.forget()
        return { settings: await this.settings() }
    },

    /** API cut and credentials removed from the .env: back to the manual mode */
    async removeCredentials() {
        await EnvHelper.write({ SUPERPDP_CLIENT_ID: '', SUPERPDP_CLIENT_SECRET: '' })
        delete process.env.SUPERPDP_CLIENT_ID
        delete process.env.SUPERPDP_CLIENT_SECRET
        SuperPdpHelper.forget()
        await DatabaseHelper.execute('INSERT INTO dc_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)', [MODE_KEY, 'manual'])
        return { settings: await this.settings() }
    },

    /** The company of the credentials (a harmless read): its environment must be the one of SUPERPDP_ENV */
    async test() {
        try {
            const company = await SuperPdpHelper.platform().company()
            return { company, expected: SuperPdpHelper.config().env, matches: company.env === SuperPdpHelper.config().env }
        } catch (error) { return failure(error) }
    },

    // The platform, only when the API is on and its company is in the expected environment (never production by mistake)
    async ready(): Promise<{ platform?: EinvoicePlatform, env?: string, company?: { number: string, name: string, address: string }, error?: string, status?: number }> {
        if (await this.mode() !== 'api') return { error: 'einvApiOff', status: 409 }
        const platform = SuperPdpHelper.platform()
        try {
            const company = await platform.company()
            if (company.env !== SuperPdpHelper.config().env) return { error: 'einvEnvMismatch', status: 409 }
            return { platform, env: company.env, company }
        } catch (error) { return failure(error) }
    },

    /** Every finalized invoice with its e-invoice state, newest first (B2C: the ones to declare when the API is off) */
    async list() {
        const docs = (await DocumentsHelper.all()).filter(d => d.type === 'invoice' && d.status === 'final' && d.number)
        const rows = await DatabaseHelper.fetchAll('SELECT * FROM dc_einvoices')
        return docs.map(doc => {
            const row = rows.find(r => r.document_id === doc.id)
            return {
                id: doc.id, number: doc.number, issueDate: doc.issueDate, client: doc.client?.name || '', amount: doc.netToPay, currency: doc.currency,
                flow: row?.flow || FacturXData.flowOf(doc.client), status: row?.status || 'none', code: row?.status_code || '', message: row?.message || '',
                env: row?.env || '', sentAt: row?.sent_at || null, paymentReportedAt: row?.payment_reported_at || null,
                paid: doc.netToPay > 0 && paymentState(doc, doc.netToPay).remaining === 0,
            }
        })
    },

    async one(id: string) {
        return (await this.list()).find(item => item.id === id) || null
    },

    /** The Factur-X of an invoice sent to Super PDP (B2B: e-invoice, B2C: e-reporting) */
    async send(id: string, pdf: unknown) {
        const ready = await this.ready()
        if (!ready.platform) return ready
        const current = await this.one(id)
        if (current && ['sent', 'accepted'].includes(current.status)) return { error: 'einvAlreadySent', status: 409 }
        // Sandbox: the seller is the test company of the credentials (Super PDP only takes invoices of its own company)
        const made = await FacturXHelper.make(await DocumentsHelper.one(id), pdf, data => {
            if (ready.env !== 'sandbox' || !ready.company) return
            data.seller.name = ready.company.name || data.seller.name
            data.seller.einvoiceAddress = ready.company.address || ready.company.number
            data.seller.siren = ready.company.number.replace(/\D/g, '').slice(0, 9) || data.seller.siren
            // Its tax registration: its number, never the real VAT number of the owner
            data.seller.vatNumber = ''
            data.seller.siret = ready.company.number
        })
        if (!('bytes' in made) || !made.bytes) return made
        try {
            const rule = made.data.flow === 'b2b' ? 'B2B' : 'B2C'
            const { id: remoteId } = await ready.platform.sendInvoice(made.bytes, { externalId: made.data.number, processingRule: rule })
            await save(id, { flow: made.data.flow, status: 'sent', status_code: 'api:uploaded', message: '', remote_id: remoteId, env: ready.env, sent_at: new Date() })
            // Its first events (a refused one shows at once); the state stays 'sent' when they cannot be read yet
            await this.refresh(id)
            return { einvoice: await this.one(id) }
        } catch (error) {
            const res = failure(error)
            await save(id, { flow: made.data.flow, status: 'rejected', status_code: 'api:error', message: res.error.slice(0, 2000), env: ready.env })
            return res
        }
    },

    /** The events of an invoice sent read again: its state */
    async refresh(id: string) {
        if (await this.mode() !== 'api') return { error: 'einvApiOff', status: 409 }
        const row = await DatabaseHelper.fetchOne('SELECT remote_id FROM dc_einvoices WHERE document_id = ?', [id])
        if (!row?.remote_id) return { error: 'einvNotSent', status: 409 }
        try {
            const events = await SuperPdpHelper.platform().events(row.remote_id)
            if (events.length) {
                const state = stateOf(events)
                await save(id, { status: state.status, status_code: state.code, message: state.message.slice(0, 2000) })
            }
            return { einvoice: await this.one(id), events }
        } catch (error) { return failure(error) }
    },

    /** A paid invoice sent before: its payment declared (fr:212 "Encaissée", the e-reporting of the payment) */
    async reportPayment(id: string) {
        const ready = await this.ready()
        if (!ready.platform) return ready
        const item = await this.one(id)
        const row = await DatabaseHelper.fetchOne('SELECT remote_id FROM dc_einvoices WHERE document_id = ?', [id])
        if (!item || !row?.remote_id) return { error: 'einvNotSent', status: 409 }
        if (!item.paid) return { error: 'einvNotPaid', status: 409 }
        if (item.paymentReportedAt) return { error: 'einvPaymentAlreadyReported', status: 409 }
        try {
            await ready.platform.reportPayment(row.remote_id)
            await save(id, { payment_reported_at: new Date() })
            return { einvoice: await this.one(id) }
        } catch (error) { return failure(error) }
    },

    /** The invoices received on Super PDP (API on only) */
    async received() {
        const ready = await this.ready()
        if (!ready.platform) return ready
        try { return { invoices: await ready.platform.received(20) } } catch (error) { return failure(error) }
    },
}
