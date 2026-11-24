import type { City, CityFaqTemplate, NearbyCity } from './cityTypes'

/*
 * Rows of dc_cities and dc_city_faqs read as City / CityFaqTemplate objects, and the nearest other published cities.
 * Shared by the API (server/helpers/CityHelper.ts) and the similarity test (scripts/cities-similarity.mjs).
 */
export const json = <T>(text: unknown, fallback: T): T => {
    try { return text ? JSON.parse(String(text)) as T : fallback } catch { return fallback }
}
export const num = (value: unknown) => value === null || value === undefined ? null : Number(value)

export const toCity = (row: Record<string, any>): City => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    postal_code: row.postal_code ?? '',
    insee_code: row.insee_code ?? '',
    department_code: row.department_code ?? '',
    department_name: row.department_name ?? '',
    region_name: row.region_name ?? '',
    population: num(row.population),
    surface_km2: num(row.surface_km2),
    lat: num(row.lat),
    lng: num(row.lng),
    base_town: row.base_town ?? '',
    distance_km: num(row.distance_km),
    drive_minutes: num(row.drive_minutes),
    travel_source: row.travel_source ?? '',
    neighbours: json(row.neighbours, []),
    companies_total: num(row.companies_total),
    companies_capped: Boolean(row.companies_capped),
    sectors: json(row.sectors, []),
    data_updated_at: row.data_updated_at ? new Date(row.data_updated_at).toISOString() : null,
    data_error: row.data_error ?? '',
    published: Boolean(row.published),
    sort_order: Number(row.sort_order ?? 0),
    meets_in_person: row.meets_in_person === null || row.meets_in_person === undefined ? null : Boolean(row.meets_in_person),
    intro: row.intro ?? '',
    faq: json(row.faq, []),
    projects: json(row.projects, []),
    keywords: row.keywords ?? '',
})

export const toFaqTemplate = (row: Record<string, any>): CityFaqTemplate => ({
    id: row.id, variants: json(row.variants, []), sort_order: Number(row.sort_order ?? 0), active: Boolean(row.active),
})

// Distance as the crow flies between two [longitude, latitude], in km
export const crowKm = (a: [number, number], b: [number, number]) => {
    const rad = Math.PI / 180
    const [lng1, lat1] = a
    const [lng2, lat2] = b
    const h = Math.sin((lat2 - lat1) * rad / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lng2 - lng1) * rad / 2) ** 2
    return 6371 * 2 * Math.asin(Math.sqrt(h))
}

/** The 4 nearest other published cities (links between city pages). */
export const nearbyOf = (city: City, cities: City[]): NearbyCity[] => {
    if (city.lat === null || city.lng === null) return []
    return cities
        .filter(other => other.id !== city.id && other.published && other.lat !== null && other.lng !== null)
        .map(other => ({ name: other.name, slug: other.slug, km: Math.round(crowKm([city.lng!, city.lat!], [other.lng!, other.lat!])) }))
        .sort((a, b) => a.km - b.km)
        .slice(0, 4)
}
