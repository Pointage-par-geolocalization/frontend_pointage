// src/mocks/router.ts — table des routes du faux serveur (mode démo).
import type { MockDb, MockUser } from "./store"

/** Erreur renvoyée au front au format de l'API : { error: { code, message, details } }. */
export class MockError extends Error {
  status: number
  code: string
  details?: unknown
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export type Access = "public" | "any" | "admin" | "employee"

export interface Ctx {
  method: string
  path: string
  params: Record<string, string>
  query: URLSearchParams
  body: any
  /** Utilisateur connecté (null pour une route publique sans session). */
  user: MockUser
  db: MockDb
}

type Handler = (ctx: Ctx) => unknown

interface RouteDef { method: string; pattern: RegExp; keys: string[]; access: Access; handler: Handler }

const routes: RouteDef[] = []

export function route(method: string, path: string, access: Access, handler: Handler) {
  const keys: string[] = []
  const pattern = new RegExp("^" + path.replace(/:(\w+)/g, (_, k: string) => { keys.push(k); return "([^/]+)" }) + "$")
  routes.push({ method, pattern, keys, access, handler })
}

export function findRoute(method: string, path: string) {
  for (const r of routes) {
    if (r.method !== method) continue
    const m = r.pattern.exec(path)
    if (!m) continue
    const params: Record<string, string> = {}
    r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]) })
    return { def: r, params }
  }
  return null
}

// ---------- Aides à la validation ----------

export const fail = (status: number, code: string, message: string, details?: unknown): never => {
  throw new MockError(status, code, message, details)
}
export const notFound = (message = "Élément introuvable."): never => fail(404, "NOT_FOUND", message)
export const invalid = (message: string): never => fail(400, "VALIDATION_ERROR", message)

export const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")
export const optStr = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)
export const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)
export const optDay = (v: unknown) => (isDay(v) ? v : null)
export function num(v: unknown, label: string, opts: { min?: number; max?: number; int?: boolean } = {}): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN
  if (!Number.isFinite(n)) invalid(`Champ « ${label} » invalide.`)
  if (opts.min !== undefined && n < opts.min) invalid(`Champ « ${label} » : valeur minimale ${opts.min}.`)
  if (opts.max !== undefined && n > opts.max) invalid(`Champ « ${label} » : valeur maximale ${opts.max}.`)
  return opts.int ? Math.round(n) : n
}
