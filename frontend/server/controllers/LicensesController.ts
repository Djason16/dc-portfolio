import type { H3Event } from 'h3'
import type { RouteArgs } from '../utils/RouteDiscovery'
import { isOffer } from '../helpers/LicenseSchema'
/*
 * Licences of the DC tools (DC Scaffold, DC Prospect, DC Sentinel), sold on https://tools.djason-chery.dev/.
 * Public (called by the tools and the sales site):
 *   POST /api/licenses/verify        { key, product, machine, version }  -> { valid, product, status, expiresAt, minVersion, checkedAt }
 *   GET  /api/licenses/min-version?product=...                           -> { product, minVersion }
 *   GET  /api/licenses/checkout?product=...&interval=month|year&lang=fr|en   303 to the Stripe page of a Pro subscription
 *   POST /api/licenses/status   { key }    -> { license: { keyEnd, products, status, expiresAt, kind, interval, canManage, renewsAt, cancelled } }
 *   POST /api/licenses/portal   { key, lang }                            -> { url } of the Stripe customer portal of a bought key
 *   Pages: /licenses/manage/?lang= (key -> state, Stripe portal) and /licenses/thanks/?lang=&product= (after the payment),
 *   pages/licenses/. Old addresses kept as permanent redirects (the tools and old e-mails open them):
 *   GET /api/licenses/manage, POST /api/licenses/manage (old form), GET /api/licenses/thanks
 * Admin (page Licences): GET / POST /api/licenses, PUT /api/licenses/{id}, POST /api/licenses/{id}/renew (new key e-mailed),
 *   GET / PUT /api/licenses/versions (lowest version of each tool still allowed).
 * Stripe events: StripeController.webhook -> LicenseStripe.handle.
 */
const VERIFY_LIMIT = { max: 60, windowSeconds: 60 * 60, lockSeconds: 15 * 60 }
const MANAGE_LIMIT = { max: 10, windowSeconds: 60 * 60, lockSeconds: 30 * 60 }
const isEmail = (value: unknown) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '')) && String(value).length <= 255
const langOf = (value: unknown): 'fr' | 'en' => value === 'en' ? 'en' : 'fr'
// Durations of an offered key (admin): months, or 0 for no end
const GIFT_MONTHS = [1, 3, 12, 0]

// New page of an old address, with its language (and tool), relative to the site: /licenses/manage/?lang=en
const pageUrl = (page: 'manage' | 'thanks', event: H3Event) => {
    const params = new URLSearchParams({ lang: langOf(RequestHelper.query(event, 'lang')) })
    const product = String(RequestHelper.query(event, 'product') ?? '')
    if (page === 'thanks' && isOffer(product)) params.set('product', product)
    return `/licenses/${page}/?${params}`
}

export default class LicensesController extends Controller {
    static publicActions = ['verify', 'minVersion', 'checkout', 'thanks', 'manage', 'oldManageForm', 'status', 'portal']

    static routes = {
        verify: ['POST', '/verify'],
        minVersion: ['GET', '/min-version'],
        checkout: ['GET', '/checkout'],
        thanks: ['GET', '/thanks'],
        manage: ['GET', '/manage'],
        oldManageForm: ['POST', '/manage'],
        status: ['POST', '/status'],
        portal: ['POST', '/portal'],
        versions: ['GET', '/versions'],
        setVersion: ['PUT', '/versions'],
        renew: ['POST', '/{id}/renew'],
    }

    async verify(event: H3Event) {
        // Every check counts (a tool checks once a day): a script trying keys is stopped quickly
        const keys = [`license-ip:${RequestHelper.ip(event)}`]
        const limit = await RateLimitHelper.check(keys)
        if (limit.locked) return ResponseHelper.tooManyRequests(event, 'tooManyAttempts', limit.retryAfter)
        await RateLimitHelper.fail(keys, VERIFY_LIMIT)
        const body = (await this.body(event)) || {}
        const answer = await LicenseHelper.verify({ key: body.key, product: body.product, machine: body.machine, version: body.version })
        return answer ? ResponseHelper.success(event, answer) : ResponseHelper.validationError(event, 'licenseUnknownProduct')
    }

    async minVersion(event: H3Event) {
        const product = RequestHelper.query(event, 'product')
        if (!LicenseHelper.isProduct(product)) return ResponseHelper.validationError(event, 'licenseUnknownProduct')
        return ResponseHelper.success(event, { product, minVersion: await LicenseHelper.minVersion(product) })
    }

    async checkout(event: H3Event) {
        const product = RequestHelper.query(event, 'product')
        const interval = RequestHelper.query(event, 'interval') === 'year' ? 'year' : 'month'
        if (!isOffer(product)) return ResponseHelper.validationError(event, 'licenseUnknownProduct')
        const url = await LicenseStripe.checkout(product, interval, langOf(RequestHelper.query(event, 'lang')))
        if (!url) return ResponseHelper.error(event, 'licenseNotForSale', 503)
        return sendRedirect(event, url, 303)
    }

