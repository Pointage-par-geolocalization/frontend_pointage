// src/mocks/handlers/attendance.ts — pointage, rémunération, paiements, rapports, tableau de bord,
// contrôles de présence. Mêmes règles que le serveur réel : GPS, une seule session ouverte,
// plafond journalier appliqué au total du jour, reste à payer jamais dépassé.
import { fail, invalid, num, route, str } from "../router"
import type { MockDb, MockUser, StoredAttendance } from "../store"
import type { AttendanceLocation } from "../../services/attendance"
import type { PresenceRound } from "../../services/presence"
import type { DashboardToday } from "../../services/admin"
import { calculateDailySalary, formatAriary } from "../../utils/salaryCalculator"
import { distanceInMeters } from "../../utils/distance"
import { dateKey, todayKey } from "../../utils/date"
import { publish } from "../events"
import { gpsCheckFor, uid } from "../util"
import {
  adminIds, attendanceView, audit, balanceOf, conflict, employeeName, findEmployee, me, nameOf, requireFound, unprocessable, userOfEmployee,
} from "./shared"

const nowIso = () => new Date().toISOString()

function parseLocation(v: any): AttendanceLocation {
  if (!v || typeof v !== "object") invalid("Position GPS manquante.")
  const latitude = num(v.latitude, "latitude", { min: -90, max: 90 })
  const longitude = num(v.longitude, "longitude", { min: -180, max: 180 })
  return {
    latitude, longitude,
    altitude: typeof v.altitude === "number" ? v.altitude : null,
    accuracy: typeof v.accuracy === "number" ? v.accuracy : 0,
    ...(typeof v.address === "string" && v.address ? { address: v.address } : {}),
  }
}

/** Chantier actif rattaché au lieu de pointage pour ce jour. */
function activeSiteFor(db: MockDb, workplaceId: string, day: string) {
  return db.sites.find((s) => s.workplaceId === workplaceId && s.status !== "TERMINE" &&
    (!s.startDate || s.startDate <= day) && (!s.endDate || s.endDate >= day)) ?? null
}

const openSessionOf = (db: MockDb, code: string) => db.attendance.find((a) => a.employeeCode === code && a.status === "EN_COURS")

function startSession(db: MockDb, code: string, workplaceId: string, extra: Partial<StoredAttendance>): StoredAttendance {
  const w = requireFound(db.workplaces.find((x) => x.id === workplaceId), "Département introuvable.")
  const now = new Date()
  const day = dateKey(now)
  const site = activeSiteFor(db, w.id, day)
  const a: StoredAttendance = {
    id: uid(), employeeCode: code, workDate: day, workplaceId: w.id, departmentName: w.name,
    siteId: site?.id ?? null, siteName: site?.name ?? null, entryTime: now.toISOString(), exitTime: null,
    workedMinutes: 0, dailySalary: 0, entryLocation: null, exitLocation: null, entryGpsCheck: null, exitGpsCheck: null,
    status: "EN_COURS", entrySource: "EMPLOYEE", exitSource: null, lastLocation: null, lastLocationAt: null,
    ...extra,
  }
  db.attendance.push(a)
  return a
}

/** Clôture d'une session : durée, salaire de la session (plafond sur le total du jour), cumul. */
function finalize(db: MockDb, a: StoredAttendance, exit: Date, extra: Partial<StoredAttendance>) {
  const e = findEmployee(db, a.employeeCode)
  const worked = Math.max(0, Math.round((exit.getTime() - Date.parse(a.entryTime)) / 60000))
  const before = db.attendance
    .filter((x) => x.employeeCode === a.employeeCode && x.workDate === a.workDate && x.status === "TERMINEE" && x.id !== a.id)
    .reduce((s, x) => s + x.workedMinutes, 0)
  const settings = { dailySalary: e.baseDailySalary, normalWorkMinutes: db.settings.normalWorkMinutes }
  const pay = Math.max(0, calculateDailySalary(before + worked, settings) - calculateDailySalary(before, settings))
  Object.assign(a, { exitTime: exit.toISOString(), workedMinutes: worked, dailySalary: pay, status: "TERMINEE", ...extra })
  const cumulative = balanceOf(db, a.employeeCode).earned + pay
  db.salaryRecords.push({ id: uid(), employeeCode: a.employeeCode, attendanceId: a.id, workDate: a.workDate, workedMinutes: worked, dailySalary: pay, cumulativeSalary: cumulative, createdAt: nowIso() })
  publish({ type: "attendance.updated" })
  return { workedMinutes: worked, dailySalary: pay }
}

function checkZone(db: MockDb, workplaceId: string, loc: AttendanceLocation) {
  const w = db.workplaces.find((x) => x.id === workplaceId)
  if (!w) return null
  const check = gpsCheckFor(loc, w)
  if (w.geofencingEnabled && !check.withinRadius) {
    unprocessable("GPS_OUT_OF_RANGE",
      `Vous êtes actuellement à ${check.distance} mètres du département sélectionné. Vous devez être dans un rayon de ${w.radiusMeters} mètres pour effectuer votre pointage.`,
      { distance: check.distance, radiusMeters: w.radiusMeters })
  }
  return check
}

// ---------- Salarié ----------

route("POST", "/attendance/clock-in", "employee", ({ db, user, body }) => {
  const e = me(db, user)
  const workplaceId = str(body.workplaceId)
  if (e.departmentIds.length === 0) unprocessable("NO_DEPARTMENT_ASSIGNED", "Aucun département ne vous est affecté. Contactez votre administrateur.")
  if (!e.departmentIds.includes(workplaceId)) unprocessable("DEPARTMENT_NOT_ALLOWED", "Vous n'êtes pas autorisé à pointer dans ce département.")
  if (openSessionOf(db, e.employeeCode)) conflict("ALREADY_CLOCKED_IN", "Vous avez déjà une entrée en cours. Pointez d'abord votre sortie.")
  const loc = parseLocation(body.location)
  const gpsCheck = checkZone(db, workplaceId, loc)
  const a = startSession(db, e.employeeCode, workplaceId, { entryLocation: loc, entryGpsCheck: gpsCheck, lastLocation: loc, lastLocationAt: nowIso() })
  publish({ type: "attendance.updated" })
  return { attendance: attendanceView(db, a), gpsCheck }
})

