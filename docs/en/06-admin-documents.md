<p align="center"><img src="../assets/docs-en.png" alt="Documentation" width="100%" /></p>

# 06 — Admin & documents

**DOC-06** &nbsp;·&nbsp; [← Documentation](README.md)

The admin page makes **quotes** and **invoices** (stored, with their payments) and **contracts** (made from a finalized quote). Its tools are grouped on a dashboard.

## 01 — The dashboard (admin)

The most useful first:
1. **To do** (`AdminTodo.vue`, computed by `utils/billingTodo.ts`): four columns in the order of the work, *To finalize* (drafts), *To get signed* (quotes without contract or not signed), *To collect* (payment awaited, with the whole amount), *To invoice* (missions not billed yet, one line per client). One click opens the document at its step, or the invoice of the client with their missions already ticked. Under it, what the server does alone (last run, emails sent) and *Run now*.
2. **Four buttons**: *New quote*, *New invoice*, *New mission*, *New client*.
3. **The cards**: **Work** (quotes & invoices, clients, missions) and **Site & availability** (projects, skills, texts, calendar, bookings, unavailability, forced status).
4. **Settings**, folded (*Show the settings*): my info, numbering, rates, password, environment.

- A list opens its own form: *Create client* in Clients, *Create mission* in Missions, *Add project* / the pencil of a row in Projects. Closing the form brings the list back (the blur behind stays until the last modal closes).
- Tables: click a value with a pencil, Enter or the green button saves. Clients, missions and projects come in pages (as many rows as the screen holds, no scrollbar); the arrow of a row opens its other values (columns with `detail: true` in `EditableTable`, pages: `per-page`, `TablePager.vue`). On a phone each row is a compact card (its first value as title, the others two by two).
- Forms: side by side on a computer (`FormModal` prop `columns`), the buttons always in sight.
- Machine translation: in Projects and Skills the French text fills the English a moment after typing; in Site texts a saved French text fills the English never changed by hand (`composables/useAutoTranslate.ts`, MyMemory). Always check it.

| Part | Where |
| ---- | ----- |
| Cards, buttons, groups | `components/views/Admin/Admin.vue` (`TOOLS`, `QUICK`, `GROUPS`; texts `adminGroup*`, `adminHint_*`, `adminTodo*` in `plugins/translations/pages/admin/dashboard.ts`); `AdminTodo.vue` (style `admin-todo.css`) |
| Projects | `ProjectListModal.vue` (compact rows), `CreateProjectModal.vue` (new and edit), `components/ui/Form/TagPicker.vue` (skills) |
| Skills | `SkillsModal.vue`, `composables/useSkills.ts`, `server/controllers/SkillsController.ts` |
| Bookings | `Booking/BookingModal.vue`, three tabs: *Appointments* (the last 30 days and to come, cancel one: the visitor gets an email; an appointment in the video room of the site has a *Join the video room* button until 30 minutes after its end, which opens the host link in a new tab, and its two links in the details), *Kinds* (add, change in place, hide with *Offered*, delete; name and description in French and English, length, mode phone / video / in person, place or link), *Rules* (open or closed, notice in hours, horizon in days, break between two appointments, gap between two starts); `composables/useBookingAdmin.ts`, `server/controllers/Booking*Controller.ts`, tables `dc_booking_types`, `dc_bookings`, `dc_booking_settings` |
| My video room | `LoungeModal.vue`: the personal video room `/room/` (see The site) open or closed, its address to copy, *Enter my room* (you are its host there); `server/controllers/LoungeController.ts`, tables `dc_lounge*` |

## 02 — Quotes & invoices (admin → Quotes & invoices)

Like an invoicing tool: every quote and invoice is **stored** (table `dc_documents`, payments in `dc_payments`), with its state and its history.

1. **New quote / New invoice**: a draft. On the left the form (client, subject, dates, lines, discount, payment, notes), on the right the document itself, updated at every change.
   *Import missions*: tick the missions of the client to put on the document.
   **Paid by card by default** (payment link: paid, recorded and invoiced on its own); *Also offer a bank transfer* prints your IBAN on this document (and on its contract and invoices).
   What waits is on the dashboard (*To do*). A contract or an invoice of a quote has a *Path of quote* button to go back to it.
