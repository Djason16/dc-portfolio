import { type LicenseProduct } from '../helpers/LicenseSchema'
import { LicenseProducts } from '../helpers/LicenseProducts'
/*
 * E-mails of the DC tools licences, in the layout of the other e-mails (MailLayout):
 *   LicenseMails.sendKey({ key, email, language, products, bought, trial, expiresAt })   the key to the customer (bought, offered
 *                                                                       or a 14-day trial), and a short notice to the owner for a sale
 *   LicenseMails.sendSupport({ ... })   a help request of a tool to the owner (reply-to the user) and a fixed acknowledgement to
 *                                       the user (never his message: the site must not send a text written by a stranger)
 *   LicenseMails.sendTrialUsed({ email, language, tool })   the person already had this free trial (fixed text)
 *   LicenseMails.sendPortalLink({ email, language, url })   the one-time link to the Stripe space of a bought key (30 minutes)
 */
const TOOLS_SITE = 'https://tools.djason-chery.dev'
// Page of the site where a key opens its Stripe space (pages/licenses/manage.vue)
const managePage = (locale: string) => `${useRuntimeConfig().public.frontendDomain}/licenses/manage/?lang=${locale}`

const TEXTS = {
    fr: {
        subject: (tools: string) => `Votre clé ${tools} Pro`,
        title: 'Votre clé Pro',
        subtitle: (tools: string) => tools,
        label: 'Clé de licence',
        bought: 'Merci pour votre abonnement ! Collez cette clé dans l\'outil (Réglages, Licence) : la version Pro s\'active aussitôt.',
        gift: 'Djason CHERY vous offre la version Pro. Collez cette clé dans l\'outil (Réglages, Licence) : la version Pro s\'active aussitôt.',
        trial: "Voici votre essai gratuit de la version Pro, sans carte bancaire. Collez cette clé dans l'outil (Réglages, Licence) : la version Pro s'active aussitôt. À la fin de l'essai, l'outil repasse simplement en version gratuite, sans rien perdre.",
        supportSubject: (tool: string) => `Votre demande d'aide ${tool} est bien reçue`,
        supportText: 'Merci, votre demande est bien arrivée. Je vous réponds par e-mail au plus vite.',
        trialUsedSubject: (tool: string) => `Votre essai ${tool} Pro`,
        trialUsedText: (tool: string) => `Vous avez déjà profité de l'essai gratuit de ${tool} Pro : il n'est offert qu'une fois. Pour continuer en Pro, choisissez votre formule sur ${TOOLS_SITE}/fr/ . Vous n'avez rien demandé ? Ignorez simplement cet e-mail.`,
        portalSubject: 'Votre lien vers votre espace Stripe',
        portalText: (url: string) => `Voici le lien pour ouvrir votre espace Stripe (carte, factures, résiliation) : ${url}
Il est valable 30 minutes et ne sert qu'une fois. Vous n'avez rien demandé ? Ignorez simplement cet e-mail : rien ne change.`,
        until: (date: string) => ` Valable jusqu'au ${date}.`,
        lifetime: ' Valable sans limite de durée.',
        manage: (url: string) => `Pour changer de carte, télécharger vos factures ou résilier : ${url}, avec cette clé (un lien vous est alors envoyé à cette adresse).`,
        download: 'Télécharger les outils',
        regards: 'Bien à vous',
        siteNote: 'Gardez cet e-mail : la clé n\'est enregistrée nulle part en clair.',
        noticeSubject: (tools: string) => `Nouvelle licence vendue : ${tools}`,
        noticeText: (email: string, tools: string) => `${email} vient de s'abonner à ${tools} Pro. Détail dans l'admin, Licences.`,
    },
    en: {
        subject: (tools: string) => `Your ${tools} Pro key`,
        title: 'Your Pro key',
        subtitle: (tools: string) => tools,
        label: 'Licence key',
        bought: 'Thank you for subscribing! Paste this key in the tool (Settings, License): Pro turns on at once.',
        gift: 'Djason CHERY offers you the Pro version. Paste this key in the tool (Settings, License): Pro turns on at once.',
        trial: 'Here is your free trial of the Pro version, no card needed. Paste this key in the tool (Settings, License): Pro turns on at once. When the trial ends, the tool simply goes back to the free version, nothing is lost.',
        supportSubject: (tool: string) => `Your ${tool} help request was received`,
        supportText: 'Thank you, your request arrived. I will answer by e-mail as soon as possible.',
        trialUsedSubject: (tool: string) => `Your ${tool} Pro trial`,
        trialUsedText: (tool: string) => `You already had the free trial of ${tool} Pro: it is offered only once. To keep Pro, pick your plan on ${TOOLS_SITE}/en/ . You did not ask for anything? Just ignore this e-mail.`,
        portalSubject: 'Your link to your Stripe space',
        portalText: (url: string) => `Here is the link to open your Stripe space (card, invoices, cancelling): ${url}
It is valid for 30 minutes and works only once. You did not ask for anything? Just ignore this e-mail: nothing changes.`,
        until: (date: string) => ` Valid until ${date}.`,
        lifetime: ' Valid with no end date.',
        manage: (url: string) => `To change your card, download your invoices or cancel: ${url}, with this key (a link is then sent to this address).`,
        download: 'Download the tools',
        regards: 'Best regards',
        siteNote: 'Keep this e-mail: the key is not stored anywhere in clear.',
        noticeSubject: (tools: string) => `New licence sold: ${tools}`,
        noticeText: (email: string, tools: string) => `${email} just subscribed to ${tools} Pro. Details in the admin, Licences.`,
    },
}

