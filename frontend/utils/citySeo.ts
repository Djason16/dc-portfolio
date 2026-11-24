import { useHead, useSeoMeta } from '#imports'
import { withTrailingSlash } from './pathHelpers'
import { socialProfilesOf } from './socialNetworks'
import type { CityFaqEntry } from './cities/cityTypes'

/*
 * <head> of the local pages (city pages and the zone page): title, description, keywords, canonical, Open Graph, and the
 * JSON-LD of the business (ProfessionalService, a kind of LocalBusiness, with the same @id as the one of the other pages)
 * with the town of the billing address of admin > My info and the area it serves, the breadcrumb and the questions.
 */
type Site = Record<string, string>
type Crumb = { name: string, path: string }
type Place = { name: string, department?: string }

// "16 rue Jean Jaurès 60150 Thourotte" -> its postal code and town (the street stays in the legal notice and the documents)
export const localityOf = (address: string) => {
    const match = String(address || '').match(/\b(\d{5})\s+([^,\n]+)/)
    return match ? { postalCode: match[1], locality: (match[2] ?? '').trim() } : null
}

const placeOf = (place: Place) => ({
    '@type': 'City',
    name: place.name,
    ...(place.department ? { containedInPlace: { '@type': 'AdministrativeArea', name: place.department } } : {}),
})

export const businessSchema = (site: Site, description: string, served: Place[]) => {
    const locality = localityOf(site.invoiceAddress ?? '')
    return {
        '@context': 'https://schema.org',
        '@type': 'ProfessionalService',
        '@id': `${site.url}/#professional-service`,
        name: site.name,
        url: site.url,
        image: `${site.url}/images/profile.jpg`,
        description,
        telephone: site.phone,
        email: site.email,
        priceRange: '€€',
        address: {
            '@type': 'PostalAddress',
            ...(locality ? { postalCode: locality.postalCode, addressLocality: locality.locality } : {}),
            ...(site.area?.includes(',') ? { addressRegion: (site.area.split(',')[0] ?? '').trim() } : {}),
            addressCountry: 'FR',
        },
        areaServed: served.length ? served.map(placeOf) : { '@type': 'Country', name: 'France' },
        sameAs: socialProfilesOf(site.socialLinks),
        serviceType: ['Web Development', 'Website Creation', 'SEO', 'Web Application Development'],
    }
}

export const breadcrumbSchema = (site: Site, crumbs: Crumb[]) => ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, i) => ({ '@type': 'ListItem', position: i + 1, name: crumb.name, item: withTrailingSlash(`${site.url}${crumb.path}`) })),
})

export const faqSchema = (entries: CityFaqEntry[]) => ({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map(entry => ({ '@type': 'Question', name: entry.q, acceptedAnswer: { '@type': 'Answer', text: entry.a } })),
})

/** Meta tags, canonical and JSON-LD of a local page (French: the language of these pages). */
export const applyLocalSeo = (site: Site, page: { title: string, description: string, keywords: string, path: string, image?: string, noIndex?: boolean },
    schemas: Record<string, unknown>[]) => {
    const url = withTrailingSlash(`${site.url}${page.path}`)
    const image = `${site.url}${page.image ?? '/images/profile.jpg'}`
    useSeoMeta({
        title: page.title,
        description: page.description,
        author: 'Djason CHERY',
        generator: 'DC Scaffold',
        robots: page.noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
        ogTitle: page.title,
        ogDescription: page.description,
        ogType: 'website',
        ogUrl: url,
        ogImage: image,
        ogImageAlt: page.title,
        ogSiteName: site.name,
        ogLocale: 'fr_FR',
        twitterCard: 'summary_large_image',
        twitterTitle: page.title,
        twitterDescription: page.description,
        twitterImage: image,
    })
    useHead({
        meta: [{ name: 'keywords', content: page.keywords }],
        link: [{ rel: 'canonical', href: url }],
        script: schemas.map(schema => ({ type: 'application/ld+json' as const, innerHTML: JSON.stringify(schema) })),
    })
}

// A description of 160 characters at most, cut at a word
export const shortDescription = (text: string, max = 158) => text.length <= max ? text : `${text.slice(0, text.lastIndexOf(' ', max - 1))}…`
