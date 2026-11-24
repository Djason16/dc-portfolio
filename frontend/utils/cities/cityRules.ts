import type { CityFaqEntry } from './cityTypes'

/*
 * Rules of what the admin types for a city and for the shared questions, the same in the form and in the API
 * (server/controllers/CitiesController.ts). Each check gives the values to save, or the key of the error to show.
 */
export const CITY_LIMITS = { name: 120, intro: 3000, question: 200, answer: 1000, keywords: 500, faq: 4, projects: 10, variants: 3 }

// Placeholders the shared questions can use (cityText.ts placeholdersOf)
export const FAQ_PLACEHOLDERS = ['ville', 'a_ville', 'de_ville', 'code_postal', 'departement', 'dans_departement', 'region', 'population',
    'entreprises', 'secteurs', 'base', 'distance', 'duree', 'villes_proches']

const text = (value: unknown) => String(value ?? '').trim()

// Questions typed in the admin: both parts filled (an empty pair is left out), within their limits
const faqEntries = (value: unknown): CityFaqEntry[] | string => {
    if (!Array.isArray(value)) return 'cityFaqInvalid'
    const entries = value.map(entry => ({ q: text(entry?.q), a: text(entry?.a) })).filter(entry => entry.q || entry.a)
    if (entries.some(entry => !entry.q || !entry.a)) return 'cityFaqIncomplete'
    if (entries.some(entry => entry.q.length > CITY_LIMITS.question || entry.a.length > CITY_LIMITS.answer)) return 'cityFaqTooLong'
    return entries
}

/** Fields of a city sent by the admin -> the values of the columns of dc_cities, or an error key. */
export const checkCityChanges = (body: Record<string, any>): { values: Record<string, unknown> } | { error: string } => {
    const values: Record<string, unknown> = {}
    if (body.name !== undefined) {
        const name = text(body.name).replace(/\s+/g, ' ')
        if (!name) return { error: 'cityNameRequired' }
        if (name.length > CITY_LIMITS.name) return { error: 'cityNameTooLong' }
        values.name = name
    }
    if (body.postal_code !== undefined) {
        const code = text(body.postal_code)
        if (code && !/^\d{2,5}$/.test(code)) return { error: 'cityPostalCodeInvalid' }
        values.postal_code = code
    }
    if (body.published !== undefined) values.published = body.published ? 1 : 0
    if (body.meets_in_person !== undefined) values.meets_in_person = body.meets_in_person === null || body.meets_in_person === '' ? null : body.meets_in_person ? 1 : 0
    if (body.intro !== undefined) {
        if (text(body.intro).length > CITY_LIMITS.intro) return { error: 'cityIntroTooLong' }
        values.intro = text(body.intro)
    }
    if (body.faq !== undefined) {
        const entries = faqEntries(body.faq)
        if (typeof entries === 'string') return { error: entries }
        if (entries.length > CITY_LIMITS.faq) return { error: 'cityFaqTooMany' }
        values.faq = JSON.stringify(entries)
    }
    if (body.projects !== undefined) {
        if (!Array.isArray(body.projects) || body.projects.length > CITY_LIMITS.projects) return { error: 'cityProjectsInvalid' }
        values.projects = JSON.stringify(body.projects.map(text).filter(Boolean).map((name: string) => name.slice(0, 255)))
    }
    if (body.keywords !== undefined) {
        if (text(body.keywords).length > CITY_LIMITS.keywords) return { error: 'cityKeywordsTooLong' }
        values.keywords = text(body.keywords)
    }
    return { values }
}

/** Wordings of a shared question: 1 to 3, each with its question and answer, only known {placeholders}. */
export const checkFaqVariants = (value: unknown): { variants: CityFaqEntry[] } | { error: string } => {
    const entries = faqEntries(value)
    if (typeof entries === 'string') return { error: entries }
    if (!entries.length) return { error: 'cityFaqIncomplete' }
    if (entries.length > CITY_LIMITS.variants) return { error: 'cityFaqTooMany' }
    const unknown = entries.flatMap(entry => [...`${entry.q} ${entry.a}`.matchAll(/\{(\w+)\}/g)].map(match => match[1] ?? ''))
        .find(name => !FAQ_PLACEHOLDERS.includes(name))
    if (unknown) return { error: 'cityFaqPlaceholder' }
    return { variants: entries }
}
