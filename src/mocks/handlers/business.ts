// src/mocks/handlers/business.ts — chantiers, clients, devis et factures.
import { fail, invalid, isDay, num, optDay, optStr, route, str } from "../router"
import type { MockDb, MockUser, StoredDocument, StoredSite } from "../store"
import type { Site, SiteDetail, SiteStatus } from "../../services/sites"
import type { BusinessDocument, DocumentStatus, DocumentSummary, DocumentType } from "../../services/documents"
import { DOCUMENT_STATUS, isEditable } from "../../services/documents"
import { todayKey } from "../../utils/date"
import { publish } from "../events"
import { uid } from "../util"
import { audit, conflict, employeeName, findEmployee, nameOf, requireFound } from "./shared"

const nowIso = () => new Date().toISOString()

// ---------- Clients ----------

function clientFields(body: any) {
  const name = str(body.name)
  if (!name) invalid("Le nom du client est obligatoire.")
  const out: Record<string, unknown> = { name }
  for (const k of ["contactName", "phone", "email", "address", "nif", "stat", "notes"]) out[k] = optStr(body[k])
  return out
}

route("GET", "/clients", "admin", ({ db }) => [...db.clients].sort((a, b) => a.name.localeCompare(b.name, "fr")))
route("POST", "/clients", "admin", ({ db, body }) => {
  const c = { id: uid(), ...clientFields(body) } as MockDb["clients"][number]
  db.clients.push(c)
  return c
})
route("PATCH", "/clients/:id", "admin", ({ db, params, body }) => {
  const c = requireFound(db.clients.find((x) => x.id === params.id), "Client introuvable.")
  Object.assign(c, clientFields({ ...c, ...body }))
  return c
})
route("DELETE", "/clients/:id", "admin", ({ db, params }) => {
  requireFound(db.clients.find((x) => x.id === params.id), "Client introuvable.")
  db.clients = db.clients.filter((c) => c.id !== params.id)
  db.sites.forEach((s) => { if (s.clientId === params.id) s.clientId = null })
  db.documents.forEach((d) => { if (d.clientId === params.id) d.clientId = null }) // le document garde la copie du client
})

// ---------- Chantiers ----------

const SITE_STATUSES: SiteStatus[] = ["PREPARATION", "EN_COURS", "SUSPENDU", "TERMINE"]

function siteView(db: MockDb, s: StoredSite): Site {
  const steps = db.siteSteps.filter((x) => x.siteId === s.id)
  const done = steps.filter((x) => x.done).length
  return {
    ...s,
    clientName: db.clients.find((c) => c.id === s.clientId)?.name ?? null,
    workplaceName: db.workplaces.find((w) => w.id === s.workplaceId)?.name ?? null,
    progress: steps.length ? Math.round((done / steps.length) * 100) : s.manualProgress,
    memberCount: db.siteMembers.filter((m) => m.siteId === s.id).length,
    stepsDone: done,
    stepsTotal: steps.length,
  }
}

function siteFields(db: MockDb, body: any, partial: boolean): Partial<StoredSite> {
  const out: Partial<StoredSite> = {}
  if ("name" in body || !partial) { out.name = str(body.name); if (!out.name) invalid("Le nom du chantier est obligatoire.") }
  if ("clientId" in body) out.clientId = body.clientId && db.clients.some((c) => c.id === body.clientId) ? body.clientId : null
  if ("workplaceId" in body) out.workplaceId = body.workplaceId && db.workplaces.some((w) => w.id === body.workplaceId) ? body.workplaceId : null
  for (const k of ["address", "description"] as const) if (k in body) out[k] = optStr(body[k])
  for (const k of ["startDate", "endDate"] as const) if (k in body) out[k] = optDay(body[k])
  if ("status" in body) { if (!SITE_STATUSES.includes(body.status)) invalid("Statut invalide."); out.status = body.status }
  if ("manualProgress" in body) out.manualProgress = num(body.manualProgress, "avancement", { min: 0, max: 100, int: true })
  return out
}

const findSite = (db: MockDb, id: string) => requireFound(db.sites.find((s) => s.id === id), "Chantier introuvable.")

route("GET", "/sites", "admin", ({ db }) => db.sites.map((s) => siteView(db, s)).sort((a, b) => a.name.localeCompare(b.name, "fr")))

