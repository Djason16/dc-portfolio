import type { CityWords } from './cityText'
import { capitalize } from './cityText'

/*
 * Wordings of the middle of a city page: what is made (services), how (method) and where we meet (travel).
 * Several wordings per paragraph, one picked per city (cityPage.ts).
 */
type Wording = (w: CityWords) => string

export const OFFER_TITLE: Wording[] = [
    (w) => `Sites vitrines, boutiques en ligne et applications ${w.at}`,
    () => `Ce que je peux réaliser pour votre entreprise`,
    (w) => `Mes services de création de site ${w.at}`,
    (w) => `Un site sur mesure pour votre activité ${w.at}`,
]

export const OFFER: Wording[] = [
    (w) => `Chaque site est développé sur mesure, sans thème acheté ni constructeur en ligne : vous obtenez un site léger, sécurisé, pensé pour votre clientèle ${w.of} et dont vous restez propriétaire.`,
    (w) => `Pas de modèle tout fait : je pars de votre activité, de vos clients ${w.at} et de ce que vous voulez qu'ils fassent sur le site (appeler, réserver, acheter, demander un devis), puis je construis le site autour de cela.`,
    () => `Je code moi-même chaque site, du design à l'hébergement. Résultat : des pages qui s'affichent vite, y compris sur un vieux téléphone, un référencement soigné dès le départ et un seul interlocuteur du début à la fin.`,
    (w) => `Que vous lanciez votre activité ${w.at} ou que votre site actuel ait vieilli, je vous propose un site développé sur mesure : rapide, lisible sur tous les écrans, et facile à mettre à jour vous-même.`,
]

// What a site can be: one h3 each, two wordings each, four shown per city in an order of its own
export const SERVICES: { id: string, icon: string, title: string[], text: Wording[] }[] = [
    {
        id: 'showcase', icon: 'fa-solid fa-display', title: ['Site vitrine', 'Site de présentation'],
        text: [
            () => `Vos services, vos réalisations, vos horaires et un formulaire de contact, sur un site rapide et bien référencé.`,
            (w) => `Quelques pages soignées pour présenter votre activité ${w.at} et donner envie de vous contacter.`,
        ],
    },
    {
        id: 'shop', icon: 'fa-solid fa-cart-shopping', title: ['Boutique en ligne', 'Vente en ligne'],
        text: [
            () => `Catalogue, panier, paiement sécurisé par carte avec Stripe, retrait en magasin ou livraison : vous vendez aussi quand la boutique est fermée.`,
            () => `Un catalogue clair et un paiement en ligne sécurisé, sans commission de plateforme sur chaque vente.`,
        ],
    },
    {
        id: 'booking', icon: 'fa-solid fa-calendar-check', title: ['Réservation et paiement en ligne', 'Prise de rendez-vous en ligne'],
        text: [
            () => `Vos clients réservent un créneau ou une prestation et paient un acompte en ligne, la confirmation part par e-mail.`,
            () => `Un agenda en ligne relié à vos disponibilités : moins d'appels pour fixer un rendez-vous, moins d'oublis.`,
        ],
    },
    {
        id: 'app', icon: 'fa-solid fa-gears', title: ['Application web sur mesure', 'Outil de gestion sur mesure'],
        text: [
            () => `Devis, factures, espace client, suivi de dossiers : un outil fait pour votre façon de travailler, accessible depuis n'importe quel écran.`,
            () => `Quand un tableur ne suffit plus, une application web simple fait gagner des heures chaque semaine.`,
        ],
    },
    {
        id: 'seo', icon: 'fa-solid fa-magnifying-glass-chart', title: ['Référencement naturel', 'SEO et visibilité sur Google'],
        text: [
            (w) => `Structure des pages, vitesse, balises, données structurées et contenus pensés pour les recherches faites ${w.at}.`,
            () => `Un site techniquement propre, rapide et bien balisé : la base pour remonter sur Google sans payer chaque clic.`,
        ],
    },
    {
        id: 'care', icon: 'fa-solid fa-shield-halved', title: ['Maintenance et hébergement', 'Suivi après la mise en ligne'],
        text: [
            () => `Mises à jour, sauvegardes, surveillance et hébergement sécurisé : la maintenance est comprise dans mon offre web.`,
            () => `Le site ne s'arrête pas le jour de la mise en ligne : je le surveille, le sauvegarde et le tiens à jour.`,
        ],
    },
]

export const METHOD_TITLE: Wording[] = [
    () => `Comment se passe la création de votre site`,
    (w) => `Les étapes de votre projet ${w.at}`,
    () => `Une méthode simple, en quatre temps`,
]