2. **Payment** of a quote: at once, **deposit + balance** (a percent or an amount), a **free schedule** (as many steps as needed, a percent or an amount each, the last one takes what remains) or **monthly payments** (number of months, first date).
3. **Finalize**: the document gets the next number of its series (proposed, it can still be changed), a copy of the client, and can no longer be changed (duplicate it to make a new one).
4. **Path of a quote** (`BillingFlow.vue`), always in this order: the quote, its contract (made and finalized from it in one click, or *No contract*: advised for a payment in several steps or from 1,500 €, else the quote signed with the terms is enough; *Add a contract after all* until the signature), both sent to the client by email in one click (both PDF attached) or downloaded, then signed by the client, then the payments: an invoice is made only when a payment comes in (by card on its own; another way with *Payment received*: date, amount, way); each step done is ticked, only the step of now shows its buttons. Quotes and contracts print under the signature that the terms are accepted and, for a consumer, the request to start before the 14 days of withdrawal end.
5. A finalized quote: *accepted* / *refused*, then **one invoice per step** (deposit invoice, installment invoices, balance invoice: the balance takes off what was already invoiced).
6. An invoice: **payments received** (date, amount, method); paid, partly paid, late and left to pay are computed alone.
7. **By email** (`composables/useDocumentMail.ts` → `POST /api/documents/{id}/send`, `server/helpers/DocumentMailHelper.ts`, templates `server/templates/DocumentMails.ts`): *Send by email* on any finalized document, the PDF attached, a copy for you, the date of sending kept. The PDF is drawn by the browser of the admin (the same as the download), the server sends it. After a payment:
   - recorded in the admin (*Payment received*, *Record the payment*): the client gets *Paiement reçu* at once with the invoice attached;
   - online (Stripe, automatic debit): the client gets *Paiement reçu* at once with the *Download my invoice* button (`/pay-me/?doc=<link of the invoice>&pdf=1`: the same PDF, drawn in their browser, `GET /api/stripe/document-file`), you get *Nouveau paiement*. One PDF engine only: the one of the browser (the server draws none); a sending that failed is done again by the automatic task (`options.mailPending`).
8. **On its own** (`server/plugins/billing-tasks.ts` → `BillingTasksHelper`: 90 s after the start then every 30 minutes; *Run now*: `POST /api/documents/tasks`, last run: `GET /api/documents/tasks`, kept in `dc_settings.billingTasksLastRun`):
   - the invoices not sent yet are sent again;
   - once a day from 9 am, in the **time zone of the agenda** (admin → Calendar; `TimeZoneHelper`, `utils/display.ts` `todayIso`: it also sets the date of the documents), the reminders of `ReminderHelper` (templates `ReminderMails.ts`), each one once (`options.reminders`): unpaid invoice on its date then 7 days later; next step of a signed quote 3 days before, on the day then 7 days later (not with the automatic debit, which has its own emails); quote ending soon (3 days before the end) to the client; quote sent and not signed after 7 days, for you.
   Online, the application must run all the time (it does not sleep at Infomaniak).
9. **PDF** at any time, downloaded at once (no print window): the sheet of the preview drawn into an A4 PDF, real text that can be selected, in the fonts of the site, in the ink of the site, with the French notices (late penalties, €40 fee for professionals, VAT not applicable when no line has VAT).

| Part | Where |
| ---- | ----- |
| Screens | `components/views/Admin/Billing/` (`BillingModal`: list or editor; `BillingList`, `BillingEditor`, `EditorLines`, `EditorPlan`, `BillingActions`) |
| Data | `stores/billing.ts` (+ `stores/actions/billingActions.ts`) → `/api/documents` |
| Amounts (shared by the browser and the server) | `utils/billing.ts`: totals, discount, VAT per rate, payment steps, paid / left to pay |
| Server | `server/controllers/DocumentsController.ts`, `server/helpers/DocumentsHelper.ts` (numbers, invoices from a quote) |
| Document and PDF | `components/views/Documents/BillingDocument.vue` (style `billing-document.css`); `utils/pdf.ts` (lays the sheet out), `utils/pdfRender.ts` (draws it with jsPDF: pages, grounds, words, links), `utils/pdfFonts.ts` (fonts of `public/fonts/`) |

## 03 — Missions (admin → Missions)

A mission is a piece of work to invoice, for any client: time spent (hourly rate × duration × quantity) or a fixed price, with a title and an optional description. To invoice some, open a new invoice for the client → *Import missions*: the missions not billed yet are listed, tick the ones to put together (*Tick all* for every one; the total ticked is shown). Each line of the invoice shows under its title the date of the mission in full, then its description. Once the invoice is finalized, its missions show *FA-… ✓* and cannot be invoiced again nor changed; a cancelled invoice gives them back. A project with a quote (site, video…) does not need missions.

