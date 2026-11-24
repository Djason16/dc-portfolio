import { DatabaseHelper } from '../utils/DatabaseHelper'
import { LicenseProducts } from './LicenseProducts'
import { ToolsCatalogHelper } from './ToolsCatalogHelper'
import { ToolsStripe } from './ToolsStripe'

/*
 * A DC tool released on tools.djason-chery.dev is put on sale here by itself (server/plugins/tools-sync.ts, every hour, or
 * admin > Outils DC > « Synchroniser maintenant »):
 *   1. the catalog read from the sales site (never the built-in list); each tool not registered yet goes into
 *      dc_license_products (min_version 1.0.0) when its prices are within bounds, else it is skipped and reported
 *   2. Stripe (ToolsStripe.ts): product, monthly and yearly prices, launch coupon of a new tool; the bundle price of the catalog
 *   3. the report kept in dc_settings « toolsSync », and e-mailed to the owner when something was created, skipped or failed
 * One run at a time; safe to run again (nothing is created twice, nothing existing is changed).
 */
const SETTING = 'toolsSync'
export type SyncReport = { at: string, ok: boolean, error: string, lines: string[] }

let running: Promise<SyncReport> | null = null

const save = (report: SyncReport) => DatabaseHelper.execute('INSERT INTO dc_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
    [SETTING, JSON.stringify(report)]).catch(error => console.warn('[tools sync] report not saved:', error.message))

// A short e-mail to the owner of the site (never throws; MAIL_LOG_ONLY: written in the log)
const tell = async (report: SyncReport) => {
    try {
        const settings = await SettingsHelper.all()
        const to = settings.email || useRuntimeConfig().adminEmail
        if (!to) return
        const text = [report.ok ? 'Synchronisation des outils DC :' : `Synchronisation des outils DC en erreur : ${report.error}`, '', ...report.lines.map(line => `- ${line}`),
            '', 'Détail : admin → Outils DC.'].join('\n')
        await MailHelper.send({ to, subject: report.ok ? 'Outils DC : nouveautés en vente' : 'Outils DC : synchronisation en erreur', text })
    } catch (error) {
        console.warn('[tools sync] e-mail not sent:', (error as Error).message)
    }
}

const sync = async (): Promise<SyncReport> => {
    const lines: string[] = []
    const report = (ok: boolean, error = ''): SyncReport => ({ at: new Date().toISOString(), ok, error, lines })
    const catalog = await ToolsCatalogHelper.read()
    if (!catalog) return report(false, `Catalogue des outils indisponible (tools.djason-chery.dev/tools.json)${ToolsCatalogHelper.lastError() ? ` : ${ToolsCatalogHelper.lastError()}` : ''}`)

    // 1. New tools registered (their prices checked first)
    const known = await LicenseProducts.ids()
    for (const tool of catalog.tools.filter(t => !known.includes(t.id))) {
        if (!tool.price) {
            lines.push(`Ignoré : ${tool.name} (prix absent ou hors limites dans tools.json)`)
            continue
        }
        if (await LicenseProducts.register({ id: tool.id, name: tool.name, priceMonth: tool.price.month, priceYear: tool.price.year }))
            lines.push(`Outil enregistré : ${tool.name} (version minimale 1.0.0)`)
    }

    // 2. Stripe: what each registered tool needs, then the bundle
    try {
        for (const row of await LicenseProducts.rows()) {
            const price = row.priceMonth && row.priceYear ? { month: row.priceMonth, year: row.priceYear } : null
            lines.push(...await ToolsStripe.ensureTool(row.id, row.name, price))
        }
        lines.push(...await ToolsStripe.ensureBundle(catalog.bundle, 'DC complet'))
    } catch (error) {
        return report(false, `Stripe : ${(error as Error).message}`)
    }
    return report(true)
}

export const ToolsSyncHelper = {
    /** One run (the running one when it is already going). */
    run(): Promise<SyncReport> {
        return running ??= (async () => {
            const report = await sync().catch(error => ({ at: new Date().toISOString(), ok: false, error: (error as Error).message, lines: [] }))
            LicenseOffers.clear()
            // An e-mail only for something new: not the same skipped tool or the same error every hour
            const before = (await ToolsSyncHelper.status()).last
            const same = before && before.ok === report.ok && before.error === report.error && JSON.stringify(before.lines) === JSON.stringify(report.lines)
            await save(report)
            if ((!report.ok || report.lines.length) && !same) await tell(report)
            if (!report.ok) console.warn('[tools sync]', report.error)
            return report
        })().finally(() => { running = null })
    },

    /** The last report and the registered tools (admin > Outils DC). */
    async status() {
        const row = await DatabaseHelper.fetchOne('SELECT value FROM dc_settings WHERE `key` = ?', [SETTING]).catch(() => null)
        let last: SyncReport | null = null
        try { last = row?.value ? JSON.parse(String(row.value)) : null } catch { last = null }
        const products = (await LicenseProducts.rows()).map(p => ({ id: p.id, name: p.name, minVersion: p.minVersion, priceMonth: p.priceMonth, priceYear: p.priceYear }))
        return { last, running: Boolean(running), products }
    },
}
