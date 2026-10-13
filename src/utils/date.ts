// src/utils/date.ts
// Clé de date locale (YYYY-MM-DD). On n'utilise PAS toISOString() car il
// renvoie la date UTC : à Madagascar (UTC+3), entre 00h00 et 03h00 on
// obtiendrait la veille.
export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export const todayKey = () => dateKey()
