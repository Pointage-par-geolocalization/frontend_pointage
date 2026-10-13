# Pointage & Rémunération

Application de gestion des salariés, pointage GPS, rémunération et suivi des chantiers — **React 18 + TypeScript + Vite + Tailwind**, application Android via Capacitor, API **FastAPI + PostgreSQL**.

Le frontend parle en JSON camelCase sous `/api/v1`. Le contrat des routes/formats est dans [`docs/contrat-api-frontend.md`](docs/contrat-api-frontend.md), le cahier de migration PostgreSQL dans [`docs/cahier-des-charges-migration-postgresql.pdf`](docs/cahier-des-charges-migration-postgresql.pdf) et le guide d’intégration dans [`INTEGRATION_BACKEND.md`](INTEGRATION_BACKEND.md).

## Frontend local

```bash
npm ci
cp .env.example .env.local
# .env.local : VITE_API_URL=/api/v1 et VITE_MOCK=false
npm run dev
```

Le proxy Vite redirige `/api` (REST et WebSocket) vers `http://localhost:4000`. Pour tester la vraie API, démarrer le backend comme expliqué dans [`backend/README.md`](backend/README.md) et utiliser `npm run dev`.

## Backend local

Prérequis : Docker Compose ou PostgreSQL 16, et Python 3.12. Depuis `backend/` :

```bash
cp .env.example .env
# Modifiez les valeurs locales/secrets dans .env
docker compose up --build -d
```

L’API écoute sur `http://localhost:4000`; documentation interactive : `/docs`, readiness PostgreSQL : `/ready`. Les migrations, le compte admin, les tests et la configuration de production sont documentés dans [`backend/README.md`](backend/README.md).

## Configuration d’une API de production

Le déploiement actuel de Vercel reste en mode démo tant que l’API n’a pas de domaine public configuré. Après déploiement de l’API, définir `VITE_MOCK=false`, `VITE_API_URL` et `VITE_WS_URL`, puis remplacer dans `vercel.json` `npm run build:demo` par `npm run build`. Les étapes CORS/cookies/Capacitor et les limites restantes (import Firebase à partir d’un export autorisé, domaines congés/contrôles GPS encore en JSONB, WebSocket mono-instance) figurent dans [`INTEGRATION_BACKEND.md`](INTEGRATION_BACKEND.md).

## Mode démo (sans backend)

```bash
npm run dev:mock
```

Un faux serveur intégré au navigateur (`src/mocks/`) remplace l’API avec des données d’exemple : salariés, pointages/paie, matériel, discussions, permissions, chantiers, clients, devis/factures et contrôles de présence. Comptes de démonstration (démo seulement) : admin `admin@fortico.mg` / `admin123`, salarié `EMP-001` / `123456`.

- Les données sont conservées dans le `localStorage` du navigateur ; deux onglets du même navigateur peuvent simuler les échanges en direct.
- « Réinitialiser les données de démo » régénère les exemples.
- Le lieu « Entrepôt Tanambao » permet un pointage sans contrôle GPS ; les autres lieux refusent les positions hors rayon.
- Le faux serveur n’est intégré qu’au `npm run build:demo`, pas au build normal.

## Déploiement Vercel actuel

`vercel.json` utilise encore `npm run build:demo`. Le site Vercel et l’application Android qui charge cette URL restent donc sur des données de démonstration indépendantes. Cela ne signifie pas que le backend local est absent : son code est dans `backend/`; il faut encore publier l’API, définir son URL publique et basculer le build avant de connecter les utilisateurs.

## Fonctionnalités

| Espace administrateur | Espace salarié (mobile) |
|---|---|
| Tableau de bord (présents, absents, retards, en poste, paie du jour, cash restant, contrôles de présence, demandes en attente) | Pointage entrée / sortie avec contrôle GPS, salaire estimé en direct |
| Salariés (comptes de connexion, activation, mot de passe) | Historique des pointages |
| Présences (pointage à distance, clôture d'une session oubliée) | Rémunération et paiements reçus |
| Contrôles de présence (vérification régulière de la position sur le chantier) | Demandes de permission et décisions |
| Carte des pointages | Matériel (emprunt, retour) |
| Chantiers (équipe, étapes, journal, pointages, permissions, documents) | Discussions |
| Permissions, rémunérations, rapports (CSV) | Profil |
| Devis & factures (numérotation, versions, impression/PDF), clients | |
| Discussions, matériel, lieux de travail, journal des actions, paramètres | |

## Règle de rémunération

- Une journée complète (8 h par défaut) donne le salaire journalier du salarié ; le calcul est proportionnel en dessous, plafonné au salaire du jour et arrondi à l’Ariary.
- Plusieurs pointages le même jour : le plafond s’applique au total journalier.
- Paramètres → Rémunération : salaire proposé par défaut, durée normale, heure d’entrée et tolérance.

## Application Android

`capacitor.config.ts` charge le site déployé (`server.url`). Plugins : géolocalisation native et notifications locales (messages, décisions de permission, contrôles de présence). Aucun service Google/Firebase n’est utilisé dans le fonctionnement de l’application.
"# Frontend" 
