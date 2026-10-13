// src/utils/salaryCalculator.ts
//
// Règle de rémunération de l'entreprise (voir Paramètres → Rémunération) :
//   une journée complète (8 h par défaut) = salaire journalier du salarié.
//   En dessous, le salaire est proportionnel au temps travaillé ; jamais au-delà du plafond.
//
// Le serveur fait le calcul officiel à chaque sortie. Cette copie sert uniquement à
// l'aperçu « salaire estimé en direct » de l'accueil salarié et doit rester identique.

export interface SalarySettings {
  dailySalary: number // Ar pour 8h de travail
  normalWorkMinutes: number // minutes pour une journée complète (8h = 480)
}

export const DEFAULT_SALARY_SETTINGS: SalarySettings = {
  dailySalary: 20000,
  normalWorkMinutes: 8 * 60,
}

export function getHourlyRate(settings: SalarySettings = DEFAULT_SALARY_SETTINGS): number {
  return settings.dailySalary / (settings.normalWorkMinutes / 60)
}

/**
 * Calcule le salaire d'une journée à partir du temps travaillé (en minutes).
 * - < normalWorkMinutes  → proportionnel
 * - >= normalWorkMinutes → plafonné à dailySalary
 */
export function calculateDailySalary(
  workedMinutes: number,
  settings: SalarySettings = DEFAULT_SALARY_SETTINGS
): number {
  if (workedMinutes <= 0) return 0

  if (workedMinutes >= settings.normalWorkMinutes) {
    return settings.dailySalary
  }

  const ratePerMinute = settings.dailySalary / settings.normalWorkMinutes
  const salary = workedMinutes * ratePerMinute
  // Arrondi à l'unité d'Ariary la plus proche.
  return Math.round(salary)
}

/** Additionne le solde précédent et le salaire du jour pour obtenir le nouveau cumul. */
export function accumulateSalary(previousBalance: number, dailySalary: number): number {
  return previousBalance + dailySalary
}

export function formatAriary(amount: number): string {
  return `${Math.round(amount).toLocaleString("fr-FR")} Ar`
}

export function minutesToHoursLabel(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}`
}
