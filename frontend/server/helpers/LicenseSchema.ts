import { DatabaseHelper } from '../utils/DatabaseHelper'
/*
 * Tables of the licences of the DC tools (DC Scaffold, DC Prospect, DC Sentinel), sold on https://tools.djason-chery.dev/
 * (server/controllers/LicensesController.ts, server/helpers/LicenseHelper.ts). Added to the tables of DatabaseSchema.ts.
 * The key itself is never stored: only its SHA-256 (key_hash) and its last 5 letters to recognise it in the admin.
 */
export const LICENSE_TABLES = {
    // One key: bought on Stripe (source 'stripe', one per subscription) or offered by the owner from the admin (source 'gift').
    // products: tools it opens, comma separated (scaffold,prospect,sentinel). expires_at: end of the access (NULL: lifetime gift,
    // or a running subscription renewed by Stripe). machines: hashed ids of the computers that checked it (JSON array, last 20)
    dc_licenses: `
        id VARCHAR(64) PRIMARY KEY,
        key_hash CHAR(64) NOT NULL UNIQUE,
        key_end VARCHAR(5) NOT NULL,
        products VARCHAR(64) NOT NULL,
        email VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        language VARCHAR(8) DEFAULT 'fr',
        source VARCHAR(8) NOT NULL CHECK(source IN ('stripe', 'gift')),
        status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'revoked')),
        expires_at DATETIME NULL,
        note VARCHAR(500),
        stripe_customer VARCHAR(64),
        stripe_subscription VARCHAR(64) UNIQUE,
        billing_interval VARCHAR(8),
        machines TEXT,
        last_check_at DATETIME NULL,
        last_version VARCHAR(20),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_licenses_email (email)`,
    // Free 14-day trials already given: one per e-mail and per offer (a tool or the bundle), kept to refuse a second one
    dc_license_trials: `
        email VARCHAR(255) NOT NULL,
        product VARCHAR(16) NOT NULL,
        license_id VARCHAR(64),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (email, product)`,
    // Lowest version of each tool still allowed to run (raised from the admin: older versions show "Update required")
    dc_license_products: `
        product VARCHAR(16) PRIMARY KEY,
        min_version VARCHAR(20) NOT NULL DEFAULT '1.0.0'`,
}

export const LICENSE_PRODUCTS = ['scaffold', 'prospect', 'sentinel'] as const
export type LicenseProduct = typeof LICENSE_PRODUCTS[number]

// Prices of the Pro version, in euro cents (TVA non applicable, art. 293 B du CGI): created once in Stripe with these lookup keys
// (dc_<product>_<interval>) by scripts/stripe-licenses.mjs, read back by their lookup key (no price id in the .env files)
// What can be bought or tried: a tool, or the bundle « DC complet » (the three tools, one key)
export const LICENSE_OFFERS = [...LICENSE_PRODUCTS, 'bundle'] as const
export type LicenseOffer = typeof LICENSE_OFFERS[number]
export const isOffer = (value: unknown): value is LicenseOffer => LICENSE_OFFERS.includes(value as LicenseOffer)
/** Tools opened by an offer. */
export const productsOfOffer = (offer: LicenseOffer): LicenseProduct[] => offer === 'bundle' ? [...LICENSE_PRODUCTS] : [offer]

export const LICENSE_PRICES: Record<LicenseOffer, { month: number, year: number, name: string }> = {
    scaffold: { month: 900, year: 9000, name: 'DC Scaffold Pro' },
    prospect: { month: 1900, year: 19000, name: 'DC Prospect Pro' },
    sentinel: { month: 900, year: 9000, name: 'DC Sentinel Pro' },
    bundle: { month: 2900, year: 29000, name: 'DC complet Pro (Scaffold, Prospect, Sentinel)' },
}

export const LICENSE_SEEDS = {
    dc_license_products: async () => {
        for (const product of LICENSE_PRODUCTS)
            await DatabaseHelper.insert('INSERT INTO dc_license_products (product, min_version) VALUES (?, ?)', [product, '1.0.0'])
    },
}
