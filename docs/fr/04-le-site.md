<p align="center"><img src="../assets/docs-fr.png" alt="Documentation" width="100%" /></p>

# 04 — Le site

**DOC-04** &nbsp;·&nbsp; [← Documentation](README.md)

## 01 — Textes et langues

Même système que [DC Scaffold](https://github.com/Djason16/dc-scaffold). Tous les textes sont dans `plugins/translations/` :

- `common/` : textes de tout le site (`common.ts`), du bandeau cookies (`preferences.ts`), du SEO (`seo.ts`)
- `pages/` : un fichier par page, `pages/admin/` pour les fonctions de l'admin

Chaque fichier a un bloc `fr` et un bloc `en` avec les mêmes clés. Une clé n'existe que dans un seul fichier.

```js
// plugins/translations/pages/about.ts
export default {
    fr: { aboutTitle: 'À propos' },
    en: { aboutTitle: 'About' },
}
```

```js
const { getTranslation: t } = useLang()   // dans <script setup>
{{ t('aboutTitle') }}                     // dans le template
t('footerText', { year, name })           // avec des valeurs : "{{year}}" dans le texte est remplacé
useLang().current.value                   // 'fr' ou 'en'
```

Un texte introuvable affiche sa clé, facile à repérer sur la page.
Un nouveau fichier s'importe dans `plugins/translations/translations.ts` et s'ajoute à `TRANSLATIONS`.

La langue choisie avec les boutons FR / EN n'est gardée pour la prochaine visite **que si le visiteur a accepté les cookies fonctionnels**.

## 02 — Cookies (bandeau)

Le site n'a **ni statistiques, ni publicité, ni suivi**. Le bandeau (`components/ui/PreferencesBanner/`) propose :

| Catégorie | Refusable | Ce qu'elle couvre |
| --------- | --------- | ----------------- |
| Essentiels | Non | Navigation, choix du visiteur (`site_cookie_consent`, 180 jours), session admin |
| Sécurité | Non | Protection contre les accès non autorisés |
| Paiement | Non | Cookies déposés par Stripe pendant un paiement |
| Fonctionnels | Oui | Garde la langue pour la prochaine visite |

Son fonctionnement :

- **Tout accepter**, **Tout refuser**, ou **Personnaliser** pour cocher chaque catégorie, puis **Enregistrer**
- Changer de page sans choisir ferme le bandeau **pour cette visite seulement** : rien n'est enregistré (ce n'est pas un accord),
  les cookies facultatifs restent refusés et le bandeau revient à la prochaine visite
- **Gérer les cookies**, dans le pied de page, le rouvre sur le choix actuel

Le choix est dans `stores/userPreferences.ts` (Pinia). Nom et durée du cookie : en haut de `stores/actions/userPreferencesActions.ts`.

**Ajouter un outil externe** (statistiques, Google Maps, YouTube...) demande sa propre catégorie, sinon le site n'est plus conforme au RGPD :

1. dans `stores/userPreferences.ts` : ajoute `maps: false` dans `preferences` et `maps: { required: false }` dans `categories`
2. dans `plugins/translations/common/preferences.ts` : ajoute `mapsLabel` et `mapsDescription` dans les deux langues
3. dans le code : ne charge l'outil que si `userPreferences.preferences.maps` vaut `true`
4. mets à jour la section cookies de la politique de confidentialité (`plugins/translations/pages/privacy.ts`, section 8)

## 03 — Styles

