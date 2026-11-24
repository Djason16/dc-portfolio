import { defineStore } from 'pinia'
import { api, type ApiResult } from '@/utils/api'

/*
 * Electronic invoices of the admin (/api/einvoice, server/helpers/EinvoiceHelper.ts): the Super PDP settings and the
 * e-invoice state of every finalized invoice. Every action returns the answer of the API and keeps the lists up to date.
 *   const einvoice = useEinvoiceStore()
 *   await einvoice.load()                 settings + invoices
 *   einvoice.of(id)                       the state of one invoice (null: not finalized yet)
 */
export type EinvoiceSettings = { mode: 'manual' | 'api', configured: boolean, env: string, apiUrl: string, mock: boolean, clientIdHint: string }
export type EinvoiceItem = {
    id: string, number: string, issueDate: string, client: string, amount: number, currency: string, flow: 'b2b' | 'b2c'
    status: 'none' | 'sent' | 'accepted' | 'rejected', code: string, message: string, env: string, sentAt: string | null, paymentReportedAt: string | null, paid: boolean
}

export const useEinvoiceStore = defineStore('einvoice', {
    state: () => ({
        settings: null as EinvoiceSettings | null,
        invoices: [] as EinvoiceItem[],
    }),
    actions: {
        async load() {
            const res = await api.get('/einvoice')
            if (res.success) Object.assign(this, { settings: res.settings, invoices: res.invoices })
            return res
        },
        of(id: string) {
            return this.invoices.find(item => item.id === id) || null
        },
        // The new state of one invoice, or the new settings, kept
        keep(res: ApiResult) {
            if (res.success && res.settings) this.settings = res.settings
            if (res.success && res.einvoice) {
                const i = this.invoices.findIndex(item => item.id === res.einvoice.id)
                if (i === -1) this.invoices.unshift(res.einvoice)
                else this.invoices.splice(i, 1, res.einvoice)
            }
            return res
        },
        async setMode(mode: string) { return this.keep(await api.put('/einvoice', { mode })) },
        async saveCredentials(clientId: string, clientSecret: string) { return this.keep(await api.put('/einvoice/credentials', { clientId, clientSecret })) },
        async removeCredentials() { return this.keep(await api.delete('/einvoice/credentials')) },
        async test() { return api.post('/einvoice/test', {}) },
        async received() { return api.get('/einvoice/received') },
        async facturx(id: string, pdf: string) { return api.post(`/einvoice/${id}/facturx`, { pdf }) },
        async send(id: string, pdf: string) { const res = this.keep(await api.post(`/einvoice/${id}/send`, { pdf })); if (!res.success) await this.load(); return res },
        async refresh(id: string) { return this.keep(await api.post(`/einvoice/${id}/refresh`, {})) },
        async reportPayment(id: string) { return this.keep(await api.post(`/einvoice/${id}/payment`, {})) },
    },
})
