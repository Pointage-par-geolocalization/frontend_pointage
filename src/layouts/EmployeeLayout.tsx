// src/layouts/EmployeeLayout.tsx
import { Suspense, useEffect, useRef, useState } from "react"
import { Outlet, NavLink, useLocation } from "react-router-dom"
import Header from "../components/Header"
import Toast from "../components/Toast"
import { useAuth } from "../hooks/useAuth"
import PageLoading from "../components/PageLoading"
import { usePresenceTracker } from "../hooks/usePresenceTracker"
import { ChatProvider, useChat } from "../contexts/ChatContext"
import { subscribeMyLeaves, LEAVE_STATUS, LEAVE_TYPES, type LeaveRequest } from "../services/leaves"
import { notify } from "../services/notify"
import { Home, History, Wallet, User, RotateCw, MessageCircle, Package, MoreHorizontal, CalendarClock, ClipboardCheck, TrendingUp } from "lucide-react"

// 4 onglets principaux dans la barre du bas ; le reste est dans le menu « Plus » (⋯).
const tabs = [
  { to: "/employe", label: "Accueil", end: true, icon: Home },
  { to: "/employe/discussions", label: "Discussions", icon: MessageCircle },
  { to: "/employe/materiel", label: "Matériel", icon: Package },
  { to: "/employe/remuneration", label: "Salaire", icon: Wallet },
]
const moreTabs = [
  { to: "/employe/permissions", label: "Permissions", icon: CalendarClock },
  { to: "/employe/timesheet", label: "Timesheet CDI", icon: ClipboardCheck },
  { to: "/employe/ponctualite", label: "Ponctualité", icon: TrendingUp },
  { to: "/employe/historique", label: "Historique", icon: History },
  { to: "/employe/profil", label: "Profil", icon: User },
]

const isUnseenDecision = (l: LeaveRequest) => (l.status === "ACCEPTEE" || l.status === "REFUSEE") && !l.employeeSeenAt

/** Décisions sur mes permissions pas encore consultées (badge) + notification si l'application est en arrière-plan. */
function useLeaveDecisions(enabled: boolean) {
  const [unseen, setUnseen] = useState(0)
  const notified = useRef<Set<string> | null>(null)
  useEffect(() => {
    if (!enabled) return
    return subscribeMyLeaves((list) => {
      const fresh = list.filter(isUnseenDecision)
      setUnseen(fresh.length)
      if (notified.current === null) { notified.current = new Set(fresh.map((l) => l.id)); return } // déjà là à l'ouverture
      for (const l of fresh) {
        if (notified.current.has(l.id)) continue
        notified.current.add(l.id)
        if (document.hidden) {
          notify({
            key: `leave-${l.id}`, channel: "alerts", route: "/employe/permissions",
            title: `Permission ${LEAVE_STATUS[l.status].label.toLowerCase()}`,
            body: `${LEAVE_TYPES[l.type]} du ${l.startDate.split("-").reverse().join("/")}${l.decisionNote ? ` — ${l.decisionNote}` : ""}`,
          })
        }
      }
    })
  }, [enabled])
  return unseen
}

