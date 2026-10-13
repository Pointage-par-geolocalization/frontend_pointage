// src/hooks/usePresenceTracker.ts
//
// Côté salarié, pendant une session de pointage ouverte : transmet la position au serveur
// régulièrement (application au premier plan) et à chaque demande de contrôle du serveur.
// Le serveur compare cette position à la zone autorisée du chantier lors des contrôles horaires.
import { useCallback, useEffect, useRef, useState } from "react"
import { listMySessionsToday } from "../services/attendance"
import { onPresenceRequest, pingPresence, type PingResult } from "../services/presence"
import { getCurrentLocation } from "../utils/geolocation"
import { notify } from "../services/notify"

const PING_EVERY_MS = 10 * 60 * 1000

export function usePresenceTracker(enabled: boolean) {
  const [lastResult, setLastResult] = useState<PingResult | null>(null)
  const busy = useRef(false)

  const ping = useCallback(async (requested: boolean) => {
    if (busy.current) return
    busy.current = true
    try {
      // Contrôle périodique : seulement si une session est ouverte (évite de solliciter le GPS pour rien).
      if (!requested) {
        const sessions = await listMySessionsToday()
        if (!sessions.some((s) => s.status === "EN_COURS")) return
      }
      const loc = await getCurrentLocation()
      setLastResult(await pingPresence(loc))
    } catch {
      // Pas de session ouverte, GPS indisponible… : le contrôle serveur conclura « absence détectée ».
      if (requested && document.hidden) {
        notify({
          key: "presence-check",
          title: "Contrôle de présence",
          body: "Ouvrez l'application pour confirmer votre position sur le chantier.",
          route: "/employe",
          channel: "alerts",
        })
      }
    } finally {
      busy.current = false
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    const first = setTimeout(() => ping(false), 5000)
    const timer = setInterval(() => { if (!document.hidden) ping(false) }, PING_EVERY_MS)
    const offRequest = onPresenceRequest(() => ping(true))
    const onVisible = () => { if (!document.hidden) ping(false) }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
      offRequest()
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [enabled, ping])

  return { lastResult, clearResult: () => setLastResult(null) }
}
