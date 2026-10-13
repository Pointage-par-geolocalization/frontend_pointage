// src/mocks/store.ts
//
// MODE DÉMO UNIQUEMENT (npm run dev:mock) — base de données factice du faux serveur.
// Gardée dans le localStorage du navigateur : elle survit au rechargement de la page et elle est
// partagée entre les onglets (ex. admin dans un onglet, salarié dans un autre).
import type { AppSettings } from "../services/settings"
import type { Employee } from "../services/employees"
import type { Workplace } from "../services/workplaces"
import type { Attendance, AttendanceLocation } from "../services/attendance"
import type { SalaryRecord } from "../services/salary"
import type { Payment } from "../services/payments"
import type { EquipmentStatus, Loan } from "../services/equipment"
import type { Chat, ChatMessage, ReadReceipt } from "../services/chat"
import type { LeaveRequest } from "../services/leaves"
import type { PresenceCheck, PresenceRound } from "../services/presence"
import type { Client } from "../services/clients"
import type { SiteNote, SiteStatus, SiteStep } from "../services/sites"
import type { BusinessDocument } from "../services/documents"
import type { AuditLog } from "../services/audit"
import { seedDatabase } from "./seed"

export interface MockUser {
  id: string
  role: "admin" | "employee"
  email: string | null
  employeeCode?: string
  password: string
  name: string
}

export type StoredAttendance = Attendance & { lastLocation?: AttendanceLocation | null; lastLocationAt?: string | null }
export interface StoredEquipment { id: string; name: string; category: string | null; serialNumber: string | null; description: string | null; status: EquipmentStatus }
export type StoredChat = Omit<Chat, "unreadCount" | "directEmployeeName">
export type StoredMessage = ChatMessage & { chatId: string }
export type StoredRead = ReadReceipt & { chatId: string }
export interface StoredSite {
  id: string
  name: string
  clientId: string | null
  workplaceId: string | null
  address: string | null
  description: string | null
  startDate: string | null
  endDate: string | null
  status: SiteStatus
  manualProgress: number
  createdAt: string
}
/** Document tel que stocké : les noms (client, chantier) et les versions sont calculés à la lecture. */
export type StoredDocument = Omit<BusinessDocument, "clientName" | "siteName" | "sourceDocumentNumber" | "invoices" | "versions">
export interface StoredVersion { documentId: string; version: number; snapshot: StoredDocument; changeLabel: string; changedAt: string; changedByLabel: string }

export interface MockDb {
  version: number
  settings: AppSettings
  users: MockUser[]
  employees: Employee[]
  workplaces: Workplace[]
  attendance: StoredAttendance[]
  salaryRecords: SalaryRecord[]
  payments: Payment[]
  equipment: StoredEquipment[]
  loans: Loan[]
  chats: StoredChat[]
  messages: StoredMessage[]
  reads: StoredRead[]
  leaves: LeaveRequest[]
  rounds: PresenceRound[]
  checks: PresenceCheck[]
  clients: Client[]
  sites: StoredSite[]
  siteMembers: { siteId: string; employeeCode: string }[]
  siteSteps: (SiteStep & { siteId: string })[]
  siteNotes: (SiteNote & { siteId: string })[]
  documents: StoredDocument[]
  documentVersions: StoredVersion[]
  counters: Record<string, number>
  audit: AuditLog[]
}

/** À incrémenter quand la forme des données change : les anciennes données de démo sont alors régénérées. */
const DB_VERSION = 1
export const DB_KEY = "pointage_mock_db"

let db: MockDb | null = null

function load(): MockDb {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as MockDb
      if (parsed.version === DB_VERSION) return parsed
    }
  } catch { /* stockage indisponible ou données illisibles : on régénère */ }
  const fresh = seedDatabase(DB_VERSION)
  persist(fresh)
  return fresh
}

function persist(value: MockDb) {
  try { localStorage.setItem(DB_KEY, JSON.stringify(value)) } catch { /* quota : la démo continue en mémoire */ }
}

export function getDb(): MockDb {
  if (!db) db = load()
  return db
}

export function saveDb() {
  if (db) persist(db)
}

/** Relit la base après une modification faite dans un autre onglet. */
export function reloadDb() {
  db = null
}

/** Remet les données de démonstration à zéro. */
export function resetMockDb() {
  try { localStorage.removeItem(DB_KEY) } catch { /* ignore */ }
  db = null
  getDb()
}
