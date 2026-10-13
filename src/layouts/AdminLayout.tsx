// src/layouts/AdminLayout.tsx
import { Suspense, useEffect, useState } from "react"
import { Outlet } from "react-router-dom"
import {
  LayoutDashboard, Users, CalendarCheck, Map, Wallet, MessageCircle, Package, FileText, MapPin, Settings,
  HardHat, CalendarClock, Radar, Receipt, Building, ScrollText,
} from "lucide-react"
import Sidebar from "../components/Sidebar"
import Header from "../components/Header"
import { useAuth } from "../hooks/useAuth"
import PageLoading from "../components/PageLoading"
import { ChatProvider, useChat } from "../contexts/ChatContext"
import { subscribePendingCount } from "../services/equipment"
import { subscribePendingLeaves } from "../services/leaves"

const items = [
  { to: "/admin", label: "Dashboard", end: true, icon: LayoutDashboard },
  { to: "/admin/salaries-personnel", label: "Salariés", icon: Users },
  { to: "/admin/presences", label: "Présences", icon: CalendarCheck },
  { to: "/admin/controles", label: "Contrôles de présence", icon: Radar },
  { to: "/admin/carte", label: "Carte", icon: Map },
  { to: "/admin/chantiers", label: "Chantiers", icon: HardHat },
  { to: "/admin/permissions", label: "Permissions", icon: CalendarClock },
  { to: "/admin/remunerations", label: "Rémunérations", icon: Wallet },
  { to: "/admin/documents", label: "Devis & factures", icon: Receipt },
  { to: "/admin/clients", label: "Clients", icon: Building },
  { to: "/admin/discussions", label: "Discussions", icon: MessageCircle },
  { to: "/admin/materiel", label: "Matériel", icon: Package },
  { to: "/admin/rapports", label: "Rapports", icon: FileText },
  { to: "/admin/lieux", label: "Lieux de travail", icon: MapPin },
  { to: "/admin/journal", label: "Journal", icon: ScrollText },
  { to: "/admin/parametres", label: "Paramètres", icon: Settings },
]

function AdminShell() {
  const { appUser } = useAuth()
  const { unreadTotal } = useChat()
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

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar title="Administration" items={items.map((i) => ({ ...i, badge: badges[i.to] }))} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header userLabel={appUser?.email ?? "Administrateur"} onMenuClick={() => setSidebarOpen(true)} />
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
