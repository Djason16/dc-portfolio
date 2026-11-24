import type { RouteArgs } from '../utils/RouteDiscovery'
import type { H3Event } from 'h3'
import { similarities } from '~/utils/cities/citySimilarity'
import { checkCityChanges, checkFaqVariants } from '~/utils/cities/cityRules'
/*
 * City pages /creation-site-internet/<slug>/ (CityHelper.ts, utils/cities/):
 *   GET    /api/cities                 admin: every city, its similarity with the closest other one, the shared questions
 *   GET    /api/cities/published       public: the published cities (zone page /zone-intervention/)
 *   GET    /api/cities/page/{slug}     public: a published city and what its page is built from (the admin also sees a draft)
 *   GET    /api/cities/sitemap         public: addresses of the published city pages (sitemap.xml)
 *   POST   /api/cities                 { name, postal_code? }: the city is created and its data fetched (a few seconds)
 *   PUT    /api/cities/{id}            any of name, postal_code, published, meets_in_person, intro, faq, projects, keywords
 *   POST   /api/cities/{id}/refresh    its data fetched again
 *   POST   /api/cities/reorder         { ids: [...] } order of the admin and of the zone page
 *   DELETE /api/cities/{id}
 *   POST   /api/cities/faqs  ·  PUT /api/cities/faqs/{id}  ·  DELETE /api/cities/faqs/{id}   shared questions { variants, active }
 */
const PUBLIC_FIELDS = ['name', 'slug', 'postal_code', 'department_code', 'department_name', 'population', 'companies_total', 'companies_capped', 'lat', 'lng',
    'base_town', 'distance_km', 'drive_minutes']

export default class CitiesController extends Controller {
    static publicActions = ['published', 'page', 'sitemap']
    static routes = {
        published: ['GET', '/published'], page: ['GET', '/page/{slug}'], sitemap: ['GET', '/sitemap'], refresh: ['POST', '/{id}/refresh'],
        reorder: ['POST', '/reorder'], createFaq: ['POST', '/faqs'], updateFaq: ['PUT', '/faqs/{id}'], deleteFaq: ['DELETE', '/faqs/{id}'],
    }

    async getAll(event: H3Event) {
        const [cities, faqs, owner] = await Promise.all([CityHelper.all(), CityHelper.faqs(), CityHelper.owner()])
        const contexts = new Map(await Promise.all(cities.map(async city => [city.id, await CityHelper.contextOf(city, cities, faqs)] as const)))
        const scores = similarities(cities, city => contexts.get(city.id)!, owner)
        return ResponseHelper.success(event, { cities: cities.map((city, i) => ({ ...city, similarity: scores[i] })), faqs })
    }

    async published(event: H3Event) {
        const cities = (await CityHelper.all()).filter(city => city.published)
            .map(city => Object.fromEntries(PUBLIC_FIELDS.map(field => [field, city[field as keyof typeof city]])))
        return ResponseHelper.success(event, { cities, base: await CityHelper.mapBase() })
    }

    async page(event: H3Event, args: RouteArgs) {
        const cities = await CityHelper.all()
        const city = cities.find(found => found.slug === args.slug)
        if (!city || (!city.published && !(await SessionHelper.userId(event)))) return ResponseHelper.notFound(event, 'cityNotFound')
        const { data_error: _error, ...shown } = city
        const context = await CityHelper.contextOf(city, cities, await CityHelper.faqs())
        // Every published town on the small map of the page (and this one, even as a draft seen by the admin)
        const area = cities.filter(other => other.published || other.id === city.id).map(other => ({
            name: other.name, slug: other.slug, lat: other.lat, lng: other.lng, population: other.population, department_code: other.department_code,
        }))
        return ResponseHelper.success(event, { city: shown, context, area, base: await CityHelper.mapBase(), owner: await CityHelper.owner() })
    }

    async sitemap(event: H3Event) {
        const cities = (await CityHelper.all()).filter(city => city.published)
        return cities.map(city => ({ loc: `/creation-site-internet/${city.slug}/`, lastmod: city.data_updated_at ?? undefined }))
    }