route("GET", "/me/sites", "employee", ({ db, user }) => {
  const ids = new Set(db.siteMembers.filter((m) => m.employeeCode === user.employeeCode).map((m) => m.siteId))
  return db.sites.filter((s) => ids.has(s.id) && s.status !== "TERMINE").map((s) => siteView(db, s))
})

route("GET", "/sites/:id", "admin", ({ db, params }): SiteDetail => {
  const s = findSite(db, params.id)
  const sessions = db.attendance.filter((a) => a.siteId === s.id)
  const docs = db.documents.filter((d) => d.siteId === s.id)
  const sum = (list: StoredDocument[]) => list.reduce((t, d) => t + d.total, 0)
  return {
    ...siteView(db, s),
    members: db.siteMembers.filter((m) => m.siteId === s.id).map((m) => {
      const e = db.employees.find((x) => x.employeeCode === m.employeeCode)
      return { employeeCode: m.employeeCode, name: nameOf(db, m.employeeCode), position: e?.position ?? null, active: e?.active ?? false }
    }),
    steps: db.siteSteps.filter((x) => x.siteId === s.id).sort((a, b) => a.position - b.position).map(({ siteId: _s, ...x }) => { void _s; return x }),
    notes: db.siteNotes.filter((x) => x.siteId === s.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(({ siteId: _s, ...x }) => { void _s; return x }),
    stats: {
      attendanceCount: sessions.length,
      totalMinutes: sessions.reduce((t, a) => t + a.workedMinutes, 0),
      totalSalary: sessions.reduce((t, a) => t + a.dailySalary, 0),
      presentNow: sessions.filter((a) => a.status === "EN_COURS").length,
      pendingLeaves: db.leaves.filter((l) => l.siteId === s.id && l.status === "EN_ATTENTE").length,
      quotesTotal: sum(docs.filter((d) => d.type === "DEVIS" && d.status !== "REFUSE")),
      invoicesTotal: sum(docs.filter((d) => d.type === "FACTURE" && (d.status === "EMISE" || d.status === "PAYEE"))),
      invoicesPaid: sum(docs.filter((d) => d.type === "FACTURE" && d.status === "PAYEE")),
    },
  }
})

route("POST", "/sites", "admin", ({ db, user, body }) => {
  const s: StoredSite = {
    id: uid(), clientId: null, workplaceId: null, address: null, description: null, startDate: null, endDate: null,
    status: "PREPARATION", manualProgress: 0, createdAt: nowIso(), name: "", ...siteFields(db, body, false),
  }
  if (s.startDate && s.endDate && s.endDate < s.startDate) invalid("La date de fin doit être après la date de début.")
  db.sites.push(s)
  audit(db, user, "SITE_CREATED", `Chantier « ${s.name} » créé`, s.id)
  return { id: s.id }
})

route("PATCH", "/sites/:id", "admin", ({ db, user, params, body }) => {
  const s = findSite(db, params.id)
  const next = { ...s, ...siteFields(db, body, true) }
  if (next.startDate && next.endDate && next.endDate < next.startDate) invalid("La date de fin doit être après la date de début.")
  Object.assign(s, next)
  audit(db, user, "SITE_UPDATED", `Chantier « ${s.name} » modifié`, s.id)
})

route("DELETE", "/sites/:id", "admin", ({ db, user, params }) => {
  const s = findSite(db, params.id)
  db.sites = db.sites.filter((x) => x.id !== s.id)
  db.siteMembers = db.siteMembers.filter((m) => m.siteId !== s.id)
  db.siteSteps = db.siteSteps.filter((m) => m.siteId !== s.id)
  db.siteNotes = db.siteNotes.filter((m) => m.siteId !== s.id)
  for (const list of [db.attendance, db.leaves, db.documents, db.checks] as { siteId?: string | null }[][]) {
    list.forEach((x) => { if (x.siteId === s.id) x.siteId = null })
  }
  audit(db, user, "SITE_DELETED", `Chantier « ${s.name} » supprimé`, s.id)
})

route("PUT", "/sites/:id/members", "admin", ({ db, user, params, body }) => {
  const s = findSite(db, params.id)
  const codes: string[] = Array.isArray(body.employeeCodes) ? body.employeeCodes : []
  const employees = codes.map((c) => findEmployee(db, c))
  db.siteMembers = db.siteMembers.filter((m) => m.siteId !== s.id).concat(employees.map((e) => ({ siteId: s.id, employeeCode: e.employeeCode })))
  // Les membres doivent pouvoir pointer sur le lieu du chantier.
  if (s.workplaceId) employees.forEach((e) => { if (!e.departmentIds.includes(s.workplaceId!)) e.departmentIds.push(s.workplaceId!) })
  audit(db, user, "SITE_UPDATED", `Équipe du chantier « ${s.name} » : ${employees.map(employeeName).join(", ") || "aucun membre"}`, s.id)
})

route("POST", "/sites/:id/steps", "admin", ({ db, params, body }) => {
  const s = findSite(db, params.id)
  const title = str(body.title)
  if (!title) invalid("Le titre de l'étape est obligatoire.")
  const position = Math.max(-1, ...db.siteSteps.filter((x) => x.siteId === s.id).map((x) => x.position)) + 1
  db.siteSteps.push({ id: uid(), siteId: s.id, title, description: optStr(body.description), position, dueDate: optDay(body.dueDate), done: false, doneAt: null })
})

route("PATCH", "/sites/:id/steps/:stepId", "admin", ({ db, params, body }) => {
  const step = requireFound(db.siteSteps.find((x) => x.id === params.stepId && x.siteId === params.id), "Étape introuvable.")
  if ("title" in body) { const t = str(body.title); if (!t) invalid("Le titre de l'étape est obligatoire."); step.title = t }
  if ("description" in body) step.description = optStr(body.description)
  if ("dueDate" in body) step.dueDate = optDay(body.dueDate)
  if ("position" in body) step.position = num(body.position, "position", { int: true })
  if ("done" in body) { step.done = body.done === true; step.doneAt = step.done ? nowIso() : null }
})

route("DELETE", "/sites/:id/steps/:stepId", "admin", ({ db, params }) => {
  db.siteSteps = db.siteSteps.filter((x) => !(x.id === params.stepId && x.siteId === params.id))
})

route("POST", "/sites/:id/notes", "admin", ({ db, user, params, body }) => {
  const s = findSite(db, params.id)
  const text = str(body.text)
  if (!text) invalid("La note est vide.")
  db.siteNotes.push({ id: uid(), siteId: s.id, authorName: user.name, text: text.slice(0, 4000), createdAt: nowIso() })
})

route("DELETE", "/sites/:id/notes/:noteId", "admin", ({ db, params }) => {
  db.siteNotes = db.siteNotes.filter((x) => !(x.id === params.noteId && x.siteId === params.id))
})

// ---------- Devis & factures ----------

const PREFIX: Record<DocumentType, string> = { DEVIS: "DEV", FACTURE: "FAC" }
const label = (u: MockUser) => u.email ?? u.name

function summary(db: MockDb, d: StoredDocument): DocumentSummary {
  return {
    id: d.id, type: d.type, number: d.number, issueDate: d.issueDate, dueDate: d.dueDate, status: d.status,
    clientId: d.clientId, clientName: d.client.name, siteId: d.siteId,
    siteName: db.sites.find((s) => s.id === d.siteId)?.name ?? null, subject: d.subject, total: d.total, updatedAt: d.updatedAt,
  }
}

function full(db: MockDb, d: StoredDocument): BusinessDocument {
  return {
    ...d, ...summary(db, d),
    sourceDocumentNumber: db.documents.find((x) => x.id === d.sourceDocumentId)?.number ?? null,
    invoices: db.documents.filter((x) => x.sourceDocumentId === d.id).map((x) => ({ id: x.id, number: x.number, status: x.status as "BROUILLON" })),
    versions: db.documentVersions.filter((v) => v.documentId === d.id)
      .map((v) => ({ version: v.version, changeLabel: v.changeLabel, changedAt: v.changedAt, changedByLabel: v.changedByLabel })),
  }
}

function snapshotVersion(db: MockDb, d: StoredDocument, changeLabel: string, u: MockUser) {
  db.documentVersions.push({ documentId: d.id, version: d.version, snapshot: JSON.parse(JSON.stringify(d)), changeLabel, changedAt: nowIso(), changedByLabel: label(u) })
}

/** Lignes, client et totaux recalculés par le serveur (le client ne fournit jamais les montants). */
function contentFields(db: MockDb, body: any, current?: StoredDocument): Partial<StoredDocument> {
  const out: Partial<StoredDocument> = {}
  if ("issueDate" in body || !current) out.issueDate = isDay(body.issueDate) ? body.issueDate : todayKey()
  if ("dueDate" in body) out.dueDate = optDay(body.dueDate)
  if ("subject" in body) out.subject = str(body.subject)
  if ("notes" in body) out.notes = str(body.notes)
  if ("siteId" in body) out.siteId = body.siteId && db.sites.some((s) => s.id === body.siteId) ? body.siteId : null
  if ("clientId" in body || !current) {
    const c = db.clients.find((x) => x.id === body.clientId)
    if (!c) invalid("Choisissez un client.")
    out.clientId = c!.id
    out.client = { name: c!.name, contactName: c!.contactName, address: c!.address, phone: c!.phone, email: c!.email, nif: c!.nif, stat: c!.stat }
  }
  const lines = "lines" in body || !current ? body.lines : current.lines
  if (!Array.isArray(lines) || lines.length === 0) invalid("Ajoutez au moins une ligne.")
  out.lines = (lines as any[]).map((l, i) => {
    const description = str(l.description)
    if (!description) invalid(`Ligne ${i + 1} : la désignation est obligatoire.`)
    const quantity = num(l.quantity, "quantité", { min: 0 })
    const unitPrice = num(l.unitPrice, "prix unitaire", { min: 0, int: true })
    return { description, quantity, unit: str(l.unit), unitPrice, amount: Math.round(quantity * unitPrice) }
  })
  const taxRate = "taxRate" in body ? num(body.taxRate, "TVA", { min: 0, max: 100 }) : current?.taxRate ?? db.settings.defaultTaxRate
  const subtotal = out.lines.reduce((s, l) => s + l.amount, 0)
  const taxAmount = Math.round((subtotal * taxRate) / 100)
  Object.assign(out, { taxRate, subtotal, taxAmount, total: subtotal + taxAmount })
  return out
}

function nextNumber(db: MockDb, type: DocumentType) {
  const year = new Date().getFullYear()
  const key = `${type}-${year}`
  db.counters[key] = (db.counters[key] ?? 0) + 1
  return `${PREFIX[type]}-${year}-${String(db.counters[key]).padStart(4, "0")}`
}

const findDoc = (db: MockDb, id: string) => requireFound(db.documents.find((d) => d.id === id), "Document introuvable.")
const docChanged = () => publish({ type: "document.updated" })

route("GET", "/documents", "admin", ({ db, query }) => {
  const type = query.get("type"), status = query.get("status"), clientId = query.get("clientId"), siteId = query.get("siteId")
  const from = query.get("from"), to = query.get("to"), q = (query.get("q") ?? "").trim().toLowerCase()
  return db.documents
    .filter((d) => (!type || d.type === type) && (!status || d.status === status) && (!clientId || d.clientId === clientId) &&
      (!siteId || d.siteId === siteId) && (!from || d.issueDate >= from) && (!to || d.issueDate <= to))
    .map((d) => summary(db, d))
    .filter((d) => !q || [d.number, d.clientName, d.subject, d.siteName ?? ""].some((v) => v.toLowerCase().includes(q)))
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.number.localeCompare(a.number))
})