- **Couleurs, polices, tailles** : `assets/css/utils/variables.css`. Pages publiques : fonds encre `--ink-900` / `--ink-800` / `--ink-700`, texte `--paper` / `--paper-muted`, accent `--mint` ; l'admin et les documents PDF gardent `--first-color` à `--fifth-color`. Change une valeur, tout le site suit
- **Tailles de texte** : uniquement des classes dans le HTML, de `assets/css/base/typography.css` : `.text-display-xl` à `.text-display-xs` (titres), `.text-label` / `.eyebrow` (petites capitales espacées), `.text-body-l` / `.text-body` / `.text-body-s` (textes) ; `.text-small` à `.text-xlarge` pour l'admin
- **Polices** : deux, hébergées avec @fontsource (`nuxt.config.ts`) : Archivo Expanded (`--font-display`, titres, les lettres du logo) et Barlow Condensed (`--font-text` / `--font-label`, textes, libellés, menus)
- **Marges** : `--page-gutter` à gauche et à droite de l'en-tête, des sections, des pages de texte et du pied de page ; contenu jamais plus large que 1320 px
- **Sections** : couleurs données par section (`--fg`, `--fg-muted`, `--accent`, `--line`, `--panel`), voir `section-layout.css` (accueil) et `page-layout.css` (pages de texte : OtherSectionLayout)
- **Style d'un composant** : `assets/css/components/<nom-en-kebab>.css`, importé dans `assets/css/main.css`
- **Animations** : toutes les durées et la courbe viennent de `--motion-fast` / `--motion-base` / `--motion-slow` et `--ease`
  (`assets/css/utils/variables.css`, lues en JS par `utils/motion.ts`). Les éléments apparaissent avec `v-reveal` (`plugins/reveal.ts`, `reveal.css`) :
  ils montent depuis le bas en arrivant à l'écran et repartent quand ils en sortent (`--reveal-delay` décale une liste) ; rien ne bouge en mouvement réduit.
  Les changements de page sont un simple fondu (`app.pageTransition`) sur un fond encre qui reste en place (AppShell), avec le chargement (`Loader.vue`) à la première visite et à chaque changement de page.
- **Barres de défilement** : fines, sur l'encre, dans `base/global.css`
- **Réglages des animations** : chaque durée, distance, délai entre éléments, levée au survol et le `will-change` sont des variables de `utils/variables.css`
  (`--reveal-duration`, `--reveal-distance`, `--reveal-stagger`, `--swap-duration`, `--page-duration`, `--hover-lift`, `--will-change`) ;
  une seule règle de `base/global.css` donne le `will-change` à tout ce qui bouge