| Part | Where |
| ---- | ----- |
| Screens | `CreateMissionModal.vue`, `MissionListModal.vue` (column *Invoice*), `Billing/EditorLines.vue` (missions to tick) |
| Server | `server/controllers/MissionsController.ts`; `dc_missions.invoice_id` set by `DocumentsHelper.finalize` (lines with `missionId`), cleared when the invoice is cancelled |

## 04 — Online payment (payment link)

A finalized quote or an invoice with something left to pay has a **payment link** (*Online payment → Create the payment link*, copied at once, also printed on its PDF):
`/pay-me/?doc=<secret>`. The Pay me page then shows the document and the amount, which the client cannot change, and opens Stripe.

- **Invoice**: the client pays what is left; the payment (method *Stripe*) is added to the invoice.
- **Quote**: the client pays its next step (deposit, installment, or the whole). The invoice of this step is made (or the one already made is used), numbered, and gets the payment; the quote becomes *accepted*. If that invoice cannot be made, the payment stays on the quote (see the server logs).
- The amount always comes from the document (server side); a session is saved only once.
- **Automatic debit** (a quote in several dated steps: monthly, schedule): the page shows every step; the client can tick the automatic debit when paying the first one (their agreement, also shown by Stripe). Stripe keeps the card; `server/plugins/autopay.ts` (a minute after the start, then every 6 hours) charges each next step on its date with `AutopayHelper`, makes and settles its invoice, Stripe sends the receipt. A refused card: one email to the client (with a button to pay by hand) and one to you; the debit stays on. The admin shows it (*Online payment*) and can stop it.
- **Look**: the Stripe pages take the ink, the mint button and the square corners of the site (`branding_settings`, `StripeHelper.ts`; the logo only once online); the result pages (`server/templates/StripePages.ts`) and every email (`server/templates/MailLayout.ts`) follow the site too.
- Saved when the client closes the Stripe window, and by the **webhook** `POST /api/stripe/webhook` (event `checkout.session.completed`), which also works when the client closes the page too early. Locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook`; online: Stripe Dashboard → Developers → Webhooks, with the address of the site. Its secret goes to `STRIPE_WEBHOOK_SECRET`.

| Part | Where |
| ---- | ----- |
| Links, summary, saving | `server/helpers/PayLinkHelper.ts` (column `pay_token` of `dc_documents`) |
| Automatic debit | `server/helpers/AutopayHelper.ts`, `server/plugins/autopay.ts`, `server/templates/AutopayMails.ts` (`options.autopay` of the quote) |
| Stripe | `server/controllers/StripeController.ts` (`document`, `createCheckout` with a token, `checkPayment`, `webhook`), `server/helpers/StripeHelper.ts` |
| Page | `components/views/PayMe/PayDocument.vue` (shown by `PayMe.vue` with `?doc=`), `PaySchedule.vue` (the steps) |
| Admin | `components/views/Admin/Billing/BillingActions.vue` (*Online payment*) |

## 05 — Numbering (admin → Numbering)

For each type (quotes, invoices, contracts): a **prefix** (`DE`, `D`, `DEV`... any letters), a **format** and the **figures** of the counter, with the next number shown live.

| Format | Example | The counter starts again |
| ------ | ------- | ------------------------ |
| `{P}-{YYYY}-{N}` (default) | `DE-2026-0001` | each year |
| `{P}{YYYY}-{N}`, `{P}{YYYY}{N}`, `{P}-{YY}-{N}` | `DE2026-0001`, `DE20260001`, `DE-26-0001` | each year |
| `{P}-{YYYY}{MM}-{N}`, `{P}{YY}{MM}{N}` | `DE-202611-0001`, `DE26110001` | each month |
| `{P}-{N}`, `{P}{N}` | `DE-0001` | never |

A custom format works too (`{P}` prefix, `{YYYY}` / `{YY}` year, `{MM}` month, `{N}` counter).
**Go on from**: type the next number wanted (`CO-2026-0007`): it is used when it comes after the last number already given in that series.
Invoices must stay continuous and in order: change the format preferably on 1 January.

| Part | Where |
| ---- | ----- |
| Rules (shared by the browser and the server) | `utils/numbering.ts` (`nextNumber`, `numberingOf`, `NUMBER_FORMATS`) |
| Screen | `components/views/Admin/NumberingModal.vue` |
| Stored | `dc_settings`, key `numbering` (JSON), read by `server/helpers/DocumentsHelper.ts` when finalizing |

## 06 — Contracts (admin → Quotes & invoices → Contracts)

A contract is made from a finalized quote (*Create the contract*, with the kind of service: web, video or repair): it takes its client,
its amounts and its payment plan, gets its number when finalized (`CO-2026-0001`) and is marked *signed* once the client signed it.
Its articles are in `components/views/Documents/ContractContainer/` (style `contract-container.css`, the same sheet as the invoices);
`utils/contractDocument.ts` turns the stored contract into the props of the template.

**Interest rate**: quotes, invoices and contracts use the legal rate of the issue date for the kind of client (admin → Rates,
one rate per half-year, professional and individual). The editor shows it, and warns when the rate of the half-year is missing;
the PDF prints the penalties (three times the legal rate). The rate is kept with the document once finalized.

## 06 bis — Licences of the DC tools (admin → Work → DC licences)

DC Scaffold, DC Prospect and DC Sentinel (sold on https://tools.djason-chery.dev/) check their Pro key with this site.

- **Bought:** the buttons of the tools site open `/api/licenses/checkout`, a Stripe subscription page (-30 % launch coupon for the first 50 of each tool while it lasts). Once the payment is paid (at once, or later for a delayed method: `checkout.session.async_payment_succeeded`), the Stripe webhook creates the key and e-mails it; an unpaid renewal (`past_due`) never pushes the end of access; renewals and cancellations move its end of access (`LicenseStripe.ts`).
- **Offered:** *Offer a key*: e-mail, tools, 1 month / 3 months / 1 year / lifetime, a note; the key is e-mailed and shown once.
- **List:** status (active / revoked), end of access, tools and note are edited in the table; *New key* replaces a lost key (the old one stops at once).
- **Minimum versions:** older versions of a tool show « Update required ».
- **Stripe setup:** `node scripts/stripe-licenses.mjs .env` (test) or `.env.production` (live) creates the products, the prices (lookup keys `dc_<tool>_<month|year>`), the launch coupons and the customer portal settings. Nothing to add in the `.env` files.
- **A new DC tool, by itself:** the tools on sale are the rows of `dc_license_products` (`server/helpers/LicenseProducts.ts`, no list in the code any more). Every hour (and admin > DC tools > « Sync now »), `ToolsSyncHelper.ts` reads `https://tools.djason-chery.dev/tools.json` (only the tools whose release is published): a missing tool is registered (minimum version 1.0.0) when its prices are within bounds (month 1 to 100 €, year 10 to 1,000 €), then `ToolsStripe.ts` creates what Stripe lacks (product `dc_<tool>`, prices `dc_<tool>_month` / `_year`, the -30 % launch coupon for the first 50 of a new tool). The bundle price of `tools.json` becomes the price of new purchases (a new Stripe price takes the lookup key; subscribers keep theirs). No existing price is changed or archived, no subscription touched; nothing is created twice. An e-mail sums up each new item (never the same twice). The bundle opens every registered tool; a key of the former bundle (3 tools) too.
- **Free trial:** `POST /api/licenses/trial` e-mails a 14-day key (one per person and per offer, table `dc_license_trials`: address compared in lower case, without `+tag`, without Gmail dots; throwaway inboxes refused); it shows in the list as an offered key with the note « Essai 14 jours ». The answer is always `{ sent: true }`: the e-mail says when the trial was already used. One trial per computer too: a trial key checked on a computer that already used an earlier trial of the tool gets `trial_machine_used` (never Pro).
- **DC complet bundle:** `product=bundle` (29 €/month, 290 €/year): one key for the three tools.
- **Help requests:** `POST /api/licenses/support` forwards a tool's help request to the owner's e-mail (reply-to the user); the user only gets a fixed acknowledgement (never his message), 50 a day at most for the whole site.
- **Stripe space:** on `/licenses/manage/`, « Open my Stripe space » e-mails a one-time link (32 random bytes, only its SHA-256 in `dc_license_portal_links`, 30 minutes, 3 per key an hour) to the address of the purchase; the link comes back to the page, one click opens the portal. Same answer for every key.
- **Change a price or create an offer from the admin:** DC licences → *Prices and offers*: click a price to change it (new Stripe price for new customers, subscribers keep theirs), *New offer* (tool, reduction, length, places, end date, FR / EN texts), *Stop the offer*.
- **Prices and offers (no rebuild of the tools site):** prices are Stripe's (lookup keys `dc_<tool>_<month|year>`). An offer = a Stripe coupon with metadata `dc_product` (`scaffold`, `prospect`, `sentinel`, `bundle` or `all`), `dc_label_fr` and `dc_label_en`; checkout applies the best running offer and `GET /api/licenses/sales` gives it to the tools site (read every 5 minutes). An offer ends by itself at its last use (max redemptions), its end date or when the coupon is deleted.
- The key is never stored in clear (SHA-256 + its last 5 letters).

