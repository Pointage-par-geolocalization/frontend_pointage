// src/mocks/handlers/chat.ts — messagerie : groupes, annonces, messages directs, réactions, « Vu », non-lus.
import { fail, invalid, notFound, route, str } from "../router"
import type { MockDb, MockUser, StoredChat } from "../store"
import type { Chat } from "../../services/chat"
import { MAX_MESSAGE_LENGTH, QUICK_REACTIONS } from "../../services/chat"
import { publish } from "../events"
import { uid } from "../util"
import { findEmployee, nameOf, requireFound, userOfEmployee } from "./shared"

const nowIso = () => new Date().toISOString()

const isMember = (c: StoredChat, u: MockUser) => c.memberIds.includes(u.id)
const canRead = (c: StoredChat, u: MockUser) => u.role === "admin" || isMember(c, u)
/** Salarié : ses conversations + tous les groupes (pour pouvoir les rejoindre). */
const canSee = (c: StoredChat, u: MockUser) => u.role === "admin" || c.type === "group" || c.directUserId === u.id

function chatFor(db: MockDb, u: MockUser, id: string) {
  const c = requireFound(db.chats.find((x) => x.id === id), "Conversation introuvable.")
  if (!canRead(c, u)) fail(403, "FORBIDDEN", "Vous ne faites pas partie de cette conversation.")
  return c
}

function view(db: MockDb, c: StoredChat, u: MockUser): Chat {
  const seen = db.reads.find((r) => r.chatId === c.id && r.userId === u.id)?.seenAt ?? ""
  const unreadCount = canRead(c, u)
    ? db.messages.filter((m) => m.chatId === c.id && m.senderId !== u.id && m.createdAt > seen).length
    : 0
  const directUser = c.directUserId ? db.users.find((x) => x.id === c.directUserId) : undefined
  return { ...c, unreadCount, directEmployeeName: directUser?.employeeCode ? nameOf(db, directUser.employeeCode) : null }
}

const changed = (type: string, chatId: string) => publish({ type, chatId })

function markRead(db: MockDb, chatId: string, u: MockUser) {
  const r = db.reads.find((x) => x.chatId === chatId && x.userId === u.id)
  if (r) r.seenAt = nowIso()
  else db.reads.push({ chatId, userId: u.id, name: u.name, role: u.role, seenAt: nowIso() })
}

route("GET", "/chats", "any", ({ db, user }) => db.chats.filter((c) => canSee(c, user)).map((c) => view(db, c, user)))

route("POST", "/chats/groups", "admin", ({ db, body }) => {
  const name = str(body.name)
  if (!name) invalid("Le nom du groupe est obligatoire.")
  const c: StoredChat = {
    id: uid(), type: "group", name: name.slice(0, 60), announcement: body.announcement === true, memberIds: [], createdAt: nowIso(),
    directUserId: null, lastMessageText: null, lastMessageAt: null, lastMessageBy: null, lastMessageName: null,
  }
  db.chats.push(c)
  changed("chat.updated", c.id)
  return { id: c.id }
})

route("POST", "/chats/direct", "admin", ({ db, body }) => {
  const e = findEmployee(db, str(body.employeeCode))
  const u = requireFound(userOfEmployee(db, e.employeeCode), "Ce salarié n'a pas de compte de connexion.")
  let c = db.chats.find((x) => x.type === "direct" && x.directUserId === u.id)
  if (!c) {
    c = { id: uid(), type: "direct", name: "", announcement: false, memberIds: [u.id], createdAt: nowIso(), directUserId: u.id, lastMessageText: null, lastMessageAt: null, lastMessageBy: null, lastMessageName: null }
    db.chats.push(c)
    changed("chat.updated", c.id)
  }
  return { id: c.id }
})

route("POST", "/chats/:id/join", "employee", ({ db, user, params }) => {
  const c = requireFound(db.chats.find((x) => x.id === params.id && x.type === "group"), "Groupe introuvable.")
  if (!isMember(c, user)) c.memberIds.push(user.id)
  changed("chat.updated", c.id)
})

route("POST", "/chats/:id/leave", "employee", ({ db, user, params }) => {
  const c = requireFound(db.chats.find((x) => x.id === params.id && x.type === "group"), "Groupe introuvable.")
  c.memberIds = c.memberIds.filter((id) => id !== user.id)
  changed("chat.updated", c.id)
})