- **Grille de cartes** : `card-grid.css` (`.card-grid`, `.card-grid--large`, `.grid-card`) est partagée par les compétences, les projets et les outils de l'admin
- **Une animation par section, en-tête compris** (`reveal.css`, prop `reveal` de `SectionHead`) : projets `'zoom-group'` + `'zoom'`, Qui suis-je `'split'` + `'lift'` + `'slide'`, compétences `'group'` + la montée par défaut, services `'line'`, Contact `'drop'` + `'from-left'` + `'cascade'`
- **Rétractation en ligne** (`/withdrawal`, art. L.221-21 du Code de la consommation depuis le 19 juin 2026) : un formulaire envoyé à `/api/withdrawals`, gardé dans `dc_withdrawals`, un accusé de réception envoyé tout de suite au consommateur et un avis pour vous ; liée depuis le pied de page, la page de paiement, les CGV et la politique de remboursement
- **Réservation de créneaux** (`/book`, comme Calendly) : le visiteur choisit un type de rendez-vous (appel téléphonique, appel visio, rendez-vous en personne...), un jour dans un petit calendrier du mois, puis une heure libre affichée dans **son propre fuseau horaire** (nommé sur la page), et laisse son nom, son e-mail, son téléphone (obligatoire pour un appel) et un message. Les créneaux libres viennent de la semaine d'admin → Calendrier (dans son fuseau), moins admin → Indisponibilités, moins tout tant que la dispo. forcée est « occupé » ou « indisponible », moins les rendez-vous déjà pris (avec une pause autour de chacun), jamais avant le délai minimum ni après l'horizon (admin → Réservations → Règles) ; calculés par `server/helpers/BookingHelper.ts`. Le créneau est vérifié de nouveau au moment de réserver (deux visiteurs sur le même créneau : seul le premier l'obtient). Une confirmation part par e-mail dans la langue du visiteur (son heure, le déroulé, un lien d'annulation `/book/?cancel=<jeton>`, un fichier `invite.ics`), et un avis vers l'e-mail d'admin → Mes infos. Un champ caché piège les robots, 5 réservations par heure et par adresse. Page : `components/views/Book/` (calendrier, heures, formulaire ; aucune bibliothèque de calendrier), textes `plugins/translations/pages/book.ts`, e-mails `server/templates/BookingMails.ts` et `BookingTexts.ts` ; liée depuis le contact de l'accueil, le menu et le pied de page
- **Salon visio maison** (`/room/<jeton>/`, comme whereby.com, sans service payant) : un rendez-vous d'un type « visio » sans lien fixe (un lien fixe saisi sur le type l'emporte) reçoit deux jetons aléatoires (distincts du jeton d'annulation) : le lien du visiteur (e-mail de confirmation, `invite.ics`, écran de fin de réservation) et le lien d'hôte de Djason (avis de réservation avec un bouton, admin → Réservations). Le salon est ouvert de 15 minutes avant le début à 30 minutes après la fin, jamais pour un rendez-vous annulé (sinon un message avec l'heure ; la page s'ouvre toute seule à l'heure). Écran d'attente : le rendez-vous, l'aperçu de la caméra (le navigateur demande l'autorisation à « Activer caméra et micro » ou à « Rejoindre l'appel »), micro et caméra ; sans caméra l'appel se fait en audio, sans rien on voit et entend quand même l'autre. Pendant l'appel (plein écran) : l'autre en grand, soi en petit, couper le micro, la caméra, partager l'écran (ordinateur), réactions, discussion, arrière-plan et appareils, quitter ; états écrits et lus par les lecteurs d'écran (en attente, connexion, connecté, reconnexion, l'autre est parti, connexion impossible, ouvert ailleurs). Appel WebRTC direct entre les deux navigateurs (`composables/useRoomCall.ts`, `useLocalMedia.ts`), messages de mise en relation par l'API (`utils/roomSignaling.ts` → `server/controllers/RoomsController.ts`, tables `dc_room_peers` et `dc_room_signals`, nettoyées au bout de quelques heures), lus toutes les secondes pendant la connexion puis toutes les 4 s (aucun WebSocket : marche sur l'hébergement Node d'Infomaniak). STUN public par défaut, relais TURN facultatif (voir Configuration). La caméra et le micro ne sont permis (`Permissions-Policy`) que sur ces pages : les liens vers un salon sont des liens simples (chargement complet). Page : `components/views/Room/`, textes `plugins/translations/pages/room.ts` (modifiables dans admin → Textes)
  - **Comme Whereby** : **arrière-plan** (aucun, flou léger, flou fort, ou une image : Bureau, Crépuscule, Feuillage, faites pour le site dans `public/images/room/`, WebP de 5 à 10 Ko), choisi sur l'écran d'attente (l'aperçu montre l'effet) ou pendant l'appel, retenu dans le navigateur (`localStorage`). La personne est détourée sur son appareil par **MediaPipe** (`@mediapipe/tasks-vision`, Image Segmenter, modèle « selfie segmenter »), l'image est redessinée dans un canvas en 640 px de large à 30 images/s et c'est cette piste qui part (`RTCRtpSender.replaceTrack`, sans nouvelle négociation) ; pendant le démarrage de l'effet rien n'est envoyé (l'arrière-plan ne se voit jamais), un appareil trop lent (moins de 15 images/s) revient à la caméra brute avec un message. **Tout est servi par le site** (aucun CDN) et chargé **seulement quand un effet est choisi** : le modèle `public/mediapipe/selfie_segmenter.tflite` (250 Ko, licence **Apache 2.0**, Google, gardé dans Git) et le WebAssembly `public/mediapipe/wasm/` (environ 15 Mo, 2,9 Mo compressé, copié depuis `node_modules` par `scripts/mediapipe.mjs` avant `npm run dev` et `npm run build`, hors de Git), gardés 30 jours par le navigateur. Code : `utils/room/` (`effects.ts` liste et réglages retenus, `segmenter.ts` chargement, `effectProcessor.ts` dessin), `composables/useCameraEffect.ts`, `components/views/Room/RoomEffects.vue`
  - **Appareils** : caméra, micro et haut-parleur (là où le navigateur le permet : `setSinkId`, pas Safari) dans le même panneau, retenus dans le navigateur (`composables/useMediaDevices.ts`, `RoomDevices.vue`)
  - **Discussion écrite** et **réactions** (6 emoji qui flottent quelques secondes des deux côtés) par le canal de données de l'appel (`RTCDataChannel`) : directement d'un navigateur à l'autre, jamais stockées par le site, perdues à la fermeture de la page ; pastille des messages non lus sur le bouton (`composables/useRoomChat.ts`, `RoomChat.vue`, `RoomReactions.vue`). Panneau à côté de l'image sur grand écran, par-dessus en dessous de 760 px (défile à l'intérieur, jusqu'à 320 px de large et de haut)
  - **Image dans l'image** (la vidéo de l'autre reste visible par-dessus les autres fenêtres), **plein écran** et **qualité de la connexion** (bonne, moyenne, faible, d'après `getStats` toutes les 2 s : aller-retour et pertes ; détail au survol) dans le coin de l'image (`composables/useCallQuality.ts`, `RoomStageTools.vue`)
- **Salon visio personnel** (`/room/`, sans jeton, comme une salle Whereby permanente) : toujours la même adresse, à partager quand on veut, sans rendez-vous. Connecté à l'admin, Djason en est l'**hôte** (aucun lien spécial) : admin → *Mon salon visio* (ou le bouton *Mon salon visio* de l'outil Réservations) → *Entrer dans mon salon*. Le **visiteur** indique son nom (obligatoire, 40 caractères, nettoyé), règle caméra, micro et arrière-plan, puis **frappe** ; il attend (« Djason va vous faire entrer… », ou « n'est pas encore là » / « est en appel »), peut annuler, et une demande sans réponse s'arrête au bout de 10 minutes (un rechargement de la page garde la demande : son secret est dans `sessionStorage`). L'hôte voit chaque demande (nom, heure) avec *Faire entrer* / *Refuser*, un son court, une notification du navigateur (permission demandée une fois, par un bouton) et le nombre de demandes dans le titre de l'onglet. *Faire entrer* lance le même appel que les rendez-vous (vidéo, discussion, réactions, arrière-plans) ; *Refuser* affiche un message poli au visiteur. **Un seul visiteur à la fois** : les autres attendent (« est en appel »). Quand l'un raccroche, l'autre en est informé. Interrupteur **ouvert / fermé** (admin → Mon salon visio, ou sur la page de l'hôte ; table `dc_lounge`) : fermé, la page le dit et on ne peut pas frapper. Si Djason n'a pas la page ouverte, un e-mail le prévient (un toutes les 10 minutes au plus). Code : `components/views/Room/Lounge.vue`, `LoungeHost.vue`, `LoungeVisitor.vue`, `composables/useLoungeHost.ts`, `useLoungeKnock.ts`, `server/controllers/LoungeController.ts`, `server/helpers/LoungeHelper.ts`, tables `dc_lounge`, `dc_lounge_knocks`, `dc_lounge_peers`, `dc_lounge_signals` (créées au démarrage, demandes effacées au bout d'un jour), textes `plugins/translations/pages/lounge.ts` (modifiables dans admin → Textes) et `pages/admin/lounge.ts`
- **Adresse et zone** : admin → Mes infos. Cochez « Mon adresse personnelle est la même » et seule l'adresse de facturation est à remplir : sa ville et son pays deviennent l'adresse des mentions légales (`utils/address.ts`) ; décochez pour les saisir à part. La **zone affichée sur le site** est calculée depuis l'adresse pendant la saisie : en France par le service public des communes avec le code postal, hors de France par Google (`GOOGLE_MAPS_API_KEY` ; sans clé, le pays) (« Thourotte, France » donne « Hauts-de-France, France », geo.api.gouv.fr ; hors de France, le pays), modifiable. L'accueil, le pied de page et les données lues par Google n'affichent que la zone ; l'adresse exacte reste dans les mentions légales, la politique de confidentialité, le formulaire de rétractation et les documents
- **Médiateur de la consommation** : admin → Mes infos (nom, adresse, site), affiché dans les CGV ; l'admin affiche un rappel tant qu'il est vide
- **Numéros des listes** : `padIndex(i, 'PR')` de `utils/display.ts` (`PR-01`, `02`...)
- **Paiement** : le client paie exactement le montant demandé, aucun frais de carte n'est ajouté (interdit pour les cartes de particuliers, art. L.112-12 du Code monétaire et financier) `will-change` seulement sur ce qui bouge (transform, opacity).
- **Photo « Qui suis-je ? »** : se change dans admin → Mes infos (enregistrée tout de suite, stockée comme les images des projets dans `dc_uploads`) ; vide : `public/images/about-me.jpg`
- **Pas de coins arrondis** nulle part (les interrupteurs du bandeau cookies, le point de disponibilité et le chargement restent ronds).
- **Textes** : ceux par défaut sont dans `plugins/translations/` ; les textes visiteurs, et ceux imprimés sur les devis, factures et contrats (`billingDocument.ts`, `contracts.ts`), se modifient dans admin → Textes du site (`stores/siteTexts.ts`, table `dc_texts`), une partie du site à la fois. Un texte français enregistré là remplit l'anglais jamais modifié à la main (traduction automatique, à relire).
- **Compétences** : celles de `data/skills.ts`, puis celles ajoutées depuis admin → Compétences (table `dc_skills`, `composables/useSkills.ts`), à la fin de leur catégorie. Elles sont aussi proposées pour les projets, qui acceptent n'importe quelle compétence (tapée puis Entrée)
- **Effets de survol** : seulement avec une souris et un écran de plus de 1024 px. Écris chaque règle `:hover` dans
  `@media (hover: hover) and (min-width: 1025px) { ... }` : rien à annuler pour les téléphones et tablettes

