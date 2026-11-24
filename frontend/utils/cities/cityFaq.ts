import type { City, CityFaqEntry, CityFaqTemplate } from './cityTypes'
import type { CityWords } from './cityText'
import { fillPlaceholders, hashOf, pick, placeholdersOf, shuffle } from './cityText'
import { DATA_FAQ } from './cityVariantsLocal'

/*
 * Questions of a city page (6 to 8, all in the FAQPage JSON-LD): the ones worked out from the data (travel, sectors, towns
 * around), the shared ones of admin > Villes > Questions communes (one wording each, picked per city, {placeholders} filled),
 * and the ones typed for this city. The order is its own for each city; the questions typed for the city always stay.
 */
const MIN_QUESTIONS = 6
const MAX_QUESTIONS = 8

type Mode = 'near' | 'far' | 'paris' | 'base'

// The shared questions this city can show: one wording each whose placeholders all have a value
const fromTemplates = (city: City, templates: CityFaqTemplate[]) => {
    const values = placeholdersOf(city)
    return templates.filter(template => template.active).flatMap(template => {
        // The wording of this city first, then the others when it needs a value the city does not have
        const start = hashOf(`${city.slug}:faq:${template.id}`) % Math.max(1, template.variants.length)
        const ordered = [...template.variants.slice(start), ...template.variants.slice(0, start)]
        for (const variant of ordered) {
            const q = fillPlaceholders(variant.q, values)
            const a = fillPlaceholders(variant.a, values)
            if (q && a) return [{ id: template.id, entry: { q, a } }]
        }
        return []
    })
}

export const buildFaq = (city: City, words: CityWords, mode: Mode, templates: CityFaqTemplate[]): CityFaqEntry[] => {
    const manual = (city.faq || []).filter(entry => entry.q?.trim() && entry.a?.trim())
    const fromData = DATA_FAQ.flatMap(question => {
        const entry = pick(city.slug, `faq-data:${question.id}`, question.variants)(words, mode)
        return entry ? [{ id: `data-${question.id}`, entry }] : []
    })
    // Between 6 and 8 in all: 7 by default, 8 when the city has its own questions
    const target = Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, manual.length ? 8 : 7))
    const shared = shuffle(city.slug, 'faq-pick', fromTemplates(city, templates), item => item.id)
        .slice(0, Math.max(0, target - manual.length - fromData.length))
    const mixed = shuffle(city.slug, 'faq-order', [...fromData, ...shared], item => item.id).map(item => item.entry)
    // The questions typed for the city come first: they are the most specific
    return [...manual, ...mixed].slice(0, Math.max(MAX_QUESTIONS, manual.length))
}
