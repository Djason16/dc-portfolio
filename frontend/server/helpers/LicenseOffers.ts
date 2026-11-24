import type Stripe from 'stripe'
import { type LicenseOffer } from './LicenseSchema'
import { LicenseProducts } from './LicenseProducts'

/*
 * Prices and current offers of the DC tools, read from Stripe (the only place to change them), kept 5 minutes:
 *   LicenseOffers.list()          the offers running now (a Stripe coupon with metadata dc_product = a tool, "bundle" or "all")
 *   LicenseOffers.best(product)   the best running offer for a checkout (highest reduction), or null
 *   LicenseOffers.prices()        { <offer>: { month, year } } in euro cents, from the prices with lookup keys dc_<offer>_<interval>
 * An offer ends by itself in Stripe: its last use (max redemptions), its end date (redeem by) or when it is deleted/archived.
 * Its texts on the sales site: metadata dc_label_fr / dc_label_en (else the coupon name).
 */
export type DcOffer = {
    id: string, product: LicenseOffer | 'all', percentOff: number | null, amountOff: number | null,
    duration: 'forever' | 'once' | 'repeating', months: number | null, remaining: number | null, endsAt: string | null,
    labelFr: string, labelEn: string,
}

const TTL_MS = 5 * 60 * 1000
let offersCache: { at: number, value: DcOffer[] } | null = null
let pricesCache: { at: number, value: Record<string, { month: number | null, year: number | null }> } | null = null

const fresh = <T>(cache: { at: number, value: T } | null) => cache && Date.now() - cache.at < TTL_MS ? cache.value : null

const toOffer = (coupon: Stripe.Coupon): DcOffer | null => {
    const product = coupon.metadata?.dc_product
    if (!coupon.valid || !(product === 'all' || [...LicenseProducts.cachedIds(), 'bundle'].includes(String(product)))) return null
    return {
        id: coupon.id, product: product as DcOffer['product'], percentOff: coupon.percent_off ?? null,
        amountOff: coupon.amount_off ?? null, duration: coupon.duration as DcOffer['duration'], months: coupon.duration_in_months ?? null,
        remaining: coupon.max_redemptions ? Math.max(0, coupon.max_redemptions - coupon.times_redeemed) : null,
        endsAt: coupon.redeem_by ? new Date(coupon.redeem_by * 1000).toISOString() : null,
        labelFr: coupon.metadata?.dc_label_fr || coupon.name || '', labelEn: coupon.metadata?.dc_label_en || coupon.name || '',
    }
}

export const LicenseOffers = {
    /** Forget the cached offers and prices (after a change from the admin). */
    clear() {
        offersCache = null
        pricesCache = null
    },

    async list(): Promise<DcOffer[]> {
        const cached = fresh(offersCache)
        if (cached) return cached
        try {
            await LicenseProducts.rows()
            const coupons = await StripeHelper.client().coupons.list({ limit: 100 })
            const value = coupons.data.map(toOffer).filter((o): o is DcOffer => Boolean(o) && (o!.remaining === null || o!.remaining > 0))
            offersCache = { at: Date.now(), value }
            return value
        } catch (error) {
            console.error('Stripe offers not read:', (error as Error).message)
            return offersCache?.value ?? []
        }
    },

    /** The best running offer for a tool or the bundle (an offer for "all" counts too). */
    async best(product: LicenseOffer) {
        const offers = (await LicenseOffers.list()).filter(o => o.product === product || o.product === 'all')
        return offers.sort((a, b) => (b.percentOff ?? 0) - (a.percentOff ?? 0))[0] ?? null
    },

    async prices() {
        const cached = fresh(pricesCache)
        if (cached) return cached
        const offers = await LicenseProducts.offers()
        const keys = offers.flatMap(o => [`dc_${o}_month`, `dc_${o}_year`])
        try {
            // Stripe takes 10 lookup keys at most per call: one call per group of 10
            const groups = Array.from({ length: Math.ceil(keys.length / 10) }, (_, i) => keys.slice(i * 10, i * 10 + 10))
            const lists = await Promise.all(groups.map(lookup_keys => StripeHelper.client().prices.list({ lookup_keys, active: true, limit: 20 })))
            const value: Record<string, { month: number | null, year: number | null }> = {}
            for (const offer of offers) value[offer] = { month: null, year: null }
            for (const price of lists.flatMap(list => list.data)) {
                const match = /^dc_(\w+)_(month|year)$/.exec(price.lookup_key || '')
                if (match && value[match[1]!]) value[match[1]!]![match[2] as 'month' | 'year'] = price.unit_amount
            }
            pricesCache = { at: Date.now(), value }
            return value
        } catch (error) {
            console.error('Stripe prices not read:', (error as Error).message)
            return pricesCache?.value ?? {}
        }
    },
}
