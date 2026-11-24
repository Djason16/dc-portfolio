import { DatabaseHelper } from '../utils/DatabaseHelper'
/*
 * Tables of the city pages (/creation-site-internet/<slug>/, server/controllers/CitiesController.ts), added to the tables
 * of DatabaseSchema.ts. No city is created here: the owner adds each one from admin > Villes. Only the shared questions
 * (dc_city_faqs) get default rows, the first time.
 */
export const CITY_TABLES = {
    // A city: its data fetched once from the public APIs (geo.api.gouv.fr, Annuaire des entreprises, OSRM) when it is added
    // or refreshed from the admin, never per visit; then what the admin chooses. JSON in neighbours, sectors, faq, projects.
    // meets_in_person: NULL = worked out from the drive time
    dc_cities: `
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        slug VARCHAR(140) NOT NULL UNIQUE,
        postal_code VARCHAR(10) NOT NULL DEFAULT '',
        insee_code VARCHAR(10) NOT NULL DEFAULT '',
        department_code VARCHAR(4) NOT NULL DEFAULT '',
        department_name VARCHAR(80) NOT NULL DEFAULT '',
        region_name VARCHAR(80) NOT NULL DEFAULT '',
        population INT NULL,
        surface_km2 DOUBLE NULL,
        lat DOUBLE NULL,
        lng DOUBLE NULL,
        base_town VARCHAR(120) NOT NULL DEFAULT '',
        distance_km DOUBLE NULL,
        drive_minutes INT NULL,
        travel_source VARCHAR(10) NOT NULL DEFAULT '',
        neighbours TEXT,
        companies_total INT NULL,
        companies_capped TINYINT NOT NULL DEFAULT 0,
        sectors TEXT,
        data_updated_at DATETIME NULL,
        data_error VARCHAR(255) NOT NULL DEFAULT '',
        published TINYINT NOT NULL DEFAULT 0,
        sort_order INT NOT NULL DEFAULT 0,
        meets_in_person TINYINT NULL,
        intro TEXT,
        faq TEXT,
        projects TEXT,
        keywords VARCHAR(500) NOT NULL DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
    // Questions shown on every city page: 2 or 3 wordings each (JSON [{ q, a }]) with {placeholders}, one picked per city
    dc_city_faqs: `
        id VARCHAR(64) PRIMARY KEY,
        variants TEXT NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        active TINYINT NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP`,
}

// Default shared questions (only general true statements; no price: the site shows none for the websites)
const FAQS: { q: string, a: string }[][] = [
    [
        { q: 'Combien de temps faut-il pour créer un site internet {a_ville} ?', a: "Un site vitrine prend en général quelques semaines, du premier échange à la mise en ligne ; une boutique en ligne ou un outil sur mesure demande plus de temps. Le planning précis figure dans le devis." },
        { q: 'Quel délai pour la mise en ligne de mon site ?', a: "Comptez quelques semaines pour un site vitrine, davantage pour un site avec vente ou réservation en ligne. Le délai dépend surtout du contenu à préparer : textes, photos, catalogue." },
        { q: 'Mon entreprise est {a_ville} : quand mon site peut-il être prêt ?', a: "Pour un site vitrine, quelques semaines suffisent le plus souvent. Nous fixons ensemble un calendrier réaliste dès le devis." },
    ],
    [
        { q: 'Combien coûte un site internet {a_ville} ?', a: "Le prix dépend du nombre de pages et des fonctions (réservation, paiement, espace client). Après un premier échange, vous recevez un devis détaillé, ligne par ligne." },
        { q: 'Comment est établi le prix de mon site ?', a: "Chaque site est chiffré sur mesure, selon ce qu'il doit faire. Le devis détaille chaque élément : vous savez exactement ce que vous payez avant de commencer." },
    ],
    [
        { q: 'Peut-on travailler ensemble entièrement en visio ?', a: "Oui. Rendez-vous en visio ou par téléphone, maquettes partagées en ligne et site de test : tout le projet peut se mener à distance, depuis {ville} comme d'ailleurs." },
        { q: 'Faut-il se déplacer pour les rendez-vous ?', a: "Non : un créneau d'appel ou de visio se réserve en ligne en quelques clics. Pour {ville}, une rencontre sur place peut aussi s'organiser selon le projet." },
    ],
    [
        { q: 'Mon site sera-t-il bien référencé sur Google {a_ville} ?', a: "Le site est construit pour le référencement dès le départ : pages rapides, titres et textes pensés pour les recherches locales, données structurées. Je vous aide aussi à compléter votre fiche Google Business Profile." },
        { q: 'Comment apparaître dans les recherches locales autour de {ville} ?', a: "Un site rapide et bien structuré, des pages qui citent clairement votre activité et votre zone ({dans_departement}), et une fiche d'établissement Google à jour : c'est la base du référencement local." },
    ],
    [
        { q: 'La maintenance du site est-elle comprise ?', a: "Oui, la maintenance est comprise dans mon offre web : mises à jour, sauvegardes et surveillance du site, sans supplément." },
        { q: 'Qui s’occupe du site après sa mise en ligne ?', a: "Je reste votre contact : la maintenance (mises à jour, sauvegardes, surveillance) est incluse dans l'offre web, et vous pouvez me solliciter pour faire évoluer le site." },
    ],
    [
        { q: "Vous occupez-vous de l'hébergement et du nom de domaine ?", a: "Oui, je peux m'occuper de l'hébergement sécurisé et du nom de domaine, ou travailler avec ceux que vous avez déjà. Le nom de domaine peut être enregistré à votre nom." },
        { q: 'Où sera hébergé mon site ?', a: "Chez un hébergeur sérieux, avec certificat HTTPS et sauvegardes. Si vous avez déjà un hébergement ou un nom de domaine, nous pouvons les garder." },
    ],
    [
        { q: 'Pourrai-je modifier mon site moi-même ?', a: "Oui, selon le projet : un espace d'administration permet de changer vos textes, photos, horaires ou produits sans connaissance technique, et je vous montre comment l'utiliser." },
        { q: 'Est-ce que je peux mettre à jour mes textes et mes photos ?', a: "C'est prévu dès la conception quand vous le souhaitez : vous gérez votre contenu depuis un espace d'administration simple, et je reste là pour les évolutions plus techniques." },
    ],
    [
        { q: 'Mon site sera-t-il adapté aux téléphones ?', a: "Oui. Chaque site est conçu d'abord pour le téléphone, testé jusqu'aux plus petits écrans, puis adapté à la tablette et à l'ordinateur." },
        { q: 'Le site fonctionnera-t-il bien sur mobile ?', a: "C'est une priorité : la plupart des recherches locales, {a_ville} comme ailleurs, se font sur téléphone. Le site est rapide et lisible sur tous les écrans." },
    ],
    [
        { q: "J'ai déjà un site : pouvez-vous le refaire ?", a: "Oui. Je reprends l'existant (contenus, adresses des pages, référencement acquis) pour construire un site plus rapide et plus moderne, sans perdre votre visibilité." },
        { q: 'Peut-on moderniser un site existant plutôt que repartir de zéro ?', a: "Selon l'état du site, une refonte complète ou une amélioration ciblée est possible. Dans tous les cas, les pages déjà bien placées sur Google sont conservées ou redirigées." },
    ],
    [
        { q: 'Peut-on payer ou réserver en ligne sur mon site ?', a: "Oui : paiement par carte sécurisé avec Stripe, acomptes, réservation de créneaux ou de prestations, selon ce dont votre activité a besoin." },
        { q: 'Mon site peut-il prendre des réservations ?', a: "Oui. Une prise de rendez-vous ou de réservation en ligne peut être intégrée, avec confirmation par e-mail et, si besoin, paiement d'un acompte." },
    ],
]

export const CITY_SEEDS = {
    dc_city_faqs: async () => {
        for (const [index, variants] of FAQS.entries())
            await DatabaseHelper.insert('INSERT INTO dc_city_faqs (id, variants, sort_order, active) VALUES (?, ?, ?, 1)',
                [DatabaseHelper.newId(), JSON.stringify(variants), index])
    },
}
