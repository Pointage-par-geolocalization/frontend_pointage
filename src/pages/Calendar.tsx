import { useEffect, useMemo, useState, type FormEvent } from "react"
import {
  listHolidays,
  createHoliday,
  deleteHoliday,
  getCalendarSettings,
  saveCalendarSettings,
  type Holiday,
  type CalendarSettings,
} from "../services/calendar"
import { useAuth } from "../hooks/useAuth"
import { errorMessage } from "../services/api"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react"

type CalendarEvent = Holiday & {
  category: "Férié" | "Fête nationale" | "Commémoration" | "Fête religieuse" | "Événement"
  source: "built-in" | "database"
  note?: string
}

const pad = (value: number) => String(value).padStart(2, "0")
const toDayKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const fromDayKey = (key: string) => {
  const [year, month, day] = key.split("-").map(Number)
  return new Date(year, month - 1, day, 12)
}
const displayDate = (key: string, options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", year: "numeric" }) =>
  fromDayKey(key).toLocaleDateString("fr-FR", options)

// Algorithme grégorien Meeus/Jones/Butcher pour calculer Pâques, puis les fêtes mobiles chrétiennes.
function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day, 12)
}

function addDays(date: Date, amount: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + amount)
  return result
}

function nationalEventsForYear(year: number): CalendarEvent[] {
  const easter = easterSunday(year)
  const make = (
    date: Date,
    name: string,
    category: CalendarEvent["category"],
    note?: string,
  ): CalendarEvent => ({
    id: `builtin-${toDayKey(date)}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    date: toDayKey(date),
    name,
    workday: false,
    category,
    source: "built-in",
    note,
  })
  const events = [
    make(new Date(year, 0, 1, 12), "Jour de l’An", "Férié"),
    make(new Date(year, 2, 8, 12), "Journée internationale de la Femme", "Fête nationale", "Jour férié chômé uniquement pour les femmes selon le décret malgache 2026-006."),
    make(new Date(year, 2, 29, 12), "Commémoration des événements de 1947", "Commémoration"),
    make(easter, "Dimanche de Pâques", "Fête religieuse"),
    make(addDays(easter, 1), "Lundi de Pâques", "Fête religieuse"),
    make(new Date(year, 4, 1, 12), "Fête du Travail", "Fête nationale"),
    make(addDays(easter, 39), "Ascension", "Fête religieuse"),
    make(addDays(easter, 49), "Dimanche de Pentecôte", "Fête religieuse"),
    make(addDays(easter, 50), "Lundi de Pentecôte", "Fête religieuse"),
    make(new Date(year, 5, 26, 12), "Fête nationale de l’Indépendance", "Fête nationale"),
    make(new Date(year, 7, 15, 12), "Assomption", "Fête religieuse"),
    make(new Date(year, 10, 1, 12), "Toussaint", "Fête religieuse"),
    make(new Date(year, 11, 25, 12), "Noël", "Fête religieuse"),
  ]

  // Les dates ci-dessous sont celles du calendrier 2026 de l’Ambassade des États-Unis à Madagascar.
  // Le décret malgache 2026-006 renvoie au calendrier fixé par la communauté musulmane.
  if (year === 2026) {
    events.push(
      make(new Date(2026, 2, 20, 12), "Eid al-Fitr", "Fête religieuse", "Date publiée pour 2026; à vérifier selon l’annonce de la communauté musulmane."),
      make(new Date(2026, 4, 27, 12), "Eid al-Adha", "Fête religieuse", "Date publiée pour 2026; à vérifier selon l’annonce de la communauté musulmane."),
    )
  }
  return events
}

function categoryClass(category: CalendarEvent["category"]) {
  if (category === "Fête nationale") return "bg-blue-50 text-blue-700 ring-blue-200"
  if (category === "Commémoration") return "bg-violet-50 text-violet-700 ring-violet-200"
  if (category === "Fête religieuse") return "bg-emerald-50 text-emerald-700 ring-emerald-200"
  if (category === "Événement") return "bg-primary-50 text-primary-700 ring-primary-200"
  return "bg-amber-50 text-amber-800 ring-amber-200"
}

export default function CalendarPage() {
  const { appUser } = useAuth()
  const admin = appUser?.role === "admin"
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [settings, setSettings] = useState<CalendarSettings>({ workDays: [1, 2, 3, 4, 5], toleranceMinutes: 5 })
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12))
  const [selectedDay, setSelectedDay] = useState(() => toDayKey(new Date()))
  const [view, setView] = useState<"month" | "agenda">("month")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showAddForm, setShowAddForm] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [name, setName] = useState("")
  const [day, setDay] = useState(toDayKey(new Date()))

  async function refresh() {
    setLoading(true)
    setError("")
    try {
      const [holidayList, calendarSettings] = await Promise.all([listHolidays(), getCalendarSettings()])
      setHolidays(holidayList)
      setSettings(calendarSettings)
    } catch (e) {
      setError(errorMessage(e, "Chargement du calendrier impossible."))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const events = useMemo(() => {
    const all: CalendarEvent[] = [
      ...nationalEventsForYear(year),
      ...holidays.map((holiday) => ({ ...holiday, category: "Événement" as const, source: "database" as const })),
    ]
    const deduped = new Map<string, CalendarEvent>()
    for (const event of all) {
      const key = `${event.date.slice(0, 10)}|${event.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR").trim()}`
      if (!deduped.has(key) || event.source === "database") deduped.set(key, event)
    }
    return Array.from(deduped.values()).sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))
  }, [holidays, year])

  const monthEvents = events.filter((event) => event.date.startsWith(`${year}-${pad(monthIndex + 1)}`))
  const selectedEvents = events.filter((event) => event.date.slice(0, 10) === selectedDay)
  const firstWeekday = (new Date(year, monthIndex, 1, 12).getDay() + 6) % 7
  const numberOfDays = new Date(year, monthIndex + 1, 0, 12).getDate()
  const totalCells = Math.ceil((firstWeekday + numberOfDays) / 7) * 7
  const today = toDayKey(new Date())
  const weekdays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

  function moveMonth(amount: number) {
    const next = new Date(year, monthIndex + amount, 1, 12)
    setMonth(next)
    if (selectedDay.slice(0, 7) !== `${next.getFullYear()}-${pad(next.getMonth() + 1)}`) {
      setSelectedDay(toDayKey(next))
    }
  }

  async function addEvent(event: FormEvent) {
    event.preventDefault()
    try {
      await createHoliday({ date: day, name: name.trim(), workday: false })
      setName("")
      setShowAddForm(false)
      await refresh()
    } catch (e) {
      setError(errorMessage(e, "Ajout de l’événement impossible."))
    }
  }

  async function removeEvent(id: string) {
    try {
      await deleteHoliday(id)
      await refresh()
    } catch (e) {
      setError(errorMessage(e, "Suppression de l’événement impossible."))
    }
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault()
    try {
      const saved = await saveCalendarSettings(settings)
      setSettings(saved)
      setShowSettings(false)
      setError("")
    } catch (e) {
      setError(errorMessage(e, "Enregistrement des règles impossible."))
    }
  }

  return (
    <section className="mx-auto w-full max-w-7xl space-y-5 pb-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary-700"><span className="rounded-md bg-primary-50 px-2 py-1">MG</span> Madagascar</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Calendrier</h1>
          <p className="mt-1 text-sm text-slate-500">Jours fériés, fêtes et événements, avec un agenda adapté au téléphone.</p>
        </div>
        <div className="flex items-center gap-2">
          {admin && <button type="button" onClick={() => { setDay(selectedDay); setShowAddForm((open) => !open) }} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"><Plus className="h-4 w-4" />Ajouter</button>}
          {admin && <button type="button" onClick={() => setShowSettings((open) => !open)} aria-label="Règles d’horaires" className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50"><Settings2 className="h-5 w-5" /></button>}
        </div>
      </header>

      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500" aria-live="polite">Chargement du calendrier…</div> : <>
        {showAddForm && admin && <form onSubmit={addEvent} className="grid gap-3 rounded-2xl border border-primary-100 bg-primary-50/60 p-4 sm:grid-cols-[1fr_2fr_auto_auto] sm:items-end">
          <label className="text-xs font-semibold text-slate-600">Date<input required type="date" value={day} onChange={(event) => setDay(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
          <label className="text-xs font-semibold text-slate-600">Nom de la fête ou de l’événement<input required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex. Taombaovao Malagasy" className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
          <button className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">Enregistrer</button>
          <button type="button" onClick={() => setShowAddForm(false)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600">Annuler</button>
        </form>}

        {showSettings && admin && <form onSubmit={saveSettings} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-4 sm:items-end">
          <label className="text-xs font-semibold text-slate-600">Début de journée<input type="time" value={settings.startTime ?? "08:00"} onChange={(event) => setSettings({ ...settings, startTime: event.target.value })} className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm" /></label>
          <label className="text-xs font-semibold text-slate-600">Fin de journée<input type="time" value={settings.endTime ?? "17:00"} onChange={(event) => setSettings({ ...settings, endTime: event.target.value })} className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm" /></label>
          <label className="text-xs font-semibold text-slate-600">Tolérance (minutes)<input type="number" min="0" max="180" value={settings.toleranceMinutes} onChange={(event) => setSettings({ ...settings, toleranceMinutes: Number(event.target.value) })} className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm" /></label>
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Enregistrer les règles</button>
        </form>}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 flex-col items-center justify-center rounded-xl bg-primary-50 text-primary-700"><span className="text-[9px] font-bold uppercase">{month.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "")}</span><span className="text-base font-bold leading-none">{year}</span></div>
                <h2 className="min-w-[155px] text-lg font-bold capitalize text-slate-900 sm:text-xl">{month.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</h2>
              </div>
              <div className="flex items-center gap-1 rounded-xl border border-slate-200 p-1">
                <button type="button" onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1, 12)); setSelectedDay(toDayKey(now)) }} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">Aujourd’hui</button>
                <button type="button" onClick={() => moveMonth(-1)} aria-label="Mois précédent" className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></button>
                <button type="button" onClick={() => moveMonth(1)} aria-label="Mois suivant" className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></button>
              </div>
              <div className="flex w-full rounded-xl bg-slate-100 p-1 sm:w-auto">
                <button type="button" onClick={() => setView("month")} className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold sm:flex-none ${view === "month" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Mois</button>
                <button type="button" onClick={() => setView("agenda")} className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold sm:flex-none ${view === "agenda" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Agenda</button>
              </div>
            </div>

            {view === "month" ? <div className="p-2 sm:p-4">
              <div className="mb-2 grid grid-cols-7">{weekdays.map((weekday, index) => <div key={weekday} className={`py-2 text-center text-[10px] font-bold uppercase tracking-wide sm:text-xs ${index > 4 ? "text-slate-400" : "text-slate-500"}`}>{weekday}</div>)}</div>
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {Array.from({ length: totalCells }, (_, index) => {
                  const dayNumber = index - firstWeekday + 1
                  if (dayNumber < 1 || dayNumber > numberOfDays) return <div key={`empty-${index}`} className="min-h-[58px] rounded-xl bg-slate-50/60 sm:min-h-[94px]" aria-hidden="true" />
                  const key = `${year}-${pad(monthIndex + 1)}-${pad(dayNumber)}`
                  const dayEvents = events.filter((event) => event.date.slice(0, 10) === key)
                  const isSelected = selectedDay === key
                  const isToday = today === key
                  const dayOfWeek = new Date(year, monthIndex, dayNumber, 12).getDay()
                  const isWeekend = !settings.workDays.includes(dayOfWeek)
                  return <button key={key} type="button" onClick={() => setSelectedDay(key)} aria-pressed={isSelected} aria-label={`${displayDate(key)}${dayEvents.length ? `, ${dayEvents.length} événement(s)` : ""}`} className={`group min-h-[58px] rounded-xl border p-1.5 text-left transition sm:min-h-[94px] sm:p-2 ${isSelected ? "border-primary-500 bg-primary-50 ring-2 ring-primary-100" : isToday ? "border-primary-200 bg-white" : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50"} ${isWeekend && !isSelected ? "text-slate-400" : "text-slate-700"}`}>
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold sm:h-8 sm:w-8 sm:text-sm ${isToday ? "bg-primary-600 text-white" : ""}`}>{dayNumber}</span>
                    <span className="mt-1 flex min-h-2 flex-wrap gap-1" aria-hidden="true">{dayEvents.slice(0, 3).map((event) => <span key={event.id} className={`h-1.5 w-1.5 rounded-full ${event.category === "Fête nationale" ? "bg-blue-500" : event.category === "Commémoration" ? "bg-violet-500" : event.category === "Fête religieuse" ? "bg-emerald-500" : event.category === "Événement" ? "bg-primary-500" : "bg-amber-500"}`} />)}</span>
                    {dayEvents[0] && <span className="mt-1 hidden truncate text-[10px] font-medium text-slate-500 md:block">{dayEvents[0].name}</span>}
                    {dayEvents.length > 1 && <span className="hidden text-[9px] text-slate-400 md:block">+{dayEvents.length - 1} autre(s)</span>}
                  </button>
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-[10px] text-slate-500 sm:text-xs">
                <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-amber-500" />Jour férié</span>
                <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-blue-500" />Fête nationale</span>
                <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-violet-500" />Commémoration</span>
                <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-500" />Fête religieuse</span>
              </div>
            </div> : <div className="divide-y divide-slate-100 px-4">
              {monthEvents.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Aucun événement ce mois-ci.</p> : monthEvents.map((event) => <button key={event.id} type="button" onClick={() => setSelectedDay(event.date.slice(0, 10))} className="flex w-full items-start gap-3 py-3 text-left hover:bg-slate-50">
                <span className="min-w-12 rounded-lg bg-slate-100 px-2 py-1 text-center text-xs font-bold text-slate-600">{fromDayKey(event.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</span>
                <span className="min-w-0 flex-1"><span className="block font-semibold text-slate-800">{event.name}</span><span className="text-xs text-slate-500">{displayDate(event.date, { weekday: "long", year: "numeric" })}</span></span>
                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ${categoryClass(event.category)}`}>{event.category}</span>
              </button>)}
            </div>}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center gap-2 text-primary-700"><CalendarDays className="h-5 w-5" /><span className="text-xs font-bold uppercase tracking-wide">Programme du jour</span></div>
              <h3 className="mt-2 text-lg font-bold capitalize text-slate-900">{displayDate(selectedDay)}</h3>
              {selectedEvents.length === 0 ? <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Aucun événement enregistré pour cette date.</div> : <div className="mt-4 space-y-3">{selectedEvents.map((event) => <article key={event.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h4 className="font-semibold text-slate-800">{event.name}</h4><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${categoryClass(event.category)}`}>{event.category}</span></div>{admin && event.source === "database" && <button type="button" onClick={() => void removeEvent(event.id)} aria-label={`Supprimer ${event.name}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}</div>
                {event.note && <p className="mt-2 text-xs leading-relaxed text-slate-500">{event.note}</p>}
              </article>)}</div>}
              {admin && <button type="button" onClick={() => { setDay(selectedDay); setShowAddForm(true) }} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary-300 px-3 py-2.5 text-sm font-semibold text-primary-700 hover:bg-primary-50"><Plus className="h-4 w-4" />Ajouter une fête ou un événement</button>}
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs leading-relaxed text-amber-950">
              <div className="font-bold">Dates à confirmer chaque année</div>
              <p className="mt-1">Le décret malgache prévoit aussi l’Eid al-Fitr, l’Eid al-Adha et le Taombaovao Malagasy selon les calendriers annoncés, ainsi que la Journée nationale de la culture à la date fixée par le ministère. L’administrateur peut les ajouter ou corriger leur date dès publication.</p>
              {year === 2026 && <p className="mt-2">Les dates 2026 des fêtes musulmanes affichées ici suivent le calendrier de l’<a className="font-semibold underline" href="https://mg.usembassy.gov/holiday-calendar/" target="_blank" rel="noreferrer">Ambassade des États-Unis à Madagascar</a>; elles restent ajustables selon l’annonce communautaire.</p>}
              {year === 2026 && <p className="mt-1">Liste nationale de 2026 : <a className="font-semibold underline" href="https://cnlegis.gov.mg/uploads/D2026-006-VF.pdf" target="_blank" rel="noreferrer">décret n° 2026-006</a>.</p>}
            </div>

            {admin && <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-700"><Clock3 className="h-4 w-4" /><h3 className="text-sm font-bold">Horaires de travail</h3></div>
              <p className="mt-1 text-xs text-slate-500">{settings.startTime ?? "08:00"} – {settings.endTime ?? "17:00"} · Tolérance {settings.toleranceMinutes} min</p>
              <button type="button" onClick={() => setShowSettings((open) => !open)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary-700"><Settings2 className="h-3.5 w-3.5" />Modifier les règles</button>
            </div>}
          </aside>
        </div>
      </>}
    </section>
  )
}


// import { useEffect,useState } from "react"
// import { listHolidays,createHoliday,deleteHoliday,getCalendarSettings,saveCalendarSettings,type Holiday,type CalendarSettings } from "../services/calendar"
// import { useAuth } from "../hooks/useAuth"
// import { errorMessage } from "../services/api"
// export default function CalendarPage(){
//  const {appUser}=useAuth(); const admin=appUser?.role==="admin"; const [holidays,setHolidays]=useState<Holiday[]>([]); const [settings,setSettings]=useState<CalendarSettings>({workDays:[1,2,3,4,5],toleranceMinutes:5}); const [date,setDate]=useState(new Date()); const [name,setName]=useState(""); const [day,setDay]=useState(""); const [err,setErr]=useState(""); const [loading,setLoading]=useState(true)
//  const refresh=()=>Promise.all([listHolidays(),getCalendarSettings()]).then(([h,s])=>{setHolidays(h);setSettings(s)}).catch(e=>setErr(errorMessage(e,"Chargement du calendrier impossible."))).finally(()=>setLoading(false))
//  useEffect(()=>{void refresh()},[])
//  const y=date.getFullYear(),m=date.getMonth(), first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate(); const pad=(first+6)%7
//  return <section className="space-y-4"><h1 className="text-2xl font-bold">Calendrier</h1>{err&&<p role="alert" className="text-red-700">{err}</p>}{loading?<p aria-live="polite">Chargement…</p>:<><div className="rounded-xl bg-white border p-4"><header className="flex justify-between items-center mb-4"><button className="px-3 py-2 border rounded" onClick={()=>setDate(new Date(y,m-1,1))} aria-label="Mois précédent">‹</button><h2 className="font-semibold">{date.toLocaleDateString("fr-FR",{month:"long",year:"numeric"})}</h2><button className="px-3 py-2 border rounded" onClick={()=>setDate(new Date(y,m+1,1))} aria-label="Mois suivant">›</button></header><div className="grid grid-cols-7 text-center gap-1">{["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map(x=><b key={x} className="text-xs">{x}</b>)}{Array.from({length:pad},(_,i)=><span key={'p'+i}/>)}{Array.from({length:days},(_,i)=>{const d=i+1,key=`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`,h=holidays.find(x=>x.date.slice(0,10)===key),weekend=(pad+i)%7>4;return <div key={key} title={h?.name} className={`min-h-12 p-1 rounded ${h?'bg-amber-200':weekend?'bg-slate-100':'bg-white'}`}><span>{d}</span>{h&&<small className="block truncate text-[9px]">{h.name}</small>}</div>})}</div><p className="text-xs mt-3 text-slate-500">Jours fériés en ambre · week-ends en gris.</p></div>{admin&&<div className="rounded-xl bg-white border p-4 space-y-3"><h2 className="font-semibold">Gestion des jours fériés et horaires</h2><form className="flex flex-wrap gap-2" onSubmit={async e=>{e.preventDefault();try{await createHoliday({date:day,name});setName("");setDay("");await refresh()}catch(x){setErr(errorMessage(x,"Ajout impossible."))}}}><input required aria-label="Date du jour férié" type="date" value={day} onChange={e=>setDay(e.target.value)} className="border rounded p-2"/><input required aria-label="Nom du jour férié" placeholder="Nom du jour férié" value={name} onChange={e=>setName(e.target.value)} className="border rounded p-2"/><button className="bg-primary-600 text-white rounded px-4">Ajouter</button></form>{holidays.map(h=><div className="flex justify-between border-b py-2" key={h.id}><span>{h.date} · {h.name}</span><button className="text-red-700 underline" onClick={async()=>{try{await deleteHoliday(h.id);await refresh()}catch(e){setErr(errorMessage(e,"Suppression impossible."))}}}>Supprimer</button></div>)}<form className="flex flex-wrap items-center gap-2" onSubmit={async e=>{e.preventDefault();try{await saveCalendarSettings(settings);setErr("")}catch(x){setErr(errorMessage(x,"Enregistrement impossible."))}}}><label>Début <input type="time" value={settings.startTime??"08:00"} onChange={e=>setSettings({...settings,startTime:e.target.value})}/></label><label>Fin <input type="time" value={settings.endTime??"17:00"} onChange={e=>setSettings({...settings,endTime:e.target.value})}/></label><label>Tolérance (min) <input type="number" min="0" max="60" value={settings.toleranceMinutes} onChange={e=>setSettings({...settings,toleranceMinutes:Number(e.target.value)})} className="border rounded w-20 p-1"/></label><button className="border rounded px-3 py-2">Enregistrer règles</button></form></div>}</>}</section>
// }
