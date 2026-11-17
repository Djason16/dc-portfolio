import type Stripe from 'stripe'
import { LICENSE_PRICES, isOffer, productsOfOffer, type LicenseOffer } from './LicenseSchema'

/*
 * Stripe side of the DC tools licences (server/controllers/LicensesController.ts):
 *   LicenseStripe.checkout(product, interval, lang)   Stripe Checkout page of a Pro subscription (best running offer applied)
 *   LicenseStripe.handle(event)                       webhook events: key created and e-mailed after the first payment,
 *                                                     end of access kept in line with the subscription (renewal, cancel)
 *   LicenseStripe.portal(key)                         Stripe customer portal of a key (card, invoices, cancel)
 *   LicenseStripe.renewal(subscriptionId)             next renewal date, or cancelled (page /licenses/manage/)
 * Prices are found by their lookup key dc_<product>_<interval> (created by scripts/stripe-licenses.mjs): no price id in the .env files.
 */
const TOOLS_SITE = 'https://tools.djason-chery.dev'
// A few days after the paid period: a renewal paid a little late never cuts the tool
const GRACE_MS = 3 * 86400 * 1000

const stripe = () => StripeHelper.client()
const toolPage = (offer: LicenseOffer, lang: string) => offer === 'bundle' ? `${TOOLS_SITE}/${lang}/` : `${TOOLS_SITE}/${lang}/${offer}/`

// End of the paid period of a subscription (on its items since the 2025 Stripe API)
const periodEnd = (sub: Stripe.Subscription) => {
    const seconds = (sub as any).current_period_end ?? sub.items?.data?.[0]?.current_period_end
    return seconds ? new Date(seconds * 1000) : null
}

// When the access of a subscription ends: a stopped one at once (or at its end date), a running one after its period (+ grace)
const accessEnd = (sub: Stripe.Subscription) => {
    if (['canceled', 'incomplete_expired', 'unpaid'].includes(sub.status)) return new Date(((sub.ended_at ?? sub.canceled_at) || Date.now() / 1000) * 1000)
    const end = periodEnd(sub)
    if (!end) return null
    return sub.cancel_at_period_end ? end : new Date(end.getTime() + GRACE_MS)
}

const syncSubscription = async (sub: Stripe.Subscription) => {
    const license = await LicenseHelper.bySubscription(sub.id)
    if (!license) return
    await LicenseHelper.update(license.id, { expiresAt: accessEnd(sub)?.toISOString() ?? null })
}

// First payment of a subscription: one key per subscription (a second event for the same subscription changes nothing)
const createFromSession = async (session: Stripe.Checkout.Session) => {
    const product = session.metadata?.dc_product
    if (session.mode !== 'subscription' || !isOffer(product) || !session.subscription) return
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id
    if (await LicenseHelper.bySubscription(subscriptionId)) return
    const sub = await stripe().subscriptions.retrieve(subscriptionId)
    const email = session.customer_details?.email || ''
    const language = session.metadata?.dc_lang === 'en' ? 'en' : 'fr'
    const { key } = await LicenseHelper.create({
        email, name: session.customer_details?.name || '', language, products: productsOfOffer(product), source: 'stripe',
        expiresAt: accessEnd(sub), stripeCustomer: typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
        stripeSubscription: subscriptionId, billingInterval: sub.items?.data?.[0]?.price?.recurring?.interval ?? null,
    })
    await LicenseMails.sendKey({ key, email, language, products: productsOfOffer(product), bought: true })
}

