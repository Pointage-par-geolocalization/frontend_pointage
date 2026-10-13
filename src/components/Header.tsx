// src/components/Header.tsx
import { useNavigate } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import { useConfirm } from "../contexts/ConfirmContext"

interface HeaderProps {
  userLabel: string
  /** Si fourni, affiche le bouton hamburger (mobile uniquement) pour ouvrir le sidebar. */
  onMenuClick?: () => void
}

export default function Header({ userLabel, onMenuClick }: HeaderProps) {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { logout } = useAuth()
  return (
    <header className="flex items-center justify-between bg-white border-b px-4 md:px-6 py-3 sticky top-0 z-40">
      <div className="flex items-center gap-2">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            aria-label="Ouvrir le menu"
            className="md:hidden -ml-1 p-2 rounded-lg text-gray-600 hover:bg-gray-100"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}
        <div className="font-medium text-gray-700">{userLabel}</div>
      </div>
      <button
        onClick={async () => {
          if (!(await confirm({ title: "Se déconnecter ?", message: "Vous devrez vous reconnecter pour accéder à votre compte.", confirmLabel: "Déconnexion", tone: "danger" }))) return
          await logout()
          navigate("/login")
        }}
        className="text-sm text-gray-500 hover:text-red-600 transition"
      >
        Déconnexion
      </button>
    </header>
  )
}