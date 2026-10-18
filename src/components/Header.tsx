// src/components/Header.tsx
import { useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ChevronDown, ChevronRight, LogOut, Settings } from "lucide-react"
import { useAuth } from "../hooks/useAuth"
import { useConfirm } from "../contexts/ConfirmContext"
import ThemeToggle from "./ThemeToggle"

interface HeaderProps {
  userLabel: string
  /** Si fourni, affiche le bouton hamburger (mobile uniquement) pour ouvrir le sidebar. */
  onMenuClick?: () => void
  /** "simple" (défaut) : en-tête d'origine (espace salarié). "admin" : fil d'Ariane + menu de compte. */
  variant?: "simple" | "admin"
  /** Variante admin : titre de la page courante. */
  title?: string
  /** Variante admin : section parente (ex. « Équipe »). */
  section?: string
  /** Variante admin : lien « Paramètres » dans le menu de compte. */
  settingsPath?: string
}

const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
)

function initialsOf(label: string) {
  const base = label.includes("@") ? label.split("@")[0] : label
  const letters = base.replace(/[^A-Za-zÀ-ÿ0-9]/g, "")
  return (letters.slice(0, 2) || "?").toUpperCase()
}

function useLogout() {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { logout } = useAuth()
  return async () => {
    if (!(await confirm({ title: "Se déconnecter ?", message: "Vous devrez vous reconnecter pour accéder à votre compte.", confirmLabel: "Déconnexion", tone: "danger" }))) return
    await logout()
    navigate("/login")
  }
}

/** Menu de compte : identité, paramètres, mode sombre et déconnexion. */
function UserMenu({ userLabel, settingsPath }: { userLabel: string; settingsPath?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const doLogout = useLogout()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("touchstart", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("touchstart", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const initials = initialsOf(userLabel)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu du compte"
        className={`flex items-center gap-2.5 rounded-xl border py-1.5 pl-1.5 pr-2.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
          open ? "border-primary-300 bg-primary-50" : "border-slate-200 bg-white hover:bg-slate-50"
        }`}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-600 to-indigo-600 text-xs font-bold text-white">
          {initials}
        </span>
        <span className="hidden max-w-[180px] text-left leading-tight sm:block">
          <span className="block truncate text-sm font-semibold text-slate-800">{userLabel}</span>
          <span className="block text-[11px] font-medium text-slate-500">Administrateur</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
          <div className="flex items-center gap-3 px-3 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-indigo-600 text-sm font-bold text-white">
              {initials}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-slate-900">{userLabel}</p>
              <p className="text-xs text-slate-500">Administrateur</p>
            </div>
          </div>

          <div className="my-1 border-t border-slate-100" />

          {settingsPath && (
            <Link
              to={settingsPath}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <Settings className="h-4 w-4" aria-hidden="true" /> Paramètres
            </Link>
          )}
          <div className="rounded-lg px-3 py-2 text-slate-700"><ThemeToggle /></div>

          <div className="my-1 border-t border-slate-100" />

          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); void doLogout() }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" /> Se déconnecter
          </button>
        </div>
      )}
    </div>
  )
}

export default function Header({ userLabel, onMenuClick, variant = "simple", title, section, settingsPath }: HeaderProps) {
  const doLogout = useLogout()

  // Variante admin : fil d'Ariane + menu de compte.
  if (variant === "admin") {
    return (
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b bg-white/90 px-4 backdrop-blur md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              aria-label="Ouvrir le menu"
              className="-ml-1 rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden"
            >
              <MenuIcon />
            </button>
          )}
          {title && (
            <nav aria-label="Fil d'Ariane" className="flex min-w-0 items-center gap-1.5 text-sm">
              {section && (
                <>
                  <span className="hidden text-slate-500 sm:inline">{section}</span>
                  <ChevronRight className="hidden h-3.5 w-3.5 text-slate-400 sm:block" aria-hidden="true" />
                </>
              )}
              <span aria-current="page" className="truncate font-semibold text-slate-900">{title}</span>
            </nav>
          )}
        </div>
        <UserMenu userLabel={userLabel} settingsPath={settingsPath} />
      </header>
    )
  }

  // Variante simple : en-tête d'origine (espace salarié), inchangé.
  return (
    <header className="flex items-center justify-between bg-white border-b px-4 md:px-6 py-3 sticky top-0 z-40">
      <div className="flex items-center gap-2">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            aria-label="Ouvrir le menu"
            className="md:hidden -ml-1 p-2 rounded-lg text-gray-600 hover:bg-gray-100"
          >
            <MenuIcon />
          </button>
        )}
        <div className="font-medium text-gray-700">{userLabel}</div>
      </div>
      <button
        onClick={() => void doLogout()}
        className="text-sm text-gray-500 hover:text-red-600 transition"
      >
        Déconnexion
      </button>
    </header>
  )
}


// // src/components/Header.tsx
// import { useNavigate } from "react-router-dom"
// import { useAuth } from "../hooks/useAuth"
// import { useConfirm } from "../contexts/ConfirmContext"

// interface HeaderProps {
//   userLabel: string
//   /** Si fourni, affiche le bouton hamburger (mobile uniquement) pour ouvrir le sidebar. */
//   onMenuClick?: () => void
// }

// export default function Header({ userLabel, onMenuClick }: HeaderProps) {
//   const navigate = useNavigate()
//   const confirm = useConfirm()
//   const { logout } = useAuth()
//   return (
//     <header className="flex items-center justify-between bg-white border-b px-4 md:px-6 py-3 sticky top-0 z-40">
//       <div className="flex items-center gap-2">
//         {onMenuClick && (
//           <button
//             onClick={onMenuClick}
//             aria-label="Ouvrir le menu"
//             className="md:hidden -ml-1 p-2 rounded-lg text-gray-600 hover:bg-gray-100"
//           >
//             <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
//               <line x1="3" y1="6" x2="21" y2="6" />
//               <line x1="3" y1="12" x2="21" y2="12" />
//               <line x1="3" y1="18" x2="21" y2="18" />
//             </svg>
//           </button>
//         )}
//         <div className="font-medium text-gray-700">{userLabel}</div>
//       </div>
//       <button
//         onClick={async () => {
//           if (!(await confirm({ title: "Se déconnecter ?", message: "Vous devrez vous reconnecter pour accéder à votre compte.", confirmLabel: "Déconnexion", tone: "danger" }))) return
//           await logout()
//           navigate("/login")
//         }}
//         className="text-sm text-gray-500 hover:text-red-600 transition"
//       >
//         Déconnexion
//       </button>
//     </header>
//   )
// }