export const LicenseStripe = {
    /** Address of the Stripe page of a Pro subscription; null when the price does not exist (setup script not run). */
    async checkout(product: LicenseOffer, interval: 'month' | 'year', lang: 'fr' | 'en') {
        const prices = await stripe().prices.list({ lookup_keys: [`dc_${product}_${interval}`], active: true, limit: 1 })
        const price = prices.data[0]
        if (!price) return null
        // The best offer running now for this tool (Stripe coupons with metadata dc_product, LicenseOffers.ts)
        const coupon = (await LicenseOffers.best(product))?.id ?? null
        const frontend = useRuntimeConfig().public.frontendDomain
        const metadata = { dc_product: product, dc_lang: lang }
        // No consumer mediator set in admin > Settings (required to sell to consumers, art. L.612-1 of the French Consumer Code):
        // sales are for professionals only, the customer says so and gives his business name or SIRET. Filled in: open to everyone
        const proOnly = !(await SettingsHelper.all()).mediatorName
        const session = await stripe().checkout.sessions.create({
            mode: 'subscription',
            line_items: [{ price: price.id, quantity: 1 }],
            ...(coupon ? { discounts: [{ coupon }] } : { allow_promotion_codes: true }),
            success_url: `${frontend}/licenses/thanks/?lang=${lang}&product=${product}`,
            cancel_url: toolPage(product, lang),
            locale: lang,
            metadata,
            subscription_data: { metadata, description: LICENSE_PRICES[product].name },
            // Express request for immediate access and waiver of the withdrawal right (digital content, art. L221-28 13°):
            // a box the customer must tick, its text below
            consent_collection: { terms_of_service: 'required' },
            ...(proOnly ? {
                custom_fields: [{
                    key: 'business', type: 'text' as const, optional: false,
                    label: { type: 'custom' as const, custom: lang === 'en' ? 'Business name or SIRET' : 'Entreprise ou SIRET' },
                    text: { minimum_length: 2, maximum_length: 120 },
                }],
                metadata: { ...metadata, dc_pro_only: '1' },
            } : {}),
            custom_text: {
                terms_of_service_acceptance: {
                    message: lang === 'en'
                        ? `${proOnly ? 'I am buying as a professional. ' : ''}I accept the [terms of sale](${TOOLS_SITE}/en/terms/), ask for immediate access to the Pro version and expressly waive my 14-day withdrawal right once the key is delivered.`
                        : `${proOnly ? "J'achète à titre professionnel. " : ''}J'accepte les [conditions de vente](${TOOLS_SITE}/fr/terms/), je demande l'accès immédiat à la version Pro et je renonce expressément à mon droit de rétractation de 14 jours dès la livraison de la clé.`,
                },
                submit: {
                    message: lang === 'en'
                        ? 'Your licence key is e-mailed right after payment. Cancel any time from the subscription portal. VAT not applicable, art. 293 B of the French Tax Code.'
                        : 'Votre clé de licence est envoyée par e-mail dès le paiement. Résiliable à tout moment depuis le portail d\'abonnement. TVA non applicable, art. 293 B du CGI.',
                },
            },
        })
        return session.url
    },

    /** Webhook events of the licences (other events are ignored here). */
    async handle(event: Stripe.Event) {
        if (event.type === 'checkout.session.completed') return createFromSession(event.data.object as Stripe.Checkout.Session)
        if (['customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type))
            return syncSubscription(event.data.object as Stripe.Subscription)
        if (event.type === 'invoice.paid') {
            const invoice = event.data.object as any
            const id = invoice.parent?.subscription_details?.subscription ?? invoice.subscription
            if (typeof id === 'string' && await LicenseHelper.bySubscription(id)) await syncSubscription(await stripe().subscriptions.retrieve(id))
        }
    },

    /** Next renewal of a subscription (end of its paid period), or the end of a cancelled one; null when Stripe can't tell. */
    async renewal(subscriptionId: string) {
        try {
            const sub = await stripe().subscriptions.retrieve(subscriptionId)
            const end = periodEnd(sub)
            const stopped = sub.cancel_at_period_end || ['canceled', 'incomplete_expired', 'unpaid'].includes(sub.status)
            return { renewsAt: stopped ? null : end?.toISOString() ?? null, cancelled: stopped }
        } catch {
            return null
        }
    },

    /** Stripe customer portal of a bought key; null for an unknown or offered key. */
    async portal(key: unknown, lang: 'fr' | 'en') {
        const customer = await LicenseHelper.customerOf(key)
        if (!customer) return null
        // The portal settings made for the licences (scripts/stripe-licenses.mjs), else the default ones of the account
        const configs = await stripe().billingPortal.configurations.list({ active: true, limit: 100 })
        const configuration = configs.data.find(c => c.metadata?.dc_licenses === '1')?.id
        const session = await stripe().billingPortal.sessions.create({
            customer, return_url: `${TOOLS_SITE}/${lang}/`, locale: lang, ...(configuration ? { configuration } : {}),
        })
        return session.url
    },
}
