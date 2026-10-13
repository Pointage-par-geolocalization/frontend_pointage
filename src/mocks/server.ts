// src/mocks/server.ts
//
// MODE DÉMO UNIQUEMENT (npm run dev:mock, VITE_MOCK=true) : faux serveur qui répond aux appels
// de src/services/api.ts à la place de l'API réelle, dans le navigateur. Il applique les mêmes
// règles que le contrat d'API (docs/contrat-api-frontend.md). Jamais inclus dans le build de
// production : api.ts ne l'importe que si VITE_MOCK vaut "true".
import "./handlers/core"
import "./handlers/attendance"
import "./handlers/equipment-leaves"
import "./handlers/chat"
import "./handlers/business"
import { API_URL } from "../services/api"
import { findRoute, MockError } from "./router"
import { getDb, saveDb, type MockUser } from "./store"
import { listenOtherTabs, publish, sessionUserId } from "./events"
import { isActive } from "./handlers/core"
import { presenceTick } from "./handlers/attendance"

listenOtherTabs()

/** « Tâche planifiée » : évalue les contrôles de présence et lance les contrôles automatiques. */
setInterval(() => {
  const db = getDb()
  if (presenceTick(db)) { saveDb(); publish({ type: "presence.updated" }) }
}, 5000)

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status: body === undefined ? 204 : status, headers: { "Content-Type": "application/json" } })
const error = (status: number, code: string, message: string, details?: unknown) => json(status, { error: { code, message, details } })

const latency = () => new Promise((r) => setTimeout(r, 120 + Math.random() * 180))

function userFromToken(header: string | null): MockUser | null {
  const token = header?.startsWith("Bearer ") ? header.slice(7) : ""
  if (!token.startsWith("mock.")) return null
  return getDb().users.find((u) => u.id === token.slice(5)) ?? null
}

export async function mockFetch(url: string, init: RequestInit = {}): Promise<Response> {
  await latency()
  const method = (init.method ?? "GET").toUpperCase()
  const full = new URL(url, window.location.origin)
  const base = new URL(API_URL, window.location.origin).pathname.replace(/\/+$/, "")
  const path = full.pathname.startsWith(base) ? full.pathname.slice(base.length) || "/" : full.pathname

  const found = findRoute(method, path)
  if (!found) return error(404, "NOT_FOUND", `Route inconnue du serveur de démonstration : ${method} ${path}`)

  const db = getDb()
  if (presenceTick(db)) saveDb()

  // Session : jeton d'accès sur les requêtes, « cookie » (sessionStorage de l'onglet) pour le rafraîchissement.
  const headers = new Headers(init.headers)
  const user = path === "/auth/refresh"
    ? db.users.find((u) => u.id === sessionUserId()) ?? null
    : userFromToken(headers.get("Authorization"))

  const { access } = found.def
  if (access !== "public") {
    if (!user || !isActive(db, user)) return error(401, "UNAUTHENTICATED", "Session expirée. Veuillez vous reconnecter.")
    if (access === "admin" && user.role !== "admin") return error(403, "FORBIDDEN", "Accès réservé à l'administrateur.")
    if (access === "employee" && user.role !== "employee") return error(403, "FORBIDDEN", "Accès réservé aux salariés.")
  }

  let body: any = {}
  if (typeof init.body === "string" && init.body) {
    try { body = JSON.parse(init.body) } catch { return error(400, "VALIDATION_ERROR", "Corps de requête JSON invalide.") }
  }

  try {
    const result = found.def.handler({ method, path, params: found.params, query: full.searchParams, body: body ?? {}, user: user!, db })
    if (method !== "GET") saveDb()
    return json(200, result === undefined ? undefined : JSON.parse(JSON.stringify(result)))
  } catch (e) {
    if (e instanceof MockError) return error(e.status, e.code, e.message, e.details)
    console.error("[démo] erreur du faux serveur", e)
    return error(500, "INTERNAL_ERROR", "Erreur interne du serveur de démonstration.")
  }
}