## 04 — Cadre des pages (AppShell)

`components/layout/AppShell/AppShell.vue` entoure chaque page, page d'erreur comprise :
loader, en-tête, page, pied de page, boutons flottants (retour en haut, aller en bas, langues) et bandeau cookies.

- **En-tête** : `components/layout/Header/`
- **Pied de page** (réseaux sociaux, liens légaux, gestion des cookies, connexion) : `components/layout/Footer/`

## 05 — Ajouter une page

1. `components/views/About/About.vue` : le contenu (une section = un composant dans le même dossier)
2. `pages/about.vue` : affiche seulement `<About />` et appelle `useSeo('about')`. Le nom du fichier est l'adresse (`/about/`)
3. ses textes dans `plugins/translations/pages/about.ts`, importé dans `translations.ts`
4. son entrée SEO dans `utils/seo.ts`, puis `seoAboutTitle` / `seoAboutDescription` dans `plugins/translations/common/seo.ts`
5. son adresse dans `publicRoutes` de `nuxt.config.ts` (sitemap)

## 06 — SEO

- Titre, description et image de partage de chaque page : `utils/seo.ts` + `plugins/translations/common/seo.ts`
- `sitemap.xml` et `robots.txt` sont créés à partir de `publicRoutes` et `privateRoutes` de `nuxt.config.ts`
- Les adresses finissent toujours par un slash (`withTrailingSlash()` dans `utils/pathHelpers.ts`, `middleware/redirect.global.ts`)

## 07 — E-mails

Tous les e-mails suivent le site (`server/templates/MailLayout.ts`) : son encre, des liens menthe, le logo du site en ligne. Gmail et Outlook ne chargent jamais les polices d'un site : les **titres** sont des images dessinées en Archivo (`public/images/mail/`, liste et images dans `server/templates/MailTitles.ts`), mises dans l'e-mail lui-même (`cid:`, `MailHelper`) : elles s'affichent même avant la mise en ligne. Les textes utilisent une police condensée présente partout. Après avoir changé ou ajouté un titre, redessine-les :

```bash
npx -y -p playwright-core node scripts/mail-titles.mjs
```

`public/fonts/` contient les polices TrueType du PDF, des pages de retour Stripe et des images de titres (un fichier par graisse, sans doublon).

---

<p align="center"><sub><a href="03-architecture.md">← 03 — Architecture</a> &nbsp;·&nbsp; <a href="README.md">Documentation</a> &nbsp;·&nbsp; <a href="05-l-api.md">05 — L'API →</a></sub></p>
