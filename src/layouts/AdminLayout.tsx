// src/layouts/AdminLayout.tsx
import { Suspense, useEffect, useMemo, useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import {
  LayoutDashboard, Users, CalendarCheck, Map, Wallet, MessageCircle, Package, FileText, MapPin, Settings,
  HardHat, CalendarClock, Radar, Receipt, Building, ScrollText,
} from "lucide-react"
import Sidebar, { type NavGroup, type NavItem } from "../components/Sidebar"
import Header from "../components/Header"
import { useAuth } from "../hooks/useAuth"
import PageLoading from "../components/PageLoading"
import { ChatProvider, useChat } from "../contexts/ChatContext"
import { subscribePendingCount } from "../services/equipment"
import { subscribePendingLeaves } from "../services/leaves"

// Entrées toujours visibles (les plus utilisées).
const primary: NavItem[] = [
  { to: "/admin", label: "Dashboard", end: true, icon: LayoutDashboard },
  { to: "/admin/discussions", label: "Discussions", icon: MessageCircle },
]

// Le reste est regroupé par thème : on retrouve une page par son domaine, pas dans une liste de 16 lignes.
const groups: NavGroup[] = [
  {
    id: "equipe", label: "Équipe", defaultOpen: true,
    items: [
      { to: "/admin/salaries-personnel", label: "Salariés", icon: Users },
      { to: "/admin/presences", label: "Présences", icon: CalendarCheck, hint: "Pointages d'entrée et de sortie" },
      { to: "/admin/controles", label: "Contrôles de présence", icon: Radar, hint: "Vérifications de position sur les chantiers" },
      { to: "/admin/permissions", label: "Permissions", icon: CalendarClock, hint: "Demandes d'absence des salariés" },
    ],
  },
  {
    id: "terrain", label: "Terrain",
    items: [
      { to: "/admin/chantiers", label: "Chantiers", icon: HardHat },
      { to: "/admin/carte", label: "Carte", icon: Map },
      { to: "/admin/lieux", label: "Lieux de travail", icon: MapPin },
      { to: "/admin/materiel", label: "Matériel", icon: Package, hint: "Prêts et demandes de matériel" },
    ],
  },
  {
    id: "finance", label: "Finance & clients",
    items: [
      { to: "/admin/remunerations", label: "Rémunérations", icon: Wallet, hint: "Salaires gagnés et paiements effectués" },
      { to: "/admin/documents", label: "Devis & factures", icon: Receipt },
      { to: "/admin/clients", label: "Clients", icon: Building },
    ],
  },
  {
    id: "suivi", label: "Suivi",
    items: [
      { to: "/admin/rapports", label: "Rapports", icon: FileText },
      { to: "/admin/journal", label: "Journal", icon: ScrollText, hint: "Historique des actions effectuées" },
    ],
  },
]

// Épinglé en bas du menu : toujours accessible, sans défiler.
const footer: NavItem[] = [
  { to: "/admin/parametres", label: "Paramètres", icon: Settings },
]

const isCurrent = (i: NavItem, pathname: string) =>
  i.end ? pathname === i.to : pathname === i.to || pathname.startsWith(i.to + "/")

function AdminShell() {
  const { appUser } = useAuth()
  const { unreadTotal } = useChat()
  const { pathname } = useLocation()
  const [pendingLoans, setPendingLoans] = useState(0)
  const [pendingLeaves, setPendingLeaves] = useState(0)
  useEffect(() => subscribePendingCount(setPendingLoans), [])
  useEffect(() => subscribePendingLeaves(setPendingLeaves), [])
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const badges: Record<string, number> = {
    "/admin/discussions": unreadTotal,
    "/admin/materiel": pendingLoans,
    "/admin/permissions": pendingLeaves,
  }

  const withBadge = (i: NavItem): NavItem => ({ ...i, badge: badges[i.to] })
  const navPrimary = primary.map(withBadge)
  const navGroups = groups.map((g) => ({ ...g, items: g.items.map(withBadge) }))
  const navFooter = footer.map(withBadge)

  // Page courante (titre + section) pour le fil d'Ariane ; la route la plus précise l'emporte.
  const current = useMemo(() => {
    const all = [
      ...primary.map((i) => ({ item: i, section: undefined as string | undefined })),
      ...groups.flatMap((g) => g.items.map((i) => ({ item: i, section: g.label as string | undefined }))),
      ...footer.map((i) => ({ item: i, section: undefined as string | undefined })),
    ]
    return all
      .filter(({ item }) => isCurrent(item, pathname))
      .sort((a, b) => b.item.to.length - a.item.to.length)[0]
  }, [pathname])

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        title="Pointage & Rémunération"
        subtitle="Administration"
        primary={navPrimary}
        groups={navGroups}
        footer={navFooter}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          variant="admin"
          userLabel={appUser?.email ?? "Administrateur"}
          title={current?.item.label}
          section={current?.section}
          settingsPath="/admin/parametres"
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 p-4 md:p-6">
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}

export default function AdminLayout() {
  return (
    <ChatProvider>
      <AdminShell />
    </ChatProvider>
  )
}


// // src/layouts/AdminLayout.tsx
// import { Suspense, useEffect, useState } from "react"
// import { Outlet } from "react-router-dom"
// import {
//   LayoutDashboard, Users, CalendarCheck, Map, Wallet, MessageCircle, Package, FileText, MapPin, Settings,
//   HardHat, CalendarClock, Radar, Receipt, Building, ScrollText,
// } from "lucide-react"
// import Sidebar from "../components/Sidebar"
// import Header from "../components/Header"
// import { useAuth } from "../hooks/useAuth"
// import PageLoading from "../components/PageLoading"
// import { ChatProvider, useChat } from "../contexts/ChatContext"
// import { subscribePendingCount } from "../services/equipment"
// import { subscribePendingLeaves } from "../services/leaves"

// const items = [
//   { to: "/admin", label: "Dashboard", end: true, icon: LayoutDashboard },
//   { to: "/admin/salaries-personnel", label: "Salariés", icon: Users },
//   { to: "/admin/presences", label: "Présences", icon: CalendarCheck },
//   { to: "/admin/controles", label: "Contrôles de présence", icon: Radar },
//   { to: "/admin/carte", label: "Carte", icon: Map },
//   { to: "/admin/chantiers", label: "Chantiers", icon: HardHat },
//   { to: "/admin/permissions", label: "Permissions", icon: CalendarClock },
//   { to: "/admin/remunerations", label: "Rémunérations", icon: Wallet },
//   { to: "/admin/documents", label: "Devis & factures", icon: Receipt },
//   { to: "/admin/clients", label: "Clients", icon: Building },
//   { to: "/admin/discussions", label: "Discussions", icon: MessageCircle },
//   { to: "/admin/materiel", label: "Matériel", icon: Package },
//   { to: "/admin/rapports", label: "Rapports", icon: FileText },
//   { to: "/admin/lieux", label: "Lieux de travail", icon: MapPin },
//   { to: "/admin/journal", label: "Journal", icon: ScrollText },
//   { to: "/admin/parametres", label: "Paramètres", icon: Settings },
// ]

// function AdminShell() {
//   const { appUser } = useAuth()
//   const { unreadTotal } = useChat()
//   const [pendingLoans, setPendingLoans] = useState(0)
//   const [pendingLeaves, setPendingLeaves] = useState(0)
//   useEffect(() => subscribePendingCount(setPendingLoans), [])
//   useEffect(() => subscribePendingLeaves(setPendingLeaves), [])
//   const [sidebarOpen, setSidebarOpen] = useState(false)

//   const badges: Record<string, number> = {
//     "/admin/discussions": unreadTotal,
//     "/admin/materiel": pendingLoans,
//     "/admin/permissions": pendingLeaves,
//   }

//   return (
//     <div className="flex min-h-screen bg-gray-50">
//       <Sidebar title="Administration" items={items.map((i) => ({ ...i, badge: badges[i.to] }))} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
//       <div className="flex-1 flex flex-col min-w-0">
//         <Header userLabel={appUser?.email ?? "Administrateur"} onMenuClick={() => setSidebarOpen(true)} />
//         <main className="flex-1 p-4 md:p-6">
//           <Suspense fallback={<PageLoading />}>
//             <Outlet />
//           </Suspense>
//         </main>
//       </div>
//     </div>
//   )
// }

// export default function AdminLayout() {
//   return (
//     <ChatProvider>
//       <AdminShell />
//     </ChatProvider>
//   )
// }
