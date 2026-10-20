import { get, post, put } from "./api"

export type TimesheetStatus = "DRAFT" | "SUBMITTED" | "RETURNED" | "APPROVED"
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
export const listMyTimesheets = () => get<Timesheet[]>("/me/timesheets")
export const saveMyTimesheet = (weekStart: string, entries: TimesheetEntry[]) =>
  put<Timesheet>(`/me/timesheets/${encodeURIComponent(weekStart)}`, { entries })
export const submitMyTimesheet = (weekStart: string) =>
  post<Timesheet>(`/me/timesheets/${encodeURIComponent(weekStart)}/submit`)
export const listAdminTimesheets = (status: TimesheetStatus | "ALL" = "SUBMITTED") =>
  get<Timesheet[]>("/admin/timesheets", { status })
export const approveTimesheet = (id: string) => post<Timesheet>(`/admin/timesheets/${encodeURIComponent(id)}/approve`)
export const returnTimesheet = (id: string, reason: string) =>
  post<Timesheet>(`/admin/timesheets/${encodeURIComponent(id)}/return`, { reason })