type KeyMail = { key: string, email: string, language: string, products: LicenseProduct[], bought: boolean, trial?: boolean, expiresAt?: Date | string | null }
type SupportMail = { tool: string, version: string, os: string, email: string, message: string, language: string, acknowledge: boolean }

// A short e-mail with a fixed text; never throws (a failed e-mail is logged)
const sendFixed = async (to: string, subject: string, text: string) => {
    try {
        await MailHelper.send({ to, subject, text })
        return true
    } catch (error) {
        console.error('Licence e-mail failed:', (error as Error).message)
        return false
    }
}

export const LicenseMails = {
    /** Sends the key to its owner (and a notice to the owner of the site for a sale). Never throws: a failed e-mail is logged. */
    async sendKey({ key, email, language, products, bought, trial = false, expiresAt = null }: KeyMail) {
        const locale = language === 'en' ? 'en' : 'fr'
        const t = TEXTS[locale]
        // Every tool: the name of the bundle (« DC complet »), else the tools one by one
        const [all, names] = await Promise.all([LicenseProducts.ids(), LicenseProducts.names()])
        const tools = all.every(p => products.includes(p)) ? 'DC complet' : products.map(p => names[p] ?? p).join(' + ')
        const settings = await SettingsHelper.all()
        // An offered key shows its end date; a subscription renews itself (no date)
        const end = bought ? '' : expiresAt
            ? t.until(new Date(expiresAt).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'long' }))
            : t.lifetime
        const instruction = `${bought ? t.bought : trial ? t.trial : t.gift}${end}${bought ? ` ${t.manage(managePage(locale))}` : ''}`
        const html = MailLayout.body({
            title: t.title, subtitle: t.subtitle(tools), label: t.label, value: key, instruction,
            button: { href: `${TOOLS_SITE}/${locale}/download/`, label: t.download },
            regards: t.regards, adminName: MailHelper.escape(settings.name || ''), siteNote: t.siteNote, locale,
        })
        try {
            await MailHelper.send({ to: email, subject: t.subject(tools), html, text: `${instruction}\n${t.label} : ${key}\n${TOOLS_SITE}/${locale}/download/` })
            if (bought) {
                const owner = settings.email || MailHelper.adminAddress()
                await MailHelper.send({ to: owner, subject: TEXTS.fr.noticeSubject(tools), text: TEXTS.fr.noticeText(email, tools) })
            }
            return true
        } catch (error) {
            console.error('Licence e-mail failed:', (error as Error).message)
            return false
        }
    },

    /** A help request sent from a tool: the whole message to the owner (reply-to the user); to the user, only a fixed
        acknowledgement (when acknowledge: under the daily cap) */
    async sendSupport({ tool, version, os, email, message, language, acknowledge }: SupportMail) {
        const t = TEXTS[language === 'en' ? 'en' : 'fr']
        const settings = await SettingsHelper.all()
        const owner = settings.email || MailHelper.adminAddress()
        try {
            await MailHelper.send({ to: owner, replyTo: email, subject: `Aide ${tool} ${version} (${os})`, text: `De : ${email}\nOutil : ${tool} ${version} sur ${os}\n\n${message}` })
        } catch (error) {
            console.error('Support e-mail failed:', (error as Error).message)
            return false
        }
        if (acknowledge) await sendFixed(email, t.supportSubject(tool), t.supportText)
        return true
    },

    sendTrialUsed({ email, language, tool }: { email: string, language: string, tool: string }) {
        const t = TEXTS[language === 'en' ? 'en' : 'fr']
        return sendFixed(email, t.trialUsedSubject(tool), t.trialUsedText(tool))
    },

    sendPortalLink({ email, language, url }: { email: string, language: string, url: string }) {
        const t = TEXTS[language === 'en' ? 'en' : 'fr']
        return sendFixed(email, t.portalSubject, t.portalText(url))
    },
}

