// src/services/employees.ts
import { del, get, patch, post, put } from "./api"

export type ContractType = "JOURNALIER" | "CDI"
export interface Employee {
  /** Code salarié (ex. EMP-001) : identifiant de connexion, non modifiable après création. */
  employeeCode: string
  employeeNumber?: string
  firstName: string
  lastName: string
  address?: string | null
  email?: string | null
  phone?: string | null
  position: string
  /**
   * Départements (lieux de travail) où le salarié a le droit de pointer.
   * Au moment du pointage, il ne peut choisir que parmi ceux-ci.
   */
  departmentIds: string[]
  hireDate?: string | null // YYYY-MM-DD
  active: boolean
  /** Salaire individuel (Ar) d'une journée complète (durée normale : Paramètres → Rémunération). */
  baseDailySalary: number
  contractType: ContractType
  monthlySalary?: number | null
  createdAt?: string
}

export type EmployeeInput = Omit<Employee, "employeeCode" | "active" | "createdAt">

export interface Balance { earned: number; paid: number; due: number }

export const employeeName = (e: Pick<Employee, "firstName" | "lastName">) => `${e.firstName} ${e.lastName}`

export const listEmployees = () => get<Employee[]>("/employees")

export const getEmployee = (code: string) => get<Employee>(`/employees/${encodeURIComponent(code)}`)

/** Fiche du salarié connecté. */
export const getMyEmployee = () => get<Employee>("/me/employee")

/** Création sans saisie d'identifiant public : le backend attribue employeeNumber. Le service maintient le champ historique employeeCode vide uniquement tant que le contrat serveur n'a pas migré. */
export const createEmployee = (_legacyEmployeeCode: string, data: EmployeeInput, password: string) =>
  post("/employees", { ...data, password })

/** Met à jour la fiche (le statut actif a son propre endpoint). */
export const updateEmployee = (code: string, data: Partial<EmployeeInput>) =>
  patch(`/employees/${encodeURIComponent(code)}`, data)

/** Désactiver / réactiver : un salarié désactivé perd immédiatement l'accès, ses données sont conservées. */
export const setEmployeeActive = (code: string, active: boolean) =>
  patch(`/employees/${encodeURIComponent(code)}/active`, { active })

/** Supprime fiche + compte. Refusé (409) si le salarié a un historique : le désactiver à la place. */
export const deleteEmployee = (code: string) => del(`/employees/${encodeURIComponent(code)}`)

/** Nouveau mot de passe / PIN choisi par l'admin (l'ancien n'est pas demandé) ; les sessions du salarié sont fermées. */
export const changeEmployeePassword = (code: string, newPassword: string) =>
  put(`/employees/${encodeURIComponent(code)}/password`, { newPassword })

export const getEmployeeBalance = (code: string) => get<Balance>(`/employees/${encodeURIComponent(code)}/balance`)


// // src/services/employees.ts
// import { del, get, patch, post, put } from "./api"

// export type ContractType = "JOURNALIER" | "CDI"
// export interface Employee {
//   /** Code salarié (ex. EMP-001) : identifiant de connexion, non modifiable après création. */
//   employeeCode: string
//   firstName: string
//   lastName: string
//   address?: string | null
//   email?: string | null
//   phone?: string | null
//   position: string
//   /**
//    * Départements (lieux de travail) où le salarié a le droit de pointer.
//    * Au moment du pointage, il ne peut choisir que parmi ceux-ci.
//    */
//   departmentIds: string[]
//   hireDate?: string | null // YYYY-MM-DD
//   active: boolean
//   /** Salaire individuel (Ar) d'une journée complète (durée normale : Paramètres → Rémunération). */
//   baseDailySalary: number
//   contractType: ContractType
//   monthlySalary?: number | null
//   createdAt?: string
// }

// export type EmployeeInput = Omit<Employee, "employeeCode" | "active" | "createdAt">

// export interface Balance { earned: number; paid: number; due: number }

// export const employeeName = (e: Pick<Employee, "firstName" | "lastName">) => `${e.firstName} ${e.lastName}`

// export const listEmployees = () => get<Employee[]>("/employees")

// export const getEmployee = (code: string) => get<Employee>(`/employees/${encodeURIComponent(code)}`)

