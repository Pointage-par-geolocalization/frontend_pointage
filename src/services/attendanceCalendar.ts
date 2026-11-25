import { get } from "./api"
export type PresenceDayStatus = "FULL" | "MORNING" | "AFTERNOON" | "LEAVE" | "NONE"
export interface PresenceDay { date: string; status: PresenceDayStatus; workedMinutes: number; sessions: number; leaveType?: string | null }
export interface MonthlyPresence { employeeCode: string; month: string; days: PresenceDay[] }
export const getMonthlyPresence = (employeeCode: string, month: string) => get<MonthlyPresence>("/attendance/calendar", { employeeCode, month })
