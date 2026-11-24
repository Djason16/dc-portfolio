/*
 * Super PDP (https://www.superpdp.tech), the approved platform (PA) of the owner for the French e-invoicing reform.
 * API v1.beta, documented by https://api.superpdp.tech/openapi/superpdp.json (checked 2026-11-23):
 *   POST /oauth2/token                    client_credentials (client_id, client_secret) -> access_token (30 min)
 *   GET  /v1.beta/companies/me            the company of the token: { env: 'sandbox' | 'production', number, formal_name }
 *   GET  /v1.beta/directory_entries       its addresses in the directory (identifier 0225:<address>)
 *   POST /v1.beta/invoices                body: the Factur-X PDF (application/pdf); ?external_id=&processing_rule=B2B|B2C
 *   GET  /v1.beta/invoice_events          ?invoice_id= -> { data: [{ status_code, status_text, created_at }] }
 *   POST /v1.beta/invoice_events          { invoice_id, status_code: 'fr:212' } the payment received ("Encaissée", e-reporting)
 *   GET  /v1.beta/invoices?direction=in   the invoices received
 * There is one address for both environments: the sandbox or production comes from the company of the credentials
 * (an application made for a sandbox company of the account, or for the real one).
 *
 * .env (server only, never sent to the browser):
 *   SUPERPDP_CLIENT_ID, SUPERPDP_CLIENT_SECRET   credentials of an application of the Super PDP account
 *   SUPERPDP_API_URL                             https://api.superpdp.tech by default
 *   SUPERPDP_ENV                                 sandbox (default) or production: anything is sent only when the company of the
 *                                                credentials is in this environment (no real invoice sent by a test)
 *   SUPERPDP_MOCK                                true: a fake platform in memory (tests without any account, nothing sent)
 *
 *   const platform = SuperPdpHelper.platform()     the real one, or the mock
 */

// address: its electronic invoicing address in the directory (0225:<address>, read from /v1.beta/directory_entries), if any
export type PlatformCompany = { env: 'sandbox' | 'production', number: string, name: string, address: string }
export type PlatformEvent = { code: string, text: string, at: string }
export type PlatformInvoice = { id: string, number: string, seller: string, date: string, amount: string, createdAt: string }

/** What the site needs from an approved platform: the real Super PDP or its mock */
export interface EinvoicePlatform {
    readonly mock: boolean
    company(): Promise<PlatformCompany>
    sendInvoice(pdf: Uint8Array, options: { externalId: string, processingRule: 'B2B' | 'B2C' }): Promise<{ id: string }>
    events(id: string): Promise<PlatformEvent[]>
    reportPayment(id: string): Promise<void>
    received(limit?: number): Promise<PlatformInvoice[]>
}

export class PlatformError extends Error {
    constructor(message: string, readonly status = 502) { super(message) }
}

const config = () => ({
    url: String(process.env.SUPERPDP_API_URL || 'https://api.superpdp.tech').replace(/\/+$/, ''),
    clientId: String(process.env.SUPERPDP_CLIENT_ID || '').trim(),
    clientSecret: String(process.env.SUPERPDP_CLIENT_SECRET || '').trim(),
    env: process.env.SUPERPDP_ENV === 'production' ? 'production' : 'sandbox',
    mock: process.env.SUPERPDP_MOCK === 'true',
})

// The access token, kept until a minute before it ends (one per client id)
let token: { clientId: string, value: string, until: number } | null = null

class SuperPdpClient implements EinvoicePlatform {
    readonly mock = false

