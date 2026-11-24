import { createHash, randomBytes } from 'node:crypto'
import { DatabaseHelper } from '../utils/DatabaseHelper'

/*
 * Stripe space of a bought DC tools key (card, invoices, cancel), never opened from the key alone (POST /api/licenses/portal,
 * LicensesController.ts): the key only sends a one-time link to the e-mail address of the purchase.
 *   LicensePortal.sendLink(key, lang)   a link /licenses/manage/?lang=&portal=<token> e-mailed, when the key has a Stripe customer
 *                                       (nothing said otherwise: the answer is the same for every key)
 *   LicensePortal.open(token, lang)     address of the Stripe portal, once (null: unknown, used or older than 30 minutes)
 * Token: 32 random bytes (hex), only its SHA-256 stored (table dc_license_portal_links, LicenseSchema.ts).
 * The link opens the page, which asks for the portal with a click (POST): a mail scanner following the link uses nothing.
 */
const VALID_MS = 30 * 60 * 1000
// Links of one key: 3 an hour, so a stranger who knows a key can't fill the inbox of its owner
const LINK_LIMIT = { max: 3, windowSeconds: 60 * 60, lockSeconds: 60 * 60 }

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export const LicensePortal = {
    async sendLink(key: unknown, lang: 'fr' | 'en') {
        const license = await LicenseHelper.byKey(key)
        if (!license?.stripe_customer) return
        const keys = [`license-portal:${license.id}`]
        if ((await RateLimitHelper.check(keys)).locked) return
        await RateLimitHelper.fail(keys, LINK_LIMIT)

        const now = new Date().toISOString()
        await DatabaseHelper.execute('DELETE FROM dc_license_portal_links WHERE expires_at < ?', [now])
        const token = randomBytes(32).toString('hex')
        await DatabaseHelper.execute('INSERT INTO dc_license_portal_links (token_hash, license_id, language, expires_at) VALUES (?, ?, ?, ?)',
            [hashToken(token), license.id, lang, new Date(Date.now() + VALID_MS).toISOString()])
        const url = `${useRuntimeConfig().public.frontendDomain}/licenses/manage/?lang=${lang}&portal=${token}`
        await LicenseMails.sendPortalLink({ email: license.email, language: lang, url })
    },

    async open(token: unknown, lang: 'fr' | 'en') {
        if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null
        const hash = hashToken(token)
        const link = await DatabaseHelper.fetchOne('SELECT license_id, expires_at FROM dc_license_portal_links WHERE token_hash = ?', [hash])
        // Used once: the row that two clicks at the same time both read is removed by only one of them
        if (!link || !(await DatabaseHelper.execute('DELETE FROM dc_license_portal_links WHERE token_hash = ?', [hash]))) return null
        if (Date.parse(link.expires_at) < Date.now()) return null
        const license = await DatabaseHelper.fetchOne('SELECT stripe_customer FROM dc_licenses WHERE id = ?', [link.license_id])
        return license?.stripe_customer ? LicenseStripe.portal(license.stripe_customer, lang) : null
    },
}