route("POST", "/attendance/clock-out", "employee", ({ db, user, body }) => {
  const code = user.employeeCode!
  const open = openSessionOf(db, code)
  if (!open) {
    const hasToday = db.attendance.some((a) => a.employeeCode === code && a.workDate === todayKey())
    conflict("NO_OPEN_SESSION", hasToday ? "Aucune entrée en cours. Pointez d'abord une nouvelle entrée." : "Vous devez d'abord pointer votre entrée.")
  }
  const loc = parseLocation(body.location)
  const gpsCheck = open!.workplaceId ? checkZone(db, open!.workplaceId, loc) : null
  const res = finalize(db, open!, new Date(), { exitLocation: loc, exitGpsCheck: gpsCheck, exitSource: "EMPLOYEE", lastLocation: loc, lastLocationAt: nowIso() })
  return { ...res, gpsCheck }
})

route("GET", "/me/attendance/today", "employee", ({ db, user }) =>
  db.attendance.filter((a) => a.employeeCode === user.employeeCode &&
    (a.workDate === todayKey() || a.status === "EN_COURS"))
    .sort((a, b) => a.entryTime.localeCompare(b.entryTime)).map((a) => attendanceView(db, a)))

route("GET", "/me/attendance", "employee", ({ db, user, query }) =>
  db.attendance.filter((a) => a.employeeCode === user.employeeCode)
    .sort((a, b) => b.entryTime.localeCompare(a.entryTime)).slice(0, Number(query.get("limit") ?? 60)).map((a) => attendanceView(db, a)))

/** Position transmise pendant une session ouverte (contrôles de présence). */
route("POST", "/me/presence/ping", "employee", ({ db, user, body }) => {
  const open = openSessionOf(db, user.employeeCode!)
  if (!open) conflict("NO_OPEN_SESSION", "Aucune session de pointage ouverte.")
  const loc = parseLocation(body.location)
  open!.lastLocation = loc
  open!.lastLocationAt = nowIso()
  const w = open!.workplaceId ? db.workplaces.find((x) => x.id === open!.workplaceId) : undefined
  const check = w ? gpsCheckFor(loc, w) : null
  return { withinRadius: check?.withinRadius ?? true, distance: check?.distance ?? 0, radiusMeters: w?.radiusMeters ?? 0, departmentName: open!.departmentName }
})

// ---------- Admin ----------

route("GET", "/attendance", "admin", ({ db, query }) => {
  const date = query.get("date"), from = query.get("from"), to = query.get("to")
  const code = query.get("employeeCode"), siteId = query.get("siteId")
  return db.attendance
    .filter((a) => (!date || a.workDate === date) && (!from || a.workDate >= from) && (!to || a.workDate <= to) &&
      (!code || a.employeeCode === code) && (!siteId || a.siteId === siteId))
    .sort((a, b) => a.entryTime.localeCompare(b.entryTime))
    .map((a) => attendanceView(db, a))
})

route("POST", "/admin/attendance/clock-in", "admin", ({ db, user, body }) => {
  const e = findEmployee(db, str(body.employeeCode))
  if (!e.active) unprocessable("ACCOUNT_DISABLED", "Ce salarié est désactivé.")
  if (openSessionOf(db, e.employeeCode)) conflict("ALREADY_CLOCKED_IN", "Ce salarié a déjà une entrée en cours.")
  const a = startSession(db, e.employeeCode, str(body.workplaceId), { entrySource: "ADMIN" })
  audit(db, user, "ATTENDANCE_CREATED", `Pointage démarré à distance pour ${employeeName(e)} (${a.departmentName})`, e.employeeCode)
  publish({ type: "attendance.updated" })
  return { id: a.id }
})

route("POST", "/admin/attendance/:id/clock-out", "admin", ({ db, user, params, body }) => {
  const a = requireFound(db.attendance.find((x) => x.id === params.id), "Pointage introuvable.")
  if (a.status === "TERMINEE") conflict("ALREADY_FINISHED", "Ce pointage est déjà terminé.")
  let exit = new Date()
  if (body.exitTime) {
    exit = new Date(body.exitTime)
    if (Number.isNaN(exit.getTime())) invalid("Heure de sortie invalide.")
    if (exit.getTime() < Date.parse(a.entryTime)) invalid("L'heure de sortie doit être après l'heure d'entrée.")
    if (exit.getTime() > Date.now() + 60000) invalid("L'heure de sortie ne peut pas être dans le futur.")
  }
  const res = finalize(db, a, exit, { exitSource: "ADMIN" })
  audit(db, user, "ATTENDANCE_UPDATED", `Pointage arrêté à distance pour ${nameOf(db, a.employeeCode)}`, a.employeeCode)
  return res
})

// ---------- Rémunération & paiements ----------

route("GET", "/me/salary", "employee", ({ db, user }) => {
  const records = db.salaryRecords.filter((r) => r.employeeCode === user.employeeCode).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return { ...balanceOf(db, user.employeeCode!), records, totalMinutes: records.reduce((s, r) => s + r.workedMinutes, 0) }
})

route("GET", "/salary/summary", "admin", ({ db }) => {
  const rows = [...db.employees]
    .sort((a, b) => a.lastName.localeCompare(b.lastName, "fr"))
    .map((employee) => ({ employee, ...balanceOf(db, employee.employeeCode) }))
  const totals = rows.reduce((t, r) => ({ earned: t.earned + r.earned, paid: t.paid + r.paid, due: t.due + r.due }), { earned: 0, paid: 0, due: 0 })
  return { rows, totals }
})

