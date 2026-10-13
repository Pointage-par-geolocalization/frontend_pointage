# Contrat d'API attendu par le frontend

Le frontend n'utilise plus Firebase : toutes les données passent par une API REST JSON
(`VITE_API_URL`, par défaut `/api/v1`) et un canal temps réel optionnel. Ce document liste
**exactement** ce que le frontend appelle. Il reprend le §16 du
`cahier-des-charges-migration-postgresql.pdf` et le complète pour les nouvelles fonctionnalités
(objectifs 10, 12 à 16 de `objectifs-du-site-web-complet.pdf`).

**Source de vérité des formats** : les interfaces TypeScript de `src/services/*.ts` (un fichier par
domaine). Les réponses doivent utiliser ces noms de champs (camelCase).

Un faux serveur qui respecte ce contrat existe dans `src/mocks/` (mode démo : `npm run dev:mock`) ;
il peut servir de référence exécutable pour le backend.

## Conventions

- Dates-instants en ISO 8601 (`"2026-10-08T07:58:00.000Z"`), jours en `"YYYY-MM-DD"` (jour de
  Madagascar, `Indian/Antananarivo`), montants en entiers (Ariary).
- Le code salarié (`EMP-001`) s'appelle `employeeCode` partout (requêtes et réponses).
- Erreur : statut 4xx/5xx + `{ "error": { "code": "…", "message": "…", "details": {…} } }`.
  `message` est en français et affiché tel quel. Codes utilisés par le front :
  `GPS_OUT_OF_RANGE` (422, `details: { distance, radiusMeters }`), `AMOUNT_EXCEEDS_DUE`,
  `HAS_HISTORY`, `INVALID_INVITE_CODE`, `ACCOUNT_DISABLED` (403), `RATE_LIMITED` (429).
- Réponse 204 ou corps vide accepté pour les actions sans résultat.

## Authentification (`services/auth.ts`, `services/api.ts`)

| Méthode | Route | Corps → Réponse |
|---|---|---|
| POST | `/auth/login` | `{ identifier, password }` → `{ accessToken, user: AppUser }` + cookie HttpOnly de rafraîchissement |
| POST | `/auth/register-admin` | `{ email, password, inviteCode }` → idem login |
| POST | `/auth/refresh` | (cookie) → `{ accessToken }` ; 401 si pas de session |
| GET | `/auth/me` | → `AppUser { id, role, employeeCode?, email, name? }` |
| POST | `/auth/logout` | révoque le cookie |
| POST | `/auth/verify-password` | `{ password }` (admin) → 204, ou **403** si incorrect (jamais 401 : le front fermerait la session) |

Le jeton d'accès est envoyé en `Authorization: Bearer …` ; toutes les requêtes sont faites avec
`credentials: "include"` (CORS : `Access-Control-Allow-Credentials: true`). Sur 401, le front appelle
`/auth/refresh` une fois puis rejoue la requête.

## Salariés, lieux, paramètres

