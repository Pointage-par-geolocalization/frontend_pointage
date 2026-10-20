// src/components/chat/ChatConversation.tsx
// Fil de discussion : messages, sélection d'un message (répondre / réagir / supprimer), saisie.
import { useEffect, useMemo, useRef, useState } from "react"
import {
  subscribeMessages, subscribeReads, markSeen, sendMessage, addGroupMember, deleteChat, toggleReaction,
  QUICK_REACTIONS, MAX_MESSAGE_LENGTH, type Chat, type ChatMessage, type ReadReceipt, type ReplyRef,
} from "../../services/chat"
import { fmtTime, millis } from "../../utils/format"
import { useConfirm } from "../../contexts/ConfirmContext"
import { ArrowLeft, Send, Reply, X, Hash, Megaphone, User, LogOut, Copy, Check, CheckCheck, UserPlus, Trash2 as TrashIcon } from "lucide-react"

interface Props {
  chat: Chat
  title: string
  /** Mon identifiant de compte (pour reconnaître mes messages et mes réactions). */
  myId: string
  isAdmin: boolean
  variant: "admin" | "employee"
  /** La conversation est réellement à l'écran (sinon on n'envoie pas de « Vu »). */
  visible: boolean
  onBack: () => void
  onSeen: () => void
  onLeave?: () => void
  /** Appelé après la suppression de la conversation (retour à la liste). */
  onDeleted?: () => void
  onError: (msg: string) => void
}

const time = (m: ChatMessage) => fmtTime(m.createdAt)
const dayLabel = (m: ChatMessage) => {
  const d = new Date(m.createdAt)
  const today = new Date()
  const yest = new Date(); yest.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui"
  if (d.toDateString() === yest.toDateString()) return "Hier"
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
}

