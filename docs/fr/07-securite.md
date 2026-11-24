<p align="center"><img src="../assets/docs-fr.png" alt="Documentation" width="100%" /></p>

# 07 — Sécurité

**DOC-07** &nbsp;·&nbsp; [← Documentation](README.md)

## 01 — Connexion admin

E-mail et mot de passe, puis un code à usage unique envoyé par e-mail. En cas de mot de passe oublié, la réponse de sécurité
(`SECURITY_ANSWER`) est demandée, puis un lien vers `/reset-password/` est envoyé par e-mail (valable une heure, un seul usage,
seul son SHA-256 est gardé dans `dc_password_resets`) ; le nouveau mot de passe ferme toutes les sessions. La réponse est la même,
que l'adresse ait un compte ou non.

## 02 — Routes protégées

La session est vérifiée par le routeur de l'API (`server/api/[...path].ts`) sur la route trouvée :
`/api/env`, `/api/env/` et `/api//env` sont donc la même route protégée.
Seules les actions listées dans `publicActions` d'un contrôleur sont publiques ([toutes les routes](05-l-api.md#04--toutes-les-routes)).

`robots.txt` n'est **pas** une protection : il guide seulement les moteurs de recherche.

## 03 — Limites de tentatives

Les échecs sont gardés dans la base (`dc_rate_limits`), par adresse IP (et, pour le mot de passe, par compte depuis cette adresse : des essais faux bloquent celui qui les tape, jamais l'admin depuis sa propre connexion ; le code reçu par e-mail protège toujours le compte) :

| Tentative | Limite | Bloqué pendant |
| --------- | ------ | -------------- |
| Mauvais mot de passe | 5 | 15 minutes |
| Mauvais code à usage unique | 5 | 15 minutes |
| Mauvaise réponse de sécurité | 3 | 1 heure |
| Vérification de licence / état / lien vers l'espace Stripe (par IP) | 60 / 10 par heure | 15 / 30 minutes |
| Essai gratuit (par IP et par personne) | 5 par jour | 1 jour |
| Demande d'aide (par IP et par adresse) | 5 par heure | 1 heure |
| Pages Stripe : achat de licence, abonnement Payez-moi (par IP) | 20 par heure | 1 heure |

L'IP est l'adresse de la connexion. `X-Forwarded-For` (sa dernière entrée, celle qu'ajoute Apache) ne compte que si la connexion vient d'un proxy : boucle locale, adresse privée, ou un tube (le serveur de dev de Nuxt). Depuis toute autre adresse, un en-tête inventé est ignoré (`SecurityHelper.ip`).

## 04 — Envois de fichiers

- Seulement des images JPG, PNG, GIF, WEBP et AVIF, gardées dans la base (`dc_uploads`)

## 05 — Secrets

- Clé secrète Stripe, SMTP, mot de passe de la base, banque et compte admin restent sur le serveur : jamais dans une variable `NUXT_PUBLIC_`
- Les fichiers `.env` ne sont jamais envoyés sur Git
- Admin → Environnement ne reçoit jamais un secret (noms avec SECRET, PASS, KEY, TOKEN, CREDENTIAL, IBAN, BIC, ANSWER) : seulement `••••` et ses 4 derniers caractères (aucun pour une valeur de moins de 12 caractères). Renvoyé masqué, ou laissé vide, il ne change pas. `SUPERPDP_API_URL` ne peut valoir que `https://api.superpdp.tech` (tests : `SUPERPDP_MOCK=true`)
- `GET /api/settings` (public) ne donne ni la date de naissance (seulement `age`, calculé par le serveur) ni la numérotation des documents (`numbering`) : seul l'admin connecté les reçoit (`SettingsController.getAll`). L'adresse de facturation reste publique : les devis, les factures et le formulaire de rétractation la montrent aux clients (mentions légales)

---

<p align="center"><sub><a href="06-documents-admin.md">← 06 — L'admin et les documents</a> &nbsp;·&nbsp; <a href="README.md">Documentation</a> &nbsp;·&nbsp; <a href="08-mise-en-ligne.md">08 — Mise en ligne →</a></sub></p>

L'adresse d'un rendez-vous en personne n'est jamais dans la liste publique des types de rendez-vous (`GET /api/booking-types`) : seule la personne qui a réservé la reçoit (page de confirmation et e-mail).