route("POST", "/payments", "admin", ({ db, user, body }) => {
  const e = findEmployee(db, str(body.employeeCode))
  const amount = num(body.amount, "montant", { min: 1, int: true })
  const { due } = balanceOf(db, e.employeeCode)
  if (amount > due) unprocessable("AMOUNT_EXCEEDS_DUE", `Ce montant dépasse le reste à payer (${formatAriary(due)}).`)
  const p = { id: uid(), employeeCode: e.employeeCode, amount, note: str(body.note), date: todayKey(), createdAt: nowIso() }
  db.payments.push(p)
  audit(db, user, "PAYMENT_CREATED", `${formatAriary(amount)} payés à ${employeeName(e)}${p.note ? ` — ${p.note}` : ""}`, e.employeeCode)
  return p
})

const paymentsOf = (db: MockDb, code: string) => db.payments.filter((p) => p.employeeCode === code).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
route("GET", "/payments", "admin", ({ db, query }) => paymentsOf(db, str(query.get("employeeCode"))))
route("GET", "/me/payments", "employee", ({ db, user }) => paymentsOf(db, user.employeeCode!))

route("GET", "/reports/salary", "admin", ({ db, query }) => {
  const from = query.get("from") ?? "0000-00-00", to = query.get("to") ?? "9999-99-99", siteId = query.get("siteId")
  const rows = new Map<string, { employeeCode: string; name: string; days: Set<string>; minutes: number; total: number }>()
  for (const r of db.salaryRecords) {
    if (r.workDate < from || r.workDate > to) continue
    if (siteId && db.attendance.find((a) => a.id === r.attendanceId)?.siteId !== siteId) continue
    const row = rows.get(r.employeeCode) ?? { employeeCode: r.employeeCode, name: nameOf(db, r.employeeCode), days: new Set(), minutes: 0, total: 0 }
    row.days.add(r.workDate); row.minutes += r.workedMinutes; row.total += r.dailySalary
    rows.set(r.employeeCode, row)
  }
  const list = [...rows.values()].map((r) => ({ ...r, days: r.days.size })).sort((a, b) => b.total - a.total)
  return { rows: list, total: list.reduce((s, r) => s + r.total, 0) }
})

// ---------- Tableau de bord ----------

route("GET", "/dashboard/today", "admin", ({ db }): DashboardToday => {
  const today = todayKey()
  const ref = (code: string) => ({ employeeCode: code, name: nameOf(db, code) })
  const active = db.employees.filter((e) => e.active)
  const todays = db.attendance.filter((a) => a.workDate === today)
  const presentCodes = new Set(todays.map((a) => a.employeeCode))
  const onLeave = db.leaves.filter((l) => l.status === "ACCEPTEE" && l.startDate <= today && l.endDate >= today)
  const leaveCodes = new Set(onLeave.map((l) => l.employeeCode))
  const minutesBy = new Map<string, number>()
  todays.forEach((a) => minutesBy.set(a.employeeCode, (minutesBy.get(a.employeeCode) ?? 0) + a.workedMinutes))
  const [h, m] = db.settings.normalEntryTime.split(":").map(Number)
  const firstEntry = new Map<string, string>()
  todays.forEach((a) => { const cur = firstEntry.get(a.employeeCode); if (!cur || a.entryTime < cur) firstEntry.set(a.employeeCode, a.entryTime) })
  const late = [...firstEntry.entries()].map(([code, entryTime]) => {
    const limit = new Date(entryTime); limit.setHours(h, m + db.settings.toleranceMinutes, 0, 0)
    return { ...ref(code), entryTime, lateMinutes: Math.round((Date.parse(entryTime) - limit.getTime()) / 60000) }
  }).filter((r) => r.lateMinutes > 0).sort((a, b) => b.lateMinutes - a.lateMinutes)
  const lastRound = db.rounds.find((r) => dateKey(new Date(r.startedAt)) === today) ?? null // rondes : plus récente d'abord
  return {
    date: today,
    activeEmployees: active.length,
    presentCount: presentCodes.size,
    absent: active.filter((e) => !presentCodes.has(e.employeeCode) && !leaveCodes.has(e.employeeCode)).map((e) => ref(e.employeeCode)),
    onLeave: onLeave.filter((l) => !presentCodes.has(l.employeeCode)).map((l) => ({ ...ref(l.employeeCode), type: l.type })),
    totalMinutes: todays.reduce((s, a) => s + a.workedMinutes, 0),
    dailyPay: todays.reduce((s, a) => s + a.dailySalary, 0),
    cashDue: active.reduce((s, e) => s + balanceOf(db, e.employeeCode).due, 0),
    topWorked: [...minutesBy.entries()].filter(([, min]) => min > 0).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([code, minutes]) => ({ ...ref(code), minutes })),
    currentlyIn: todays.filter((a) => a.status === "EN_COURS").map((a) => ({
      ...ref(a.employeeCode), attendanceId: a.id, entryTime: a.entryTime, departmentName: a.departmentName,
      siteName: db.sites.find((s) => s.id === a.siteId)?.name ?? null,
    })),
    late,
    pendingLeaves: db.leaves.filter((l) => l.status === "EN_ATTENTE").length,
    pendingLoans: db.loans.filter((l) => l.status === "DEMANDE" || l.status === "RETOUR_DEMANDE").length,
    activeSites: db.sites.filter((s) => s.status === "EN_COURS").length,
    presence: {
      lastRound,
      anomalies: db.checks.filter((c) => (c.status === "HORS_ZONE" || c.status === "SANS_REPONSE") && c.checkedAt && dateKey(new Date(c.checkedAt)) === today)
        .sort((a, b) => (b.checkedAt ?? "").localeCompare(a.checkedAt ?? "")),
    },
  }
})

// ---------- Contrôles de présence ----------

/** Délais raccourcis en mode démo pour voir le résultat tout de suite. */
const GRACE_MS = 20_000
const FRESHNESS_MS = 15 * 60_000

