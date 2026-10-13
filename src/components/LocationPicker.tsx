// src/components/LocationPicker.tsx
// Carte interactive pour choisir la position d'un lieu de travail :
// clic sur la carte, déplacement de l'épingle, recherche d'adresse ou
// "Ma position". Renvoie latitude / longitude via onChange.
import { useEffect, useRef, useState } from "react"
import { MapContainer, Marker, Circle, useMap, useMapEvents } from "react-leaflet"
import type { Marker as LeafletMarker } from "leaflet"
import { Search, LocateFixed, Loader2 } from "lucide-react"
import MapLayers from "./MapLayers"
import { pinIcon } from "./mapIcons"
import { getCurrentLocation, searchPlaces, type PlaceResult } from "../utils/geolocation"

export interface LatLng { latitude: number; longitude: number }

const DEFAULT_CENTER: LatLng = { latitude: -18.15, longitude: 49.4 } // Toamasina

interface Props {
  value: LatLng | null
  radiusMeters?: number
  onChange: (pos: LatLng) => void
}

function ClickHandler({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick({ latitude: e.latlng.lat, longitude: e.latlng.lng }) })
  return null
}

/** Recentre la carte quand la position change depuis l'extérieur (saisie, recherche, GPS). */
function Recenter({ value }: { value: LatLng | null }) {
  const map = useMap()
  useEffect(() => {
    if (!value) return
    const target: [number, number] = [value.latitude, value.longitude]
    if (!map.getBounds().contains(target)) map.setView(target, Math.max(map.getZoom(), 16))
  }, [value?.latitude, value?.longitude]) // eslint-disable-line react-hooks/exhaustive-deps
  // Le conteneur peut apparaître après un layout (formulaire déplié) : on recalcule la taille.
  useEffect(() => { const t = setTimeout(() => map.invalidateSize(), 150); return () => clearTimeout(t) }, [map])
  return null
}

export default function LocationPicker({ value, radiusMeters, onChange }: Props) {
  const markerRef = useRef<LeafletMarker>(null)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<PlaceResult[]>([])
  const [busy, setBusy] = useState<"search" | "gps" | null>(null)
  const [error, setError] = useState<string | null>(null)

  const center = value ?? DEFAULT_CENTER

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    e.stopPropagation()
    setBusy("search"); setError(null)
    try {
      const found = await searchPlaces(query)
      setResults(found)
      if (found.length === 0) setError("Aucun résultat pour cette recherche.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recherche impossible.")
    } finally { setBusy(null) }
  }

  async function handleLocate() {
    setBusy("gps"); setError(null)
    try {
      const loc = await getCurrentLocation()
      onChange({ latitude: loc.latitude, longitude: loc.longitude })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Position indisponible.")
    } finally { setBusy(null) }
  }

  function pickResult(r: PlaceResult) {
    onChange({ latitude: r.latitude, longitude: r.longitude })
    setResults([])
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Pas de <form> imbriqué (le picker est dans le formulaire du lieu) : Entrée déclenche la recherche. */}
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearch(e as unknown as React.FormEvent) }}
            placeholder="Rechercher une adresse ou un lieu..."
            className="w-full border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none transition"
          />
          {results.length > 0 && (
            <ul className="absolute z-[1000] left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-auto">
              {results.map((r, i) => (
                <li key={i}>
                  <button type="button" onClick={() => pickResult(r)}
                    className="w-full text-left text-xs px-3 py-2 hover:bg-slate-50 text-slate-700">
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="button" onClick={(e) => handleSearch(e as unknown as React.FormEvent)} disabled={busy !== null || !query.trim()}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50 flex items-center justify-center gap-2">
          {busy === "search" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Rechercher
        </button>
        <button type="button" onClick={handleLocate} disabled={busy !== null}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 flex items-center justify-center gap-2">
          {busy === "gps" ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
          Ma position
        </button>
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      <div className="rounded-xl overflow-hidden border border-slate-200 h-[55vh] min-h-[380px] sm:h-[65vh] sm:min-h-[480px] max-h-[720px] relative z-0">
        <MapContainer
          center={[center.latitude, center.longitude]}
          zoom={value ? 16 : 12}
          style={{ height: "100%", width: "100%" }}
        >
          <MapLayers />
          <ClickHandler onPick={onChange} />
          <Recenter value={value} />
          {value && (
            <>
              <Marker
                ref={markerRef}
                position={[value.latitude, value.longitude]}
                icon={pinIcon}
                draggable
                eventHandlers={{
                  dragend: () => {
                    const p = markerRef.current?.getLatLng()
                    if (p) onChange({ latitude: p.lat, longitude: p.lng })
                  },
                }}
              />
              {radiusMeters && radiusMeters > 0 && (
                <Circle
                  center={[value.latitude, value.longitude]}
                  radius={radiusMeters}
                  pathOptions={{ color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 0.15, weight: 2 }}
                />
              )}
            </>
          )}
        </MapContainer>
      </div>
      <p className="text-xs text-slate-500">
        Cliquez sur la carte ou déplacez l'épingle : la latitude et la longitude sont renseignées automatiquement.
      </p>
    </div>
  )
}
