import type { City, CitySector } from './cityTypes'

/*
 * Sectors of activity of the NAF (sections A to U of INSEE), as counted for each city by the Annuaire des entreprises:
 * their names in a sentence, and what a website brings to each one (two wordings each, one picked per city).
 * Only the sections below can be "a big sector of the city" on its page (not the public administration, the households
 * or the energy networks).
 */
type SectorText = {
    // Font Awesome icon of its card
    icon: string
    // "le commerce" / "du commerce": in a sentence
    label: string
    of: string
    // Search words of the sector, with the city after them (keywords of the page)
    keyword: string
    // Title of its block (h3)
    title: string
    advice: ((inCity: string) => string)[]
}

const SECTORS: Record<string, SectorText> = {
    A: {
        icon: 'fa-solid fa-seedling',
        label: "l'agriculture", of: "de l'agriculture", keyword: 'site internet producteur local', title: 'Agriculteurs et producteurs',
        advice: [
            (at) => `Vente directe, cueillette, paniers : un site simple avec vos produits, vos horaires et un formulaire de commande aide les habitants ${at} et autour à vous trouver sans passer par une plateforme.`,
            (at) => `Pour une exploitation, le site sert surtout à dire quoi, où et quand : produits de saison, jours de vente à la ferme ou sur les marchés ${at}, et un moyen simple de réserver.`,
        ],
    },
    C: {
        icon: 'fa-solid fa-industry',
        label: "l'industrie", of: "de l'industrie", keyword: 'site internet entreprise industrielle', title: 'Industrie et fabrication',
        advice: [
            (at) => `Un industriel ${at} est souvent cherché par des acheteurs et des candidats : un site clair sur les savoir-faire, les machines et les certifications rassure les uns et attire les autres.`,
            () => `Pour une entreprise de fabrication, le site devient une fiche technique vivante : capacités, matériaux, délais, demande de devis, et une page recrutement que l'on met à jour soi-même.`,
        ],
    },
    F: {
        icon: 'fa-solid fa-helmet-safety',
        label: 'le bâtiment', of: 'du bâtiment', keyword: 'site internet artisan', title: 'Artisans du bâtiment',
        advice: [
            (at) => `Un artisan du bâtiment ${at} gagne à montrer ses chantiers en photos, sa zone d'intervention et ses qualifications, avec un formulaire de demande de devis qui arrive directement dans sa boîte.`,
            () => `Maçon, plombier, électricien, couvreur : les clients comparent avant d'appeler. Des réalisations avant / après, des avis et un numéro bien visible sur téléphone font souvent la différence.`,
        ],
    },
    G: {
        icon: 'fa-solid fa-store',
        label: 'le commerce', of: 'du commerce', keyword: 'site internet commerce', title: 'Commerces',
        advice: [
            (at) => `Pour un commerce ${at}, le site complète la vitrine de la rue : horaires à jour, produits phares, retrait en boutique ou vente en ligne, et une fiche Google qui renvoie vers lui.`,
            () => `Boutique, garage ou commerce de gros : un catalogue en ligne, même petit, et la possibilité de réserver ou de payer en ligne évitent bien des appels et font venir de nouveaux clients.`,
        ],
    },
    H: {
        icon: 'fa-solid fa-truck',
        label: 'le transport', of: 'du transport', keyword: 'site internet transporteur', title: 'Transport et logistique',
        advice: [
            () => `Transporteurs, taxis, déménageurs : un site rapide sur téléphone, avec les trajets, les tarifs indicatifs si vous le souhaitez et une demande de devis ou de réservation, suffit souvent à remplir le planning.`,
            (at) => `Pour une entreprise de transport ${at}, le site doit rassurer vite : flotte, zones desservies, assurances, contact direct, et un formulaire qui recueille les bonnes informations dès la première demande.`,
        ],
    },
    I: {
        icon: 'fa-solid fa-utensils',
        label: "l'hôtellerie-restauration", of: "de l'hôtellerie-restauration", keyword: 'site internet restaurant', title: 'Restaurants et hébergements',
        advice: [
            (at) => `Un restaurant ou un hôtel ${at} est choisi sur téléphone : menu lisible, photos légères, réservation en quelques gestes et informations pratiques (accès, stationnement) en évidence.`,
            () => `Pour la restauration et l'hébergement, réserver directement sur votre site plutôt que par une plateforme vous laisse la relation avec le client et évite une partie des commissions.`,
        ],
    },
    J: {
        icon: 'fa-solid fa-laptop-code',
        label: 'le numérique', of: 'du numérique', keyword: 'site internet entreprise numérique', title: 'Informatique et communication',
        advice: [
            () => `Dans les métiers du numérique, le site est votre carte de visite technique : il doit être rapide, propre et à jour, car vos clients savent reconnaître un travail soigné.`,
            (at) => `Studios, agences ou indépendants du numérique ${at} : un portfolio bien construit, des études de cas et un tunnel de prise de contact simple valent mieux qu'une longue liste de services.`,
        ],
    },
    K: {
        icon: 'fa-solid fa-building-columns',
        label: 'la banque-assurance', of: 'de la banque-assurance', keyword: 'site internet courtier assurance', title: 'Finance et assurance',
        advice: [
            () => `Courtiers, agents et conseillers : la confiance passe par un site sobre, sécurisé, avec les mentions obligatoires, une prise de rendez-vous en ligne et des pages qui répondent aux questions fréquentes.`,
            (at) => `Pour un cabinet de conseil financier ${at}, un site rapide et clair, des formulaires protégés et une prise de rendez-vous en visio ou au bureau facilitent le premier contact.`,
        ],
    },
    L: {
        icon: 'fa-solid fa-house',
        label: "l'immobilier", of: "de l'immobilier", keyword: 'site internet agence immobilière', title: 'Immobilier',
        advice: [
            (at) => `Une agence ou un gestionnaire ${at} vit de ses annonces : fiches de biens bien référencées, photos optimisées, recherche par critères et alertes pour les acheteurs.`,
            () => `Dans l'immobilier, un site rapide sur téléphone avec vos biens, vos estimations et une prise de rendez-vous en ligne transforme mieux les visites que les seuls portails d'annonces.`,
        ],
    },
    M: {
        icon: 'fa-solid fa-briefcase',
        label: 'les professions de conseil', of: 'des professions de conseil', keyword: 'site internet profession libérale', title: 'Conseil, bureaux d\'études, professions libérales',
        advice: [
            (at) => `Avocats, experts-comptables, architectes, bureaux d'études ${at} : un site clair sur vos domaines, vos méthodes et vos références aide les bons clients à vous choisir avant même le premier rendez-vous.`,
            () => `Pour une activité de conseil ou d'expertise, quelques articles utiles et une prise de rendez-vous en ligne montrent votre savoir-faire mieux qu'une plaquette, et vous font trouver sur Google.`,
        ],
    },
    N: {
        icon: 'fa-solid fa-handshake',
        label: 'les services aux entreprises', of: 'des services aux entreprises', keyword: 'site internet entreprise de services', title: 'Services aux entreprises',
        advice: [
            () => `Nettoyage, sécurité, intérim, location de matériel : vos clients veulent savoir vite ce que vous faites, où, et comment vous contacter. Un site net avec une demande de devis structurée fait gagner du temps aux deux côtés.`,
            (at) => `Pour une entreprise de services ${at}, des pages par prestation et par secteur servi, avec des formulaires adaptés, apportent des demandes plus précises et plus faciles à chiffrer.`,
        ],
    },
    P: {
        icon: 'fa-solid fa-graduation-cap',
        label: 'la formation', of: 'de la formation', keyword: 'site internet organisme de formation', title: 'Enseignement et formation',
        advice: [
            () => `Organismes de formation, auto-écoles, cours particuliers : un calendrier des sessions, les programmes et une inscription en ligne simplifient la vie des élèves comme la vôtre.`,
            (at) => `Pour former ${at}, le site doit présenter clairement les parcours, les prix si vous les affichez, les financements possibles et les prochaines dates, avec une inscription ou une demande d'information en ligne.`,
        ],
    },
    Q: {
        icon: 'fa-solid fa-stethoscope',
        label: 'la santé', of: 'de la santé', keyword: 'site internet cabinet santé', title: 'Santé et action sociale',
        advice: [
            (at) => `Cabinets, praticiens et structures d'accompagnement ${at} : un site accessible, lisible par tous, avec vos horaires, l'accès au cabinet et un lien de prise de rendez-vous, répond déjà à la plupart des appels.`,
            () => `Dans la santé, la sobriété et l'accessibilité comptent : textes clairs, bon contraste, pages lisibles par les lecteurs d'écran, et aucune donnée de santé collectée sans nécessité.`,
        ],
    },
    R: {
        icon: 'fa-solid fa-masks-theater',
        label: 'les loisirs', of: 'des loisirs', keyword: 'site internet association loisirs', title: 'Culture, sport et loisirs',
        advice: [
            (at) => `Clubs, salles, compagnies et lieux culturels ${at} : un agenda à jour, la billetterie ou les inscriptions en ligne et des photos qui donnent envie font vivre votre activité toute l'année.`,
            () => `Pour une activité de loisirs, un site facile à mettre à jour vous-même (événements, horaires, actualités) évite qu'il vieillisse et garde votre public informé.`,
        ],
    },
    S: {
        icon: 'fa-solid fa-scissors',
        label: 'les services de proximité', of: 'des services de proximité', keyword: 'site internet coiffeur artisan', title: 'Services de proximité et associations',
        advice: [
            (at) => `Coiffeurs, instituts, réparateurs, associations ${at} : un site léger avec vos services, vos tarifs si vous le souhaitez et une réservation en ligne remplace avantageusement une simple page sur les réseaux sociaux.`,
            () => `Pour un service de proximité, l'essentiel est d'être trouvé au bon moment : fiche Google à jour, site rapide sur téléphone, bouton d'appel et prise de rendez-vous en ligne.`,
        ],
    },
}

