import { DatabaseHelper } from '../utils/DatabaseHelper'
import { SettingsHelper } from './SettingsHelper'
import { companiesOf, findCommune, neighboursOf, travelBetween } from './CityData'
import { projects as staticProjects } from '~/data/projects'
import { townOf } from '~/utils/address'
import { json, nearbyOf, num, toCity, toFaqTemplate } from '~/utils/cities/cityRows'
import type { City, CityContext, CityFaqTemplate } from '~/utils/cities/cityTypes'

/*
 * City pages (CitiesController.ts): rows of dc_cities read as City objects, the data of a city fetched again from the
 * public services (CityData.ts), and what each page is built from (nearby published cities, shared questions, projects).
 *   await CityHelper.all()             every city, in the order of the admin
 *   await CityHelper.refresh(id)       data fetched again and saved (an error is kept in data_error, the old data stays)
 *   await CityHelper.contextOf(city, cities, faqs)
 */
// "Crépy-en-Valois" -> "crepy-en-valois"
export const slugOf = (name: string) => String(name).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 140)

// Base town of the owner (billing address of admin > My info), kept while that address does not change
let base: { address: string, town: string, centre: [number, number] } | null = null
const baseOf = async () => {
    const address = (await SettingsHelper.all()).invoiceAddress ?? ''
    if (base?.address === address) return base
    // "16 rue Jean Jaurès 60150 Thourotte": the town is the text after the postal code
    const match = address.match(/\b(\d{5})\s+([^,\n]+)/)
    const postalCode = match?.[1] ?? ''
    const town = (match?.[2] ?? townOf(address).split(',')[0] ?? '').trim()
    const commune = town ? await findCommune(town, postalCode) : null
    base = commune?.centre ? { address, town: commune.nom, centre: commune.centre.coordinates } : null
    // Kept for the maps of the pages (no call to a service when a page is shown): dc_settings « cityBase »
    if (base) await DatabaseHelper.execute('INSERT INTO dc_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
        ['cityBase', JSON.stringify({ name: base.town, lat: base.centre[1], lng: base.centre[0] })]).catch(() => null)
    return base
}

export const CityHelper = {
    slugOf,

    async all() {
        return (await DatabaseHelper.fetchAll('SELECT * FROM dc_cities ORDER BY sort_order, name')).map(toCity)
    },

    async faqs() {
        return (await DatabaseHelper.fetchAll('SELECT * FROM dc_city_faqs ORDER BY sort_order, created_at')).map(toFaqTemplate)
    },

    /** Data of the city fetched again from the public services; returns the error key, or '' when everything was saved. */
    async refresh(id: string) {
        const row = await DatabaseHelper.fetchOne('SELECT * FROM dc_cities WHERE id = ?', [id])
        if (!row) return 'cityNotFound'
        try {
            const commune = await findCommune(row.name, row.postal_code)
            if (!commune?.centre) {
                await DatabaseHelper.execute('UPDATE dc_cities SET data_error = ? WHERE id = ?', ['cityTownNotFound', id])
                return 'cityTownNotFound'
            }
            const centre = commune.centre.coordinates
            const home = await baseOf()
            const travel = home ? await travelBetween(home.centre, centre) : null
            // A service that does not answer: the data saved before stays (an error is shown in the admin)
            const failed: string[] = []
            const neighbours = await neighboursOf(commune).catch(error => (failed.push(`neighbours: ${error.message}`), json(row.neighbours, [])))
            const companies = await companiesOf(commune.code).catch(error => (failed.push(`companies: ${error.message}`),
                { total: num(row.companies_total), capped: Boolean(row.companies_capped), sectors: json(row.sectors, []) }))
            // Paris (several postal codes): its department number only
            const postalCode = (commune.codesPostaux?.length ?? 0) > 1 && commune.departement?.code === '75' ? '75'
                : (commune.codesPostaux?.includes(row.postal_code) ? row.postal_code : commune.codesPostaux?.[0] ?? row.postal_code)
            await DatabaseHelper.execute(`UPDATE dc_cities SET name = ?, postal_code = ?, insee_code = ?, department_code = ?, department_name = ?,
                region_name = ?, population = ?, surface_km2 = ?, lat = ?, lng = ?, base_town = ?, distance_km = ?, drive_minutes = ?,
                travel_source = ?, neighbours = ?, companies_total = ?, companies_capped = ?, sectors = ?, data_updated_at = NOW(),
                data_error = ? WHERE id = ?`, [
                commune.nom, postalCode, commune.code, commune.departement?.code ?? '', commune.departement?.nom ?? '',
                commune.region?.nom ?? '', commune.population ?? null, commune.surface ? Math.round(commune.surface) / 100 : null,
                centre[1], centre[0], home?.town ?? '', home ? travel!.km : null, home ? travel!.minutes : null, travel?.source ?? '',
                JSON.stringify(neighbours), companies.total, companies.capped ? 1 : 0, JSON.stringify(companies.sectors),
                failed.length ? 'cityDataPartial' : '', id])
            if (failed.length) console.warn('[cities] refresh:', failed.join(' · '))
            return failed.length ? 'cityDataPartial' : ''
        } catch (error) {
            console.warn('[cities] refresh:', (error as Error).message)
            await DatabaseHelper.execute('UPDATE dc_cities SET data_error = ? WHERE id = ?', ['cityDataFailed', id])
            return 'cityDataFailed'
        }
    },

    /** The 4 nearest other published cities (links between city pages). */
    nearbyOf,

    /** Projects of the site linked to the city: their name and link (dc_projects, then data/projects.ts). */
    async projectsOf(city: City) {
        if (!city.projects.length) return []
        const rows = await DatabaseHelper.fetchAll('SELECT name, link FROM dc_projects')
        const known = [...rows, ...staticProjects.map(project => ({ name: project.name, link: null }))]
        return city.projects.map(name => known.find(project => project.name === name)).filter(Boolean)
            .map(project => ({ name: project!.name, link: project!.link || null }))
    },

    async contextOf(city: City, cities: City[], faqs: CityFaqTemplate[]): Promise<CityContext> {
        return { nearby: CityHelper.nearbyOf(city, cities), faqs, projects: await CityHelper.projectsOf(city) }
    },

    /** The base town for the maps (town of the billing address, worked out at the last refresh of a city), or null. */
    async mapBase(): Promise<{ name: string, lat: number, lng: number } | null> {
        const row = await DatabaseHelper.fetchOne('SELECT value FROM dc_settings WHERE `key` = ?', ['cityBase']).catch(() => null)
        try {
            const value = row?.value ? JSON.parse(String(row.value)) : null
            return value && typeof value.name === 'string' && Number.isFinite(value.lat) && Number.isFinite(value.lng) ? value : null
        } catch {
            return null
        }
    },

    async owner() {
        return (await SettingsHelper.all()).name || ''
    },
}
