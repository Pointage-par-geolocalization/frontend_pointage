// src/routes/ProtectedRoute.tsx
// Contrôle d'affichage seulement : la vraie sécurité est appliquée par l'API sur chaque requête.
import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import type { Role } from "../services/auth"

export default function ProtectedRoute({ allow }: { allow: Role }) {
  const { appUser, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-500">
        Chargement...
      </div>
    )
  }

  if (!appUser) {
    return <Navigate to="/login" replace />
  }

  if (appUser.role !== allow) {
    return <Navigate to={appUser.role === "admin" ? "/admin" : "/employe"} replace />
  }

  return <Outlet />
}