route("GET", "/documents/:id", "admin", ({ db, params }) => full(db, findDoc(db, params.id)))

route("GET", "/documents/:id/versions/:version", "admin", ({ db, params }) => {
  const v = requireFound(db.documentVersions.find((x) => x.documentId === params.id && x.version === Number(params.version)), "Version introuvable.")
  return { version: v.version, snapshot: full(db, v.snapshot) }
})

route("POST", "/documents", "admin", ({ db, user, body }) => {
  const type: DocumentType = body.type === "FACTURE" ? "FACTURE" : body.type === "DEVIS" ? "DEVIS" : invalid("Type de document invalide.")
  const d = {
    id: uid(), type, number: "", status: "BROUILLON" as DocumentStatus, dueDate: null, siteId: null, subject: "", notes: "",
    paidAt: null, sourceDocumentId: null, version: 1, createdAt: nowIso(), updatedAt: nowIso(),
    ...contentFields(db, body),
  } as StoredDocument
  d.number = nextNumber(db, type)
  db.documents.push(d)
  snapshotVersion(db, d, "Création", user)
  audit(db, user, "DOCUMENT_CREATED", `${type === "DEVIS" ? "Devis" : "Facture"} ${d.number} créé${type === "FACTURE" ? "e" : ""}`, d.id)
  docChanged()
  return { id: d.id, number: d.number }
})