export function startRound(db: MockDb, trigger: "AUTO" | "MANUEL", by: MockUser | null): PresenceRound {
  const open = db.attendance.filter((a) => a.status === "EN_COURS")
  const round: PresenceRound = { id: uid(), startedAt: nowIso(), evaluatedAt: null, trigger, total: open.length, present: 0, outOfZone: 0, noResponse: 0 }
  db.rounds.unshift(round)
  for (const a of open) {
    db.checks.push({
      id: uid(), roundId: round.id, attendanceId: a.id, employeeCode: a.employeeCode, employeeName: nameOf(db, a.employeeCode),
      departmentName: a.departmentName, siteId: a.siteId ?? null, siteName: db.sites.find((s) => s.id === a.siteId)?.name ?? null,
      status: "EN_ATTENTE", location: null, locationAt: null, distance: null,
      radiusMeters: db.workplaces.find((w) => w.id === a.workplaceId)?.radiusMeters ?? null, checkedAt: null,
    })
  }
  audit(db, by, "PRESENCE_CHECK_TRIGGERED", `Contrôle de présence ${trigger === "AUTO" ? "automatique" : "lancé manuellement"} (${open.length} salarié${open.length > 1 ? "s" : ""})`, round.id)
  // Demande de position aux téléphones des salariés en poste.
  const targets = open.map((a) => userOfEmployee(db, a.employeeCode)?.id).filter((id): id is string => !!id)
  if (targets.length) publish({ type: "presence.request", roundId: round.id }, targets)
  publish({ type: "presence.updated" }, adminIds(db))
  return round
}

function evaluateRound(db: MockDb, round: PresenceRound) {
  const started = Date.parse(round.startedAt)
  for (const c of db.checks.filter((x) => x.roundId === round.id)) {
    const a = db.attendance.find((x) => x.id === c.attendanceId)
    const w = a?.workplaceId ? db.workplaces.find((x) => x.id === a.workplaceId) : undefined
    const fresh = a?.lastLocation && a.lastLocationAt && Date.parse(a.lastLocationAt) >= started - FRESHNESS_MS
    c.checkedAt = nowIso()
    if (!a || !fresh || !a.lastLocation) { c.status = "SANS_REPONSE"; continue }
    c.location = { latitude: a.lastLocation.latitude, longitude: a.lastLocation.longitude, accuracy: a.lastLocation.accuracy }
    c.locationAt = a.lastLocationAt ?? null
    if (!w) { c.status = "PRESENT"; continue }
    const d = Math.round(distanceInMeters(a.lastLocation.latitude, a.lastLocation.longitude, w.latitude, w.longitude))
    c.distance = d
    c.radiusMeters = w.radiusMeters
    c.status = d <= w.radiusMeters ? "PRESENT" : "HORS_ZONE"
  }
  const checks = db.checks.filter((x) => x.roundId === round.id)
  Object.assign(round, {
    evaluatedAt: nowIso(),
    present: checks.filter((c) => c.status === "PRESENT").length,
    outOfZone: checks.filter((c) => c.status === "HORS_ZONE").length,
    noResponse: checks.filter((c) => c.status === "SANS_REPONSE").length,
  })
  publish({ type: "presence.updated" }, adminIds(db))
}

/**
 * « Horloge » du faux serveur, appelée à chaque requête : évalue les rondes dont le délai de
 * réponse est écoulé et lance la ronde automatique quand l'intervalle est atteint.
 * Retourne true si des données ont changé.
 */
export function presenceTick(db: MockDb): boolean {
  let changed = false
  for (const r of db.rounds) {
    if (!r.evaluatedAt && Date.now() - Date.parse(r.startedAt) >= GRACE_MS) { evaluateRound(db, r); changed = true }
  }
  if (db.settings.presenceCheckEnabled && db.attendance.some((a) => a.status === "EN_COURS")) {
    const lastAuto = db.rounds.find((r) => r.trigger === "AUTO")
    const due = !lastAuto || Date.now() - Date.parse(lastAuto.startedAt) >= db.settings.presenceCheckIntervalMinutes * 60_000
    if (due) { startRound(db, "AUTO", null); changed = true }
  }
  return changed
}

route("GET", "/presence/rounds", "admin", ({ db, query }) => {
  const from = query.get("from"), to = query.get("to"), limit = Number(query.get("limit") ?? 100)
  return db.rounds.filter((r) => {
    const day = dateKey(new Date(r.startedAt))
    return (!from || day >= from) && (!to || day <= to)
  }).slice(0, limit)
})

route("GET", "/presence/checks", "admin", ({ db, query }) => {
  const roundId = query.get("roundId"), date = query.get("date"), code = query.get("employeeCode")
  const siteId = query.get("siteId"), status = query.get("status")
  const roundDay = new Map(db.rounds.map((r) => [r.id, dateKey(new Date(r.startedAt))]))
  return db.checks
    .filter((c) => (!roundId || c.roundId === roundId) && (!date || roundDay.get(c.roundId) === date) &&
      (!code || c.employeeCode === code) && (!siteId || c.siteId === siteId) && (!status || c.status === status))
    .sort((a, b) => (b.checkedAt ?? "9").localeCompare(a.checkedAt ?? "9"))
})

route("POST", "/presence/rounds", "admin", ({ db, user }) => {
  if (!db.attendance.some((a) => a.status === "EN_COURS")) fail(409, "NO_OPEN_SESSION", "Aucun salarié n'est en poste : rien à contrôler.")
  return startRound(db, "MANUEL", user)
})


