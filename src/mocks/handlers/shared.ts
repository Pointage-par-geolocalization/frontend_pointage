// src/mocks/handlers/shared.ts — règles communes aux gestionnaires du faux serveur.
import type { MockDb, MockUser, StoredAttendance } from "../store"
import type { Attendance } from "../../services/attendance"
import type { Balance, Employee } from "../../services/employees"
import { fail, notFound } from "../router"
import { uid } from "../util"

export const employeeName = (e: Pick<Employee, "firstName" | "lastName">) => `${e.firstName} ${e.lastName}`

export function findEmployee(db: MockDb, code: string): Employee {
  const e = db.employees.find((x) => x.employeeCode.toLowerCase() === code.toLowerCase())
  return e ?? notFound("Salarié introuvable.")
}

export const nameOf = (db: MockDb, code: string | null | undefined) => {
  const e = code ? db.employees.find((x) => x.employeeCode === code) : undefined
  return e ? employeeName(e) : code ?? "—"
}

export const userOfEmployee = (db: MockDb, code: string) => db.users.find((u) => u.employeeCode === code)

/** Salarié connecté (les routes « employee » garantissent que le compte est lié à une fiche active). */
export const me = (db: MockDb, user: MockUser) => findEmployee(db, user.employeeCode!)

export function balanceOf(db: MockDb, code: string): Balance {
  const earned = db.salaryRecords.filter((r) => r.employeeCode === code).reduce((s, r) => s + r.dailySalary, 0)
  const paid = db.payments.filter((p) => p.employeeCode === code).reduce((s, p) => s + p.amount, 0)
  return { earned, paid, due: earned - paid }
}

/** Pointage tel que renvoyé par l'API (sans les champs internes du suivi de position). */
export function attendanceView(db: MockDb, a: StoredAttendance): Attendance {
  const { lastLocation: _l, lastLocationAt: _t, ...rest } = a
  void _l; void _t
  const site = a.siteId ? db.sites.find((s) => s.id === a.siteId) : undefined
  return { ...rest, employeeName: nameOf(db, a.employeeCode), siteName: site?.name ?? a.siteName ?? null }
}

export function audit(db: MockDb, user: MockUser | null, action: string, summary: string, targetId: string | null = null) {
  db.audit.unshift({ id: uid(), createdAt: new Date().toISOString(), userLabel: user ? user.email ?? user.name : null, action, targetId, summary })
}

export const adminIds = (db: MockDb) => db.users.filter((u) => u.role === "admin").map((u) => u.id)

export const requireFound = <T>(v: T | undefined | null, message?: string): T => v ?? notFound(message)

export const conflict = (code: string, message: string): never => fail(409, code, message)
export const unprocessable = (code: string, message: string, details?: unknown): never => fail(422, code, message, details)
