// src/services/notify.ts
//
// Notifications LOCALES de l'application Android (déclenchées par l'application elle-même, sans service de push).
// Elles s'affichent quand un événement arrive (nouveau message, décision sur une permission,
// contrôle de présence) alors que l'application est réduite ou en arrière-plan, tant qu'Android
// ne l'a pas complètement arrêtée. Application fermée (« tuée ») : pas de notification.

import { Capacitor } from "@capacitor/core"
import { LocalNotifications } from "@capacitor/local-notifications"

export type NotifyChannel = "messages" | "alerts"

let ready = false
let granted = false

const isNative = () => Capacitor.isNativePlatform()

/** Crée les canaux, demande la permission (Android 13+) et écoute le clic sur une notification. */
export async function initNotifications(onOpenRoute: (route: string) => void) {
  if (!isNative() || ready) return
  ready = true
  try {
    await LocalNotifications.createChannel({
      id: "messages", name: "Messages", description: "Nouveaux messages de la messagerie",
      importance: 5, visibility: 1, vibration: true,
    }).catch(() => {})
    await LocalNotifications.createChannel({
      id: "alerts", name: "Alertes", description: "Permissions, contrôles de présence",
      importance: 5, visibility: 1, vibration: true,
    }).catch(() => {})

    let perm = await LocalNotifications.checkPermissions()
    if (perm.display === "prompt" || perm.display === "prompt-with-rationale") perm = await LocalNotifications.requestPermissions()
    granted = perm.display === "granted"

    await LocalNotifications.addListener("localNotificationActionPerformed", (a) => {
      const route = a.notification.extra?.route as string | undefined
      if (route) onOpenRoute(route)
    })
  } catch (e) {
    console.warn("Notifications: initialisation impossible", e)
  }
}

// Id numérique stable par clé : une nouvelle notification remplace la précédente de la même clé.
const idFor = (key: string) => {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0
  return Math.abs(h) || 1
}

export async function notify(opts: { key: string; title: string; body: string; route: string; channel?: NotifyChannel }) {
  if (!isNative() || !granted) return
  try {
    await LocalNotifications.schedule({
      notifications: [{
        id: idFor(opts.key),
        title: opts.title,
        body: opts.body,
        channelId: opts.channel ?? "messages",
        smallIcon: "ic_stat_notify",
        extra: { route: opts.route, key: opts.key },
      }],
    })
  } catch (e) {
    console.warn("Notifications: envoi impossible", e)
  }
}
