<p align="center"><img src="../assets/docs-en.png" alt="Documentation" width="100%" /></p>

# 05 — The API

**DOC-05** &nbsp;·&nbsp; [← Documentation](README.md)

The API runs in the same Nuxt server as the site, under `/api`. It is organized like a
[DC Scaffold](https://tools.djason-chery.dev/en/scaffold/) back end: controllers, helpers and automatic REST routes.

## 01 — Response format

```js
{ "success": true, ...data }                                    // e.g. { "success": true, "clients": [...] }
{ "success": false, "error": "message", "type": "NOT_FOUND" }   // with the right HTTP status (400, 401, 404, 429, 500...)
```

On the site, every call goes through `utils/api.ts` (`api.get('/clients')`, `api.post(...)`...).
It never throws and always resolves to this format.
Error messages shown to the visitor are translation keys (e.g. `invalidCredentials`).

## 02 — Adding a route

Create `server/controllers/ProductsController.ts`. Its methods become routes automatically
(restart `npm run dev` when the file is new):

| Method | Route |
| ------ | ----- |
| `getAll` | `GET /api/products` |
| `getOne` | `GET /api/products/{id}` |
| `create` | `POST /api/products` |
| `update` | `PUT` / `PATCH /api/products/{id}` |
| `delete` | `DELETE /api/products/{id}` |

```js
export default class ProductsController extends Controller {
    static publicActions = ['getAll']                               // every other route needs the admin session
    static routes = { markShipped: ['POST', '/{id}/mark-shipped'] } // routes the REST naming cannot guess

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

Helpers in `server/utils/` (base of DC Scaffold) and `server/helpers/` (those of the site) are imported automatically everywhere in `server/`.

## 03 — Database

MySQL through `mysql2` (`server/utils/DatabaseHelper.ts`), with the `DB_*` values of the `.env` file ([Configuration](02-configuration.md)).
Locally it runs in Docker (`docker-compose.yml`, started by `start.bat` → `D`); online it is the MySQL database of Infomaniak,
separate from the files of the site: a new deployment never touches it.

- **See and edit the data**: phpMyAdmin, http://localhost:8081 locally, from the Infomaniak Manager online
- **Tables**: `server/helpers/DatabaseSchema.ts` (`CREATE TABLE IF NOT EXISTS`, safe on an existing database)
- **Default rows and admin account**: `server/plugins/init-database.ts`, run on each start
- **Images of the projects**: stored in the `dc_uploads` table (not as files), served by `/api/upload/images/{name}`. The admin sends them in WebP (1920 px at most) with a 640 px thumbnail for the grid of the home page (`thumb-{name}`, deleted with the photo); a photo sent before the thumbnails is shown in full
- **Changing an existing table** needs its own `ALTER TABLE`: never drop or recreate a table that holds data
- **Backups**: online, DC Sentinel backs up the whole database every Sunday (images included, they are in `dc_uploads`) through `POST /api/backup` (`server/api/backup.ts`, see [Deployment](08-deployment.md#05--back-up-and-restore-the-database "Back up and restore the database")); Infomaniak also keeps automatic backups; locally, `start.bat` then `K` / `O`

## 04 — Every route

🔓 = public. Every other route needs the admin session (`401` otherwise).

| Resource | Routes |
| -------- | ------ |
| API | 🔓 `GET /api` |
| Auth | 🔓 `GET /api/auth/check-session`, 🔓 `POST /api/auth/login`, 🔓 `POST /api/auth/verify-otp`, 🔓 `POST /api/auth/logout`, 🔓 `POST /api/auth/send-temp-password`, `POST /api/auth/update-password` |
| Clients | `GET /api/clients`, `POST /api/clients`, `PUT /api/clients/{id}`, `DELETE /api/clients/{id}` |
| Missions | `GET /api/missions`, `POST /api/missions`, `PUT /api/missions/{id}`, `DELETE /api/missions/{id}` |
| Services | `GET /api/services` |
| Interest rates | `GET /api/interest-rates`, `POST /api/interest-rates`, `PUT /api/interest-rates/{id}`, `DELETE /api/interest-rates/{id}` |
| Projects | 🔓 `GET /api/projects`, `POST /api/projects` (multipart), `PUT /api/projects/{id}`, `POST /api/projects/{id}/image`, `DELETE /api/projects/{id}` |
| Skills | 🔓 `GET /api/skills`, `POST /api/skills`, `PUT /api/skills/{id}`, `DELETE /api/skills/{id}` |
| Versions | 🔓 `GET /api/versions` (`{ versions: { dc_skills: 4, ... } }`: the tables of the public pages for a visitor, every table for the admin) |
| Translation | `POST /api/translate` (`{ text, from: 'fr', to: ['en'] }`, MyMemory: `server/helpers/TranslateHelper.ts`) |
| Calendar | 🔓 `GET /api/calendar`, `PUT` / `PATCH /api/calendar/{id}`, `POST /api/calendar/send-agenda` |
| Unavailability | 🔓 `GET /api/unavailability`, `POST /api/unavailability`, `PUT /api/unavailability/{id}`, `DELETE /api/unavailability/{id}` |
| Availability | 🔓 `GET /api/availability`, `PUT /api/availability/toggle` |
| Bank | `GET /api/bank` |
| Environment | `GET /api/env`, `PUT /api/env` |
| My info | 🔓 `GET /api/settings` (public: `age` instead of the birth date, no `numbering`; the admin gets both), `PUT /api/settings` (`socialLinks`: list `[{ network, url, label? }]` checked, 400 on an unknown network, an address not in `https` or not on the site of the network), `POST /api/settings/photo`, `DELETE /api/settings/photo` |
| Quotes & invoices | `GET /api/documents`, `POST /api/documents`, `PUT /api/documents/{id}`, `DELETE /api/documents/{id}` (draft), `POST /api/documents/{id}/finalize`, `POST /api/documents/{id}/status`, `POST /api/documents/{id}/duplicate`, `POST /api/documents/{id}/invoice`, `POST /api/documents/{id}/payments`, `POST /api/documents/{id}/pay-link`, `POST /api/documents/{id}/autopay-stop`, `DELETE /api/documents/{id}/payments/{paymentId}` |
| E-invoicing | `GET /api/einvoice` (`{ settings, invoices }`: mode, credentials present, environment, every finalized invoice with its e-invoice state), `PUT /api/einvoice` (`{ mode: 'manual' \| 'api' }`, the API is off by default), `PUT` / `DELETE /api/einvoice/credentials` (`{ clientId, clientSecret }` written in the `.env`, never read back; delete = API off and credentials emptied), `POST /api/einvoice/test` (company of the credentials, a free read), `GET /api/einvoice/received`, `POST /api/einvoice/{id}/facturx` (`{ pdf }` drawn by the browser → `{ file, name, flow }`, the Factur-X in base64), `POST /api/einvoice/{id}/send` (`{ pdf }`), `POST /api/einvoice/{id}/refresh`, `POST /api/einvoice/{id}/payment` (status `fr:212`); send, refresh, payment and received answer `409 einvApiOff` while the API is off |
| Withdrawal | `POST /api/withdrawals` (public, 5 per hour and per address), `GET /api/withdrawals` |
| Bookings | 🔓 `GET /api/bookings/slots?type=&from=&to=` (free starts in UTC), 🔓 `POST /api/bookings` (`{ typeId, start, name, email, phone, message, language, timezone }`, 5 per hour and per address), 🔓 `GET` / `POST /api/bookings/cancel/{token}`, `GET /api/bookings`, `POST /api/bookings/{id}/cancel` |
| Video room | 🔓 `GET /api/rooms/{token}` (the appointment, the state of the room, the ICE servers while it is open), 🔓 `POST /api/rooms/{token}/join` (`{ peer }`), 🔓 `GET /api/rooms/{token}/signals?peer=&after=`, 🔓 `POST /api/rooms/{token}/signals` (`{ peer, kind, payload, target }`, `kind`: `offer` (host), `answer` (visitor), `candidates`, `leave`); the token of the link tells the side; 300 requests per minute and per address, 20 wrong tokens in 10 min lock the address for 15 min |
| Personal video room | 🔓 `GET /api/lounge` (open, host there, in a call, first name), 🔓 `POST /api/lounge/knocks` (`{ name }` → `{ token }`; 5 requests per 10 min and 2 waiting per address, 403 when closed), 🔓 `GET /api/lounge/knocks/{token}` (status: `waiting`, `accepted` with the ICE servers, `refused`, `cancelled`, `expired`, `closed`, `ended`), 🔓 `POST /api/lounge/knocks/{token}/cancel`, 🔓 `POST /api/lounge/knocks/{token}/end`, `GET /api/lounge/host` (the host is there, the requests, the call running), `POST /api/lounge/knocks/{token}/accept` (409 when a call is already running), `POST /api/lounge/knocks/{token}/refuse`, `PUT /api/lounge/open` (`{ open }`); signaling like the booking room: 🔓 `POST /api/lounge/calls/{token}/{host\|guest}/join`, 🔓 `GET\|POST /api/lounge/calls/{token}/{host\|guest}/signals`, only for an accepted request, the `host` side with the admin session |
| Kinds of appointment | 🔓 `GET /api/booking-types` (the active ones and the rules of the page), `GET /api/booking-types/all`, `POST /api/booking-types`, `PUT /api/booking-types/{id}`, `DELETE /api/booking-types/{id}` |
| Booking rules | `GET /api/booking-settings`, `PUT /api/booking-settings` (`{ enabled, noticeHours, horizonDays, bufferMinutes, stepMinutes }`) |
| Site texts | 🔓 `GET /api/texts`, `PUT /api/texts` (`{ lang, key, value }`, empty = original text) |
| Stripe | 🔓 `GET /api/stripe/document?token=` (payment link), 🔓 `POST /api/stripe/webhook` (signed by Stripe), 🔓 `POST /api/stripe/create-checkout` (`{ token, email }` for a payment link), 🔓 `POST /api/stripe/create-subscription`, 🔓 `GET /api/stripe/check-payment`, 🔓 `GET /api/stripe/check-subscription`, 🔓 `GET /api/stripe/payment-result`, 🔓 `GET /api/stripe/subscription-result` |
| Licences of the DC tools | 🔓 `POST /api/licenses/verify` (`{ key, product, machine, version }`, called by the tools), 🔓 `GET /api/licenses/min-version?product=`, 🔓 `POST /api/licenses/trial` (`{ email, product, lang }`, 14-day key, one per person and offer, always `{ sent: true }`), 🔓 `POST /api/licenses/support` (help request of a tool, fixed acknowledgement), 🔓 `GET /api/licenses/checkout?product=&interval=month\|year&lang=` (303 to Stripe), 🔓 `POST /api/licenses/status` (`{ key }` → tools, status, end of access, for the page `/licenses/manage/`), 🔓 `POST /api/licenses/portal` (`{ key, lang }` → `{ sent: true }`, one-time link e-mailed to the buyer), 🔓 `POST /api/licenses/portal-open` (`{ token, lang }` → Stripe customer portal URL, once), 🔓 `GET /api/licenses/thanks` and `GET` / `POST /api/licenses/manage` (old addresses, 301 to the pages `/licenses/thanks/` and `/licenses/manage/`), `GET` / `POST /api/licenses`, `PUT /api/licenses/{id}`, `POST /api/licenses/{id}/renew`, `GET` / `PUT /api/licenses/versions` |
| Uploads | 🔓 `GET /api/upload/images/{file}` |

---

<p align="center"><sub><a href="04-site.md">← 04 — The site</a> &nbsp;·&nbsp; <a href="README.md">Documentation</a> &nbsp;·&nbsp; <a href="06-admin-documents.md">06 — Admin & documents →</a></sub></p>