## 06 ter — E-invoicing (admin → Work → E-invoicing)

French reform: receiving e-invoices is mandatory since 2026-09-01, issuing them and e-reporting from 2027-09-01, only through an approved platform (PA). The site uses **Super PDP** (superpdp.tech).

- **Factur-X for every invoice:** the PDF drawn by the browser (the same as *Download the PDF*) is sent to the server, which adds the CII XML of the invoice (`factur-x.xml`, profile **EN 16931**, written from the database) and makes the file **PDF/A-3b** (sRGB output intent, XMP metadata with the Factur-X schema, AFRelationship `Alternative`): `server/helpers/FacturX*.ts`. An invoice e-mailed to the client is attached as its Factur-X too.
- **Data:** seller from admin → My information (name, SIRET → SIREN, VAT number, billing address: it must hold the postal code and town), VAT category `E` with « TVA non applicable, art. 293 B du CGI » (`VATEX-FR-FRANCHISE`), business process `S1` (services; `S4` for a balance invoice after deposits), notes PMD / PMT / AAB (penalties, €40 fee, no discount), IBAN / BIC of the `.env` (payment means 58, else 48). Buyer: name, address, country, SIREN (first 9 figures of its SIRET) and electronic address (scheme 0225: the SIREN, or the *E-invoicing address* of the client).
- **B2B or B2C:** a client of type company / freelance / association with a SIRET is **B2B**: an e-invoice. An individual (or no SIRET) is **B2C**: not an e-invoice, the sale is e-reported (the XML carries the note `BAR` = `B2C`, sent with the processing rule `B2C`).
- **Client fields:** *Country (code)* (FR by default), *EU VAT number*, *E-invoicing address* (empty: the SIREN), added to `dc_clients` at start (`EinvoiceSchema.ts`).
- **Invoice block:** *Download Factur-X* (manual mode: upload it on the Super PDP website), and when the API is on: *Send through Super PDP* (B2B) / *Report through Super PDP* (B2C), *Refresh the status*, *Report the payment* (status `fr:212` « Encaissée », once the invoice is fully paid). States: not sent / sent / accepted (delivered: `fr:201` to `fr:212`, `api:sent`...) / rejected (`api:invalid`, `fr:210`, `fr:213`, `fr:501`...), with the last event of the platform. Table `dc_einvoices`.
- **Mode:** *Manual (free)* by default: **the API is off, nothing is sent nor billed**, credentials stay unused. *Super PDP API*: switched on by the admin after a confirmation (each invoice sent is billed by Super PDP, about €0.01 excl. VAT); *Turn the API off* stops every sending at once. Only *Test the connection* (a free read of the company) works while it is off.
- **Credentials:** an OAuth2 « application » of the Super PDP account (`SUPERPDP_CLIENT_ID`, `SUPERPDP_CLIENT_SECRET` in the `.env`, server only, never sent to the browser; they can also be typed in the tool, which writes them in the `.env`). *Delete the key* empties them and turns the API off. One address for both environments (`SUPERPDP_API_URL`, `https://api.superpdp.tech`): the company of the credentials decides sandbox or production, and `SUPERPDP_ENV` (`sandbox` by default, `production` online) must match it or nothing is sent. Sandbox: the seller of the e-invoice becomes the test company of the credentials (Super PDP only takes its own invoices). `SUPERPDP_MOCK=true`: a fake platform in memory for tests.
- **Reception:** nothing to code, the Super PDP account receives the invoices; API on, *See received invoices* lists the last 20.
- **Before B2C e-reporting:** set the VAT regime of the company in Super PDP (franchise: `vat_exemption`), otherwise the platform answers « Le régime de TVA doit être paramétré au niveau de l'entreprise ».
- **Check a file:** `pip install factur-x` then `facturx-pdfextractxml file.pdf out.xml` and `facturx-xmlcheck out.xml`; full check (PDF/A + Schematron EN 16931 and French rules): Mustang CLI `java -jar Mustang-CLI.jar --action validate --source file.pdf` (Java 11+).

## 07 — Changing a template

Edit the components of `components/views/Documents/` freely, but **keep their CSS classes**:
the page breaks of the PDF rely on them.
Their **texts** (labels, notices, articles of the contracts) are changed without code in admin → Site texts → *Documents: quotes and invoices* / *Documents: contracts* (files `plugins/translations/pages/admin/billingDocument.ts` and `contracts.ts`).

---

<p align="center"><sub><a href="05-api.md">← 05 — The API</a> &nbsp;·&nbsp; <a href="README.md">Documentation</a> &nbsp;·&nbsp; <a href="07-security.md">07 — Security →</a></sub></p>