// // src/mocks/handlers/attendance.ts — pointage, rémunération, paiements, rapports, tableau de bord,
// // contrôles de présence. Mêmes règles que le serveur réel : GPS, une seule session ouverte,
// // plafond journalier appliqué au total du jour, reste à payer jamais dépassé.
// import { fail, invalid, num, route, str } from "../router"
// import type { MockDb, MockUser, StoredAttendance } from "../store"
// import type { AttendanceLocation } from "../../services/attendance"
// import type { PresenceRound } from "../../services/presence"
// import type { DashboardToday } from "../../services/admin"
// import { calculateDailySalary, formatAriary } from "../../utils/salaryCalculator"
// import { distanceInMeters } from "../../utils/distance"
// import { dateKey, todayKey } from "../../utils/date"
// import { publish } from "../events"
// import { gpsCheckFor, uid } from "../util"
// import {
//   adminIds, attendanceView, audit, balanceOf, conflict, employeeName, findEmployee, me, nameOf, requireFound, unprocessable, userOfEmployee,
// } from "./shared"

// const nowIso = () => new Date().toISOString()

// function parseLocation(v: any): AttendanceLocation {
//   if (!v || typeof v !== "object") invalid("Position GPS manquante.")
//   const latitude = num(v.latitude, "latitude", { min: -90, max: 90 })
//   const longitude = num(v.longitude, "longitude", { min: -180, max: 180 })
//   return {
//     latitude, longitude,
//     altitude: typeof v.altitude === "number" ? v.altitude : null,
//     accuracy: typeof v.accuracy === "number" ? v.accuracy : 0,
//     ...(typeof v.address === "string" && v.address ? { address: v.address } : {}),
//   }
// }

// /** Chantier actif rattaché au lieu de pointage pour ce jour. */
// function activeSiteFor(db: MockDb, workplaceId: string, day: string) {
//   return db.sites.find((s) => s.workplaceId === workplaceId && s.status !== "TERMINE" &&
//     (!s.startDate || s.startDate <= day) && (!s.endDate || s.endDate >= day)) ?? null
// }

// const openSessionOf = (db: MockDb, code: string) => db.attendance.find((a) => a.employeeCode === code && a.status === "EN_COURS")

// function startSession(db: MockDb, code: string, workplaceId: string, extra: Partial<StoredAttendance>): StoredAttendance {
//   const w = requireFound(db.workplaces.find((x) => x.id === workplaceId), "Département introuvable.")
//   const now = new Date()
//   const day = dateKey(now)
//   const site = activeSiteFor(db, w.id, day)
//   const a: StoredAttendance = {
//     id: uid(), employeeCode: code, workDate: day, workplaceId: w.id, departmentName: w.name,
//     siteId: site?.id ?? null, siteName: site?.name ?? null, entryTime: now.toISOString(), exitTime: null,
//     workedMinutes: 0, dailySalary: 0, entryLocation: null, exitLocation: null, entryGpsCheck: null, exitGpsCheck: null,
//     status: "EN_COURS", entrySource: "EMPLOYEE", exitSource: null, lastLocation: null, lastLocationAt: null,
//     ...extra,
//   }
//   db.attendance.push(a)
//   return a
// }

// /** Clôture d'une session : durée, salaire de la session (plafond sur le total du jour), cumul. */
// function finalize(db: MockDb, a: StoredAttendance, exit: Date, extra: Partial<StoredAttendance>) {
//   const e = findEmployee(db, a.employeeCode)
//   const worked = Math.max(0, Math.round((exit.getTime() - Date.parse(a.entryTime)) / 60000))
//   const before = db.attendance
//     .filter((x) => x.employeeCode === a.employeeCode && x.workDate === a.workDate && x.status === "TERMINEE" && x.id !== a.id)
//     .reduce((s, x) => s + x.workedMinutes, 0)
//   const settings = { dailySalary: e.baseDailySalary, normalWorkMinutes: db.settings.normalWorkMinutes }
//   const pay = Math.max(0, calculateDailySalary(before + worked, settings) - calculateDailySalary(before, settings))
//   Object.assign(a, { exitTime: exit.toISOString(), workedMinutes: worked, dailySalary: pay, status: "TERMINEE", ...extra })
//   const cumulative = balanceOf(db, a.employeeCode).earned + pay
//   db.salaryRecords.push({ id: uid(), employeeCode: a.employeeCode, attendanceId: a.id, workDate: a.workDate, workedMinutes: worked, dailySalary: pay, cumulativeSalary: cumulative, createdAt: nowIso() })
//   publish({ type: "attendance.updated" })
//   return { workedMinutes: worked, dailySalary: pay }
// }

// function checkZone(db: MockDb, workplaceId: string, loc: AttendanceLocation) {
//   const w = db.workplaces.find((x) => x.id === workplaceId)
//   if (!w) return null
//   const check = gpsCheckFor(loc, w)
//   if (w.geofencingEnabled && !check.withinRadius) {
//     unprocessable("GPS_OUT_OF_RANGE",
//       `Vous êtes actuellement à ${check.distance} mètres du département sélectionné. Vous devez être dans un rayon de ${w.radiusMeters} mètres pour effectuer votre pointage.`,
//       { distance: check.distance, radiusMeters: w.radiusMeters })
//   }
//   return check
// }

// // ---------- Salarié ----------

// route("POST", "/attendance/clock-in", "employee", ({ db, user, body }) => {
//   const e = me(db, user)
//   const workplaceId = str(body.workplaceId)
//   if (e.departmentIds.length === 0) unprocessable("NO_DEPARTMENT_ASSIGNED", "Aucun département ne vous est affecté. Contactez votre administrateur.")
//   if (!e.departmentIds.includes(workplaceId)) unprocessable("DEPARTMENT_NOT_ALLOWED", "Vous n'êtes pas autorisé à pointer dans ce département.")
//   if (openSessionOf(db, e.employeeCode)) conflict("ALREADY_CLOCKED_IN", "Vous avez déjà une entrée en cours. Pointez d'abord votre sortie.")
//   const loc = parseLocation(body.location)
//   const gpsCheck = checkZone(db, workplaceId, loc)
//   const a = startSession(db, e.employeeCode, workplaceId, { entryLocation: loc, entryGpsCheck: gpsCheck, lastLocation: loc, lastLocationAt: nowIso() })
//   publish({ type: "attendance.updated" })
//   return { attendance: attendanceView(db, a), gpsCheck }
// })

