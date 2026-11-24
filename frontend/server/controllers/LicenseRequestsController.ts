import type { H3Event } from 'h3'
import { LicenseProducts } from '../helpers/LicenseProducts'
/*
 * Requests sent from the DC tools and their sales site (public, rate limited):
 *   POST /api/licenses/trial    { email, product: scaffold|prospect|sentinel|audit|bundle, lang }  a 14-day Pro key e-mailed, one per person
 *                               and offer (address compared without +tag nor Gmail dots, EmailRules.ts; throwaway inboxes refused).
 *                               Always { sent: true }: the e-mail itself says when the person already had this trial (no way to
 *                               learn from the answer who already tried). One trial per computer too: LicenseHelper.verify
 *   POST /api/licenses/support  { product, version, os, email, message, lang }             a help request forwarded to the owner; the
 *                               visitor gets a fixed acknowledgement (never his message: no relay of any text), 50 a day at most
 *   GET  /api/licenses/sales    who can buy and at what price, read by the sales site: { proOnly, mediator: { name, url, address } | null,
 *                               prices: { <offer>: { month, year } } (cents), offers: [running Stripe offers, LicenseOffers.ts] }
 *                               (professionals only while no consumer mediator is set in admin > Settings)
 * Keys themselves: LicensesController.ts / LicenseHelper.ts.
 */
const TRIAL_DAYS = 14
const TRIAL_LIMIT = { max: 5, windowSeconds: 24 * 60 * 60, lockSeconds: 24 * 60 * 60 }
const SUPPORT_LIMIT = { max: 5, windowSeconds: 60 * 60, lockSeconds: 60 * 60 }
// Name of a tool or of the bundle (the registered tools, LicenseProducts.ts)
const nameOf = async (id: string) => id === 'bundle' ? 'DC complet' : (await LicenseProducts.names())[id] ?? 'DC'
// Acknowledgements of help requests, for the whole site: a flood of requests can't turn the site into a mail sender
const ACK_LIMIT = { max: 50, windowSeconds: 24 * 60 * 60, lockSeconds: 24 * 60 * 60 }
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
        if (!EmailRules.isValid(email) || EmailRules.isDisposable(email)) return ResponseHelper.validationError(event, 'invalidEmail')
        if (!(await LicenseProducts.isOffer(offer))) return ResponseHelper.validationError(event, 'licenseUnknownProduct')
        // The person behind the address: jean.dupont+x@gmail.com is jeandupont@gmail.com
        const identity = EmailRules.identity(email)
        // A few trials a day per address and per IP, whatever the answer
        const keys = [`trial-ip:${RequestHelper.ip(event)}`, `trial-email:${identity}`]
        const limit = await RateLimitHelper.check(keys)
        if (limit.locked) return ResponseHelper.tooManyRequests(event, 'tooManyAttempts', limit.retryAfter)
        await RateLimitHelper.fail(keys, TRIAL_LIMIT)

        // One trial per person and per offer, ever (rows of before kept the address as typed): the place is taken first,
        // so two requests at the same time never give two keys
        const used = await this.fetchOne('SELECT 1 AS found FROM dc_license_trials WHERE product = ? AND email IN (?, ?)', [offer, identity, email])
        const taken = !used && await this.execute('INSERT IGNORE INTO dc_license_trials (email, product) VALUES (?, ?)', [identity, offer])
        if (!taken) {
            await LicenseMails.sendTrialUsed({ email, language, tool: await nameOf(offer) })
            return ResponseHelper.success(event, { sent: true })
        }
        const products = await LicenseProducts.productsOfOffer(offer)
        const expiresAt = new Date(Date.now() + TRIAL_DAYS * 86400 * 1000)
        const { id, key } = await LicenseHelper.create({ email, language, products, source: 'gift', expiresAt, note: `Essai ${TRIAL_DAYS} jours (${await nameOf(offer)})` })
        await this.execute('UPDATE dc_license_trials SET license_id = ? WHERE email = ? AND product = ?', [id, identity, offer])
        await LicenseMails.sendKey({ key, email, language, products, bought: false, trial: true, expiresAt })
        return ResponseHelper.success(event, { sent: true })
    }

    async support(event: H3Event) {
        const body = (await this.body(event)) || {}
        const email = String(body.email || '').trim()
        const message = short(body.message, 4000)
        if (!EmailRules.isValid(email)) return ResponseHelper.validationError(event, 'invalidEmail')
        if (message.length < 10) return ResponseHelper.validationError(event, 'supportMessageTooShort')
        const keys = [`support-ip:${RequestHelper.ip(event)}`, `support-email:${email.toLowerCase()}`]
        const limit = await RateLimitHelper.check(keys)
        if (limit.locked) return ResponseHelper.tooManyRequests(event, 'tooManyAttempts', limit.retryAfter)
        await RateLimitHelper.fail(keys, SUPPORT_LIMIT)
        // Past 50 acknowledgements today, the requests still reach the owner, without an acknowledgement
        const acknowledge = !(await RateLimitHelper.check(['support-ack-day'])).locked
        if (acknowledge) await RateLimitHelper.fail(['support-ack-day'], ACK_LIMIT)
        const sent = await LicenseMails.sendSupport({
            tool: await nameOf(String(body.product)), version: short(body.version, 20) || '?', os: short(body.os, 40) || '?',
            email, message, language: body.lang === 'en' ? 'en' : 'fr', acknowledge,
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
