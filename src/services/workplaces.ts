// src/services/workplaces.ts
import { del, get, patch, post } from "./api"

export interface Workplace {
  id: string
  name: string
  latitude: number
  longitude: number
  radiusMeters: number
  geofencingEnabled: boolean
}

export type WorkplaceInput = Omit<Workplace, "id">

/** Coordonnées exploitables (nombres finis, dans les bornes GPS) ? */
export function hasValidCoords(w: { latitude: number; longitude: number }): boolean {
  return Number.isFinite(w.latitude) && Number.isFinite(w.longitude) &&
    Math.abs(w.latitude) <= 90 && Math.abs(w.longitude) <= 180
}

export const listWorkplaces = () => get<Workplace[]>("/workplaces")
export const createWorkplace = (data: WorkplaceInput) => post("/workplaces", data)
export const updateWorkplace = (id: string, data: Partial<WorkplaceInput>) => patch(`/workplaces/${id}`, data)
/** Les affectations des salariés à ce lieu sont retirées en même temps. */
export const deleteWorkplace = (id: string) => del(`/workplaces/${id}`)
