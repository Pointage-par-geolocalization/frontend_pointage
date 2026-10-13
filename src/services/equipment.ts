// src/services/equipment.ts
//
// Gestion du matériel : inventaire + prêts.
//
// Cycle d'un prêt :
//   DEMANDE ──(admin confirme)──▶ EN_COURS ──(salarié signale le retour)──▶ RETOUR_DEMANDE
//      │                              │                                          │
//      ├─(admin refuse)─▶ REFUSEE     └────(admin confirme le retour)────────────┴──▶ RETOURNE
//      └─(salarié annule)─▶ ANNULEE
//
// L'attribution et la confirmation du retour sont atomiques côté serveur : un matériel ne peut
// jamais être prêté à deux personnes en même temps.
import { del, get, patch, post } from "./api"
import { emitLocal, live } from "./realtime"

export type EquipmentStatus = "DISPONIBLE" | "EMPRUNTE" | "HORS_SERVICE"

export interface Equipment {
  id: string
  name: string
  category?: string | null
  serialNumber?: string | null
  description?: string | null
  status: EquipmentStatus
  /** Prêt en cours (renseigné seulement quand status = EMPRUNTE). */
  currentLoanId?: string | null
  currentBorrowerCode?: string | null
  currentBorrowerName?: string | null
  currentLoanedAt?: string | null
}

export type LoanStatus = "DEMANDE" | "REFUSEE" | "ANNULEE" | "EN_COURS" | "RETOUR_DEMANDE" | "RETOURNE"

export interface Loan {
  id: string
  equipmentId: string | null // null : matériel supprimé depuis (le nom reste dans l'historique)
  equipmentName: string
  employeeCode: string | null
  employeeName: string
  status: LoanStatus
  requestNote?: string | null
  /** Date de retour souhaitée par le salarié (« jusqu'à quand »). */
  expectedReturnDate?: string | null
  requestedAt: string
  decidedAt?: string | null
  refusalReason?: string | null
  /** Date de prêt : enregistrée quand l'admin confirme la demande. */
  loanedAt?: string | null
  returnRequestedAt?: string | null
  returnNote?: string | null
  /** Date de retour : enregistrée quand l'admin confirme le retour. */
  returnedAt?: string | null
}

type Tone = "green" | "red" | "yellow" | "gray" | "blue"

export const LOAN_STATUS: Record<LoanStatus, { label: string; tone: Tone }> = {
  DEMANDE: { label: "Demande en attente", tone: "yellow" },
  REFUSEE: { label: "Refusée", tone: "red" },
  ANNULEE: { label: "Annulée", tone: "gray" },
  EN_COURS: { label: "Emprunté", tone: "blue" },
  RETOUR_DEMANDE: { label: "Retour à confirmer", tone: "yellow" },
  RETOURNE: { label: "Retourné", tone: "green" },
}

export const EQUIPMENT_STATUS: Record<EquipmentStatus, { label: string; tone: Tone }> = {
  DISPONIBLE: { label: "Disponible", tone: "green" },
  EMPRUNTE: { label: "Emprunté", tone: "blue" },
  HORS_SERVICE: { label: "Hors service", tone: "gray" },
}

const EVENTS = ["equipment.updated", "loan.updated", "loans.pending"]

/** Après une action : rafraîchit tout de suite l'inventaire, les prêts et le badge. */
const changed = <T,>(p: Promise<T>) => p.then((v) => { emitLocal({ type: "loan.updated" }); return v })

// ---------- Données tenues à jour en direct ----------

export const subscribeEquipment = (cb: (list: Equipment[]) => void, onError?: (e: unknown) => void) =>
  live(() => get<Equipment[]>("/equipment"), cb, { events: EVENTS, onError })

/** Tous les prêts (admin) ou ceux du salarié connecté (`mine`), du plus récent au plus ancien. */
export const subscribeLoans = (mine: boolean, cb: (list: Loan[]) => void, onError?: (e: unknown) => void) =>
  live(() => get<Loan[]>(mine ? "/me/loans" : "/loans"), cb, { events: EVENTS, onError })

/** Nombre de demandes à traiter par l'admin (emprunts + retours) — badge de navigation. */
export const subscribePendingCount = (cb: (n: number) => void) =>
  live(() => get<{ count: number }>("/loans/pending-count").then((r) => r.count), cb, { events: EVENTS, onError: () => cb(0) })

// ---------- Admin : inventaire ----------

export interface EquipmentInput { name: string; category: string; serialNumber: string; description: string }

const clean = (v?: string | null) => v?.trim() || null
const toBody = (i: EquipmentInput) => ({
  name: i.name.trim(), category: clean(i.category), serialNumber: clean(i.serialNumber), description: clean(i.description),
})

export const createEquipment = (input: EquipmentInput) =>
  changed(post("/equipment", toBody(input)))
export const updateEquipment = (id: string, input: EquipmentInput) =>
  changed(patch(`/equipment/${id}`, toBody(input)))
/** Hors service (panne, maintenance…) ⇄ disponible. Refusé si le matériel est emprunté. */
export const setOutOfService = (id: string, outOfService: boolean) =>
  changed(patch(`/equipment/${id}/out-of-service`, { outOfService }))
/** Refusé si le matériel est emprunté ; les prêts passés gardent leur historique. */
export const deleteEquipment = (id: string) =>
  changed(del(`/equipment/${id}`))

// ---------- Salarié ----------

export const requestLoan = (equipmentId: string, note: string, expectedReturnDate?: string) =>
  changed(post("/loans", { equipmentId, note: note.trim() || null, expectedReturnDate: expectedReturnDate || null }))
export const cancelRequest = (loanId: string) =>
  changed(post(`/loans/${loanId}/cancel`))
/** Le salarié signale qu'il a rapporté le matériel ; l'admin doit ensuite le confirmer. */
export const reportReturn = (loanId: string, note: string) =>
  changed(post(`/loans/${loanId}/return-request`, { note: note.trim() || null }))

// ---------- Admin : décisions ----------

/** Le matériel est attribué au salarié et la date de prêt enregistrée. */
export const approveLoan = (loanId: string) =>
  changed(post(`/loans/${loanId}/approve`))
export const refuseLoan = (loanId: string, reason: string) =>
  changed(post(`/loans/${loanId}/refuse`, { reason: reason.trim() || null }))
/** Date de retour enregistrée, le matériel redevient disponible. */
export const confirmReturn = (loanId: string) =>
  changed(post(`/loans/${loanId}/confirm-return`))
