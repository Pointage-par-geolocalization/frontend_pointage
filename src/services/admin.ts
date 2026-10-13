// src/services/admin.ts
import { get, post } from "./api"
import type { PresenceCheck, PresenceRound } from "./presence"

export interface EmployeeRef { employeeCode: string; name: string }

/** Photographie de la journée, calculée par le serveur en une requête. */
export interface DashboardToday {
  date: string
  activeEmployees: number
  /** Salariés distincts ayant au moins un pointage aujourd'hui. */
  presentCount: number
  absent: EmployeeRef[]
  /** Salariés absents mais couverts par une permission acceptée. */
  onLeave: (EmployeeRef & { type: string })[]
  totalMinutes: number
  dailyPay: number
  /** Σ (gagné − payé) des salariés actifs. */
  cashDue: number
  topWorked: (EmployeeRef & { minutes: number })[]
  currentlyIn: (EmployeeRef & { attendanceId: string; entryTime: string; departmentName: string; siteName?: string | null })[]
  late: (EmployeeRef & { lateMinutes: number; entryTime: string })[]
  pendingLeaves: number
  pendingLoans: number
  activeSites: number
  presence: { lastRound: PresenceRound | null; anomalies: PresenceCheck[] }
}

export const getDashboardToday = () => get<DashboardToday>("/dashboard/today")

/**
 * Supprime salariés, comptes salariés, pointages, rémunérations, paiements, permissions, contrôles
 * de présence, discussions et matériel, en une transaction côté serveur (mot de passe revérifié).
 * Conservés : comptes admin, paramètres, lieux, chantiers, clients, devis/factures, journal.
 */
export const resetAllData = (password: string) => post("/admin/reset-data", { password })
