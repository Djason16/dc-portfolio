import type { City } from './cityTypes'
import { sectorKeyword, topSectors } from './citySectors'
import { ofCity, pick, wordsOf } from './cityText'

/*
 * Title, description and keywords of a city page (one wording per city, like its texts). The keywords always hold the
 * trade with the city ("création site internet Compiègne"), then its big sectors, its department and the words typed in
 * the admin.
 */
const TITLES = [
    (name: string, code: string) => `Création de site internet à ${name} (${code})`,
    (name: string) => `Création de site internet à ${name}, développeur web`,
    (name: string, code: string) => `Site internet à ${name} (${code}) : développeur web`,
]

export const cityMeta = (city: City, owner: string) => {
    const w = wordsOf(city, owner)
    const code = city.department_code || city.postal_code
    const title = `${pick(city.slug, 'meta-title', TITLES)(city.name, code)} | ${owner}`
    const trip = !w.isBase && w.km ? `, à ${w.km} ${ofCity(w.base)}` : ''
    const descriptions = [
        `Développeur web installé ${w.isBase ? w.at : w.from} : création de sites vitrines, boutiques en ligne et référencement local pour les entreprises ${w.of}${w.sectors ? ` (${w.sectors})` : ''}.`,
        `Création de site internet ${w.at}${trip} : sites sur mesure, rapides et bien référencés pour les commerçants, artisans et indépendants ${w.of}.`,
        `Votre site internet ${w.at} : développeur web freelance${trip}, sites vitrines, e-commerce, réservation en ligne et SEO local ${w.dept}.`,
    ]
    const sectors = topSectors(city, 2).map(sector => `${sectorKeyword(sector.section)} ${city.name}`)
    const keywords = [
        `création site internet ${city.name}`, `développeur web ${city.name}`, `site vitrine ${city.name}`, `référencement local ${city.name}`,
        ...sectors,
        city.department_name && city.department_code !== '75' ? `développeur web ${city.department_name}` : '',
        city.keywords,
    ].filter(Boolean).join(', ')
    return { title, description: pick(city.slug, 'meta-description', descriptions), keywords }
}