route("GET", "/chats/:id/messages", "any", ({ db, user, params, query }) => {
  const c = chatFor(db, user, params.id)
  const limit = Number(query.get("limit") ?? 300)
  return db.messages.filter((m) => m.chatId === c.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-limit)
    .map(({ chatId: _c, ...m }) => { void _c; return m })
})

route("POST", "/chats/:id/messages", "any", ({ db, user, params, body }) => {
  const c = chatFor(db, user, params.id)
  if (c.announcement && user.role !== "admin") fail(403, "ANNOUNCEMENT_READ_ONLY", "Groupe d'annonces : seul l'administrateur peut écrire.")
  const text = str(body.text)
  if (!text) invalid("Le message est vide.")
  if (text.length > MAX_MESSAGE_LENGTH) invalid(`Message trop long (${MAX_MESSAGE_LENGTH} caractères maximum).`)
  const quoted = body.replyToId ? db.messages.find((m) => m.id === body.replyToId && m.chatId === c.id) : undefined
  const m = {
    id: uid(), chatId: c.id, senderId: user.id, senderName: user.name, senderRole: user.role, text, createdAt: nowIso(),
    replyTo: quoted ? { id: quoted.id, senderName: quoted.senderName, text: quoted.text.slice(0, 140) } : null, reactions: {},
  }
  db.messages.push(m)
  Object.assign(c, { lastMessageText: text.slice(0, 120), lastMessageAt: m.createdAt, lastMessageBy: user.id, lastMessageName: user.name })
  markRead(db, c.id, user)
  changed("message.created", c.id)
})

route("PUT", "/chats/:id/messages/:mid/reactions/:emoji", "any", ({ db, user, params }) => {
  const c = chatFor(db, user, params.id)
  if (!QUICK_REACTIONS.includes(params.emoji)) invalid("Réaction non autorisée.")
  const m = requireFound(db.messages.find((x) => x.id === params.mid && x.chatId === c.id), "Message introuvable.")
  const list = m.reactions[params.emoji] ?? []
  m.reactions[params.emoji] = list.includes(user.id) ? list.filter((id) => id !== user.id) : [...list, user.id]
  if (m.reactions[params.emoji].length === 0) delete m.reactions[params.emoji]
  changed("message.reactions", c.id)
})

route("DELETE", "/chats/:id/messages/:mid", "admin", ({ db, params }) => {
  const before = db.messages.length
  db.messages = db.messages.filter((m) => !(m.id === params.mid && m.chatId === params.id))
  if (db.messages.length === before) notFound("Message introuvable.")
  const c = db.chats.find((x) => x.id === params.id)
  const last = db.messages.filter((m) => m.chatId === params.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  if (c) Object.assign(c, { lastMessageText: last?.text.slice(0, 120) ?? null, lastMessageAt: last?.createdAt ?? null, lastMessageBy: last?.senderId ?? null, lastMessageName: last?.senderName ?? null })
  changed("message.deleted", params.id)
})

route("POST", "/chats/:id/clear", "admin", ({ db, params }) => {
  const c = requireFound(db.chats.find((x) => x.id === params.id), "Conversation introuvable.")
  db.messages = db.messages.filter((m) => m.chatId !== c.id)
  db.reads = db.reads.filter((r) => r.chatId !== c.id)
  Object.assign(c, { lastMessageText: null, lastMessageAt: null, lastMessageBy: null, lastMessageName: null })
  changed("chat.cleared", c.id)
})

route("DELETE", "/chats/:id", "admin", ({ db, params }) => {
  db.chats = db.chats.filter((c) => c.id !== params.id)
  db.messages = db.messages.filter((m) => m.chatId !== params.id)
  db.reads = db.reads.filter((r) => r.chatId !== params.id)
  changed("chat.deleted", params.id)
})

route("PUT", "/chats/:id/read", "any", ({ db, user, params }) => {
  const c = chatFor(db, user, params.id)
  markRead(db, c.id, user)
  changed("chat.read", c.id)
})

route("GET", "/chats/:id/reads", "any", ({ db, user, params }) => {
  const c = chatFor(db, user, params.id)
  return db.reads.filter((r) => r.chatId === c.id).map(({ chatId: _c, ...r }) => { void _c; return r })
})
