// src/mocks/handlers/equipment-leaves.ts — matériel et prêts, demandes de permission.
import { fail, invalid, isDay, num, optDay, optStr, route, str } from "../router"
import type { MockDb } from "../store"
import type { Equipment, Loan } from "../../services/equipment"
import type { LeaveRequest } from "../../services/leaves"
import { LEAVE_TYPES } from "../../services/leaves"
import { todayKey } from "../../utils/date"
import { publish } from "../events"
import { uid } from "../util"
import { adminIds, audit, conflict, me, nameOf, requireFound, userOfEmployee } from "./shared"

const nowIso = () => new Date().toISOString()

// ---------- Matériel ----------

const ACTIVE: Loan["status"][] = ["EN_COURS", "RETOUR_DEMANDE"]

function equipmentView(db: MockDb): Equipment[] {
  return [...db.equipment].sort((a, b) => a.name.localeCompare(b.name, "fr")).map((e) => {
    const cur = db.loans.find((l) => l.equipmentId === e.id && ACTIVE.includes(l.status))
    return { ...e, currentLoanId: cur?.id ?? null, currentBorrowerCode: cur?.employeeCode ?? null, currentBorrowerName: cur?.employeeName ?? null, currentLoanedAt: cur?.loanedAt ?? null }
  })
}

const loanChanged = () => publish({ type: "loan.updated" })
const recentFirst = (a: Loan, b: Loan) => b.requestedAt.localeCompare(a.requestedAt)
const findLoan = (db: MockDb, id: string) => requireFound(db.loans.find((l) => l.id === id), "Prêt introuvable.")
const findEquipment = (db: MockDb, id: string) => requireFound(db.equipment.find((e) => e.id === id), "Ce matériel n'existe plus.")

function equipmentFields(body: any) {
  const name = str(body.name)
  if (!name) invalid("Le nom du matériel est obligatoire.")
  return { name, category: optStr(body.category), serialNumber: optStr(body.serialNumber), description: optStr(body.description) }
}

route("GET", "/equipment", "any", ({ db }) => equipmentView(db))
route("POST", "/equipment", "admin", ({ db, body }) => {
  db.equipment.push({ id: uid(), ...equipmentFields(body), status: "DISPONIBLE" })
  loanChanged()
})
route("PATCH", "/equipment/:id", "admin", ({ db, params, body }) => {
  Object.assign(findEquipment(db, params.id), equipmentFields(body))
  loanChanged()
})
route("PATCH", "/equipment/:id/out-of-service", "admin", ({ db, params, body }) => {
  const e = findEquipment(db, params.id)
  if (e.status === "EMPRUNTE") conflict("EQUIPMENT_BORROWED", "Ce matériel est actuellement emprunté.")
  e.status = body.outOfService ? "HORS_SERVICE" : "DISPONIBLE"
  loanChanged()
})
route("DELETE", "/equipment/:id", "admin", ({ db, params }) => {
  const e = findEquipment(db, params.id)
  if (e.status === "EMPRUNTE") conflict("EQUIPMENT_BORROWED", "Impossible de supprimer un matériel actuellement emprunté.")
  db.equipment = db.equipment.filter((x) => x.id !== e.id)
  db.loans.forEach((l) => { if (l.equipmentId === e.id) l.equipmentId = null }) // l'historique garde le nom copié
  loanChanged()
})

route("GET", "/loans", "admin", ({ db, query }) => {
  const status = query.get("status"), equipmentId = query.get("equipmentId")
  return db.loans.filter((l) => (!status || l.status === status) && (!equipmentId || l.equipmentId === equipmentId)).sort(recentFirst)
})
route("GET", "/me/loans", "employee", ({ db, user }) => db.loans.filter((l) => l.employeeCode === user.employeeCode).sort(recentFirst))
route("GET", "/loans/pending-count", "admin", ({ db }) => ({ count: db.loans.filter((l) => l.status === "DEMANDE" || l.status === "RETOUR_DEMANDE").length }))

