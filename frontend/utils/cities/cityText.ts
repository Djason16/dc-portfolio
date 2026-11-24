import type { City } from './cityTypes'
import { sectorLabel, sectorOf, topSectors } from './citySectors'

/*
 * Small helpers of the city texts: the wording picked for a city (always the same for the same city, never random per
 * visit), French prepositions (à Compiègne, au Mesnil, d'Estrées), numbers, distances, and the {placeholders} of the
 * shared questions typed in the admin.
 */

// FNV-1a: the same text always gives the same number
export const hashOf = (text: string) => {
    let hash = 0x811c9dc5
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i)
        hash = Math.imul(hash, 0x01000193)
    }
    return hash >>> 0
}

// One of the wordings for this city and this part of the page
export const pick = <T>(slug: string, key: string, options: T[]): T => options[hashOf(`${slug}:${key}`) % options.length] as T

// The list sorted in an order of its own for this city (FAQ, services)
export const shuffle = <T>(slug: string, key: string, list: T[], idOf: (item: T) => string = String) =>
    [...list].sort((a, b) => hashOf(`${slug}:${key}:${idOf(a)}`) - hashOf(`${slug}:${key}:${idOf(b)}`))

const VOWEL = /^[aeiouyhâàéèêîïôûAEIOUYHÂÀÉÈÊÎÏÔÛ]/

// "à Compiègne", "au Plessis-Brion", "aux Ageux"
export const inCity = (name: string) => /^Le /.test(name) ? `au ${name.slice(3)}` : /^Les /.test(name) ? `aux ${name.slice(4)}` : `à ${name}`

// "de Compiègne", "d'Estrées-Saint-Denis", "du Plessis-Brion"
export const ofCity = (name: string) => /^Le /.test(name) ? `du ${name.slice(3)}` : /^Les /.test(name) ? `des ${name.slice(4)}`
    : VOWEL.test(name) ? `d'${name}` : `de ${name}`

// "dans l'Oise", "à Paris", "dans le département de la Somme" is not guessed: "dans le département Somme (80)"
export const inDepartment = (city: Pick<City, 'department_code' | 'department_name'>) => {
    if (city.department_code === '75') return 'à Paris'
    if (!city.department_name) return ''
    return VOWEL.test(city.department_name) ? `dans l'${city.department_name}` : `dans le département ${city.department_name} (${city.department_code})`
}

// 40761 -> "40 761" (spaces of French numbers)
export const formatNumber = (value: number) => Math.round(value).toLocaleString('fr-FR').replace(/[  ]/g, ' ')

// 72 -> "1 h 10", 25 -> "25 min" (rounded to 5 minutes: it is an estimate)
export const formatDuration = (minutes: number) => {
    const rounded = Math.max(5, Math.round(minutes / 5) * 5)
    const hours = Math.floor(rounded / 60)
    const rest = rounded % 60
    return hours ? `${hours} h${rest ? ` ${String(rest).padStart(2, '0')}` : ''}` : `${rest} min`
}

export const formatKm = (km: number) => `${formatNumber(km < 10 ? Math.round(km * 10) / 10 : Math.round(km))} km`

// "A, B et C"
export const joinNames = (names: string[]) => names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`

// The city is the base itself (Thourotte): no trip
export const isBase = (city: City) => Boolean(city.base_town) && city.base_town.toLowerCase() === city.name.toLowerCase()

// Close enough for a meeting in person: chosen in the admin, else 45 minutes of road at most (never Paris by default)
export const meetsInPerson = (city: City) => city.meets_in_person ?? (city.department_code !== '75' && city.drive_minutes !== null && city.drive_minutes <= 45)

/*
 * Values of the {placeholders} of the shared questions of the admin; a value missing for this city is left out
 * ('' : the wording that needs it is skipped, cityFaq.ts)
 */
export const placeholdersOf = (city: City): Record<string, string> => {
    const sectors = topSectors(city, 3).map(sector => sectorLabel(sector.section))
    return {
        ville: city.name,
        a_ville: inCity(city.name),
        de_ville: ofCity(city.name),
        code_postal: city.postal_code,
        departement: city.department_name,
        dans_departement: inDepartment(city),
        region: city.region_name,
        population: city.population ? formatNumber(city.population) : '',
        entreprises: city.companies_total ? `${city.companies_capped ? 'plus de ' : ''}${formatNumber(city.companies_total)}` : '',
        secteurs: sectors.length ? joinNames(sectors) : '',
        base: city.base_town,
        distance: city.distance_km !== null && !isBase(city) ? formatKm(city.distance_km) : '',
        duree: city.drive_minutes !== null && !isBase(city) ? formatDuration(city.drive_minutes) : '',
        villes_proches: joinNames(city.neighbours.slice(0, 3).map(n => n.name)),
    }
}

// "Délais {a_ville} ?" -> the text, or null when a placeholder has no value for this city
export const fillPlaceholders = (text: string, values: Record<string, string>) => {
    let missing = false
    const filled = text.replace(/\{(\w+)\}/g, (match, name: string) => {
        const value = values[name]
        if (value === undefined) return match
        if (!value) missing = true
        return value
    })
    return missing ? null : filled
}

// Upper case first letter ("à Paris" at the start of a sentence)
export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

// Everything the wordings of a page need about its city, ready to put in a sentence ('' when unknown)
export type CityWords = {
    slug: string
    name: string
    at: string
    of: string
    dept: string
    postal: string
    owner: string
    // "à Thourotte", or "ici même" on the page of the base town
    from: string
    base: string
    isBase: boolean
    km: string
    time: string
    population: string
    density: string
    companies: string
    sectors: string
    sectorsOf: string
    neighbours: string
    around: string
}

export const wordsOf = (city: City, owner: string): CityWords => {
    const values = placeholdersOf(city)
    const top = topSectors(city, 3)
    const base = isBase(city)
    const density = city.population && city.surface_km2 ? formatNumber(city.population / city.surface_km2) : ''
    return {
        slug: city.slug,
        name: city.name,
        at: inCity(city.name),
        of: ofCity(city.name),
        dept: values.dans_departement ?? '',
        postal: city.postal_code,
        owner,
        from: base ? 'ici même' : (city.base_town ? inCity(city.base_town) : ''),
        base: city.base_town,
        isBase: base,
        km: values.distance ?? '',
        time: values.duree ?? '',
        population: values.population ?? '',
        density,
        companies: values.entreprises ?? '',
        sectors: values.secteurs ?? '',
        sectorsOf: joinNames(top.map(sector => sectorOf(sector.section))),
        neighbours: values.villes_proches ?? '',
        around: `autour ${ofCity(city.name)}`,
    }
}
