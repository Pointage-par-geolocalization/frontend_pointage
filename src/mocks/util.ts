// src/mocks/util.ts — petits utilitaires du faux serveur (mode démo).
import { distanceInMeters } from "../utils/distance"
import type { GpsCheck } from "../services/attendance"
import type { Workplace } from "../services/workplaces"

let counter = 0
/** Identifiant unique (crypto.randomUUID n'existe pas en http:// hors localhost, ex. test sur téléphone). */
export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  counter += 1
  return `${Date.now().toString(16)}-${counter.toString(16)}-${Math.random().toString(16).slice(2, 10)}`
}

export const iso = (d: Date) => d.toISOString()
export const minutesAgo = (min: number, from = new Date()) => new Date(from.getTime() - min * 60000)

/** Date locale à `dayOffset` jours d'aujourd'hui, à hh:mm. */
export function atDay(dayOffset: number, h: number, m = 0): Date {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  d.setHours(h, m, 0, 0)
  return d
}

export function gpsCheckFor(loc: { latitude: number; longitude: number }, w: Workplace): GpsCheck {
  const distance = distanceInMeters(loc.latitude, loc.longitude, w.latitude, w.longitude)
  return {
    employeeLatitude: loc.latitude,
    employeeLongitude: loc.longitude,
    departmentLatitude: w.latitude,
    departmentLongitude: w.longitude,
    radiusMeters: w.radiusMeters,
    distance: Math.round(distance),
    withinRadius: distance <= w.radiusMeters,
  }
}

/** Point à ~`meters` mètres d'un lieu (direction donnée en degrés). */
export function near(w: { latitude: number; longitude: number }, meters: number, bearingDeg = 45) {
  const rad = (bearingDeg * Math.PI) / 180
  const dLat = (meters * Math.cos(rad)) / 111320
  const dLng = (meters * Math.sin(rad)) / (111320 * Math.cos((w.latitude * Math.PI) / 180))
  return { latitude: w.latitude + dLat, longitude: w.longitude + dLng }
}

/** Générateur pseudo-aléatoire déterministe : les mêmes données de démo à chaque génération. */
export function seededRandom(seed: number) {
  let a = seed
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
