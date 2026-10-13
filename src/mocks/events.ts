// src/mocks/events.ts
//
// « Temps réel » du mode démo : un événement est diffusé dans l'onglet courant et, via le
// localStorage, dans les autres onglets ouverts (ex. l'admin dans un onglet voit arriver le
// message envoyé par un salarié dans un autre). La session de chaque onglet est dans sessionStorage.
import { emitLocal, type RealtimeEvent } from "../services/realtime"
import { DB_KEY, reloadDb } from "./store"

const EVENT_KEY = "pointage_mock_event"
export const SESSION_KEY = "pointage_mock_session"

export function sessionUserId(): string | null {
  try { return sessionStorage.getItem(SESSION_KEY) } catch { return null }
}

export function setSessionUserId(id: string | null) {
  try {
    if (id) sessionStorage.setItem(SESSION_KEY, id)
    else sessionStorage.removeItem(SESSION_KEY)
  } catch { /* ignore */ }
}

/** Diffuse un événement ; `to` = ids des utilisateurs concernés (tous si absent). */
export function publish(event: RealtimeEvent, to?: string[]) {
  const me = sessionUserId()
  if (!to || (me && to.includes(me))) setTimeout(() => emitLocal(event), 0)
  try { localStorage.setItem(EVENT_KEY, JSON.stringify({ event, to: to ?? null, nonce: Math.random() })) } catch { /* ignore */ }
}

let listening = false
export function listenOtherTabs() {
  if (listening || typeof window === "undefined") return
  listening = true
  window.addEventListener("storage", (e) => {
    if (e.key === DB_KEY) {
      // Données modifiées dans un autre onglet : on relit la base et les écrans se rechargent.
      reloadDb()
      emitLocal({ type: "resync" })
    } else if (e.key === EVENT_KEY && e.newValue) {
      try {
        const { event, to } = JSON.parse(e.newValue) as { event: RealtimeEvent; to: string[] | null }
        const me = sessionUserId()
        if (!to || (me && to.includes(me))) emitLocal(event)
      } catch { /* ignore */ }
    }
  })
}
