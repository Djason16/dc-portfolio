<p align="center"><img src="../assets/docs-fr.png" alt="Documentation" width="100%" /></p>

# 02 — Configuration

**DOC-02** &nbsp;·&nbsp; [← Documentation](README.md)

Les réglages sont dans des fichiers `.env` dans `frontend/` : seulement ce qui est **secret ou technique** (base de données, Stripe, SMTP, compte admin, banque, adresse du site).
Ton nom, ton contact, tes mentions légales et tes réseaux sociaux (une liste ordonnée : LinkedIn, YouTube, Vimeo… ou tout autre site) se modifient dans **admin → Mes infos** (gardés dans la base, appliqués tout de suite).
Les textes vus par les visiteurs (accueil, pages légales, bandeau cookies, SEO, page Payez-moi, et les textes imprimés sur les devis, factures et contrats) se modifient dans **admin → Textes du site** : le site change tout de suite, sans nouveau build.

Pars de l'exemple :

```bash
cp .env.example .env
```

| Fichier | Utilisé par |
| ------- | ----------- |
| `.env` | Le développement (`npm run dev`), lu aussi par Docker pour le MySQL local |
| `.env.production` | La production (`npm run build`, `npm run start`) |
| `.env.example` | Le modèle, le seul envoyé sur Git |

> ⚠️ N'envoie jamais `.env` ou `.env.production` sur Git (ils sont dans `.gitignore`).
> Les valeurs du serveur (clé secrète Stripe, SMTP, banque, compte admin) sont lues à la construction du site : **refais un build après les avoir changées**.

## 01 — Variables

| Variable | Ce que c'est |
| -------- | ------------ |
| **Mode** | |
| `NODE_ENV` | `development` ou `production` |
| **Site** (public) | |
| `NUXT_PUBLIC_FRONTEND_DOMAIN` | Adresse du site (`http://localhost:3000` en développement) |
| **Base de données** | |
| `DB_HOST`, `DB_PORT` | Serveur MySQL : `localhost` et `3306` en local (Docker), le serveur donné par Infomaniak en ligne |
| `DB_NAME`, `DB_USER`, `DB_PASS` | Base, utilisateur et mot de passe. En local `djason_cv` / `root` / un long mot de passe aléatoire |
| **Compte admin** (créé au premier démarrage) | |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Identifiants de l'espace admin |
| `SECURITY_ANSWER` | Réponse demandée pour réinitialiser le mot de passe |
| **E-mails (SMTP)** | |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | Serveur qui envoie les codes de connexion et les e-mails |
| `MAIL_LOG_ONLY` | `true` : aucun e-mail ne part, chacun est écrit dans le journal du serveur (tests sur le dev : `MAIL_LOG_ONLY=true npm run dev`) ; vide en ligne |
| **Paiements (Stripe)** | |
| `STRIPE_SECRET_KEY` | Clé secrète (serveur uniquement) |
| `STRIPE_WEBHOOK_SECRET` | Secret de signature du webhook `/api/stripe/webhook` (`whsec_...`) : donné par `stripe listen` en local, par le Dashboard en ligne |
| **Banque** (serveur uniquement, jamais envoyée au navigateur) | |
| `BANK_IBAN`, `BANK_BIC` | Imprimés sur les factures et contrats |
| **Facturation électronique** (Super PDP, serveur seulement) | Admin → Facturation électronique. L'API est coupée par défaut (mode manuel : rien n'est envoyé ni facturé) |
| `SUPERPDP_API_URL` | `https://api.superpdp.tech` (une seule adresse pour le bac à sable et la production) |
| `SUPERPDP_ENV` | `sandbox` (par défaut, en local et en qualif) ou `production` (en ligne) : rien n'est envoyé si l'entreprise des identifiants n'est pas dans cet environnement |
| `SUPERPDP_CLIENT_ID`, `SUPERPDP_CLIENT_SECRET` | Application OAuth2 du compte Super PDP (une entreprise de test comme « Burger Queen », ou la vraie). Vides : mode manuel seulement |
| `SUPERPDP_MOCK` | `true` : une plateforme fictive en mémoire (tests sans compte) ; vide en ligne |
| **Traduction** (MyMemory, gratuit, sans clé) | |
| `MYMEMORY_EMAIL` | Facultatif. Vide : environ 5 000 caractères traduits par jour ; un e-mail : environ 50 000 |
| `GOOGLE_MAPS_API_KEY` | Clé de l'API Google Geocoding (côté serveur) : la région d'une adresse hors de France, affichée sur le site au lieu de la ville. En France : le service public geo.api.gouv.fr. Vide : le pays seulement |
| **Salon visio des rendez-vous** (WebRTC, serveur uniquement) | Donnés seulement aux deux personnes d'un rendez-vous visio, pendant que son salon est ouvert |
| `STUN_URLS` | Facultatif. Serveurs STUN, séparés par des virgules (`stun:hôte:port`). Vide : les serveurs publics de Google et de Cloudflare |
| `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` | Facultatifs, vides par défaut. Relais TURN pour les réseaux qui bloquent l'appel direct (voir plus bas), par exemple `turn:turn.exemple.com:3478,turns:turn.exemple.com:5349?transport=tcp` |
| `TURN_SECRET` | Facultatif, conseillé si le relais le permet (coturn : `static-auth-secret`). Avec lui, le site fabrique pour chaque appel un accès TURN qui expire au bout de 3 heures, au lieu de donner `TURN_USERNAME` / `TURN_CREDENTIAL`, qui sont permanents : un visiteur qui garde l'accès ne peut pas se servir du relais plus tard |

