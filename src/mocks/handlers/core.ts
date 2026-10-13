// src/mocks/handlers/core.ts — authentification, salariés, lieux, paramètres, journal, réinitialisation.
import { fail, invalid, isDay, num, optStr, route, str } from "../router"
import type { MockDb, MockUser } from "../store"
import type { AppUser } from "../../services/auth"
import type { Employee } from "../../services/employees"
import { DEFAULT_APP_SETTINGS, type AppSettings } from "../../services/settings"
import { publish, setSessionUserId } from "../events"
import { DEMO_INVITE_CODE } from "../demo"
import { uid } from "../util"
import { audit, balanceOf, conflict, employeeName, findEmployee, me, requireFound, unprocessable, userOfEmployee } from "./shared"

export const tokenFor = (u: MockUser) => `mock.${u.id}`

const appUser = (u: MockUser): AppUser => ({ id: u.id, role: u.role, employeeCode: u.employeeCode, email: u.email, name: u.name })

function session(u: MockUser) {
  setSessionUserId(u.id)
  return { accessToken: tokenFor(u), user: appUser(u) }
}

/** Un salarié désactivé (ou dont la fiche n'existe plus) n'a plus aucun accès. */
export function isActive(db: MockDb, u: MockUser) {
  if (u.role === "admin") return true
  return db.employees.some((e) => e.employeeCode === u.employeeCode && e.active)
}

// ---------- Authentification ----------

route("POST", "/auth/login", "public", ({ db, body }) => {
  const identifier = str(body.identifier).toLowerCase()
  const user = db.users.find((u) => identifier.includes("@") ? u.email?.toLowerCase() === identifier : u.employeeCode?.toLowerCase() === identifier)
  if (!user || user.password !== body.password) fail(401, "INVALID_CREDENTIALS", "Identifiant ou mot de passe incorrect.")
  if (!isActive(db, user!)) fail(403, "ACCOUNT_DISABLED", "Votre compte est désactivé. Contactez votre administrateur.")
  return session(user!)
})

route("POST", "/auth/register-admin", "public", ({ db, body }) => {
  const email = str(body.email).toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) invalid("Email invalide.")
  if (str(body.password).length < 6) invalid("Le mot de passe doit contenir au moins 6 caractères.")
  if (str(body.inviteCode) !== DEMO_INVITE_CODE) fail(403, "INVALID_INVITE_CODE", "Code d'invitation administrateur incorrect.")
  if (db.users.some((u) => u.email?.toLowerCase() === email)) conflict("EMAIL_TAKEN", "Cet email est déjà utilisé.")
  const user: MockUser = { id: uid(), role: "admin", email, password: body.password, name: "Administrateur" }
  db.users.push(user)
  audit(db, user, "ADMIN_CREATED", `Compte administrateur ${email} créé`)
  return session(user)
})

route("POST", "/auth/refresh", "any", ({ user }) => ({ accessToken: tokenFor(user) }))
route("POST", "/auth/logout", "public", () => { setSessionUserId(null) })
route("GET", "/auth/me", "any", ({ user }) => appUser(user))

// Mauvais mot de passe : 403 et non 401 (un 401 déclencherait la déconnexion automatique du front).
route("POST", "/auth/verify-password", "admin", ({ user, body }) => {
  if (body.password !== user.password) fail(403, "INVALID_PASSWORD", "Mot de passe incorrect.")
})

// ---------- Salariés ----------

const byName = (a: Employee, b: Employee) => a.lastName.localeCompare(b.lastName, "fr") || a.firstName.localeCompare(b.firstName, "fr")

function employeeFields(db: MockDb, body: any, partial: boolean): Partial<Employee> {
  const out: Partial<Employee> = {}
  for (const k of ["firstName", "lastName"] as const) {
    if (k in body || !partial) {
      const v = str(body[k])
      if (!v) invalid(`Champ « ${k === "firstName" ? "prénom" : "nom"} » obligatoire.`)
      out[k] = v
    }
  }
  for (const k of ["email", "phone", "address"] as const) if (k in body) out[k] = optStr(body[k])
  if ("position" in body) out.position = str(body.position)
  if ("hireDate" in body) out.hireDate = isDay(body.hireDate) ? body.hireDate : null
  if ("baseDailySalary" in body || !partial) out.baseDailySalary = num(body.baseDailySalary, "salaire de base", { min: 0, int: true })
  if ("departmentIds" in body || !partial) {
    const ids = Array.isArray(body.departmentIds) ? body.departmentIds.filter((id: string) => db.workplaces.some((w) => w.id === id)) : []
    if (ids.length === 0) unprocessable("NO_DEPARTMENT_ASSIGNED", "Sélectionnez au moins un département pour ce salarié.")
    out.departmentIds = ids
  }
  return out
}

