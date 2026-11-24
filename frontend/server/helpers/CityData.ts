import { NAF_SECTIONS } from '~/utils/cities/citySectors'
import { crowKm } from '~/utils/cities/cityRows'
import type { CityNeighbour, CitySector } from '~/utils/cities/cityTypes'

/*
 * Data of a city, fetched from free public services when the admin adds or refreshes it (never per visit), then stored
 * in dc_cities (CityHelper.ts):
 *   geo.api.gouv.fr (INSEE): the town, its population, surface, department, region, and the towns within 15 km
 *   recherche-entreprises.api.gouv.fr (Annuaire des entreprises): active companies with an establishment in the town, per NAF section
 *   router.project-osrm.org: distance and time by road from the base town; without an answer, an estimate from the distance
 *   as the crow flies (always shown as « environ »)
 * Calls go one after the other with a pause (the Annuaire allows 7 per second): never two cities fetched at the same time.
 */
const TIMEOUT = 10000
// Pause between two calls of the queue (milliseconds): about 4 calls per second at most
const GAP = 250
const NEIGHBOUR_KM = 15
// The Annuaire never counts more than this: a sector at this number is "more than"
const API_CAP = 10000

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// One call at a time for the whole server, a pause after each one
let queue: Promise<unknown> = Promise.resolve()
const queued = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task)
    queue = run.then(() => wait(GAP), () => wait(GAP))
    return run
}

// A town of geo.api.gouv.fr
type Commune = { nom: string, code: string, codesPostaux?: string[], centre?: { coordinates: [number, number] }, surface?: number,
    population?: number, departement?: { code: string, nom: string }, region?: { code: string, nom: string } }

const plain = (text: string) => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '')

// geo.api.gouv.fr sometimes takes about 9 s to answer (seen on 2026-11-24, with curl too): a long wait, then one more try
const GEO_TIMEOUT = 25000
const geoOnce = async <T>(url: string, timeout: number) => {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeout), headers: { accept: 'application/json' } })
    if (!res.ok) throw new Error(`geo.api.gouv.fr ${res.status}`)
    return await res.json() as T
}
const geo = <T>(path: string, query: Record<string, string | number> = {}, timeout = GEO_TIMEOUT) => queued(async () => {
    const url = `https://geo.api.gouv.fr${path}?${new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]))}`
    try {
        return await geoOnce<T>(url, timeout)
    } catch (error) {
        console.warn('[cities] geo.api.gouv.fr, one more try:', path, (error as Error).message)
        return await geoOnce<T>(url, timeout)
    }
})

/** The town of this name (and postal code, when given): null when the service does not know it. */
export const findCommune = async (name: string, postalCode = '') => {
    const fields = 'nom,code,codesPostaux,centre,surface,population,departement,region'
    const query: Record<string, string | number> = { nom: name, fields, boost: 'population', limit: 10 }
    if (/^\d{5}$/.test(postalCode)) query.codePostal = postalCode
    const towns = await geo<Commune[]>('/communes', query)
    const found = towns.find(town => plain(town.nom) === plain(name)) ?? towns[0]
    return found ?? null
}

// Towns of a region (every department of it), kept for the life of the server: they hardly ever change
const regionTowns = new Map<string, Commune[]>()
const townsOfRegion = async (regionCode: string) => {
    if (regionTowns.has(regionCode)) return regionTowns.get(regionCode)!
    const departments = await geo<{ code: string }[]>(`/regions/${regionCode}/departements`)
    const towns: Commune[] = []
    for (const department of departments)
        towns.push(...await geo<Commune[]>(`/departements/${department.code}/communes`, { fields: 'nom,code,centre,population' }, 60000))
    regionTowns.set(regionCode, towns)
    return towns
}

/** The biggest towns within 15 km of this one (6 at most), nearest first among the same size. */
export const neighboursOf = async (commune: Commune): Promise<CityNeighbour[]> => {
    const centre = commune.centre?.coordinates
    if (!centre || !commune.region?.code) return []
    const towns = await townsOfRegion(commune.region.code)
    return towns
        .filter(town => town.code !== commune.code && town.centre)
        .map(town => ({ name: town.nom, population: town.population ?? 0, km: Math.round(crowKm(centre, town.centre!.coordinates) * 10) / 10 }))
        .filter(town => town.km <= NEIGHBOUR_KM)
        .sort((a, b) => b.population - a.population)
        .slice(0, 6)
}

// Paris, Lyon and Marseille: the Annuaire knows their establishments by district
const DISTRICTS: Record<string, string[]> = {
    '75056': Array.from({ length: 20 }, (_, i) => String(75101 + i)),
    '69123': Array.from({ length: 9 }, (_, i) => String(69381 + i)),
    '13055': Array.from({ length: 16 }, (_, i) => String(13201 + i)),
}

const countCompanies = async (codes: string, section: string): Promise<number> => {
    const ask = () => $fetch<{ total_results: number }>('https://recherche-entreprises.api.gouv.fr/search',
        { query: { code_commune: codes, etat_administratif: 'A', section_activite_principale: section, per_page: 1, minimal: true }, timeout: TIMEOUT })
    try {
        return (await queued(ask)).total_results ?? 0
    } catch (error) {
        // Too many calls: one more try after a longer pause
        if ((error as { statusCode?: number }).statusCode !== 429) throw error
        await wait(2000)
        return (await queued(ask)).total_results ?? 0
    }
}

/** Active companies of the town per NAF section (biggest first), their total, and whether a section reached the cap. */
export const companiesOf = async (inseeCode: string) => {
    const codes = (DISTRICTS[inseeCode] ?? [inseeCode]).join(',')
    const sectors: CitySector[] = []
    for (const section of NAF_SECTIONS) sectors.push({ section, count: await countCompanies(codes, section) })
    return {
        sectors: sectors.filter(sector => sector.count > 0).sort((a, b) => b.count - a.count),
        total: sectors.reduce((sum, sector) => sum + sector.count, 0),
        capped: sectors.some(sector => sector.count >= API_CAP),
    }
}

/** Road distance and time between two points (OSRM), else an estimate from the distance as the crow flies. */
export const travelBetween = async (from: [number, number], to: [number, number]) => {
    try {
        const route = await queued(() => $fetch<{ code: string, routes?: { distance: number, duration: number }[] }>(
            `https://router.project-osrm.org/route/v1/driving/${from.join(',')};${to.join(',')}`, { query: { overview: 'false' }, timeout: TIMEOUT }))
        const best = route.routes?.[0]
        if (route.code === 'Ok' && best) return { km: Math.round(best.distance / 100) / 10, minutes: Math.round(best.duration / 60), source: 'road' }
    } catch (error) {
        console.warn('[cities] route:', (error as Error).message)
    }
    // Roads are about 30 % longer than the straight line; about 60 km/h on average
    const km = Math.round(crowKm(from, to) * 1.3 * 10) / 10
    return { km, minutes: Math.round(km), source: 'estimate' }
}
