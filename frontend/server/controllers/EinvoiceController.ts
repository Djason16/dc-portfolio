import type { RouteArgs } from '../utils/RouteDiscovery'
import type { H3Event } from 'h3'
/*
 * Electronic invoices (French reform: Factur-X, Super PDP), admin only (server/helpers/EinvoiceHelper.ts):
 *   GET    /api/einvoice                      { settings, invoices } the mode and every finalized invoice with its e-invoice state
 *   PUT    /api/einvoice                      { mode: 'manual' | 'api' }
 *   PUT    /api/einvoice/credentials          { clientId, clientSecret } of a Super PDP application, written in the .env (never read back)
 *   DELETE /api/einvoice/credentials          API cut, credentials removed: manual mode
 *   POST   /api/einvoice/test                 the company of the credentials (a harmless read): { company, expected, matches }
 *   GET    /api/einvoice/received             the invoices received on Super PDP (API on)
 *   POST   /api/einvoice/{id}/facturx         { pdf } the PDF drawn by the browser -> { file: base64 Factur-X, name, flow }
 *   POST   /api/einvoice/{id}/send            { pdf } its Factur-X sent to Super PDP (B2B e-invoice, B2C e-reporting)
 *   POST   /api/einvoice/{id}/refresh         its events read again
 *   POST   /api/einvoice/{id}/payment         a paid invoice: its payment declared (status fr:212)
 */
type Result = { error?: string, errors?: string[], status?: number, [key: string]: unknown }
const answer = (event: H3Event, result: Result) => {
    if (!result.error) return ResponseHelper.success(event, result)
    const { error, status, ...rest } = result
    return ResponseHelper.error(event, error, status || 400, 'EINVOICE_ERROR', rest)
}

export default class EinvoiceController extends Controller {
    static routes = {
        setMode: ['PUT', ''],
        saveCredentials: ['PUT', '/credentials'],
        removeCredentials: ['DELETE', '/credentials'],
        test: ['POST', '/test'],
        received: ['GET', '/received'],
        facturx: ['POST', '/{id}/facturx'],
        send: ['POST', '/{id}/send'],
        refresh: ['POST', '/{id}/refresh'],
        payment: ['POST', '/{id}/payment'],
    }

    async getAll(event: H3Event) {
        return ResponseHelper.success(event, { settings: await EinvoiceHelper.settings(), invoices: await EinvoiceHelper.list() })
    }

    async setMode(event: H3Event) {
        return answer(event, await EinvoiceHelper.setMode(String(((await this.body(event)) || {}).mode || '')))
    }

    async saveCredentials(event: H3Event) {
        const body = (await this.body(event)) || {}
        return answer(event, await EinvoiceHelper.saveCredentials(body.clientId, body.clientSecret))
    }

    async removeCredentials(event: H3Event) {
        return answer(event, await EinvoiceHelper.removeCredentials())
    }

    async test(event: H3Event) {
        return answer(event, await EinvoiceHelper.test())
    }

    async received(event: H3Event) {
        return answer(event, await EinvoiceHelper.received())
    }

    // The Factur-X to download (manual mode: uploaded by hand on the Super PDP website)
    async facturx(event: H3Event, args: RouteArgs) {
        const doc = await DocumentsHelper.one(args.id)
        const res = await FacturXHelper.make(doc, ((await this.body(event)) || {}).pdf)
        if (!('bytes' in res) || !res.bytes) return answer(event, res as Result)
        return ResponseHelper.success(event, { file: Buffer.from(res.bytes).toString('base64'), name: `${res.data.number}.pdf`, flow: res.data.flow })
    }

    async send(event: H3Event, args: RouteArgs) {
        return answer(event, await EinvoiceHelper.send(args.id, ((await this.body(event)) || {}).pdf) as Result)
    }

    async refresh(event: H3Event, args: RouteArgs) {
        return answer(event, await EinvoiceHelper.refresh(args.id) as Result)
    }

    async payment(event: H3Event, args: RouteArgs) {
        return answer(event, await EinvoiceHelper.reportPayment(args.id) as Result)
    }
}
