<p align="center"><img src="../assets/docs-en.png" alt="Documentation" width="100%" /></p>

# 02 — Configuration

**DOC-02** &nbsp;·&nbsp; [← Documentation](README.md)

Settings live in `.env` files inside `frontend/`: only what is **secret or technical** (database, Stripe, SMTP, admin account, bank details, address of the site).
Your name, contact, legal details and social links are edited in **admin → My info** (stored in the database, applied at once).
The texts seen by visitors (home, legal pages, cookie banner, SEO, Pay me page, and the texts printed on the quotes, invoices and contracts) are edited in **admin → Site texts**: the site changes at once, without a new build.

Start from the example:

```bash
cp .env.example .env
```

| File | Used by |
| ---- | ------- |
| `.env` | Development (`npm run dev`), also read by Docker for the local MySQL |
| `.env.production` | Production (`npm run build`, `npm run start`) |
| `.env.example` | The template, the only one committed to Git |

> ⚠️ Never commit `.env` or `.env.production` (they are in `.gitignore`).
> Server values (Stripe secret key, SMTP, bank details, admin account) are read when the site is built: **rebuild after changing them**.

## 01 — Variables

| Variable | What it is |
| -------- | ---------- |
| **Mode** | |
| `NODE_ENV` | `development` or `production` |
| **Site** (public) | |
| `NUXT_PUBLIC_FRONTEND_DOMAIN` | Address of the site (`http://localhost:3000` in development) |
| **Database** | |
| `DB_HOST`, `DB_PORT` | MySQL server: `localhost` and `3306` locally (Docker), the server given by Infomaniak online |
| `DB_NAME`, `DB_USER`, `DB_PASS` | Database, user and password. Locally `djason_cv` / `root` / a long random password |
| **Admin account** (created on the first start) | |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Login of the admin space |
| `SECURITY_ANSWER` | Answer asked to reset the password |
| **Emails (SMTP)** | |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | Server used to send the login codes and emails |
| `MAIL_LOG_ONLY` | `true`: no email leaves, each one is written in the server log (tests on the dev: `MAIL_LOG_ONLY=true npm run dev`); empty online |
| **Payments (Stripe)** | |
| `STRIPE_SECRET_KEY` | Secret key (server only) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of the webhook `/api/stripe/webhook` (`whsec_...`): locally given by `stripe listen`, online by the Dashboard |
| **Bank** (server only, never sent to the browser) | |
| `BANK_IBAN`, `BANK_BIC` | Printed on invoices and contracts |
| **Translation** (MyMemory, free, no key) | |
| `MYMEMORY_EMAIL` | Optional. Empty: about 5,000 translated characters a day; an email: about 50,000 |
| `GOOGLE_MAPS_API_KEY` | Google Geocoding API key (server side): the region of an address outside France, shown on the site instead of the town. In France: the public service geo.api.gouv.fr. Empty: the country only |
| **Video room of the appointments** (WebRTC, server only) | Given only to the two people of a video appointment, while its room is open |
| `STUN_URLS` | Optional. STUN servers, separated by commas (`stun:host:port`). Empty: the public servers of Google and Cloudflare |
| `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` | Optional, empty by default. TURN relay for the networks that block a direct call (see below), e.g. `turn:turn.example.com:3478,turns:turn.example.com:5349?transport=tcp` |
| `TURN_SECRET` | Optional, advised when the relay allows it (coturn: `static-auth-secret`). With it, the site makes a TURN access for each call that expires after 3 hours, instead of giving `TURN_USERNAME` / `TURN_CREDENTIAL`, which are permanent: a visitor who keeps the access cannot use the relay later |

The order is the one of `.env.example` and of admin → Environment (a missing variable shows empty there: filling it adds it to the file).

Everything starting with `NUXT_PUBLIC_` is visible in the browser: never put a secret there.

### Video room: STUN and TURN relay

The call of the video room (`/room/<token>/`) goes straight from one browser to the other (WebRTC), encrypted from end to end; the site only passes the few messages they need to find each other. For that, each browser first asks a **STUN server** for its public address (by default the free public servers of Google and Cloudflare): that server sees the IP addresses of the two people, like for any video call, but nothing of the call goes through it.

**Without a TURN relay, about 10 to 15 % of networks cannot connect directly**: some company networks (strict firewalls), some 4G connections or some boxes. The page then stays on "Connecting…", then says the direct connection does not get through. A **TURN relay** fixes it: when the direct connection fails, picture and sound go through it (still encrypted from end to end: the relay cannot read them). Fill in `TURN_URLS`, `TURN_USERNAME` and `TURN_CREDENTIAL` (admin → Environment or `.env.production`), then restart the site.

**Advice: go online first without a relay** (the three variables empty), make a test call over 4G, and add a relay only if the call does not get through. Only the calls that cannot go direct use the relay.

To add one, the simplest is **Metered** (fixed credentials, pasted as they are):

1. Create a free account on [metered.ca](https://www.metered.ca/stun-turn).
2. Dashboard → **TURN Server** → **Add Credential**: the site gives a username and a password.
3. **Show ICE Servers Array** shows the addresses (`turn:standard.relay.metered.ca:80`, `turns:standard.relay.metered.ca:443?transport=tcp`...): put them in `TURN_URLS`, separated by commas; the username in `TURN_USERNAME`, the password in `TURN_CREDENTIAL`.

The free plan has one region and little data per month (500 MB on the pricing page in November 2026): enough for a few relayed calls. **Prices and quotas change: check them on the site before choosing.** To avoid: the "openrelayproject" credentials of tutorials (public and shared) and the Cloudflare TURN (credentials that change at each call: it would need more code). You can also run `coturn` yourself on a small server.

## 02 — Production

Create `.env.production` with the same variables and the real values: domain, Stripe **live** keys, real SMTP... Always **empty online**: `MAIL_LOG_ONLY` (otherwise no email leaves) and `STUN_URLS`; `TURN_*` empty as long as there is no relay (see above).
They can also be edited later from the admin page (Environment), which writes them back to the `.env` file of the current mode.

## 03 — Local database (Docker)

The local MySQL (`docker-compose.yml`) reads the same `.env` as the site: `start.bat` gives it to Docker.

| Variable | For Docker |
| -------- | ---------- |
| `DB_PASS` | Password of `root`, the user the site logs in with locally (like DC Scaffold) |
| `DB_NAME` | Name of the database created on the first start |
| `DB_PORT` | Port of MySQL on this computer |

Use a long random password.
MySQL reads the password only when `database/` is created: to change it later, change it in MySQL too (phpMyAdmin → User accounts).

---

<p align="center"><sub><a href="01-getting-started.md">← 01 — Getting started</a> &nbsp;·&nbsp; <a href="README.md">Documentation</a> &nbsp;·&nbsp; <a href="03-architecture.md">03 — Architecture →</a></sub></p>
