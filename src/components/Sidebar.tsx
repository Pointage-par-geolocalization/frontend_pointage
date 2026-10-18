// src/components/Sidebar.tsx
// Menu latéral : entrées principales, groupes repliables, recherche rapide (Ctrl+K) et pied de menu épinglé.
import { useEffect, useMemo, useRef, useState } from "react"
import { NavLink, useLocation, useNavigate } from "react-router-dom"
import { ChevronDown, Search, SearchX, ShieldCheck, X, type LucideIcon } from "lucide-react"

export interface NavItem {
  to: string
  label: string
  end?: boolean
  badge?: number
  icon?: LucideIcon
  /** Courte précision affichée au survol (aide à distinguer deux libellés proches). */
  hint?: string
}

export interface NavGroup {
  id: string
  label: string
  items: NavItem[]
  /** Ouvert par défaut lors de la toute première visite. */
  defaultOpen?: boolean
}

interface SidebarProps {
  title: string
  subtitle?: string
  /** Entrées toujours visibles, au-dessus des groupes. */
  primary?: NavItem[]
  groups?: NavGroup[]
  /** Entrées épinglées en bas : jamais cachées par le défilement (ex. Paramètres). */
  footer?: NavItem[]
  /** Sur mobile, le sidebar est un tiroir : ouvert/fermé piloté par le parent. */
  open?: boolean
  onClose?: () => void
}

const STORAGE_KEY = "sidebar:groups"

const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
const matches = (item: NavItem, pathname: string) =>
  item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + "/")
const sumBadges = (items: NavItem[]) => items.reduce((n, i) => n + (i.badge ?? 0), 0)

function readSaved(): Record<string, boolean> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : null
  } catch { return null }
}

function Badge({ count }: { count: number }) {
  return (
    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
      {count > 99 ? "99+" : count}
    </span>
  )
}

function Item({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      title={item.hint}
      className={({ isActive }) =>
        `block rounded-lg px-3 py-2 md:py-1.5 text-sm font-medium transition ${
          isActive ? "bg-primary-600 text-white shadow-sm" : "text-primary-100 hover:bg-white/10"
        }`
      }
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-3 min-w-0">
          {item.icon && <item.icon size={18} className="shrink-0" aria-hidden="true" />}
          <span className="truncate">{item.label}</span>
        </span>
        {!!item.badge && item.badge > 0 && <Badge count={item.badge} />}
      </span>
    </NavLink>
  )
}

export default function Sidebar({ title, subtitle, primary = [], groups = [], footer = [], open = false, onClose }: SidebarProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")

  // Groupes ouverts : mémorisés ; à la première visite, ceux marqués defaultOpen.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const saved = readSaved()
    if (saved) return saved
    return Object.fromEntries(groups.map((g) => [g.id, !!g.defaultOpen]))
  })

  // Le groupe de la page courante est toujours ouvert (on ne perd jamais l'utilisateur).
  useEffect(() => {
    const active = groups.find((g) => g.items.some((i) => matches(i, pathname)))
    if (active && !openGroups[active.id]) setOpenGroups((s) => ({ ...s, [active.id]: true }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups)) } catch { /* ignore */ }
  }, [openGroups])

  // Raccourci Ctrl/⌘ + K : met le focus sur la recherche.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  const allItems = useMemo(
    () => [...primary, ...groups.flatMap((g) => g.items), ...footer],
    [primary, groups, footer],
  )
  const q = normalize(query.trim())
  const results = q ? allItems.filter((i) => normalize(i.label).includes(q)) : []
  const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform)

  const closeAfterNav = () => { setQuery(""); onClose?.() }

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
        className={`fixed md:sticky top-0 left-0 z-40 md:z-auto h-screen h-dvh w-64 flex flex-col
          bg-primary-900 text-white transition-transform duration-200 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        {/* Marque */}
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-black/20">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-[13px] font-bold tracking-tight">{title}</p>
            {subtitle && <p className="text-[11px] font-medium text-primary-200">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer le menu"
            className="md:hidden p-1 rounded-lg text-primary-200 hover:text-white hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Recherche rapide */}
        <div className="px-3 pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-200" aria-hidden="true" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setQuery(""); e.currentTarget.blur() }
                if (e.key === "Enter" && results[0]) { navigate(results[0].to); closeAfterNav() }
              }}
              placeholder="Aller à…"
              aria-label="Rechercher une page"
              autoComplete="off"
              className="w-full rounded-lg border border-white/10 bg-white/10 py-2 pl-9 pr-12 text-sm text-white placeholder:text-primary-200 focus:border-primary-400 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-primary-400/40"
            />
            {query ? (
              <button
                type="button"
                onClick={() => { setQuery(""); searchRef.current?.focus() }}
                aria-label="Effacer la recherche"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-primary-200 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-white/15 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-primary-200 md:block">
                {isMac ? "⌘K" : "Ctrl K"}
              </kbd>
            )}
          </div>
        </div>

        {/* Navigation (la barre de défilement n'apparaît que si nécessaire) */}
        <nav aria-label="Navigation principale" className="sidebar-scroll flex-1 overflow-y-auto px-3 py-2.5">
          {q ? (
            <div className="space-y-1">
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-primary-200">
                {results.length} résultat{results.length > 1 ? "s" : ""}
              </p>
              {results.map((item) => <Item key={item.to} item={item} onClick={closeAfterNav} />)}
              {results.length === 0 && (
                <div className="flex flex-col items-center gap-2 px-3 py-8 text-center text-sm text-primary-200">
                  <SearchX className="h-6 w-6" aria-hidden="true" />
                  Aucune page ne correspond à « {query.trim()} ».
                </div>
              )}
            </div>
          ) : (
            <>
              {primary.length > 0 && (
                <div className="space-y-1">
                  {primary.map((item) => <Item key={item.to} item={item} onClick={onClose} />)}
                </div>
              )}

              {groups.map((g) => {
                const isOpen = !!openGroups[g.id]
                const pending = sumBadges(g.items)
                return (
                  <div key={g.id} className="mt-3">
                    <button
                      type="button"
                      onClick={() => setOpenGroups((s) => ({ ...s, [g.id]: !s[g.id] }))}
                      aria-expanded={isOpen}
                      aria-controls={`nav-group-${g.id}`}
                      className="group flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary-200 transition hover:text-white"
                    >
                      <span>{g.label}</span>
                      <span className="flex items-center gap-1.5">
                        {/* Groupe replié : on garde visible le nombre d'éléments à traiter */}
                        {!isOpen && pending > 0 && <Badge count={pending} />}
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "" : "-rotate-90"}`} aria-hidden="true" />
                      </span>
                    </button>
                    {isOpen && (
                      <div id={`nav-group-${g.id}`} className="mt-1 space-y-1">
                        {g.items.map((item) => <Item key={item.to} item={item} onClick={onClose} />)}
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </nav>

        {/* Pied épinglé : toujours visible */}
        {footer.length > 0 && (
          <div className="space-y-1 border-t border-white/10 px-3 py-2.5">
            {footer.map((item) => <Item key={item.to} item={item} onClick={onClose} />)}
          </div>
        )}
      </aside>
    </>
  )
}



