import type { CityWords } from './cityText'
import { capitalize } from './cityText'
import type { CityFaqEntry } from './cityTypes'

/*
 * Wordings of the end of a city page: being found on Google locally, the hand-written part, the projects, the towns around,
 * the questions worked out from the data, and the call to action. One wording picked per city (cityPage.ts).
 */
type Wording = (w: CityWords) => string

export const SEO_TITLE: Wording[] = [
    (w) => `Être trouvé sur Google ${w.at}`,
    (w) => `Référencement local : ${w.name} et ses alentours`,
    (w) => `Visible quand on vous cherche ${w.at}`,
]

export const SEO: Wording[] = [
    (w) => `Quand quelqu'un tape « votre métier + ${w.name} » sur Google, ce sont la fiche Google Business Profile et quelques sites bien construits qui sortent. Je soigne les deux côtés : des pages rapides et structurées, et les conseils pour une fiche complète${w.neighbours ? `, avec les communes que vous desservez comme ${w.neighbours}` : ''}.`,
    (w) => `Le référencement local repose sur des choses simples mais rarement bien faites : un site rapide, des pages qui disent clairement ce que vous faites et où, des données structurées que Google comprend, et une fiche d'établissement à jour. ${capitalize(w.at)}${w.neighbours ? ` comme à ${w.neighbours}` : ''}, c'est ce qui fait la différence face à la concurrence.`,
    (w) => `Votre site doit répondre aux recherches réelles de vos clients ${w.at}${w.neighbours ? ` et dans les communes voisines (${w.neighbours})` : ''}. J'y travaille dès la conception : titres, textes, vitesse d'affichage et balisage, plutôt que d'ajouter le référencement après coup.`,
]

export const MANUAL_TITLE: Wording[] = [
    (w) => `${w.name}, en quelques mots`,
    (w) => `Pourquoi ${w.name}`,
]

export const PROJECTS_TITLE: Wording[] = [
    (w) => `Réalisations liées à ${w.name}`,
    (w) => `Des projets menés pour ${w.name}`,
]

export const NEARBY_TITLE: Wording[] = [
    (w) => `J'interviens aussi ${w.around}`,
    (w) => `Autour ${w.of}`,
    () => `Les communes voisines`,
]

export const NEARBY: Wording[] = [
    (w) => w.neighbours ? `Je travaille aussi avec les entreprises des communes proches ${w.of}, comme ${w.neighbours}.` : `Je travaille aussi avec les entreprises des communes voisines.`,
    (w) => w.neighbours ? `${capitalize(w.neighbours)} : les entreprises de ces communes voisines peuvent bénéficier du même accompagnement.` : `Les entreprises des communes voisines bénéficient du même accompagnement.`,
    (w) => `Les communes proches ${w.of}${w.neighbours ? `, notamment ${w.neighbours},` : ''} font partie de ma zone d'intervention.`,
]

export const NEARBY_LINKS: Wording[] = [
    () => `Autres pages de ville :`,
    () => `Voir aussi :`,
]

export const FAQ_TITLE: Wording[] = [
    (w) => `Questions fréquentes sur la création de site ${w.at}`,
    (w) => `Vos questions sur votre site ${w.at}`,
    () => `Questions fréquentes`,
]

export const CTA_TITLE: Wording[] = [
    (w) => `Parlons de votre site ${w.at}`,
    () => `Un projet de site ? Parlons-en`,
    (w) => `Votre entreprise ${w.of} mérite un bon site`,
]

export const CTA: Wording[] = [
    () => `Réservez un créneau d'appel ou de visio en ligne, ou écrivez-moi : je vous réponds rapidement.`,
    () => `Le plus simple : choisissez un créneau dans mon agenda en ligne, et nous faisons le point sur votre projet.`,
    (w) => `Expliquez-moi votre activité ${w.at} et ce que vous attendez de votre site : un appel suffit pour savoir comment avancer.`,
]

// Questions worked out from the data of the city (travel, sectors, towns around), several wordings each
export const DATA_FAQ: { id: string, variants: ((w: CityWords, mode: 'near' | 'far' | 'paris' | 'base') => CityFaqEntry | null)[] }[] = [
    {
        id: 'travel',
        variants: [
            (w, mode) => mode === 'base' ? { q: `Êtes-vous vraiment installé ${w.at} ?`, a: `Oui, je travaille ${w.at} : un rendez-vous dans vos locaux est simple à organiser, tout comme un échange en visio.` }
                : !w.km ? null
                    : { q: `Vous déplacez-vous ${w.at} ?`, a: mode === 'near'
                        ? `Oui. ${capitalize(w.at)} est à environ ${w.time} de route de ${w.base} (${w.km}) : je peux venir pour le premier rendez-vous ou la remise du site, le reste se fait souvent en visio.`
                        : `Le projet se mène surtout en visio : ${w.name} est à ${w.km} de ${w.base}, environ ${w.time} de route. Un déplacement reste possible pour un moment clé du projet.` },
            (w, mode) => mode === 'base' ? { q: `Peut-on se rencontrer ${w.at} ?`, a: `Bien sûr, c'est là que je suis installé. Nous pouvons nous voir chez vous ou échanger en visio, comme vous préférez.` }
                : !w.km ? null
                    : { q: `Faut-il se rencontrer pour créer un site ${w.at} ?`, a: mode === 'near'
                        ? `Ce n'est pas obligatoire, mais c'est possible : environ ${w.time} de route me séparent de ${w.name}. Beaucoup de clients choisissent pourtant la visio, plus souple.`
                        : `Non : avec ${w.km} entre ${w.base} et ${w.name}, tout se fait très bien à distance, en visio et par e-mail, avec un site de test pour suivre l'avancement.` },
        ],
    },
    {
        id: 'sectors',
        variants: [
            (w) => w.sectors ? { q: `Travaillez-vous avec les entreprises de mon secteur ${w.at} ?`, a: `Oui. ${capitalize(w.at)}, les secteurs les plus présents sont ${w.sectors}. Chaque site est construit pour le métier de son client : vitrine, réservation, vente en ligne ou outil sur mesure.` } : null,
            (w) => w.sectorsOf ? { q: `Mon activité relève ${w.sectorsOf.split(', ')[0]?.split(' et ')[0]} ${w.at} : quel site me conseillez-vous ?`, a: `Tout dépend de ce que vos clients doivent pouvoir faire : vous appeler, réserver, acheter ou demander un devis. Nous le définissons ensemble au premier échange, puis je vous propose une maquette.` } : null,
        ],
    },
    {
        id: 'around',
        variants: [
            (w) => w.neighbours ? { q: `Intervenez-vous aussi ${w.around} ?`, a: `Oui, les communes voisines comme ${w.neighbours} font partie de ma zone d'intervention, dans les mêmes conditions.` } : null,
            (w) => w.neighbours ? { q: `Mon entreprise n'est pas ${w.at} mais à côté, est-ce un problème ?`, a: `Pas du tout : les communes proches ${w.of}, comme ${w.neighbours}, sont dans ma zone, sur place ou en visio.` } : null,
        ],
    },
]
