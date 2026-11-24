import { DatabaseHelper } from '../utils/DatabaseHelper'
/*
 * Tables of the licences of the DC tools (DC Scaffold, DC Prospect, DC Sentinel, DC Audit), sold on https://tools.djason-chery.dev/
 * (server/controllers/LicensesController.ts, server/helpers/LicenseHelper.ts). Added to the tables of DatabaseSchema.ts.
 * The key itself is never stored: only its SHA-256 (key_hash) and its last 5 letters to recognise it in the admin.
 */
export const LICENSE_TABLES = {
    // One key: bought on Stripe (source 'stripe', one per subscription) or offered by the owner from the admin (source 'gift').
    // products: tools it opens, comma separated (scaffold,prospect,sentinel,audit). expires_at: end of the access (NULL: lifetime gift,
    // or a running subscription renewed by Stripe). machines: hashed ids of the computers that checked it (JSON array, last 20)
    dc_licenses: `
        id VARCHAR(64) PRIMARY KEY,
        key_hash CHAR(64) NOT NULL UNIQUE,
        key_end VARCHAR(5) NOT NULL,
        products VARCHAR(255) NOT NULL,
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
    // One-time links to the Stripe space of a bought key (LicensePortal.ts), e-mailed to the address of the purchase: only the
    // SHA-256 of the token is kept, valid 30 minutes (ISO text), removed once used
    dc_license_portal_links: `
        token_hash CHAR(64) PRIMARY KEY,
        license_id VARCHAR(64) NOT NULL,
        language VARCHAR(8) DEFAULT 'fr',
        expires_at VARCHAR(32) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP`,
    // The tools that can be licensed (LicenseProducts.ts, the source of truth; a released tool is added by the sync of the
    // tools catalog, ToolsSyncHelper.ts): name, order, default prices in cents, and the lowest version still allowed to run
    // (raised from the admin: older versions show "Update required")
    dc_license_products: `
        product VARCHAR(24) PRIMARY KEY,
        min_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
        name VARCHAR(40) NULL,
        sort_order INT NOT NULL DEFAULT 0,
        price_month INT NULL,
        price_year INT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP`,
}

// The tools known to this code: the first rows of dc_license_products, and the list used if the table cannot be read
// (LicenseProducts.ts). A tool released later is added by the sync of the catalog: nothing to change here
export const LICENSE_PRODUCTS = ['scaffold', 'prospect', 'sentinel', 'audit'] as const
// An id of tool: scaffold, prospect... (or a tool registered since, LicenseProducts.ts)
export type LicenseProduct = string
// What can be bought or tried: a tool, or the bundle « DC complet » (every registered tool, one key)
export type LicenseOffer = string

// The bundle « DC complet » before DC Audit (keys bought or offered with these three tools): DC Audit joined the bundle at its
// release, so such a key opens it too (LicenseHelper reads it as every tool, nothing to change in the table)
export const LEGACY_BUNDLE: readonly string[] = ['scaffold', 'prospect', 'sentinel']

// Default prices of the Pro version, in euro cents (TVA non applicable, art. 293 B du CGI), of the tools known to this code
// and of the bundle: created in Stripe with the lookup keys dc_<offer>_<interval> (scripts/stripe-licenses.mjs, then the sync of
// the catalog for a new tool), read back by their lookup key (no price id in the .env files)
export const LICENSE_PRICES: Record<string, { month: number, year: number, name: string }> = {
    scaffold: { month: 900, year: 9000, name: 'DC Scaffold Pro' },
    prospect: { month: 1900, year: 19000, name: 'DC Prospect Pro' },
    sentinel: { month: 900, year: 9000, name: 'DC Sentinel Pro' },
    audit: { month: 1200, year: 12000, name: 'DC Audit Pro' },
    bundle: { month: 3500, year: 35000, name: 'DC complet Pro (Scaffold, Prospect, Sentinel, Audit)' },
}

const column = async (table: string, name: string) => DatabaseHelper.fetchOne(
    'SELECT CHARACTER_MAXIMUM_LENGTH AS length FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?', [table, name])

/** Changes of the licence tables made after their first version (safe at every start: each one checks first). */
export const migrateLicenses = async () => {
    // Keys opening many tools: room for every tool released later
    const products = await column('dc_licenses', 'products')
    if (products && Number(products.length) < 255) await DatabaseHelper.execute('ALTER TABLE dc_licenses MODIFY products VARCHAR(255) NOT NULL')
    const id = await column('dc_license_products', 'product')
    if (id && Number(id.length) < 24) await DatabaseHelper.execute('ALTER TABLE dc_license_products MODIFY product VARCHAR(24) NOT NULL')
    const added: [string, string][] = [['name', 'VARCHAR(40) NULL'], ['sort_order', 'INT NOT NULL DEFAULT 0'], ['price_month', 'INT NULL'],
        ['price_year', 'INT NULL'], ['created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP']]
    for (const [name, type] of added)
        if (!(await column('dc_license_products', name))) await DatabaseHelper.execute(`ALTER TABLE dc_license_products ADD COLUMN ${name} ${type}`)
    // The tools of before: their name, order and default prices, once
    for (const [sort, product] of LICENSE_PRODUCTS.entries())
        await DatabaseHelper.execute('UPDATE dc_license_products SET name = ?, sort_order = ?, price_month = ?, price_year = ? WHERE product = ? AND name IS NULL',
            [LICENSE_PRICES[product]!.name.replace(/ Pro( \(.*\))?$/, ''), sort, LICENSE_PRICES[product]!.month, LICENSE_PRICES[product]!.year, product])
}

export const LICENSE_SEEDS = {
    dc_license_products: async () => {
        for (const product of LICENSE_PRODUCTS)
            await DatabaseHelper.insert('INSERT INTO dc_license_products (product, min_version, name, sort_order, price_month, price_year) VALUES (?, ?, ?, ?, ?, ?)',
                [product, '1.0.0', LICENSE_PRICES[product]!.name.replace(/ Pro( \(.*\))?$/, ''), LICENSE_PRODUCTS.indexOf(product), LICENSE_PRICES[product]!.month, LICENSE_PRICES[product]!.year])
    },
}
