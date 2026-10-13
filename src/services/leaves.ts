// src/services/leaves.ts
// Demandes de permission : le salarié demande (type, date, durée, motif), l'admin accepte ou refuse,
// le salarié est informé de la décision. L'historique garde chaque demande avec son statut.
import { get, post } from "./api"
import { emitLocal, live } from "./realtime"

export type LeaveType = "CONGE" | "MALADIE" | "FAMILLE" | "ADMINISTRATIF" | "AUTRE"
export type LeaveStatus = "EN_ATTENTE" | "ACCEPTEE" | "REFUSEE" | "ANNULEE"
export type DurationUnit = "JOURS" | "HEURES"

export interface LeaveRequest {
  id: string
  employeeCode: string
  employeeName: string
  type: LeaveType
  startDate: string // YYYY-MM-DD
  /** Dernier jour couvert (calculé par le serveur à partir de la durée). */
  endDate: string
  durationValue: number
  durationUnit: DurationUnit
  reason: string
  siteId?: string | null
  siteName?: string | null
  status: LeaveStatus
  decidedAt?: string | null
  decidedByName?: string | null
  decisionNote?: string | null
  /** Le salarié a vu la décision (sinon : badge « nouveau »). */
  employeeSeenAt?: string | null
  createdAt: string
}

export interface LeaveInput {
  type: LeaveType
  startDate: string
  durationValue: number
  durationUnit: DurationUnit
  reason: string
  siteId?: string | null
}

type Tone = "green" | "red" | "yellow" | "gray" | "blue"

export const LEAVE_TYPES: Record<LeaveType, string> = {
  CONGE: "Congé",
  MALADIE: "Maladie",
  FAMILLE: "Événement familial",
  ADMINISTRATIF: "Démarche administrative",
  AUTRE: "Autre",
}

export const LEAVE_STATUS: Record<LeaveStatus, { label: string; tone: Tone }> = {
  EN_ATTENTE: { label: "En attente", tone: "yellow" },
  ACCEPTEE: { label: "Acceptée", tone: "green" },
  REFUSEE: { label: "Refusée", tone: "red" },
  ANNULEE: { label: "Annulée", tone: "gray" },
}

export const durationLabel = (l: Pick<LeaveRequest, "durationValue" | "durationUnit">) => {
  const v = l.durationValue.toLocaleString("fr-FR")
  if (l.durationUnit === "HEURES") return `${v} heure${l.durationValue > 1 ? "s" : ""}`
  return `${v} jour${l.durationValue > 1 ? "s" : ""}`
}

const EVENTS = ["leave.updated"]

const changed = <T,>(p: Promise<T>) => p.then((v) => { emitLocal({ type: "leave.updated" }); return v })

// ---------- Salarié ----------

export const subscribeMyLeaves = (cb: (list: LeaveRequest[]) => void, onError?: (e: unknown) => void) =>
  live(() => get<LeaveRequest[]>("/me/leaves"), cb, { events: EVENTS, onError, pollMs: 30000 })

export const createLeave = (input: LeaveInput) =>
  changed(post<LeaveRequest>("/leaves", { ...input, reason: input.reason.trim() }))
export const cancelLeave = (id: string) =>
  changed(post(`/leaves/${id}/cancel`))
/** Marque les décisions comme vues (fait disparaître le badge). */
export const markLeaveDecisionsSeen = () =>
  changed(post("/me/leaves/seen"))

// ---------- Admin ----------

export interface LeaveQuery { status?: LeaveStatus; employeeCode?: string; siteId?: string; from?: string; to?: string }

export const listLeaves = (q: LeaveQuery = {}) => get<LeaveRequest[]>("/leaves", { ...q })

export const subscribeLeaves = (q: LeaveQuery, cb: (list: LeaveRequest[]) => void, onError?: (e: unknown) => void) =>
  live(() => listLeaves(q), cb, { events: EVENTS, onError, pollMs: 30000 })

export const subscribePendingLeaves = (cb: (n: number) => void) =>
  live(() => get<{ count: number }>("/leaves/pending-count").then((r) => r.count), cb, { events: EVENTS, onError: () => cb(0), pollMs: 30000 })

export const approveLeave = (id: string, note: string) =>
  changed(post(`/leaves/${id}/approve`, { note: note.trim() || null }))
export const refuseLeave = (id: string, note: string) =>
  changed(post(`/leaves/${id}/refuse`, { note: note.trim() || null }))