// route("POST", "/attendance/clock-out", "employee", ({ db, user, body }) => {
//   const code = user.employeeCode!
//   const open = openSessionOf(db, code)
//   if (!open) {
//     const hasToday = db.attendance.some((a) => a.employeeCode === code && a.workDate === todayKey())
//     conflict("NO_OPEN_SESSION", hasToday ? "Aucune entrée en cours. Pointez d'abord une nouvelle entrée." : "Vous devez d'abord pointer votre entrée.")
//   }
//   const loc = parseLocation(body.location)
//   const gpsCheck = open!.workplaceId ? checkZone(db, open!.workplaceId, loc) : null
//   const res = finalize(db, open!, new Date(), { exitLocation: loc, exitGpsCheck: gpsCheck, exitSource: "EMPLOYEE", lastLocation: loc, lastLocationAt: nowIso() })
//   return { ...res, gpsCheck }
// })

// route("GET", "/me/attendance/today", "employee", ({ db, user }) =>
//   db.attendance.filter((a) => a.employeeCode === user.employeeCode && a.workDate === todayKey())
//     .sort((a, b) => a.entryTime.localeCompare(b.entryTime)).map((a) => attendanceView(db, a)))

// route("GET", "/me/attendance", "employee", ({ db, user, query }) =>
//   db.attendance.filter((a) => a.employeeCode === user.employeeCode)
//     .sort((a, b) => b.entryTime.localeCompare(a.entryTime)).slice(0, Number(query.get("limit") ?? 60)).map((a) => attendanceView(db, a)))

// /** Position transmise pendant une session ouverte (contrôles de présence). */
// route("POST", "/me/presence/ping", "employee", ({ db, user, body }) => {
//   const open = openSessionOf(db, user.employeeCode!)
//   if (!open) conflict("NO_OPEN_SESSION", "Aucune session de pointage ouverte.")
//   const loc = parseLocation(body.location)
//   open!.lastLocation = loc
//   open!.lastLocationAt = nowIso()
//   const w = open!.workplaceId ? db.workplaces.find((x) => x.id === open!.workplaceId) : undefined
//   const check = w ? gpsCheckFor(loc, w) : null
//   return { withinRadius: check?.withinRadius ?? true, distance: check?.distance ?? 0, radiusMeters: w?.radiusMeters ?? 0, departmentName: open!.departmentName }
// })

// // ---------- Admin ----------

// route("GET", "/attendance", "admin", ({ db, query }) => {
//   const date = query.get("date"), from = query.get("from"), to = query.get("to")
//   const code = query.get("employeeCode"), siteId = query.get("siteId")
//   return db.attendance
//     .filter((a) => (!date || a.workDate === date) && (!from || a.workDate >= from) && (!to || a.workDate <= to) &&
//       (!code || a.employeeCode === code) && (!siteId || a.siteId === siteId))
//     .sort((a, b) => a.entryTime.localeCompare(b.entryTime))
//     .map((a) => attendanceView(db, a))
// })

// route("POST", "/admin/attendance/clock-in", "admin", ({ db, user, body }) => {
//   const e = findEmployee(db, str(body.employeeCode))
//   if (!e.active) unprocessable("ACCOUNT_DISABLED", "Ce salarié est désactivé.")
//   if (openSessionOf(db, e.employeeCode)) conflict("ALREADY_CLOCKED_IN", "Ce salarié a déjà une entrée en cours.")
//   const a = startSession(db, e.employeeCode, str(body.workplaceId), { entrySource: "ADMIN" })
//   audit(db, user, "ATTENDANCE_CREATED", `Pointage démarré à distance pour ${employeeName(e)} (${a.departmentName})`, e.employeeCode)
//   publish({ type: "attendance.updated" })
//   return { id: a.id }
// })

// route("POST", "/admin/attendance/:id/clock-out", "admin", ({ db, user, params, body }) => {
//   const a = requireFound(db.attendance.find((x) => x.id === params.id), "Pointage introuvable.")
//   if (a.status === "TERMINEE") conflict("ALREADY_FINISHED", "Ce pointage est déjà terminé.")
//   let exit = new Date()
//   if (body.exitTime) {
//     exit = new Date(body.exitTime)
//     if (Number.isNaN(exit.getTime())) invalid("Heure de sortie invalide.")
//     if (exit.getTime() < Date.parse(a.entryTime)) invalid("L'heure de sortie doit être après l'heure d'entrée.")
//     if (exit.getTime() > Date.now() + 60000) invalid("L'heure de sortie ne peut pas être dans le futur.")
//   }
//   const res = finalize(db, a, exit, { exitSource: "ADMIN" })
//   audit(db, user, "ATTENDANCE_UPDATED", `Pointage arrêté à distance pour ${nameOf(db, a.employeeCode)}`, a.employeeCode)
//   return res
// })

// // ---------- Rémunération & paiements ----------

// route("GET", "/me/salary", "employee", ({ db, user }) => {
//   const records = db.salaryRecords.filter((r) => r.employeeCode === user.employeeCode).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
//   return { ...balanceOf(db, user.employeeCode!), records, totalMinutes: records.reduce((s, r) => s + r.workedMinutes, 0) }
// })

// route("GET", "/salary/summary", "admin", ({ db }) => {
//   const rows = [...db.employees]
//     .sort((a, b) => a.lastName.localeCompare(b.lastName, "fr"))
//     .map((employee) => ({ employee, ...balanceOf(db, employee.employeeCode) }))
//   const totals = rows.reduce((t, r) => ({ earned: t.earned + r.earned, paid: t.paid + r.paid, due: t.due + r.due }), { earned: 0, paid: 0, due: 0 })
//   return { rows, totals }
// })

