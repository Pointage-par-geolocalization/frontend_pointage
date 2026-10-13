// src/contexts/ChatContext.tsx
// État partagé de la messagerie : conversations et compteurs de non-lus (fournis par le serveur,
// donc identiques sur tous les appareils). Monté dans les layouts admin et salarié, donc actif
// sur toutes les pages, pas seulement dans l'onglet Discussions.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import { initNotifications, notify } from "../services/notify"
import { markSeen, subscribeChats, type Chat } from "../services/chat"
import { millis } from "../utils/format"

interface ChatContextValue {
  chats: Chat[]
  loaded: boolean
  error: boolean
  /** Nombre total de nouveaux messages (pour le badge de navigation). */
  unreadTotal: number
  /** Nombre de nouveaux messages dans une conversation. */
  unreadFor: (chatId: string) => number
  /** Marque une conversation comme lue (« Vu » + compteur remis à zéro). */
  markRead: (chatId: string) => void
}

const ChatContext = createContext<ChatContextValue>({
  chats: [], loaded: false, error: false, unreadTotal: 0, unreadFor: () => 0, markRead: () => {},
})

export const useChat = () => useContext(ChatContext)

export function ChatProvider({ children }: { children: ReactNode }) {
  const { appUser } = useAuth()
  const uid = appUser?.id ?? ""
  const isAdmin = appUser?.role === "admin"

  const [chats, setChats] = useState<Chat[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  // Conversations lues localement en attendant le prochain rechargement (évite le clignotement du badge).
  const [readAt, setReadAt] = useState<Record<string, number>>({})
  const navigate = useNavigate()
  const seenLast = useRef(new Map<string, number>()) // dernier message connu par conversation
  const mountedAt = useRef(Date.now())

  useEffect(() => {
    if (!uid) return
    return subscribeChats((c) => { setChats(c); setLoaded(true); setError(false) },
      () => { setLoaded(true); setError(true) })
  }, [uid])

  useEffect(() => { if (uid) initNotifications((route) => navigate(route)) }, [uid]) // eslint-disable-line react-hooks/exhaustive-deps

  const isMine = useCallback((c: Chat) => isAdmin || c.memberIds.includes(uid), [isAdmin, uid])

  // Nouveau message d'un autre alors que l'application est réduite / en arrière-plan → notification locale.
  useEffect(() => {
    if (!uid || !loaded) return
    for (const c of chats) {
      if (!isMine(c)) continue
      const last = millis(c.lastMessageAt)
      if (!last) continue
      const prev = seenLast.current.get(c.id)
      const isNew = prev !== undefined ? last > prev : last > mountedAt.current
      seenLast.current.set(c.id, Math.max(last, prev ?? 0))
      if (!isNew || c.lastMessageBy === uid || !document.hidden) continue

      const title = c.type === "group" ? c.name : (isAdmin ? (c.directEmployeeName ?? "Salarié") : "Administrateur")
      const body = c.type === "group" && c.lastMessageName ? `${c.lastMessageName} : ${c.lastMessageText ?? ""}` : (c.lastMessageText ?? "Nouveau message")
      notify({ key: c.id, title, body, route: isAdmin ? "/admin/discussions" : "/employe/discussions" })
    }
  }, [chats, loaded, uid, isAdmin, isMine])

  const markRead = useCallback((chatId: string) => {
    const chat = chats.find((c) => c.id === chatId)
    if (!chat || (chat.unreadCount === 0 && (readAt[chatId] ?? 0) >= millis(chat.lastMessageAt))) return
    // Horodatage serveur du dernier message (pas l'horloge du téléphone, qui peut dériver).
    setReadAt((prev) => ({ ...prev, [chatId]: millis(chat.lastMessageAt) }))
    markSeen(chatId).catch(() => {})
  }, [chats, readAt])

  const unreadFor = useCallback((chatId: string) => {
    const c = chats.find((x) => x.id === chatId)
    if (!c || !isMine(c)) return 0
    // Lu localement après le dernier message connu : 0 en attendant la confirmation du serveur.
    if ((readAt[chatId] ?? 0) >= millis(c.lastMessageAt)) return 0
    return c.unreadCount
  }, [chats, readAt, isMine])

  const value = useMemo<ChatContextValue>(() => ({
    chats, loaded, error,
    unreadTotal: chats.reduce((sum, c) => sum + unreadFor(c.id), 0),
    unreadFor,
    markRead,
  }), [chats, loaded, error, unreadFor, markRead])

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
