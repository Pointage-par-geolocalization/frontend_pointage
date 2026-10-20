// src/components/chat/ChatPage.tsx
// Messagerie partagée admin / salarié : liste des conversations + fil de discussion.
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "../../hooks/useAuth"
import { listEmployees, employeeName, type Employee } from "../../services/employees"
import { createGroup, openDirectChat, joinGroup, leaveGroup, type Chat } from "../../services/chat"
import { errorMessage } from "../../services/api"
import { millis } from "../../utils/format"
import { useChat } from "../../contexts/ChatContext"
import { useConfirm } from "../../contexts/ConfirmContext"
import Dropdown from "../Dropdown"
import Toast from "../Toast"
import ChatConversation from "./ChatConversation"
import { Users, User, Plus, Hash, Megaphone, X, MessageCircle, LogIn } from "lucide-react"

type Role = "admin" | "employee"

interface Props { role: Role; heightClass: string }

export function chatTitle(chat: Chat, role: Role) {
  if (chat.type === "group") return chat.name
  return role === "admin" ? (chat.directEmployeeName ?? "Salarié") : "Administrateur"
}

const fmt = (c: Chat) => {
  if (!c.lastMessageAt) return ""
  const t = new Date(c.lastMessageAt)
  const today = new Date().toDateString() === t.toDateString()
  return today ? t.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : t.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })
}

