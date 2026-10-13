// src/hooks/useGeolocation.ts
import { useState, useCallback } from "react"
import { getCurrentLocation, reverseGeocode, type LocationSnapshot } from "../utils/geolocation"

export function useGeolocation() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const capture = useCallback(async (): Promise<LocationSnapshot | null> => {
    setLoading(true)
    setError(null)
    try {
      const loc = await getCurrentLocation()
      const address = await reverseGeocode(loc.latitude, loc.longitude)
      // L'adresse (géocodage inverse) est facultative : on ne l'ajoute que si elle existe.
      return address ? { ...loc, address } : loc
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de localisation.")
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return { capture, loading, error, clearError }
}