    async create(event: H3Event) {
        const body = (await this.body(event)) || {}
        const checked = checkCityChanges({ name: body.name, postal_code: body.postal_code ?? '' })
        if ('error' in checked) return ResponseHelper.validationError(event, checked.error)
        const name = String(checked.values.name)
        const slug = CityHelper.slugOf(name)
        if (!slug) return ResponseHelper.validationError(event, 'cityNameRequired')
        if (await this.fetchOne('SELECT id FROM dc_cities WHERE slug = ?', [slug])) return ResponseHelper.error(event, 'cityExists', 409)
        const id = DatabaseHelper.newId()
        const last = await this.fetchOne('SELECT COALESCE(MAX(sort_order), 0) AS last FROM dc_cities')
        await this.insert('INSERT INTO dc_cities (id, name, slug, postal_code, sort_order, neighbours, sectors, faq, projects, intro) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, name, slug, checked.values.postal_code ?? '', Number(last?.last ?? 0) + 1, '[]', '[]', '[]', '[]', ''])
        const error = await CityHelper.refresh(id)
        // A town the public services do not know: not kept (a typing mistake)
        if (error === 'cityTownNotFound') {
            await this.execute('DELETE FROM dc_cities WHERE id = ?', [id])
            return ResponseHelper.validationError(event, error)
        }
        return ResponseHelper.success(event, { id, dataError: error }, 201)
    }

    async update(event: H3Event, args: RouteArgs) {
        const body = (await this.body(event)) || {}
        const checked = checkCityChanges(body)
        if ('error' in checked) return ResponseHelper.validationError(event, checked.error)
        const fields = Object.keys(checked.values)
        if (!fields.length) return ResponseHelper.validationError(event, 'Nothing to update')
        const values = fields.map(field => checked.values[field])
        const changed = await this.execute(`UPDATE dc_cities SET ${fields.map(field => `${field} = ?`).join(', ')} WHERE id = ?`, [...values, args.id])
        if (!changed) return ResponseHelper.notFound(event, 'cityNotFound')
        // Another town typed: its data again
        const dataError = fields.includes('name') || fields.includes('postal_code') ? await CityHelper.refresh(args.id) : ''
        return ResponseHelper.success(event, { id: args.id, dataError })
    }

    async refresh(event: H3Event, args: RouteArgs) {
        const error = await CityHelper.refresh(args.id)
        if (error === 'cityNotFound') return ResponseHelper.notFound(event, error)
        return ResponseHelper.success(event, { id: args.id, dataError: error })
    }

    async reorder(event: H3Event) {
        const ids = (await this.body(event))?.ids
        if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) return ResponseHelper.validationError(event, 'Invalid order')
        for (const [index, id] of ids.entries()) await this.execute('UPDATE dc_cities SET sort_order = ? WHERE id = ?', [index + 1, id])
        return ResponseHelper.success(event, { ids })
    }

    async delete(event: H3Event, args: RouteArgs) {
        const changed = await this.execute('DELETE FROM dc_cities WHERE id = ?', [args.id])
        return this.changed(event, changed, args.id, 'cityNotFound')
    }

    async createFaq(event: H3Event) {
        const checked = checkFaqVariants((await this.body(event))?.variants)
        if ('error' in checked) return ResponseHelper.validationError(event, checked.error)
        const id = DatabaseHelper.newId()
        const last = await this.fetchOne('SELECT COALESCE(MAX(sort_order), 0) AS last FROM dc_city_faqs')
        await this.insert('INSERT INTO dc_city_faqs (id, variants, sort_order, active) VALUES (?, ?, ?, 1)',
            [id, JSON.stringify(checked.variants), Number(last?.last ?? 0) + 1])
        return ResponseHelper.success(event, { id }, 201)
    }

    async updateFaq(event: H3Event, args: RouteArgs) {
        const body = (await this.body(event)) || {}
        const sets: string[] = []
        const values: unknown[] = []
        if (body.variants !== undefined) {
            const checked = checkFaqVariants(body.variants)
            if ('error' in checked) return ResponseHelper.validationError(event, checked.error)
            sets.push('variants = ?'), values.push(JSON.stringify(checked.variants))
        }
        if (body.active !== undefined) sets.push('active = ?'), values.push(body.active ? 1 : 0)
        if (!sets.length) return ResponseHelper.validationError(event, 'Nothing to update')
        const changed = await this.execute(`UPDATE dc_city_faqs SET ${sets.join(', ')} WHERE id = ?`, [...values, args.id])
        return this.changed(event, changed, args.id, 'cityFaqNotFound')
    }

    async deleteFaq(event: H3Event, args: RouteArgs) {
        const changed = await this.execute('DELETE FROM dc_city_faqs WHERE id = ?', [args.id])
        return this.changed(event, changed, args.id, 'cityFaqNotFound')
    }
}
