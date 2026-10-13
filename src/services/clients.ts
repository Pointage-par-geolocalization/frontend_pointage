// src/services/clients.ts
// Clients de l'entreprise : utilisés par les chantiers, devis et factures.
import { del, get, patch, post } from "./api"

export interface Client {
  id: string
  name: string
  contactName?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  nif?: string | null
  stat?: string | null
  notes?: string | null
}

export type ClientInput = Omit<Client, "id">

export const listClients = () => get<Client[]>("/clients")
export const createClient = (data: ClientInput) => post<Client>("/clients", data)
export const updateClient = (id: string, data: Partial<ClientInput>) => patch(`/clients/${id}`, data)
/** Les chantiers et documents existants gardent les coordonnées copiées du client. */
export const deleteClient = (id: string) => del(`/clients/${id}`)