function EmployeeShell() {
  const { appUser } = useAuth()
  const { unreadTotal } = useChat()
  const unseenLeaves = useLeaveDecisions(!!appUser)
  const { lastResult, clearResult } = usePresenceTracker(!!appUser)
  // Messagerie : plein écran (entre l'en-tête et la barre du bas), sans carte ni marges.
  const { pathname } = useLocation()
  const inChat = pathname.startsWith("/employe/discussions")
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const moreActive = moreTabs.some((t) => pathname.startsWith(t.to))

  useEffect(() => { setMoreOpen(false) }, [pathname])
  useEffect(() => {
    if (!moreOpen) return
    const close = (e: MouseEvent | TouchEvent) => { if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false) }
    document.addEventListener("mousedown", close)
    document.addEventListener("touchstart", close)
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("touchstart", close) }
  }, [moreOpen])

  function handleRefresh() {
    window.location.reload()
  }

  return (
    <div className={`${inChat ? "h-[100dvh] overflow-hidden" : "min-h-screen"} bg-slate-50 flex flex-col antialiased selection:bg-primary-500 selection:text-white`}>
      
      {/* En-tête professionnel */}
      <Header userLabel={appUser?.employeeCode ?? "Salarié"} />

      {/* Contenu principal avec une marge en bas importante pour ne pas être caché par la barre fixe */}
      <main className={inChat ? "flex-1 min-h-0 w-full pb-[4.5rem]" : "flex-1 p-4 sm:p-8 pb-32 max-w-xl mx-auto w-full"}>
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Barre de navigation toujours fixe en bas, visible sur tous les écrans */}
      <nav aria-label="Navigation principale" className={`fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-200/80 px-1.5 py-2 flex items-center shadow-2xl z-50 ${inChat ? "" : "max-w-xl mx-auto sm:rounded-t-2xl"}`}>
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex-1 min-w-0 flex flex-col items-center justify-center py-1.5 px-0 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? "text-primary-600 bg-primary-50/80 font-semibold" 
                    : "text-slate-400 hover:text-slate-600 font-medium"
                }`
              }
            >
              <span className="relative">
                <Icon className="w-5 h-5 mb-1" />
                {t.to === "/employe/discussions" && unreadTotal > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none flex items-center justify-center ring-2 ring-white">
                    {unreadTotal > 99 ? "99+" : unreadTotal}
                  </span>
                )}
              </span>
              <span className="text-[10px] tracking-tight truncate max-w-full">{t.label}</span>
            </NavLink>
          )
        })}

        {/* Menu « Plus » : pages secondaires + bouton Actualiser */}
        <div ref={moreRef} className="relative flex-1 min-w-0 flex">
          <button
            onClick={() => setMoreOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1.5 rounded-xl transition-all duration-200 ${
              moreOpen || moreActive ? "text-primary-600 bg-primary-50/80 font-semibold" : "text-slate-400 hover:text-slate-600 font-medium"}`}
          >
            <span className="relative">
              <MoreHorizontal className="w-5 h-5 mb-1" />
              {unseenLeaves > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none flex items-center justify-center ring-2 ring-white">
                  {unseenLeaves}
                </span>
              )}
            </span>
            <span className="text-[10px] tracking-tight">Plus</span>
          </button>

          {moreOpen && (
            <div role="menu" className="absolute bottom-full right-0 mb-3 w-52 bg-white border border-slate-200 rounded-2xl shadow-2xl py-1.5 overflow-hidden">
              {moreTabs.map((t) => {
                const Icon = t.icon
                return (
                  <NavLink key={t.to} to={t.to} role="menuitem"
                    className={({ isActive }) => `flex items-center gap-3 px-4 py-3 text-sm transition ${
                      isActive ? "bg-primary-50 text-primary-700 font-semibold" : "text-slate-700 hover:bg-slate-50"}`}>
                    <Icon className="w-5 h-5" /><span className="flex-1">{t.label}</span>
                    {t.to === "/employe/permissions" && unseenLeaves > 0 && (
                      <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center">{unseenLeaves}</span>
                    )}
                  </NavLink>
                )
              })}
              <div className="my-1 border-t border-slate-100" />
              <button role="menuitem" onClick={handleRefresh}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition">
                <RotateCw className="w-5 h-5" />Actualiser
              </button>
            </div>
          )}
        </div>
      </nav>

      {lastResult && !lastResult.withinRadius && (
        <Toast
          tone="error"
          message={`Attention : vous semblez hors de la zone de « ${lastResult.departmentName} » (${lastResult.distance} m, rayon autorisé ${lastResult.radiusMeters} m).`}
          onClose={clearResult}
        />
      )}
    </div>
  )
}

export default function EmployeeLayout() {
  return (
    <ChatProvider>
      <EmployeeShell />
    </ChatProvider>
  )
}


// // src/layouts/EmployeeLayout.tsx
// import { Suspense, useEffect, useRef, useState } from "react"
// import { Outlet, NavLink, useLocation } from "react-router-dom"
// import Header from "../components/Header"
// import Toast from "../components/Toast"
// import { useAuth } from "../hooks/useAuth"
// import PageLoading from "../components/PageLoading"
// import { usePresenceTracker } from "../hooks/usePresenceTracker"
// import { ChatProvider, useChat } from "../contexts/ChatContext"
// import { subscribeMyLeaves, LEAVE_STATUS, LEAVE_TYPES, type LeaveRequest } from "../services/leaves"
// import { notify } from "../services/notify"
// import { Home, History, Wallet, User, RotateCw, MessageCircle, Package, MoreHorizontal, CalendarClock } from "lucide-react"

