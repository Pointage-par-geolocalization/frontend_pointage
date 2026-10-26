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

const DEFAULT_CENTER: [number, number] = [-18.15, 49.4]

/** Ajuste la vue aux marqueurs à chaque changement (MapContainer ignore les changements de `center`). */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) { map.setView(points[0], 16); return }
    map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 17 })
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    listEmployees().then(setEmployees).catch(() => {})
    listWorkplaces().then((l) => setWorkplaces(l.filter(hasValidCoords))).catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError("")
    listAttendanceForDate(date)
      .then((a) => { if (!cancelled) setAttendance(a) })
      .catch(() => { if (!cancelled) { setAttendance([]); setError("Impossible de charger les pointages. Vérifiez votre connexion puis réessayez.") } })
      .finally(() => { if (!cancelled) setLoading(false) })
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
      if (a.entryLocation && typeFilter !== "SORTIE") out.push({
        key: `${a.id}-in`, type: "ENTREE", employeeName: nameFor(a), attendance: a,
        lat: a.entryLocation.latitude, lng: a.entryLocation.longitude, time: fmtTime(a.entryTime),
      })
      if (a.exitLocation && typeFilter !== "ENTREE") out.push({
        key: `${a.id}-out`, type: "SORTIE", employeeName: nameFor(a), attendance: a,
        lat: a.exitLocation.latitude, lng: a.exitLocation.longitude, time: fmtTime(a.exitTime),
      })
    }
    return out.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng) && Math.abs(m.lat) <= 90 && Math.abs(m.lng) <= 180)
  }, [attendance, employeeFilter, typeFilter, employees])

  const entryCount = markers.filter((m) => m.type === "ENTREE").length
  const exitCount = markers.filter((m) => m.type === "SORTIE").length
  const points = useMemo<[number, number][]>(() => markers.map((m) => [m.lat, m.lng]), [markers])
  const fitPoints = useMemo<[number, number][]>(
    () => (points.length ? points : workplaces.map((w) => [w.latitude, w.longitude] as [number, number])),
    [points, workplaces]
  )
  const controlClass = "min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-auto"

  return (
    <section className="flex h-full min-h-0 flex-col gap-4">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Suivi terrain</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Carte des pointages</h1>
          <p className="mt-1 text-sm text-slate-500">Visualisez les entrées, sorties et zones de travail.</p>
        </div>
        <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{fmtDay(date)}</span>
      </header>

      <Card className="p-3 sm:p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800"><span className="h-2 w-2 rounded-full bg-blue-600" />Filtres de la carte</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-center">
          <label className="text-xs font-medium text-slate-500">Date<input aria-label="Date des pointages" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${controlClass} mt-1 block`} /></label>
          <label className="text-xs font-medium text-slate-500">Salarié<select aria-label="Filtrer par salarié" value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className={`${controlClass} mt-1 block`}><option value="Tous">Tous les salariés</option>{employees.map((e) => <option key={e.employeeCode} value={e.employeeCode}>{e.firstName} {e.lastName}</option>)}</select></label>
          <label className="text-xs font-medium text-slate-500">Type de pointage<select aria-label="Filtrer par type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "Tous" | MarkerType)} className={`${controlClass} mt-1 block`}><option value="Tous">Entrée et sortie</option><option value="ENTREE">Entrée uniquement</option><option value="SORTIE">Sortie uniquement</option></select></label>
          <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 sm:mt-5"><input type="checkbox" checked={showWorkplaces} onChange={(e) => setShowWorkplaces(e.target.checked)} className="h-4 w-4 accent-blue-600" />Lieux de travail</label>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><p className="text-xs font-medium text-slate-500">Positions visibles</p><p className="mt-1 text-2xl font-bold text-slate-900">{markers.length}</p></div>
        <div className="rounded-2xl border border-green-100 bg-green-50 p-3"><p className="text-xs font-medium text-green-800">Entrées</p><p className="mt-1 text-2xl font-bold text-green-900">{entryCount}</p></div>
        <div className="rounded-2xl border border-red-100 bg-red-50 p-3"><p className="text-xs font-medium text-red-800">Sorties</p><p className="mt-1 text-2xl font-bold text-red-900">{exitCount}</p></div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3"><p className="text-xs font-medium text-blue-800">Lieux de travail</p><p className="mt-1 text-2xl font-bold text-blue-900">{showWorkplaces ? workplaces.length : 0}</p></div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      <Card className="flex min-h-[380px] flex-1 flex-col overflow-hidden p-0 sm:min-h-[460px]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3">
          <div><p className="text-sm font-semibold text-slate-800">Vue géographique</p><p className="text-xs text-slate-500">{loading ? "Actualisation des données…" : `${markers.length} position${markers.length === 1 ? "" : "s"} affichée${markers.length === 1 ? "" : "s"}`}</p></div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600"><span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-green-600" />Entrée</span><span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-red-600" />Sortie</span><span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-blue-600 ring-4 ring-blue-100" />Chantier</span></div>
        </div>
        <div className="relative min-h-[330px] flex-1 sm:min-h-[400px]">
          <MapContainer center={DEFAULT_CENTER} zoom={6} className="absolute inset-0 h-full w-full" aria-label="Carte des pointages">
            <MapLayers /><FitBounds points={fitPoints} />
            {showWorkplaces && workplaces.map((w) => <Circle key={w.id} center={[w.latitude, w.longitude]} radius={Number.isFinite(w.radiusMeters) ? w.radiusMeters : 100} pathOptions={{ color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 0.12, weight: 1.5 }}><Popup><strong>{w.name}</strong><br />Rayon : {w.radiusMeters} m</Popup></Circle>)}
            {showWorkplaces && workplaces.map((w) => <Marker key={`wp-${w.id}`} position={[w.latitude, w.longitude]} icon={workplaceIcon}><Popup><strong>{w.name}</strong><br />{w.latitude.toFixed(5)}, {w.longitude.toFixed(5)}</Popup></Marker>)}
            {markers.map((m) => <Marker key={m.key} position={[m.lat, m.lng]} icon={m.type === "ENTREE" ? entryIcon : exitIcon}><Popup><div className="space-y-1 text-sm"><div className="font-semibold">{m.employeeName}</div><div className="text-slate-500">{m.attendance.employeeCode}</div><div>Type : <strong>{m.type === "ENTREE" ? "ENTRÉE" : "SORTIE"}</strong></div><div>Département : {m.attendance.departmentName || "—"}</div>{m.attendance.siteName && <div>Chantier : {m.attendance.siteName}</div>}<div>Date : {fmtDay(m.attendance.workDate)}</div><div>Heure : {m.time}</div><div>Latitude : {m.lat.toFixed(5)}</div><div>Longitude : {m.lng.toFixed(5)}</div>{(m.type === "ENTREE" ? m.attendance.entryGpsCheck : m.attendance.exitGpsCheck) && <div>Distance du département : {(m.type === "ENTREE" ? m.attendance.entryGpsCheck : m.attendance.exitGpsCheck)!.distance} m</div>}{m.type === "ENTREE" && m.attendance.entryLocation?.address && <div>Adresse : {m.attendance.entryLocation.address}</div>}</div></Popup></Marker>)}
          </MapContainer>
          {!loading && !error && markers.length === 0 && <div className="pointer-events-none absolute left-1/2 top-4 z-[400] -translate-x-1/2 rounded-xl border border-slate-200 bg-white/95 px-4 py-2 text-center text-sm text-slate-700 shadow-lg">Aucun pointage correspondant aux filtres.</div>}
          {loading && <div className="pointer-events-none absolute right-3 top-3 z-[400] rounded-lg bg-white/95 px-3 py-2 text-xs font-medium text-slate-600 shadow">Chargement…</div>}
        </div>
      </Card>
    </section>
  )
}


// // src/pages/admin/MapView.tsx
// import { useEffect, useMemo, useState } from "react"
// import { MapContainer, Marker, Popup, Circle, useMap } from "react-leaflet"
// import L from "leaflet"
// import { listAttendanceForDate, type Attendance } from "../../services/attendance"
// import { listEmployees, employeeName, type Employee } from "../../services/employees"
// import { listWorkplaces, hasValidCoords, type Workplace } from "../../services/workplaces"
// import { todayKey } from "../../utils/date"
// import { fmtDay, fmtTime } from "../../utils/format"
// import { entryIcon, exitIcon, workplaceIcon } from "../../components/mapIcons"
// import MapLayers from "../../components/MapLayers"
// import Card from "../../components/Card"


// type MarkerType = "ENTREE" | "SORTIE"
// interface MapMarker {
//   key: string
//   type: MarkerType
//   employeeName: string
//   attendance: Attendance
//   lat: number
//   lng: number
//   time?: string
// }

// const DEFAULT_CENTER: [number, number] = [-18.15, 49.4] // Toamasina par défaut

// /** Ajuste la vue aux marqueurs à chaque changement (MapContainer ignore les changements de `center`). */
// function FitBounds({ points }: { points: [number, number][] }) {
//   const map = useMap()
//   useEffect(() => {
//     if (points.length === 0) return
//     if (points.length === 1) { map.setView(points[0], 16); return }
//     map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 17 })
//   }, [points, map])
//   return null
// }

// export default function AdminMap() {
//   const [date, setDate] = useState(todayKey())
//   const [employeeFilter, setEmployeeFilter] = useState("Tous")
//   const [typeFilter, setTypeFilter] = useState<"Tous" | MarkerType>("Tous")
//   const [attendance, setAttendance] = useState<Attendance[]>([])
//   const [employees, setEmployees] = useState<Employee[]>([])
//   const [workplaces, setWorkplaces] = useState<Workplace[]>([])
//   const [showWorkplaces, setShowWorkplaces] = useState(true)

//   useEffect(() => {
//     listEmployees().then(setEmployees).catch(() => {})
//     listWorkplaces().then((l) => setWorkplaces(l.filter(hasValidCoords))).catch(() => {})
//   }, [])

//   useEffect(() => {
//     let cancelled = false // évite qu'une réponse tardive écrase une date plus récente
//     listAttendanceForDate(date).then((a) => { if (!cancelled) setAttendance(a) }).catch(() => { if (!cancelled) setAttendance([]) })
//     return () => { cancelled = true }
//   }, [date])

//   const nameFor = (a: Attendance) => {
//     if (a.employeeName) return a.employeeName
//     const e = employees.find((x) => x.employeeCode === a.employeeCode)
//     return e ? employeeName(e) : a.employeeCode
//   }

//   const markers: MapMarker[] = useMemo(() => {
//     const out: MapMarker[] = []
//     for (const a of attendance) {
//       if (employeeFilter !== "Tous" && a.employeeCode !== employeeFilter) continue
//       if (a.entryLocation && typeFilter !== "SORTIE") {
//         out.push({
//           key: `${a.id}-in`, type: "ENTREE", employeeName: nameFor(a), attendance: a,
//           lat: a.entryLocation.latitude, lng: a.entryLocation.longitude,
//           time: fmtTime(a.entryTime),
//         })
//       }
//       if (a.exitLocation && typeFilter !== "ENTREE") {
//         out.push({
//           key: `${a.id}-out`, type: "SORTIE", employeeName: nameFor(a), attendance: a,
//           lat: a.exitLocation.latitude, lng: a.exitLocation.longitude,
//           time: fmtTime(a.exitTime),
//         })
//       }
//     }
//     return out.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng))
//   }, [attendance, employeeFilter, typeFilter, employees])

//   const points = useMemo<[number, number][]>(() => markers.map((m) => [m.lat, m.lng]), [markers])
//   // Sans pointage, on cadre sur les lieux de travail.
//   const fitPoints = useMemo<[number, number][]>(
//     () => (points.length ? points : workplaces.map((w) => [w.latitude, w.longitude] as [number, number])),
//     [points, workplaces]
//   )

//   return (
//     <div className="space-y-4 h-full flex flex-col">
//       <div className="flex flex-wrap items-center gap-2 justify-between">
//         <h1 className="text-xl font-bold">Carte des pointages</h1>
//         <div className="flex flex-wrap gap-2">
//           <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm" />
//           <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm">
//             <option>Tous</option>
//             {employees.map((e) => <option key={e.employeeCode} value={e.employeeCode}>{e.firstName} {e.lastName}</option>)}
//           </select>
//           <label className="flex items-center gap-1.5 text-sm px-2">
//             <input type="checkbox" checked={showWorkplaces} onChange={(e) => setShowWorkplaces(e.target.checked)} />
//             Lieux de travail
//           </label>
//           <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "Tous" | MarkerType)} className="border rounded-lg px-3 py-1.5 text-sm">
//             <option value="Tous">Entrée / Sortie</option>
//             <option value="ENTREE">Entrée</option>
//             <option value="SORTIE">Sortie</option>
//           </select>
//         </div>
//       </div>

//       <Card className="p-0 overflow-hidden flex-1 min-h-[420px]">
//         <MapContainer center={DEFAULT_CENTER} zoom={13} style={{ height: "100%", minHeight: 420, width: "100%" }}>
//           <MapLayers />
//           <FitBounds points={fitPoints} />
//           {showWorkplaces && workplaces.map((w) => (
//             <Circle key={w.id} center={[w.latitude, w.longitude]} radius={Number.isFinite(w.radiusMeters) ? w.radiusMeters : 100}
//               pathOptions={{ color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 0.12, weight: 1.5 }}>
//               <Popup><strong>{w.name}</strong><br />Rayon : {w.radiusMeters} m</Popup>
//             </Circle>
//           ))}
//           {showWorkplaces && workplaces.map((w) => (
//             <Marker key={`wp-${w.id}`} position={[w.latitude, w.longitude]} icon={workplaceIcon}>
//               <Popup><strong>{w.name}</strong><br />{w.latitude.toFixed(5)}, {w.longitude.toFixed(5)}</Popup>
//             </Marker>
//           ))}
//           {markers.map((m) => (
//             <Marker key={m.key} position={[m.lat, m.lng]} icon={m.type === "ENTREE" ? entryIcon : exitIcon}>
//               <Popup>
//                 <div className="text-sm space-y-1">
//                   <div className="font-semibold">{m.employeeName}</div>
//                   <div>{m.attendance.employeeCode}</div>
//                   <div>Type : {m.type === "ENTREE" ? "ENTRÉE" : "SORTIE"}</div>
//                   <div>Département : {m.attendance.departmentName || "—"}</div>
//                   {m.attendance.siteName && <div>Chantier : {m.attendance.siteName}</div>}
//                   <div>Date : {fmtDay(m.attendance.workDate)}</div>
//                   <div>Heure : {m.time}</div>
//                   <div>Latitude : {m.lat.toFixed(5)}</div>
//                   <div>Longitude : {m.lng.toFixed(5)}</div>
//                   {(m.type === "ENTREE" ? m.attendance.entryGpsCheck : m.attendance.exitGpsCheck) && (
//                     <div>
//                       Distance du département :{" "}
//                       {(m.type === "ENTREE" ? m.attendance.entryGpsCheck : m.attendance.exitGpsCheck)!.distance} m
//                     </div>
//                   )}
//                   {m.type === "ENTREE" && m.attendance.entryLocation?.address && (
//                     <div>Adresse : {m.attendance.entryLocation.address}</div>
//                   )}
//                 </div>
//               </Popup>
//             </Marker>
//           ))}
//         </MapContainer>
//       </Card>
//     </div>
//   )
// }