// route("POST", "/payments", "admin", ({ db, user, body }) => {
//   const e = findEmployee(db, str(body.employeeCode))
//   const amount = num(body.amount, "montant", { min: 1, int: true })
//   const { due } = balanceOf(db, e.employeeCode)
//   if (amount > due) unprocessable("AMOUNT_EXCEEDS_DUE", `Ce montant dépasse le reste à payer (${formatAriary(due)}).`)
//   const p = { id: uid(), employeeCode: e.employeeCode, amount, note: str(body.note), date: todayKey(), createdAt: nowIso() }
//   db.payments.push(p)
//   audit(db, user, "PAYMENT_CREATED", `${formatAriary(amount)} payés à ${employeeName(e)}${p.note ? ` — ${p.note}` : ""}`, e.employeeCode)
//   return p
// })

// const paymentsOf = (db: MockDb, code: string) => db.payments.filter((p) => p.employeeCode === code).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
// route("GET", "/payments", "admin", ({ db, query }) => paymentsOf(db, str(query.get("employeeCode"))))
// route("GET", "/me/payments", "employee", ({ db, user }) => paymentsOf(db, user.employeeCode!))

// route("GET", "/reports/salary", "admin", ({ db, query }) => {
//   const from = query.get("from") ?? "0000-00-00", to = query.get("to") ?? "9999-99-99", siteId = query.get("siteId")
//   const rows = new Map<string, { employeeCode: string; name: string; days: Set<string>; minutes: number; total: number }>()
//   for (const r of db.salaryRecords) {
//     if (r.workDate < from || r.workDate > to) continue
//     if (siteId && db.attendance.find((a) => a.id === r.attendanceId)?.siteId !== siteId) continue
//     const row = rows.get(r.employeeCode) ?? { employeeCode: r.employeeCode, name: nameOf(db, r.employeeCode), days: new Set(), minutes: 0, total: 0 }
//     row.days.add(r.workDate); row.minutes += r.workedMinutes; row.total += r.dailySalary
//     rows.set(r.employeeCode, row)
//   }
//   const list = [...rows.values()].map((r) => ({ ...r, days: r.days.size })).sort((a, b) => b.total - a.total)
//   return { rows: list, total: list.reduce((s, r) => s + r.total, 0) }
// })

// // ---------- Tableau de bord ----------

// route("GET", "/dashboard/today", "admin", ({ db }): DashboardToday => {
//   const today = todayKey()
//   const ref = (code: string) => ({ employeeCode: code, name: nameOf(db, code) })
//   const active = db.employees.filter((e) => e.active)
//   const todays = db.attendance.filter((a) => a.workDate === today)
//   const presentCodes = new Set(todays.map((a) => a.employeeCode))
//   const onLeave = db.leaves.filter((l) => l.status === "ACCEPTEE" && l.startDate <= today && l.endDate >= today)
//   const leaveCodes = new Set(onLeave.map((l) => l.employeeCode))
//   const minutesBy = new Map<string, number>()
//   todays.forEach((a) => minutesBy.set(a.employeeCode, (minutesBy.get(a.employeeCode) ?? 0) + a.workedMinutes))
//   const [h, m] = db.settings.normalEntryTime.split(":").map(Number)
//   const firstEntry = new Map<string, string>()
//   todays.forEach((a) => { const cur = firstEntry.get(a.employeeCode); if (!cur || a.entryTime < cur) firstEntry.set(a.employeeCode, a.entryTime) })
//   const late = [...firstEntry.entries()].map(([code, entryTime]) => {
//     const limit = new Date(entryTime); limit.setHours(h, m + db.settings.toleranceMinutes, 0, 0)
//     return { ...ref(code), entryTime, lateMinutes: Math.round((Date.parse(entryTime) - limit.getTime()) / 60000) }
//   }).filter((r) => r.lateMinutes > 0).sort((a, b) => b.lateMinutes - a.lateMinutes)
//   const lastRound = db.rounds.find((r) => dateKey(new Date(r.startedAt)) === today) ?? null // rondes : plus récente d'abord
//   return {
//     date: today,
//     activeEmployees: active.length,
//     presentCount: presentCodes.size,
//     absent: active.filter((e) => !presentCodes.has(e.employeeCode) && !leaveCodes.has(e.employeeCode)).map((e) => ref(e.employeeCode)),
//     onLeave: onLeave.filter((l) => !presentCodes.has(l.employeeCode)).map((l) => ({ ...ref(l.employeeCode), type: l.type })),
//     totalMinutes: todays.reduce((s, a) => s + a.workedMinutes, 0),
//     dailyPay: todays.reduce((s, a) => s + a.dailySalary, 0),
//     cashDue: active.reduce((s, e) => s + balanceOf(db, e.employeeCode).due, 0),
//     topWorked: [...minutesBy.entries()].filter(([, min]) => min > 0).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([code, minutes]) => ({ ...ref(code), minutes })),
//     currentlyIn: todays.filter((a) => a.status === "EN_COURS").map((a) => ({
//       ...ref(a.employeeCode), attendanceId: a.id, entryTime: a.entryTime, departmentName: a.departmentName,
//       siteName: db.sites.find((s) => s.id === a.siteId)?.name ?? null,
//     })),
//     late,
//     pendingLeaves: db.leaves.filter((l) => l.status === "EN_ATTENTE").length,
//     pendingLoans: db.loans.filter((l) => l.status === "DEMANDE" || l.status === "RETOUR_DEMANDE").length,
//     activeSites: db.sites.filter((s) => s.status === "EN_COURS").length,
//     presence: {
//       lastRound,
//       anomalies: db.checks.filter((c) => (c.status === "HORS_ZONE" || c.status === "SANS_REPONSE") && c.checkedAt && dateKey(new Date(c.checkedAt)) === today)
//         .sort((a, b) => (b.checkedAt ?? "").localeCompare(a.checkedAt ?? "")),
//     },
//   }
// })

