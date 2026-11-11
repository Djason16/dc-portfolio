<p align="center"><img src="../assets/docs-fr.png" alt="Documentation" width="100%" /></p>

# 05 — L'API

**DOC-05** &nbsp;·&nbsp; [← Documentation](README.md)

L'API tourne dans le même serveur Nuxt que le site, sous `/api`. Elle est organisée comme un back end
[DC Scaffold](https://github.com/Djason16/dc-scaffold) : contrôleurs, helpers et routes REST automatiques.

## 01 — Format des réponses

```js
{ "success": true, ...donnees }                                 // ex. { "success": true, "clients": [...] }
{ "success": false, "error": "message", "type": "NOT_FOUND" }   // avec le bon statut HTTP (400, 401, 404, 429, 500...)
```

Côté site, chaque appel passe par `utils/api.ts` (`api.get('/clients')`, `api.post(...)`...).
Il ne lève jamais d'erreur et renvoie toujours ce format.
Les messages d'erreur affichés au visiteur sont des clés de traduction (ex. `invalidCredentials`).

## 02 — Ajouter une route

Crée `server/controllers/ProductsController.ts`. Ses méthodes deviennent des routes toutes seules
(relance `npm run dev` si le fichier est nouveau) :

| Méthode | Route |
| ------- | ----- |
| `getAll` | `GET /api/products` |
| `getOne` | `GET /api/products/{id}` |
| `create` | `POST /api/products` |
| `update` | `PUT` / `PATCH /api/products/{id}` |
| `delete` | `DELETE /api/products/{id}` |

```js
export default class ProductsController extends Controller {
    static publicActions = ['getAll']                               // toutes les autres routes demandent la session admin
    static routes = { markShipped: ['POST', '/{id}/mark-shipped'] } // routes que le nommage REST ne peut pas deviner

    async getAll(event) {
        return ResponseHelper.success(event, { products: await this.fetchAll('SELECT * FROM products') })
    }

    async create(event) {
        const data = await this.body(event)
        const missing = RequestHelper.missing(data, ['name'])
        if (missing.length) return ResponseHelper.validationError(event, `Missing fields: ${missing.join(', ')}`)
        const id = DatabaseHelper.newId()
        await this.insert('INSERT INTO products (id, name) VALUES (?, ?)', [id, data.name])
        return ResponseHelper.success(event, { id }, 201)
    }
}
```

Les helpers de `server/utils/` (base de DC Scaffold) et de `server/helpers/` (ceux du site) sont importés automatiquement partout dans `server/`.

## 03 — Base de données

MySQL avec `mysql2` (`server/utils/DatabaseHelper.ts`), avec les valeurs `DB_*` du `.env` ([Configuration](02-configuration.md)).
En local, elle tourne dans Docker (`docker-compose.yml`, lancé par `start.bat` → `D`) ; en ligne, c'est la base MySQL d'Infomaniak,
séparée des fichiers du site : une nouvelle mise en ligne n'y touche jamais.

- **Voir et modifier les données** : phpMyAdmin, http://localhost:8081 en local, depuis le Manager Infomaniak en ligne
- **Tables** : `server/helpers/DatabaseSchema.ts` (`CREATE TABLE IF NOT EXISTS`, sans risque sur une base existante)
- **Lignes par défaut et compte admin** : `server/plugins/init-database.ts`, lancé à chaque démarrage
- **Images des projets** : gardées dans la table `dc_uploads` (pas en fichiers), servies par `/api/upload/images/{name}`. L'admin les envoie en WebP (1920 px au plus) avec une miniature de 640 px pour la grille de l'accueil (`thumb-{name}`, supprimée avec la photo) ; une photo envoyée avant les miniatures s'affiche en entier
- **Modifier une table existante** demande son propre `ALTER TABLE` : ne supprime ou ne recrée jamais une table qui contient des données
- **Sauvegardes** : export depuis phpMyAdmin ; en ligne, Infomaniak garde aussi des sauvegardes automatiques

## 04 — Toutes les routes

🔓 = publique. Toutes les autres routes demandent la session admin (`401` sinon).

| Ressource | Routes |
| --------- | ------ |
| API | 🔓 `GET /api` |
| Auth | 🔓 `GET /api/auth/check-session`, 🔓 `POST /api/auth/login`, 🔓 `POST /api/auth/verify-otp`, 🔓 `POST /api/auth/logout`, 🔓 `POST /api/auth/send-temp-password`, `POST /api/auth/update-password` |
| Clients | `GET /api/clients`, `POST /api/clients`, `PUT /api/clients/{id}`, `DELETE /api/clients/{id}` |
| Missions | `GET /api/missions`, `POST /api/missions`, `PUT /api/missions/{id}`, `DELETE /api/missions/{id}` |
| Services | `GET /api/services` |
| Taux d'intérêt | `GET /api/interest-rates`, `POST /api/interest-rates`, `PUT /api/interest-rates/{id}`, `DELETE /api/interest-rates/{id}` |
| Projets | 🔓 `GET /api/projects`, `POST /api/projects` (multipart), `PUT /api/projects/{id}`, `POST /api/projects/{id}/image`, `DELETE /api/projects/{id}` |
| Compétences | 🔓 `GET /api/skills`, `POST /api/skills`, `PUT /api/skills/{id}`, `DELETE /api/skills/{id}` |
| Versions | 🔓 `GET /api/versions` (`{ versions: { dc_skills: 4, ... } }` : les tables des pages publiques pour un visiteur, toutes les tables pour l'admin) |
| Traduction | `POST /api/translate` (`{ text, from: 'fr', to: ['en'] }`, MyMemory : `server/helpers/TranslateHelper.ts`) |
| Calendrier | 🔓 `GET /api/calendar`, `PUT` / `PATCH /api/calendar/{id}`, `POST /api/calendar/send-agenda` |
| Indisponibilités | 🔓 `GET /api/unavailability`, `POST /api/unavailability`, `PUT /api/unavailability/{id}`, `DELETE /api/unavailability/{id}` |
| Disponibilité | 🔓 `GET /api/availability`, `PUT /api/availability/toggle` |
| Banque | `GET /api/bank` |
| Environnement | `GET /api/env`, `PUT /api/env` |
| Mes infos | 🔓 `GET /api/settings` (public : `age` à la place de la date de naissance, sans `numbering` ; l'admin reçoit les deux), `PUT /api/settings`, `POST /api/settings/photo`, `DELETE /api/settings/photo` |
| Devis & factures | `GET /api/documents`, `POST /api/documents`, `PUT /api/documents/{id}`, `DELETE /api/documents/{id}` (brouillon), `POST /api/documents/{id}/finalize`, `POST /api/documents/{id}/status`, `POST /api/documents/{id}/duplicate`, `POST /api/documents/{id}/invoice`, `POST /api/documents/{id}/payments`, `POST /api/documents/{id}/pay-link`, `POST /api/documents/{id}/autopay-stop`, `DELETE /api/documents/{id}/payments/{paymentId}` |
| Rétractation | `POST /api/withdrawals` (public, 5 par heure et par adresse), `GET /api/withdrawals` |
| Réservations | 🔓 `GET /api/bookings/slots?type=&from=&to=` (débuts libres en UTC), 🔓 `POST /api/bookings` (`{ typeId, start, name, email, phone, message, language, timezone }`, 5 par heure et par adresse), 🔓 `GET` / `POST /api/bookings/cancel/{token}`, `GET /api/bookings`, `POST /api/bookings/{id}/cancel` |
| Salon visio | 🔓 `GET /api/rooms/{token}` (le rendez-vous, l'état du salon, les serveurs ICE quand il est ouvert), 🔓 `POST /api/rooms/{token}/join` (`{ peer }`), 🔓 `GET /api/rooms/{token}/signals?peer=&after=`, 🔓 `POST /api/rooms/{token}/signals` (`{ peer, kind, payload, target }`, `kind` : `offer` (hôte), `answer` (visiteur), `candidates`, `leave`) ; le jeton du lien dit le côté ; 300 requêtes par minute et par adresse, 20 jetons faux en 10 min bloquent l'adresse 15 min |
| Salon visio personnel | 🔓 `GET /api/lounge` (ouvert, hôte présent, en appel, prénom), 🔓 `POST /api/lounge/knocks` (`{ name }` → `{ token }` ; 5 demandes par 10 min et 2 en attente par adresse, 403 si fermé), 🔓 `GET /api/lounge/knocks/{token}` (statut : `waiting`, `accepted` avec les serveurs ICE, `refused`, `cancelled`, `expired`, `closed`, `ended`), 🔓 `POST /api/lounge/knocks/{token}/cancel`, 🔓 `POST /api/lounge/knocks/{token}/end`, `GET /api/lounge/host` (l'hôte est là, les demandes, l'appel en cours), `POST /api/lounge/knocks/{token}/accept` (409 si un appel est déjà en cours), `POST /api/lounge/knocks/{token}/refuse`, `PUT /api/lounge/open` (`{ open }`) ; mise en relation comme le salon des rendez-vous : 🔓 `POST /api/lounge/calls/{token}/{host\|guest}/join`, 🔓 `GET\|POST /api/lounge/calls/{token}/{host\|guest}/signals`, seulement pour une demande acceptée, côté `host` avec la session admin |
| Types de rendez-vous | 🔓 `GET /api/booking-types` (les actifs et les règles de la page), `GET /api/booking-types/all`, `POST /api/booking-types`, `PUT /api/booking-types/{id}`, `DELETE /api/booking-types/{id}` |
| Règles des réservations | `GET /api/booking-settings`, `PUT /api/booking-settings` (`{ enabled, noticeHours, horizonDays, bufferMinutes, stepMinutes }`) |
| Textes du site | 🔓 `GET /api/texts`, `PUT /api/texts` (`{ lang, key, value }`, vide = texte d'origine) |
| Stripe | 🔓 `GET /api/stripe/document?token=` (lien de paiement), 🔓 `POST /api/stripe/webhook` (signé par Stripe), 🔓 `POST /api/stripe/create-checkout` (`{ token, email }` pour un lien de paiement), 🔓 `POST /api/stripe/create-subscription`, 🔓 `GET /api/stripe/check-payment`, 🔓 `GET /api/stripe/check-subscription`, 🔓 `GET /api/stripe/payment-result`, 🔓 `GET /api/stripe/subscription-result` |
| Fichiers envoyés | 🔓 `GET /api/upload/images/{file}` |

---

<p align="center"><sub><a href="04-le-site.md">← 04 — Le site</a> &nbsp;·&nbsp; <a href="README.md">Documentation</a> &nbsp;·&nbsp; <a href="06-documents-admin.md">06 — L'admin et les documents →</a></sub></p>