route("POST", "/loans", "employee", ({ db, user, body }) => {
  const e = me(db, user)
  const eq = findEquipment(db, str(body.equipmentId))
  if (eq.status !== "DISPONIBLE") conflict("EQUIPMENT_UNAVAILABLE", "Ce matériel n'est pas disponible.")
  if (db.loans.some((l) => l.equipmentId === eq.id && l.employeeCode === e.employeeCode && l.status === "DEMANDE")) {
    conflict("LOAN_ALREADY_PENDING", "Vous avez déjà une demande en attente pour ce matériel.")
  }
  const expected = optDay(body.expectedReturnDate)
  if (expected && expected < todayKey()) invalid("La date de retour souhaitée est déjà passée.")
  db.loans.push({
    id: uid(), equipmentId: eq.id, equipmentName: eq.name, employeeCode: e.employeeCode, employeeName: `${e.firstName} ${e.lastName}`,
    status: "DEMANDE", requestNote: optStr(body.note), expectedReturnDate: expected, requestedAt: nowIso(),
    decidedAt: null, refusalReason: null, loanedAt: null, returnRequestedAt: null, returnNote: null, returnedAt: null,
  })
  loanChanged()
})

route("POST", "/loans/:id/cancel", "employee", ({ db, user, params }) => {
  const l = findLoan(db, params.id)
  if (l.employeeCode !== user.employeeCode) fail(403, "FORBIDDEN", "Accès refusé.")
  if (l.status !== "DEMANDE") conflict("LOAN_NOT_PENDING", "Cette demande a déjà été traitée.")
  Object.assign(l, { status: "ANNULEE", decidedAt: nowIso() })
  loanChanged()
})

route("POST", "/loans/:id/return-request", "employee", ({ db, user, params, body }) => {
  const l = findLoan(db, params.id)
  if (l.employeeCode !== user.employeeCode) fail(403, "FORBIDDEN", "Accès refusé.")
  if (l.status !== "EN_COURS") conflict("LOAN_NOT_ACTIVE", "Ce prêt n'est plus en cours.")
  Object.assign(l, { status: "RETOUR_DEMANDE", returnRequestedAt: nowIso(), returnNote: optStr(body.note) })
  loanChanged()
})

route("POST", "/loans/:id/approve", "admin", ({ db, user, params }) => {
  const l = findLoan(db, params.id)
  if (l.status !== "DEMANDE") conflict("LOAN_NOT_PENDING", "Cette demande a déjà été traitée.")
  const eq = findEquipment(db, l.equipmentId ?? "")
  if (eq.status === "EMPRUNTE") conflict("EQUIPMENT_BORROWED", "Ce matériel est déjà emprunté par quelqu'un d'autre.")
  if (eq.status === "HORS_SERVICE") conflict("EQUIPMENT_UNAVAILABLE", "Ce matériel est hors service.")
  Object.assign(l, { status: "EN_COURS", loanedAt: nowIso(), decidedAt: nowIso() })
  eq.status = "EMPRUNTE"
  audit(db, user, "LOAN_APPROVED", `« ${l.equipmentName} » prêté à ${l.employeeName}`, l.id)
  loanChanged()
})

route("POST", "/loans/:id/refuse", "admin", ({ db, user, params, body }) => {
  const l = findLoan(db, params.id)
  if (l.status !== "DEMANDE") conflict("LOAN_NOT_PENDING", "Cette demande a déjà été traitée.")
  Object.assign(l, { status: "REFUSEE", refusalReason: optStr(body.reason), decidedAt: nowIso() })
  audit(db, user, "LOAN_REFUSED", `Demande de « ${l.equipmentName} » refusée pour ${l.employeeName}`, l.id)
  loanChanged()
})

route("POST", "/loans/:id/confirm-return", "admin", ({ db, user, params }) => {
  const l = findLoan(db, params.id)
  if (!ACTIVE.includes(l.status)) conflict("LOAN_NOT_ACTIVE", "Ce prêt n'est plus en cours.")
  Object.assign(l, { status: "RETOURNE", returnedAt: nowIso() })
  const eq = db.equipment.find((e) => e.id === l.equipmentId)
  if (eq && eq.status === "EMPRUNTE") eq.status = "DISPONIBLE"
  audit(db, user, "LOAN_RETURNED", `Retour de « ${l.equipmentName} » confirmé (${l.employeeName})`, l.id)
  loanChanged()
})

// ---------- Permissions ----------

const leaveView = (db: MockDb, l: LeaveRequest): LeaveRequest =>
  ({ ...l, employeeName: nameOf(db, l.employeeCode), siteName: db.sites.find((s) => s.id === l.siteId)?.name ?? null })
const newestFirst = (a: LeaveRequest, b: LeaveRequest) => b.createdAt.localeCompare(a.createdAt)

