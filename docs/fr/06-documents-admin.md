<p align="center"><img src="../assets/docs-fr.png" alt="Documentation" width="100%" /></p>

# 06 — L'admin et les documents

**DOC-06** &nbsp;·&nbsp; [← Documentation](README.md)

La page admin crée des **devis** et **factures** (enregistrés, avec leurs paiements) et des **contrats** (créés depuis un devis finalisé). Ses outils sont rangés sur un tableau de bord.

## 01 — Le tableau de bord (admin)

Du plus utile au moins utile :
1. **À faire** (`AdminTodo.vue`, calcul `utils/billingTodo.ts`) : quatre colonnes dans l'ordre du travail, *À finaliser* (brouillons), *À faire signer* (devis sans contrat ou pas signés), *À encaisser* (paiement attendu, avec le montant total), *À facturer* (missions pas encore facturées, une ligne par client). Un clic ouvre le document à son étape, ou la facture du client avec ses missions déjà cochées. Dessous, l'état de ce que le serveur fait seul (dernier passage, e-mails envoyés) et *Lancer maintenant*.
2. **Quatre boutons** : *Nouveau devis*, *Nouvelle facture*, *Nouvelle mission*, *Nouveau client*.
3. **Les cartes** : **Travail** (devis & factures, clients, missions) et **Site & disponibilités** (projets, compétences, textes, calendrier, réservations, indisponibilités, dispo. forcée).
4. **Réglages**, repliés (*Afficher les réglages*) : mes infos, numérotation, taux, mot de passe, environnement.

