// src/contexts/AuthContext.tsx
// Session de l'utilisateur : restaurée au chargement de la page (cookie de rafraîchissement),
// fermée à la déconnexion, à l'expiration ou quand le serveur révoque l'accès (salarié désactivé).
import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  loginWithIdentifier, createAdminAccount, logout as apiLogout, restoreSession, type AppUser,
} from "../services/auth"
import { onSessionExpired, setAccessToken } from "../services/api"
import { onEvents, startRealtime, stopRealtime } from "../services/realtime"

interface AuthContextValue {
  appUser: AppUser | null
  loading: boolean
  login: (identifier: string, password: string) => Promise<AppUser>
  registerAdmin: (email: string, password: string, inviteCode: string) => Promise<AppUser>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue>({
  appUser: null,
  loading: true,
  login: async () => { throw new Error("AuthProvider manquant") },
  registerAdmin: async () => { throw new Error("AuthProvider manquant") },
  logout: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    restoreSession()
      .then((u) => { if (!cancelled) setAppUser(u) })
      .finally(() => { if (!cancelled) setLoading(false) })
    const offExpired = onSessionExpired(() => setAppUser(null))
    // Compte désactivé / supprimé ou mot de passe changé : le serveur coupe la session.
    const offRevoked = onEvents(["session.revoked"], () => { setAccessToken(null); setAppUser(null) })
    return () => { cancelled = true; offExpired(); offRevoked() }
  }, [])

  useEffect(() => {
    if (!appUser) return
    startRealtime()
    return stopRealtime
  }, [appUser?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (identifier: string, password: string) => {
    const u = await loginWithIdentifier(identifier, password)
    setAppUser(u)
    return u
  }, [])

  const registerAdmin = useCallback(async (email: string, password: string, inviteCode: string) => {
    const u = await createAdminAccount(email, password, inviteCode)
    setAppUser(u)
    return u
  }, [])

  const logout = useCallback(async () => {
    try { await apiLogout() } finally { setAppUser(null) }
  }, [])

  const value = useMemo(() => ({ appUser, loading, login, registerAdmin, logout }), [appUser, loading, login, registerAdmin, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