| Méthode | Route | Notes |
|---|---|---|
| GET | `/employees` | `Employee[]` trié par nom |
| GET | `/employees/:code` · `/me/employee` | `Employee` |
| POST | `/employees` | `{ employeeCode, firstName, lastName, email, phone, position, hireDate, address, baseDailySalary, departmentIds[≥1], password(≥6) }` — fiche + compte |
| PATCH | `/employees/:code` | champs modifiables (jamais `active`) |
| PATCH | `/employees/:code/active` | `{ active }` |
| DELETE | `/employees/:code` | 409 `HAS_HISTORY` si pointages/paiements |
| PUT | `/employees/:code/password` | `{ newPassword }` (sans l'ancien), révoque les sessions |
| GET | `/employees/:code/balance` · `/me/balance` | `{ earned, paid, due }` |
| GET/POST/PATCH/DELETE | `/workplaces[/:id]` | `Workplace` |
| GET / PUT | `/settings` | `AppSettings` (rémunération + contrôle de présence + coordonnées entreprise) |

## Pointage, rémunération, rapports, tableau de bord

| Méthode | Route | Notes |
|---|---|---|
| POST | `/attendance/clock-in` | `{ workplaceId, location }` → `{ attendance, gpsCheck }` |
| POST | `/attendance/clock-out` | `{ location }` → `{ workedMinutes, dailySalary, gpsCheck }` |
| GET | `/me/attendance/today` | `Attendance[]` (ordre chronologique) |
| GET | `/me/attendance?limit=60` | `Attendance[]` (récent → ancien) |
| GET | `/attendance?date=&from=&to=&employeeCode=&siteId=` | `Attendance[]` avec `employeeName`, `siteName` |
| POST | `/admin/attendance/clock-in` | `{ employeeCode, workplaceId }` |
| POST | `/admin/attendance/:id/clock-out` | `{ exitTime? }` (ISO, ≥ entrée, ≤ maintenant) — permet de clôturer une session oubliée d'un jour précédent |
| GET | `/me/salary` | `{ records: SalaryRecord[], earned, paid, due, totalMinutes }` |
| GET | `/salary/summary` | `{ rows: [{ employee, earned, paid, due }], totals: { earned, paid, due } }` |
| POST | `/payments` | `{ employeeCode, amount, note }` |
| GET | `/payments?employeeCode=` · `/me/payments` | `Payment[]` |
| GET | `/reports/salary?from=&to=&siteId=` | `{ rows: [{ employeeCode, name, days, minutes, total }], total }` |
| GET | `/dashboard/today` | `DashboardToday` (`services/admin.ts`) : compteurs, absents, en permission, top 5, en poste, retards, cash restant, demandes en attente, chantiers actifs, dernier contrôle de présence + anomalies du jour |
| POST | `/admin/reset-data` | `{ password }` — 403 si mot de passe incorrect |
| GET | `/audit-logs?action=&from=&to=&limit=` | `AuditLog[]` |

## Matériel (`services/equipment.ts`)

`GET /equipment` (avec `currentLoanId`, `currentBorrowerCode`, `currentBorrowerName`, `currentLoanedAt`),
`POST /equipment`, `PATCH /equipment/:id`, `PATCH /equipment/:id/out-of-service { outOfService }`,
`DELETE /equipment/:id`, `GET /loans`, `GET /me/loans`, `GET /loans/pending-count → { count }`,
`POST /loans { equipmentId, note, expectedReturnDate }`, `POST /loans/:id/cancel`,
`POST /loans/:id/return-request { note }`, `POST /loans/:id/approve`, `POST /loans/:id/refuse { reason }`,
`POST /loans/:id/confirm-return`.

## Messagerie (`services/chat.ts`)

`GET /chats` → `Chat[]` avec `memberIds` (ids utilisateur) et `unreadCount` ;
`POST /chats/groups { name, announcement } → { id }` ; `POST /chats/direct { employeeCode } → { id }` ;
`POST /chats/:id/join|leave` ; `GET /chats/:id/messages?limit=300` → `ChatMessage[]`
(`senderId`, `reactions: { emoji: userId[] }`, `replyTo`) ; `POST /chats/:id/messages { text, replyToId }` ;
`PUT /chats/:id/messages/:mid/reactions/:emoji` (bascule) ; `DELETE /chats/:id/messages/:mid` ;
`POST /chats/:id/clear` ; `DELETE /chats/:id` ; `PUT /chats/:id/read` ; `GET /chats/:id/reads` → `ReadReceipt[]`.

## Nouvelles fonctionnalités

### Permissions — objectif 13 (`services/leaves.ts`)

| Méthode | Route | Notes |
|---|---|---|
| GET | `/me/leaves` | `LeaveRequest[]` du salarié |
| POST | `/leaves` | `{ type, startDate, durationValue, durationUnit: "JOURS"\|"HEURES", reason, siteId? }` — le serveur calcule `endDate` |
| POST | `/leaves/:id/cancel` | salarié, statut `EN_ATTENTE` uniquement |
| POST | `/me/leaves/seen` | marque les décisions comme vues (`employeeSeenAt`) |
| GET | `/leaves?status=&employeeCode=&siteId=&from=&to=` | admin |
| GET | `/leaves/pending-count` | `{ count }` |
| POST | `/leaves/:id/approve` · `/leaves/:id/refuse` | `{ note? }` — émettre `leave.updated` vers le salarié |

### Contrôles de présence — objectif 12 (`services/presence.ts`)

| Méthode | Route | Notes |
|---|---|---|
| POST | `/me/presence/ping` | `{ location }` pendant une session ouverte → `{ withinRadius, distance, radiusMeters, departmentName }` ; 409 sinon |
| GET | `/presence/rounds?from=&to=&limit=` | `PresenceRound[]` |
| GET | `/presence/checks?roundId=&date=&employeeCode=&siteId=&status=` | `PresenceCheck[]` |
| POST | `/presence/rounds` | lance une ronde immédiate → `PresenceRound` |

Fonctionnement attendu côté serveur : toutes les `presenceCheckIntervalMinutes` (si
`presenceCheckEnabled`), créer une ronde pour chaque session `EN_COURS`, envoyer l'événement
`presence.request` aux salariés concernés, attendre quelques minutes, puis comparer la dernière
position reçue (pings) à la zone du lieu de pointage : `PRESENT`, `HORS_ZONE` ou `SANS_REPONSE`
(pas de position récente). Le front envoie aussi une position toutes les 10 minutes quand
l'application est ouverte.

### Chantiers — objectif 16 (`services/sites.ts`)

`GET /sites` → `Site[]` ; `GET /sites/:id` → `SiteDetail` (membres, étapes, journal, `stats`) ;
`GET /me/sites` ; `POST /sites` → `{ id }` ; `PATCH /sites/:id` ; `DELETE /sites/:id` ;
`PUT /sites/:id/members { employeeCodes }` (ajoute le lieu du chantier aux départements autorisés
des membres) ; `POST /sites/:id/steps`, `PATCH|DELETE /sites/:id/steps/:stepId` ;
`POST /sites/:id/notes { text }`, `DELETE /sites/:id/notes/:noteId`.
Un pointage fait sur le lieu de travail d'un chantier actif est rattaché à ce chantier (`siteId`).
`progress` = étapes terminées / total, ou `manualProgress` s'il n'y a pas d'étapes.

### Clients, devis et factures — objectifs 14 et 15 (`services/clients.ts`, `services/documents.ts`)

`GET|POST /clients`, `PATCH|DELETE /clients/:id`.
`GET /documents?type=&status=&clientId=&siteId=&q=&from=&to=` → `DocumentSummary[]` ;
`GET /documents/:id` → `BusinessDocument` (avec `versions`) ;
`GET /documents/:id/versions/:version` → `{ version, snapshot }` ;
`POST /documents` → `{ id, number }` (numéro attribué par le serveur : `DEV-AAAA-0001`, `FAC-AAAA-0001`) ;
`PATCH /documents/:id` (devis `BROUILLON`/`ENVOYE`, facture `BROUILLON` uniquement ; chaque
modification crée une version) ; `POST /documents/:id/status { status }` ;
`POST /documents/:id/invoice` (facture brouillon depuis un devis) → `{ id, number }` ;
`DELETE /documents/:id` (brouillons uniquement). Les montants sont recalculés par le serveur
(`amount = round(quantity × unitPrice)`, TVA, total). L'impression et le PDF sont faits par le
navigateur (page `/admin/documents/:id`).

## Temps réel (`services/realtime.ts`)

WebSocket sur `VITE_WS_URL` ou `VITE_API_URL + /ws`, authentifié par `?token=<jeton d'accès>`
(fermer avec le code `4401` si le jeton est expiré). Messages JSON `{ "type": "…", … }` envoyés
uniquement aux utilisateurs autorisés. Le front recharge les données concernées à la réception :

`chat.updated`, `chat.deleted`, `chat.cleared`, `chat.read`, `message.created`, `message.deleted`,
`message.reactions` (avec `chatId`) · `equipment.updated`, `loan.updated`, `loans.pending` ·
`leave.updated` · `presence.updated`, `presence.request` (vers un salarié) · `attendance.updated` ·
`session.revoked` (salarié désactivé : le front ferme la session).

Sans WebSocket, le front fonctionne quand même : il rafraîchit périodiquement (5 à 30 s selon l'écran).
