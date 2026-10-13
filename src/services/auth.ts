// src/services/auth.ts
// Session : connexion par code salarié (EMP-001) ou email admin, création d'admin avec code
// d'invitation, restauration de la session au chargement de la page.
import { api, get, post, refreshSession, setAccessToken } from "./api"

export type Role = "admin" | "employee"

export interface AppUser {
  /** Identifiant du compte (UUID). */
  id: string
  role: Role
  /** Code salarié (ex. EMP-001) — uniquement pour un salarié. */
  employeeCode?: string
  email: string | null
  /** Nom affiché (prénom + nom du salarié, ou « Administrateur »). */
  name?: string
}

interface SessionResponse { accessToken: string; user: AppUser }

/**
 * Connexion. Le serveur résout lui-même l'identifiant : email (admin) s'il contient « @ »,
 * sinon code salarié. Un seul message d'erreur pour ne pas révéler l'existence d'un compte.
 */
export async function loginWithIdentifier(identifier: string, password: string): Promise<AppUser> {
  const res = await api<SessionResponse>("/auth/login", { method: "POST", body: { identifier, password }, retry: false })
  setAccessToken(res.accessToken)
  return res.user
}

/** Création d'un compte administrateur (code d'invitation vérifié par le serveur) ; ouvre directement la session. */
export async function createAdminAccount(email: string, password: string, inviteCode: string): Promise<AppUser> {
  const res = await api<SessionResponse>("/auth/register-admin", { method: "POST", body: { email, password, inviteCode }, retry: false })
  setAccessToken(res.accessToken)
  return res.user
}

export async function logout() {
  try { await api("/auth/logout", { method: "POST", body: {}, retry: false }) } finally { setAccessToken(null) }
}

/** Profil de la session en cours (null si aucune session valide, ou salarié désactivé). */
export async function restoreSession(): Promise<AppUser | null> {
  if (!(await refreshSession())) return null
  try {
    return await get<AppUser>("/auth/me")
  } catch {
    setAccessToken(null)
    return null
  }
}

/** Re-saisie du mot de passe administrateur avant une action sensible (lève une erreur s'il est incorrect). */
export async function verifyAdminPassword(password: string) {
  await post("/auth/verify-password", { password })
}
