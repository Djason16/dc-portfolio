import { LICENSE_PRICES, type LicenseOffer } from './LicenseSchema'
import { LicenseProducts } from './LicenseProducts'

/*
 * Prices and offers of the DC tools changed from the admin (server/controllers/LicensePricingController.ts), written in Stripe:
 *   LicensePricing.setPrice(offer, interval, cents)   a new Stripe price takes the lookup key dc_<offer>_<interval> (a Stripe price
 *                                                     can't change): new customers pay it; running subscriptions keep theirs
 *   LicensePricing.createOffer({...})                 a Stripe coupon with metadata dc_product / dc_label_fr / dc_label_en
 *   LicensePricing.deleteOffer(id)                    the coupon deleted: no new use (customers who have it keep their reduction)
 * The sales site and the checkout read them back (LicenseOffers.ts, 5 minutes cache, emptied here after a change).
 */
const stripe = () => StripeHelper.client()
const isInterval = (value: unknown): value is 'month' | 'year' => value === 'month' || value === 'year'

// The Stripe product of an offer (created by scripts/stripe-licenses.mjs, metadata dc_product)
const productOf = async (offer: LicenseOffer) =>
    (await stripe().products.search({ query: `metadata['dc_product']:'${offer}'` })).data[0] ?? null

export type NewOffer = {
    product: unknown, percentOff: unknown, duration: unknown, months?: unknown, maxRedemptions?: unknown,
    redeemBy?: unknown, labelFr?: unknown, labelEn?: unknown,
}

export const LicensePricing = {
    async setPrice(offer: unknown, interval: unknown, cents: unknown) {
        const amount = Math.round(Number(cents))
        if (!(await LicenseProducts.isOffer(offer)) || !isInterval(interval)) return 'licenseUnknownProduct'
        if (!Number.isFinite(amount) || amount < 100 || amount > 1_000_000) return 'licensePriceInvalid'
        const product = await productOf(offer as string)
        if (!product) return 'licenseNotForSale'
        const lookupKey = `dc_${offer}_${interval}`
        const old = (await stripe().prices.list({ lookup_keys: [lookupKey], limit: 1 })).data[0]
        if (old?.unit_amount === amount) return null
        await stripe().prices.create({
            product: product.id, currency: 'eur', unit_amount: amount, recurring: { interval },
            lookup_key: lookupKey, transfer_lookup_key: true, tax_behavior: 'inclusive', metadata: { dc_product: String(offer) },
        })
        if (old) await stripe().prices.update(old.id, { active: false })
        LicenseOffers.clear()
        return null
    },

    async createOffer(data: NewOffer) {
        const product = String(data.product)
        if (!((await LicenseProducts.isOffer(product)) || product === 'all')) return 'licenseUnknownProduct'
        const percent = Number(data.percentOff)
        if (!Number.isFinite(percent) || percent < 1 || percent > 100) return 'licenseOfferPercentInvalid'
        const duration = ['forever', 'once', 'repeating'].includes(String(data.duration)) ? String(data.duration) as 'forever' | 'once' | 'repeating' : null
        if (!duration) return 'licenseOfferDurationInvalid'
        const months = Number(data.months)
        if (duration === 'repeating' && !(months >= 1 && months <= 36)) return 'licenseOfferDurationInvalid'
        const max = data.maxRedemptions ? Math.round(Number(data.maxRedemptions)) : null
        // A day (YYYY-MM-DD): the offer runs until the end of that day (Paris), so today is a valid last day
        const day = String(data.redeemBy ?? '')
        const redeemBy = day ? Math.floor(new Date(/^\d{4}-\d{2}-\d{2}$/.test(day) ? `${day}T23:59:59+01:00` : day).getTime() / 1000) : null
        if (redeemBy !== null && (!Number.isFinite(redeemBy) || redeemBy * 1000 < Date.now())) return 'licenseOfferDateInvalid'
        const offers = product === 'all' ? await LicenseProducts.offers() : [product as LicenseOffer]
        const labelFr = String(data.labelFr ?? '').trim().slice(0, 80) || `-${percent} %`
        try {
            const ids = (await Promise.all(offers.map(productOf))).filter(Boolean).map(p => p!.id)
            if (!ids.length) return 'licenseNotForSale'
            await stripe().coupons.create({
                name: labelFr.slice(0, 40), percent_off: percent, duration, ...(duration === 'repeating' ? { duration_in_months: months } : {}),
                ...(max && max > 0 ? { max_redemptions: max } : {}), ...(redeemBy ? { redeem_by: redeemBy } : {}),
                applies_to: { products: ids },
                metadata: { dc_product: product, dc_label_fr: labelFr, dc_label_en: String(data.labelEn ?? '').trim().slice(0, 80) || `-${percent}%` },
            })
        } catch (error) {
            // Stripe refused (key, rights, product): a clear message in the form instead of a server error
            console.error('Stripe offer not created:', (error as Error).message)
            return 'licenseStripeFailed'
        }
        LicenseOffers.clear()
        return null
    },

    async deleteOffer(id: string) {
        const coupon = await stripe().coupons.retrieve(id).catch(() => null)
        if (!coupon || !coupon.metadata?.dc_product) return 'licenseOfferNotFound'
        await stripe().coupons.del(id)
        LicenseOffers.clear()
        return null
    },

    /** Prices of the admin: Stripe's, else the default ones of LicenseSchema.ts (euros). */
    async overview() {
        const prices = await LicenseOffers.prices()
        const products = await LicenseProducts.rows()
        // Default prices: the ones of the tool (dc_license_products), else the ones known to the code
        const defaults = (offer: string) => {
            const row = products.find(p => p.id === offer)
            return { month: row?.priceMonth ?? LICENSE_PRICES[offer]?.month ?? 0, year: row?.priceYear ?? LICENSE_PRICES[offer]?.year ?? 0 }
        }
        const rows = await Promise.all((await LicenseProducts.offers()).map(async offer => ({
            offer, name: await LicenseProducts.subscriptionName(offer),
            month: (prices[offer]?.month ?? defaults(offer).month) / 100,
            year: (prices[offer]?.year ?? defaults(offer).year) / 100,
        })))
        return { prices: rows, offers: await LicenseOffers.list() }
    },
}
