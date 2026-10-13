// src/services/sites.ts
//
// Suivi des chantiers : informations principales (client, lieu de pointage, période), équipe
// affectée, étapes réalisées et journal. Les pointages, permissions, contrôles de présence,
// devis et factures sont rattachés au chantier (siteId) et consultables depuis sa fiche.
import { del, get, patch, post, put } from "./api"

export type SiteStatus = "PREPARATION" | "EN_COURS" | "SUSPENDU" | "TERMINE"

export interface Site {
  id: string
  name: string
  clientId?: string | null
  clientName?: string | null
  /** Lieu de travail (zone GPS) où l'équipe pointe ; les pointages y sont rattachés au chantier. */
  workplaceId?: string | null
  workplaceName?: string | null
  address?: string | null
  description?: string | null
  startDate?: string | null
  endDate?: string | null
  status: SiteStatus
  /** Avancement en % : calculé à partir des étapes s'il y en a, sinon égal à `manualProgress`. */
  progress: number
  /** Avancement saisi à la main (utilisé quand le chantier n'a pas d'étapes). */
  manualProgress: number
  memberCount: number
  stepsDone: number
  stepsTotal: number
}

export interface SiteMember { employeeCode: string; name: string; position?: string | null; active: boolean }

export interface SiteStep {
  id: string
  title: string
  description?: string | null
  position: number
  dueDate?: string | null
  done: boolean
  doneAt?: string | null
}

export interface SiteNote { id: string; authorName: string; text: string; createdAt: string }

export interface SiteStats {
  attendanceCount: number
  totalMinutes: number
  totalSalary: number
  /** Salariés actuellement en poste sur le chantier. */
  presentNow: number
  pendingLeaves: number
  quotesTotal: number
  invoicesTotal: number
  invoicesPaid: number
}

export interface SiteDetail extends Site {
  members: SiteMember[]
  steps: SiteStep[]
  notes: SiteNote[]
  stats: SiteStats
}

export interface SiteInput {
  name: string
  clientId: string | null
  workplaceId: string | null
  address: string | null
  description: string | null
  startDate: string | null
  endDate: string | null
  status: SiteStatus
  manualProgress: number
}

type Tone = "green" | "red" | "yellow" | "gray" | "blue"

export const SITE_STATUS: Record<SiteStatus, { label: string; tone: Tone }> = {
  PREPARATION: { label: "En préparation", tone: "gray" },
  EN_COURS: { label: "En cours", tone: "blue" },
  SUSPENDU: { label: "Suspendu", tone: "yellow" },
  TERMINE: { label: "Terminé", tone: "green" },
}

export const listSites = () => get<Site[]>("/sites")
export const getSite = (id: string) => get<SiteDetail>(`/sites/${id}`)
/** Chantiers dont le salarié connecté fait partie. */
export const listMySites = () => get<Site[]>("/me/sites")

export const createSite = (data: SiteInput) => post<{ id: string }>("/sites", data)
export const updateSite = (id: string, data: Partial<SiteInput>) => patch(`/sites/${id}`, data)
/** Les pointages, permissions et documents liés sont conservés (simplement détachés). */
export const deleteSite = (id: string) => del(`/sites/${id}`)

/**
 * Remplace l'équipe du chantier. Le lieu de pointage du chantier est ajouté aux départements
 * autorisés des membres pour qu'ils puissent y pointer.
 */
export const setSiteMembers = (id: string, employeeCodes: string[]) => put(`/sites/${id}/members`, { employeeCodes })

export const addSiteStep = (id: string, step: { title: string; description?: string | null; dueDate?: string | null }) =>
  post(`/sites/${id}/steps`, step)
export const updateSiteStep = (id: string, stepId: string, data: Partial<Pick<SiteStep, "title" | "description" | "dueDate" | "done" | "position">>) =>
  patch(`/sites/${id}/steps/${stepId}`, data)
export const deleteSiteStep = (id: string, stepId: string) => del(`/sites/${id}/steps/${stepId}`)

export const addSiteNote = (id: string, text: string) => post(`/sites/${id}/notes`, { text: text.trim() })
export const deleteSiteNote = (id: string, noteId: string) => del(`/sites/${id}/notes/${noteId}`)
