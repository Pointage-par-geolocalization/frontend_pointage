// src/utils/geolocation.ts
import { Capacitor } from "@capacitor/core"
import { Geolocation } from "@capacitor/geolocation"

export interface LocationSnapshot {
  latitude: number
  longitude: number
  altitude: number | null
  accuracy: number
  address?: string
}

/**
 * Récupère la position GPS.
 * - Dans l'app native (Android/iOS via Capacitor) : utilise le plugin
 *   @capacitor/geolocation, qui passe par l'API native Google Play
 *   Services (FusedLocationProviderClient). Beaucoup plus fiable que
 *   navigator.geolocation dans une WebView, qui est connu pour timeout
 *   fréquemment sur Android.
 * - Dans un navigateur web classique (PWA / desktop) : navigator.geolocation.
 */
export async function getCurrentLocation(): Promise<LocationSnapshot> {
  if (Capacitor.isNativePlatform()) {
    return getCurrentLocationNative()
  }
  return getCurrentLocationWeb()
}

async function getCurrentLocationNative(): Promise<LocationSnapshot> {
  try {
    const perm = await Geolocation.checkPermissions()
    if (perm.location !== "granted") {
      const requested = await Geolocation.requestPermissions()
      if (requested.location !== "granted") {
        throw new Error("Permission de localisation refusée. Activez la localisation et réessayez.")
      }
    }

    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 20000,
      // Si les paramètres de localisation de Google Play Services échouent
      // (pas de connexion réseau, mode avion...), on retombe sur le
      // LocationManager Android standard au lieu d'échouer directement.
      enableLocationFallback: true,
    } as any) // `enableLocationFallback` n'est pas encore dans les types TS du plugin

    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      altitude: pos.coords.altitude,
      accuracy: pos.coords.accuracy,
    }
  } catch (e: any) {
    const msg = (e?.message ?? "") as string
    if (msg.toLowerCase().includes("denied") || msg.includes("refusée")) {
      throw new Error("Permission de localisation refusée. Activez la localisation et réessayez.")
    }
    if (msg.toLowerCase().includes("location services") || msg.toLowerCase().includes("settings")) {
      throw new Error("Le GPS semble désactivé. Activez la localisation dans les réglages du téléphone.")
    }
    throw new Error("Impossible d'obtenir votre localisation. Vérifiez que le GPS est activé et réessayez.")
  }
}

function getCurrentLocationWeb(): Promise<LocationSnapshot> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("La géolocalisation n'est pas supportée par cet appareil."))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          altitude: pos.coords.altitude,
          accuracy: pos.coords.accuracy,
        })
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error("Permission de localisation refusée. Activez la localisation et réessayez."))
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          reject(new Error("Impossible d'obtenir votre localisation. Vérifiez que le GPS est activé."))
        } else {
          reject(new Error("Délai dépassé lors de la récupération de la position."))
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  })
}

/** Reverse geocoding léger via Nominatim (OpenStreetMap) — best effort, non bloquant (timeout 5 s). */
export async function reverseGeocode(lat: number, lng: number): Promise<string | undefined> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 5000)
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      { signal: ctrl.signal }
    )
    if (!res.ok) return undefined
    const data = await res.json()
    return typeof data.display_name === "string" ? data.display_name : undefined
  } catch {
    return undefined
  } finally {
    clearTimeout(timer)
  }
}

export interface PlaceResult { label: string; latitude: number; longitude: number }

/** Recherche d'adresse (géocodage direct) via Nominatim — utilisé par le sélecteur de carte. */
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const q = query.trim()
  if (!q) return []
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`
  )
  if (!res.ok) throw new Error("Recherche indisponible pour le moment.")
  const data = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>
  return data.map((r) => ({ label: r.display_name, latitude: parseFloat(r.lat), longitude: parseFloat(r.lon) }))
}
