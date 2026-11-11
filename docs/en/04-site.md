<p align="center"><img src="../assets/docs-en.png" alt="Documentation" width="100%" /></p>

# 04 — The site

**DOC-04** &nbsp;·&nbsp; [← Documentation](README.md)

## 01 — Texts and languages

Same system as [DC Scaffold](https://github.com/Djason16/dc-scaffold). Every text is in `plugins/translations/`:

- `common/`: texts of the whole site (`common.ts`), the cookie banner (`preferences.ts`), SEO (`seo.ts`)
- `pages/`: one file per page, `pages/admin/` for the admin features

Each file has an `fr` and an `en` block with the same keys. A key exists in one file only.

```js
// plugins/translations/pages/about.ts
export default {
    fr: { aboutTitle: 'À propos' },
    en: { aboutTitle: 'About' },
}
```

```js
const { getTranslation: t } = useLang()   // in <script setup>
{{ t('aboutTitle') }}                     // in the template
t('footerText', { year, name })           // with values: "{{year}}" in the text is replaced
useLang().current.value                   // 'fr' or 'en'
```

A missing text shows its key, easy to spot on the page.
A new file is imported in `plugins/translations/translations.ts` and added to `TRANSLATIONS`.

The language chosen with the FR / EN buttons is remembered for the next visit **only if the visitor accepted functional cookies**.

## 02 — Cookies (banner)

The site has **no analytics, no advertising and no tracking**. The banner (`components/ui/PreferencesBanner/`) offers:

| Category | Can be refused | What it covers |
| -------- | -------------- | -------------- |
| Essential | No | Navigation, the visitor's choice (`site_cookie_consent`, 180 days), admin session |
| Security | No | Protection against unauthorized access |
| Payment | No | Cookies set by Stripe during a payment |
| Functional | Yes | Remembers the language for the next visit |

How it behaves:

- **Accept all**, **Deny all**, or **Customize** to tick each category, then **Save**
- Changing page without choosing closes the banner **for this visit only**: nothing is saved (this is not a consent),
  optional cookies stay off and the banner comes back on the next visit
- **Cookie settings** in the footer opens it again on the current choice

The choice lives in `stores/userPreferences.ts` (Pinia). Cookie name and lifetime: top of `stores/actions/userPreferencesActions.ts`.

**Adding an external tool** (analytics, Google Maps, YouTube...) needs its own category, otherwise the site is no longer GDPR compliant:

1. in `stores/userPreferences.ts`: add `maps: false` to `preferences` and `maps: { required: false }` to `categories`
2. in `plugins/translations/common/preferences.ts`: add `mapsLabel` and `mapsDescription` in both languages
3. in the code: only load the tool when `userPreferences.preferences.maps` is `true`
4. update the cookie section of the privacy policy (`plugins/translations/pages/privacy.ts`, section 8)

## 03 — Styles

- **Colors, fonts, sizes**: `assets/css/utils/variables.css`. Public pages: ink grounds `--ink-900` / `--ink-800` / `--ink-700`, text `--paper` / `--paper-muted`, accent `--mint`; the admin and the PDF documents keep `--first-color` to `--fifth-color`. Change a value, the whole site follows
- **Text sizes**: only classes in the HTML, from `assets/css/base/typography.css`: `.text-display-xl` to `.text-display-xs` (titles), `.text-label` / `.eyebrow` (small spaced capitals), `.text-body-l` / `.text-body` / `.text-body-s` (texts); `.text-small` to `.text-xlarge` for the admin
- **Fonts**: two, self-hosted with @fontsource (`nuxt.config.ts`): Archivo Expanded (`--font-display`, titles, the letters of the logo) and Barlow Condensed (`--font-text` / `--font-label`, texts, labels, menus)
- **Margins**: `--page-gutter` on the left and right of the header, sections, text pages and footer; content never wider than 1320px
- **Sections**: colors given per section (`--fg`, `--fg-muted`, `--accent`, `--line`, `--panel`), see `section-layout.css` (home) and `page-layout.css` (text pages: OtherSectionLayout)
- **One component's style**: `assets/css/components/<kebab-name>.css`, imported in `assets/css/main.css`
- **Animations**: every duration and curve comes from `--motion-fast` / `--motion-base` / `--motion-slow` and `--ease`
  (`assets/css/utils/variables.css`, read in JS with `utils/motion.ts`). Elements appear with `v-reveal` (`plugins/reveal.ts`, `reveal.css`):
  they rise from below when they come on screen and leave when they go out of it (`--reveal-delay` staggers a list); nothing moves with reduced motion.
  Page changes are a simple fade (`app.pageTransition`) on an ink ground that stays (AppShell), with the loader (`Loader.vue`) on the first visit and on every page change.
- **Scroll bars**: thin, on the ink, in `base/global.css`
- **Motion settings**: every duration, distance, delay between items, hover lift and `will-change` is a variable of `utils/variables.css`
  (`--reveal-duration`, `--reveal-distance`, `--reveal-stagger`, `--swap-duration`, `--page-duration`, `--hover-lift`, `--will-change`);
  one rule of `base/global.css` gives `will-change` to every element that moves
- **Card grid**: `card-grid.css` (`.card-grid`, `.card-grid--large`, `.grid-card`) is shared by the skills, the projects and the admin tools
- **One animation per section, its header included** (`reveal.css`, `SectionHead` prop `reveal`): projects `'zoom-group'` + `'zoom'`, About me `'split'` + `'lift'` + `'slide'`, skills `'group'` + the default rise, services `'line'`, Contact `'drop'` + `'from-left'` + `'cascade'`
- **Online withdrawal** (`/withdrawal`, art. L.221-21 of the French Consumer Code since 19 June 2026): a form sent to `/api/withdrawals`, kept in `dc_withdrawals`, an acknowledgement emailed to the consumer at once and a notice to you; linked from the footer, the payment page, the terms and the refund policy
- **Slot booking** (`/book`, like Calendly): the visitor picks a kind of appointment (phone call, video call, meeting in person...), a day of a small month calendar, then a free hour shown in **his own time zone** (named on the page), and leaves his name, email, phone (needed for a phone call) and a message. The free slots come from the week of admin → Calendar (in its time zone), minus admin → Unavailability, minus everything while the forced status is busy or unavailable, minus the bookings already made (with a break around each one), never sooner than the notice nor further than the horizon (admin → Bookings → Rules); worked out by `server/helpers/BookingHelper.ts`. The slot is checked again at the moment of booking (two visitors on the same slot: only the first one gets it). A confirmation is emailed in the language of the visitor (his time, how it happens, a cancel link `/book/?cancel=<token>`, an `invite.ics` file), and a notice to the email of admin → My info. A hidden field traps the robots, 5 bookings per hour and per address. Page: `components/views/Book/` (calendar, hours, form; no calendar library), texts `plugins/translations/pages/book.ts`, emails `server/templates/BookingMails.ts` and `BookingTexts.ts`; linked from the contact of the home page, the menu and the footer
- **In-house video room** (`/room/<token>/`, like whereby.com, no paid service): a booking of a "video" kind without a fixed link (a fixed link typed on the kind wins) gets two random tokens (separate from the cancel token): the visitor's link (confirmation email, `invite.ics`, last screen of the booking) and Djason's host link (booking notice with a button, admin → Bookings). The room is open from 15 minutes before the start to 30 minutes after the end, never for a cancelled booking (otherwise a message with the time; the page opens by itself at the time). Waiting screen: the appointment, the camera preview (the browser asks for permission on "Turn on camera and microphone" or on "Join the call"), microphone and camera; without a camera the call is audio only, without anything the person still sees and hears the other. During the call (full screen): the other person large, oneself small, mute, camera, share the screen (computers), reactions, chat, background and devices, leave; states written and read by screen readers (waiting, connecting, connected, reconnecting, the other left, cannot connect, open elsewhere). Direct WebRTC call between the two browsers (`composables/useRoomCall.ts`, `useLocalMedia.ts`), signaling through the API (`utils/roomSignaling.ts` → `server/controllers/RoomsController.ts`, tables `dc_room_peers` and `dc_room_signals`, cleaned after a few hours), read every second while connecting then every 4 s (no WebSocket: works on the Infomaniak Node hosting). Public STUN by default, optional TURN relay (see Configuration). Camera and microphone are only allowed (`Permissions-Policy`) on these pages: the links to a room are plain links (full load). Page: `components/views/Room/`, texts `plugins/translations/pages/room.ts` (editable in admin → Texts)
  - **Like Whereby**: **background** (none, light blur, strong blur, or an image: Office, Dusk, Leaves, made for the site in `public/images/room/`, WebP of 5 to 10 KB), chosen on the waiting screen (the preview shows the effect) or during the call, remembered in the browser (`localStorage`). The person is cut out on their own device by **MediaPipe** (`@mediapipe/tasks-vision`, Image Segmenter, "selfie segmenter" model), the picture is drawn again in a canvas 640 px wide at 30 frames/s and that track is the one sent (`RTCRtpSender.replaceTrack`, no new negotiation); while the effect starts nothing is sent (the background never shows), a device too slow (under 15 frames/s) goes back to the raw camera with a message. **Everything is served by the site** (no CDN) and loaded **only when an effect is chosen**: the model `public/mediapipe/selfie_segmenter.tflite` (250 KB, **Apache 2.0** licence, Google, kept in Git) and the WebAssembly `public/mediapipe/wasm/` (about 15 MB, 2.9 MB compressed, copied from `node_modules` by `scripts/mediapipe.mjs` before `npm run dev` and `npm run build`, not in Git), kept 30 days by the browser. Code: `utils/room/` (`effects.ts` list and remembered settings, `segmenter.ts` loading, `effectProcessor.ts` drawing), `composables/useCameraEffect.ts`, `components/views/Room/RoomEffects.vue`
  - **Devices**: camera, microphone and speaker (where the browser allows it: `setSinkId`, not Safari) in the same panel, remembered in the browser (`composables/useMediaDevices.ts`, `RoomDevices.vue`)
  - **Text chat** and **reactions** (6 emoji floating a few seconds on both sides) over the data channel of the call (`RTCDataChannel`): straight from one browser to the other, never stored by the site, gone when the page closes; unread badge on the button (`composables/useRoomChat.ts`, `RoomChat.vue`, `RoomReactions.vue`). Panel beside the picture on large screens, over it under 760 px (scrolls inside, down to 320 px wide and high)
  - **Picture-in-picture** (the video of the other person stays visible over other windows), **full screen** and **connection quality** (good, fair, poor, from `getStats` every 2 s: round trip and losses; details on hover) in the corner of the picture (`composables/useCallQuality.ts`, `RoomStageTools.vue`)
- **Personal video room** (`/room/`, no token, like a permanent Whereby room): always the same address, to share whenever, without booking. Logged in to the admin, Djason is its **host** (no special link): admin → *My video room* (or the *My video room* button of the Bookings tool) → *Enter my room*. The **visitor** types his name (required, 40 characters, cleaned), sets camera, microphone and background, then **knocks**; he waits ("Djason will let you in…", or "is not here yet" / "is in a call"), can cancel, and an unanswered request stops after 10 minutes (a reload of the page keeps the request: its secret is in `sessionStorage`). The host sees each request (name, time) with *Let in* / *Refuse*, a short sound, a browser notification (permission asked once, with a button) and the number of requests in the title of the tab. *Let in* starts the same call as the bookings (video, chat, reactions, backgrounds); *Refuse* shows a polite message to the visitor. **One visitor at a time**: the others wait ("is in a call"). When one side hangs up, the other is told. **Open / closed** switch (admin → My video room, or on the host's page; table `dc_lounge`): closed, the page says so and nobody can knock. When Djason does not have the page open, an email tells him (one every 10 minutes at most). Code: `components/views/Room/Lounge.vue`, `LoungeHost.vue`, `LoungeVisitor.vue`, `composables/useLoungeHost.ts`, `useLoungeKnock.ts`, `server/controllers/LoungeController.ts`, `server/helpers/LoungeHelper.ts`, tables `dc_lounge`, `dc_lounge_knocks`, `dc_lounge_peers`, `dc_lounge_signals` (created at startup, requests removed after a day), texts `plugins/translations/pages/lounge.ts` (editable in admin → Texts) and `pages/admin/lounge.ts`
- **Address and area**: admin → My info. Tick "My personal address is the same" and only the billing address is typed: its town and country become the address of the legal pages (`utils/address.ts`); untick it to type them apart. The **area shown on the site** is worked out from the address while it is typed: in France by the public service of the French towns with the postal code, outside France by Google (`GOOGLE_MAPS_API_KEY`; without a key, the country) ("Thourotte, France" gives "Hauts-de-France, France", geo.api.gouv.fr; outside France the country), editable. The home page, the footer and the data read by Google show the area only; the exact address stays in the legal notice, the privacy policy, the withdrawal form and the documents
- **Consumer mediator**: admin → My info (name, address, website), printed in the terms; the admin shows a reminder while it is empty
- **Numbers of the lists**: `padIndex(i, 'PR')` of `utils/display.ts` (`PR-01`, `02`...)
- **Payment**: the client pays exactly the amount asked, no card fee is added (forbidden for consumer cards, art. L.112-12 of the French monetary code) `will-change` only on elements that move (transform, opacity).
- **Photo of "About me"**: changed from admin → My info (saved at once, stored like the project images in `dc_uploads`); empty: `public/images/about-me.jpg`
- **No rounded corners** anywhere (the switches of the cookie banner, the availability dot and the loader stay round).
- **Texts**: the defaults are in `plugins/translations/`; the visitor texts, and those printed on the quotes, invoices and contracts (`billingDocument.ts`, `contracts.ts`), can be changed from admin → Site texts (`stores/siteTexts.ts`, table `dc_texts`), one part of the site at a time. A French text saved there fills the English that was never changed by hand (machine translation, to check).
- **Skills**: the ones of `data/skills.ts`, then the ones added from admin → Skills (table `dc_skills`, `composables/useSkills.ts`), at the end of their category. They are also offered for the projects, which take any skill (typed and Enter)
- **Hover effects**: only with a mouse and a screen wider than 1024px. Write every `:hover` rule inside
  `@media (hover: hover) and (min-width: 1025px) { ... }`: nothing to cancel for phones and tablets

## 04 — App shell

`components/layout/AppShell/AppShell.vue` frames every page, the error page included:
loader, header, page, footer, floating buttons (back to top, to the bottom, languages) and cookie banner.

- **Header**: `components/layout/Header/`
- **Footer** (social links, legal links, cookie settings, login): `components/layout/Footer/`

## 05 — Adding a page

1. `components/views/About/About.vue`: the content (one section = one component in the same folder)
2. `pages/about.vue`: only displays `<About />` and calls `useSeo('about')`. The file name is the address (`/about/`)
3. its texts in `plugins/translations/pages/about.ts`, imported in `translations.ts`
4. its SEO entry in `utils/seo.ts`, then `seoAboutTitle` / `seoAboutDescription` in `plugins/translations/common/seo.ts`
5. its address in `publicRoutes` of `nuxt.config.ts` (sitemap)

## 06 — SEO

- Title, description and share image of each page: `utils/seo.ts` + `plugins/translations/common/seo.ts`
- `sitemap.xml` and `robots.txt` are generated from `publicRoutes` and `privateRoutes` of `nuxt.config.ts`
- Addresses always end with a slash (`withTrailingSlash()` in `utils/pathHelpers.ts`, `middleware/redirect.global.ts`)

## 07 — Emails

Every email follows the site (`server/templates/MailLayout.ts`): its ink, mint links, the logo of the site online. Gmail and Outlook never load the fonts of a site: the **titles** are images drawn in Archivo (`public/images/mail/`, list and images in `server/templates/MailTitles.ts`), put in the email itself (`cid:`, `MailHelper`): they show even before the site is online. The texts use a condensed font every device has. After changing or adding a title, draw them again:

```bash
npx -y -p playwright-core node scripts/mail-titles.mjs
```

`public/fonts/` holds the TrueType fonts of the PDF, of the Stripe result pages and of the title images (one file per weight, no copies).

---

<p align="center"><sub><a href="03-architecture.md">← 03 — Architecture</a> &nbsp;·&nbsp; <a href="README.md">Documentation</a> &nbsp;·&nbsp; <a href="05-api.md">05 — The API →</a></sub></p>