route("PATCH", "/documents/:id", "admin", ({ db, user, params, body }) => {
  const d = findDoc(db, params.id)
  if (!isEditable(d)) conflict("DOCUMENT_LOCKED", "Ce document ne peut plus être modifié.")
  Object.assign(d, contentFields(db, body, d), { version: d.version + 1, updatedAt: nowIso() })
  snapshotVersion(db, d, "Modification du contenu", user)
  audit(db, user, "DOCUMENT_UPDATED", `${d.number} modifié (version ${d.version})`, d.id)
  docChanged()
})

const TRANSITIONS: Record<DocumentType, Record<string, DocumentStatus[]>> = {
  DEVIS: { BROUILLON: ["ENVOYE", "ACCEPTE", "REFUSE"], ENVOYE: ["ACCEPTE", "REFUSE"], ACCEPTE: [], REFUSE: [] },
  FACTURE: { BROUILLON: ["EMISE"], EMISE: ["PAYEE", "ANNULEE"], PAYEE: [], ANNULEE: [] },
}

route("POST", "/documents/:id/status", "admin", ({ db, user, params, body }) => {
  const d = findDoc(db, params.id)
  const status = body.status as DocumentStatus
  if (!(TRANSITIONS[d.type][d.status] ?? []).includes(status)) conflict("INVALID_STATUS", "Ce changement de statut n'est pas possible.")
  Object.assign(d, { status, version: d.version + 1, updatedAt: nowIso(), paidAt: status === "PAYEE" ? todayKey() : d.paidAt })
  const statusLabel = DOCUMENT_STATUS[d.type][status]?.label ?? status
  snapshotVersion(db, d, `Statut : ${statusLabel}`, user)
  audit(db, user, "DOCUMENT_STATUS_CHANGED", `${d.number} → ${statusLabel}`, d.id)
  docChanged()
})

