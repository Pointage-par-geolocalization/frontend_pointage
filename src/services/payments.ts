import { api, get, post, patch } from "./api"
export type PaymentStatus = "PAYE" | "EN_ATTENTE" | "ANNULE"
export interface Payment { id:string; employeeCode:string; employeeName?:string; amount:number; note:string; date:string; createdAt:string; updatedAt?:string; updatedBy?:string; type?:string; status?:PaymentStatus; siteId?:string|null }
export interface DeletedPayment extends Payment { employeeName:string; deletedAt:string; deletedBy:string; deletionReason:string }
export interface PaymentQuery { employeeCode?:string; from?:string; to?:string; type?:string; status?:PaymentStatus; siteId?:string }
export const createPayment=(employeeCode:string,amount:number,note:string)=>post<Payment>("/payments",{employeeCode,amount,note:note.trim()})
export const listPayments=(query:string|PaymentQuery={})=>get<Payment[]>("/payments",typeof query==="string"?{employeeCode:query}:{...query})
export const updatePayment=(id:string,data:Partial<Pick<Payment,"amount"|"note"|"date"|"type"|"status"|"siteId">>)=>patch<Payment>(`/payments/${encodeURIComponent(id)}`,data)
export const listDeletedPayments=()=>get<DeletedPayment[]>("/payments/deleted")
export const listMyPayments=()=>get<Payment[]>("/me/payments")
export const softDeletePayment=(paymentId:string,reason:string)=>api<void>(`/payments/${encodeURIComponent(paymentId)}`,{method:"DELETE",body:{reason:reason.trim()}})


// // src/services/payments.ts
// //
// // Un "paiement" = de l'argent (cash) remis par l'admin à un salarié, en déduction de ce qu'il a gagné.
// //   Reste à payer = Total gagné − Total payé
// // Le serveur refuse un paiement supérieur au reste à payer (AMOUNT_EXCEEDS_DUE) et date le
// // paiement du jour ; l'historique des paiements n'est pas modifiable.
// import { api, get, post } from "./api"

// export interface Payment {
//   id: string
//   employeeCode: string
//   amount: number
//   note: string
//   date: string // YYYY-MM-DD
//   createdAt: string
// }

// export interface DeletedPayment extends Payment {
//   employeeName: string
//   deletedAt: string
//   deletedBy: string
//   deletionReason: string
// }

// export const createPayment = (employeeCode: string, amount: number, note: string) =>
//   post<Payment>("/payments", { employeeCode, amount, note: note.trim() })

// /** Paiements d'un salarié (admin), du plus récent au plus ancien. */
// export const listPayments = (employeeCode: string) => get<Payment[]>("/payments", { employeeCode })

// /** ADMIN : historique des paiements archivés, avec date, auteur et motif de suppression. */
// export const listDeletedPayments = () => get<DeletedPayment[]>("/payments/deleted")

// /** Paiements reçus par le salarié connecté. */
// export const listMyPayments = () => get<Payment[]>("/me/payments")

// /** ADMIN : archive un paiement avec motif obligatoire, sans effacer la ligne en base. */
// export const softDeletePayment = (paymentId: string, reason: string) =>
//   api<void>(`/payments/${encodeURIComponent(paymentId)}`, { method: "DELETE", body: { reason: reason.trim() } })


// // // src/services/payments.ts
// // //
// // // Un "paiement" = de l'argent (cash) remis par l'admin à un salarié, en déduction de ce qu'il a gagné.
// // //   Reste à payer = Total gagné − Total payé
// // // Le serveur refuse un paiement supérieur au reste à payer (AMOUNT_EXCEEDS_DUE) et date le
// // // paiement du jour ; l'historique des paiements n'est pas modifiable.
// // import { api, get, post } from "./api"

// // export interface Payment {
// //   id: string
// //   employeeCode: string
// //   amount: number
// //   note: string
// //   date: string // YYYY-MM-DD
// //   createdAt: string
// // }

// // export const createPayment = (employeeCode: string, amount: number, note: string) =>
// //   post<Payment>("/payments", { employeeCode, amount, note: note.trim() })

// // /** Paiements d'un salarié (admin), du plus récent au plus ancien. */
// // export const listPayments = (employeeCode: string) => get<Payment[]>("/payments", { employeeCode })

// // /** Paiements reçus par le salarié connecté. */
// // export const listMyPayments = () => get<Payment[]>("/me/payments")

// // /** ADMIN : archive un paiement avec motif obligatoire, sans effacer la ligne en base. */
// // export const softDeletePayment = (paymentId: string, reason: string) =>
// //   api<void>(`/payments/${encodeURIComponent(paymentId)}`, { method: "DELETE", body: { reason: reason.trim() } })


// // // // src/services/payments.ts
// // // //
// // // // Un "paiement" = de l'argent (cash) remis par l'admin à un salarié, en déduction de ce qu'il a gagné.
// // // //   Reste à payer = Total gagné − Total payé
// // // // Le serveur refuse un paiement supérieur au reste à payer (AMOUNT_EXCEEDS_DUE) et date le
// // // // paiement du jour ; l'historique des paiements n'est pas modifiable.
// // // import { get, post } from "./api"

// // // export interface Payment {
// // //   id: string
// // //   employeeCode: string
// // //   amount: number
// // //   note: string
// // //   date: string // YYYY-MM-DD
// // //   createdAt: string
// // // }

// // // export const createPayment = (employeeCode: string, amount: number, note: string) =>
// // //   post<Payment>("/payments", { employeeCode, amount, note: note.trim() })

// // // /** Paiements d'un salarié (admin), du plus récent au plus ancien. */
// // // export const listPayments = (employeeCode: string) => get<Payment[]>("/payments", { employeeCode })

// // // /** Paiements reçus par le salarié connecté. */
// // // export const listMyPayments = () => get<Payment[]>("/me/payments")
