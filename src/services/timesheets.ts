import { get, post, put } from "./api"

export type TimesheetStatus = "DRAFT" | "SUBMITTED" | "RETURNED" | "APPROVED" | "TO_SUBMIT" | "LOCKED"
export interface TimesheetEntry { hours: number; note: string }
export interface Timesheet {
  id: string
  employeeCode: string
  employeeName?: string | null
  weekStart: string
  entries: TimesheetEntry[]
  status: TimesheetStatus
  submittedAt?: string | null
  approvedAt?: string | null
  approvedBy?: string | null
  managerNote?: string | null
  totalHours: number
}
export interface TimesheetPrefillSource { date: string; hours: number; attendanceIds: string[] }
export interface TimesheetPrefill { weekStart: string; entries: TimesheetEntry[]; sources: TimesheetPrefillSource[]; submittedEntries: TimesheetEntry[]; differences: unknown[] }
export const listMyTimesheets = () => get<Timesheet[]>("/me/timesheets")
/** Préremplit les sept jours à partir des pointages, sans soumettre : le salarié peut encore corriger. */
export const prefillMyTimesheet = (weekStart: string) =>
  get<TimesheetPrefill>(`/me/timesheets/prefill/${encodeURIComponent(weekStart)}`)
export const saveMyTimesheet = (weekStart: string, entries: TimesheetEntry[]) =>
  put<Timesheet>(`/me/timesheets/${encodeURIComponent(weekStart)}`, { entries })
export const submitMyTimesheet = (weekStart: string) =>
  post<Timesheet>(`/me/timesheets/${encodeURIComponent(weekStart)}/submit`)
export const listAdminTimesheets = (status: TimesheetStatus | "ALL" = "SUBMITTED") =>
  get<Timesheet[]>("/admin/timesheets", { status })
export const approveTimesheet = (id: string) => post<Timesheet>(`/admin/timesheets/${encodeURIComponent(id)}/approve`)
export const returnTimesheet = (id: string, reason: string) =>
  post<Timesheet>(`/admin/timesheets/${encodeURIComponent(id)}/return`, { reason })

/** Déverrouillage réservé à l'administration, avec motif obligatoire transmis à l'historique. */
export const unlockTimesheet = (id: string, reason: string) =>
  post<Timesheet>(`/admin/timesheets/${encodeURIComponent(id)}/unlock`, { reason: reason.trim() })


// import { get, post, put } from "./api"

// export type TimesheetStatus = "DRAFT" | "SUBMITTED" | "RETURNED" | "APPROVED"
// export interface TimesheetEntry { hours: number; note: string }
// export interface Timesheet {
//   id: string
//   employeeCode: string
//   employeeName?: string | null
//   weekStart: string
//   entries: TimesheetEntry[]
//   status: TimesheetStatus
//   submittedAt?: string | null
//   approvedAt?: string | null
//   approvedBy?: string | null
//   managerNote?: string | null
//   totalHours: number
// }
// export const listMyTimesheets = () => get<Timesheet[]>("/me/timesheets")
// export const saveMyTimesheet = (weekStart: string, entries: TimesheetEntry[]) =>
//   put<Timesheet>(`/me/timesheets/${encodeURIComponent(weekStart)}`, { entries })
// export const submitMyTimesheet = (weekStart: string) =>
//   post<Timesheet>(`/me/timesheets/${encodeURIComponent(weekStart)}/submit`)
// export const listAdminTimesheets = (status: TimesheetStatus | "ALL" = "SUBMITTED") =>
//   get<Timesheet[]>("/admin/timesheets", { status })
// export const approveTimesheet = (id: string) => post<Timesheet>(`/admin/timesheets/${encodeURIComponent(id)}/approve`)
// export const returnTimesheet = (id: string, reason: string) =>
//   post<Timesheet>(`/admin/timesheets/${encodeURIComponent(id)}/return`, { reason })