export const METHOD: Wording[][] = [
    [
        (w) => `Tout commence par un échange, en visio, au téléphone ou ${w.at} si la distance le permet : votre activité, vos clients, vos objectifs.`,
        () => `Je vous propose ensuite une maquette et un devis clair. Le développement ne commence qu'une fois la maquette validée.`,
        () => `Vous suivez l'avancement et testez le site avant sa mise en ligne, puis je reste votre contact pour la suite.`,
    ],
    [
        () => `Premier temps : comprendre ce que vous faites et ce que vos clients cherchent. Deuxième temps : une maquette que l'on ajuste ensemble.`,
        (w) => `Troisième temps : le développement, la rédaction et le référencement des pages, avec une attention particulière aux recherches locales ${w.at}.`,
        () => `Dernier temps : la mise en ligne, les derniers réglages et le suivi.`,
    ],
    [
        (w) => `Pour une entreprise ${w.of}, un projet de site suit un chemin court : un appel pour cadrer, une maquette, le développement, puis la mise en ligne.`,
        () => `À chaque étape, vous validez avant que l'on passe à la suivante, et vous savez toujours où en est votre site.`,
    ],
    [
        () => `Pas de jargon ni de surprise : on définit ensemble le contenu et les fonctions du site, je vous montre une maquette, puis je développe.`,
        (w) => `Le site est testé sur ordinateur, tablette et téléphone avant d'être mis en ligne, et je vous montre comment le faire vivre ${w.at} au quotidien.`,
    ],
]

// Meetings: in person (close enough), at a distance (far, or Paris), or on the page of the base town itself
export const TRAVEL_TITLE: Record<'near' | 'far' | 'paris' | 'base', Wording[]> = {
    near: [
        (w) => `Rendez-vous ${w.at} ou en visio`,
        (w) => `Je me déplace ${w.at}`,
        (w) => `${w.name}, à ${w.km} de ${w.base}`,
    ],
    far: [
        (w) => `Travailler ensemble à distance depuis ${w.name}`,
        () => `Un accompagnement à distance, sans perte de qualité`,
        (w) => `De ${w.base} à ${w.name}, en visio`,
    ],
    paris: [
        () => `Votre site à Paris, piloté à distance`,
        () => `Entreprises parisiennes : un projet mené en visio`,
    ],
    base: [
        (w) => `Ici, ${w.at}`,
        (w) => `Un développeur web ${w.at} même`,
    ],
}

export const TRAVEL: Record<'near' | 'far' | 'paris' | 'base', Wording[]> = {
    near: [
        (w) => w.km ? `${capitalize(w.at)}, vous êtes à ${w.km} de mon bureau ${w.from}, soit environ ${w.time} de route. Je peux donc venir vous rencontrer pour le premier rendez-vous ou pour la remise du site ; le reste du projet avance très bien en visio.` : '',
        (w) => w.km ? `Environ ${w.time} de route séparent ${w.base} de ${w.name} (${w.km}) : je me déplace volontiers pour un premier échange dans vos locaux, puis nous avançons au rythme qui vous convient, sur place ou à distance.` : '',
        (w) => w.km ? `Avec ${w.km} à parcourir depuis ${w.base}, environ ${w.time} en voiture, un rendez-vous ${w.at} est facile à organiser. Beaucoup de clients préfèrent pourtant la visio, plus rapide à caler : à vous de choisir.` : '',
        (w) => w.km ? `${capitalize(w.at)}, à environ ${w.time} de ${w.base}, je peux venir voir votre commerce ou votre atelier : c'est souvent la meilleure façon de comprendre une activité avant de construire son site.` : '',
    ],
    far: [
        (w) => w.km ? `${capitalize(w.at)}, à ${w.km} de ${w.base} (environ ${w.time} de route), les rendez-vous se font en visio ou par téléphone. Partage d'écran, maquettes en ligne et site de test : vous suivez tout le projet sans vous déplacer.` : '',
        (w) => w.km ? `La distance (environ ${w.time} depuis ${w.base}) n'est pas un frein : la plupart de mes projets se mènent entièrement à distance, avec des points réguliers en visio et un site de test que vous consultez quand vous voulez.` : '',
        (w) => `Pour les entreprises ${w.of}, je travaille principalement à distance : un appel pour démarrer, des échanges en visio à chaque étape, et un déplacement possible pour un moment important du projet si besoin.`,
    ],
    paris: [
        (w) => `À Paris, le temps est précieux : nous travaillons en visio, sur des créneaux courts réservés en ligne, et vous testez chaque étape sur un site de démonstration. Je reste installé ${w.from}, à ${w.km || 'quelques dizaines de kilomètres'}${w.time ? ` (environ ${w.time} de route)` : ''}, et je peux me déplacer pour un rendez-vous important.`,
        (w) => `Pour une entreprise parisienne, tout le projet peut se mener à distance : visio, partage d'écran, validation en ligne des maquettes. Installé ${w.from}${w.km ? `, à ${w.km} de la capitale` : ''}, je propose un accompagnement direct, sans intermédiaire d'agence.`,
    ],
    base: [
        (w) => `C'est ${w.at} que je travaille au quotidien. Pour une entreprise de la commune, un rendez-vous se cale très facilement, dans vos locaux ou autour d'un café, et le suivi peut se faire en face à face.`,
        (w) => `Installé ${w.at}, je connais bien le secteur : un rendez-vous de lancement chez vous, puis des points réguliers en direct ou en visio, selon ce qui vous arrange.`,
    ],
}
