import type { City, CityContext } from './cityTypes'
import { buildCityPage, pageText } from './cityPage'

/*
 * How much two city pages look alike, as a search engine could measure it: the visible main text of each page cut into
 * "shingles" of 5 words in a row, then the Jaccard index (shared shingles / all shingles). 0 % = nothing in common,
 * 100 % = the same text. Target: under 50 % for every pair (admin > Villes warns above, scripts/cities-similarity.mjs fails).
 */
export const SIMILARITY_LIMIT = 50
const SHINGLE = 5

// Lower case words without accents or punctuation
const wordsOf = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean)

export const shinglesOf = (text: string) => {
    const words = wordsOf(text)
    const set = new Set<string>()
    for (let i = 0; i + SHINGLE <= words.length; i++) set.add(words.slice(i, i + SHINGLE).join(' '))
    return set
}

// Jaccard index of two sets of shingles, in percent
export const jaccard = (a: Set<string>, b: Set<string>) => {
    if (!a.size && !b.size) return 0
    let shared = 0
    for (const shingle of a) if (b.has(shingle)) shared++
    return Math.round((shared / (a.size + b.size - shared)) * 1000) / 10
}

export type CitySimilarity = { id: string, percent: number, closest: string }

/**
 * For each city: its closest other city and how much their pages look alike.
 * @param contextOf what each page is built from (nearby cities, shared questions, projects)
 */
export const similarities = (cities: City[], contextOf: (city: City) => CityContext, owner: string): CitySimilarity[] => {
    const shingles = cities.map(city => shinglesOf(pageText(buildCityPage(city, contextOf(city), owner))))
    return cities.map((city, i) => {
        let best = { percent: 0, closest: '' }
        cities.forEach((other, j) => {
            if (i === j) return
            const percent = jaccard(shingles[i] as Set<string>, shingles[j] as Set<string>)
            if (percent > best.percent) best = { percent, closest: other.name }
        })
        return { id: city.id, ...best }
    })
}

// Every pair of cities and their similarity, highest first (the test script)
export const pairSimilarities = (cities: City[], contextOf: (city: City) => CityContext, owner: string) => {
    const shingles = cities.map(city => shinglesOf(pageText(buildCityPage(city, contextOf(city), owner))))
    const pairs: { a: string, b: string, percent: number }[] = []
    for (let i = 0; i < cities.length; i++)
        for (let j = i + 1; j < cities.length; j++)
            pairs.push({ a: cities[i]!.name, b: cities[j]!.name, percent: jaccard(shingles[i] as Set<string>, shingles[j] as Set<string>) })
    return pairs.sort((x, y) => y.percent - x.percent)
}
