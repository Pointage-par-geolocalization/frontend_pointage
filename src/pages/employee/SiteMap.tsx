import { useEffect, useMemo, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import { Search, MapPin, Building2, LocateFixed } from "lucide-react"
import { listMySites, type Site } from "../../services/sites"
import { listWorkplaces, type Workplace, hasValidCoords } from "../../services/workplaces"
import "leaflet/dist/leaflet.css"

const MADAGASCAR: [number, number] = [-18.8792, 47.5079]
type SitePlace = { place: Workplace; site?: Site }

function FocusMap({ position }: { position: [number, number] | null }) {
  const map = useMap()
  useEffect(() => { if (position) map.flyTo(position, 14, { duration: 0.7 }) }, [position, map])
  return null
}

export default function EmployeeSiteMap() {
  const [sites, setSites] = useState<Site[]>([])
  const [places, setPlaces] = useState<Workplace[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [focusedId, setFocusedId] = useState("")

  useEffect(() => {
    let live = true
    Promise.all([listMySites(), listWorkplaces()])
      .then(([mySites, allPlaces]) => {
        if (!live) return
        // N'afficher que les lieux rattachés aux chantiers renvoyés par le service salarié.
        const permittedIds = new Set(mySites.map((site) => site.workplaceId).filter((id): id is string => Boolean(id)))
        setSites(mySites)
        setPlaces(allPlaces.filter((place) => permittedIds.has(place.id) && hasValidCoords(place)))
      })
      .catch((e: unknown) => { if (live) setError(e instanceof Error ? e.message : "Carte indisponible.") })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [])

  const mapped: SitePlace[] = useMemo(() => places.map((place) => ({
    place,
    site: sites.find((site) => site.workplaceId === place.id),
  })), [places, sites])
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    if (!needle) return mapped
    return mapped.filter(({ place, site }) => `${site?.name ?? ""} ${site?.address ?? ""} ${place.name}`.toLocaleLowerCase().includes(needle))
  }, [mapped, query])
  const focused = filtered.find(({ place }) => place.id === focusedId) ?? filtered[0]
  const center: [number, number] = focused ? [focused.place.latitude, focused.place.longitude] : MADAGASCAR
  const focus = (item: SitePlace) => setFocusedId(item.place.id)

  return (
    <section className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-[1600px] flex-col gap-5 pb-5">
      <header className="rounded-3xl bg-gradient-to-br from-blue-700 via-blue-700 to-indigo-800 p-5 text-white shadow-lg sm:p-7">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15"><MapPin className="h-5 w-5" /></div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">Espace salarié</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Mes chantiers sur la carte</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-blue-100">Retrouvez rapidement les lieux de travail qui vous sont affectés et leurs informations pratiques.</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 sm:min-w-36"><p className="text-xs text-blue-100">Lieux cartographiés</p><p className="mt-1 text-2xl font-bold">{loading ? "—" : places.length}</p></div>
        </div>
      </header>

      {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><strong>Chargement impossible.</strong> {error}</div>}
      {loading ? <div className="flex min-h-52 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-medium text-slate-600 shadow-sm"><span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />Chargement de vos chantiers…</div> : (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(280px,350px)_minmax(0,1fr)]">
          <aside className="flex min-h-[260px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:max-h-[calc(100vh-16rem)]">
            <div className="border-b border-slate-100 p-4">
              <h2 className="font-semibold text-slate-900">Lieux affectés <span className="ml-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{filtered.length}</span></h2>
              <label className="relative mt-3 block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un chantier ou une adresse" aria-label="Rechercher un chantier ou une adresse" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100" /></label>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {filtered.map(({ place, site }) => {
                const active = focused?.place.id === place.id
                return <button key={place.id} type="button" onClick={() => focus({ place, site })} className={`w-full rounded-xl border p-3 text-left transition ${active ? "border-blue-300 bg-blue-50 shadow-sm" : "border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50"}`}>
                  <span className="flex items-start justify-between gap-2"><span className="flex min-w-0 gap-3"><span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}><Building2 className="h-4 w-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-900">{site?.name ?? place.name}</span>{site?.address && <span className="mt-1 block text-xs leading-5 text-slate-500">{site.address}</span>}<span className="mt-1 block text-xs text-slate-500">Zone de pointage · rayon {place.radiusMeters} m</span></span></span><LocateFixed className={`mt-1 h-4 w-4 shrink-0 ${active ? "text-blue-700" : "text-slate-400"}`} /></span>
                </button>
              })}
              {filtered.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center"><Search className="mx-auto h-5 w-5 text-slate-400" /><p className="mt-2 text-sm font-medium text-slate-700">{places.length ? "Aucun résultat" : "Aucun chantier cartographié"}</p><p className="mt-1 text-xs leading-5 text-slate-500">{places.length ? "Essayez un autre nom ou une autre adresse." : "Aucun chantier affecté ne dispose actuellement d'une position valide."}</p></div>}
            </div>
            <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">Seuls vos chantiers transmis par le service sont affichés.</p>
          </aside>

          <div className="relative min-h-[430px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm sm:min-h-[520px] lg:min-h-[calc(100vh-16rem)]">
            <MapContainer center={MADAGASCAR} zoom={6} className="absolute inset-0 z-0 h-full w-full" aria-label="Carte de mes chantiers affectés"><TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><FocusMap position={filtered.length ? center : null} />{places.map((place) => { const site = sites.find((item) => item.workplaceId === place.id); return <Marker key={place.id} position={[place.latitude, place.longitude]}><Popup><div className="min-w-44 space-y-1"><strong className="block text-sm">{site?.name ?? place.name}</strong>{site?.address && <span className="block text-xs">{site.address}</span>}<span className="block text-xs text-slate-600">Lieu de pointage · rayon {place.radiusMeters} m</span><span className="block text-xs text-slate-500">{place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}</span></div></Popup></Marker> })}</MapContainer>
            <div className="pointer-events-none absolute left-3 top-3 z-[400] rounded-xl border border-white/80 bg-white/95 px-3 py-2 shadow-md backdrop-blur"><p className="text-xs font-semibold text-slate-800">{focused ? (focused.site?.name ?? focused.place.name) : "Madagascar"}</p><p className="mt-0.5 text-[11px] text-slate-500">{filtered.length ? `${filtered.length} lieu${filtered.length === 1 ? "" : "x"} visible${filtered.length === 1 ? "" : "s"}` : "Vue générale"}</p></div>
          </div>
        </div>
      )}
    </section>
  )
}