route("GET", "/employees", "admin", ({ db }) => [...db.employees].sort(byName))
route("GET", "/employees/:code", "admin", ({ db, params }) => findEmployee(db, params.code))
route("GET", "/me/employee", "employee", ({ db, user }) => me(db, user))

route("POST", "/employees", "admin", ({ db, user, body }) => {
  const code = str(body.employeeCode)
  if (!code) invalid("L'identifiant est obligatoire.")
  if (code.length > 30) invalid("L'identifiant est trop long (30 caractères maximum).")
  if (db.employees.some((e) => e.employeeCode.toLowerCase() === code.toLowerCase())) conflict("EMPLOYEE_CODE_TAKEN", "Cet identifiant est déjà utilisé par un autre salarié.")
  if (str(body.password).length < 6) invalid("Le mot de passe / code PIN doit contenir au moins 6 caractères.")
  const employee = {
    employeeCode: code, position: "", email: null, phone: null, address: null, hireDate: null,
    ...employeeFields(db, body, false), active: true, createdAt: new Date().toISOString(),
  } as Employee
  db.employees.push(employee)
  db.users.push({ id: uid(), role: "employee", email: null, employeeCode: code, password: body.password, name: employeeName(employee) })
  audit(db, user, "EMPLOYEE_CREATED", `Salarié ${employeeName(employee)} (${code}) créé`, code)
  return employee
})

route("PATCH", "/employees/:code", "admin", ({ db, user, params, body }) => {
  const e = findEmployee(db, params.code)
  Object.assign(e, employeeFields(db, body, true))
  const u = userOfEmployee(db, e.employeeCode)
  if (u) u.name = employeeName(e)
  audit(db, user, "EMPLOYEE_UPDATED", `Fiche de ${employeeName(e)} modifiée`, e.employeeCode)
  return e
})

route("PATCH", "/employees/:code/active", "admin", ({ db, user, params, body }) => {
  const e = findEmployee(db, params.code)
  e.active = body.active === true
  audit(db, user, e.active ? "EMPLOYEE_ENABLED" : "EMPLOYEE_DISABLED", `${employeeName(e)} ${e.active ? "réactivé" : "désactivé"}`, e.employeeCode)
  const u = userOfEmployee(db, e.employeeCode)
  if (!e.active && u) publish({ type: "session.revoked" }, [u.id])
})

route("DELETE", "/employees/:code", "admin", ({ db, user, params }) => {
  const e = findEmployee(db, params.code)
  const code = e.employeeCode
  if (db.attendance.some((a) => a.employeeCode === code) || db.payments.some((p) => p.employeeCode === code)) {
    conflict("HAS_HISTORY", "Ce salarié a un historique de pointages ou de paiements : désactivez-le plutôt que de le supprimer.")
  }
  const u = userOfEmployee(db, code)
  db.employees = db.employees.filter((x) => x.employeeCode !== code)
  db.users = db.users.filter((x) => x.employeeCode !== code)
  db.siteMembers = db.siteMembers.filter((m) => m.employeeCode !== code)
  db.leaves = db.leaves.filter((l) => l.employeeCode !== code)
  if (u) db.chats.forEach((c) => { c.memberIds = c.memberIds.filter((id) => id !== u.id) })
  db.chats = db.chats.filter((c) => c.directUserId !== u?.id)
  audit(db, user, "EMPLOYEE_DELETED", `Salarié ${employeeName(e)} (${code}) supprimé`, code)
  if (u) publish({ type: "session.revoked" }, [u.id])
})

route("PUT", "/employees/:code/password", "admin", ({ db, user, params, body }) => {
  const e = findEmployee(db, params.code)
  if (str(body.newPassword).length < 6) invalid("Le nouveau mot de passe doit contenir au moins 6 caractères.")
  const u = requireFound(userOfEmployee(db, e.employeeCode), "Ce salarié n'a pas de compte de connexion.")
  u.password = body.newPassword
  audit(db, user, "EMPLOYEE_PASSWORD_CHANGED", `Mot de passe de ${employeeName(e)} modifié`, e.employeeCode)
  publish({ type: "session.revoked" }, [u.id])
})

route("GET", "/employees/:code/balance", "admin", ({ db, params }) => balanceOf(db, findEmployee(db, params.code).employeeCode))
route("GET", "/me/balance", "employee", ({ db, user }) => balanceOf(db, user.employeeCode!))

// ---------- Lieux de travail ----------

function workplaceFields(body: any, partial: boolean) {
  const out: Record<string, unknown> = {}
  if ("name" in body || !partial) { out.name = str(body.name); if (!out.name) invalid("Le nom du lieu est obligatoire.") }
  if ("latitude" in body || !partial) out.latitude = num(body.latitude, "latitude", { min: -90, max: 90 })
  if ("longitude" in body || !partial) out.longitude = num(body.longitude, "longitude", { min: -180, max: 180 })
  if ("radiusMeters" in body || !partial) out.radiusMeters = num(body.radiusMeters ?? 100, "rayon", { min: 1, int: true })
  if ("geofencingEnabled" in body || !partial) out.geofencingEnabled = body.geofencingEnabled !== false
  return out
}

