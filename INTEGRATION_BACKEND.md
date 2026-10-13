# Intégration du frontend Pointage Fortico avec FastAPI

## Synthèse

Le backend se trouve dans [`backend/`](backend/README.md). Il expose l’API sous `/api/v1`, a **81 chemins OpenAPI (103 opérations, utilitaires inclus)** et utilise PostgreSQL. Les fonctions du frontend (paie/pointage, salariés, chantiers, clients/devis/factures, congés, équipement/prêts, chat et temps réel) ont été rapprochées des services TypeScript, handlers mock et règles du PDF fourni.

## Développement local — aucun changement de code frontend nécessaire

Le frontend utilise déjà les variables suivantes dans `src/services/api.ts` :

```ts
export const API_URL = (import.meta.env.VITE_API_URL ?? "/api/v1").replace(/\/+$/, "")
export const MOCK_MODE = import.meta.env.VITE_MOCK === "true"
```

`vite.config.ts` possède déjà un proxy `/api` vers `http://localhost:4000` avec proxy WebSocket. Après avoir lancé le backend, créer à la racine du frontend `.env.local` :

```dotenv
VITE_API_URL=/api/v1
VITE_MOCK=false
```

Lancer l’interface avec `npm run dev`. `npm run dev:mock` et `npm run build:demo` sélectionnent le serveur simulé ; ne pas les utiliser pour une recette PostgreSQL.

### Démarrer l’API

```bash
cd backend
cp .env.example .env
# Remplacer les secrets de développement selon backend/README.md
docker compose up --build -d
```

Endpoints : `http://localhost:4000/health`, `http://localhost:4000/ready`, `http://localhost:4000/docs`.
En Compose local, Alembic applique automatiquement les révisions avant le démarrage de l’API. Pour une base existante créée avant Alembic, sauvegarder et vérifier précisément le schéma; ne faire `alembic stamp b652075ff233` que si la base correspond réellement à cette révision, puis `alembic upgrade head`.

## Configuration frontend pour une API distante

Le domaine public de l’API n’est pas fourni : ne pas remplacer `VITE_API_URL` par une adresse inventée. Une fois l’API publiée en HTTPS, définir les variables de build Vite dans l’hébergeur :

Le fichier racine `.env.production.example` contient le modèle à copier vers `.env.production` après remplacement de `api.example.com` par le vrai domaine.

```dotenv
VITE_MOCK=false
VITE_API_URL=https://<domaine-api>/api/v1
VITE_WS_URL=wss://<domaine-api>/api/v1/ws
```

Si l’API est publiée sous le même domaine et le même préfixe que le site, conserver `VITE_API_URL=/api/v1` et configurer le reverse proxy pour transmettre `/api/v1/*` à FastAPI, y compris l’upgrade WebSocket sur `/api/v1/ws`.

### Vercel

Le `vercel.json` actuel utilise volontairement `npm run build:demo`. Pour passer aux données réelles, une fois le domaine backend prêt :

1. Définir `VITE_MOCK=false`, `VITE_API_URL` et `VITE_WS_URL` dans les variables d’environnement Vercel pour Production et les environnements de recette requis.
2. Modifier le build :

```diff
-  "buildCommand": "npm run build:demo",
+  "buildCommand": "npm run build",
```

3. Redéployer et vérifier dans l’onglet Réseau du navigateur que `/api/v1/auth/login` reçoit une réponse JSON de l’API, et non `index.html` du frontend.

Laisser le build démo actif jusque-là évite de casser le site actuel. Pour Android/Capacitor, compiler avec les mêmes valeurs `VITE_*`, utiliser une API HTTPS accessible par le téléphone et autoriser l’origine réellement chargée par la WebView. Après modification, reconstruire et re-signer l’application.

## CORS, cookies et sessions

Le refresh token est un cookie `HttpOnly`, rotatif et limité à `/api/v1/auth`; le frontend garde le token d’accès en mémoire et le renouvelle après un 401. Côté backend :