// // 4 onglets principaux dans la barre du bas ; le reste est dans le menu « Plus » (⋯).
// const tabs = [
//   { to: "/employe", label: "Accueil", end: true, icon: Home },
//   { to: "/employe/discussions", label: "Discussions", icon: MessageCircle },
//   { to: "/employe/materiel", label: "Matériel", icon: Package },
//   { to: "/employe/remuneration", label: "Salaire", icon: Wallet },
// ]
// const moreTabs = [
//   { to: "/employe/permissions", label: "Permissions", icon: CalendarClock },
//   { to: "/employe/historique", label: "Historique", icon: History },
//   { to: "/employe/profil", label: "Profil", icon: User },
// ]

// const isUnseenDecision = (l: LeaveRequest) => (l.status === "ACCEPTEE" || l.status === "REFUSEE") && !l.employeeSeenAt

// /** Décisions sur mes permissions pas encore consultées (badge) + notification si l'application est en arrière-plan. */
// function useLeaveDecisions(enabled: boolean) {
//   const [unseen, setUnseen] = useState(0)
//   const notified = useRef<Set<string> | null>(null)
//   useEffect(() => {
//     if (!enabled) return
//     return subscribeMyLeaves((list) => {
//       const fresh = list.filter(isUnseenDecision)
//       setUnseen(fresh.length)
//       if (notified.current === null) { notified.current = new Set(fresh.map((l) => l.id)); return } // déjà là à l'ouverture
//       for (const l of fresh) {
//         if (notified.current.has(l.id)) continue
//         notified.current.add(l.id)
//         if (document.hidden) {
//           notify({
//             key: `leave-${l.id}`, channel: "alerts", route: "/employe/permissions",
//             title: `Permission ${LEAVE_STATUS[l.status].label.toLowerCase()}`,
//             body: `${LEAVE_TYPES[l.type]} du ${l.startDate.split("-").reverse().join("/")}${l.decisionNote ? ` — ${l.decisionNote}` : ""}`,
//           })
//         }
//       }
//     })
//   }, [enabled])
//   return unseen
// }

// function EmployeeShell() {
//   const { appUser } = useAuth()
//   const { unreadTotal } = useChat()
//   const unseenLeaves = useLeaveDecisions(!!appUser)
//   const { lastResult, clearResult } = usePresenceTracker(!!appUser)
//   // Messagerie : plein écran (entre l'en-tête et la barre du bas), sans carte ni marges.
//   const { pathname } = useLocation()
//   const inChat = pathname.startsWith("/employe/discussions")
//   const [moreOpen, setMoreOpen] = useState(false)
//   const moreRef = useRef<HTMLDivElement>(null)
//   const moreActive = moreTabs.some((t) => pathname.startsWith(t.to))

//   useEffect(() => { setMoreOpen(false) }, [pathname])
//   useEffect(() => {
//     if (!moreOpen) return
//     const close = (e: MouseEvent | TouchEvent) => { if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false) }
//     document.addEventListener("mousedown", close)
//     document.addEventListener("touchstart", close)
//     return () => { document.removeEventListener("mousedown", close); document.removeEventListener("touchstart", close) }
//   }, [moreOpen])

//   function handleRefresh() {
//     window.location.reload()
//   }

//   return (
//     <div className={`${inChat ? "h-[100dvh] overflow-hidden" : "min-h-screen"} bg-slate-50 flex flex-col antialiased selection:bg-primary-500 selection:text-white`}>
      
//       {/* En-tête professionnel */}
//       <Header userLabel={appUser?.employeeCode ?? "Salarié"} />