// import { useEffect,useState } from "react"
// import { MapContainer,TileLayer,Marker,Popup } from "react-leaflet"
// import { listMySites,type Site } from "../../services/sites"
// import { listWorkplaces,type Workplace } from "../../services/workplaces"
// import { hasValidCoords } from "../../services/workplaces"
// import "leaflet/dist/leaflet.css"
// export default function EmployeeSiteMap(){const [sites,setSites]=useState<Site[]>([]),[places,setPlaces]=useState<Workplace[]>([]),[error,setError]=useState(""); useEffect(()=>{let live=true;Promise.all([listMySites(),listWorkplaces()]).then(([s,w])=>{if(live){setSites(s);const permitted=new Set(s.map(x=>x.workplaceId).filter(Boolean));setPlaces(w.filter(x=>permitted.has(x.id)&&hasValidCoords(x)))}}).catch(e=>live&&setError(e instanceof Error?e.message:"Carte indisponible."));return()=>{live=false}},[]);const center: [number,number]=places.length?[places[0].latitude,places[0].longitude]:[-18.8792,47.5079];return <section className="space-y-3"><h1 className="text-xl font-bold">Carte des chantiers affectés</h1><p className="text-sm text-slate-600">Seuls vos chantiers transmis par le service sont affichés.</p>{error&&<p role="alert" className="text-red-700">{error}</p>}{!places.length?<p className="rounded-xl border bg-white p-4">Aucun chantier affecté avec une position cartographique disponible.</p>:<MapContainer center={center} zoom={12} className="h-[65vh] min-h-80 rounded-xl z-0" aria-label="Carte des chantiers affectés"><TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>{places.map(p=>{const site=sites.find(s=>s.workplaceId===p.id);return <Marker key={p.id} position={[p.latitude,p.longitude]}><Popup>{site?.name??p.name}</Popup></Marker>})}</MapContainer>}</section>}
