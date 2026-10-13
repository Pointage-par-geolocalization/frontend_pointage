// src/components/Sidebar.tsx
import { NavLink } from "react-router-dom"
import type { LucideIcon } from "lucide-react"

interface NavItem { to: string; label: string; end?: boolean; badge?: number; icon?: LucideIcon }

interface SidebarProps {
  title: string
  items: NavItem[]
  /** Sur mobile, le sidebar est un tiroir : ouvert/fermé piloté par le parent. */
  open?: boolean
  onClose?: () => void
}

export default function Sidebar({ title, items, open = false, onClose }: SidebarProps) {
  return (
    <>
      {/* Fond sombre derrière le tiroir, mobile uniquement, visible seulement si ouvert */}
      {open && (
        <div
          onClick={onClose}
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
        />
      )}

      <aside data-sidebar style={{ zIndex: 9999 }}
        className={`fixed md:sticky top-0 left-0 z-40 md:z-auto h-screen w-64 flex flex-col
          bg-primary-900 text-white transition-transform duration-200 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
       >
        <div className="px-6 py-5 text-lg font-semibold border-b border-white/10 flex items-center justify-between">
          {title}
          <button
            onClick={onClose}
            aria-label="Fermer le menu"
            className="md:hidden text-primary-200 hover:text-white text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? "bg-primary-600 text-white"  : "text-primary-100 hover:bg-white/10"
                }`
              }
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-3 min-w-0">
                  {item.icon && <item.icon size={18} className="shrink-0" aria-hidden="true" />}
                  <span className="truncate">{item.label}</span>
                </span>
                {!!item.badge && item.badge > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}