export default function ChatConversation({ chat, title, myId, isAdmin, variant, visible, onBack, onSeen, onLeave, onDeleted, onError }: Props) {
  const emp = variant === "employee"
  const confirm = useConfirm()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [reads, setReads] = useState<ReadReceipt[]>([])
  const [tick, setTick] = useState(0) // relance l'envoi du « Vu » quand l'onglet redevient visible
  const [text, setText] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [replyTo, setReplyTo] = useState<ReplyRef | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true) // reste collé en bas tant que l'utilisateur n'a pas remonté
  const seenSentFor = useRef<string | null>(null) // dernier message pour lequel « Vu » a été envoyé
  const lastTick = useRef(0)

  useEffect(() => subscribeMessages(chat.id, (m) => { setMessages(m); onSeen() },
    () => onError("Impossible de charger les messages.")), [chat.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => subscribeReads(chat.id, setReads, () => {}), [chat.id])

  useEffect(() => {
    const onVis = () => setTick((t) => t + 1)
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [])

  // Envoie « Vu » dès qu'un message d'un autre est à l'écran et n'a pas encore été signalé comme vu.
  useEffect(() => {
    if (!visible || document.hidden) return
    const tickChanged = lastTick.current !== tick
    const latest = [...messages].reverse().find((m) => m.senderId !== myId)
    if (!latest) return
    const mine = reads.find((r) => r.userId === myId)?.seenAt
    if (mine && millis(mine) >= millis(latest.createdAt)) return
    if (seenSentFor.current === latest.id && !tickChanged) return // déjà signalé pour ce message
    seenSentFor.current = latest.id
    lastTick.current = tick
    markSeen(chat.id).catch(() => { seenSentFor.current = null })
  }, [messages, reads, visible, tick]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (stickRef.current) bottomRef.current?.scrollIntoView({ block: "end" })
  }, [messages])

  // Pour un message que j'ai envoyé : les autres personnes dont le « vu » est postérieur au message.
  // « Vu » : uniquement sur MON dernier message, pour les personnes qui l'ont vu et qui n'ont pas répondu depuis
  // (leur réponse prouve déjà qu'elles l'ont lu). Un nouveau message fait disparaître l'ancien « Vu ».
  const lastMineId = useMemo(() => [...messages].reverse().find((m) => m.senderId === myId)?.id ?? null, [messages, myId])
  const seenBy = (m: ChatMessage) => {
    if (m.id !== lastMineId) return []
    const sentAt = millis(m.createdAt)
    return reads.filter((r) =>
      r.userId !== myId && millis(r.seenAt) >= sentAt &&
      !messages.some((x) => x.senderId === r.userId && millis(x.createdAt) > sentAt))
  }

  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages])

  function onScroll() {
    const el = listRef.current
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  async function handleSend() {
    if (!text.trim() || sending) return
    setSending(true)
    try {
      await sendMessage(chat.id, text, replyTo)
      setText(""); setReplyTo(null); stickRef.current = true
    } catch { onError("Envoi impossible. Vérifiez votre connexion.") }
    finally { setSending(false) }
  }

  function startReply(m: ChatMessage) {
    setReplyTo({ id: m.id, senderName: m.senderName, text: m.text })
    setSelectedId(null)
    document.getElementById("chat-input")?.focus()
  }

  async function react(m: ChatMessage, emoji: string) {
    setSelectedId(null)
    try { await toggleReaction(chat.id, m.id, emoji) } catch { onError("Réaction impossible.") }
  }

  async function handleAddMember() {
    const employeeCode=window.prompt("Code salarié actif à ajouter au groupe :")
    if(!employeeCode?.trim())return
    try { await addGroupMember(chat.id,employeeCode.trim()); onError("Salarié ajouté au groupe.") } catch(e) { onError(e instanceof Error?e.message:"Impossible d’ajouter ce salarié.") }
  }
  async function handleDeleteChat() {
    const isGroup = chat.type === "group"
    const ok = await confirm({
      title: isGroup ? `Supprimer le groupe « ${title} » ?` : `Supprimer la conversation avec ${title} ?`,
      message: isGroup
        ? "Le groupe et tous ses messages seront supprimés définitivement. Les salariés ne le verront plus."
        : "La conversation et tous ses messages seront supprimés définitivement. Vous pourrez en ouvrir une nouvelle.",
      confirmLabel: isGroup ? "Supprimer le groupe" : "Supprimer la conversation", tone: "danger",
    })
    if (!ok) return
    setDeleting(true)
    try {
      await deleteChat(chat.id)
      onDeleted?.()
    } catch {
      onError("Impossible de supprimer la conversation.")
      setDeleting(false)
    }
  }

  function jumpTo(id: string) {
    const el = document.getElementById(`msg-${id}`)
    if (!el) return onError("Le message d'origine n'est plus disponible.")
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    setHighlightId(id)
    setTimeout(() => setHighlightId(null), 1500)
  }

  return (
    <>
      <header className={`px-3 py-2.5 border-b flex items-center gap-3 ${
        emp ? "border-transparent bg-gradient-to-br from-primary-900 to-primary-700 text-white py-3.5" : "border-slate-200"}`}>
        <button onClick={onBack} className={`md:hidden p-1.5 -ml-1 rounded-lg ${emp ? "hover:bg-white/10 text-white" : "hover:bg-slate-100 text-slate-600"}`} aria-label="Retour"><ArrowLeft className="w-5 h-5" /></button>
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${chat.type === "group" ? "bg-primary-100 text-primary-700" : "bg-emerald-100 text-emerald-700"}`}>
          {chat.type === "group" ? <Hash className="w-4 h-4" /> : <User className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`font-semibold text-sm truncate ${emp ? "text-white" : "text-slate-900"}`}>{title}</div>
          <div className={`text-xs ${emp ? "text-primary-200" : "text-slate-500"}`}>
            {chat.type === "group" ? `${chat.announcement ? "Annonces" : "Groupe"} · ${chat.memberIds.length} membre${chat.memberIds.length > 1 ? "s" : ""}` : "Conversation privée"}
          </div>
        </div>
        {isAdmin && chat.type === "group" && <button onClick={handleAddMember} title="Ajouter un salarié au groupe" className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${emp?"text-white hover:bg-white/10":"text-primary-700 hover:bg-primary-50"}`}><UserPlus className="w-4 h-4"/><span className="hidden sm:inline">Ajouter</span></button>}
        {isAdmin && (
          <button onClick={handleDeleteChat} disabled={deleting}
            title={chat.type === "group" ? "Supprimer le groupe" : "Supprimer la conversation"}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 ${
              emp ? "text-white hover:bg-white/10" : "text-rose-600 hover:bg-rose-50"}`}>
            <TrashIcon className="w-4 h-4" />
            <span className="hidden sm:inline">{deleting ? "Suppression..." : chat.type === "group" ? "Supprimer le groupe" : "Supprimer"}</span>
          </button>
        )}
        {onLeave && (
          <button onClick={onLeave} title="Quitter le groupe" className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100"><LogOut className="w-4 h-4" /></button>
        )}
      </header>

      <div ref={listRef} onScroll={onScroll} onClick={() => setSelectedId(null)} className={`flex-1 overflow-y-auto px-3 py-4 space-y-1 ${emp ? "bg-gradient-to-b from-slate-50 to-primary-50/40" : "bg-slate-50"}`}>
        {messages.length === 0 && <p className="text-center text-sm text-slate-400 pt-10">Aucun message. Écrivez le premier !</p>}
        {messages.map((m, i) => {
          const mine = m.senderId === myId
          const prev = messages[i - 1]
          const newDay = !prev || dayLabel(prev) !== dayLabel(m)
          const showName = !mine && (!prev || prev.senderId !== m.senderId || newDay)
          const isSel = selectedId === m.id
          const reactions = Object.entries(m.reactions ?? {}).filter(([, u]) => u.length > 0)
          return (
            <div key={m.id}>
              {newDay && <div className="text-center my-3"><span className="text-[11px] text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-1 capitalize">{dayLabel(m)}</span></div>}
              <div id={`msg-${m.id}`} className={`flex flex-col ${mine ? "items-end" : "items-start"} ${showName ? "mt-2" : ""}`}>
                {showName && (
                  <span className="text-[11px] font-semibold text-slate-500 mb-0.5 px-1">
                    {m.senderName}{m.senderRole === "admin" && <span className="ml-1 text-primary-600">· Admin</span>}
                  </span>
                )}
                <div
                  onClick={(e) => { e.stopPropagation(); setSelectedId(isSel ? null : m.id) }}
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 py-2 text-sm cursor-pointer transition shadow-sm break-words whitespace-pre-wrap
                    ${mine ? `${emp ? "bg-gradient-to-br from-primary-600 to-primary-500 shadow-primary-600/20" : "bg-primary-600"} text-white rounded-br-md` : "bg-white text-slate-800 border border-slate-200 rounded-bl-md"}
                    ${isSel ? "ring-2 ring-primary-400" : ""} ${highlightId === m.id ? "ring-2 ring-amber-400" : ""}`}
                >
                  {m.replyTo && (
                    <button
                      onClick={(e) => { e.stopPropagation(); jumpTo(m.replyTo!.id) }}
                      className={`block w-full text-left mb-1.5 rounded-lg px-2 py-1 border-l-4 text-xs ${
                        mine ? "bg-white/15 border-white/70" : "bg-slate-100 border-primary-400"}`}
                    >
                      <span className="font-semibold block truncate">{m.replyTo.senderName}</span>
                      <span className="block truncate opacity-80">{m.replyTo.text}</span>
                    </button>
                  )}
                  {m.text}
                  <span className={`flex items-center justify-end gap-1 text-[10px] mt-0.5 ${mine ? "text-white/70" : "text-slate-400"}`}>
                    {time(m)}
                    {mine && (() => {
                      if (m.id !== lastMineId) return null
                      return seenBy(m).length === 0
                        ? <Check className="w-3 h-3" aria-label="Envoyé" />
                        : <CheckCheck className="w-3.5 h-3.5 text-sky-200" aria-label="Vu" />
                    })()}
                  </span>
                </div>

                {(() => {
                  const viewers = seenBy(m)
                  if (viewers.length === 0) return null
                  const shown = viewers.slice(0, 6)
                  return (
                    <div className="flex items-center gap-0.5 mt-1 px-1" aria-label={`Vu par ${viewers.map((r) => r.name).join(", ")}`}>
                      {shown.map((r) => (
                        <span key={r.userId} title={r.name}
                          className={`w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center border border-white ${
                            r.role === "admin" ? "bg-primary-600 text-white" : "bg-emerald-500 text-white"}`}>
                          {(r.name || "?").trim().charAt(0).toUpperCase()}
                        </span>
                      ))}
                      {viewers.length > shown.length && <span className="text-[10px] text-slate-500 ml-0.5">+{viewers.length - shown.length}</span>}
                    </div>
                  )
                })()}

                {reactions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 px-1">
                    {reactions.map(([emoji, uids]) => (
                      <button key={emoji} onClick={(e) => { e.stopPropagation(); react(m, emoji) }}
                        className={`text-xs px-1.5 py-0.5 rounded-full border flex items-center gap-1 ${
                          uids.includes(myId) ? "bg-primary-50 border-primary-300 text-primary-700" : "bg-white border-slate-200 text-slate-600"}`}>
                        <span>{emoji}</span><span className="font-semibold">{uids.length}</span>
                      </button>
                    ))}
                  </div>
                )}

                {isSel && mine && m.id === lastMineId && chat.type === "group" && (
                  <div onClick={(e) => e.stopPropagation()} className="mt-1.5 text-[11px] text-slate-500 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 max-w-[85%]">
                    {seenBy(m).length > 0
                      ? <>Vu par : <span className="font-semibold text-slate-700">{seenBy(m).map((r) => r.name).join(", ")}</span></>
                      : "Pas encore vu"}
                  </div>
                )}
                {isSel && (
                  <div onClick={(e) => e.stopPropagation()} className="mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-lg px-2 py-1.5 flex items-center gap-1 flex-wrap">
                    {QUICK_REACTIONS.map((e) => (
                      <button key={e} onClick={() => react(m, e)}
                        className={`text-lg w-8 h-8 rounded-full hover:bg-slate-100 ${m.reactions?.[e]?.includes(myId) ? "bg-primary-50" : ""}`}>{e}</button>
                    ))}
                    <span className="w-px h-6 bg-slate-200 mx-1" />
                    <button onClick={() => startReply(m)} className="px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1"><Reply className="w-4 h-4" />Répondre</button>
                    <button onClick={() => { navigator.clipboard?.writeText(m.text).catch(() => {}); setSelectedId(null) }}
                      className="px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1"><Copy className="w-4 h-4" />Copier</button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {chat.announcement && !isAdmin ? (
        <footer className="border-t border-slate-200 bg-white p-3 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Megaphone className="w-4 h-4" /> Groupe d'annonces : lecture seule
        </footer>
      ) : (
      <footer className={`border-t border-slate-200 bg-white space-y-2 ${emp ? "p-3" : "p-2.5"}`}>
        {replyTo && (
          <div className="flex items-start gap-2 bg-slate-100 border-l-4 border-primary-500 rounded-lg px-3 py-1.5">
            <Reply className="w-4 h-4 text-primary-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0 text-xs">
              <div className="font-semibold text-slate-700 truncate">Réponse à {replyTo.senderName}</div>
              <div className="text-slate-500 truncate">{replyTo.text}</div>
            </div>
            <button onClick={() => setReplyTo(null)} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Annuler la réponse"><X className="w-4 h-4" /></button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            id="chat-input"
            value={text}
            rows={1}
            maxLength={MAX_MESSAGE_LENGTH}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(hover: hover)").matches) { e.preventDefault(); handleSend() } }}
            placeholder="Écrire un message..."
            className="flex-1 resize-none max-h-32 border border-slate-300 rounded-3xl px-4 py-2.5 text-base sm:text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
          />
          <button onClick={handleSend} disabled={!text.trim() || sending} aria-label="Envoyer"
            className="w-11 h-11 rounded-full bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center disabled:opacity-50 shrink-0">
            <Send className="w-5 h-5" />
          </button>
        </div>
      </footer>
      )}
    </>
  )
}


// // src/components/chat/ChatConversation.tsx
// // Fil de discussion : messages, sélection d'un message (répondre / réagir / supprimer), saisie.
// import { useEffect, useMemo, useRef, useState } from "react"
// import {
//   subscribeMessages, subscribeReads, markSeen, sendMessage, clearConversation, deleteChat, toggleReaction, deleteMessage,
//   QUICK_REACTIONS, MAX_MESSAGE_LENGTH, type Chat, type ChatMessage, type ReadReceipt, type ReplyRef,
// } from "../../services/chat"
// import { fmtTime, millis } from "../../utils/format"
// import { useConfirm } from "../../contexts/ConfirmContext"
// import { ArrowLeft, Send, Reply, Trash2, X, Hash, Megaphone, User, LogOut, Copy, Check, CheckCheck, Eraser, Trash2 as TrashIcon } from "lucide-react"

// interface Props {
//   chat: Chat
//   title: string
//   /** Mon identifiant de compte (pour reconnaître mes messages et mes réactions). */
//   myId: string
//   isAdmin: boolean
//   variant: "admin" | "employee"
//   /** La conversation est réellement à l'écran (sinon on n'envoie pas de « Vu »). */
//   visible: boolean
//   onBack: () => void
//   onSeen: () => void
//   onLeave?: () => void
//   /** Appelé après la suppression de la conversation (retour à la liste). */
//   onDeleted?: () => void
//   onError: (msg: string) => void
// }

// const time = (m: ChatMessage) => fmtTime(m.createdAt)
// const dayLabel = (m: ChatMessage) => {
//   const d = new Date(m.createdAt)
//   const today = new Date()
//   const yest = new Date(); yest.setDate(today.getDate() - 1)
//   if (d.toDateString() === today.toDateString()) return "Aujourd'hui"
//   if (d.toDateString() === yest.toDateString()) return "Hier"
//   return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
// }

// export default function ChatConversation({ chat, title, myId, isAdmin, variant, visible, onBack, onSeen, onLeave, onDeleted, onError }: Props) {
//   const emp = variant === "employee"
//   const confirm = useConfirm()
//   const [messages, setMessages] = useState<ChatMessage[]>([])
//   const [reads, setReads] = useState<ReadReceipt[]>([])
//   const [tick, setTick] = useState(0) // relance l'envoi du « Vu » quand l'onglet redevient visible
//   const [text, setText] = useState("")
//   const [selectedId, setSelectedId] = useState<string | null>(null)
//   const [replyTo, setReplyTo] = useState<ReplyRef | null>(null)
//   const [highlightId, setHighlightId] = useState<string | null>(null)
//   const [sending, setSending] = useState(false)
//   const [clearing, setClearing] = useState(false)
//   const [deleting, setDeleting] = useState(false)
//   const bottomRef = useRef<HTMLDivElement>(null)
//   const listRef = useRef<HTMLDivElement>(null)
//   const stickRef = useRef(true) // reste collé en bas tant que l'utilisateur n'a pas remonté
//   const seenSentFor = useRef<string | null>(null) // dernier message pour lequel « Vu » a été envoyé
//   const lastTick = useRef(0)

//   useEffect(() => subscribeMessages(chat.id, (m) => { setMessages(m); onSeen() },
//     () => onError("Impossible de charger les messages.")), [chat.id]) // eslint-disable-line react-hooks/exhaustive-deps

//   useEffect(() => subscribeReads(chat.id, setReads, () => {}), [chat.id])

//   useEffect(() => {
//     const onVis = () => setTick((t) => t + 1)
//     document.addEventListener("visibilitychange", onVis)
//     return () => document.removeEventListener("visibilitychange", onVis)
//   }, [])

//   // Envoie « Vu » dès qu'un message d'un autre est à l'écran et n'a pas encore été signalé comme vu.
//   useEffect(() => {
//     if (!visible || document.hidden) return
//     const tickChanged = lastTick.current !== tick
//     const latest = [...messages].reverse().find((m) => m.senderId !== myId)
//     if (!latest) return
//     const mine = reads.find((r) => r.userId === myId)?.seenAt
//     if (mine && millis(mine) >= millis(latest.createdAt)) return
//     if (seenSentFor.current === latest.id && !tickChanged) return // déjà signalé pour ce message
//     seenSentFor.current = latest.id
//     lastTick.current = tick
//     markSeen(chat.id).catch(() => { seenSentFor.current = null })
//   }, [messages, reads, visible, tick]) // eslint-disable-line react-hooks/exhaustive-deps

//   useEffect(() => {
//     if (stickRef.current) bottomRef.current?.scrollIntoView({ block: "end" })
//   }, [messages])

//   // Pour un message que j'ai envoyé : les autres personnes dont le « vu » est postérieur au message.
//   // « Vu » : uniquement sur MON dernier message, pour les personnes qui l'ont vu et qui n'ont pas répondu depuis
//   // (leur réponse prouve déjà qu'elles l'ont lu). Un nouveau message fait disparaître l'ancien « Vu ».
//   const lastMineId = useMemo(() => [...messages].reverse().find((m) => m.senderId === myId)?.id ?? null, [messages, myId])
//   const seenBy = (m: ChatMessage) => {
//     if (m.id !== lastMineId) return []
//     const sentAt = millis(m.createdAt)
//     return reads.filter((r) =>
//       r.userId !== myId && millis(r.seenAt) >= sentAt &&
//       !messages.some((x) => x.senderId === r.userId && millis(x.createdAt) > sentAt))
//   }

//   const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages])

//   function onScroll() {
//     const el = listRef.current
//     if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
//   }

//   async function handleSend() {
//     if (!text.trim() || sending) return
//     setSending(true)
//     try {
//       await sendMessage(chat.id, text, replyTo)
//       setText(""); setReplyTo(null); stickRef.current = true
//     } catch { onError("Envoi impossible. Vérifiez votre connexion.") }
//     finally { setSending(false) }
//   }

//   function startReply(m: ChatMessage) {
//     setReplyTo({ id: m.id, senderName: m.senderName, text: m.text })
//     setSelectedId(null)
//     document.getElementById("chat-input")?.focus()
//   }

//   async function react(m: ChatMessage, emoji: string) {
//     setSelectedId(null)
//     try { await toggleReaction(chat.id, m.id, emoji) } catch { onError("Réaction impossible.") }
//   }

//   async function remove(m: ChatMessage) {
//     const ok = await confirm({
//       title: "Supprimer ce message ?",
//       message: "Il sera supprimé pour tout le monde.",
//       confirmLabel: "Supprimer", tone: "danger",
//     })
//     if (!ok) return
//     setSelectedId(null)
//     try { await deleteMessage(chat.id, m.id) } catch { onError("Suppression impossible.") }
//   }

//   async function handleClear() {
//     const ok = await confirm({
//       title: `Vider « ${title} » ?`,
//       message: "Tous les messages seront supprimés définitivement pour tout le monde. La conversation reste ouverte pour repartir de zéro.",
//       confirmLabel: "Vider la conversation", tone: "danger",
//     })
//     if (!ok) return
//     setClearing(true)
//     try {
//       await clearConversation(chat.id)
//       setSelectedId(null); setReplyTo(null)
//     } catch { onError("Impossible de vider la conversation.") }
//     finally { setClearing(false) }
//   }

//   async function handleDeleteChat() {
//     const isGroup = chat.type === "group"
//     const ok = await confirm({
//       title: isGroup ? `Supprimer le groupe « ${title} » ?` : `Supprimer la conversation avec ${title} ?`,
//       message: isGroup
//         ? "Le groupe et tous ses messages seront supprimés définitivement. Les salariés ne le verront plus."
//         : "La conversation et tous ses messages seront supprimés définitivement. Vous pourrez en ouvrir une nouvelle.",
//       confirmLabel: isGroup ? "Supprimer le groupe" : "Supprimer la conversation", tone: "danger",
//     })
//     if (!ok) return
//     setDeleting(true)
//     try {
//       await deleteChat(chat.id)
//       onDeleted?.()
//     } catch {
//       onError("Impossible de supprimer la conversation.")
//       setDeleting(false)
//     }
//   }

//   function jumpTo(id: string) {
//     const el = document.getElementById(`msg-${id}`)
//     if (!el) return onError("Le message d'origine n'est plus disponible.")
//     el.scrollIntoView({ behavior: "smooth", block: "center" })
//     setHighlightId(id)
//     setTimeout(() => setHighlightId(null), 1500)
//   }

//   return (
//     <>
//       <header className={`px-3 py-2.5 border-b flex items-center gap-3 ${
//         emp ? "border-transparent bg-gradient-to-br from-primary-900 to-primary-700 text-white py-3.5" : "border-slate-200"}`}>
//         <button onClick={onBack} className={`md:hidden p-1.5 -ml-1 rounded-lg ${emp ? "hover:bg-white/10 text-white" : "hover:bg-slate-100 text-slate-600"}`} aria-label="Retour"><ArrowLeft className="w-5 h-5" /></button>
//         <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${chat.type === "group" ? "bg-primary-100 text-primary-700" : "bg-emerald-100 text-emerald-700"}`}>
//           {chat.type === "group" ? <Hash className="w-4 h-4" /> : <User className="w-4 h-4" />}
//         </div>
//         <div className="flex-1 min-w-0">
//           <div className={`font-semibold text-sm truncate ${emp ? "text-white" : "text-slate-900"}`}>{title}</div>
//           <div className={`text-xs ${emp ? "text-primary-200" : "text-slate-500"}`}>
//             {chat.type === "group" ? `${chat.announcement ? "Annonces" : "Groupe"} · ${chat.memberIds.length} membre${chat.memberIds.length > 1 ? "s" : ""}` : "Conversation privée"}
//           </div>
//         </div>
//         {isAdmin && (
//           <button onClick={handleClear} disabled={clearing || messages.length === 0} title="Vider la conversation"
//             className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 ${
//               emp ? "text-white hover:bg-white/10" : "text-rose-600 hover:bg-rose-50"}`}>
//             <Eraser className="w-4 h-4" /><span className="hidden sm:inline">{clearing ? "Suppression..." : "Vider"}</span>
//           </button>
//         )}
//         {isAdmin && (
//           <button onClick={handleDeleteChat} disabled={deleting || clearing}
//             title={chat.type === "group" ? "Supprimer le groupe" : "Supprimer la conversation"}
//             className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 ${
//               emp ? "text-white hover:bg-white/10" : "text-rose-600 hover:bg-rose-50"}`}>
//             <TrashIcon className="w-4 h-4" />
//             <span className="hidden sm:inline">{deleting ? "Suppression..." : chat.type === "group" ? "Supprimer le groupe" : "Supprimer"}</span>
//           </button>
//         )}
//         {onLeave && (
//           <button onClick={onLeave} title="Quitter le groupe" className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100"><LogOut className="w-4 h-4" /></button>
//         )}
//       </header>

//       <div ref={listRef} onScroll={onScroll} onClick={() => setSelectedId(null)} className={`flex-1 overflow-y-auto px-3 py-4 space-y-1 ${emp ? "bg-gradient-to-b from-slate-50 to-primary-50/40" : "bg-slate-50"}`}>
//         {messages.length === 0 && <p className="text-center text-sm text-slate-400 pt-10">Aucun message. Écrivez le premier !</p>}
//         {messages.map((m, i) => {
//           const mine = m.senderId === myId
//           const prev = messages[i - 1]
//           const newDay = !prev || dayLabel(prev) !== dayLabel(m)
//           const showName = !mine && (!prev || prev.senderId !== m.senderId || newDay)
//           const isSel = selectedId === m.id
//           const reactions = Object.entries(m.reactions ?? {}).filter(([, u]) => u.length > 0)
//           return (
//             <div key={m.id}>
//               {newDay && <div className="text-center my-3"><span className="text-[11px] text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-1 capitalize">{dayLabel(m)}</span></div>}
//               <div id={`msg-${m.id}`} className={`flex flex-col ${mine ? "items-end" : "items-start"} ${showName ? "mt-2" : ""}`}>
//                 {showName && (
//                   <span className="text-[11px] font-semibold text-slate-500 mb-0.5 px-1">
//                     {m.senderName}{m.senderRole === "admin" && <span className="ml-1 text-primary-600">· Admin</span>}
//                   </span>
//                 )}
//                 <div
//                   onClick={(e) => { e.stopPropagation(); setSelectedId(isSel ? null : m.id) }}
//                   className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 py-2 text-sm cursor-pointer transition shadow-sm break-words whitespace-pre-wrap
//                     ${mine ? `${emp ? "bg-gradient-to-br from-primary-600 to-primary-500 shadow-primary-600/20" : "bg-primary-600"} text-white rounded-br-md` : "bg-white text-slate-800 border border-slate-200 rounded-bl-md"}
//                     ${isSel ? "ring-2 ring-primary-400" : ""} ${highlightId === m.id ? "ring-2 ring-amber-400" : ""}`}
//                 >
//                   {m.replyTo && (
//                     <button
//                       onClick={(e) => { e.stopPropagation(); jumpTo(m.replyTo!.id) }}
//                       className={`block w-full text-left mb-1.5 rounded-lg px-2 py-1 border-l-4 text-xs ${
//                         mine ? "bg-white/15 border-white/70" : "bg-slate-100 border-primary-400"}`}
//                     >
//                       <span className="font-semibold block truncate">{m.replyTo.senderName}</span>
//                       <span className="block truncate opacity-80">{m.replyTo.text}</span>
//                     </button>
//                   )}
//                   {m.text}
//                   <span className={`flex items-center justify-end gap-1 text-[10px] mt-0.5 ${mine ? "text-white/70" : "text-slate-400"}`}>
//                     {time(m)}
//                     {mine && (() => {
//                       if (m.id !== lastMineId) return null
//                       return seenBy(m).length === 0
//                         ? <Check className="w-3 h-3" aria-label="Envoyé" />
//                         : <CheckCheck className="w-3.5 h-3.5 text-sky-200" aria-label="Vu" />
//                     })()}
//                   </span>
//                 </div>

//                 {(() => {
//                   const viewers = seenBy(m)
//                   if (viewers.length === 0) return null
//                   const shown = viewers.slice(0, 6)
//                   return (
//                     <div className="flex items-center gap-0.5 mt-1 px-1" aria-label={`Vu par ${viewers.map((r) => r.name).join(", ")}`}>
//                       {shown.map((r) => (
//                         <span key={r.userId} title={r.name}
//                           className={`w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center border border-white ${
//                             r.role === "admin" ? "bg-primary-600 text-white" : "bg-emerald-500 text-white"}`}>
//                           {(r.name || "?").trim().charAt(0).toUpperCase()}
//                         </span>
//                       ))}
//                       {viewers.length > shown.length && <span className="text-[10px] text-slate-500 ml-0.5">+{viewers.length - shown.length}</span>}
//                     </div>
//                   )
//                 })()}

//                 {reactions.length > 0 && (
//                   <div className="flex flex-wrap gap-1 mt-1 px-1">
//                     {reactions.map(([emoji, uids]) => (
//                       <button key={emoji} onClick={(e) => { e.stopPropagation(); react(m, emoji) }}
//                         className={`text-xs px-1.5 py-0.5 rounded-full border flex items-center gap-1 ${
//                           uids.includes(myId) ? "bg-primary-50 border-primary-300 text-primary-700" : "bg-white border-slate-200 text-slate-600"}`}>
//                         <span>{emoji}</span><span className="font-semibold">{uids.length}</span>
//                       </button>
//                     ))}
//                   </div>
//                 )}

//                 {isSel && mine && m.id === lastMineId && chat.type === "group" && (
//                   <div onClick={(e) => e.stopPropagation()} className="mt-1.5 text-[11px] text-slate-500 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 max-w-[85%]">
//                     {seenBy(m).length > 0
//                       ? <>Vu par : <span className="font-semibold text-slate-700">{seenBy(m).map((r) => r.name).join(", ")}</span></>
//                       : "Pas encore vu"}
//                   </div>
//                 )}
//                 {isSel && (
//                   <div onClick={(e) => e.stopPropagation()} className="mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-lg px-2 py-1.5 flex items-center gap-1 flex-wrap">
//                     {QUICK_REACTIONS.map((e) => (
//                       <button key={e} onClick={() => react(m, e)}
//                         className={`text-lg w-8 h-8 rounded-full hover:bg-slate-100 ${m.reactions?.[e]?.includes(myId) ? "bg-primary-50" : ""}`}>{e}</button>
//                     ))}
//                     <span className="w-px h-6 bg-slate-200 mx-1" />
//                     <button onClick={() => startReply(m)} className="px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1"><Reply className="w-4 h-4" />Répondre</button>
//                     <button onClick={() => { navigator.clipboard?.writeText(m.text).catch(() => {}); setSelectedId(null) }}
//                       className="px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1"><Copy className="w-4 h-4" />Copier</button>
//                     {isAdmin && (
//                       <button onClick={() => remove(m)} className="px-2 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-1"><Trash2 className="w-4 h-4" />Supprimer</button>
//                     )}
//                   </div>
//                 )}
//               </div>
//             </div>
//           )
//         })}
//         <div ref={bottomRef} />
//       </div>

//       {chat.announcement && !isAdmin ? (
//         <footer className="border-t border-slate-200 bg-white p-3 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
//           <Megaphone className="w-4 h-4" /> Groupe d'annonces : lecture seule
//         </footer>
//       ) : (
//       <footer className={`border-t border-slate-200 bg-white space-y-2 ${emp ? "p-3" : "p-2.5"}`}>
//         {replyTo && (
//           <div className="flex items-start gap-2 bg-slate-100 border-l-4 border-primary-500 rounded-lg px-3 py-1.5">
//             <Reply className="w-4 h-4 text-primary-600 mt-0.5 shrink-0" />
//             <div className="flex-1 min-w-0 text-xs">
//               <div className="font-semibold text-slate-700 truncate">Réponse à {replyTo.senderName}</div>
//               <div className="text-slate-500 truncate">{replyTo.text}</div>
//             </div>
//             <button onClick={() => setReplyTo(null)} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Annuler la réponse"><X className="w-4 h-4" /></button>
//           </div>
//         )}
//         <div className="flex items-end gap-2">
//           <textarea
//             id="chat-input"
//             value={text}
//             rows={1}
//             maxLength={MAX_MESSAGE_LENGTH}
//             onChange={(e) => setText(e.target.value)}
//             onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(hover: hover)").matches) { e.preventDefault(); handleSend() } }}
//             placeholder="Écrire un message..."
//             className="flex-1 resize-none max-h-32 border border-slate-300 rounded-3xl px-4 py-2.5 text-base sm:text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
//           />
//           <button onClick={handleSend} disabled={!text.trim() || sending} aria-label="Envoyer"
//             className="w-11 h-11 rounded-full bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center disabled:opacity-50 shrink-0">
//             <Send className="w-5 h-5" />
//           </button>
//         </div>
//       </footer>
//       )}
//     </>
//   )
// }