// // src/components/Sidebar.tsx
// import { NavLink } from "react-router-dom"
// import type { LucideIcon } from "lucide-react"

// interface NavItem { to: string; label: string; end?: boolean; badge?: number; icon?: LucideIcon }

// interface SidebarProps {
//   title: string
//   items: NavItem[]
//   /** Sur mobile, le sidebar est un tiroir : ouvert/fermé piloté par le parent. */
//   open?: boolean
//   onClose?: () => void
// }

// export default function Sidebar({ title, items, open = false, onClose }: SidebarProps) {
//   return (
//     <>
//       {/* Fond sombre derrière le tiroir, mobile uniquement, visible seulement si ouvert */}
//       {open && (
//         <div
//           onClick={onClose}
//           aria-hidden="true"
//           className="fixed inset-0 z-30 bg-black/50 md:hidden"
//         />
//       )}

//       <aside data-sidebar style={{ zIndex: 9999 }}
//         className={`fixed md:sticky top-0 left-0 z-40 md:z-auto h-screen w-64 flex flex-col
//           bg-primary-900 text-white transition-transform duration-200 ease-in-out
//           ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
//        >
//         <div className="px-6 py-5 text-lg font-semibold border-b border-white/10 flex items-center justify-between">
//           {title}
//           <button
//             onClick={onClose}
//             aria-label="Fermer le menu"
//             className="md:hidden text-primary-200 hover:text-white text-xl leading-none"
//           >
//             ✕
//           </button>
//         </div>
//         <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
//           {items.map((item) => (
//             <NavLink
//               key={item.to}
//               to={item.to}
//               end={item.end}
//               onClick={onClose}
//               className={({ isActive }) =>
//                 `block rounded-lg px-3 py-2 text-sm font-medium transition ${
//                   isActive ? "bg-primary-600 text-white"  : "text-primary-100 hover:bg-white/10"
//                 }`
//               }
//             >
//               <span className="flex items-center justify-between gap-2">
//                 <span className="flex items-center gap-3 min-w-0">
//                   {item.icon && <item.icon size={18} className="shrink-0" aria-hidden="true" />}
//                   <span className="truncate">{item.label}</span>
//                 </span>
//                 {!!item.badge && item.badge > 0 && (
//                   <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center">
//                     {item.badge > 99 ? "99+" : item.badge}
//                   </span>
//                 )}
//               </span>
//             </NavLink>
//           ))}
//         </nav>
//       </aside>
//     </>
//   )
// }
