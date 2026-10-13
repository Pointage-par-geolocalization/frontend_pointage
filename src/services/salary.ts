// src/services/salary.ts
// Rémunération : soldes calculés par le serveur (gagné, payé, reste à payer) et rapports.
import { get } from "./api"
import type { Balance, Employee } from "./employees"

export interface SalaryRecord {
  id: string
  employeeCode: string
  attendanceId: string
  workDate: string
  workedMinutes: number
  dailySalary: number
  /** Solde cumulé après cette session. */
  cumulativeSalary: number
  createdAt: string
}

/** Rémunération du salarié connecté (du plus récent au plus ancien). */
export interface MySalary extends Balance {
  records: SalaryRecord[]
  totalMinutes: number
}

export const getMySalary = () => get<MySalary>("/me/salary")

export interface SalarySummaryRow extends Balance { employee: Employee }
export interface SalarySummary { rows: SalarySummaryRow[]; totals: Balance }

/** Une ligne par salarié (gagné / payé / reste) + totaux — une seule requête pour tout l'écran. */
export const getSalarySummary = () => get<SalarySummary>("/salary/summary")

export interface ReportRow { employeeCode: string; name: string; days: number; minutes: number; total: number }
export interface SalaryReport { rows: ReportRow[]; total: number }

/** Jours (dates distinctes), minutes et salaire par salarié sur une période, triés par salaire décroissant. */
export const getSalaryReport = (from: string, to: string, siteId?: string) =>
  get<SalaryReport>("/reports/salary", { from, to, siteId })
