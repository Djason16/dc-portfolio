// Creates (once, safe to run again) what the licences of the DC tools need in Stripe, for the key of one .env file
// (a price already there is never changed: change a price from admin > DC licences > Prices and offers, LicensePricing.ts):
// a product per tool (and the bundle « DC complet ») with a monthly and a yearly price (lookup keys dc_<product>_<interval>), the launch coupon of each tool
// (-30 % for life, 50 uses), a customer portal configuration (card, invoices, cancel at the end of the period) and the
// licence events added to the site's webhook.
//   node scripts/stripe-licenses.mjs .env              test mode (sk_test_ key)
//   node scripts/stripe-licenses.mjs .env.production   live mode (sk_live_ key), only with the owner's go
// Prints only what it creates or finds, never the key.
import fs from 'node:fs'
import Stripe from 'stripe'

const PRICES = {
    scaffold: { month: 900, year: 9000, name: 'DC Scaffold Pro' },
    prospect: { month: 1900, year: 19000, name: 'DC Prospect Pro' },
    sentinel: { month: 900, year: 9000, name: 'DC Sentinel Pro' },
    audit: { month: 1200, year: 12000, name: 'DC Audit Pro' },
    bundle: { month: 3500, year: 35000, name: 'DC complet Pro (Scaffold, Prospect, Sentinel, Audit)' },
}
const file = process.argv[2]
if (!file || !fs.existsSync(file)) throw new Error('Usage: node scripts/stripe-licenses.mjs <env file>')
const line = fs.readFileSync(file, 'utf8').match(/^STRIPE_SECRET_KEY\s*=\s*"?([^"\s]+)"?/m)
if (!line || !/^sk_(test|live)_/.test(line[1])) throw new Error('No Stripe secret key in that file')
const mode = line[1].startsWith('sk_live_') ? 'live' : 'test'
const stripe = new Stripe(line[1])
console.log(`Stripe ${mode} mode`)

const findProduct = async (product) => (await stripe.products.search({ query: `metadata['dc_product']:'${product}'` })).data[0]

for (const [product, info] of Object.entries(PRICES)) {
    const found = await findProduct(product)
    const item = found ?? await stripe.products.create({
        name: info.name, metadata: { dc_product: product }, tax_code: 'txcd_10202000',
        description: `${info.name} — https://tools.djason-chery.dev/`,
    })
    console.log(`${found ? 'found' : 'created'} product ${info.name}`)
    for (const interval of ['month', 'year']) {
        const lookupKey = `dc_${product}_${interval}`
        const existing = (await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 })).data[0]
        if (existing) { console.log(`  found price ${lookupKey}`); continue }
        await stripe.prices.create({
            product: item.id, currency: 'eur', unit_amount: info[interval], recurring: { interval },
            lookup_key: lookupKey, tax_behavior: 'inclusive', metadata: { dc_product: product },
        })
        console.log(`  created price ${lookupKey} (${info[interval] / 100} €/${interval})`)
    }
    const couponId = `DC_LAUNCH30_${product.toUpperCase()}`
    try {
        const coupon = await stripe.coupons.retrieve(couponId)
        // Texts shown by the sales site for this offer (it reads the running offers from /api/licenses/sales)
        if (!coupon.metadata?.dc_label_fr) await stripe.coupons.update(couponId, { metadata: { ...coupon.metadata, dc_product: product, dc_label_fr: 'Lancement : -30 % à vie', dc_label_en: 'Launch: -30% for life' } })
        console.log(`  found coupon ${couponId}`)
    } catch {
        await stripe.coupons.create({
            id: couponId, name: 'Lancement -30 % à vie', percent_off: 30, duration: 'forever', max_redemptions: 50,
            applies_to: { products: [item.id] }, metadata: { dc_product: product, dc_label_fr: 'Lancement : -30 % à vie', dc_label_en: 'Launch: -30% for life' },
        })
        console.log(`  created coupon ${couponId} (-30 % for life, 50 uses)`)
    }
}

const configs = await stripe.billingPortal.configurations.list({ active: true, limit: 100 })
if (configs.data.some(c => c.metadata?.dc_licenses === '1')) console.log('found portal configuration')
else {
    await stripe.billingPortal.configurations.create({
        business_profile: { headline: 'DC — Djason CHERY', privacy_policy_url: 'https://tools.djason-chery.dev/fr/privacy/', terms_of_service_url: 'https://tools.djason-chery.dev/fr/terms/' },
        features: {
            customer_update: { enabled: true, allowed_updates: ['email', 'address', 'name'] },
            invoice_history: { enabled: true },
            payment_method_update: { enabled: true },
            subscription_cancel: { enabled: true, mode: 'at_period_end', cancellation_reason: { enabled: true, options: ['too_expensive', 'missing_features', 'unused', 'other'] } },
        },
        metadata: { dc_licenses: '1' },
    })
    console.log('created portal configuration')
}

// The webhook of the site (Dashboard, or created by hand) must also receive the subscription events of the licences
const LICENSE_EVENTS = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.paid']
const hooks = await stripe.webhookEndpoints.list({ limit: 100 })
const hook = hooks.data.find(h => /\/api\/stripe\/webhook\/?$/.test(h.url))
if (!hook) console.log('no webhook ending with /api/stripe/webhook (normal in test mode with stripe listen)')
else if (hook.enabled_events.includes('*')) console.log('webhook already receives every event')
else {
    const missing = LICENSE_EVENTS.filter(e => !hook.enabled_events.includes(e))
    if (!missing.length) console.log('webhook already receives the licence events')
    else {
        await stripe.webhookEndpoints.update(hook.id, { enabled_events: [...hook.enabled_events, ...missing] })
        console.log(`webhook: added ${missing.join(', ')}`)
    }
}