route("GET", "/workplaces", "any", ({ db }) => [...db.workplaces].sort((a, b) => a.name.localeCompare(b.name, "fr")))
route("POST", "/workplaces", "admin", ({ db, user, body }) => {
  const w = { id: uid(), ...workplaceFields(body, false) } as MockDb["workplaces"][number]
  db.workplaces.push(w)
  audit(db, user, "WORKPLACE_CREATED", `Lieu « ${w.name} » créé`, w.id)
  return w
})
route("PATCH", "/workplaces/:id", "admin", ({ db, user, params, body }) => {
  const w = requireFound(db.workplaces.find((x) => x.id === params.id))
  Object.assign(w, workplaceFields(body, true))
  audit(db, user, "WORKPLACE_UPDATED", `Lieu « ${w.name} » modifié`, w.id)
  return w
})
route("DELETE", "/workplaces/:id", "admin", ({ db, user, params }) => {
  const w = requireFound(db.workplaces.find((x) => x.id === params.id))
  db.workplaces = db.workplaces.filter((x) => x.id !== w.id)
  db.employees.forEach((e) => { e.departmentIds = e.departmentIds.filter((id) => id !== w.id) })
  db.sites.forEach((s) => { if (s.workplaceId === w.id) s.workplaceId = null })
  db.attendance.forEach((a) => { if (a.workplaceId === w.id) a.workplaceId = null })
  audit(db, user, "WORKPLACE_DELETED", `Lieu « ${w.name} » supprimé`, w.id)
})

// ---------- Paramètres ----------

route("GET", "/settings", "any", ({ db }) => db.settings)
route("PUT", "/settings", "admin", ({ db, user, body }) => {
  const next: AppSettings = { ...db.settings }
  const numeric: [keyof AppSettings, string, { min?: number; max?: number; int?: boolean }][] = [
    ["dailySalary", "salaire journalier", { min: 0, int: true }],
    ["normalWorkMinutes", "heures normales", { min: 1, max: 1440, int: true }],
    ["toleranceMinutes", "tolérance", { min: 0, int: true }],
    ["presenceCheckIntervalMinutes", "intervalle de contrôle", { min: 15, max: 720, int: true }],
    ["defaultTaxRate", "TVA", { min: 0, max: 100 }],
  ]
  for (const [k, label, opts] of numeric) if (k in body) (next as any)[k] = num(body[k], label, opts)
  if ("normalEntryTime" in body) {
    if (!/^\d{2}:\d{2}$/.test(str(body.normalEntryTime))) invalid("Heure d'entrée invalide (HH:mm).")
    next.normalEntryTime = str(body.normalEntryTime)
  }
  if ("presenceCheckEnabled" in body) next.presenceCheckEnabled = body.presenceCheckEnabled === true
  for (const k of ["companyName", "companyAddress", "companyPhone", "companyEmail", "companyNif", "companyStat", "documentFooter"] as const) {
    if (k in body) next[k] = str(body[k])
  }
  db.settings = { ...DEFAULT_APP_SETTINGS, ...next }
  audit(db, user, "SETTINGS_UPDATED", `Paramètres modifiés (${Object.keys(body).join(", ")})`)
  return db.settings
})

// ---------- Journal & réinitialisation ----------

route("GET", "/audit-logs", "admin", ({ db, query }) => {
  const action = query.get("action"), from = query.get("from"), to = query.get("to")
  const limit = Number(query.get("limit") ?? 200)
  return db.audit
    .filter((l) => (!action || l.action === action) && (!from || l.createdAt.slice(0, 10) >= from) && (!to || l.createdAt.slice(0, 10) <= to))
    .slice(0, limit)
})

route("POST", "/admin/reset-data", "admin", ({ db, user, body }) => {
  if (body.password !== user.password) fail(403, "INVALID_PASSWORD", "Mot de passe incorrect.")
  const employeeUserIds = new Set(db.users.filter((u) => u.role === "employee").map((u) => u.id))
  Object.assign(db, {
    employees: [], attendance: [], salaryRecords: [], payments: [], equipment: [], loans: [],
    chats: [], messages: [], reads: [], leaves: [], rounds: [], checks: [], siteMembers: [],
    users: db.users.filter((u) => u.role === "admin"),
  })
  audit(db, user, "DATA_RESET", "Réinitialisation des données (salariés, pointages, paie, discussions, matériel…)")
  publish({ type: "session.revoked" }, [...employeeUserIds])
})
