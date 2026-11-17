import type { H3Event } from 'h3'
import { isOffer, productsOfOffer } from '../helpers/LicenseSchema'
/*
 * Requests sent from the DC tools and their sales site (public, rate limited):
 *   POST /api/licenses/trial    { email, product: scaffold|prospect|sentinel|bundle, lang }  a 14-day Pro key e-mailed, one per e-mail and offer
 *   POST /api/licenses/support  { product, version, os, email, message, lang }             a help request forwarded to the owner
 *   GET  /api/licenses/sales    who can buy and at what price, read by the sales site: { proOnly, mediator: { name, url, address } | null,
 *                               prices: { <offer>: { month, year } } (cents), offers: [running Stripe offers, LicenseOffers.ts] }
 *                               (professionals only while no consumer mediator is set in admin > Settings)
 * Keys themselves: LicensesController.ts / LicenseHelper.ts.
 */
const TRIAL_DAYS = 14
const TRIAL_LIMIT = { max: 5, windowSeconds: 24 * 60 * 60, lockSeconds: 24 * 60 * 60 }
const SUPPORT_LIMIT = { max: 5, windowSeconds: 60 * 60, lockSeconds: 60 * 60 }
const NAMES: Record<string, string> = { scaffold: 'DC Scaffold', prospect: 'DC Prospect', sentinel: 'DC Sentinel', bundle: 'DC complet' }
const isEmail = (value: unknown) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '')) && String(value).length <= 255
const short = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max)

export default class LicenseRequestsController extends Controller {
    static prefix = '/licenses'
    static publicActions = true

    static routes = {
        trial: ['POST', '/trial'],
        support: ['POST', '/support'],
        sales: ['GET', '/sales'],
    }

    async trial(event: H3Event) {
        const body = (await this.body(event)) || {}
        const email = String(body.email || '').trim().toLowerCase()
        const offer = body.product
        const language = body.lang === 'en' ? 'en' : 'fr'
        if (!isEmail(email)) return ResponseHelper.validationError(event, 'invalidEmail')
        if (!isOffer(offer)) return ResponseHelper.validationError(event, 'licenseUnknownProduct')
        // A few trials a day per address and per IP, whatever the answer
        const keys = [`trial-ip:${RequestHelper.ip(event)}`, `trial-email:${email}`]
        const limit = await RateLimitHelper.check(keys)
        if (limit.locked) return ResponseHelper.tooManyRequests(event, 'tooManyAttempts', limit.retryAfter)
        await RateLimitHelper.fail(keys, TRIAL_LIMIT)
        // One trial per e-mail and per offer, ever
        if (await this.fetchOne('SELECT 1 AS found FROM dc_license_trials WHERE email = ? AND product = ?', [email, offer]))
            return ResponseHelper.error(event, 'trialAlreadyUsed', 409)

        const products = productsOfOffer(offer)
        const expiresAt = new Date(Date.now() + TRIAL_DAYS * 86400 * 1000)
        const { id, key } = await LicenseHelper.create({ email, language, products, source: 'gift', expiresAt, note: `Essai ${TRIAL_DAYS} jours (${NAMES[offer]})` })
        await this.insert('INSERT INTO dc_license_trials (email, product, license_id) VALUES (?, ?, ?)', [email, offer, id])
        const sent = await LicenseMails.sendKey({ key, email, language, products, bought: false, trial: true, expiresAt })
        return ResponseHelper.success(event, { sent })
    }

    async support(event: H3Event) {
        const body = (await this.body(event)) || {}
        const email = String(body.email || '').trim()
        const message = short(body.message, 4000)
        if (!isEmail(email)) return ResponseHelper.validationError(event, 'invalidEmail')
        if (message.length < 10) return ResponseHelper.validationError(event, 'supportMessageTooShort')
        const keys = [`support-ip:${RequestHelper.ip(event)}`, `support-email:${email.toLowerCase()}`]
        const limit = await RateLimitHelper.check(keys)
        if (limit.locked) return ResponseHelper.tooManyRequests(event, 'tooManyAttempts', limit.retryAfter)
        await RateLimitHelper.fail(keys, SUPPORT_LIMIT)
        const sent = await LicenseMails.sendSupport({
            tool: NAMES[String(body.product)] || 'DC', version: short(body.version, 20) || '?', os: short(body.os, 40) || '?',
            email, message, language: body.lang === 'en' ? 'en' : 'fr',
        })
        return sent ? ResponseHelper.success(event, { sent: true }) : ResponseHelper.error(event, 'supportNotSent', 502)
    }

    async sales(event: H3Event) {
        const settings = await SettingsHelper.all()
        const name = String(settings.mediatorName || '').trim()
        setResponseHeader(event, 'Cache-Control', 'public, max-age=300')
        const [prices, offers] = await Promise.all([LicenseOffers.prices(), LicenseOffers.list()])
        return ResponseHelper.success(event, {
            proOnly: !name,
            mediator: name ? { name, url: String(settings.mediatorUrl || ''), address: String(settings.mediatorAddress || '') } : null,
            prices, offers,
        })
    }
}