// Sections that can be named as a big sector of the city (the others are left out of the rankings). Real estate (L) is
// left out too: most of its companies are property holding companies (SCI), first almost everywhere, not businesses
const RANKED = Object.keys(SECTORS).filter(section => section !== 'L')

export const sectorLabel = (section: string) => SECTORS[section]?.label ?? ''
export const sectorOf = (section: string) => SECTORS[section]?.of ?? ''
export const sectorIcon = (section: string) => SECTORS[section]?.icon ?? ''
export const sectorKeyword = (section: string) => SECTORS[section]?.keyword ?? ''
export const sectorTitle = (section: string) => SECTORS[section]?.title ?? ''
export const sectorAdvice = (section: string, variant: number, inCityText: string) => {
    const options = SECTORS[section]?.advice ?? []
    return options.length ? (options[variant % options.length] as (at: string) => string)(inCityText) : ''
}

// The biggest sectors of the city (most companies first), only the ones with a text. None when the Annuaire stopped
// counting at its limit (Paris): the sectors at the limit cannot be ranked
export const topSectors = (city: Pick<City, 'sectors' | 'companies_capped'>, count: number): CitySector[] => city.companies_capped ? [] :
    [...(city.sectors || [])].filter(sector => RANKED.includes(sector.section) && sector.count > 0)
        .sort((a, b) => b.count - a.count).slice(0, count)

// Every NAF section asked to the Annuaire des entreprises
export const NAF_SECTIONS = 'ABCDEFGHIJKLMNOPQRSTU'.split('')