- développement : `FRONTEND_ORIGINS=http://localhost:5173`, `COOKIE_SECURE=false`, `COOKIE_SAMESITE=lax` ;
- production : origines exactes (pas `*`), HTTPS et `COOKIE_SECURE=true` ; si frontend et API sont cross-site, `COOKIE_SAMESITE=none` (obligatoirement Secure) ;
- le proxy de production doit autoriser `Authorization`, `Content-Type`, `Accept`, les requêtes avec credentials et les connexions WebSocket.
- appliquer `alembic upgrade head` une seule fois par déploiement avant les nouvelles instances, avec `RUN_MIGRATIONS=false` sur les réplicas ; ne pas utiliser `AUTO_CREATE_SCHEMA`.

Le WebSocket est `/api/v1/ws?token=<accessToken>` ; en cas de déconnexion, le client garde son mécanisme REST de resynchronisation/polling.

## Domaines API

Les opérations sous `/api/v1` couvrent authentification, profils, salariés et workplaces, pointages/GPS, présence, paramètres, paie/paiements, audit, congés, équipement/prêts, chats/messages, chantiers/étapes/notes, clients et documents. Les erreurs respectent le contrat `src/services/api.ts` :

```json
{"error":{"code":"VALIDATION_ERROR","message":"…","details":null}}
```

## Vérifications effectuées

- compilation Python et import FastAPI ; génération du schéma OpenAPI ;
- compilation frontend `npm run build` réussie ; comparaison automatique des 78 templates d’URL statiques extraits des services TypeScript : aucune route utilisée sans handler trouvé ;
- migration PostgreSQL initiale : `upgrade → current → downgrade → upgrade` sur une base PostgreSQL 16 vierge ;
- nouvelle migration `b652075ff233` appliquée à des enregistrements d’essai JSONB : downgrade restaure 2 matériels et 2 prêts dans JSONB, puis upgrade les remet dans les tables relationnelles sans perte ; `alembic check` ne détecte aucune divergence ;
- test HTTP/PostgreSQL : bootstrap admin, authentification, workplace, salarié, connexion salarié insensible à la casse, entrée/sortie, solde, readiness et enveloppe d’erreur ;
- migration `0be719ba5a41` : clients, chantiers/membres/étapes/notes, documents/lignes/versions/compteurs et conversations/membres/messages/réactions/lectures sont déplacés de `domain_records` vers des tables relationnelles ; `downgrade → JSONB → upgrade` est validé sur les domaines remplis et `alembic check` ne détecte aucune divergence ;
- tests HTTP PostgreSQL : CRUD client/chantier, remplacement d’équipe, étapes/notes, création et lecture de devis/version, groupe, message, réaction, lecture ; suppression d’un client lié vérifiée en conservant le snapshot sur chantier et document ;
- cycle HTTP complet matériel/prêt dans les nouvelles tables : demande, approbation, retour, confirmation, suppression d’équipement avec préservation de l’historique ; autres flux : TVA → devis/facture, congé et présence ;
- syntaxe YAML de Compose vérifiée ; le binaire Docker n’étant pas installé dans l’environnement de validation, l’image Docker elle-même n’a pas pu être construite ici.

## Limites à connaître avant le transfert en production

- Les comptes, pointages/paie, matériel/prêts, clients, chantiers, documents et messagerie utilisent des tables PostgreSQL relationnelles avec clés étrangères, tables de détail et index. Les migrations Alembic `b652075ff233` et `0be719ba5a41` reprennent les anciennes lignes JSONB; le downgrade de la seconde restaure les formats historiques pour retour arrière. Les principaux domaines qui restent dans `domain_records` sont les congés et les contrôles/rondes GPS.
- Aucun dump Firestore/Firebase ni accès au projet source n’était joint : **aucune donnée existante n’a été importée**. Il faut un export autorisé et un mapping vérifié avant migration. Les mots de passe Firebase ne sont pas récupérables en clair ; prévoir une procédure de réinitialisation/invitation.
- Les WebSockets sont gérés en mémoire et supposent une seule instance API. Ajouter un broker partagé (ex. Redis) avant de scaler horizontalement.

Ces limites ne bloquent pas le lancement local front + backend, mais doivent être traitées avant de déclarer les données existantes migrées ou de lancer plusieurs réplicas en production.
