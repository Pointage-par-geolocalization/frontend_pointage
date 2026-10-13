// src/services/settings.ts
import { get, put } from "./api"
import { DEFAULT_SALARY_SETTINGS, type SalarySettings } from "../utils/salaryCalculator"

export interface AppSettings extends SalarySettings {
  toleranceMinutes: number // retard toléré
  normalEntryTime: string // "08:00"
  /** Contrôle périodique de la position des salariés en poste. */
  presenceCheckEnabled: boolean
  presenceCheckIntervalMinutes: number
  /** En-tête des devis et factures. */
  companyName: string
  companyAddress: string
  companyPhone: string
  companyEmail: string
  companyNif: string
  companyStat: string
  defaultTaxRate: number // %
  documentFooter: string
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  ...DEFAULT_SALARY_SETTINGS,
  toleranceMinutes: 10,
  normalEntryTime: "08:00",
  presenceCheckEnabled: true,
  presenceCheckIntervalMinutes: 60,
  companyName: "",
  companyAddress: "",
  companyPhone: "",
  companyEmail: "",
  companyNif: "",
  companyStat: "",
  defaultTaxRate: 0,
  documentFooter: "",
}

export async function getSettings(): Promise<AppSettings> {
  return { ...DEFAULT_APP_SETTINGS, ...(await get<Partial<AppSettings>>("/settings")) }
}

export const updateSettings = (data: Partial<AppSettings>) => put("/settings", data)
