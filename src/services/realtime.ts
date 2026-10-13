// src/services/realtime.ts
//
// Mises à jour en direct (messagerie, matériel, permissions, contrôles de présence).
// L'API envoie de petits événements sur un WebSocket ({ type: "message.created", chatId, … }) ;
// l'écran recharge alors ses données par l'API REST. Si le WebSocket n'est pas disponible,
// `live()` retombe sur un rafraîchissement périodique : l'application reste utilisable.
import { API_URL, MOCK_MODE, getAccessToken, refreshSession } from "./api"

export interface RealtimeEvent { type: string; [key: string]: any }
type Handler = (e: RealtimeEvent) => void

function wsUrl(): string {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL
  const base = API_URL.startsWith("http") ? API_URL : `${window.location.origin}${API_URL}`
  return `${base.replace(/^http/, "ws")}/ws`
}

const handlers = new Map<string, Set<Handler>>()
let socket: WebSocket | null = null
let connected = false
let running = false
let retry = 0
let retryTimer: ReturnType<typeof setTimeout> | undefined

function dispatch(e: RealtimeEvent) {
  handlers.get(e.type)?.forEach((h) => h(e))
  handlers.get("*")?.forEach((h) => h(e))
}

function connect() {
  const token = getAccessToken()
  // Mode démo : pas de serveur WebSocket, le faux serveur diffuse ses événements lui-même.
  if (!running || !token || MOCK_MODE) return
  let ws: WebSocket
  try {
    ws = new WebSocket(`${wsUrl()}?token=${encodeURIComponent(token)}`)
  } catch {
    scheduleReconnect()
    return
  }
  socket = ws
  ws.onopen = () => {
    connected = true
    retry = 0
    dispatch({ type: "resync" }) // rattrape ce qui a pu être manqué pendant la coupure
  }
  ws.onmessage = (msg) => {
    try { dispatch(JSON.parse(String(msg.data))) } catch { /* message illisible : ignoré */ }
  }
  ws.onclose = async (ev) => {
    connected = false
    socket = null
    if (!running) return
    if (ev.code === 4401) await refreshSession() // jeton expiré : on en reprend un avant de se reconnecter
    scheduleReconnect()
  }
  ws.onerror = () => ws.close()
}

function scheduleReconnect() {
  clearTimeout(retryTimer)
  if (!running) return
  const delay = Math.min(30000, 1000 * 2 ** retry++)
  retryTimer = setTimeout(connect, delay)
}

/** Ouvre le canal temps réel (appelé une fois la session établie). */
export function startRealtime() {
  if (running) return
  running = true
  retry = 0
  connect()
}

export function stopRealtime() {
  running = false
  clearTimeout(retryTimer)
  socket?.close()
  socket = null
  connected = false
}

export const isRealtimeConnected = () => connected

/**
 * Diffuse un événement localement après une action de l'utilisateur : ses propres écrans se
 * mettent à jour tout de suite, sans attendre l'écho du serveur (ni le prochain rafraîchissement).
 */
export function emitLocal(e: RealtimeEvent) {
  dispatch(e)
}

/** Écoute des types d'événements ("*" = tous). Retourne la fonction de désinscription. */
export function onEvents(types: string[], cb: Handler): () => void {
  for (const t of types) {
    if (!handlers.has(t)) handlers.set(t, new Set())
    handlers.get(t)!.add(cb)
  }
  return () => types.forEach((t) => handlers.get(t)?.delete(cb))
}

interface LiveOptions {
  /** Événements qui déclenchent un rechargement. */
  events: string[]
  /** Ne recharger que si l'événement concerne cet élément (ex. chatId). */
  filter?: (e: RealtimeEvent) => boolean
  /** Rafraîchissement périodique quand le temps réel est indisponible (ms). */
  pollMs?: number
  onError?: (e: unknown) => void
}

/**
 * Charge une donnée puis la tient à jour : à chaque événement pertinent, au retour au premier
 * plan, et périodiquement si le WebSocket est coupé. Retourne la fonction de désinscription.
 */
export function live<T>(load: () => Promise<T>, cb: (value: T) => void, opts: LiveOptions): () => void {
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let seq = 0

  const reload = () => {
    const id = ++seq
    load()
      .then((v) => { if (!stopped && id === seq) cb(v) })
      .catch((e) => { if (!stopped) opts.onError?.(e) })
  }
  // Plusieurs événements rapprochés → un seul rechargement.
  const soon = () => { clearTimeout(timer); timer = setTimeout(reload, 150) }

  reload()
  const off = onEvents([...opts.events, "resync"], (e) => {
    if (e.type === "resync" || !opts.filter || opts.filter(e)) soon()
  })
  const poll = setInterval(() => {
    if (!connected && !document.hidden) reload()
  }, opts.pollMs ?? 15000)
  const onVisible = () => { if (!document.hidden) soon() }
  document.addEventListener("visibilitychange", onVisible)

  return () => {
    stopped = true
    clearTimeout(timer)
    clearInterval(poll)
    off()
    document.removeEventListener("visibilitychange", onVisible)
  }
}
