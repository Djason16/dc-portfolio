import common from './common/common'
import preferences from './common/preferences'
import seo from './common/seo'
import socials from './common/socials'
import adminCalendar from './pages/admin/calendar'
import adminClients from './pages/admin/clients'
import adminDashboard from './pages/admin/dashboard'
import adminDocuments from './pages/admin/documents'
import adminMissions from './pages/admin/missions'
import adminProjects from './pages/admin/projects'
import adminSettings from './pages/admin/settings'
import adminEnvironment from './pages/admin/environment'
import adminTimezonesAfricaAmericas from './pages/admin/timezonesAfricaAmericas'
import adminTimezonesAsiaEuropeOceania from './pages/admin/timezonesAsiaEuropeOceania'
import adminContracts from './pages/admin/contracts'
import adminBilling from './pages/admin/billing'
import adminBooking from './pages/admin/booking'
import adminLounge from './pages/admin/lounge'
import adminLicenses from './pages/admin/licenses'
import adminBillingContracts from './pages/admin/billingContracts'
import adminBillingDocument from './pages/admin/billingDocument'
import adminEinvoice from './pages/admin/einvoice'
import home from './pages/index'
import skills from './pages/skills'
import legal from './pages/legal'
import login from './pages/login'
import payMe from './pages/payMe'
import privacy from './pages/privacy'
import refundPolicy from './pages/refundPolicy'
import terms from './pages/terms'
import withdrawal from './pages/withdrawal'
import licenses from './pages/licenses'
import book from './pages/book'
import room from './pages/room'
import lounge from './pages/lounge'
import cities from './pages/cities'
import adminCities from './pages/admin/cities'

import { LANGUAGES, fillText } from './languages'

// Languages of the site: languages.ts (kept apart, the browser gets the texts after the page: plugins/lang.ts)
export { LANGUAGES }

/*
 * Every translation file. Each one has a block per language, with the same keys:
 *   export default { fr: { heroTitle: 'Bonjour' }, en: { heroTitle: 'Hello' } }
 * A key exists in one file only (the first file that has it wins).
 * New file: create it (for example pages/about.js), import it above and add it to this list.
 */
export const TRANSLATIONS: Record<string, Record<string, string>>[] = [
    common, preferences, seo, socials,
    home, skills, legal, privacy, terms, refundPolicy, withdrawal, licenses, book, room, lounge, cities, payMe, login,
    adminDashboard, adminClients, adminMissions, adminDocuments, adminContracts, adminBilling, adminBillingContracts, adminBillingDocument, adminEinvoice, adminCalendar, adminTimezonesAfricaAmericas, adminTimezonesAsiaEuropeOceania, adminProjects, adminSettings, adminEnvironment, adminBooking, adminLounge, adminLicenses, adminCities,
]

/*
 * Texts shown to visitors that can be changed from the admin (Texts), without building the site again:
 * the texts of these files are the defaults, the changed ones are stored in dc_texts (server/helpers/TextsHelper.js).
 * billingDocument and contracts: the texts printed on the quotes, invoices and contracts.
 */
export const EDITABLE_TRANSLATIONS: Record<string, Record<string, Record<string, string>>> = { common, preferences, seo, home, skills, payMe, legal, privacy, terms, refundPolicy, withdrawal, book, room, lounge, cities,
    billingDocument: adminBillingDocument, contracts: adminContracts }

/**
 * Text of a key in a language, with its {{values}} filled in. A missing text shows its key (easy to spot on the page).
 * @param changed texts changed from the admin ({ fr: { key: 'text' } }), used first
 */
export const translate = (language: string, key: string, values: Record<string, string | number> = {}, changed: Record<string, Record<string, string>> = {}): string =>
    fillText(changed[language]?.[key] || (textOf(language, key) ?? key), values)

// Every text of a language in one table, made on first use (the first file that has a key wins, like before)
const merged: Record<string, Record<string, string>> = {}

/** Text of a key as written in the files (before its {{values}}), undefined when no file has it */
export const textOf = (language: string, key: string): string | undefined => {
    if (!merged[language]) {
        merged[language] = {}
        for (const file of [...TRANSLATIONS].reverse()) Object.assign(merged[language], file[language])
    }
    return merged[language][key]
}
