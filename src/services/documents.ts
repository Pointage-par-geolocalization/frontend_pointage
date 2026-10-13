// src/services/documents.ts
//
// Devis et factures : création (depuis un client / un chantier, ou une facture depuis un devis),
// numérotation et datation par le serveur (DEV-2026-0001, FAC-2026-0001), archivage avec
// historique des versions, recherche et impression.
import { del, get, patch, post } from "./api"

export type DocumentType = "DEVIS" | "FACTURE"
export type QuoteStatus = "BROUILLON" | "ENVOYE" | "ACCEPTE" | "REFUSE"
export type InvoiceStatus = "BROUILLON" | "EMISE" | "PAYEE" | "ANNULEE"
export type DocumentStatus = QuoteStatus | InvoiceStatus

export interface DocumentLine {
  description: string
  quantity: number
  unit: string
  unitPrice: number // Ar
  amount: number // Ar, = arrondi(quantité × prix unitaire)
}

export interface ClientSnapshot {
  name: string
  contactName?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  nif?: string | null
  stat?: string | null
}

export interface DocumentSummary {
  id: string
  type: DocumentType
  number: string
  issueDate: string
  dueDate?: string | null
  status: DocumentStatus
  clientId?: string | null
  clientName: string
  siteId?: string | null
  siteName?: string | null
  subject: string
  total: number
  updatedAt: string
}

export interface DocumentVersion { version: number; changeLabel: string; changedAt: string; changedByLabel?: string | null }

export interface BusinessDocument extends DocumentSummary {
  client: ClientSnapshot
  lines: DocumentLine[]
  subtotal: number
  taxRate: number
  taxAmount: number
  notes: string
  paidAt?: string | null
  /** Devis d'origine (facture créée depuis un devis). */
  sourceDocumentId?: string | null
  sourceDocumentNumber?: string | null
  /** Factures créées depuis ce devis. */
  invoices?: { id: string; number: string; status: InvoiceStatus }[]
  version: number
  versions: DocumentVersion[]
  createdAt: string
}

export interface DocumentInput {
  type: DocumentType
  issueDate: string
  dueDate: string | null
  clientId: string | null
  siteId: string | null
  subject: string
  lines: Omit<DocumentLine, "amount">[]
  taxRate: number
  notes: string
}

type Tone = "green" | "red" | "yellow" | "gray" | "blue"

export const DOCUMENT_TYPE: Record<DocumentType, { label: string; prefix: string }> = {
  DEVIS: { label: "Devis", prefix: "DEV" },
  FACTURE: { label: "Facture", prefix: "FAC" },
}

export const DOCUMENT_STATUS: Record<DocumentType, Partial<Record<DocumentStatus, { label: string; tone: Tone }>>> = {
  DEVIS: {
    BROUILLON: { label: "Brouillon", tone: "gray" },
    ENVOYE: { label: "Envoyé", tone: "blue" },
    ACCEPTE: { label: "Accepté", tone: "green" },
    REFUSE: { label: "Refusé", tone: "red" },
  },
  FACTURE: {
    BROUILLON: { label: "Brouillon", tone: "gray" },
    EMISE: { label: "Émise", tone: "blue" },
    PAYEE: { label: "Payée", tone: "green" },
    ANNULEE: { label: "Annulée", tone: "red" },
  },
}

export const statusInfo = (type: DocumentType, status: DocumentStatus) =>
  DOCUMENT_STATUS[type][status] ?? { label: status, tone: "gray" as Tone }

/** Un devis se modifie tant qu'il n'est ni accepté ni refusé ; une facture seulement en brouillon. */
export const isEditable = (d: Pick<DocumentSummary, "type" | "status">) =>
  d.type === "DEVIS" ? d.status === "BROUILLON" || d.status === "ENVOYE" : d.status === "BROUILLON"

/** Totaux affichés pendant la saisie (le serveur recalcule et fait foi). */
export function computeTotals(lines: Omit<DocumentLine, "amount">[], taxRate: number) {
  const withAmounts = lines.map((l) => ({ ...l, amount: Math.round((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0)) }))
  const subtotal = withAmounts.reduce((s, l) => s + l.amount, 0)
  const taxAmount = Math.round((subtotal * (Number(taxRate) || 0)) / 100)
  return { lines: withAmounts, subtotal, taxAmount, total: subtotal + taxAmount }
}

export interface DocumentQuery {
  type?: DocumentType
  status?: DocumentStatus
  clientId?: string
  siteId?: string
  /** Recherche : numéro, client, objet. */
  q?: string
  from?: string
  to?: string
}

export const listDocuments = (q: DocumentQuery = {}) => get<DocumentSummary[]>("/documents", { ...q })
export const getDocument = (id: string) => get<BusinessDocument>(`/documents/${id}`)
/** Contenu d'une version antérieure. */
export const getDocumentVersion = (id: string, version: number) =>
  get<{ version: number; snapshot: BusinessDocument }>(`/documents/${id}/versions/${version}`)

export const createDocument = (data: DocumentInput) => post<{ id: string; number: string }>("/documents", data)
export const updateDocument = (id: string, data: Partial<DocumentInput>) => patch(`/documents/${id}`, data)
export const setDocumentStatus = (id: string, status: DocumentStatus) => post(`/documents/${id}/status`, { status })
/** Crée une facture (brouillon) reprenant les lignes du devis. */
export const createInvoiceFromQuote = (quoteId: string) => post<{ id: string; number: string }>(`/documents/${quoteId}/invoice`)
/** Seuls les brouillons peuvent être supprimés ; sinon annuler (facture) ou refuser (devis). */
export const deleteDocument = (id: string) => del(`/documents/${id}`)
