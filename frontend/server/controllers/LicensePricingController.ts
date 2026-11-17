import type { H3Event } from 'h3'
import type { RouteArgs } from '../utils/RouteDiscovery'
/*
 * Prices and offers of the DC tools, from admin > DC licences > Prices and offers (admin only), written in Stripe:
 *   GET    /api/licenses/pricing          { prices: [{ offer, name, month, year }] (euros), offers: [running offers] }
 *   PUT    /api/licenses/pricing          { offer, interval: month|year, amount (euros) }   new price for new customers
 *   POST   /api/licenses/offers           { product, percentOff, duration, months?, maxRedemptions?, redeemBy?, labelFr, labelEn }
 *   DELETE /api/licenses/offers/{id}      stop an offer
 * Rules and Stripe calls: server/helpers/LicensePricing.ts.
 */
export default class LicensePricingController extends Controller {
    static prefix = '/licenses'

    static routes = {
        pricing: ['GET', '/pricing'],
        setPrice: ['PUT', '/pricing'],
        createOffer: ['POST', '/offers'],
        deleteOffer: ['DELETE', '/offers/{id}'],
    }

    async pricing(event: H3Event) {
        return ResponseHelper.success(event, await LicensePricing.overview())
    }

    async setPrice(event: H3Event) {
        const body = (await this.body(event)) || {}
        const error = await LicensePricing.setPrice(body.offer, body.interval, Number(body.amount) * 100)
        if (error) return ResponseHelper.validationError(event, error)
        return ResponseHelper.success(event, await LicensePricing.overview())
    }

    async createOffer(event: H3Event) {
        const body = (await this.body(event)) || {}
        const error = await LicensePricing.createOffer({ ...body, product: body.product, percentOff: body.percentOff, duration: body.duration })
        if (error) return ResponseHelper.validationError(event, error)
        return ResponseHelper.success(event, await LicensePricing.overview())
    }

    async deleteOffer(event: H3Event, args: RouteArgs) {
        const error = await LicensePricing.deleteOffer(String(args.id))
        if (error) return ResponseHelper.validationError(event, error)
        return ResponseHelper.success(event, await LicensePricing.overview())
    }
}
