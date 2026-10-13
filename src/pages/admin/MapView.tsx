// src/pages/admin/MapView.tsx
import { useEffect, useMemo, useState } from "react"
import { MapContainer, Marker, Popup, Circle, useMap } from "react-leaflet"
import L from "leaflet"
import { listAttendanceForDate, type Attendance } from "../../services/attendance"
import { listEmployees, employeeName, type Employee } from "../../services/employees"
import { listWorkplaces, hasValidCoords, type Workplace } from "../../services/workplaces"
import { todayKey } from "../../utils/date"
import { fmtDay, fmtTime } from "../../utils/format"
import { entryIcon, exitIcon, workplaceIcon } from "../../components/mapIcons"
import MapLayers from "../../components/MapLayers"
import Card from "../../components/Card"


type MarkerType = "ENTREE" | "SORTIE"
interface MapMarker {
  key: string
  type: MarkerType
  employeeName: string
  attendance: Attendance
  lat: number
  lng: number
  time?: string
}

const DEFAULT_CENTER: [number, number] = [-18.15, 49.4] // Toamasina par défaut

/** Ajuste la vue aux marqueurs à chaque changement (MapContainer ignore les changements de `center`). */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) { map.setView(points[0], 16); return }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 17 })
  }, [points, map])
  return null
}

export default function AdminMap() {
  const [date, setDate] = useState(todayKey())
  const [employeeFilter, setEmployeeFilter] = useState("Tous")
  const [typeFilter, setTypeFilter] = useState<"Tous" | MarkerType>("Tous")
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [workplaces, setWorkplaces] = useState<Workplace[]>([])
  const [showWorkplaces, setShowWorkplaces] = useState(true)

  useEffect(() => {
    listEmployees().then(setEmployees).catch(() => {})
    listWorkplaces().then((l) => setWorkplaces(l.filter(hasValidCoords))).catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false // évite qu'une réponse tardive écrase une date plus récente
    listAttendanceForDate(date).then((a) => { if (!cancelled) setAttendance(a) }).catch(() => { if (!cancelled) setAttendance([]) })
    return () => { cancelled = true }
  }, [date])

  const nameFor = (a: Attendance) => {
    if (a.employeeName) return a.employeeName
    const e = employees.find((x) => x.employeeCode === a.employeeCode)
    return e ? employeeName(e) : a.employeeCode
  }

  const markers: MapMarker[] = useMemo(() => {
    const out: MapMarker[] = []
    for (const a of attendance) {
      if (employeeFilter !== "Tous" && a.employeeCode !== employeeFilter) continue
      if (a.entryLocation && typeFilter !== "SORTIE") {
        out.push({
          key: `${a.id}-in`, type: "ENTREE", employeeName: nameFor(a), attendance: a,
          lat: a.entryLocation.latitude, lng: a.entryLocation.longitude,
          time: fmtTime(a.entryTime),
        })
      }
      if (a.exitLocation && typeFilter !== "ENTREE") {
        out.push({
          key: `${a.id}-out`, type: "SORTIE", employeeName: nameFor(a), attendance: a,
          lat: a.exitLocation.latitude, lng: a.exitLocation.longitude,
          time: fmtTime(a.exitTime),
        })
      }
    }
    return out.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng))
  }, [attendance, employeeFilter, typeFilter, employees])

  const points = useMemo<[number, number][]>(() => markers.map((m) => [m.lat, m.lng]), [markers])
  // Sans pointage, on cadre sur les lieux de travail.
  const fitPoints = useMemo<[number, number][]>(
    () => (points.length ? points : workplaces.map((w) => [w.latitude, w.longitude] as [number, number])),
    [points, workplaces]
  )

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <h1 className="text-xl font-bold">Carte des pointages</h1>
        <div className="flex flex-wrap gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm" />
          <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm">
            <option>Tous</option>
            {employees.map((e) => <option key={e.employeeCode} value={e.employeeCode}>{e.firstName} {e.lastName}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-sm px-2">
            <input type="checkbox" checked={showWorkplaces} onChange={(e) => setShowWorkplaces(e.target.checked)} />
            Lieux de travail
          </label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "Tous" | MarkerType)} className="border rounded-lg px-3 py-1.5 text-sm">
            <option value="Tous">Entrée / Sortie</option>
            <option value="ENTREE">Entrée</option>
            <option value="SORTIE">Sortie</option>
          </select>
        </div>
      </div>

      <Card className="p-0 overflow-hidden flex-1 min-h-[420px]">
        <MapContainer center={DEFAULT_CENTER} zoom={13} style={{ height: "100%", minHeight: 420, width: "100%" }}>
          <MapLayers />
          <FitBounds points={fitPoints} />
          {showWorkplaces && workplaces.map((w) => (
            <Circle key={w.id} center={[w.latitude, w.longitude]} radius={Number.isFinite(w.radiusMeters) ? w.radiusMeters : 100}
              pathOptions={{ color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 0.12, weight: 1.5 }}>
              <Popup><strong>{w.name}</strong><br />Rayon : {w.radiusMeters} m</Popup>
            </Circle>
          ))}
          {showWorkplaces && workplaces.map((w) => (
            <Marker key={`wp-${w.id}`} position={[w.latitude, w.longitude]} icon={workplaceIcon}>
              <Popup><strong>{w.name}</strong><br />{w.latitude.toFixed(5)}, {w.longitude.toFixed(5)}</Popup>
            </Marker>
          ))}
          {markers.map((m) => (
            <Marker key={m.key} position={[m.lat, m.lng]} icon={m.type === "ENTREE" ? entryIcon : exitIcon}>
              <Popup>
                <div className="text-sm space-y-1">
                  <div className="font-semibold">{m.employeeName}</div>
                  <div>{m.attendance.employeeCode}</div>
                  <div>Type : {m.type === "ENTREE" ? "ENTRÉE" : "SORTIE"}</div>
                  <div>Département : {m.attendance.departmentName || "—"}</div>
                  {m.attendance.siteName && <div>Chantier : {m.attendance.siteName}</div>}
                  <div>Date : {fmtDay(m.attendance.workDate)}</div>
                  <div>Heure : {m.time}</div>
                  <div>Latitude : {m.lat.toFixed(5)}</div>
                  <div>Longitude : {m.lng.toFixed(5)}</div>
                  {(m.type === "ENTREE" ? m.attendance.entryGpsCheck : m.attendance.exitGpsCheck) && (
                    <div>
                      Distance du département :{" "}
                      {(m.type === "ENTREE" ? m.attendance.entryGpsCheck : m.attendance.exitGpsCheck)!.distance} m
                    </div>
                  )}
                  {m.type === "ENTREE" && m.attendance.entryLocation?.address && (
                    <div>Adresse : {m.attendance.entryLocation.address}</div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </Card>
    </div>
  )
}