    private async accessToken() {
        const { url, clientId, clientSecret } = config()
        if (!clientId || !clientSecret) throw new PlatformError('einvNoCredentials', 400)
        if (token && token.clientId === clientId && token.until > Date.now()) return token.value
        const res = await fetch(`${url}/oauth2/token`, {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }).toString(),
            signal: AbortSignal.timeout(15000),
        })
        if (!res.ok) throw new PlatformError(res.status === 400 || res.status === 401 ? 'einvBadCredentials' : `Super PDP: HTTP ${res.status}`, 502)
        const body = await res.json() as { access_token?: string, expires_in?: number }
        if (!body.access_token) throw new PlatformError('einvBadCredentials')
        token = { clientId, value: body.access_token, until: Date.now() + ((body.expires_in || 1800) - 60) * 1000 }
        return token.value
    }

    private async call<T>(method: string, path: string, { body, type }: { body?: BodyInit, type?: string } = {}): Promise<T> {
        const res = await fetch(`${config().url}${path}`, {
            method, body, signal: AbortSignal.timeout(30000),
            headers: { Authorization: `Bearer ${await this.accessToken()}`, Accept: 'application/json', ...(type ? { 'Content-Type': type } : {}) },
        })
        const text = await res.text()
        let json: any = null
        try { json = text ? JSON.parse(text) : null } catch { /* not JSON */ }
        // Errors: { code?, http_status_code, message }
        if (!res.ok) throw new PlatformError(`Super PDP ${res.status}: ${json?.message || text.slice(0, 300) || res.statusText}`, res.status >= 500 ? 502 : 400)
        return json as T
    }

    async company() {
        const c = await this.call<any>('GET', '/v1.beta/companies/me')
        const entries = await this.call<any>('GET', '/v1.beta/directory_entries').catch(() => null)
        const entry = (entries?.data || []).find((e: any) => String(e.identifier || '').startsWith('0225:')) || entries?.data?.[0]
        return { env: c?.env === 'production' ? 'production' : 'sandbox', number: String(c?.number || ''), name: String(c?.formal_name || c?.trade_name || ''),
            address: String(entry?.identifier || '').replace(/^0225:/, '') } as PlatformCompany
    }

    async sendInvoice(pdf: Uint8Array, { externalId, processingRule }: { externalId: string, processingRule: 'B2B' | 'B2C' }) {
        const query = new URLSearchParams({ external_id: externalId.slice(0, 36), processing_rule: processingRule })
        const invoice = await this.call<any>('POST', `/v1.beta/invoices?${query}`, { body: Buffer.from(pdf), type: 'application/pdf' })
        if (!invoice?.id) throw new PlatformError('Super PDP: no invoice id')
        return { id: String(invoice.id) }
    }

    async events(id: string) {
        const list = await this.call<any>('GET', `/v1.beta/invoice_events?${new URLSearchParams({ invoice_id: id, limit: '100' })}`)
        return (list?.data || []).map((e: any) => ({ code: String(e.status_code), text: String(e.status_text || ''), at: String(e.created_at || '') }))
    }

    async reportPayment(id: string) {
        // fr:212 "Encaissée" without details: the amount is the total of the invoice (Super PDP documentation)
        await this.call('POST', '/v1.beta/invoice_events', { body: JSON.stringify({ invoice_id: Number(id), status_code: 'fr:212' }), type: 'application/json' })
    }

    async received(limit = 20) {
        const list = await this.call<any>('GET', `/v1.beta/invoices?${new URLSearchParams({ direction: 'in', order: 'desc', limit: String(limit), 'expand[]': 'en_invoice' })}`)
        return (list?.data || []).map((i: any) => ({
            id: String(i.id), number: String(i.en_invoice?.number || i.external_id || i.id), seller: String(i.en_invoice?.seller?.name || ''),
            date: String(i.en_invoice?.issue_date || '').slice(0, 10), amount: String(i.en_invoice?.totals?.amount_due_for_payment ?? i.en_invoice?.totals?.total_with_vat ?? ''),
            createdAt: String(i.created_at || ''),
        }))
    }
}

// A platform in memory for tests (SUPERPDP_MOCK=true): an invoice is validated, then sent, then received by the buyer
const mockInvoices = new Map<string, { at: number, rule: string, paid: boolean }>()
class SuperPdpMock implements EinvoicePlatform {
    readonly mock = true
    async company() { return { env: 'sandbox', number: '000000002', name: 'Mock company (SUPERPDP_MOCK)', address: '315143296_002' } as PlatformCompany }
    async sendInvoice(pdf: Uint8Array, { processingRule }: { externalId: string, processingRule: 'B2B' | 'B2C' }) {
        if (!Buffer.from(pdf.subarray(0, 5)).toString('latin1').startsWith('%PDF')) throw new PlatformError('Super PDP 400: not a PDF', 400)
        const id = String(mockInvoices.size + 1000)
        mockInvoices.set(id, { at: Date.now(), rule: processingRule, paid: false })
        return { id }
    }
    async events(id: string) {
        const invoice = mockInvoices.get(id)
        if (!invoice) throw new PlatformError('Super PDP 404: invoice not found', 400)
        const at = (ms: number) => new Date(invoice.at + ms).toISOString()
        const steps = [{ code: 'api:uploaded', text: 'Uploaded', ms: 0 }, { code: 'api:validated', text: 'Validated', ms: 1000 },
            ...(invoice.rule === 'B2B' ? [{ code: 'fr:200', text: 'Déposée', ms: 2000 }, { code: 'fr:202', text: 'Reçue', ms: 4000 }] : [{ code: 'api:sent', text: 'Reported', ms: 2000 }])]
        const done = steps.filter(step => Date.now() - invoice.at >= step.ms).map(step => ({ code: step.code, text: step.text, at: at(step.ms) }))
        return invoice.paid ? [...done, { code: 'fr:212', text: 'Encaissée', at: new Date().toISOString() }] : done
    }
    async reportPayment(id: string) {
        const invoice = mockInvoices.get(id)
        if (!invoice) throw new PlatformError('Super PDP 404: invoice not found', 400)
        invoice.paid = true
    }
    async received() { return [{ id: '1', number: 'MOCK-0001', seller: 'Fournisseur fictif', date: '2026-11-20', amount: '120.00', createdAt: new Date().toISOString() }] }
}

export const SuperPdpHelper = {
    config,
    /** The real Super PDP client, or the mock when SUPERPDP_MOCK=true */
    platform: (): EinvoicePlatform => config().mock ? new SuperPdpMock() : new SuperPdpClient(),
    /** Credentials filled in (the mock needs none) */
    configured: () => config().mock || Boolean(config().clientId && config().clientSecret),
    /** Forgets the access token (credentials changed or removed) */
    forget: () => { token = null },
}