route("POST", "/documents/:id/invoice", "admin", ({ db, user, params }) => {
  const q = findDoc(db, params.id)
  if (q.type !== "DEVIS") invalid("Seul un devis peut être transformé en facture.")
  if (q.status === "REFUSE") conflict("INVALID_STATUS", "Ce devis a été refusé.")
  const f: StoredDocument = {
    ...JSON.parse(JSON.stringify(q)), id: uid(), type: "FACTURE", number: nextNumber(db, "FACTURE"), status: "BROUILLON",
    issueDate: todayKey(), dueDate: null, sourceDocumentId: q.id, paidAt: null, version: 1, createdAt: nowIso(), updatedAt: nowIso(),
    subject: q.subject ? `Facture — ${q.subject}` : "", notes: "",
  }
  db.documents.push(f)
  snapshotVersion(db, f, `Création depuis le devis ${q.number}`, user)
  audit(db, user, "DOCUMENT_CREATED", `Facture ${f.number} créée depuis le devis ${q.number}`, f.id)
  docChanged()
  return { id: f.id, number: f.number }
})

route("DELETE", "/documents/:id", "admin", ({ db, user, params }) => {
  const d = findDoc(db, params.id)
  if (d.status !== "BROUILLON") fail(409, "DOCUMENT_LOCKED", d.type === "FACTURE" ? "Seul un brouillon peut être supprimé : annulez la facture." : "Seul un brouillon peut être supprimé : marquez le devis comme refusé.")
  db.documents = db.documents.filter((x) => x.id !== d.id)
  db.documentVersions = db.documentVersions.filter((v) => v.documentId !== d.id)
  audit(db, user, "DOCUMENT_DELETED", `Brouillon ${d.number} supprimé`, d.id)
  docChanged()
})