L'ordre est celui de `.env.example` et d'admin → Environnement (une variable absente y apparaît vide : la remplir l'ajoute au fichier).

Tout ce qui commence par `NUXT_PUBLIC_` est visible dans le navigateur : n'y mets jamais de secret.

### Salon visio : STUN et relais TURN

L'appel du salon visio (`/room/<jeton>/`) va directement d'un navigateur à l'autre (WebRTC), chiffré de bout en bout ; le site ne fait que passer les quelques messages qui leur permettent de se trouver. Pour cela, chaque navigateur demande d'abord son adresse publique à un **serveur STUN** (par défaut les serveurs publics gratuits de Google et de Cloudflare) : ce serveur voit les adresses IP des deux personnes, comme pour n'importe quel appel visio, mais rien de l'appel ne passe par lui.

**Sans relais TURN, environ 10 à 15 % des réseaux ne peuvent pas se connecter directement** : certains réseaux d'entreprise (pare-feu stricts), certaines connexions 4G ou certaines box. La page reste alors sur « Connexion… », puis dit que la connexion directe n'aboutit pas. Un **relais TURN** règle ce cas : quand la connexion directe échoue, l'image et le son passent par lui (toujours chiffrés de bout en bout : le relais ne peut pas les lire). Il suffit de remplir `TURN_URLS`, `TURN_USERNAME` et `TURN_CREDENTIAL` (admin → Environnement ou `.env.production`), puis de redémarrer le site.

**Conseil : mettre en ligne d'abord sans relais** (les trois variables vides), faire un appel d'essai en 4G, et n'ajouter un relais que si l'appel ne passe pas. Seuls les appels qui ne passent pas en direct utilisent le relais.

Pour en ajouter un, le plus simple est **Metered** (identifiants fixes, collés tels quels) :

1. Créer un compte gratuit sur [metered.ca](https://www.metered.ca/stun-turn).
2. Tableau de bord → **TURN Server** → **Add Credential** : le site donne un identifiant et un mot de passe.
3. **Show ICE Servers Array** affiche les adresses (`turn:standard.relay.metered.ca:80`, `turns:standard.relay.metered.ca:443?transport=tcp`...) : les mettre dans `TURN_URLS`, séparées par des virgules ; l'identifiant dans `TURN_USERNAME`, le mot de passe dans `TURN_CREDENTIAL`.

L'offre gratuite n'a qu'une région et peu de données par mois (500 Mo indiqués sur la page des prix en novembre 2026) : assez pour quelques appels relayés. **Les prix et les quotas changent : les vérifier sur le site avant de choisir.** À éviter : les identifiants « openrelayproject » des tutoriels (publics et partagés) et le TURN de Cloudflare (identifiants qui changent à chaque appel : il faudrait du code en plus). On peut aussi installer soi-même `coturn` sur un petit serveur.

## 02 — Production

Crée `.env.production` avec les mêmes variables et les vraies valeurs : domaine, clés Stripe **live**, vrai SMTP... Toujours **vides en ligne** : `MAIL_LOG_ONLY` (sinon aucun e-mail ne part) et `STUN_URLS` ; `TURN_*` vides tant qu'il n'y a pas de relais (voir plus haut).
Elles peuvent aussi être modifiées plus tard depuis la page admin (Environnement), qui les réécrit dans le `.env` du mode en cours.

## 03 — Base locale (Docker)

Le MySQL local (`docker-compose.yml`) lit le même `.env` que le site : `start.bat` le donne à Docker.

| Variable | Pour Docker |
| -------- | ----------- |
| `DB_PASS` | Mot de passe de `root`, l'utilisateur avec lequel le site se connecte en local (comme DC Scaffold) |
| `DB_NAME` | Nom de la base créée au premier démarrage |
| `DB_PORT` | Port de MySQL sur cet ordinateur |

Utilise un long mot de passe aléatoire.
MySQL ne lit le mot de passe qu'à la création de `database/` : pour le changer ensuite, change-le aussi dans MySQL (phpMyAdmin → Comptes utilisateurs).

---

<p align="center"><sub><a href="01-demarrer.md">← 01 — Démarrer</a> &nbsp;·&nbsp; <a href="README.md">Documentation</a> &nbsp;·&nbsp; <a href="03-architecture.md">03 — Architecture →</a></sub></p>