// /** Fiche du salarié connecté. */
// export const getMyEmployee = () => get<Employee>("/me/employee")

// /** Crée la fiche ET le compte de connexion (code salarié + mot de passe / PIN) en une seule opération. */
// export const createEmployee = (employeeCode: string, data: EmployeeInput, password: string) =>
//   post("/employees", { employeeCode, ...data, password })

// /** Met à jour la fiche (le statut actif a son propre endpoint). */
// export const updateEmployee = (code: string, data: Partial<EmployeeInput>) =>
//   patch(`/employees/${encodeURIComponent(code)}`, data)

// /** Désactiver / réactiver : un salarié désactivé perd immédiatement l'accès, ses données sont conservées. */
// export const setEmployeeActive = (code: string, active: boolean) =>
//   patch(`/employees/${encodeURIComponent(code)}/active`, { active })

// /** Supprime fiche + compte. Refusé (409) si le salarié a un historique : le désactiver à la place. */
// export const deleteEmployee = (code: string) => del(`/employees/${encodeURIComponent(code)}`)

// /** Nouveau mot de passe / PIN choisi par l'admin (l'ancien n'est pas demandé) ; les sessions du salarié sont fermées. */
// export const changeEmployeePassword = (code: string, newPassword: string) =>
//   put(`/employees/${encodeURIComponent(code)}/password`, { newPassword })

// export const getEmployeeBalance = (code: string) => get<Balance>(`/employees/${encodeURIComponent(code)}/balance`)


// // src/services/employees.ts
// import { del, get, patch, post, put } from "./api"

// export interface Employee {
//   /** Code salarié (ex. EMP-001) : identifiant de connexion, non modifiable après création. */
//   employeeCode: string
//   firstName: string
//   lastName: string
//   address?: string | null
//   email?: string | null
//   phone?: string | null
//   position: string
//   /**
//    * Départements (lieux de travail) où le salarié a le droit de pointer.
//    * Au moment du pointage, il ne peut choisir que parmi ceux-ci.
//    */
//   departmentIds: string[]
//   hireDate?: string | null // YYYY-MM-DD
//   active: boolean
//   /** Salaire individuel (Ar) d'une journée complète (durée normale : Paramètres → Rémunération). */
//   baseDailySalary: number
//   createdAt?: string
// }

// export type EmployeeInput = Omit<Employee, "employeeCode" | "active" | "createdAt">

// export interface Balance { earned: number; paid: number; due: number }

// export const employeeName = (e: Pick<Employee, "firstName" | "lastName">) => `${e.firstName} ${e.lastName}`

// export const listEmployees = () => get<Employee[]>("/employees")

// export const getEmployee = (code: string) => get<Employee>(`/employees/${encodeURIComponent(code)}`)

// /** Fiche du salarié connecté. */
// export const getMyEmployee = () => get<Employee>("/me/employee")

// /** Crée la fiche ET le compte de connexion (code salarié + mot de passe / PIN) en une seule opération. */
// export const createEmployee = (employeeCode: string, data: EmployeeInput, password: string) =>
//   post("/employees", { employeeCode, ...data, password })

// /** Met à jour la fiche (le statut actif a son propre endpoint). */
// export const updateEmployee = (code: string, data: Partial<EmployeeInput>) =>
//   patch(`/employees/${encodeURIComponent(code)}`, data)

// /** Désactiver / réactiver : un salarié désactivé perd immédiatement l'accès, ses données sont conservées. */
// export const setEmployeeActive = (code: string, active: boolean) =>
//   patch(`/employees/${encodeURIComponent(code)}/active`, { active })

// /** Supprime fiche + compte. Refusé (409) si le salarié a un historique : le désactiver à la place. */
// export const deleteEmployee = (code: string) => del(`/employees/${encodeURIComponent(code)}`)

// /** Nouveau mot de passe / PIN choisi par l'admin (l'ancien n'est pas demandé) ; les sessions du salarié sont fermées. */
// export const changeEmployeePassword = (code: string, newPassword: string) =>
//   put(`/employees/${encodeURIComponent(code)}/password`, { newPassword })

// export const getEmployeeBalance = (code: string) => get<Balance>(`/employees/${encodeURIComponent(code)}/balance`)