export default function ChatPage({ role, heightClass }: Props) {
  const { appUser } = useAuth()
  const uid = appUser?.id ?? ""
  const isAdmin = role === "admin"
  const confirm = useConfirm()

  const { chats, loaded, error: loadError, unreadFor, markRead } = useChat()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showConv, setShowConv] = useState(false) // mobile : liste ↔ conversation
  const [toast, setToast] = useState<{ msg: string; tone: "error" | "success" } | null>(null)

  const [modal, setModal] = useState<null | "group" | "direct">(null)
  const [groupName, setGroupName] = useState("")
  const [announcement, setAnnouncement] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [pickedEmployee, setPickedEmployee] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (isAdmin) listEmployees().then(setEmployees).catch(() => {})
  }, [isAdmin])

  useEffect(() => {
    if (loadError) setToast({ msg: "Impossible de charger les conversations.", tone: "error" })
  }, [loadError])

  const isMember = (c: Chat) => c.memberIds.includes(uid)
  // Salarié : conversations rejointes vs groupes disponibles.
  const joined = useMemo(() => (isAdmin ? chats : chats.filter(isMember)), [chats, isAdmin, uid])
  const available = useMemo(() => (isAdmin ? [] : chats.filter((c) => c.type === "group" && !isMember(c))), [chats, isAdmin, uid])
  const active = chats.find((c) => c.id === activeId && (isAdmin || isMember(c))) ?? null

  // Conversation ouverte à l'écran : tout nouveau message reçu est aussitôt marqué comme lu.
  const activeLast = millis(active?.lastMessageAt)
  useEffect(() => {
    const visible = showConv || window.matchMedia("(min-width: 768px)").matches
    if (active && visible) markRead(active.id)
  }, [active?.id, activeLast, showConv]) // eslint-disable-line react-hooks/exhaustive-deps

  function open(id: string) {
    setActiveId(id); setShowConv(true); markRead(id)
  }

  async function handleCreateGroup() {
    if (!groupName.trim()) return
    setBusy(true)
    try {
      const id = await createGroup(groupName, announcement)
      setModal(null); setGroupName(""); setAnnouncement(false); open(id)
    } catch (e) { setToast({ msg: errorMessage(e, "Création du groupe impossible."), tone: "error" }) }
    finally { setBusy(false) }
  }

  async function handleOpenDirect() {
    if (!pickedEmployee) return
    setBusy(true)
    try {
      const id = await openDirectChat(pickedEmployee)
      setModal(null); setPickedEmployee(""); open(id)
    } catch (e) { setToast({ msg: errorMessage(e, "Impossible d'ouvrir la conversation."), tone: "error" }) }
    finally { setBusy(false) }
  }

  async function handleJoin(c: Chat) {
    try { await joinGroup(c.id); open(c.id) }
    catch { setToast({ msg: "Impossible de rejoindre ce groupe.", tone: "error" }) }
  }

  async function handleLeave(c: Chat) {
    const ok = await confirm({
      title: `Quitter « ${c.name} » ?`,
      message: "Vous ne recevrez plus les messages de ce groupe. Vous pourrez le rejoindre à nouveau.",
      confirmLabel: "Quitter", tone: "danger",
    })
    if (!ok) return
    try { await leaveGroup(c.id); setActiveId(null); setShowConv(false) }
    catch { setToast({ msg: "Impossible de quitter ce groupe.", tone: "error" }) }
  }

  const row = (c: Chat) => {
    const title = chatTitle(c, role)
    const unread = c.id !== activeId ? unreadFor(c.id) : 0
    return (
      <button key={c.id} onClick={() => open(c.id)}
        className={`w-full flex items-center gap-3 px-3 py-3 text-left transition border-b border-slate-100 ${
          c.id === activeId ? "bg-primary-50" : "hover:bg-slate-50"}`}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
          c.type === "group" ? "bg-primary-100 text-primary-700" : "bg-emerald-100 text-emerald-700"}`}>
          {c.type === "group" ? (c.announcement ? <Megaphone className="w-5 h-5" /> : <Hash className="w-5 h-5" />) : <User className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`truncate text-sm ${unread > 0 ? "font-bold text-slate-900" : "font-semibold text-slate-800"}`}>{title}</span>
            <span className="text-[11px] text-slate-400 shrink-0">{fmt(c)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className={`truncate text-xs ${unread > 0 ? "text-slate-700 font-medium" : "text-slate-500"}`}>
              {c.lastMessageText ?? (c.type === "group" ? `${c.memberIds.length} membre${c.memberIds.length > 1 ? "s" : ""}` : "Aucun message")}
            </span>
            {unread > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </div>
        </div>
      </button>
    )
  }

  return (
    <div className={`bg-white border border-slate-200/80 shadow-sm overflow-hidden flex ${heightClass} ${isAdmin ? "rounded-2xl" : "rounded-none border-0 shadow-none"}`}>
      {/* Liste des conversations */}
      <aside className={`${showConv ? "hidden" : "flex"} md:flex flex-col w-full md:w-80 md:shrink-0 border-r border-slate-200`}>
        <div className={`p-3 border-b flex items-center justify-between gap-2 ${
          isAdmin ? "border-slate-200" : "border-transparent bg-gradient-to-br from-primary-900 to-primary-700 text-white px-4 py-4"}`}>
          <h1 className={`font-bold flex items-center gap-2 ${isAdmin ? "text-slate-900" : "text-lg"}`}>
            <MessageCircle className={`w-5 h-5 ${isAdmin ? "text-primary-600" : "text-primary-200"}`} />Discussions
          </h1>
          {isAdmin && (
            <div className="flex gap-1.5">
              <button onClick={() => setModal("group")} title="Nouveau groupe"
                className="px-2.5 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />Groupe
              </button>
              <button onClick={() => setModal("direct")} title="Message direct"
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" />Direct
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {!loaded && <p className="p-4 text-sm text-slate-400">Chargement...</p>}
          {loaded && joined.length === 0 && available.length === 0 && (
            <p className="p-6 text-center text-sm text-slate-400">
              {isAdmin ? "Créez un groupe ou ouvrez une conversation avec un salarié." : "Aucune conversation pour le moment."}
            </p>
          )}
          {joined.map(row)}

          {available.length > 0 && (
            <>
              <div className="px-3 pt-4 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Groupes à rejoindre</div>
              {available.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0"><Hash className="w-5 h-5" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-800">{c.name}</div>
                    <div className="text-xs text-slate-500">{c.memberIds.length} membre{c.memberIds.length > 1 ? "s" : ""}</div>
                  </div>
                  <button onClick={() => handleJoin(c)}
                    className="px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold flex items-center gap-1">
                    <LogIn className="w-3.5 h-3.5" />Rejoindre
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </aside>

      {/* Conversation */}
      <section className={`${showConv ? "flex" : "hidden"} md:flex flex-1 min-w-0 flex-col`}>
        {active ? (
          <ChatConversation
            key={active.id}
            variant={role}
            visible={showConv || window.matchMedia("(min-width: 768px)").matches}
            chat={active}
            title={chatTitle(active, role)}
            employees={employees}
            myId={uid}
            isAdmin={isAdmin}
            onBack={() => setShowConv(false)}
            onSeen={() => markRead(active.id)}
            onDeleted={() => { setActiveId(null); setShowConv(false) }}
            onLeave={!isAdmin && active.type === "group" ? () => handleLeave(active) : undefined}
            onError={(msg) => setToast({ msg, tone: "error" })}
            onSuccess={(msg) => setToast({ msg, tone: "success" })}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2 p-6 text-center">
            <MessageCircle className="w-12 h-12" />
            <p className="text-sm">Sélectionnez une conversation pour commencer.</p>
          </div>
        )}
      </section>

      {modal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold text-lg text-slate-900">{modal === "group" ? "Nouveau groupe" : "Message direct"}</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {modal === "group" ? "Les salariés pourront le rejoindre depuis leur messagerie." : "Conversation privée avec un salarié."}
                </p>
              </div>
              <button onClick={() => setModal(null)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            {modal === "group" ? (
              <input autoFocus value={groupName} onChange={(e) => setGroupName(e.target.value)} maxLength={60}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateGroup() }}
                placeholder="Ex : Annonces, Équipe entrepôt..."
                className="w-full border border-slate-300 rounded-xl px-3.5 py-3 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none" />
            ) : (
              <Dropdown value={pickedEmployee} onChange={setPickedEmployee} placeholder="Choisir un salarié" icon={<User className="w-4 h-4" />}
                options={employees.filter((e) => e.active).map((e) => ({ value: e.employeeCode, label: `${employeeName(e)} (${e.employeeCode})` }))} />
            )}
            {modal === "group" && (
              <label className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={announcement} onChange={(e) => setAnnouncement(e.target.checked)} className="mt-0.5 w-4 h-4 accent-primary-600" />
                <span><span className="font-semibold">Groupe d'annonces</span><br /><span className="text-xs text-slate-500">Lecture seule : les salariés ne peuvent pas répondre.</span></span>
              </label>
            )}
            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 border border-slate-200 text-slate-700 font-medium py-3 rounded-xl hover:bg-slate-50">Annuler</button>
              <button onClick={modal === "group" ? handleCreateGroup : handleOpenDirect}
                disabled={busy || (modal === "group" ? !groupName.trim() : !pickedEmployee)}
                className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl disabled:opacity-60">
                {busy ? "..." : modal === "group" ? "Créer" : "Ouvrir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.msg} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  )
}


// // src/components/chat/ChatPage.tsx
// // Messagerie partagée admin / salarié : liste des conversations + fil de discussion.
// import { useEffect, useMemo, useState } from "react"
// import { useAuth } from "../../hooks/useAuth"
// import { listEmployees, employeeName, type Employee } from "../../services/employees"
// import { createGroup, openDirectChat, joinGroup, leaveGroup, type Chat } from "../../services/chat"
// import { errorMessage } from "../../services/api"
// import { millis } from "../../utils/format"
// import { useChat } from "../../contexts/ChatContext"
// import { useConfirm } from "../../contexts/ConfirmContext"
// import Dropdown from "../Dropdown"
// import Toast from "../Toast"
// import ChatConversation from "./ChatConversation"
// import { Users, User, Plus, Hash, Megaphone, X, MessageCircle, LogIn } from "lucide-react"

// type Role = "admin" | "employee"

// interface Props { role: Role; heightClass: string }

// export function chatTitle(chat: Chat, role: Role) {
//   if (chat.type === "group") return chat.name
//   return role === "admin" ? (chat.directEmployeeName ?? "Salarié") : "Administrateur"
// }

// const fmt = (c: Chat) => {
//   if (!c.lastMessageAt) return ""
//   const t = new Date(c.lastMessageAt)
//   const today = new Date().toDateString() === t.toDateString()
//   return today ? t.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : t.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })
// }

// export default function ChatPage({ role, heightClass }: Props) {
//   const { appUser } = useAuth()
//   const uid = appUser?.id ?? ""
//   const isAdmin = role === "admin"
//   const confirm = useConfirm()

//   const { chats, loaded, error: loadError, unreadFor, markRead } = useChat()
//   const [activeId, setActiveId] = useState<string | null>(null)
//   const [showConv, setShowConv] = useState(false) // mobile : liste ↔ conversation
//   const [toast, setToast] = useState<{ msg: string; tone: "error" | "success" } | null>(null)

//   const [modal, setModal] = useState<null | "group" | "direct">(null)
//   const [groupName, setGroupName] = useState("")
//   const [announcement, setAnnouncement] = useState(false)
//   const [employees, setEmployees] = useState<Employee[]>([])
//   const [pickedEmployee, setPickedEmployee] = useState("")
//   const [busy, setBusy] = useState(false)

//   useEffect(() => {
//     if (isAdmin) listEmployees().then(setEmployees).catch(() => {})
//   }, [isAdmin])

//   useEffect(() => {
//     if (loadError) setToast({ msg: "Impossible de charger les conversations.", tone: "error" })
//   }, [loadError])

//   const isMember = (c: Chat) => c.memberIds.includes(uid)
//   // Salarié : conversations rejointes vs groupes disponibles.
//   const joined = useMemo(() => (isAdmin ? chats : chats.filter(isMember)), [chats, isAdmin, uid])
//   const available = useMemo(() => (isAdmin ? [] : chats.filter((c) => c.type === "group" && !isMember(c))), [chats, isAdmin, uid])
//   const active = chats.find((c) => c.id === activeId && (isAdmin || isMember(c))) ?? null

//   // Conversation ouverte à l'écran : tout nouveau message reçu est aussitôt marqué comme lu.
//   const activeLast = millis(active?.lastMessageAt)
//   useEffect(() => {
//     const visible = showConv || window.matchMedia("(min-width: 768px)").matches
//     if (active && visible) markRead(active.id)
//   }, [active?.id, activeLast, showConv]) // eslint-disable-line react-hooks/exhaustive-deps

//   function open(id: string) {
//     setActiveId(id); setShowConv(true); markRead(id)
//   }

//   async function handleCreateGroup() {
//     if (!groupName.trim()) return
//     setBusy(true)
//     try {
//       const id = await createGroup(groupName, announcement)
//       setModal(null); setGroupName(""); setAnnouncement(false); open(id)
//     } catch (e) { setToast({ msg: errorMessage(e, "Création du groupe impossible."), tone: "error" }) }
//     finally { setBusy(false) }
//   }

//   async function handleOpenDirect() {
//     if (!pickedEmployee) return
//     setBusy(true)
//     try {
//       const id = await openDirectChat(pickedEmployee)
//       setModal(null); setPickedEmployee(""); open(id)
//     } catch (e) { setToast({ msg: errorMessage(e, "Impossible d'ouvrir la conversation."), tone: "error" }) }
//     finally { setBusy(false) }
//   }

//   async function handleJoin(c: Chat) {
//     try { await joinGroup(c.id); open(c.id) }
//     catch { setToast({ msg: "Impossible de rejoindre ce groupe.", tone: "error" }) }
//   }

//   async function handleLeave(c: Chat) {
//     const ok = await confirm({
//       title: `Quitter « ${c.name} » ?`,
//       message: "Vous ne recevrez plus les messages de ce groupe. Vous pourrez le rejoindre à nouveau.",
//       confirmLabel: "Quitter", tone: "danger",
//     })
//     if (!ok) return
//     try { await leaveGroup(c.id); setActiveId(null); setShowConv(false) }
//     catch { setToast({ msg: "Impossible de quitter ce groupe.", tone: "error" }) }
//   }

//   const row = (c: Chat) => {
//     const title = chatTitle(c, role)
//     const unread = c.id !== activeId ? unreadFor(c.id) : 0
//     return (
//       <button key={c.id} onClick={() => open(c.id)}
//         className={`w-full flex items-center gap-3 px-3 py-3 text-left transition border-b border-slate-100 ${
//           c.id === activeId ? "bg-primary-50" : "hover:bg-slate-50"}`}>
//         <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
//           c.type === "group" ? "bg-primary-100 text-primary-700" : "bg-emerald-100 text-emerald-700"}`}>
//           {c.type === "group" ? (c.announcement ? <Megaphone className="w-5 h-5" /> : <Hash className="w-5 h-5" />) : <User className="w-5 h-5" />}
//         </div>
//         <div className="flex-1 min-w-0">
//           <div className="flex items-center justify-between gap-2">
//             <span className={`truncate text-sm ${unread > 0 ? "font-bold text-slate-900" : "font-semibold text-slate-800"}`}>{title}</span>
//             <span className="text-[11px] text-slate-400 shrink-0">{fmt(c)}</span>
//           </div>
//           <div className="flex items-center justify-between gap-2">
//             <span className={`truncate text-xs ${unread > 0 ? "text-slate-700 font-medium" : "text-slate-500"}`}>
//               {c.lastMessageText ?? (c.type === "group" ? `${c.memberIds.length} membre${c.memberIds.length > 1 ? "s" : ""}` : "Aucun message")}
//             </span>
//             {unread > 0 && (
//               <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
//                 {unread > 99 ? "99+" : unread}
//               </span>
//             )}
//           </div>
//         </div>
//       </button>
//     )
//   }

//   return (
//     <div className={`bg-white border border-slate-200/80 shadow-sm overflow-hidden flex ${heightClass} ${isAdmin ? "rounded-2xl" : "rounded-none border-0 shadow-none"}`}>
//       {/* Liste des conversations */}
//       <aside className={`${showConv ? "hidden" : "flex"} md:flex flex-col w-full md:w-80 md:shrink-0 border-r border-slate-200`}>
//         <div className={`p-3 border-b flex items-center justify-between gap-2 ${
//           isAdmin ? "border-slate-200" : "border-transparent bg-gradient-to-br from-primary-900 to-primary-700 text-white px-4 py-4"}`}>
//           <h1 className={`font-bold flex items-center gap-2 ${isAdmin ? "text-slate-900" : "text-lg"}`}>
//             <MessageCircle className={`w-5 h-5 ${isAdmin ? "text-primary-600" : "text-primary-200"}`} />Discussions
//           </h1>
//           {isAdmin && (
//             <div className="flex gap-1.5">
//               <button onClick={() => setModal("group")} title="Nouveau groupe"
//                 className="px-2.5 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold flex items-center gap-1">
//                 <Users className="w-3.5 h-3.5" />Groupe
//               </button>
//               <button onClick={() => setModal("direct")} title="Message direct"
//                 className="px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1">
//                 <Plus className="w-3.5 h-3.5" />Direct
//               </button>
//             </div>
//           )}
//         </div>

//         <div className="flex-1 overflow-y-auto">
//           {!loaded && <p className="p-4 text-sm text-slate-400">Chargement...</p>}
//           {loaded && joined.length === 0 && available.length === 0 && (
//             <p className="p-6 text-center text-sm text-slate-400">
//               {isAdmin ? "Créez un groupe ou ouvrez une conversation avec un salarié." : "Aucune conversation pour le moment."}
//             </p>
//           )}
//           {joined.map(row)}

//           {available.length > 0 && (
//             <>
//               <div className="px-3 pt-4 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Groupes à rejoindre</div>
//               {available.map((c) => (
//                 <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-slate-100">
//                   <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0"><Hash className="w-5 h-5" /></div>
//                   <div className="flex-1 min-w-0">
//                     <div className="truncate text-sm font-semibold text-slate-800">{c.name}</div>
//                     <div className="text-xs text-slate-500">{c.memberIds.length} membre{c.memberIds.length > 1 ? "s" : ""}</div>
//                   </div>
//                   <button onClick={() => handleJoin(c)}
//                     className="px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold flex items-center gap-1">
//                     <LogIn className="w-3.5 h-3.5" />Rejoindre
//                   </button>
//                 </div>
//               ))}
//             </>
//           )}
//         </div>
//       </aside>

//       {/* Conversation */}
//       <section className={`${showConv ? "flex" : "hidden"} md:flex flex-1 min-w-0 flex-col`}>
//         {active ? (
//           <ChatConversation
//             key={active.id}
//             variant={role}
//             visible={showConv || window.matchMedia("(min-width: 768px)").matches}
//             chat={active}
//             title={chatTitle(active, role)}
//             myId={uid}
//             isAdmin={isAdmin}
//             onBack={() => setShowConv(false)}
//             onSeen={() => markRead(active.id)}
//             onDeleted={() => { setActiveId(null); setShowConv(false) }}
//             onLeave={!isAdmin && active.type === "group" ? () => handleLeave(active) : undefined}
//             onError={(msg) => setToast({ msg, tone: "error" })}
//           />
//         ) : (
//           <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2 p-6 text-center">
//             <MessageCircle className="w-12 h-12" />
//             <p className="text-sm">Sélectionnez une conversation pour commencer.</p>
//           </div>
//         )}
//       </section>

//       {modal && (
//         <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
//           <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-5 shadow-2xl">
//             <div className="flex items-start justify-between">
//               <div>
//                 <h2 className="font-bold text-lg text-slate-900">{modal === "group" ? "Nouveau groupe" : "Message direct"}</h2>
//                 <p className="text-sm text-slate-500 mt-1">
//                   {modal === "group" ? "Les salariés pourront le rejoindre depuis leur messagerie." : "Conversation privée avec un salarié."}
//                 </p>
//               </div>
//               <button onClick={() => setModal(null)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
//             </div>
//             {modal === "group" ? (
//               <input autoFocus value={groupName} onChange={(e) => setGroupName(e.target.value)} maxLength={60}
//                 onKeyDown={(e) => { if (e.key === "Enter") handleCreateGroup() }}
//                 placeholder="Ex : Annonces, Équipe entrepôt..."
//                 className="w-full border border-slate-300 rounded-xl px-3.5 py-3 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none" />
//             ) : (
//               <Dropdown value={pickedEmployee} onChange={setPickedEmployee} placeholder="Choisir un salarié" icon={<User className="w-4 h-4" />}
//                 options={employees.filter((e) => e.active).map((e) => ({ value: e.employeeCode, label: `${employeeName(e)} (${e.employeeCode})` }))} />
//             )}
//             {modal === "group" && (
//               <label className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer">
//                 <input type="checkbox" checked={announcement} onChange={(e) => setAnnouncement(e.target.checked)} className="mt-0.5 w-4 h-4 accent-primary-600" />
//                 <span><span className="font-semibold">Groupe d'annonces</span><br /><span className="text-xs text-slate-500">Lecture seule : les salariés ne peuvent pas répondre.</span></span>
//               </label>
//             )}
//             <div className="flex gap-3">
//               <button onClick={() => setModal(null)} className="flex-1 border border-slate-200 text-slate-700 font-medium py-3 rounded-xl hover:bg-slate-50">Annuler</button>
//               <button onClick={modal === "group" ? handleCreateGroup : handleOpenDirect}
//                 disabled={busy || (modal === "group" ? !groupName.trim() : !pickedEmployee)}
//                 className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl disabled:opacity-60">
//                 {busy ? "..." : modal === "group" ? "Créer" : "Ouvrir"}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {toast && <Toast message={toast.msg} tone={toast.tone} onClose={() => setToast(null)} />}
//     </div>
//   )
// }
