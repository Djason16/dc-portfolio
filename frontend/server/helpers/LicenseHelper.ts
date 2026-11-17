import { createHash, randomBytes } from 'node:crypto'
import { DatabaseHelper } from '../utils/DatabaseHelper'
import { LICENSE_PRODUCTS, type LicenseProduct } from './LicenseSchema'

/*
 * Licence keys of the DC tools (tables in LicenseSchema.ts, routes in server/controllers/LicensesController.ts):
 *   LicenseHelper.create({ email, products, ... })      a new key (returned once, in clear: e-mailed, never stored)
 *   LicenseHelper.verify({ key, product, machine, version })   the answer the tools cache (contract shared with the tools)
 *   LicenseHelper.list() / update(id, changes) / renew(id)     admin
 *   LicenseHelper.minVersion(product) / setMinVersion(product, version)
 * Key: DC- + 4 groups of 5 Crockford base32 letters (no I, L, O, U): 100 random bits.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/
const MACHINE = /^[a-f0-9]{64}$/

export type LicenseStatus = 'active' | 'expired' | 'revoked' | 'unknown' | 'wrong_product'
export type NewLicense = {
    email: string, name?: string, language?: string, products: LicenseProduct[], source: 'stripe' | 'gift',
    expiresAt?: Date | null, note?: string, stripeCustomer?: string | null, stripeSubscription?: string | null, billingInterval?: string | null,
}

const hashKey = (key: string) => createHash('sha256').update(key).digest('hex')

const newKey = () => {
    const bytes = randomBytes(20)
    const letters = [...bytes].map(byte => ALPHABET[byte % 32]).join('')
    return `DC-${letters.match(/.{5}/g)!.join('-')}`
}

/** Key typed by someone: trimmed, upper case, dashes optional, O read as 0 and I / L as 1 (Crockford); null when not a key. */
const normalize = (input: unknown) => {
    const raw = String(input ?? '').toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1')
    const body = raw.length === 22 && raw.startsWith('DC') ? raw.slice(2) : raw
    if (!/^[0-9A-HJKMNP-TV-Z]{20}$/.test(body)) return null
    return `DC-${body.match(/.{5}/g)!.join('-')}`
}

const isProduct = (value: unknown): value is LicenseProduct => LICENSE_PRODUCTS.includes(value as LicenseProduct)
const productsOf = (value: string) => value.split(',').filter(isProduct)

// Semver order of two x.y.z versions (-1, 0, 1)
const compareVersions = (a: string, b: string) => {
    const pa = a.split('.').map(Number), pb = b.split('.').map(Number)
    for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) < (pb[i] ?? 0) ? -1 : 1
    return 0
}

const minVersion = async (product: LicenseProduct) =>
    (await DatabaseHelper.fetchOne('SELECT min_version FROM dc_license_products WHERE product = ?', [product]))?.min_version || '1.0.0'

// Row of the admin list (never the key: only its end)
const shown = (row: Record<string, any>) => ({
    id: row.id, keyEnd: row.key_end, products: productsOf(row.products), email: row.email, name: row.name || '', language: row.language,
    source: row.source, status: row.status, expiresAt: row.expires_at,
    // Kind shown in the admin: bought, offered by the owner, or a free 14-day trial (offered keys whose note starts with « Essai »)
    kind: row.source === 'stripe' ? 'paid' : String(row.note || '').startsWith('Essai') ? 'trial' : 'gift', note: row.note || '', interval: row.billing_interval || '',
    machines: (() => { try { return JSON.parse(row.machines || '[]').length } catch { return 0 } })(),
    lastCheckAt: row.last_check_at, lastVersion: row.last_version || '', createdAt: row.created_at,
    expired: Boolean(row.expires_at && new Date(row.expires_at).getTime() < Date.now()),
})