// // ---------- Contrôles de présence ----------

// /** Délais raccourcis en mode démo pour voir le résultat tout de suite. */
// const GRACE_MS = 20_000
// const FRESHNESS_MS = 15 * 60_000

// export function startRound(db: MockDb, trigger: "AUTO" | "MANUEL", by: MockUser | null): PresenceRound {
//   const open = db.attendance.filter((a) => a.status === "EN_COURS")
//   const round: PresenceRound = { id: uid(), startedAt: nowIso(), evaluatedAt: null, trigger, total: open.length, present: 0, outOfZone: 0, noResponse: 0 }
//   db.rounds.unshift(round)
//   for (const a of open) {
//     db.checks.push({
//       id: uid(), roundId: round.id, attendanceId: a.id, employeeCode: a.employeeCode, employeeName: nameOf(db, a.employeeCode),
//       departmentName: a.departmentName, siteId: a.siteId ?? null, siteName: db.sites.find((s) => s.id === a.siteId)?.name ?? null,
//       status: "EN_ATTENTE", location: null, locationAt: null, distance: null,
//       radiusMeters: db.workplaces.find((w) => w.id === a.workplaceId)?.radiusMeters ?? null, checkedAt: null,
//     })
//   }
//   audit(db, by, "PRESENCE_CHECK_TRIGGERED", `Contrôle de présence ${trigger === "AUTO" ? "automatique" : "lancé manuellement"} (${open.length} salarié${open.length > 1 ? "s" : ""})`, round.id)
//   // Demande de position aux téléphones des salariés en poste.
//   const targets = open.map((a) => userOfEmployee(db, a.employeeCode)?.id).filter((id): id is string => !!id)
//   if (targets.length) publish({ type: "presence.request", roundId: round.id }, targets)
//   publish({ type: "presence.updated" }, adminIds(db))
//   return round
// }

// function evaluateRound(db: MockDb, round: PresenceRound) {
//   const started = Date.parse(round.startedAt)
//   for (const c of db.checks.filter((x) => x.roundId === round.id)) {
//     const a = db.attendance.find((x) => x.id === c.attendanceId)
//     const w = a?.workplaceId ? db.workplaces.find((x) => x.id === a.workplaceId) : undefined
//     const fresh = a?.lastLocation && a.lastLocationAt && Date.parse(a.lastLocationAt) >= started - FRESHNESS_MS
//     c.checkedAt = nowIso()
//     if (!a || !fresh || !a.lastLocation) { c.status = "SANS_REPONSE"; continue }
//     c.location = { latitude: a.lastLocation.latitude, longitude: a.lastLocation.longitude, accuracy: a.lastLocation.accuracy }
//     c.locationAt = a.lastLocationAt ?? null
//     if (!w) { c.status = "PRESENT"; continue }
//     const d = Math.round(distanceInMeters(a.lastLocation.latitude, a.lastLocation.longitude, w.latitude, w.longitude))
//     c.distance = d
//     c.radiusMeters = w.radiusMeters
//     c.status = d <= w.radiusMeters ? "PRESENT" : "HORS_ZONE"
//   }
//   const checks = db.checks.filter((x) => x.roundId === round.id)
//   Object.assign(round, {
//     evaluatedAt: nowIso(),
//     present: checks.filter((c) => c.status === "PRESENT").length,
//     outOfZone: checks.filter((c) => c.status === "HORS_ZONE").length,
//     noResponse: checks.filter((c) => c.status === "SANS_REPONSE").length,
//   })
//   publish({ type: "presence.updated" }, adminIds(db))
// }

// /**
//  * « Horloge » du faux serveur, appelée à chaque requête : évalue les rondes dont le délai de
//  * réponse est écoulé et lance la ronde automatique quand l'intervalle est atteint.
//  * Retourne true si des données ont changé.
//  */
// export function presenceTick(db: MockDb): boolean {
//   let changed = false
//   for (const r of db.rounds) {
//     if (!r.evaluatedAt && Date.now() - Date.parse(r.startedAt) >= GRACE_MS) { evaluateRound(db, r); changed = true }
//   }
//   if (db.settings.presenceCheckEnabled && db.attendance.some((a) => a.status === "EN_COURS")) {
//     const lastAuto = db.rounds.find((r) => r.trigger === "AUTO")
//     const due = !lastAuto || Date.now() - Date.parse(lastAuto.startedAt) >= db.settings.presenceCheckIntervalMinutes * 60_000
//     if (due) { startRound(db, "AUTO", null); changed = true }
//   }
//   return changed
// }

// route("GET", "/presence/rounds", "admin", ({ db, query }) => {
//   const from = query.get("from"), to = query.get("to"), limit = Number(query.get("limit") ?? 100)
//   return db.rounds.filter((r) => {
//     const day = dateKey(new Date(r.startedAt))
//     return (!from || day >= from) && (!to || day <= to)
//   }).slice(0, limit)
// })

// route("GET", "/presence/checks", "admin", ({ db, query }) => {
//   const roundId = query.get("roundId"), date = query.get("date"), code = query.get("employeeCode")
//   const siteId = query.get("siteId"), status = query.get("status")
//   const roundDay = new Map(db.rounds.map((r) => [r.id, dateKey(new Date(r.startedAt))]))
//   return db.checks
//     .filter((c) => (!roundId || c.roundId === roundId) && (!date || roundDay.get(c.roundId) === date) &&
//       (!code || c.employeeCode === code) && (!siteId || c.siteId === siteId) && (!status || c.status === status))
//     .sort((a, b) => (b.checkedAt ?? "9").localeCompare(a.checkedAt ?? "9"))
// })

// route("POST", "/presence/rounds", "admin", ({ db, user }) => {
//   if (!db.attendance.some((a) => a.status === "EN_COURS")) fail(409, "NO_OPEN_SESSION", "Aucun salarié n'est en poste : rien à contrôler.")
//   return startRound(db, "MANUEL", user)
// })

