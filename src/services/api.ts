// src/services/api.ts
//
// Client HTTP unique de l'application : toutes les données passent par l'API REST
// (voir docs/contrat-api-frontend.md). Le jeton d'accès est gardé en mémoire ; le
// jeton de rafraîchissement est un cookie HttpOnly posé par l'API. Sur une réponse 401,
// on tente UNE fois de rafraîchir la session puis on rejoue la requête.

export const API_URL = (import.meta.env.VITE_API_URL ?? "/api/v1").replace(/\/+$/, "")

/** Mode démo (npm run dev:mock) : un faux serveur dans le navigateur répond à la place de l'API. */
export const MOCK_MODE = import.meta.env.VITE_MOCK === "true"

/** fetch, ou le faux serveur en mode démo (chargé à la demande, absent du build de production). */
async function transport(url: string, init: RequestInit): Promise<Response> {
  if (MOCK_MODE) {
    const { mockFetch } = await import("../mocks/server")
    return mockFetch(url, init)
  }
  return fetch(url, init)
}

/** Erreur renvoyée par l'API : `message` est en français et s'affiche tel quel dans l'interface. */
export class ApiError extends Error {
  status: number
  code: string
  details?: any
  constructor(status: number, code: string, message: string, details?: any) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.details = details
  }
}

let accessToken: string | null = null
let refreshing: Promise<boolean> | null = null
const expiredListeners = new Set<() => void>()

export function setAccessToken(token: string | null) { accessToken = token }
export function getAccessToken() { return accessToken }

/** Appelé quand la session ne peut plus être rafraîchie (déconnexion forcée). */
export function onSessionExpired(cb: () => void) {
  expiredListeners.add(cb)
  return () => { expiredListeners.delete(cb) }
}

type Query = Record<string, string | number | boolean | null | undefined>

export function apiUrl(path: string, query?: Query): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v))
  }
  const s = qs.toString()
  return `${API_URL}${path}${s ? `?${s}` : ""}`
}

/** Réponse qui ne vient pas de l'API (page HTML, 404/405 de l'hébergeur…) : API absente ou mal configurée. */
const apiUnavailable = (status: number) =>
  new ApiError(status, "API_UNAVAILABLE", "Le serveur de l'application est injoignable. Réessayez plus tard ou contactez l'administrateur.")

async function toError(res: Response): Promise<ApiError> {
  let body: any = null
  try { body = await res.json() } catch { /* corps vide ou non JSON */ }
  const err = body?.error
  if (err?.message) return new ApiError(res.status, err.code ?? "ERROR", err.message, err.details)
  // L'API répond toujours { error: { code, message } } : sinon ce n'est pas elle qui a répondu.
  return apiUnavailable(res.status)
}

/** Rafraîchit le jeton d'accès à partir du cookie de session. Plusieurs appels simultanés partagent la même requête. */
export function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = transport(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return false
        const data = await res.json()
        setAccessToken(data.accessToken ?? null)
        return !!data.accessToken
      })
      .catch(() => false)
      .finally(() => { refreshing = null })
  }
  return refreshing
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: unknown
  query?: Query
  /** false : pas de tentative de rafraîchissement sur 401 (connexion, rafraîchissement…). */
  retry?: boolean
}

async function send(path: string, opts: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" }
  if (opts.body !== undefined) headers["Content-Type"] = "application/json"
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  try {
    return await transport(apiUrl(path, opts.query), {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: "include",
    })
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Connexion au serveur impossible. Vérifiez votre connexion internet.")
  }
}

export async function api<T = void>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res = await send(path, opts)
  if (res.status === 401 && opts.retry !== false) {
    if (await refreshSession()) {
      res = await send(path, opts)
    }
    if (res.status === 401) {
      setAccessToken(null)
      expiredListeners.forEach((cb) => cb())
    }
  }
  if (!res.ok) throw await toError(res)
  if (res.status === 204) return undefined as T
  const text = await res.text()
  if (!text) return undefined as T
  try { return JSON.parse(text) as T } catch { throw apiUnavailable(res.status) }
}

export const get = <T>(path: string, query?: Query) => api<T>(path, { query })
export const post = <T = void>(path: string, body?: unknown) => api<T>(path, { method: "POST", body: body ?? {} })
export const put = <T = void>(path: string, body?: unknown) => api<T>(path, { method: "PUT", body: body ?? {} })
export const patch = <T = void>(path: string, body?: unknown) => api<T>(path, { method: "PATCH", body: body ?? {} })
export const del = <T = void>(path: string) => api<T>(path, { method: "DELETE" })

/** Message d'erreur affichable pour un `catch`. */
export const errorMessage = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback)
