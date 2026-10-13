// src/utils/format.ts
// Les dates arrivent de l'API en ISO 8601 (instants) ou "YYYY-MM-DD" (jours).
type Instant = string | null | undefined

/** « 30/09/2026 à 14:05 » — ou « — » si la date n'existe pas encore. */
export function fmtDateTime(t: Instant): string {
  if (!t) return "—"
  const d = new Date(t)
  return `${d.toLocaleDateString("fr-FR")} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
}

export function fmtDate(t: Instant): string {
  return t ? new Date(t).toLocaleDateString("fr-FR") : "—"
}

/** « 14:05 » */
export function fmtTime(t: Instant): string {
  return t ? new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—"
}

/** Jour "YYYY-MM-DD" → « 30/09/2026 » (sans passer par un fuseau horaire). */
export function fmtDay(day: string | null | undefined): string {
  if (!day) return "—"
  const [y, m, d] = day.split("-")
  return y && m && d ? `${d}/${m}/${y}` : day
}

/** Jour "YYYY-MM-DD" → « lundi 30 septembre 2026 ». */
export function fmtDayLong(day: string): string {
  const [y, m, d] = day.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
}

export const millis = (t: Instant) => (t ? Date.parse(t) : 0)
