// src/services/attendance.ts
//
// Pointage d'entrée / sortie. Le serveur fait foi : il vérifie que le salarié est autorisé sur le
// département choisi et dans son rayon (géofencing), pose les heures avec sa propre horloge,
// calcule la durée, le salaire de la session et le solde cumulé. Le client n'envoie que le
// département et la position GPS.
import { ApiError, get, post } from "./api"
import type { LocationSnapshot } from "../utils/geolocation"
import type { Balance } from "./employees"

export type AttendanceLocation = LocationSnapshot

/** Résultat de la vérification GPS d'une entrée ou d'une sortie. */
export interface GpsCheck {
  employeeLatitude: number
  employeeLongitude: number
  departmentLatitude: number
  departmentLongitude: number
  radiusMeters: number
  distance: number // mètres, arrondi
  withinRadius: boolean
}

export type PunchSource = "EMPLOYEE" | "ADMIN"
export type AttendanceStatus = "EN_COURS" | "TERMINEE"

export interface Attendance {
  id: string
  employeeCode: string
  /** Nom du salarié (listes admin). */
  employeeName?: string
  workDate: string // YYYY-MM-DD, jour de l'entrée (heure de Madagascar)
  /** Département (lieu de travail) choisi à l'entrée ; la sortie se contrôle sur le même. */
  workplaceId: string | null
  departmentName: string
  /** Chantier auquel le pointage est rattaché (via le lieu de travail du chantier). */
  siteId?: string | null
  siteName?: string | null
  entryTime: string // ISO
  exitTime: string | null
  workedMinutes: number
  dailySalary: number
  entryLocation: AttendanceLocation | null
  exitLocation: AttendanceLocation | null
  entryGpsCheck: GpsCheck | null
  exitGpsCheck: GpsCheck | null
  status: AttendanceStatus
  /** Origine : le salarié (GPS vérifié) ou un admin à distance (sans GPS). */
  entrySource: PunchSource
  exitSource?: PunchSource | null
}

/** Refus du serveur : salarié hors du rayon autorisé du département (rien n'a été enregistré). */
export class GpsOutOfRangeError extends Error {
  distance: number
  radiusMeters: number
  constructor(message: string, distance: number, radiusMeters: number) {
    super(message)
    this.name = "GpsOutOfRangeError"
    this.distance = distance
    this.radiusMeters = radiusMeters
  }
}

function mapGpsError(e: unknown): never {
  if (e instanceof ApiError && e.code === "GPS_OUT_OF_RANGE") {
    throw new GpsOutOfRangeError(e.message, Number(e.details?.distance ?? 0), Number(e.details?.radiusMeters ?? 0))
  }
  throw e
}

/** Sessions du jour du salarié connecté, de la plus ancienne à la plus récente. */
export const listMySessionsToday = () => get<Attendance[]>("/me/attendance/today")

/** La session à afficher : celle EN_COURS si elle existe, sinon la dernière terminée. */
export function currentSession(sessions: Attendance[]): Attendance | null {
  if (sessions.length === 0) return null
  return sessions.find((s) => s.status === "EN_COURS") ?? sessions[sessions.length - 1]
}

/** Historique du salarié connecté, du plus récent au plus ancien. */
export const listMyAttendance = (limit = 60) => get<Attendance[]>("/me/attendance", { limit })

export const getMyBalance = () => get<Balance>("/me/balance")

/** ENTRÉE : lève GpsOutOfRangeError si le salarié est hors zone (aucun pointage enregistré). */
export async function clockIn(workplaceId: string, location: LocationSnapshot) {
  try {
    return await post<{ attendance: Attendance; gpsCheck: GpsCheck | null }>("/attendance/clock-in", { workplaceId, location })
  } catch (e) { mapGpsError(e) }
}

/** SORTIE de la session ouverte, contrôlée sur le même département que l'entrée. */
export async function clockOut(location: LocationSnapshot) {
  try {
    return await post<{ workedMinutes: number; dailySalary: number; gpsCheck: GpsCheck | null }>("/attendance/clock-out", { location })
  } catch (e) { mapGpsError(e) }
}

// ---------- Admin ----------

export interface AttendanceQuery { date?: string; from?: string; to?: string; employeeCode?: string; siteId?: string }

export const listAttendance = (q: AttendanceQuery) => get<Attendance[]>("/attendance", { ...q })
export const listAttendanceForDate = (date: string) => listAttendance({ date })

/** Démarre à distance le pointage d'un salarié, SANS GPS (marqué « Admin », action journalisée). */
export const adminClockIn = (employeeCode: string, workplaceId: string) =>
  post<{ id: string }>("/admin/attendance/clock-in", { employeeCode, workplaceId })

/**
 * Arrête à distance un pointage en cours, SANS GPS. `exitTime` (ISO) permet de clôturer une
 * session oubliée à l'heure réelle de départ ; par défaut : maintenant.
 */
export const adminClockOut = (attendanceId: string, exitTime?: string) =>
  post<{ workedMinutes: number; dailySalary: number }>(`/admin/attendance/${attendanceId}/clock-out`, exitTime ? { exitTime } : {})
