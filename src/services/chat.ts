// src/services/chat.ts
//
// Messagerie interne : groupes créés par l'admin que les salariés peuvent rejoindre (ou groupes
// « annonce » en lecture seule) et conversations directes admin ↔ salarié (une par salarié).
// L'admin n'a pas besoin d'être membre : il voit et écrit dans toutes les conversations.
// L'expéditeur (nom, rôle) est déduit de la session par le serveur.
import { del, get, post, put } from "./api"
import { emitLocal, live, type RealtimeEvent } from "./realtime"

export type ChatType = "group" | "direct"

export interface Chat {
  id: string
  type: ChatType
  name: string // nom du groupe (vide pour un message direct)
  /** Comptes membres (ids utilisateur). */
  memberIds: string[]
  createdAt: string
  /** Groupe « annonce » : seul l'admin écrit, les salariés lisent uniquement. */
  announcement: boolean
  /** Message direct : le salarié concerné. */
  directUserId?: string | null
  directEmployeeName?: string | null
  lastMessageText?: string | null
  lastMessageAt?: string | null
  lastMessageBy?: string | null
  lastMessageName?: string | null
  /** Messages des autres arrivés depuis ma dernière lecture. */
  unreadCount: number
}

export interface ReplyRef { id: string; senderName: string; text: string }

export interface ChatMessage {
  id: string
  senderId: string | null
  senderName: string
  senderRole: "admin" | "employee"
  text: string
  createdAt: string
  replyTo?: ReplyRef | null
  /** emoji → ids des utilisateurs qui ont réagi */
  reactions: Record<string, string[]>
}

/** Accusé « Vu » : dernier moment où la personne a vu la conversation. */
export interface ReadReceipt { userId: string; name: string; role: "admin" | "employee"; seenAt: string }

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"]
export const MAX_MESSAGE_LENGTH = 2000

const CHAT_EVENTS = ["chat.updated", "chat.deleted", "chat.cleared", "chat.read", "message.created", "message.deleted"]
const forChat = (chatId: string) => (e: RealtimeEvent) => e.chatId === chatId

const lastActivity = (c: Chat) => Date.parse(c.lastMessageAt ?? c.createdAt) || 0

/**
 * Conversations visibles, tenues à jour en direct (admin : toutes ; salarié : les siennes
 * + tous les groupes, pour pouvoir les rejoindre), de la plus récente à la plus ancienne.
 */
export const subscribeChats = (cb: (chats: Chat[]) => void, onError?: (e: unknown) => void) =>
  live(
    () => get<Chat[]>("/chats").then((list) => list.sort((a, b) => lastActivity(b) - lastActivity(a))),
    cb,
    { events: CHAT_EVENTS, onError, pollMs: 10000 },
  )

/** Les 300 derniers messages, du plus ancien au plus récent. */
export const subscribeMessages = (chatId: string, cb: (msgs: ChatMessage[]) => void, onError?: (e: unknown) => void) =>
  live(() => get<ChatMessage[]>(`/chats/${chatId}/messages`, { limit: 300 }), cb, {
    events: ["message.created", "message.deleted", "message.reactions", "chat.cleared"], filter: forChat(chatId), onError, pollMs: 5000,
  })

export const subscribeReads = (chatId: string, cb: (reads: ReadReceipt[]) => void, onError?: (e: unknown) => void) =>
  live(() => get<ReadReceipt[]>(`/chats/${chatId}/reads`), cb, {
    events: ["chat.read", "chat.cleared"], filter: forChat(chatId), onError, pollMs: 10000,
  })

/** « Vu » + remise à zéro du compteur de non-lus de cette conversation. */
export const markSeen = (chatId: string) => put(`/chats/${chatId}/read`).then(() => emitLocal({ type: "chat.read", chatId }))

export const createGroup = (name: string, announcement = false) =>
  post<{ id: string }>("/chats/groups", { name: name.trim(), announcement }).then((r) => { emitLocal({ type: "chat.updated", chatId: r.id }); return r.id })

/** Ouvre (ou retrouve) la conversation directe avec un salarié : jamais de doublon. */
export const openDirectChat = (employeeCode: string) =>
  post<{ id: string }>("/chats/direct", { employeeCode }).then((r) => { emitLocal({ type: "chat.updated", chatId: r.id }); return r.id })

export const joinGroup = (chatId: string) => post(`/chats/${chatId}/join`).then(() => emitLocal({ type: "chat.updated", chatId }))
export const leaveGroup = (chatId: string) => post(`/chats/${chatId}/leave`).then(() => emitLocal({ type: "chat.updated", chatId }))

export async function sendMessage(chatId: string, text: string, replyTo: ReplyRef | null) {
  const clean = text.trim().slice(0, MAX_MESSAGE_LENGTH)
  if (!clean) return
  await post(`/chats/${chatId}/messages`, { text: clean, replyToId: replyTo?.id ?? null })
  emitLocal({ type: "message.created", chatId })
}

/** Ajoute ou retire ma réaction `emoji` sur un message. */
export const toggleReaction = (chatId: string, messageId: string, emoji: string) =>
  put(`/chats/${chatId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`).then(() => emitLocal({ type: "message.reactions", chatId }))

/** ADMIN — supprime tous les messages et accusés de lecture ; la conversation et ses membres restent. */
export const clearConversation = (chatId: string) => post(`/chats/${chatId}/clear`).then(() => emitLocal({ type: "chat.cleared", chatId }))

/** ADMIN — supprime définitivement la conversation et ses messages. */
export const deleteChat = (chatId: string) => del(`/chats/${chatId}`).then(() => emitLocal({ type: "chat.deleted", chatId }))

export const deleteMessage = (chatId: string, messageId: string) =>
  del(`/chats/${chatId}/messages/${messageId}`).then(() => emitLocal({ type: "message.deleted", chatId }))
