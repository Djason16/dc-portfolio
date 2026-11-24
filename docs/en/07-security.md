<p align="center"><img src="../assets/docs-en.png" alt="Documentation" width="100%" /></p>

# 07 — Security

**DOC-07** &nbsp;·&nbsp; [← Documentation](README.md)

## 01 — Admin login

Email and password, then a one-time code sent by email. The forgotten password flow asks the security answer
(`SECURITY_ANSWER`), then emails a link to `/reset-password/` (valid one hour, used once, only its SHA-256 is stored in
`dc_password_resets`); the new password closes every session. The answer is the same whether the address has an account or not.

## 02 — Protected routes

The session is checked by the API router (`server/api/[...path].ts`) on the route that was matched,
so `/api/env`, `/api/env/` and `/api//env` are the same protected route.
Only the actions listed in a controller's `publicActions` are public ([every route](05-api.md#04--every-route)).

`robots.txt` is **not** a protection: it only guides search engines.

## 03 — Rate limits

Failed attempts are stored in the database (`dc_rate_limits`), per IP (and, for the password, per account from that IP: wrong tries lock the one who types them, never the admin from his own connection; the code sent by e-mail still guards the account):

| Attempt | Limit | Locked for |
| ------- | ----- | ---------- |
| Wrong password | 5 | 15 minutes |
| Wrong one-time code | 5 | 15 minutes |
| Wrong security answer | 3 | 1 hour |
| Licence check / state / Stripe space link (per IP) | 60 / 10 an hour | 15 / 30 minutes |
| Free trial (per IP and per person) | 5 a day | 1 day |
| Help request (per IP and per address) | 5 an hour | 1 hour |
| Stripe pages: licence checkout, Pay me subscription (per IP) | 20 an hour | 1 hour |

The IP is the socket address. `X-Forwarded-For` (its last entry, the one Apache adds) counts only when the socket is a proxy: loopback, private address, or a pipe (the dev server of Nuxt). From any other address, a forged header is ignored (`SecurityHelper.ip`).

## 04 — Uploads

- Only JPG, PNG, GIF, WEBP and AVIF images, stored in the database (`dc_uploads`)

## 05 — Secrets

- Stripe secret key, SMTP, database password, bank details and admin account stay on the server: never in a `NUXT_PUBLIC_` variable
- `.env` files are never committed
- Admin → Environment never receives a secret (names with SECRET, PASS, KEY, TOKEN, CREDENTIAL, IBAN, BIC, ANSWER): only `••••` and its last 4 characters (none for a value under 12 characters). Sent back masked, or left empty, it stays unchanged. `SUPERPDP_API_URL` can only be `https://api.superpdp.tech` (tests: `SUPERPDP_MOCK=true`)
- `GET /api/settings` (public) gives neither the birth date (only `age`, worked out by the server) nor the numbering of the documents (`numbering`): only the logged-in admin gets them (`SettingsController.getAll`). The billing address stays public: the quotes, invoices and the withdrawal form show it to the clients (legal mentions)

---

<p align="center"><sub><a href="06-admin-documents.md">← 06 — Admin & documents</a> &nbsp;·&nbsp; <a href="README.md">Documentation</a> &nbsp;·&nbsp; <a href="08-deployment.md">08 — Deployment →</a></sub></p>

The address of a meeting in person is never in the public list of booking kinds (`GET /api/booking-types`): only the person who booked gets it (confirmation page and e-mail).
