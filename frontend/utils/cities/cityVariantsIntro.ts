import type { CityWords } from './cityText'
import { capitalize } from './cityText'

/*
 * Wordings of the top of a city page: the h1, the lead, the figures of the town and the sectors part.
 * Several wordings per paragraph, same meaning, other build; one is picked per city (pick() of cityText.ts).
 * A wording returns '' when the data it needs is missing: the paragraph is then left out.
 */
type Wording = (w: CityWords) => string

export const H1: Wording[] = [
    (w) => `Création de site internet ${w.at}`,
    (w) => `Création de site internet ${w.at} (${w.postal})`,
    (w) => `Développeur web pour créer votre site internet ${w.at}`,
    (w) => `Création de site internet et développement web ${w.at}`,
]

export const LEAD: Wording[] = [
    (w) => `Vous dirigez une entreprise ${w.at} et votre site ne vous apporte pas de clients, ou vous n'en avez pas encore ? Je suis ${w.owner}, développeur web indépendant installé ${w.from}, et je crée des sites sur mesure, rapides et bien référencés pour les entreprises ${w.dept}.`,
    (w) => `Développeur web freelance installé ${w.from}, je conçois pour les commerçants, artisans, indépendants et associations ${w.of} des sites internet clairs, rapides sur téléphone et faciles à faire vivre, du premier échange jusqu'à la mise en ligne.`,
    (w) => `${capitalize(w.at)}, comme partout ${w.dept}, vos futurs clients vous cherchent d'abord sur leur téléphone. Mon travail, en tant que développeur web indépendant installé ${w.from} : leur montrer un site qui donne envie de vous appeler, et qui se trouve sur Google.`,
    (w) => `Un site internet bien construit, c'est souvent le premier rendez-vous entre une entreprise ${w.of} et ses clients. Je m'appelle ${w.owner}, je suis développeur web full-stack installé ${w.from} et je réalise des sites vitrines, des boutiques en ligne et des outils sur mesure.`,
]

export const ECONOMY_TITLE: Wording[] = [
    (w) => `L'économie ${w.of} en quelques chiffres`,
    (w) => `${w.name} : le tissu économique local`,
    (w) => `Qui sont les entreprises ${w.of} ?`,
    (w) => `${w.name} vue par ses entreprises`,
]

// The figures of the town, three short parts (people, companies, sectors), each one in its own wording
export const POPULATION: Wording[] = [
    (w) => w.population ? `${w.name} compte ${w.population} habitants${w.density ? `, soit environ ${w.density} habitants au km²` : ''}.` : '',
    (w) => w.population ? `Avec ses ${w.population} habitants, ${w.name} est un bassin de clientèle à part entière ${w.dept}.` : '',
    (w) => w.population ? `La commune ${w.of} réunit ${w.population} habitants${w.density ? ` (près de ${w.density} par km²)` : ''}, autant de clients potentiels qui cherchent d'abord en ligne.` : '',
]

export const COMPANIES: Wording[] = [
    (w) => w.companies ? `On y recense ${w.companies} entreprises actives ayant un établissement sur la commune.` : '',
    (w) => w.companies ? `L'Annuaire des entreprises y compte ${w.companies} entreprises en activité, de l'indépendant au grand groupe.` : '',
    (w) => w.companies ? `Côté économie, ${w.companies} entreprises actives y ont au moins un établissement.` : '',
]

export const SECTORS_LINE: Wording[] = [
    (w) => w.sectors ? `Les secteurs les plus représentés sont ${w.sectors}.` : '',
    (w) => w.sectors ? `Trois domaines dominent : ${w.sectors}.` : '',
    (w) => w.sectorsOf ? `Une grande partie de ces entreprises relève ${w.sectorsOf}.` : '',
]

export const SECTORS_TITLE: Wording[] = [
    (w) => `Ce qu'un site apporte aux entreprises ${w.of}`,
    (w) => `Votre métier ${w.at}, votre site`,
    (w) => `Un site adapté aux grands secteurs ${w.of}`,
]

export const SECTORS_INTRO: Wording[] = [
    (w) => w.sectors ? `Chaque métier a ses attentes. Voici ce que je conseille le plus souvent aux entreprises des secteurs les plus présents ${w.at}.` : '',
    (w) => w.sectors ? `Un site de restaurant ne se construit pas comme celui d'un cabinet de conseil. Pour les activités les plus présentes ${w.at}, voici les priorités qui reviennent le plus souvent.` : '',
    (w) => w.sectors ? `${capitalize(w.sectors)} : ces activités pèsent lourd ${w.at}. Pour chacune, quelques pistes concrètes de ce qu'un site peut changer au quotidien.` : '',
]

export const SOURCE: Wording[] = [
    (w) => `Chiffres ${w.of} issus des données publiques de l'INSEE (geo.api.gouv.fr) et de l'Annuaire des entreprises (recherche-entreprises.api.gouv.fr)`,
    (w) => `Sources des données sur ${w.name} : INSEE par geo.api.gouv.fr, Annuaire des entreprises de l'État (recherche-entreprises.api.gouv.fr)`,
]
