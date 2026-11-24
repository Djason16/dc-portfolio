import type { BillingDocument } from '@/utils/billing'
import { loadBank } from '@/composables/useDocumentMail'
import { useEinvoiceStore } from '@/stores/einvoice'
import { pdfOptions } from '@/utils/documentPdf'
import { exportPdf } from '@/utils/pdf'

/*
 * Factur-X of an invoice: its PDF drawn here, in the browser (the same file as the download), the server adds the XML
 * of the invoice and makes it PDF/A-3 (POST /api/einvoice/{id}/facturx), or sends it to Super PDP (/send).
 *   const { download, send } = useEinvoice()
 *   await download(doc)      saves <number>.pdf, the Factur-X (to upload by hand on superpdp.tech)
 *   await send(doc)          sent through the Super PDP API (API mode)
 */
const drawn = async (doc: BillingDocument) => (await exportPdf({ ...pdfOptions(doc, {}, await loadBank()), output: 'base64' })) || ''

const save = (base64: string, name: string) => {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
    const link = Object.assign(document.createElement('a'), { href: url, download: name, title: name })
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const useEinvoice = () => {
    const store = useEinvoiceStore()

    const download = async (doc: BillingDocument) => {
        try {
            const res = await store.facturx(doc.id, await drawn(doc))
            if (res.success) save(res.file, res.name)
            return res
        } catch {
            return { success: false, error: 'documentFailed' }
        }
    }

    const send = async (doc: BillingDocument) => {
        try {
            return await store.send(doc.id, await drawn(doc))
        } catch {
            return { success: false, error: 'documentFailed' }
        }
    }

    return { download, send }
}
