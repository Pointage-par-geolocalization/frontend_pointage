// src/mocks/seed.ts
//
// MODE DÉMO UNIQUEMENT — données de démonstration, datées par rapport à aujourd'hui :
// 6 salariés (dont 1 désactivé), 3 lieux autour de Toamasina, 2 semaines de pointages avec la
// paie calculée, paiements, matériel et prêts, discussions, permissions, chantiers, clients,
// devis / factures et contrôles de présence.
import type { MockDb, MockUser, StoredAttendance, StoredChat, StoredDocument, StoredVersion } from "./store"
import type { Client } from "../services/clients"
import type { Employee } from "../services/employees"
import type { Workplace } from "../services/workplaces"
import type { SalaryRecord } from "../services/salary"
import type { DocumentLine } from "../services/documents"
import { DEFAULT_APP_SETTINGS } from "../services/settings"
import { calculateDailySalary } from "../utils/salaryCalculator"
import { dateKey } from "../utils/date"
import { atDay, gpsCheckFor, iso, minutesAgo, near, seededRandom, uid } from "./util"


const NORMAL_MINUTES = 480

export function seedDatabase(version: number): MockDb {
  const rand = seededRandom(2026)
  const now = new Date()
  const year = now.getFullYear()

  // ---------- Lieux de travail ----------
  const siege: Workplace = { id: uid(), name: "Siège Toamasina", latitude: -18.1492, longitude: 49.4023, radiusMeters: 100, geofencingEnabled: true }
  const bazarBe: Workplace = { id: uid(), name: "Chantier Bazar Be", latitude: -18.1581, longitude: 49.4109, radiusMeters: 150, geofencingEnabled: true }
  // Géofencing désactivé : permet de tester un pointage réussi depuis n'importe où.
  const tanambao: Workplace = { id: uid(), name: "Entrepôt Tanambao (sans contrôle GPS)", latitude: -18.1385, longitude: 49.3962, radiusMeters: 100, geofencingEnabled: false }
  const workplaces = [siege, bazarBe, tanambao]

  // ---------- Salariés et comptes ----------
  const emp = (code: string, firstName: string, lastName: string, position: string, salary: number, departmentIds: string[], extra: Partial<Employee> = {}): Employee => ({
    employeeCode: code, firstName, lastName, position, baseDailySalary: salary, contractType: "JOURNALIER", monthlySalary: null, departmentIds, active: true,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@fortico.mg`, phone: `+261 34 ${code.slice(-3)} 12 34`,
    address: "Toamasina", hireDate: dateKey(atDay(-400 + Number(code.slice(-3)) * 37, 8)), createdAt: iso(atDay(-400, 8)),
    ...extra,
  })
  const employees: Employee[] = [
    emp("EMP-001", "Jean", "Rakoto", "Maçon", 20000, [bazarBe.id, tanambao.id]),
    emp("EMP-002", "Hery", "Rabe", "Électricien", 25000, [bazarBe.id, siege.id]),
    emp("EMP-003", "Fara", "Randria", "Chef d'équipe", 30000, [bazarBe.id, siege.id]),
    emp("EMP-004", "Lalao", "Rasoa", "Secrétaire", 18000, [siege.id]),
    emp("EMP-005", "Tiana", "Andry", "Manœuvre", 15000, [bazarBe.id, tanambao.id]),
    emp("EMP-006", "Mamy", "Ravelo", "Gardien", 15000, [siege.id], { active: false }),
  ]
  const fullName = (e: Employee) => `${e.firstName} ${e.lastName}`
  const byCode = new Map(employees.map((e) => [e.employeeCode, e]))

  const admin: MockUser = { id: uid(), role: "admin", email: "admin@fortico.mg", password: "admin123", name: "Administrateur" }
  const users: MockUser[] = [
    admin,
    ...employees.map((e): MockUser => ({ id: uid(), role: "employee", email: null, employeeCode: e.employeeCode, password: "123456", name: fullName(e) })),
  ]
  const userOf = (code: string) => users.find((u) => u.employeeCode === code)!

  // ---------- Clients et chantiers ----------
  const c1: Client = { id: uid(), name: "SIEST Immobilier", contactName: "M. Rakotomalala", phone: "+261 32 11 222 33", email: "contact@siest-immo.mg", address: "Boulevard Joffre, Toamasina", nif: "4000123456", stat: "70100 31 2015 0 01234", notes: "Client principal — paiement par virement." }
  const c2: Client = { id: uid(), name: "Vatomandry Trading", contactName: "Mme Rasoanaivo", phone: "+261 33 44 555 66", email: "achats@vatomandry-trading.mg", address: "Zone portuaire, Toamasina", nif: "4000654321", stat: null, notes: null }
  const c3: Client = { id: uid(), name: "Cabinet Ravo & Associés", contactName: "Me Ravo", phone: "+261 34 77 888 99", email: null, address: "Rue de la Batterie, Toamasina", nif: null, stat: null, notes: null }
  const clients = [c1, c2, c3]

  const s1 = { id: uid(), name: "Immeuble R+3 Bazar Be", clientId: c1.id, workplaceId: bazarBe.id, address: "Rue du Bazar Be, Toamasina", description: "Construction d'un immeuble de bureaux R+3 (gros œuvre et second œuvre).", startDate: dateKey(atDay(-60, 8)), endDate: dateKey(atDay(120, 8)), status: "EN_COURS" as const, manualProgress: 0, createdAt: iso(atDay(-75, 9)) }
  const s2 = { id: uid(), name: "Rénovation entrepôt Tanambao", clientId: c2.id, workplaceId: tanambao.id, address: "Tanambao V, Toamasina", description: "Réfection de la toiture et du dallage.", startDate: dateKey(atDay(7, 8)), endDate: dateKey(atDay(40, 8)), status: "PREPARATION" as const, manualProgress: 5, createdAt: iso(atDay(-10, 9)) }
  const s3 = { id: uid(), name: "Aménagement bureaux du siège", clientId: c3.id, workplaceId: siege.id, address: "Siège Toamasina", description: "Cloisons, électricité et peinture.", startDate: dateKey(atDay(-120, 8)), endDate: dateKey(atDay(-70, 8)), status: "TERMINE" as const, manualProgress: 100, createdAt: iso(atDay(-130, 9)) }
  const sites = [s1, s2, s3]
  const siteMembers = [
    ...["EMP-001", "EMP-002", "EMP-003", "EMP-005"].map((c) => ({ siteId: s1.id, employeeCode: c })),
    ...["EMP-001", "EMP-005"].map((c) => ({ siteId: s2.id, employeeCode: c })),
    ...["EMP-002", "EMP-004"].map((c) => ({ siteId: s3.id, employeeCode: c })),
  ]
  const step = (siteId: string, position: number, title: string, done: boolean, dueOffset: number | null, doneOffset?: number) => ({
    id: uid(), siteId, title, description: null, position, done,
    dueDate: dueOffset === null ? null : dateKey(atDay(dueOffset, 8)),
    doneAt: done ? iso(atDay(doneOffset ?? -1, 17)) : null,
  })
  const siteSteps = [
    step(s1.id, 0, "Terrassement et implantation", true, -50, -52),
    step(s1.id, 1, "Fondations et longrines", true, -35, -33),
    step(s1.id, 2, "Élévation rez-de-chaussée", true, -15, -12),
    step(s1.id, 3, "Plancher haut RDC (R+1)", false, 6),
    step(s1.id, 4, "Élévation étages R+1 à R+3", false, 45),
    step(s1.id, 5, "Toiture et étanchéité", false, 80),
    step(s1.id, 6, "Finitions et réception", false, 118),
    step(s2.id, 0, "Dépose de l'ancienne toiture", false, 12),
    step(s2.id, 1, "Coulage du nouveau dallage", false, 30),
    step(s3.id, 0, "Cloisons", true, -110, -108),
    step(s3.id, 1, "Électricité", true, -90, -88),
    step(s3.id, 2, "Peinture et nettoyage", true, -72, -71),
  ]
  const siteNotes = [
    { id: uid(), siteId: s1.id, authorName: "Administrateur", text: "Livraison de 12 tonnes de ciment reçue, stockée au rez-de-chaussée.", createdAt: iso(atDay(-3, 10, 15)) },
    { id: uid(), siteId: s1.id, authorName: "Administrateur", text: "Forte pluie ce matin : coulage du plancher reporté à la semaine prochaine.", createdAt: iso(atDay(-1, 9, 40)) },
    { id: uid(), siteId: s3.id, authorName: "Administrateur", text: "Réception des travaux signée par le client.", createdAt: iso(atDay(-70, 16)) },
  ]
  const siteForWorkplace = (workplaceId: string, day: string) =>
    sites.find((s) => s.workplaceId === workplaceId && s.status !== "TERMINE" && (!s.startDate || s.startDate <= day) && (!s.endDate || s.endDate >= day)) ?? null

  // ---------- Pointages (2 semaines) + rémunération ----------
  const attendance: StoredAttendance[] = []
  const location = (w: Workplace, meters: number, bearing: number) => ({ ...near(w, meters, bearing), altitude: null, accuracy: 12 + Math.round(rand() * 20) })
  function session(e: Employee, w: Workplace, entry: Date, exit: Date | null, opts: { adminEntry?: boolean; adminExit?: boolean } = {}): StoredAttendance {
    const day = dateKey(entry)
    const site = siteForWorkplace(w.id, day)
    const entryLoc = opts.adminEntry ? null : location(w, 10 + rand() * 60, rand() * 360)
    const exitLoc = !exit || opts.adminExit ? null : location(w, 10 + rand() * 60, rand() * 360)
    return {
      id: uid(), employeeCode: e.employeeCode, workDate: day, workplaceId: w.id, departmentName: w.name,
      siteId: site?.id ?? null, siteName: site?.name ?? null,
      entryTime: iso(entry), exitTime: exit ? iso(exit) : null, workedMinutes: 0, dailySalary: 0,
      entryLocation: entryLoc, exitLocation: exitLoc,
      entryGpsCheck: entryLoc ? gpsCheckFor(entryLoc, w) : null, exitGpsCheck: exitLoc ? gpsCheckFor(exitLoc, w) : null,
      status: exit ? "TERMINEE" : "EN_COURS", entrySource: opts.adminEntry ? "ADMIN" : "EMPLOYEE",
      exitSource: exit ? (opts.adminExit ? "ADMIN" : "EMPLOYEE") : null,
      lastLocation: exitLoc ?? entryLoc, lastLocationAt: iso(exit ?? entry),
    }
  }
  const wpOf = (e: Employee) => workplaces.find((w) => w.id === e.departmentIds[0])!

  for (let back = 13; back >= 1; back--) {
    const day = atDay(-back, 0)
    if (day.getDay() === 0) continue // dimanche
    for (const e of employees) {
      if (e.employeeCode === "EMP-006" && back < 8) continue // désactivé depuis une semaine
      if (rand() < 0.1) continue // absent ce jour-là
      const w = wpOf(e)
      const start = atDay(-back, 7, 40 + Math.round(rand() * 45))
      if (rand() < 0.3) {
        // Pause déjeuner : deux sessions dans la journée
        attendance.push(session(e, w, start, atDay(-back, 12, Math.round(rand() * 10))))
        attendance.push(session(e, w, atDay(-back, 13, Math.round(rand() * 15)), atDay(-back, 16, 30 + Math.round(rand() * 40))))
      } else {
        const admin = e.employeeCode === "EMP-005" && back === 4 // pointage fait à distance par l'admin
        attendance.push(session(e, w, start, atDay(-back, 16, Math.round(rand() * 75)), { adminEntry: admin, adminExit: admin }))
      }
    }
  }
  // Aujourd'hui (relatif à l'heure actuelle) : EMP-001 n'a pas encore pointé (compte de test),
  // EMP-002 et EMP-003 sont en poste, EMP-005 a fini sa matinée, EMP-004 est en permission.
  const e2 = byCode.get("EMP-002")!, e3 = byCode.get("EMP-003")!, e5 = byCode.get("EMP-005")!
  const open2 = session(e2, bazarBe, minutesAgo(180, now), null)
  open2.lastLocation = { ...near(bazarBe, 35, 120), altitude: null, accuracy: 15 }
  open2.lastLocationAt = iso(minutesAgo(41, now))
  const open3 = session(e3, bazarBe, minutesAgo(125, now), null)
  open3.lastLocation = { ...near(bazarBe, 420, 300), altitude: null, accuracy: 18 }
  open3.lastLocationAt = iso(minutesAgo(42, now))
  attendance.push(open2, open3, session(e5, bazarBe, minutesAgo(330, now), minutesAgo(90, now)))

  // Salaire de chaque session : plafond journalier appliqué au total du jour, cumul par salarié.
  attendance.sort((a, b) => a.entryTime.localeCompare(b.entryTime))
  const salaryRecords: SalaryRecord[] = []
  const minutesByDay = new Map<string, number>()
  const cumul = new Map<string, number>()
  for (const a of attendance) {
    if (!a.exitTime) continue
    const e = byCode.get(a.employeeCode)!
    const worked = Math.max(0, Math.round((Date.parse(a.exitTime) - Date.parse(a.entryTime)) / 60000))
    const key = `${a.employeeCode}|${a.workDate}`
    const before = minutesByDay.get(key) ?? 0
    const settings = { dailySalary: e.baseDailySalary, normalWorkMinutes: NORMAL_MINUTES }
    const pay = Math.max(0, calculateDailySalary(before + worked, settings) - calculateDailySalary(before, settings))
    minutesByDay.set(key, before + worked)
    a.workedMinutes = worked
    a.dailySalary = pay
    const total = (cumul.get(a.employeeCode) ?? 0) + pay
    cumul.set(a.employeeCode, total)
    salaryRecords.push({ id: uid(), employeeCode: a.employeeCode, attendanceId: a.id, workDate: a.workDate, workedMinutes: worked, dailySalary: pay, cumulativeSalary: total, createdAt: a.exitTime })
  }

  // ---------- Paiements ----------
  const pay = (code: string, amount: number, note: string, back: number) =>
    ({ id: uid(), employeeCode: code, amount, note, date: dateKey(atDay(-back, 17)), createdAt: iso(atDay(-back, 17, 30)) })
  const payments = [
    pay("EMP-001", 50000, "Avance", 6),
    pay("EMP-002", 60000, "Paie de la semaine", 6),
    pay("EMP-003", 100000, "Paie de la semaine", 6),
    pay("EMP-004", 40000, "", 5),
    pay("EMP-005", 30000, "Acompte", 3),
    pay("EMP-006", 20000, "Solde de tout compte (partiel)", 7),
  ].map((p) => ({ ...p, amount: Math.min(p.amount, cumul.get(p.employeeCode) ?? 0) })).filter((p) => p.amount > 0)

  // ---------- Matériel et prêts ----------
  const eq = (name: string, category: string, serialNumber: string | null, description: string | null, status: "DISPONIBLE" | "EMPRUNTE" | "HORS_SERVICE" = "DISPONIBLE") =>
    ({ id: uid(), name, category, serialNumber, description, status })
  const perceuse = eq("Perceuse Bosch GSB 18V", "Outillage", "BSH-4471", "Avec 2 batteries et coffret.", "EMPRUNTE")
  const betonniere = eq("Bétonnière 350 L", "Engins", "BTN-350-02", null)
  const echafaudage = eq("Échafaudage roulant 6 m", "Sécurité", null, "Plateforme + garde-corps.", "EMPRUNTE")
  const laser = eq("Niveau laser rotatif", "Mesure", "LSR-2201", null)
  const groupe = eq("Groupe électrogène 5 kVA", "Énergie", "GE-5K-01", "En panne : démarreur à remplacer.", "HORS_SERVICE")
  const disqueuse = eq("Disqueuse 230 mm", "Outillage", "DSQ-230", null)
  const equipment = [perceuse, betonniere, echafaudage, laser, groupe, disqueuse]
  const loan = (e: { id: string; name: string }, code: string, status: "DEMANDE" | "REFUSEE" | "EN_COURS" | "RETOUR_DEMANDE" | "RETOURNE", back: number, extra: object = {}) => ({
    id: uid(), equipmentId: e.id, equipmentName: e.name, employeeCode: code, employeeName: fullName(byCode.get(code)!), status,
    requestNote: null, expectedReturnDate: null, requestedAt: iso(atDay(-back, 8, 10)), decidedAt: null, refusalReason: null,
    loanedAt: null, returnRequestedAt: null, returnNote: null, returnedAt: null, ...extra,
  })
  const loans = [
    loan(perceuse, "EMP-001", "EN_COURS", 5, { requestNote: "Pour les fixations du coffrage.", expectedReturnDate: dateKey(atDay(3, 8)), decidedAt: iso(atDay(-5, 9)), loanedAt: iso(atDay(-5, 9)) }),
    loan(betonniere, "EMP-005", "DEMANDE", 0, { requestNote: "Coulage du plancher R+1.", expectedReturnDate: dateKey(atDay(10, 8)), requestedAt: iso(minutesAgo(50, now)) }),
    loan(echafaudage, "EMP-002", "RETOUR_DEMANDE", 9, { decidedAt: iso(atDay(-9, 9)), loanedAt: iso(atDay(-9, 9)), returnRequestedAt: iso(minutesAgo(30, now)), returnNote: "Rendu complet, une roue grince." }),
    loan(laser, "EMP-003", "RETOURNE", 12, { decidedAt: iso(atDay(-12, 9)), loanedAt: iso(atDay(-12, 9)), returnedAt: iso(atDay(-8, 17)) }),
    loan(laser, "EMP-005", "REFUSEE", 7, { requestNote: "Pour le week-end.", decidedAt: iso(atDay(-7, 10)), refusalReason: "Matériel réservé au chef d'équipe." }),
  ]

  // ---------- Messagerie ----------
  const g1: StoredChat = { id: uid(), type: "group", name: "Annonces", announcement: true, memberIds: employees.filter((e) => e.active).map((e) => userOf(e.employeeCode).id), createdAt: iso(atDay(-30, 8)), directUserId: null, lastMessageText: null, lastMessageAt: null, lastMessageBy: null, lastMessageName: null }
  const g2: StoredChat = { ...g1, id: uid(), name: "Équipe Bazar Be", announcement: false, memberIds: ["EMP-001", "EMP-002", "EMP-003", "EMP-005"].map((c) => userOf(c).id), createdAt: iso(atDay(-20, 8)) }
  const dm: StoredChat = { ...g1, id: uid(), type: "direct", name: "", announcement: false, memberIds: [userOf("EMP-001").id], directUserId: userOf("EMP-001").id, createdAt: iso(atDay(-4, 8)) }
  const chats = [g1, g2, dm]
  const messages: MockDb["messages"] = []
  const msg = (chat: StoredChat, sender: MockUser, text: string, at: Date, extra: Partial<MockDb["messages"][number]> = {}) => {
    const m = { id: uid(), chatId: chat.id, senderId: sender.id, senderName: sender.name, senderRole: sender.role, text, createdAt: iso(at), replyTo: null, reactions: {}, ...extra }
    messages.push(m)
    Object.assign(chat, { lastMessageText: text.slice(0, 120), lastMessageAt: m.createdAt, lastMessageBy: sender.id, lastMessageName: sender.name })
    return m
  }
  msg(g1, admin, "Bienvenue sur la nouvelle application de pointage ! Pensez à pointer à chaque arrivée et départ.", atDay(-30, 8, 5))
  msg(g1, admin, "Rappel : la paie de la semaine est versée le samedi à 12 h au siège.", atDay(-6, 16, 0))
  const m1 = msg(g2, userOf("EMP-003"), "Demain on attaque le coffrage du plancher, tout le monde à 7 h 30 svp.", atDay(-1, 17, 10))
  msg(g2, userOf("EMP-002"), "Ok, je passe prendre les gaines au siège avant.", atDay(-1, 17, 22), { replyTo: { id: m1.id, senderName: m1.senderName, text: m1.text.slice(0, 140) }, reactions: { "👍": [userOf("EMP-003").id, userOf("EMP-005").id] } })
  msg(g2, userOf("EMP-005"), "Bien reçu 👍", atDay(-1, 18, 3))
  msg(g2, admin, "La bétonnière sera disponible jeudi.", minutesAgo(25, now))
  msg(dm, admin, "Bonjour Jean, peux-tu passer au bureau vendredi pour signer ton contrat ?", atDay(-4, 10, 0))
  msg(dm, userOf("EMP-001"), "Oui sans problème, vers 16 h.", atDay(-4, 10, 30), { reactions: { "🙏": [admin.id] } })
  msg(dm, admin, "Parfait, merci.", minutesAgo(15, now))
  const reads = [
    { chatId: g2.id, userId: userOf("EMP-003").id, name: userOf("EMP-003").name, role: "employee" as const, seenAt: iso(atDay(-1, 18, 5)) },
    { chatId: g2.id, userId: admin.id, name: admin.name, role: "admin" as const, seenAt: iso(minutesAgo(25, now)) },
    { chatId: dm.id, userId: admin.id, name: admin.name, role: "admin" as const, seenAt: iso(minutesAgo(15, now)) },
    { chatId: g1.id, userId: admin.id, name: admin.name, role: "admin" as const, seenAt: iso(atDay(-6, 16, 0)) },
  ]

  // ---------- Permissions ----------
  const leave = (code: string, type: "CONGE" | "MALADIE" | "FAMILLE" | "ADMINISTRATIF" | "AUTRE", startOffset: number, durationValue: number, durationUnit: "JOURS" | "HEURES", reason: string, status: "EN_ATTENTE" | "ACCEPTEE" | "REFUSEE", extra: object = {}) => {
    const days = durationUnit === "JOURS" ? Math.max(1, Math.ceil(durationValue)) : 1
    return {
      id: uid(), employeeCode: code, employeeName: fullName(byCode.get(code)!), type, durationValue, durationUnit, reason, status,
      startDate: dateKey(atDay(startOffset, 8)), endDate: dateKey(atDay(startOffset + days - 1, 8)), siteId: null, siteName: null,
      decidedAt: status === "EN_ATTENTE" ? null : iso(atDay(Math.min(startOffset, 0) - 1, 15)),
      decidedByName: status === "EN_ATTENTE" ? null : "Administrateur", decisionNote: null,
      employeeSeenAt: status === "EN_ATTENTE" ? null : iso(atDay(Math.min(startOffset, 0) - 1, 18)),
      createdAt: iso(atDay(Math.min(startOffset, 0) - 3, 9)), ...extra,
    }
  }
  const leaves = [
    leave("EMP-004", "CONGE", 0, 2, "JOURS", "Congé annuel.", "ACCEPTEE"),
    leave("EMP-001", "FAMILLE", 5, 1, "JOURS", "Mariage de ma sœur.", "EN_ATTENTE", { createdAt: iso(minutesAgo(90, now)) }),
    leave("EMP-003", "ADMINISTRATIF", 1, 2, "HEURES", "Renouvellement de la carte d'identité.", "EN_ATTENTE", { siteId: s1.id, siteName: s1.name, createdAt: iso(minutesAgo(200, now)) }),
    leave("EMP-002", "MALADIE", -9, 1, "JOURS", "Fièvre, certificat médical fourni.", "ACCEPTEE"),
    leave("EMP-001", "CONGE", -12, 0.5, "JOURS", "Rendez-vous à la banque.", "ACCEPTEE", { decisionNote: "Accordé, bon courage.", employeeSeenAt: null, decidedAt: iso(atDay(-1, 11)) }),
    leave("EMP-005", "AUTRE", -2, 1, "JOURS", "Déménagement.", "REFUSEE", { decisionNote: "Coulage prévu ce jour-là, merci de décaler.", employeeSeenAt: null }),
  ]

  // ---------- Contrôles de présence d'aujourd'hui ----------
  const r1Start = minutesAgo(105, now), r2Start = minutesAgo(40, now)
  const r1 = { id: uid(), startedAt: iso(r1Start), evaluatedAt: iso(minutesAgo(100, now)), trigger: "AUTO" as const, total: 3, present: 3, outOfZone: 0, noResponse: 0 }
  const r2 = { id: uid(), startedAt: iso(r2Start), evaluatedAt: iso(minutesAgo(35, now)), trigger: "AUTO" as const, total: 2, present: 1, outOfZone: 1, noResponse: 0 }
  const open5 = attendance.find((a) => a.employeeCode === "EMP-005" && a.workDate === dateKey(now) && a.exitTime) ?? null
  const check = (roundId: string, a: StoredAttendance | null, code: string, status: "PRESENT" | "HORS_ZONE" | "SANS_REPONSE", distance: number | null, at: Date) => {
    const e = byCode.get(code)!
    const loc = distance === null ? null : { ...near(bazarBe, distance, 200), accuracy: 15 }
    return {
      id: uid(), roundId, attendanceId: a?.id ?? null, employeeCode: code, employeeName: fullName(e), departmentName: bazarBe.name,
      siteId: s1.id, siteName: s1.name, status, location: loc, locationAt: loc ? iso(minutesAgo(3, at)) : null,
      distance, radiusMeters: bazarBe.radiusMeters, checkedAt: iso(minutesAgo(-5, at)),
    }
  }
  const checks = [
    check(r1.id, open2, "EMP-002", "PRESENT", 28, r1Start),
    check(r1.id, open3, "EMP-003", "PRESENT", 61, r1Start),
    check(r1.id, open5, "EMP-005", "PRESENT", 44, r1Start),
    check(r2.id, open2, "EMP-002", "PRESENT", 35, r2Start),
    check(r2.id, open3, "EMP-003", "HORS_ZONE", 420, r2Start),
  ]

  // ---------- Devis et factures ----------
  const lines = (items: [string, number, string, number][]): DocumentLine[] =>
    items.map(([description, quantity, unit, unitPrice]) => ({ description, quantity, unit, unitPrice, amount: Math.round(quantity * unitPrice) }))
  const snapshotOf = (c: Client) => ({ name: c.name, contactName: c.contactName, address: c.address, phone: c.phone, email: c.email, nif: c.nif, stat: c.stat })
  const documents: StoredDocument[] = []
  const versions: StoredVersion[] = []
  function doc(type: "DEVIS" | "FACTURE", n: number, client: Client, siteId: string | null, subject: string, items: [string, number, string, number][], status: string, issueOffset: number, extra: Partial<StoredDocument> = {}) {
    const docLines = lines(items)
    const subtotal = docLines.reduce((s, l) => s + l.amount, 0)
    const taxRate = 20
    const taxAmount = Math.round((subtotal * taxRate) / 100)
    const d: StoredDocument = {
      id: uid(), type, number: `${type === "DEVIS" ? "DEV" : "FAC"}-${year}-${String(n).padStart(4, "0")}`,
      issueDate: dateKey(atDay(issueOffset, 9)), dueDate: dateKey(atDay(issueOffset + 30, 9)), status: status as StoredDocument["status"],
      clientId: client.id, client: snapshotOf(client), siteId, subject, lines: docLines, subtotal, taxRate, taxAmount, total: subtotal + taxAmount,
      notes: type === "DEVIS" ? "Devis valable 30 jours. Acompte de 30 % à la commande." : "Paiement par virement à 30 jours.",
      paidAt: null, sourceDocumentId: null, version: 1, createdAt: iso(atDay(issueOffset, 9)), updatedAt: iso(atDay(issueOffset, 9)),
      ...extra,
    }
    documents.push(d)
    versions.push({ documentId: d.id, version: 1, snapshot: { ...d, version: 1 }, changeLabel: "Création", changedAt: d.createdAt, changedByLabel: "admin@fortico.mg" })
    return d
  }
  const gros = [
    ["Terrassement et implantation", 1, "forfait", 2500000],
    ["Béton armé fondations", 45, "m³", 450000],
    ["Maçonnerie agglos RDC", 180, "m²", 65000],
    ["Plancher dalle pleine R+1", 210, "m²", 120000],
  ] as [string, number, string, number][]
  const dev1 = doc("DEVIS", 1, c1, s1.id, "Gros œuvre immeuble R+3 — phase 1", gros, "ACCEPTE", -70)
  dev1.version = 2
  versions.push({ documentId: dev1.id, version: 2, snapshot: { ...dev1 }, changeLabel: "Statut : Accepté", changedAt: iso(atDay(-65, 11)), changedByLabel: "admin@fortico.mg" })
  doc("FACTURE", 1, c1, s1.id, "Situation n°1 — terrassement et fondations", gros.slice(0, 2), "PAYEE", -30,
    { sourceDocumentId: dev1.id, paidAt: dateKey(atDay(-12, 9)) })
  doc("FACTURE", 2, c1, s1.id, "Situation n°2 — maçonnerie RDC", [gros[2]], "EMISE", -5, { sourceDocumentId: dev1.id })
  doc("DEVIS", 2, c2, s2.id, "Réfection toiture et dallage entrepôt", [
    ["Dépose ancienne couverture", 600, "m²", 8000],
    ["Fourniture et pose tôles bac acier", 600, "m²", 52000],
    ["Dallage béton 12 cm", 400, "m²", 75000],
  ], "ENVOYE", -8)
  doc("DEVIS", 3, c3, null, "Extension électrique salle de réunion", [
    ["Câblage et goulottes", 1, "forfait", 850000],
    ["Prises RJ45 + électriques", 12, "u", 45000],
  ], "BROUILLON", -1)

  // ---------- Journal des actions ----------
  const log = (minutes: number, action: string, summary: string, targetId: string | null = null, userLabel = "admin@fortico.mg") =>
    ({ id: uid(), createdAt: iso(minutesAgo(minutes, now)), userLabel, action, targetId, summary })
  const audit = [
    log(60 * 24 * 7, "PAYMENT_CREATED", "40 000 Ar payés à Lalao Rasoa", "EMP-004"),
    log(60 * 24 * 6, "PAYMENT_CREATED", "100 000 Ar payés à Fara Randria — Paie de la semaine", "EMP-003"),
    log(60 * 24 * 6.5, "EMPLOYEE_DISABLED", "Mamy Ravelo désactivé", "EMP-006"),
    log(60 * 24 * 4, "ATTENDANCE_CREATED", "Pointage démarré à distance pour Tiana Andry (Chantier Bazar Be)", "EMP-005"),
    log(60 * 24 * 4 - 480, "ATTENDANCE_UPDATED", "Pointage arrêté à distance pour Tiana Andry", "EMP-005"),
    log(60 * 24 * 1, "LEAVE_APPROVED", "Permission acceptée pour Jean Rakoto (Congé)", "EMP-001"),
    log(60 * 24 * 2, "LEAVE_REFUSED", "Permission refusée pour Tiana Andry (Autre)", "EMP-005"),
    log(60 * 24 * 5, "DOCUMENT_CREATED", `Facture FAC-${year}-0002 créée`, null),
    log(105, "PRESENCE_CHECK_TRIGGERED", "Contrôle de présence automatique (3 salariés)"),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return {
    version,
    settings: {
      ...DEFAULT_APP_SETTINGS,
      companyName: "FORTICO",
      companyAddress: "Toamasina, Madagascar",
      companyPhone: "+261 34 00 000 00",
      companyEmail: "contact@fortico.mg",
      companyNif: "0000000000",
      companyStat: "00000 00 0000 0 00000",
      defaultTaxRate: 20,
      documentFooter: "Données de démonstration — coordonnées bancaires et mentions légales à compléter dans Paramètres.",
    },
    users,
    employees,
    workplaces,
    attendance,
    salaryRecords,
    payments,
    equipment,
    loans,
    chats,
    messages,
    reads,
    leaves,
    rounds: [r2, r1],
    checks,
    clients,
    sites,
    siteMembers,
    siteSteps,
    siteNotes,
    documents,
    documentVersions: versions,
    counters: { [`DEVIS-${year}`]: 3, [`FACTURE-${year}`]: 2 },
    audit,
  }
}


// // src/mocks/seed.ts
// //
// // MODE DÉMO UNIQUEMENT — données de démonstration, datées par rapport à aujourd'hui :
// // 6 salariés (dont 1 désactivé), 3 lieux autour de Toamasina, 2 semaines de pointages avec la
// // paie calculée, paiements, matériel et prêts, discussions, permissions, chantiers, clients,
// // devis / factures et contrôles de présence.
// import type { MockDb, MockUser, StoredAttendance, StoredChat, StoredDocument, StoredVersion } from "./store"
// import type { Client } from "../services/clients"
// import type { Employee } from "../services/employees"
// import type { Workplace } from "../services/workplaces"
// import type { SalaryRecord } from "../services/salary"
// import type { DocumentLine } from "../services/documents"
// import { DEFAULT_APP_SETTINGS } from "../services/settings"
// import { calculateDailySalary } from "../utils/salaryCalculator"
// import { dateKey } from "../utils/date"
// import { atDay, gpsCheckFor, iso, minutesAgo, near, seededRandom, uid } from "./util"


// const NORMAL_MINUTES = 480

// export function seedDatabase(version: number): MockDb {
//   const rand = seededRandom(2026)
//   const now = new Date()
//   const year = now.getFullYear()

//   // ---------- Lieux de travail ----------
//   const siege: Workplace = { id: uid(), name: "Siège Toamasina", latitude: -18.1492, longitude: 49.4023, radiusMeters: 100, geofencingEnabled: true }
//   const bazarBe: Workplace = { id: uid(), name: "Chantier Bazar Be", latitude: -18.1581, longitude: 49.4109, radiusMeters: 150, geofencingEnabled: true }
//   // Géofencing désactivé : permet de tester un pointage réussi depuis n'importe où.
//   const tanambao: Workplace = { id: uid(), name: "Entrepôt Tanambao (sans contrôle GPS)", latitude: -18.1385, longitude: 49.3962, radiusMeters: 100, geofencingEnabled: false }
//   const workplaces = [siege, bazarBe, tanambao]

//   // ---------- Salariés et comptes ----------
//   const emp = (code: string, firstName: string, lastName: string, position: string, salary: number, departmentIds: string[], extra: Partial<Employee> = {}): Employee => ({
//     employeeCode: code, firstName, lastName, position, baseDailySalary: salary, departmentIds, active: true,
//     email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@fortico.mg`, phone: `+261 34 ${code.slice(-3)} 12 34`,
//     address: "Toamasina", hireDate: dateKey(atDay(-400 + Number(code.slice(-3)) * 37, 8)), createdAt: iso(atDay(-400, 8)),
//     ...extra,
//   })
//   const employees: Employee[] = [
//     emp("EMP-001", "Jean", "Rakoto", "Maçon", 20000, [bazarBe.id, tanambao.id]),
//     emp("EMP-002", "Hery", "Rabe", "Électricien", 25000, [bazarBe.id, siege.id]),
//     emp("EMP-003", "Fara", "Randria", "Chef d'équipe", 30000, [bazarBe.id, siege.id]),
//     emp("EMP-004", "Lalao", "Rasoa", "Secrétaire", 18000, [siege.id]),
//     emp("EMP-005", "Tiana", "Andry", "Manœuvre", 15000, [bazarBe.id, tanambao.id]),
//     emp("EMP-006", "Mamy", "Ravelo", "Gardien", 15000, [siege.id], { active: false }),
//   ]
//   const fullName = (e: Employee) => `${e.firstName} ${e.lastName}`
//   const byCode = new Map(employees.map((e) => [e.employeeCode, e]))

//   const admin: MockUser = { id: uid(), role: "admin", email: "admin@fortico.mg", password: "admin123", name: "Administrateur" }
//   const users: MockUser[] = [
//     admin,
//     ...employees.map((e): MockUser => ({ id: uid(), role: "employee", email: null, employeeCode: e.employeeCode, password: "123456", name: fullName(e) })),
//   ]
//   const userOf = (code: string) => users.find((u) => u.employeeCode === code)!

//   // ---------- Clients et chantiers ----------
//   const c1: Client = { id: uid(), name: "SIEST Immobilier", contactName: "M. Rakotomalala", phone: "+261 32 11 222 33", email: "contact@siest-immo.mg", address: "Boulevard Joffre, Toamasina", nif: "4000123456", stat: "70100 31 2015 0 01234", notes: "Client principal — paiement par virement." }
//   const c2: Client = { id: uid(), name: "Vatomandry Trading", contactName: "Mme Rasoanaivo", phone: "+261 33 44 555 66", email: "achats@vatomandry-trading.mg", address: "Zone portuaire, Toamasina", nif: "4000654321", stat: null, notes: null }
//   const c3: Client = { id: uid(), name: "Cabinet Ravo & Associés", contactName: "Me Ravo", phone: "+261 34 77 888 99", email: null, address: "Rue de la Batterie, Toamasina", nif: null, stat: null, notes: null }
//   const clients = [c1, c2, c3]

//   const s1 = { id: uid(), name: "Immeuble R+3 Bazar Be", clientId: c1.id, workplaceId: bazarBe.id, address: "Rue du Bazar Be, Toamasina", description: "Construction d'un immeuble de bureaux R+3 (gros œuvre et second œuvre).", startDate: dateKey(atDay(-60, 8)), endDate: dateKey(atDay(120, 8)), status: "EN_COURS" as const, manualProgress: 0, createdAt: iso(atDay(-75, 9)) }
//   const s2 = { id: uid(), name: "Rénovation entrepôt Tanambao", clientId: c2.id, workplaceId: tanambao.id, address: "Tanambao V, Toamasina", description: "Réfection de la toiture et du dallage.", startDate: dateKey(atDay(7, 8)), endDate: dateKey(atDay(40, 8)), status: "PREPARATION" as const, manualProgress: 5, createdAt: iso(atDay(-10, 9)) }
//   const s3 = { id: uid(), name: "Aménagement bureaux du siège", clientId: c3.id, workplaceId: siege.id, address: "Siège Toamasina", description: "Cloisons, électricité et peinture.", startDate: dateKey(atDay(-120, 8)), endDate: dateKey(atDay(-70, 8)), status: "TERMINE" as const, manualProgress: 100, createdAt: iso(atDay(-130, 9)) }
//   const sites = [s1, s2, s3]
//   const siteMembers = [
//     ...["EMP-001", "EMP-002", "EMP-003", "EMP-005"].map((c) => ({ siteId: s1.id, employeeCode: c })),
//     ...["EMP-001", "EMP-005"].map((c) => ({ siteId: s2.id, employeeCode: c })),
//     ...["EMP-002", "EMP-004"].map((c) => ({ siteId: s3.id, employeeCode: c })),
//   ]
//   const step = (siteId: string, position: number, title: string, done: boolean, dueOffset: number | null, doneOffset?: number) => ({
//     id: uid(), siteId, title, description: null, position, done,
//     dueDate: dueOffset === null ? null : dateKey(atDay(dueOffset, 8)),
//     doneAt: done ? iso(atDay(doneOffset ?? -1, 17)) : null,
//   })
//   const siteSteps = [
//     step(s1.id, 0, "Terrassement et implantation", true, -50, -52),
//     step(s1.id, 1, "Fondations et longrines", true, -35, -33),
//     step(s1.id, 2, "Élévation rez-de-chaussée", true, -15, -12),
//     step(s1.id, 3, "Plancher haut RDC (R+1)", false, 6),
//     step(s1.id, 4, "Élévation étages R+1 à R+3", false, 45),
//     step(s1.id, 5, "Toiture et étanchéité", false, 80),
//     step(s1.id, 6, "Finitions et réception", false, 118),
//     step(s2.id, 0, "Dépose de l'ancienne toiture", false, 12),
//     step(s2.id, 1, "Coulage du nouveau dallage", false, 30),
//     step(s3.id, 0, "Cloisons", true, -110, -108),
//     step(s3.id, 1, "Électricité", true, -90, -88),
//     step(s3.id, 2, "Peinture et nettoyage", true, -72, -71),
//   ]
//   const siteNotes = [
//     { id: uid(), siteId: s1.id, authorName: "Administrateur", text: "Livraison de 12 tonnes de ciment reçue, stockée au rez-de-chaussée.", createdAt: iso(atDay(-3, 10, 15)) },
//     { id: uid(), siteId: s1.id, authorName: "Administrateur", text: "Forte pluie ce matin : coulage du plancher reporté à la semaine prochaine.", createdAt: iso(atDay(-1, 9, 40)) },
//     { id: uid(), siteId: s3.id, authorName: "Administrateur", text: "Réception des travaux signée par le client.", createdAt: iso(atDay(-70, 16)) },
//   ]
//   const siteForWorkplace = (workplaceId: string, day: string) =>
//     sites.find((s) => s.workplaceId === workplaceId && s.status !== "TERMINE" && (!s.startDate || s.startDate <= day) && (!s.endDate || s.endDate >= day)) ?? null

//   // ---------- Pointages (2 semaines) + rémunération ----------
//   const attendance: StoredAttendance[] = []
//   const location = (w: Workplace, meters: number, bearing: number) => ({ ...near(w, meters, bearing), altitude: null, accuracy: 12 + Math.round(rand() * 20) })
//   function session(e: Employee, w: Workplace, entry: Date, exit: Date | null, opts: { adminEntry?: boolean; adminExit?: boolean } = {}): StoredAttendance {
//     const day = dateKey(entry)
//     const site = siteForWorkplace(w.id, day)
//     const entryLoc = opts.adminEntry ? null : location(w, 10 + rand() * 60, rand() * 360)
//     const exitLoc = !exit || opts.adminExit ? null : location(w, 10 + rand() * 60, rand() * 360)
//     return {
//       id: uid(), employeeCode: e.employeeCode, workDate: day, workplaceId: w.id, departmentName: w.name,
//       siteId: site?.id ?? null, siteName: site?.name ?? null,
//       entryTime: iso(entry), exitTime: exit ? iso(exit) : null, workedMinutes: 0, dailySalary: 0,
//       entryLocation: entryLoc, exitLocation: exitLoc,
//       entryGpsCheck: entryLoc ? gpsCheckFor(entryLoc, w) : null, exitGpsCheck: exitLoc ? gpsCheckFor(exitLoc, w) : null,
//       status: exit ? "TERMINEE" : "EN_COURS", entrySource: opts.adminEntry ? "ADMIN" : "EMPLOYEE",
//       exitSource: exit ? (opts.adminExit ? "ADMIN" : "EMPLOYEE") : null,
//       lastLocation: exitLoc ?? entryLoc, lastLocationAt: iso(exit ?? entry),
//     }
//   }
//   const wpOf = (e: Employee) => workplaces.find((w) => w.id === e.departmentIds[0])!

//   for (let back = 13; back >= 1; back--) {
//     const day = atDay(-back, 0)
//     if (day.getDay() === 0) continue // dimanche
//     for (const e of employees) {
//       if (e.employeeCode === "EMP-006" && back < 8) continue // désactivé depuis une semaine
//       if (rand() < 0.1) continue // absent ce jour-là
//       const w = wpOf(e)
//       const start = atDay(-back, 7, 40 + Math.round(rand() * 45))
//       if (rand() < 0.3) {
//         // Pause déjeuner : deux sessions dans la journée
//         attendance.push(session(e, w, start, atDay(-back, 12, Math.round(rand() * 10))))
//         attendance.push(session(e, w, atDay(-back, 13, Math.round(rand() * 15)), atDay(-back, 16, 30 + Math.round(rand() * 40))))
//       } else {
//         const admin = e.employeeCode === "EMP-005" && back === 4 // pointage fait à distance par l'admin
//         attendance.push(session(e, w, start, atDay(-back, 16, Math.round(rand() * 75)), { adminEntry: admin, adminExit: admin }))
//       }
//     }
//   }
//   // Aujourd'hui (relatif à l'heure actuelle) : EMP-001 n'a pas encore pointé (compte de test),
//   // EMP-002 et EMP-003 sont en poste, EMP-005 a fini sa matinée, EMP-004 est en permission.
//   const e2 = byCode.get("EMP-002")!, e3 = byCode.get("EMP-003")!, e5 = byCode.get("EMP-005")!
//   const open2 = session(e2, bazarBe, minutesAgo(180, now), null)
//   open2.lastLocation = { ...near(bazarBe, 35, 120), altitude: null, accuracy: 15 }
//   open2.lastLocationAt = iso(minutesAgo(41, now))
//   const open3 = session(e3, bazarBe, minutesAgo(125, now), null)
//   open3.lastLocation = { ...near(bazarBe, 420, 300), altitude: null, accuracy: 18 }
//   open3.lastLocationAt = iso(minutesAgo(42, now))
//   attendance.push(open2, open3, session(e5, bazarBe, minutesAgo(330, now), minutesAgo(90, now)))

//   // Salaire de chaque session : plafond journalier appliqué au total du jour, cumul par salarié.
//   attendance.sort((a, b) => a.entryTime.localeCompare(b.entryTime))
//   const salaryRecords: SalaryRecord[] = []
//   const minutesByDay = new Map<string, number>()
//   const cumul = new Map<string, number>()
//   for (const a of attendance) {
//     if (!a.exitTime) continue
//     const e = byCode.get(a.employeeCode)!
//     const worked = Math.max(0, Math.round((Date.parse(a.exitTime) - Date.parse(a.entryTime)) / 60000))
//     const key = `${a.employeeCode}|${a.workDate}`
//     const before = minutesByDay.get(key) ?? 0
//     const settings = { dailySalary: e.baseDailySalary, normalWorkMinutes: NORMAL_MINUTES }
//     const pay = Math.max(0, calculateDailySalary(before + worked, settings) - calculateDailySalary(before, settings))
//     minutesByDay.set(key, before + worked)
//     a.workedMinutes = worked
//     a.dailySalary = pay
//     const total = (cumul.get(a.employeeCode) ?? 0) + pay
//     cumul.set(a.employeeCode, total)
//     salaryRecords.push({ id: uid(), employeeCode: a.employeeCode, attendanceId: a.id, workDate: a.workDate, workedMinutes: worked, dailySalary: pay, cumulativeSalary: total, createdAt: a.exitTime })
//   }

//   // ---------- Paiements ----------
//   const pay = (code: string, amount: number, note: string, back: number) =>
//     ({ id: uid(), employeeCode: code, amount, note, date: dateKey(atDay(-back, 17)), createdAt: iso(atDay(-back, 17, 30)) })
//   const payments = [
//     pay("EMP-001", 50000, "Avance", 6),
//     pay("EMP-002", 60000, "Paie de la semaine", 6),
//     pay("EMP-003", 100000, "Paie de la semaine", 6),
//     pay("EMP-004", 40000, "", 5),
//     pay("EMP-005", 30000, "Acompte", 3),
//     pay("EMP-006", 20000, "Solde de tout compte (partiel)", 7),
//   ].map((p) => ({ ...p, amount: Math.min(p.amount, cumul.get(p.employeeCode) ?? 0) })).filter((p) => p.amount > 0)

//   // ---------- Matériel et prêts ----------
//   const eq = (name: string, category: string, serialNumber: string | null, description: string | null, status: "DISPONIBLE" | "EMPRUNTE" | "HORS_SERVICE" = "DISPONIBLE") =>
//     ({ id: uid(), name, category, serialNumber, description, status })
//   const perceuse = eq("Perceuse Bosch GSB 18V", "Outillage", "BSH-4471", "Avec 2 batteries et coffret.", "EMPRUNTE")
//   const betonniere = eq("Bétonnière 350 L", "Engins", "BTN-350-02", null)
//   const echafaudage = eq("Échafaudage roulant 6 m", "Sécurité", null, "Plateforme + garde-corps.", "EMPRUNTE")
//   const laser = eq("Niveau laser rotatif", "Mesure", "LSR-2201", null)
//   const groupe = eq("Groupe électrogène 5 kVA", "Énergie", "GE-5K-01", "En panne : démarreur à remplacer.", "HORS_SERVICE")
//   const disqueuse = eq("Disqueuse 230 mm", "Outillage", "DSQ-230", null)
//   const equipment = [perceuse, betonniere, echafaudage, laser, groupe, disqueuse]
//   const loan = (e: { id: string; name: string }, code: string, status: "DEMANDE" | "REFUSEE" | "EN_COURS" | "RETOUR_DEMANDE" | "RETOURNE", back: number, extra: object = {}) => ({
//     id: uid(), equipmentId: e.id, equipmentName: e.name, employeeCode: code, employeeName: fullName(byCode.get(code)!), status,
//     requestNote: null, expectedReturnDate: null, requestedAt: iso(atDay(-back, 8, 10)), decidedAt: null, refusalReason: null,
//     loanedAt: null, returnRequestedAt: null, returnNote: null, returnedAt: null, ...extra,
//   })
//   const loans = [
//     loan(perceuse, "EMP-001", "EN_COURS", 5, { requestNote: "Pour les fixations du coffrage.", expectedReturnDate: dateKey(atDay(3, 8)), decidedAt: iso(atDay(-5, 9)), loanedAt: iso(atDay(-5, 9)) }),
//     loan(betonniere, "EMP-005", "DEMANDE", 0, { requestNote: "Coulage du plancher R+1.", expectedReturnDate: dateKey(atDay(10, 8)), requestedAt: iso(minutesAgo(50, now)) }),
//     loan(echafaudage, "EMP-002", "RETOUR_DEMANDE", 9, { decidedAt: iso(atDay(-9, 9)), loanedAt: iso(atDay(-9, 9)), returnRequestedAt: iso(minutesAgo(30, now)), returnNote: "Rendu complet, une roue grince." }),
//     loan(laser, "EMP-003", "RETOURNE", 12, { decidedAt: iso(atDay(-12, 9)), loanedAt: iso(atDay(-12, 9)), returnedAt: iso(atDay(-8, 17)) }),
//     loan(laser, "EMP-005", "REFUSEE", 7, { requestNote: "Pour le week-end.", decidedAt: iso(atDay(-7, 10)), refusalReason: "Matériel réservé au chef d'équipe." }),
//   ]

//   // ---------- Messagerie ----------
//   const g1: StoredChat = { id: uid(), type: "group", name: "Annonces", announcement: true, memberIds: employees.filter((e) => e.active).map((e) => userOf(e.employeeCode).id), createdAt: iso(atDay(-30, 8)), directUserId: null, lastMessageText: null, lastMessageAt: null, lastMessageBy: null, lastMessageName: null }
//   const g2: StoredChat = { ...g1, id: uid(), name: "Équipe Bazar Be", announcement: false, memberIds: ["EMP-001", "EMP-002", "EMP-003", "EMP-005"].map((c) => userOf(c).id), createdAt: iso(atDay(-20, 8)) }
//   const dm: StoredChat = { ...g1, id: uid(), type: "direct", name: "", announcement: false, memberIds: [userOf("EMP-001").id], directUserId: userOf("EMP-001").id, createdAt: iso(atDay(-4, 8)) }
//   const chats = [g1, g2, dm]
//   const messages: MockDb["messages"] = []
//   const msg = (chat: StoredChat, sender: MockUser, text: string, at: Date, extra: Partial<MockDb["messages"][number]> = {}) => {
//     const m = { id: uid(), chatId: chat.id, senderId: sender.id, senderName: sender.name, senderRole: sender.role, text, createdAt: iso(at), replyTo: null, reactions: {}, ...extra }
//     messages.push(m)
//     Object.assign(chat, { lastMessageText: text.slice(0, 120), lastMessageAt: m.createdAt, lastMessageBy: sender.id, lastMessageName: sender.name })
//     return m
//   }
//   msg(g1, admin, "Bienvenue sur la nouvelle application de pointage ! Pensez à pointer à chaque arrivée et départ.", atDay(-30, 8, 5))
//   msg(g1, admin, "Rappel : la paie de la semaine est versée le samedi à 12 h au siège.", atDay(-6, 16, 0))
//   const m1 = msg(g2, userOf("EMP-003"), "Demain on attaque le coffrage du plancher, tout le monde à 7 h 30 svp.", atDay(-1, 17, 10))
//   msg(g2, userOf("EMP-002"), "Ok, je passe prendre les gaines au siège avant.", atDay(-1, 17, 22), { replyTo: { id: m1.id, senderName: m1.senderName, text: m1.text.slice(0, 140) }, reactions: { "👍": [userOf("EMP-003").id, userOf("EMP-005").id] } })
//   msg(g2, userOf("EMP-005"), "Bien reçu 👍", atDay(-1, 18, 3))
//   msg(g2, admin, "La bétonnière sera disponible jeudi.", minutesAgo(25, now))
//   msg(dm, admin, "Bonjour Jean, peux-tu passer au bureau vendredi pour signer ton contrat ?", atDay(-4, 10, 0))
//   msg(dm, userOf("EMP-001"), "Oui sans problème, vers 16 h.", atDay(-4, 10, 30), { reactions: { "🙏": [admin.id] } })
//   msg(dm, admin, "Parfait, merci.", minutesAgo(15, now))
//   const reads = [
//     { chatId: g2.id, userId: userOf("EMP-003").id, name: userOf("EMP-003").name, role: "employee" as const, seenAt: iso(atDay(-1, 18, 5)) },
//     { chatId: g2.id, userId: admin.id, name: admin.name, role: "admin" as const, seenAt: iso(minutesAgo(25, now)) },
//     { chatId: dm.id, userId: admin.id, name: admin.name, role: "admin" as const, seenAt: iso(minutesAgo(15, now)) },
//     { chatId: g1.id, userId: admin.id, name: admin.name, role: "admin" as const, seenAt: iso(atDay(-6, 16, 0)) },
//   ]

//   // ---------- Permissions ----------
//   const leave = (code: string, type: "CONGE" | "MALADIE" | "FAMILLE" | "ADMINISTRATIF" | "AUTRE", startOffset: number, durationValue: number, durationUnit: "JOURS" | "HEURES", reason: string, status: "EN_ATTENTE" | "ACCEPTEE" | "REFUSEE", extra: object = {}) => {
//     const days = durationUnit === "JOURS" ? Math.max(1, Math.ceil(durationValue)) : 1
//     return {
//       id: uid(), employeeCode: code, employeeName: fullName(byCode.get(code)!), type, durationValue, durationUnit, reason, status,
//       startDate: dateKey(atDay(startOffset, 8)), endDate: dateKey(atDay(startOffset + days - 1, 8)), siteId: null, siteName: null,
//       decidedAt: status === "EN_ATTENTE" ? null : iso(atDay(Math.min(startOffset, 0) - 1, 15)),
//       decidedByName: status === "EN_ATTENTE" ? null : "Administrateur", decisionNote: null,
//       employeeSeenAt: status === "EN_ATTENTE" ? null : iso(atDay(Math.min(startOffset, 0) - 1, 18)),
//       createdAt: iso(atDay(Math.min(startOffset, 0) - 3, 9)), ...extra,
//     }
//   }
//   const leaves = [
//     leave("EMP-004", "CONGE", 0, 2, "JOURS", "Congé annuel.", "ACCEPTEE"),
//     leave("EMP-001", "FAMILLE", 5, 1, "JOURS", "Mariage de ma sœur.", "EN_ATTENTE", { createdAt: iso(minutesAgo(90, now)) }),
//     leave("EMP-003", "ADMINISTRATIF", 1, 2, "HEURES", "Renouvellement de la carte d'identité.", "EN_ATTENTE", { siteId: s1.id, siteName: s1.name, createdAt: iso(minutesAgo(200, now)) }),
//     leave("EMP-002", "MALADIE", -9, 1, "JOURS", "Fièvre, certificat médical fourni.", "ACCEPTEE"),
//     leave("EMP-001", "CONGE", -12, 0.5, "JOURS", "Rendez-vous à la banque.", "ACCEPTEE", { decisionNote: "Accordé, bon courage.", employeeSeenAt: null, decidedAt: iso(atDay(-1, 11)) }),
//     leave("EMP-005", "AUTRE", -2, 1, "JOURS", "Déménagement.", "REFUSEE", { decisionNote: "Coulage prévu ce jour-là, merci de décaler.", employeeSeenAt: null }),
//   ]

//   // ---------- Contrôles de présence d'aujourd'hui ----------
//   const r1Start = minutesAgo(105, now), r2Start = minutesAgo(40, now)
//   const r1 = { id: uid(), startedAt: iso(r1Start), evaluatedAt: iso(minutesAgo(100, now)), trigger: "AUTO" as const, total: 3, present: 3, outOfZone: 0, noResponse: 0 }
//   const r2 = { id: uid(), startedAt: iso(r2Start), evaluatedAt: iso(minutesAgo(35, now)), trigger: "AUTO" as const, total: 2, present: 1, outOfZone: 1, noResponse: 0 }
//   const open5 = attendance.find((a) => a.employeeCode === "EMP-005" && a.workDate === dateKey(now) && a.exitTime) ?? null
//   const check = (roundId: string, a: StoredAttendance | null, code: string, status: "PRESENT" | "HORS_ZONE" | "SANS_REPONSE", distance: number | null, at: Date) => {
//     const e = byCode.get(code)!
//     const loc = distance === null ? null : { ...near(bazarBe, distance, 200), accuracy: 15 }
//     return {
//       id: uid(), roundId, attendanceId: a?.id ?? null, employeeCode: code, employeeName: fullName(e), departmentName: bazarBe.name,
//       siteId: s1.id, siteName: s1.name, status, location: loc, locationAt: loc ? iso(minutesAgo(3, at)) : null,
//       distance, radiusMeters: bazarBe.radiusMeters, checkedAt: iso(minutesAgo(-5, at)),
//     }
//   }
//   const checks = [
//     check(r1.id, open2, "EMP-002", "PRESENT", 28, r1Start),
//     check(r1.id, open3, "EMP-003", "PRESENT", 61, r1Start),
//     check(r1.id, open5, "EMP-005", "PRESENT", 44, r1Start),
//     check(r2.id, open2, "EMP-002", "PRESENT", 35, r2Start),
//     check(r2.id, open3, "EMP-003", "HORS_ZONE", 420, r2Start),
//   ]

//   // ---------- Devis et factures ----------
//   const lines = (items: [string, number, string, number][]): DocumentLine[] =>
//     items.map(([description, quantity, unit, unitPrice]) => ({ description, quantity, unit, unitPrice, amount: Math.round(quantity * unitPrice) }))
//   const snapshotOf = (c: Client) => ({ name: c.name, contactName: c.contactName, address: c.address, phone: c.phone, email: c.email, nif: c.nif, stat: c.stat })
//   const documents: StoredDocument[] = []
//   const versions: StoredVersion[] = []
//   function doc(type: "DEVIS" | "FACTURE", n: number, client: Client, siteId: string | null, subject: string, items: [string, number, string, number][], status: string, issueOffset: number, extra: Partial<StoredDocument> = {}) {
//     const docLines = lines(items)
//     const subtotal = docLines.reduce((s, l) => s + l.amount, 0)
//     const taxRate = 20
//     const taxAmount = Math.round((subtotal * taxRate) / 100)
//     const d: StoredDocument = {
//       id: uid(), type, number: `${type === "DEVIS" ? "DEV" : "FAC"}-${year}-${String(n).padStart(4, "0")}`,
//       issueDate: dateKey(atDay(issueOffset, 9)), dueDate: dateKey(atDay(issueOffset + 30, 9)), status: status as StoredDocument["status"],
//       clientId: client.id, client: snapshotOf(client), siteId, subject, lines: docLines, subtotal, taxRate, taxAmount, total: subtotal + taxAmount,
//       notes: type === "DEVIS" ? "Devis valable 30 jours. Acompte de 30 % à la commande." : "Paiement par virement à 30 jours.",
//       paidAt: null, sourceDocumentId: null, version: 1, createdAt: iso(atDay(issueOffset, 9)), updatedAt: iso(atDay(issueOffset, 9)),
//       ...extra,
//     }
//     documents.push(d)
//     versions.push({ documentId: d.id, version: 1, snapshot: { ...d, version: 1 }, changeLabel: "Création", changedAt: d.createdAt, changedByLabel: "admin@fortico.mg" })
//     return d
//   }
//   const gros = [
//     ["Terrassement et implantation", 1, "forfait", 2500000],
//     ["Béton armé fondations", 45, "m³", 450000],
//     ["Maçonnerie agglos RDC", 180, "m²", 65000],
//     ["Plancher dalle pleine R+1", 210, "m²", 120000],
//   ] as [string, number, string, number][]
//   const dev1 = doc("DEVIS", 1, c1, s1.id, "Gros œuvre immeuble R+3 — phase 1", gros, "ACCEPTE", -70)
//   dev1.version = 2
//   versions.push({ documentId: dev1.id, version: 2, snapshot: { ...dev1 }, changeLabel: "Statut : Accepté", changedAt: iso(atDay(-65, 11)), changedByLabel: "admin@fortico.mg" })
//   doc("FACTURE", 1, c1, s1.id, "Situation n°1 — terrassement et fondations", gros.slice(0, 2), "PAYEE", -30,
//     { sourceDocumentId: dev1.id, paidAt: dateKey(atDay(-12, 9)) })
//   doc("FACTURE", 2, c1, s1.id, "Situation n°2 — maçonnerie RDC", [gros[2]], "EMISE", -5, { sourceDocumentId: dev1.id })
//   doc("DEVIS", 2, c2, s2.id, "Réfection toiture et dallage entrepôt", [
//     ["Dépose ancienne couverture", 600, "m²", 8000],
//     ["Fourniture et pose tôles bac acier", 600, "m²", 52000],
//     ["Dallage béton 12 cm", 400, "m²", 75000],
//   ], "ENVOYE", -8)
//   doc("DEVIS", 3, c3, null, "Extension électrique salle de réunion", [
//     ["Câblage et goulottes", 1, "forfait", 850000],
//     ["Prises RJ45 + électriques", 12, "u", 45000],
//   ], "BROUILLON", -1)

//   // ---------- Journal des actions ----------
//   const log = (minutes: number, action: string, summary: string, targetId: string | null = null, userLabel = "admin@fortico.mg") =>
//     ({ id: uid(), createdAt: iso(minutesAgo(minutes, now)), userLabel, action, targetId, summary })
//   const audit = [
//     log(60 * 24 * 7, "PAYMENT_CREATED", "40 000 Ar payés à Lalao Rasoa", "EMP-004"),
//     log(60 * 24 * 6, "PAYMENT_CREATED", "100 000 Ar payés à Fara Randria — Paie de la semaine", "EMP-003"),
//     log(60 * 24 * 6.5, "EMPLOYEE_DISABLED", "Mamy Ravelo désactivé", "EMP-006"),
//     log(60 * 24 * 4, "ATTENDANCE_CREATED", "Pointage démarré à distance pour Tiana Andry (Chantier Bazar Be)", "EMP-005"),
//     log(60 * 24 * 4 - 480, "ATTENDANCE_UPDATED", "Pointage arrêté à distance pour Tiana Andry", "EMP-005"),
//     log(60 * 24 * 1, "LEAVE_APPROVED", "Permission acceptée pour Jean Rakoto (Congé)", "EMP-001"),
//     log(60 * 24 * 2, "LEAVE_REFUSED", "Permission refusée pour Tiana Andry (Autre)", "EMP-005"),
//     log(60 * 24 * 5, "DOCUMENT_CREATED", `Facture FAC-${year}-0002 créée`, null),
//     log(105, "PRESENCE_CHECK_TRIGGERED", "Contrôle de présence automatique (3 salariés)"),
//   ].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

//   return {
//     version,
//     settings: {
//       ...DEFAULT_APP_SETTINGS,
//       companyName: "FORTICO",
//       companyAddress: "Toamasina, Madagascar",
//       companyPhone: "+261 34 00 000 00",
//       companyEmail: "contact@fortico.mg",
//       companyNif: "0000000000",
//       companyStat: "00000 00 0000 0 00000",
//       defaultTaxRate: 20,
//       documentFooter: "Données de démonstration — coordonnées bancaires et mentions légales à compléter dans Paramètres.",
//     },
//     users,
//     employees,
//     workplaces,
//     attendance,
//     salaryRecords,
//     payments,
//     equipment,
//     loans,
//     chats,
//     messages,
//     reads,
//     leaves,
//     rounds: [r2, r1],
//     checks,
//     clients,
//     sites,
//     siteMembers,
//     siteSteps,
//     siteNotes,
//     documents,
//     documentVersions: versions,
//     counters: { [`DEVIS-${year}`]: 3, [`FACTURE-${year}`]: 2 },
//     audit,
//   }
// }