/** Dernier jour couvert : début + nombre de jours entamés − 1 (les heures restent sur le jour de début). */
function endDateOf(start: string, value: number, unit: string) {
  if (unit === "HEURES") return start
  const d = new Date(`${start}T12:00:00`)
  d.setDate(d.getDate() + Math.max(1, Math.ceil(value)) - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function notifyLeave(db: MockDb, l: LeaveRequest) {
  const owner = userOfEmployee(db, l.employeeCode)
  publish({ type: "leave.updated", leaveId: l.id }, [...adminIds(db), ...(owner ? [owner.id] : [])])
}

route("GET", "/me/leaves", "employee", ({ db, user }) => db.leaves.filter((l) => l.employeeCode === user.employeeCode).sort(newestFirst).map((l) => leaveView(db, l)))

route("POST", "/leaves", "employee", ({ db, user, body }) => {
  const e = me(db, user)
  if (!(body.type in LEAVE_TYPES)) invalid("Type de permission invalide.")
  if (!isDay(body.startDate)) invalid("Indiquez la date de début.")
  const unit = body.durationUnit === "HEURES" ? "HEURES" : body.durationUnit === "JOURS" ? "JOURS" : invalid("Unité de durée invalide.")
  const value = num(body.durationValue, "durée", { min: 0.25, max: unit === "HEURES" ? 24 : 365 })
  const reason = str(body.reason)
  if (!reason) invalid("Le motif est obligatoire.")
  if (body.siteId && !db.sites.some((s) => s.id === body.siteId)) invalid("Chantier introuvable.")
  const l: LeaveRequest = {
    id: uid(), employeeCode: e.employeeCode, employeeName: `${e.firstName} ${e.lastName}`, type: body.type, startDate: body.startDate,
    endDate: endDateOf(body.startDate, value, unit), durationValue: value, durationUnit: unit as LeaveRequest["durationUnit"], reason: reason.slice(0, 1000),
    siteId: body.siteId || null, siteName: null, status: "EN_ATTENTE", decidedAt: null, decidedByName: null, decisionNote: null,
    employeeSeenAt: null, createdAt: nowIso(),
  }
  db.leaves.push(l)
  notifyLeave(db, l)
  return leaveView(db, l)
})

route("POST", "/leaves/:id/cancel", "employee", ({ db, user, params }) => {
  const l = requireFound(db.leaves.find((x) => x.id === params.id && x.employeeCode === user.employeeCode), "Demande introuvable.")
  if (l.status !== "EN_ATTENTE") conflict("LEAVE_NOT_PENDING", "Cette demande a déjà été traitée.")
  l.status = "ANNULEE"
  notifyLeave(db, l)
})

route("POST", "/me/leaves/seen", "employee", ({ db, user }) => {
  db.leaves.forEach((l) => {
    if (l.employeeCode === user.employeeCode && (l.status === "ACCEPTEE" || l.status === "REFUSEE") && !l.employeeSeenAt) l.employeeSeenAt = nowIso()
  })
})

route("GET", "/leaves", "admin", ({ db, query }) => {
  const status = query.get("status"), code = query.get("employeeCode"), siteId = query.get("siteId")
  const from = query.get("from"), to = query.get("to")
  return db.leaves
    .filter((l) => (!status || l.status === status) && (!code || l.employeeCode === code) && (!siteId || l.siteId === siteId) &&
      (!from || l.endDate >= from) && (!to || l.startDate <= to))
    .sort(newestFirst).map((l) => leaveView(db, l))
})

route("GET", "/leaves/pending-count", "admin", ({ db }) => ({ count: db.leaves.filter((l) => l.status === "EN_ATTENTE").length }))

for (const [action, status] of [["approve", "ACCEPTEE"], ["refuse", "REFUSEE"]] as const) {
  route("POST", `/leaves/:id/${action}`, "admin", ({ db, user, params, body }) => {
    const l = requireFound(db.leaves.find((x) => x.id === params.id), "Demande introuvable.")
    if (l.status !== "EN_ATTENTE") conflict("LEAVE_NOT_PENDING", "Cette demande a déjà été traitée.")
    Object.assign(l, { status, decidedAt: nowIso(), decidedByName: user.name, decisionNote: optStr(body.note), employeeSeenAt: null })
    audit(db, user, status === "ACCEPTEE" ? "LEAVE_APPROVED" : "LEAVE_REFUSED",
      `Permission ${status === "ACCEPTEE" ? "acceptée" : "refusée"} pour ${nameOf(db, l.employeeCode)} (${LEAVE_TYPES[l.type]})`, l.employeeCode)
    notifyLeave(db, l)
  })
}
