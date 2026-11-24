import type { City, CityContext, CityPage, CitySection } from './cityTypes'
import { buildFaq } from './cityFaq'
import { sectorAdvice, sectorIcon, sectorTitle, topSectors } from './citySectors'
import { formatKm, hashOf, isBase, meetsInPerson, pick, shuffle, wordsOf } from './cityText'
import { COMPANIES, ECONOMY_TITLE, H1, LEAD, POPULATION, SECTORS_INTRO, SECTORS_LINE, SECTORS_TITLE, SOURCE } from './cityVariantsIntro'
import { METHOD, METHOD_TITLE, OFFER, OFFER_TITLE, SERVICES, TRAVEL, TRAVEL_TITLE } from './cityVariantsWork'
import { CTA, CTA_TITLE, FAQ_TITLE, MANUAL_TITLE, NEARBY, NEARBY_LINKS, NEARBY_TITLE, PROJECTS_TITLE, SEO, SEO_TITLE } from './cityVariantsLocal'

/*
 * The page of a city, built from ONE template: every paragraph has several wordings (one picked per city from its slug,
 * never random per visit), and the blocks that need data (figures, sectors, travel, towns around) appear only when the
 * data of the city supports them. The page component shows exactly what is returned here, and the similarity check
 * (citySimilarity.ts) measures this same text.
 *   const page = buildCityPage(city, { nearby, faqs, projects }, 'Djason CHERY')
 */

// Orders of the parts of the page (one per city), the h1 and the lead always first, the FAQ and the call to action last
const ORDERS = [
    ['manual', 'economy', 'sectors', 'offer', 'method', 'travel', 'seo', 'projects', 'nearby'],
    ['offer', 'economy', 'sectors', 'travel', 'method', 'manual', 'seo', 'projects', 'nearby'],
    ['economy', 'manual', 'offer', 'sectors', 'seo', 'travel', 'method', 'projects', 'nearby'],
    ['travel', 'manual', 'economy', 'offer', 'sectors', 'method', 'seo', 'nearby', 'projects'],
]

// How the meetings are done for this city
const modeOf = (city: City) => isBase(city) ? 'base' : city.department_code === '75' ? 'paris' : meetsInPerson(city) ? 'near' : 'far'

export const buildCityPage = (city: City, context: CityContext, owner: string): CityPage => {
    const w = wordsOf(city, owner)
    const slug = city.slug
    const mode = modeOf(city)
    const text = (key: string, options: ((words: typeof w) => string)[]) => pick(slug, key, options)(w)

    const parts: Record<string, CitySection | null> = {}

    const figures = [text('population', POPULATION), text('companies', COMPANIES), text('sectors-line', SECTORS_LINE)].filter(Boolean)
    parts.economy = figures.length ? { id: 'economy', title: text('economy-title', ECONOMY_TITLE), paragraphs: [figures.join(' ')] } : null

    const top = topSectors(city, 3)
    parts.sectors = top.length ? {
        id: 'sectors',
        title: text('sectors-title', SECTORS_TITLE),
        paragraphs: [text('sectors-intro', SECTORS_INTRO)].filter(Boolean),
        items: top.map(sector => ({ title: sectorTitle(sector.section), icon: sectorIcon(sector.section), text: sectorAdvice(sector.section, hashOf(`${slug}:advice:${sector.section}`), w.at) })),
    } : null

    // Four of the services, in an order of this city, each in one of its wordings
    const services = shuffle(slug, 'services', SERVICES, service => service.id).slice(0, 4)
    parts.offer = {
        id: 'offer',
        title: text('offer-title', OFFER_TITLE),
        paragraphs: [text('offer', OFFER)],
        items: services.map(service => ({
            icon: service.icon,
            title: pick(slug, `service-title:${service.id}`, service.title),
            text: pick(slug, `service-text:${service.id}`, service.text)(w),
        })),
    }

    // The steps of the method, numbered on the page
    parts.method = { id: 'method', title: text('method-title', METHOD_TITLE), paragraphs: [], items: pick(slug, 'method', METHOD).map(line => ({ title: '', text: line(w) })) }

    const travel = text(`travel-${mode}`, TRAVEL[mode])
    parts.travel = travel ? { id: 'travel', title: text(`travel-title-${mode}`, TRAVEL_TITLE[mode]), paragraphs: [travel] } : null

    parts.seo = { id: 'seo', title: text('seo-title', SEO_TITLE), paragraphs: [text('seo', SEO)] }

    // The paragraph written by hand for this city: as typed, one paragraph per blank line
    const manual = (city.intro || '').split(/\n\s*\n/).map(part => part.trim()).filter(Boolean)
    parts.manual = manual.length ? { id: 'manual', title: text('manual-title', MANUAL_TITLE), paragraphs: manual, manual: true } : null

    parts.projects = context.projects.length ? {
        id: 'projects',
        title: text('projects-title', PROJECTS_TITLE),
        paragraphs: [],
        links: context.projects.map(project => ({ label: project.name, to: project.link || '', title: `Voir le projet ${project.name}`, external: Boolean(project.link) })),
    } : null

    parts.nearby = {
        id: 'nearby',
        title: text('nearby-title', NEARBY_TITLE),
        paragraphs: [text('nearby', NEARBY), context.nearby.length ? text('nearby-links', NEARBY_LINKS) : ''].filter(Boolean),
        links: context.nearby.map(other => ({
            label: other.name,
            meta: formatKm(other.km),
            to: `/creation-site-internet/${other.slug}/`,
            title: `Création de site internet à ${other.name}`,
        })),
    }

    const order = pick(slug, 'order', ORDERS)
    return {
        h1: text('h1', H1),
        lead: text('lead', LEAD),
        sections: order.map(id => parts[id]).filter((part): part is CitySection => Boolean(part)),
        faqTitle: text('faq-title', FAQ_TITLE),
        faq: buildFaq(city, w, mode, context.faqs),
        ctaTitle: text('cta-title', CTA_TITLE),
        ctaText: text('cta', CTA),
        sourceNote: city.data_updated_at ? text('source', SOURCE) : '',
    }
}

// Every visible text of the main part of a page, in reading order (similarity check)
export const pageText = (page: CityPage) => [
    page.h1, page.lead,
    ...page.sections.flatMap(section => [section.title, ...section.paragraphs, ...(section.items ?? []).flatMap(item => [item.title, item.text]),
        ...(section.links ?? []).map(link => link.label)]),
    page.faqTitle, ...page.faq.flatMap(entry => [entry.q, entry.a]),
    page.ctaTitle, page.ctaText, page.sourceNote,
].filter(Boolean).join('\n')
