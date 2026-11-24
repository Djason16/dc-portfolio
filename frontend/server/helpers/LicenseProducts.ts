import { DatabaseHelper } from '../utils/DatabaseHelper'
import { LICENSE_PRICES, LICENSE_PRODUCTS } from './LicenseSchema'

/*
 * The DC tools that can be licensed: the rows of dc_license_products (the source of truth, filled by the sync of the tools
 * catalog, ToolsSyncHelper.ts, when a tool is released), kept one minute in memory:
 *   await LicenseProducts.ids()                 ['scaffold', 'prospect', ...] in their order
 *   await LicenseProducts.isOffer('bundle')     a tool or the bundle « DC complet » (every registered tool)
 *   await LicenseProducts.productsOfOffer(o)    the tools an offer opens
 *   await LicenseProducts.names()               { scaffold: 'DC Scaffold', ... }
 * A failure to read the table: the tools known to the code (never no tool at all).
 */
export type LicenseProductRow = { id: string, name: string, minVersion: string, priceMonth: number | null, priceYear: number | null, sort: number }

const TTL = 60 * 1000
const ID = /^[a-z0-9-]{2,24}$/
let cache: { at: number, rows: LicenseProductRow[] } | null = null

// The name of a tool the code knows ("DC Scaffold Pro" -> "DC Scaffold"), else "DC <Id>"
export const defaultProductName = (id: string) => (LICENSE_PRICES as Record<string, { name: string }>)[id]?.name.replace(/ Pro( \(.*\))?$/, '')
    ?? `DC ${id.charAt(0).toUpperCase()}${id.slice(1)}`

const known = (): LicenseProductRow[] => LICENSE_PRODUCTS.map((id, sort) => ({
    id, name: defaultProductName(id), minVersion: '1.0.0', priceMonth: LICENSE_PRICES[id]?.month ?? null, priceYear: LICENSE_PRICES[id]?.year ?? null, sort,
}))

export const LicenseProducts = {
    async rows(): Promise<LicenseProductRow[]> {
        if (cache && Date.now() - cache.at < TTL) return cache.rows
        try {
            const rows = (await DatabaseHelper.fetchAll('SELECT * FROM dc_license_products ORDER BY sort_order, product'))
                .filter(row => ID.test(String(row.product)))
                .map(row => ({
                    id: String(row.product), name: String(row.name || defaultProductName(String(row.product))), minVersion: String(row.min_version || '1.0.0'),
                    priceMonth: row.price_month === null || row.price_month === undefined ? null : Number(row.price_month),
                    priceYear: row.price_year === null || row.price_year === undefined ? null : Number(row.price_year),
                    sort: Number(row.sort_order ?? 0),
                }))
            cache = { at: Date.now(), rows: rows.length ? rows : known() }
        } catch (error) {
            console.warn('[licences] products not read:', (error as Error).message)
            return cache?.rows ?? known()
        }
        return cache.rows
    },

    /** The ids read last (no wait; the tools known to the code before the first read): for the code that cannot wait. */
    cachedIds(): string[] {
        return (cache?.rows ?? known()).map(row => row.id)
    },

    async ids() {
        return (await LicenseProducts.rows()).map(row => row.id)
    },

    async offers() {
        return [...await LicenseProducts.ids(), 'bundle']
    },

    async isProduct(value: unknown) {
        return typeof value === 'string' && (await LicenseProducts.ids()).includes(value)
    },

    async isOffer(value: unknown) {
        return typeof value === 'string' && (await LicenseProducts.offers()).includes(value)
    },

    async productsOfOffer(offer: string) {
        return offer === 'bundle' ? LicenseProducts.ids() : [offer]
    },

    async names(): Promise<Record<string, string>> {
        return Object.fromEntries((await LicenseProducts.rows()).map(row => [row.id, row.name]))
    },

    /** Name of the Stripe subscription of an offer: "DC Scaffold Pro", "DC complet Pro (Scaffold, Prospect…)". */
    async subscriptionName(offer: string) {
        const rows = await LicenseProducts.rows()
        if (offer !== 'bundle') return `${rows.find(row => row.id === offer)?.name ?? defaultProductName(offer)} Pro`
        return `DC complet Pro (${rows.map(row => row.name.replace(/^DC /, '')).join(', ')})`
    },

    /** A new tool (the sync of the catalog); nothing changes when it is already there. Returns true when it was added. */
    async register(row: { id: string, name: string, priceMonth: number, priceYear: number }) {
        if (!ID.test(row.id)) return false
        const last = await DatabaseHelper.fetchOne('SELECT COALESCE(MAX(sort_order), 0) AS last FROM dc_license_products')
        const added = await DatabaseHelper.execute(
            'INSERT IGNORE INTO dc_license_products (product, min_version, name, sort_order, price_month, price_year) VALUES (?, ?, ?, ?, ?, ?)',
            [row.id, '1.0.0', row.name, Number(last?.last ?? 0) + 1, row.priceMonth, row.priceYear])
        LicenseProducts.clear()
        return Boolean(added)
    },

    clear() {
        cache = null
    },
}
