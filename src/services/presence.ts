// src/services/presence.ts
//
// Vérification régulière de la présence sur le chantier.
// Pendant une session de pointage ouverte, le téléphone du salarié transmet sa position
// (périodiquement et à chaque demande du serveur). À intervalle régulier (toutes les heures par
// défaut, Paramètres → Contrôle de présence), le serveur lance une « ronde » : pour chaque salarié
// en poste, il compare la dernière position reçue à la zone autorisée du lieu de pointage et
// enregistre le résultat (présent, sorti de zone, sans réponse). L'historique reste consultable.
import { get, post } from "./api"
import { emitLocal, live, onEvents } from "./realtime"
import type { LocationSnapshot } from "../utils/geolocation"

export type PresenceStatus = "EN_ATTENTE" | "PRESENT" | "HORS_ZONE" | "SANS_REPONSE"

export interface PresenceRound {
  id: string
  startedAt: string
  /** null tant que les téléphones ont encore le temps de répondre. */
  evaluatedAt: string | null
  trigger: "AUTO" | "MANUEL"
  total: number
  present: number
  outOfZone: number
  noResponse: number
}

export interface PresenceCheck {
  id: string
  roundId: string
  attendanceId: string | null
  employeeCode: string
  employeeName: string
  departmentName: string | null
  siteId?: string | null
  siteName?: string | null
  status: PresenceStatus
  location?: { latitude: number; longitude: number; accuracy: number } | null
  /** Heure de la position utilisée pour le contrôle. */
  locationAt?: string | null
  distance?: number | null
  radiusMeters?: number | null
  checkedAt: string | null
}

type Tone = "green" | "red" | "yellow" | "gray" | "blue"

export const PRESENCE_STATUS: Record<PresenceStatus, { label: string; tone: Tone }> = {
  EN_ATTENTE: { label: "En attente", tone: "gray" },
  PRESENT: { label: "Présent", tone: "green" },
  HORS_ZONE: { label: "Sorti de zone", tone: "red" },
  SANS_REPONSE: { label: "Absence détectée", tone: "yellow" },
}

export interface PingResult { withinRadius: boolean; distance: number; radiusMeters: number; departmentName: string }

/** SALARIÉ — transmet sa position pendant une session ouverte. */
export const pingPresence = (location: LocationSnapshot) => post<PingResult>("/me/presence/ping", { location })

/** SALARIÉ — le serveur demande une position (début d'une ronde de contrôle). */
export const onPresenceRequest = (cb: () => void) => onEvents(["presence.request"], cb)

// ---------- Admin ----------

export interface CheckQuery { roundId?: string; date?: string; employeeCode?: string; siteId?: string; status?: PresenceStatus }

export const listRounds = (q: { from?: string; to?: string; limit?: number } = {}) => get<PresenceRound[]>("/presence/rounds", q)
export const listChecks = (q: CheckQuery) => get<PresenceCheck[]>("/presence/checks", { ...q })

export const subscribeRounds = (q: { from?: string; to?: string; limit?: number }, cb: (r: PresenceRound[]) => void, onError?: (e: unknown) => void) =>
  live(() => listRounds(q), cb, { events: ["presence.updated"], onError, pollMs: 30000 })

/** Lance immédiatement une ronde de contrôle (en plus des contrôles automatiques). */
export const triggerRound = () =>
  post<PresenceRound>("/presence/rounds").then((r) => { emitLocal({ type: "presence.updated" }); return r })
