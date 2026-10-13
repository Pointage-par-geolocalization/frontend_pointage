// src/services/payments.ts
//
// Un "paiement" = de l'argent (cash) remis par l'admin à un salarié, en déduction de ce qu'il a gagné.
//   Reste à payer = Total gagné − Total payé
// Le serveur refuse un paiement supérieur au reste à payer (AMOUNT_EXCEEDS_DUE) et date le
// paiement du jour ; l'historique des paiements n'est pas modifiable.
import { get, post } from "./api"

export interface Payment {
  id: string
  employeeCode: string
  amount: number
  note: string
  date: string // YYYY-MM-DD
  createdAt: string
}

export const createPayment = (employeeCode: string, amount: number, note: string) =>
  post<Payment>("/payments", { employeeCode, amount, note: note.trim() })

/** Paiements d'un salarié (admin), du plus récent au plus ancien. */
export const listPayments = (employeeCode: string) => get<Payment[]>("/payments", { employeeCode })

/** Paiements reçus par le salarié connecté. */
export const listMyPayments = () => get<Payment[]>("/me/payments")