//       {/* Contenu principal avec une marge en bas importante pour ne pas être caché par la barre fixe */}
//       <main className={inChat ? "flex-1 min-h-0 w-full pb-[4.5rem]" : "flex-1 p-4 sm:p-8 pb-32 max-w-xl mx-auto w-full"}>
//         <Suspense fallback={<PageLoading />}>
//           <Outlet />
//         </Suspense>
//       </main>

//       {/* Barre de navigation toujours fixe en bas, visible sur tous les écrans */}
//       <nav aria-label="Navigation principale" className={`fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-200/80 px-1.5 py-2 flex items-center shadow-2xl z-50 ${inChat ? "" : "max-w-xl mx-auto sm:rounded-t-2xl"}`}>
//         {tabs.map((t) => {
//           const Icon = t.icon
//           return (
//             <NavLink
//               key={t.to}
//               to={t.to}
//               end={t.end}
//               className={({ isActive }) =>
//                 `flex-1 min-w-0 flex flex-col items-center justify-center py-1.5 px-0 rounded-xl transition-all duration-200 ${
//                   isActive 
//                     ? "text-primary-600 bg-primary-50/80 font-semibold" 
//                     : "text-slate-400 hover:text-slate-600 font-medium"
//                 }`
//               }
//             >
//               <span className="relative">
//                 <Icon className="w-5 h-5 mb-1" />
//                 {t.to === "/employe/discussions" && unreadTotal > 0 && (
//                   <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none flex items-center justify-center ring-2 ring-white">
//                     {unreadTotal > 99 ? "99+" : unreadTotal}
//                   </span>
//                 )}
//               </span>
//               <span className="text-[10px] tracking-tight truncate max-w-full">{t.label}</span>
//             </NavLink>
//           )
//         })}

//         {/* Menu « Plus » : pages secondaires + bouton Actualiser */}
//         <div ref={moreRef} className="relative flex-1 min-w-0 flex">
//           <button
//             onClick={() => setMoreOpen((v) => !v)}
//             aria-haspopup="menu"
//             aria-expanded={moreOpen}
//             className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1.5 rounded-xl transition-all duration-200 ${
//               moreOpen || moreActive ? "text-primary-600 bg-primary-50/80 font-semibold" : "text-slate-400 hover:text-slate-600 font-medium"}`}
//           >
//             <span className="relative">
//               <MoreHorizontal className="w-5 h-5 mb-1" />
//               {unseenLeaves > 0 && (
//                 <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none flex items-center justify-center ring-2 ring-white">
//                   {unseenLeaves}
//                 </span>
//               )}
//             </span>
//             <span className="text-[10px] tracking-tight">Plus</span>
//           </button>

//           {moreOpen && (
//             <div role="menu" className="absolute bottom-full right-0 mb-3 w-52 bg-white border border-slate-200 rounded-2xl shadow-2xl py-1.5 overflow-hidden">
//               {moreTabs.map((t) => {
//                 const Icon = t.icon
//                 return (
//                   <NavLink key={t.to} to={t.to} role="menuitem"
//                     className={({ isActive }) => `flex items-center gap-3 px-4 py-3 text-sm transition ${
//                       isActive ? "bg-primary-50 text-primary-700 font-semibold" : "text-slate-700 hover:bg-slate-50"}`}>
//                     <Icon className="w-5 h-5" /><span className="flex-1">{t.label}</span>
//                     {t.to === "/employe/permissions" && unseenLeaves > 0 && (
//                       <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center">{unseenLeaves}</span>
//                     )}
//                   </NavLink>
//                 )
//               })}
//               <div className="my-1 border-t border-slate-100" />
//               <button role="menuitem" onClick={handleRefresh}
//                 className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition">
//                 <RotateCw className="w-5 h-5" />Actualiser
//               </button>
//             </div>
//           )}
//         </div>
//       </nav>

//       {lastResult && !lastResult.withinRadius && (
//         <Toast
//           tone="error"
//           message={`Attention : vous semblez hors de la zone de « ${lastResult.departmentName} » (${lastResult.distance} m, rayon autorisé ${lastResult.radiusMeters} m).`}
//           onClose={clearResult}
//         />
//       )}
//     </div>
//   )
// }

// export default function EmployeeLayout() {
//   return (
//     <ChatProvider>
//       <EmployeeShell />
//     </ChatProvider>
//   )
// }
