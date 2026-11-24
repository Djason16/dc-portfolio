import type Stripe from 'stripe'
import { PRICE_BOUNDS, type CatalogPrice } from '~/utils/toolsCatalog'

/*
 * What a licensed DC tool needs in Stripe, created when it is missing (ToolsSyncHelper.ts; the same as scripts/stripe-licenses.mjs):
 *   a product (id dc_<offer>, metadata dc_product), a monthly and a yearly price (lookup keys dc_<offer>_month / _year),
 *   and for a new tool its launch coupon DC_LAUNCH30_<OFFER> (-30 % for life, 50 uses).
 * NEVER changes nor archives an existing price, never touches a subscription. The bundle « DC complet »: a new price in the
 * catalog becomes a new Stripe price that takes the lookup key (only new purchases pay it; subscribers keep theirs).
 * Every function returns the lines of its report (« created price dc_audit_month (12 €) »...).
 */
type Interval = 'month' | 'year'
const INTERVALS: Interval[] = ['month', 'year']
const stripe = () => StripeHelper.client()

const inBounds = (price: CatalogPrice | null) => Boolean(price) && INTERVALS.every(i => price![i] >= PRICE_BOUNDS[i][0] && price![i] <= PRICE_BOUNDS[i][1])
const euros = (cents: number) => `${(cents / 100).toLocaleString('fr-FR')} €`

const priceOf = async (lookupKey: string) => (await stripe().prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 })).data[0] ?? null

// The product of an offer: the one made by this sync (id dc_<offer>), else the one of scripts/stripe-licenses.mjs (metadata)
const findProduct = async (offer: string): Promise<Stripe.Product | null> => {
    const own = await stripe().products.retrieve(`dc_${offer}`).catch(() => null)
    if (own && !own.deleted) return own as Stripe.Product
    return (await stripe().products.search({ query: `metadata['dc_product']:'${offer}'` })).data[0] ?? null
}

const createPrice = (product: string, offer: string, interval: Interval, amount: number, move = false) => stripe().prices.create({
    product, currency: 'eur', unit_amount: amount, recurring: { interval }, lookup_key: `dc_${offer}_${interval}`,
    ...(move ? { transfer_lookup_key: true } : {}), tax_behavior: 'inclusive', metadata: { dc_product: offer },
})

export const ToolsStripe = {
    /** A tool on sale: its product and its two prices (created when missing), its launch coupon when the product is new. */
    async ensureTool(offer: string, name: string, price: CatalogPrice | null): Promise<string[]> {
        const lines: string[] = []
        let product = await findProduct(offer)
        const isNew = !product
        if (!product) {
            if (!inBounds(price)) return [`ignoré ${name} : prix absent ou hors limites`]
            product = await stripe().products.create({
                id: `dc_${offer}`, name: `${name} Pro`, metadata: { dc_product: offer }, tax_code: 'txcd_10202000',
                description: `${name} Pro — https://tools.djason-chery.dev/`,
            })
            lines.push(`Produit Stripe créé : ${name} Pro`)
        }
        for (const interval of INTERVALS) {
            if (await priceOf(`dc_${offer}_${interval}`)) continue
            if (!inBounds(price)) {
                lines.push(`Prix ignoré : dc_${offer}_${interval} (prix absent ou hors limites)`)
                continue
            }
            await createPrice(product.id, offer, interval, price![interval])
            lines.push(`Prix créé : dc_${offer}_${interval} (${euros(price![interval])})`)
        }
        if (isNew) {
            const id = `DC_LAUNCH30_${offer.toUpperCase().replace(/-/g, '_')}`
            const exists = await stripe().coupons.retrieve(id).catch(() => null)
            if (!exists) {
                await stripe().coupons.create({
                    id, name: 'Lancement -30 % à vie', percent_off: 30, duration: 'forever', max_redemptions: 50, applies_to: { products: [product.id] },
                    metadata: { dc_product: offer, dc_label_fr: 'Lancement : -30 % à vie', dc_label_en: 'Launch: -30% for life' },
                })
                lines.push(`Coupon de lancement créé : ${id} (-30 % à vie, 50 utilisations)`)
            }
        }
        return lines
    },

    /** The bundle: a price of the catalog different from the current one becomes the price of the new purchases. */
    async ensureBundle(price: CatalogPrice | null, name: string): Promise<string[]> {
        if (!price) return []
        if (!inBounds(price)) return ['ignoré prix du pack DC complet : hors limites']
        const product = await findProduct('bundle')
        if (!product) return ['ignoré pack DC complet : produit Stripe introuvable (scripts/stripe-licenses.mjs)']
        const lines: string[] = []
        for (const interval of INTERVALS) {
            const current = await priceOf(`dc_bundle_${interval}`)
            if (current?.unit_amount === price[interval]) continue
            // The new price takes the lookup key; the old one stays (its subscribers keep paying it), never archived here
            await createPrice(product.id, 'bundle', interval, price[interval], Boolean(current))
            lines.push(`Prix du pack ${name} : dc_bundle_${interval} ${current?.unit_amount ? `${euros(current.unit_amount)} → ` : ''}${euros(price[interval])} (nouveaux achats seulement)`)
        }
        return lines
    },
}
