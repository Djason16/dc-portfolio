/*
 * Shapes of the city pages (/creation-site-internet/<slug>/), shared by the API (server/controllers/CitiesController.ts),
 * the page (components/views/City), the admin and the similarity test (scripts/cities-similarity.mjs).
 * Relative imports only in utils/cities/: the test loads these files outside Nuxt.
 */

// Companies of one NAF section (A to U) with an establishment in the town (Annuaire des entreprises)
export type CitySector = { section: string, count: number }

// A town around the city (geo.api.gouv.fr), its distance as the crow flies
export type CityNeighbour = { name: string, population: number, km: number }

// Question and answer shown on a city page
export type CityFaqEntry = { q: string, a: string }

// Shared question of every city page (admin > Villes > Questions communes): 2 or 3 wordings, one picked per city
export type CityFaqTemplate = { id: string, variants: CityFaqEntry[], sort_order: number, active: boolean }

// A city as stored in dc_cities (data fetched once from the public APIs, then the choices of the admin)
export type City = {
    id: string
    name: string
    slug: string
    postal_code: string
    insee_code: string
    department_code: string
    department_name: string
    region_name: string
    population: number | null
    surface_km2: number | null
    lat: number | null
    lng: number | null
    // Town of the billing address of admin > My info when the data was fetched (Thourotte)
    base_town: string
    distance_km: number | null
    drive_minutes: number | null
    // 'road': distance and time of a route (OSRM); 'estimate': worked out from the distance as the crow flies
    travel_source: string
    neighbours: CityNeighbour[]
    companies_total: number | null
    // true when a sector reached the limit of the API (10 000): the totals are "more than"
    companies_capped: boolean
    sectors: CitySector[]
    data_updated_at: string | null
    data_error: string
    published: boolean
    sort_order: number
    // null: worked out from the drive time; true / false: chosen in the admin
    meets_in_person: boolean | null
    // Paragraph written by hand for this city (optional, recommended for the big ones)
    intro: string
    faq: CityFaqEntry[]
    // Names of the projects of the site made for this city (dc_projects or data/projects.ts)
    projects: string[]
    // Extra keywords typed in the admin (the trade + city ones are always there)
    keywords: string
}

// Another published city, for the links between city pages
export type NearbyCity = { name: string, slug: string, km: number }

// A project of the site linked to a city
export type CityProject = { name: string, link: string | null }

// What a page is built from, besides the city
export type CityContext = { nearby: NearbyCity[], faqs: CityFaqTemplate[], projects: CityProject[] }

// A link of a block (nearby cities, projects)
export type CityLink = { label: string, to: string, title: string, external?: boolean, meta?: string }

// A part of the page: a h2 title, paragraphs, optional h3 items and links
export type CitySection = {
    id: string
    title: string
    paragraphs: string[]
    // h3 items: a title (empty: a numbered step), a text, a Font Awesome icon
    items?: { title: string, text: string, icon?: string }[]
    links?: CityLink[]
    // Text written by the admin (shown as it is)
    manual?: boolean
}

// The page built for a city (utils/cities/cityPage.ts)
export type CityPage = {
    h1: string
    lead: string
    sections: CitySection[]
    faqTitle: string
    faq: CityFaqEntry[]
    ctaTitle: string
    ctaText: string
    sourceNote: string
}