    // Old addresses: the pages of the site now (301: the tools and old e-mails keep them for good)
    thanks(event: H3Event) {
        return sendRedirect(event, pageUrl('thanks', event), 301)
    }

    manage(event: H3Event) {
        return sendRedirect(event, pageUrl('manage', event), 301)
    }

    // The form of the old page, still open somewhere: to the new page (303: a GET)
    oldManageForm(event: H3Event) {
        return sendRedirect(event, pageUrl('manage', event), 303)
    }

    /** State of a key for its owner. Each unknown key counts: a script trying keys is stopped quickly. */
    async status(event: H3Event) {
        const keys = [`license-manage:${RequestHelper.ip(event)}`]
        const limit = await RateLimitHelper.check(keys)
        if (limit.locked) return ResponseHelper.tooManyRequests(event, 'tooManyAttempts', limit.retryAfter)
        const license = await LicenseHelper.statusOf(((await this.body(event)) || {}).key)
        if (!license) {
            await RateLimitHelper.fail(keys, MANAGE_LIMIT)
            return ResponseHelper.notFound(event, 'licenseKeyUnknown')
        }
        // A subscription: its real next renewal (the end of access kept in the table has a few days of grace)
        const { subscription, ...shown } = license
        const renewal = subscription ? await LicenseStripe.renewal(subscription) : null
        return ResponseHelper.success(event, { license: { ...shown, renewsAt: renewal?.renewsAt ?? null, cancelled: renewal?.cancelled ?? false } })
    }

    /** Address of the Stripe customer portal of a bought key (card, invoices, cancel). */
    async portal(event: H3Event) {
        const body = (await this.body(event)) || {}
        const keys = [`license-manage:${RequestHelper.ip(event)}`]
        const limit = await RateLimitHelper.check(keys)
        if (limit.locked) return ResponseHelper.tooManyRequests(event, 'tooManyAttempts', limit.retryAfter)
        const url = await LicenseStripe.portal(body.key, langOf(body.lang))
        if (!url) {
            await RateLimitHelper.fail(keys, MANAGE_LIMIT)
            return ResponseHelper.notFound(event, 'licenseNoSubscription')
        }
        return ResponseHelper.success(event, { url })
    }

    // ---- Admin
    async getAll(event: H3Event) {
        return ResponseHelper.success(event, { licenses: await LicenseHelper.list() })
    }

    /** Offered key: { email, name?, language, products: [...], months: 1|3|12|0, note? } -> e-mailed at once. */
    async create(event: H3Event) {
        const body = (await this.body(event)) || {}
        const products = Array.isArray(body.products) ? [...new Set(body.products.filter(LicenseHelper.isProduct))] : []
        const months = Number(body.months)
        if (!isEmail(body.email)) return ResponseHelper.validationError(event, 'invalidEmail')
        if (!products.length) return ResponseHelper.validationError(event, 'licenseProductsRequired')
        if (!GIFT_MONTHS.includes(months)) return ResponseHelper.validationError(event, 'licenseDurationRequired')
        const expiresAt = months ? new Date(new Date().setMonth(new Date().getMonth() + months)) : null
        const language = langOf(body.language)
        const { id, key } = await LicenseHelper.create({
            email: String(body.email), name: String(body.name ?? ''), language, products, source: 'gift', expiresAt, note: String(body.note ?? ''),
        })
        const emailSent = await LicenseMails.sendKey({ key, email: String(body.email), language, products, bought: false, expiresAt })
        // The key is shown once in the admin too (to give it another way if the e-mail does not arrive)
        return ResponseHelper.success(event, { license: await LicenseHelper.get(id), key, emailSent })
    }

    async update(event: H3Event, args: RouteArgs) {
        if (!(await LicenseHelper.get(args.id))) return ResponseHelper.notFound(event, 'licenseNotFound')
        const error = await LicenseHelper.update(args.id, (await this.body(event)) || {})
        if (error) return ResponseHelper.validationError(event, error)
        return ResponseHelper.success(event, { license: await LicenseHelper.get(args.id) })
    }

    async renew(event: H3Event, args: RouteArgs) {
        const license = await LicenseHelper.get(args.id)
        if (!license) return ResponseHelper.notFound(event, 'licenseNotFound')
        const key = await LicenseHelper.renew(args.id)
        if (!key) return ResponseHelper.notFound(event, 'licenseNotFound')
        const emailSent = await LicenseMails.sendKey({ key, email: license.email, language: license.language, products: license.products,
            bought: license.source === 'stripe', expiresAt: license.source === 'gift' ? license.expiresAt : null })
        return ResponseHelper.success(event, { license: await LicenseHelper.get(args.id), key, emailSent })
    }

    async versions(event: H3Event) {
        return ResponseHelper.success(event, { versions: await LicenseHelper.minVersions() })
    }

    async setVersion(event: H3Event) {
        const body = (await this.body(event)) || {}
        const error = await LicenseHelper.setMinVersion(body.product, body.version)
        if (error) return ResponseHelper.validationError(event, error)
        return ResponseHelper.success(event, { versions: await LicenseHelper.minVersions() })
    }
}