export const LicenseHelper = {
    normalize,
    isProduct,
    compareVersions,
    minVersion,

    /** Creates a key; returns it in clear (the only time) with its row id. */
    async create(data: NewLicense) {
        const key = newKey()
        const id = DatabaseHelper.newId()
        await DatabaseHelper.insert(`INSERT INTO dc_licenses (id, key_hash, key_end, products, email, name, language, source, expires_at, note,
            stripe_customer, stripe_subscription, billing_interval) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, hashKey(key), key.slice(-5), data.products.join(','), data.email.trim().toLowerCase(), data.name?.trim() || null,
                data.language === 'en' ? 'en' : 'fr', data.source, data.expiresAt ?? null, data.note?.trim().slice(0, 500) || null,
                data.stripeCustomer ?? null, data.stripeSubscription ?? null, data.billingInterval ?? null])
        return { id, key }
    },

    /** The answer given to a tool for its key (contract of the tools: valid, product, status, expiresAt, minVersion, checkedAt). */
    async verify({ key, product, machine, version }: { key: unknown, product: unknown, machine: unknown, version: unknown }) {
        if (!isProduct(product)) return null
        const answer = (valid: boolean, status: LicenseStatus, expiresAt: Date | null = null) => ({
            valid, product, status, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null, checkedAt: new Date().toISOString(),
        })
        const normal = normalize(key)
        const row = normal ? await DatabaseHelper.fetchOne('SELECT * FROM dc_licenses WHERE key_hash = ?', [hashKey(normal)]) : null
        const min = await minVersion(product)
        if (!row) return { ...answer(false, 'unknown'), minVersion: min }

        // Seen: last check, version, and the hashed machine (the last 20 kept)
        let machines: string[] = []
        try { machines = JSON.parse(row.machines || '[]') } catch { machines = [] }
        if (typeof machine === 'string' && MACHINE.test(machine)) machines = [machine, ...machines.filter(m => m !== machine)].slice(0, 20)
        await DatabaseHelper.execute('UPDATE dc_licenses SET machines = ?, last_check_at = UTC_TIMESTAMP(), last_version = ? WHERE id = ?',
            [JSON.stringify(machines), typeof version === 'string' && VERSION.test(version) ? version : row.last_version, row.id])

        if (row.status === 'revoked') return { ...answer(false, 'revoked', row.expires_at), minVersion: min }
        if (!productsOf(row.products).includes(product)) return { ...answer(false, 'wrong_product', row.expires_at), minVersion: min }
        if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return { ...answer(false, 'expired', row.expires_at), minVersion: min }
        return { ...answer(true, 'active', row.expires_at), minVersion: min }
    },

    /** Every key, newest first (admin). */
    async list() {
        const rows = await DatabaseHelper.fetchAll('SELECT * FROM dc_licenses ORDER BY created_at DESC')
        return rows.map(shown)
    },

    async get(id: string) {
        const row = await DatabaseHelper.fetchOne('SELECT * FROM dc_licenses WHERE id = ?', [id])
        return row ? shown(row) : null
    },

    /** Admin changes: products, end of access, status (revoke / reactivate), note, name. */
    async update(id: string, changes: { products?: unknown, expiresAt?: unknown, status?: unknown, note?: unknown, name?: unknown }) {
        const sets: string[] = [], values: unknown[] = []
        if (Array.isArray(changes.products)) {
            const products = changes.products.filter(isProduct)
            if (!products.length) return 'licenseProductsRequired'
            sets.push('products = ?'); values.push([...new Set(products)].join(','))
        }
        if (changes.expiresAt !== undefined) {
            const date = changes.expiresAt ? new Date(String(changes.expiresAt)) : null
            if (date && Number.isNaN(date.getTime())) return 'invalidDate'
            sets.push('expires_at = ?'); values.push(date)
        }
        if (changes.status !== undefined) {
            if (!['active', 'revoked'].includes(String(changes.status))) return 'invalidStatus'
            sets.push('status = ?'); values.push(String(changes.status))
        }
        if (changes.note !== undefined) { sets.push('note = ?'); values.push(String(changes.note ?? '').trim().slice(0, 500) || null) }
        if (changes.name !== undefined) { sets.push('name = ?'); values.push(String(changes.name ?? '').trim().slice(0, 255) || null) }
        if (!sets.length) return null
        await DatabaseHelper.execute(`UPDATE dc_licenses SET ${sets.join(', ')} WHERE id = ?`, [...values, id])
        return null
    },

    /** A new key for the same licence (lost key, or a key to send again): the old one stops working at once. */
    async renew(id: string) {
        const key = newKey()
        const changed = await DatabaseHelper.execute('UPDATE dc_licenses SET key_hash = ?, key_end = ? WHERE id = ?', [hashKey(key), key.slice(-5), id])
        return changed ? key : null
    },

    /** Licence of a Stripe subscription (one per subscription). */
    async bySubscription(subscription: string) {
        return DatabaseHelper.fetchOne('SELECT * FROM dc_licenses WHERE stripe_subscription = ?', [subscription])
    },

    /** Stripe customer of a key (to open its portal), null when unknown or offered. */
    async customerOf(key: unknown) {
        const normal = normalize(key)
        if (!normal) return null
        return (await DatabaseHelper.fetchOne('SELECT stripe_customer FROM dc_licenses WHERE key_hash = ?', [hashKey(normal)]))?.stripe_customer || null
    },

    /** What the owner of a key sees on /licenses/manage/ (never the e-mail): tools, state, end of access, kind; null when unknown. */
    async statusOf(key: unknown) {
        const normal = normalize(key)
        const row = normal ? await DatabaseHelper.fetchOne('SELECT * FROM dc_licenses WHERE key_hash = ?', [hashKey(normal)]) : null
        if (!row) return null
        const { keyEnd, products, expiresAt, kind, interval, expired } = shown(row)
        const status = row.status === 'revoked' ? 'revoked' : expired ? 'expired' : 'active'
        return { keyEnd, products, status, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null, kind, interval,
            canManage: Boolean(row.stripe_customer), subscription: (row.stripe_subscription as string | null) || null }
    },

    async setMinVersion(product: unknown, version: unknown) {
        if (!isProduct(product) || typeof version !== 'string' || !VERSION.test(version)) return 'invalidVersion'
        await DatabaseHelper.execute('INSERT INTO dc_license_products (product, min_version) VALUES (?, ?) ON DUPLICATE KEY UPDATE min_version = VALUES(min_version)', [product, version])
        return null
    },

    async minVersions() {
        const rows = await DatabaseHelper.fetchAll('SELECT product, min_version FROM dc_license_products')
        return Object.fromEntries(LICENSE_PRODUCTS.map(product => [product, rows.find((r: Record<string, any>) => r.product === product)?.min_version || '1.0.0']))
    },
}