- Une liste ouvre son propre formulaire : *Créer client* dans Clients, *Créer mission* dans Missions, *Ajouter un projet* / le crayon d'une ligne dans Projets. Fermer le formulaire ramène la liste (le flou derrière reste jusqu'à la fermeture de la dernière modale).
- Tableaux : clic sur une valeur avec un crayon, Entrée ou le bouton vert enregistre. Clients, missions et projets sont en pages (autant de lignes que l'écran en tient, sans barre de défilement) ; la flèche d'une ligne ouvre ses autres valeurs (colonnes `detail: true` d'`EditableTable`, pages : `per-page`, `TablePager.vue`). Sur téléphone chaque ligne est une fiche compacte (sa première valeur en titre, les autres deux par deux).
- Formulaires : côte à côte sur ordinateur (`FormModal`, prop `columns`), les boutons toujours visibles.
- Traduction automatique : dans Projets et Compétences le texte français remplit l'anglais un instant après la saisie ; dans Textes du site un texte français enregistré remplit l'anglais jamais modifié à la main (`composables/useAutoTranslate.ts`, MyMemory). Toujours relire.

| Partie | Où |
| ------ | -- |
| Cartes, boutons, groupes | `components/views/Admin/Admin.vue` (`TOOLS`, `QUICK`, `GROUPS` ; textes `adminGroup*`, `adminHint_*`, `adminTodo*` dans `plugins/translations/pages/admin/dashboard.ts`) ; `AdminTodo.vue` (style `admin-todo.css`) |
| Projets | `ProjectListModal.vue` (lignes compactes), `CreateProjectModal.vue` (nouveau et modification), `components/ui/Form/TagPicker.vue` (compétences) |
| Compétences | `SkillsModal.vue`, `composables/useSkills.ts`, `server/controllers/SkillsController.ts` |
| Réservations | `Booking/BookingModal.vue`, trois onglets : *Rendez-vous* (les 30 derniers jours et à venir, en annuler un : le visiteur reçoit un e-mail ; un rendez-vous dans le salon visio du site a un bouton *Rejoindre le salon visio* jusqu'à 30 minutes après sa fin, qui ouvre le lien d'hôte dans un nouvel onglet, et ses deux liens dans le détail), *Types* (ajouter, modifier sur place, masquer avec *Proposé*, supprimer ; nom et description en français et en anglais, durée, mode téléphone / visio / en personne, lieu ou lien), *Règles* (ouvert ou fermé, délai minimum en heures, horizon en jours, pause entre deux rendez-vous, écart entre deux départs) ; `composables/useBookingAdmin.ts`, `server/controllers/Booking*Controller.ts`, tables `dc_booking_types`, `dc_bookings`, `dc_booking_settings` |
| Mon salon visio | `LoungeModal.vue` : le salon visio personnel `/room/` (voir Le site) ouvert ou fermé, son adresse à copier, *Entrer dans mon salon* (on y est l'hôte) ; `server/controllers/LoungeController.ts`, tables `dc_lounge*` |

## 02 — Devis & factures (admin → Devis & factures)

Comme un logiciel de facturation : chaque devis et facture est **enregistré** (table `dc_documents`, paiements dans `dc_payments`), avec son état et son historique.

1. **Nouveau devis / Nouvelle facture** : un brouillon. À gauche le formulaire (client, objet, dates, lignes, remise, paiement, notes), à droite le document lui-même, mis à jour à chaque changement.
   *Importer des missions* : coche les missions du client à mettre sur le document.
   **Paiement par carte par défaut** (lien de paiement : payé, enregistré et facturé tout seul) ; *Proposer aussi le virement bancaire* imprime ton IBAN sur ce document (et sur son contrat et ses factures).
   Ce qui attend est sur le tableau de bord (*À faire*). Un contrat ou une facture d'un devis a un bouton *Suivi du devis* pour y revenir.
2. **Paiement** d'un devis : en une fois, **acompte + solde** (en % ou en montant), un **échéancier libre** (autant d'échéances que voulu, chacune en % ou en montant, la dernière prend le reste) ou des **mensualités** (nombre de mois, première date).
3. **Finaliser** : le document reçoit le numéro suivant de sa suite (proposé, toujours modifiable), une copie du client, et ne peut plus être modifié (dupliquez-le pour en faire un nouveau).
4. **Suivi d'un devis** (`BillingFlow.vue`), toujours dans cet ordre : le devis, son contrat (créé et finalisé depuis lui en un clic, ou *Sans contrat* : conseillé pour un paiement en plusieurs fois ou dès 1 500 €, sinon le devis signé avec les CGV suffit ; *Ajouter un contrat finalement* jusqu'à la signature), les deux envoyés au client par e-mail en un clic (les deux PDF joints) ou téléchargés, puis signés par le client, puis les paiements : une facture n'est créée qu'à l'arrivée d'un paiement (par carte toute seule ; autrement avec *Paiement reçu* : date, montant, moyen) ; chaque étape faite est cochée, seule l'étape en cours montre ses boutons. Devis et contrats impriment sous la signature l'acceptation des CGV et, pour un particulier, la demande de démarrage avant la fin des 14 jours de rétractation.
5. Un devis finalisé : *accepté* / *refusé*, puis **une facture par échéance** (facture d'acompte, factures d'échéance, facture de solde : le solde déduit ce qui a déjà été facturé).
6. Une facture : les **paiements reçus** (date, montant, moyen) ; payée, payée en partie, en retard et reste à payer se calculent seuls.
7. **Par e-mail** (`composables/useDocumentMail.ts` → `POST /api/documents/{id}/send`, `server/helpers/DocumentMailHelper.ts`, modèles `server/templates/DocumentMails.ts`) : *Envoyer par e-mail* sur tout document finalisé, le PDF en pièce jointe, une copie pour toi, la date d'envoi notée. Le PDF est fabriqué par le navigateur de l'admin (le même que le téléchargement), le serveur l'envoie. Après un paiement :
   - enregistré dans l'admin (*Paiement reçu*, *Enregistrer le paiement*) : le client reçoit tout de suite *Paiement reçu* avec la facture jointe ;
   - en ligne (Stripe, prélèvement) : le client reçoit tout de suite *Paiement reçu* avec le bouton *Télécharger ma facture* (`/pay-me/?doc=<lien de la facture>&pdf=1` : le même PDF, fabriqué dans son navigateur, `GET /api/stripe/document-file`), toi *Nouveau paiement*. Un seul moteur de PDF : celui du navigateur (le serveur n'en dessine pas) ; un envoi raté est refait par la tâche automatique (`options.mailPending`).
8. **Tout seul** (`server/plugins/billing-tasks.ts` → `BillingTasksHelper` : 90 s après le démarrage puis toutes les 30 minutes ; *Lancer maintenant* : `POST /api/documents/tasks`, dernier passage : `GET /api/documents/tasks`, gardé dans `dc_settings.billingTasksLastRun`) :
   - les factures pas encore parties sont renvoyées ;
   - une fois par jour à partir de 9 h, dans le **fuseau de l'agenda** (admin → Calendrier ; `TimeZoneHelper`, `utils/display.ts` `todayIso` : il fixe aussi la date des documents), les relances de `ReminderHelper` (modèles `ReminderMails.ts`), chacune une seule fois (`options.reminders`) : facture impayée le jour de son échéance puis 7 jours après ; prochaine échéance d'un devis signé 3 jours avant, le jour même puis 7 jours après (pas avec le prélèvement automatique, qui a ses propres e-mails) ; devis bientôt expiré (3 jours avant la fin) au client ; devis envoyé et pas signé après 7 jours, pour toi.
   En ligne, l'application doit tourner en continu (elle ne s'endort pas chez Infomaniak).
9. **PDF** à tout moment, téléchargé tout de suite (sans fenêtre d'impression) : la feuille de l'aperçu dessinée dans un PDF A4, du vrai texte sélectionnable, dans les polices du site, à l'encre du site, avec les mentions françaises (pénalités de retard, indemnité de 40 € pour les pros, TVA non applicable quand aucune ligne n'a de TVA).

| Partie | Où |
| ------ | -- |
| Écrans | `components/views/Admin/Billing/` (`BillingModal` : liste ou éditeur ; `BillingList`, `BillingEditor`, `EditorLines`, `EditorPlan`, `BillingActions`) |
| Données | `stores/billing.ts` (+ `stores/actions/billingActions.ts`) → `/api/documents` |
| Montants (partagés par le navigateur et le serveur) | `utils/billing.ts` : totaux, remise, TVA par taux, échéances, payé / reste à payer |
| Serveur | `server/controllers/DocumentsController.ts`, `server/helpers/DocumentsHelper.ts` (numéros, factures depuis un devis) |
| Document et PDF | `components/views/Documents/BillingDocument.vue` (style `billing-document.css`) ; `utils/pdf.ts` (met la feuille en page), `utils/pdfRender.ts` (la dessine avec jsPDF : pages, fonds, mots, liens), `utils/pdfFonts.ts` (polices de `public/fonts/`) |

## 03 — Missions (admin → Missions)

Une mission est un travail à facturer, pour n'importe quel client : du temps passé (taux horaire × durée × quantité) ou un forfait, avec un titre et une description facultative. Pour en facturer, ouvre une nouvelle facture pour le client → *Importer des missions* : les missions pas encore facturées s'affichent, coche celles à regrouper (*Tout cocher* pour toutes ; le total coché s'affiche). Chaque ligne de la facture porte sous son titre la date de la mission en toutes lettres, puis sa description. Une fois la facture finalisée, ses missions affichent *FA-… ✓* et ne peuvent plus être facturées ni modifiées ; une facture annulée les rend. Un projet avec devis (site, vidéo…) n'a pas besoin de missions.

| Partie | Où |
| ------ | -- |
| Écrans | `CreateMissionModal.vue`, `MissionListModal.vue` (colonne *Facture*), `Billing/EditorLines.vue` (missions à cocher) |
| Serveur | `server/controllers/MissionsController.ts` ; `dc_missions.invoice_id` posé par `DocumentsHelper.finalize` (lignes avec `missionId`), vidé quand la facture est annulée |

## 04 — Paiement en ligne (lien de paiement)

Un devis finalisé ou une facture avec un reste à payer a un **lien de paiement** (*Paiement en ligne → Créer le lien de paiement*, copié tout de suite, aussi imprimé sur son PDF) :
`/pay-me/?doc=<secret>`. La page Payez-moi montre alors le document et le montant, que le client ne peut pas changer, puis ouvre Stripe.

- **Facture** : le client paie le reste ; le paiement (mode *Stripe*) s'ajoute à la facture.
- **Devis** : le client paie l'étape suivante (acompte, échéance ou le total). La facture de cette étape est créée (ou celle déjà faite est reprise), numérotée, et reçoit le paiement ; le devis passe en *accepté*. Si cette facture ne peut pas être créée, le paiement reste sur le devis (voir les logs du serveur).
- Le montant vient toujours du document (côté serveur) ; une session n'est enregistrée qu'une fois.
- **Prélèvement automatique** (un devis en plusieurs étapes datées : mensuel, échéancier) : la page montre chaque étape ; le client peut cocher le prélèvement automatique en payant la première (son accord, aussi affiché par Stripe). Stripe garde la carte ; `server/plugins/autopay.ts` (une minute après le démarrage, puis toutes les 6 heures) débite chaque étape suivante à sa date avec `AutopayHelper`, crée et règle sa facture, Stripe envoie le reçu. Carte refusée : un e-mail au client (avec un bouton pour payer à la main) et un à toi ; le prélèvement reste actif. L'admin l'affiche (*Paiement en ligne*) et peut l'arrêter.
- **Apparence** : les pages Stripe reprennent l'encre, le bouton menthe et les coins droits du site (`branding_settings`, `StripeHelper.ts` ; le logo seulement une fois en ligne) ; les pages de retour (`server/templates/StripePages.ts`) et tous les e-mails (`server/templates/MailLayout.ts`) suivent aussi le site.
- Enregistré quand le client ferme la fenêtre Stripe, et par le **webhook** `POST /api/stripe/webhook` (événement `checkout.session.completed`), qui marche même si le client ferme la page trop tôt. En local : `stripe listen --forward-to localhost:3000/api/stripe/webhook` ; en ligne : Dashboard Stripe → Développeurs → Webhooks, avec l'adresse du site. Son secret va dans `STRIPE_WEBHOOK_SECRET`.

| Partie | Où |
| ------ | -- |
| Liens, résumé, enregistrement | `server/helpers/PayLinkHelper.ts` (colonne `pay_token` de `dc_documents`) |
| Prélèvement automatique | `server/helpers/AutopayHelper.ts`, `server/plugins/autopay.ts`, `server/templates/AutopayMails.ts` (`options.autopay` du devis) |
| Stripe | `server/controllers/StripeController.ts` (`document`, `createCheckout` avec un token, `checkPayment`, `webhook`), `server/helpers/StripeHelper.ts` |
| Page | `components/views/PayMe/PayDocument.vue` (affichée par `PayMe.vue` avec `?doc=`), `PaySchedule.vue` (les étapes) |
| Admin | `components/views/Admin/Billing/BillingActions.vue` (*Paiement en ligne*) |

## 05 — Numérotation (admin → Numérotation)

Pour chaque type (devis, factures, contrats) : un **préfixe** (`DE`, `D`, `DEV`... n'importe quelles lettres), un **format** et les **chiffres** du compteur, avec le prochain numéro affiché en direct.

| Format | Exemple | Le compteur repart à 1 |
| ------ | ------- | ---------------------- |
| `{P}-{YYYY}-{N}` (par défaut) | `DE-2026-0001` | chaque année |
| `{P}{YYYY}-{N}`, `{P}{YYYY}{N}`, `{P}-{YY}-{N}` | `DE2026-0001`, `DE20260001`, `DE-26-0001` | chaque année |
| `{P}-{YYYY}{MM}-{N}`, `{P}{YY}{MM}{N}` | `DE-202611-0001`, `DE26110001` | chaque mois |
| `{P}-{N}`, `{P}{N}` | `DE-0001` | jamais |

Un format personnalisé marche aussi (`{P}` préfixe, `{YYYY}` / `{YY}` année, `{MM}` mois, `{N}` compteur).
**Reprendre à** : tape le prochain numéro voulu (`CO-2026-0007`) : il est utilisé s'il vient après le dernier numéro déjà donné dans cette suite.
Les factures doivent rester continues et chronologiques : change de format de préférence au 1er janvier.

| Partie | Où |
| ------ | -- |
| Règles (communes au navigateur et au serveur) | `utils/numbering.ts` (`nextNumber`, `numberingOf`, `NUMBER_FORMATS`) |
| Écran | `components/views/Admin/NumberingModal.vue` |
| Stockage | `dc_settings`, clé `numbering` (JSON), lue par `server/helpers/DocumentsHelper.ts` à la finalisation |

## 06 — Contrats (admin → Devis & factures → Contrats)

Un contrat se crée depuis un devis finalisé (*Créer le contrat*, avec le type de prestation : web, vidéo ou réparation) : il reprend son client,
ses montants et ses échéances, reçoit son numéro une fois finalisé (`CO-2026-0001`) et se marque *signé* quand le client l'a signé.
Ses articles sont dans `components/views/Documents/ContractContainer/` (style `contract-container.css`, la même feuille que les factures) ;
`utils/contractDocument.ts` transforme le contrat enregistré en props du modèle.

**Taux d'intérêt** : devis, factures et contrats utilisent le taux légal de leur date d'émission pour le type de client (admin → Taux,
un taux par semestre, professionnel et particulier). L'éditeur l'affiche et prévient quand le taux du semestre manque ;
le PDF imprime les pénalités (trois fois le taux légal). Le taux reste attaché au document une fois finalisé.

## 06 bis — Licences des outils DC (admin → Travail → Licences DC)

DC Scaffold, DC Prospect et DC Sentinel (vendus sur https://tools.djason-chery.dev/) vérifient leur clé Pro auprès de ce site.

- **Payées :** les boutons du site des outils ouvrent `/api/licenses/checkout`, une page d'abonnement Stripe (coupon de lancement -30 % pour les 50 premiers de chaque outil, tant qu'il en reste). Une fois le paiement payé (aussitôt, ou plus tard pour un moyen différé : `checkout.session.async_payment_succeeded`), le webhook Stripe crée la clé et l'envoie par e-mail ; un renouvellement impayé (`past_due`) ne repousse jamais la fin d'accès ; les renouvellements et résiliations déplacent sa fin d'accès (`LicenseStripe.ts`).
- **Offertes :** *Offrir une clé* : e-mail, outils, 1 mois / 3 mois / 1 an / à vie, une note ; la clé part par e-mail et s'affiche une fois.
- **Liste :** statut (active / révoquée), fin d'accès, outils et note se changent dans le tableau ; *Nouvelle clé* remplace une clé perdue (l'ancienne s'arrête aussitôt).
- **Versions minimales :** les versions plus anciennes d'un outil affichent « Mise à jour obligatoire ».
- **Réglage Stripe :** `node scripts/stripe-licenses.mjs .env` (test) ou `.env.production` (réel) crée les produits, les prix (clés `dc_<outil>_<month|year>`), les coupons de lancement et le portail client. Rien à ajouter dans les fichiers `.env`.
- **Nouvel outil DC, tout seul :** les outils en vente sont les lignes de `dc_license_products` (`server/helpers/LicenseProducts.ts`, plus de liste dans le code). Toutes les heures (et admin → Outils DC → « Synchroniser maintenant »), `ToolsSyncHelper.ts` lit `https://tools.djason-chery.dev/tools.json` (seuls les outils dont la release est publiée) : un outil absent est enregistré (version minimale 1.0.0) si ses prix sont dans les limites (mois 1 à 100 €, an 10 à 1 000 €), puis `ToolsStripe.ts` crée ce qui manque dans Stripe (produit `dc_<outil>`, prix `dc_<outil>_month` / `_year`, coupon de lancement -30 % pour les 50 premiers d'un nouvel outil). Le prix du pack « DC complet » donné par `tools.json` devient celui des nouveaux achats (nouveau prix Stripe qui prend la clé ; les abonnés gardent le leur). Aucun prix existant n'est modifié ni archivé, aucun abonnement n'est touché ; rien n'est créé deux fois. Un e-mail résume chaque nouveauté (pas deux fois la même). Le pack ouvre tous les outils enregistrés ; une clé de l'ancien pack (3 outils) aussi.
- **Essai gratuit :** `POST /api/licenses/trial` envoie une clé de 14 jours (une par personne et par offre, table `dc_license_trials` : adresse comparée en minuscules, sans `+tag`, sans les points de Gmail ; boîtes jetables refusées) ; elle apparaît dans la liste comme une clé offerte avec la note « Essai 14 jours ». La réponse est toujours `{ sent: true }` : l'e-mail dit si l'essai a déjà servi. Un essai par ordinateur aussi : une clé d'essai vérifiée sur un ordinateur qui a déjà utilisé un essai plus ancien de l'outil reçoit `trial_machine_used` (jamais Pro).
- **Pack DC complet :** `product=bundle` (29 € par mois, 290 € par an) : une seule clé pour les trois outils.
- **Demandes d'aide :** `POST /api/licenses/support` transmet la demande d'aide d'un outil à l'e-mail du propriétaire (réponse directe à l'utilisateur) ; l'utilisateur ne reçoit qu'un accusé de réception fixe (jamais son message), 50 par jour au plus pour tout le site.
- **Espace Stripe :** sur `/licenses/manage/`, « Ouvrir mon espace Stripe » envoie un lien à usage unique (32 octets aléatoires, seul son SHA-256 dans `dc_license_portal_links`, 30 minutes, 3 par clé et par heure) à l'adresse de l'achat ; le lien revient sur la page, un clic ouvre le portail. Même réponse pour toutes les clés.
- **Changer un prix ou créer une offre depuis l'admin :** Licences DC → *Prix et offres* : cliquer un prix pour le changer (nouveau prix Stripe pour les nouveaux clients, les abonnés gardent le leur), *Nouvelle offre* (outil, réduction, durée, places, date de fin, textes FR / EN), *Arrêter l'offre*.
- **Prix et offres (sans republier le site des outils) :** les prix sont ceux de Stripe (clés `dc_<outil>_<month|year>`). Une offre = un coupon Stripe avec les métadonnées `dc_product` (`scaffold`, `prospect`, `sentinel`, `bundle` ou `all`), `dc_label_fr` et `dc_label_en` ; le paiement applique la meilleure offre en cours, et `GET /api/licenses/sales` la donne au site des outils (lu toutes les 5 minutes). Une offre s'arrête toute seule à sa dernière utilisation (nombre max.), à sa date de fin ou quand le coupon est supprimé.
- La clé n'est jamais gardée en clair (SHA-256 + ses 5 dernières lettres).

## 06 ter — Facturation électronique (admin → Travail → Facturation électronique)

Réforme française : réception des factures électroniques obligatoire depuis le 1er septembre 2026, émission et e-reporting à partir du 1er septembre 2027, uniquement par une plateforme agréée (PA). Le site utilise **Super PDP** (superpdp.tech).

- **Factur-X pour chaque facture :** le PDF dessiné par le navigateur (le même que *Télécharger le PDF*) est envoyé au serveur, qui y ajoute le XML CII de la facture (`factur-x.xml`, profil **EN 16931**, écrit depuis la base) et en fait un **PDF/A-3b** (profil sRGB, métadonnées XMP avec le schéma Factur-X, AFRelationship `Alternative`) : `server/helpers/FacturX*.ts`. Une facture envoyée par e-mail au client part aussi en Factur-X.
- **Données :** vendeur depuis admin → Mes informations (nom, SIRET → SIREN, n° de TVA, adresse de facturation : elle doit contenir le code postal et la ville), catégorie de TVA `E` avec « TVA non applicable, art. 293 B du CGI » (`VATEX-FR-FRANCHISE`), cadre de facturation `S1` (prestations de services ; `S4` pour une facture de solde après acomptes), notes PMD / PMT / AAB (pénalités, indemnité de 40 €, pas d'escompte), IBAN / BIC du `.env` (moyen de paiement 58, sinon 48). Acheteur : nom, adresse, pays, SIREN (9 premiers chiffres du SIRET) et adresse électronique (schéma 0225 : le SIREN, ou l'*Adresse de facturation électronique* du client).
- **B2B ou B2C :** un client de type entreprise / indépendant / association avec un SIRET est **B2B** : facture électronique. Un particulier (ou sans SIRET) est **B2C** : pas une facture électronique, la vente est déclarée (e-reporting : note `BAR` = `B2C` dans le XML, envoi avec la règle de traitement `B2C`).
- **Champs du client :** *Pays (code)* (FR par défaut), *N° de TVA intracommunautaire*, *Adresse de facturation électronique* (vide : le SIREN), ajoutés à `dc_clients` au démarrage (`EinvoiceSchema.ts`).
- **Bloc de la facture :** *Télécharger Factur-X* (mode manuel : à déposer sur le site de Super PDP) et, API activée : *Envoyer par Super PDP* (B2B) / *Déclarer par Super PDP* (B2C), *Actualiser le statut*, *Déclarer l'encaissement* (statut `fr:212` « Encaissée », une fois la facture entièrement payée). États : non envoyée / envoyée / acceptée (transmise : `fr:201` à `fr:212`, `api:sent`...) / rejetée (`api:invalid`, `fr:210`, `fr:213`, `fr:501`...), avec le dernier événement de la plateforme. Table `dc_einvoices`.
- **Mode :** *Manuel (gratuit)* par défaut : **l'API est coupée, rien n'est envoyé ni facturé**, les identifiants restent inutilisés. *API Super PDP* : activée par l'admin après confirmation (chaque facture envoyée est facturée par Super PDP, environ 0,01 € HT) ; *Couper l'API* arrête aussitôt tout envoi. Seul *Tester la connexion* (lecture gratuite de l'entreprise) marche quand elle est coupée.
- **Identifiants :** une « application » OAuth2 du compte Super PDP (`SUPERPDP_CLIENT_ID`, `SUPERPDP_CLIENT_SECRET` dans le `.env`, côté serveur seulement, jamais envoyés au navigateur ; on peut aussi les saisir dans l'outil, qui les écrit dans le `.env`). *Supprimer la clé* les vide et coupe l'API. Une seule adresse pour les deux environnements (`SUPERPDP_API_URL`, `https://api.superpdp.tech`) : l'entreprise des identifiants décide bac à sable ou production, et `SUPERPDP_ENV` (`sandbox` par défaut, `production` en ligne) doit correspondre, sinon rien n'est envoyé. En bac à sable, le vendeur de la facture devient l'entreprise de test des identifiants (Super PDP n'accepte que ses propres factures). `SUPERPDP_MOCK=true` : une plateforme fictive en mémoire pour les tests.
- **Réception :** rien à coder, le compte Super PDP reçoit les factures ; API activée, *Voir les factures reçues* liste les 20 dernières.
- **Avant l'e-reporting B2C :** régler le régime de TVA de l'entreprise dans Super PDP (franchise : `vat_exemption`), sinon la plateforme répond « Le régime de TVA doit être paramétré au niveau de l'entreprise ».
- **Vérifier un fichier :** `pip install factur-x` puis `facturx-pdfextractxml fichier.pdf sortie.xml` et `facturx-xmlcheck sortie.xml` ; contrôle complet (PDF/A + Schematron EN 16931 et règles françaises) : Mustang CLI `java -jar Mustang-CLI.jar --action validate --source fichier.pdf` (Java 11+).

## 07 — Modifier un modèle

Modifie librement les composants de `components/views/Documents/`, mais **garde leurs classes CSS** :
les sauts de page du PDF en dépendent.
Leurs **textes** (libellés, mentions, articles des contrats) se changent sans code dans admin → Textes du site → *Documents : devis et factures* / *Documents : contrats* (fichiers `plugins/translations/pages/admin/billingDocument.ts` et `contracts.ts`).

---

<p align="center"><sub><a href="05-l-api.md">← 05 — L'API</a> &nbsp;·&nbsp; <a href="README.md">Documentation</a> &nbsp;·&nbsp; <a href="07-securite.md">07 — Sécurité →</a></sub></p>
