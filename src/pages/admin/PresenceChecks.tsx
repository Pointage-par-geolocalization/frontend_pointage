// src/pages/admin/PresenceChecks.tsx
// Contrôles de présence sur les chantiers : historique des rondes (automatiques ou manuelles),
// détail par salarié et anomalies (sortie de zone, absence détectée).
import { useEffect, useMemo, useState } from "react"
import { useConfirm } from "../../contexts/ConfirmContext"
import {
  subscribeRounds, listChecks, triggerRound, PRESENCE_STATUS,
  type PresenceRound, type PresenceCheck, type PresenceStatus,
} from "../../services/presence"
import { listEmployees, employeeName, type Employee } from "../../services/employees"
import { listSites, type Site } from "../../services/sites"
import { getSettings } from "../../services/settings"
import { errorMessage } from "../../services/api"
import { todayKey } from "../../utils/date"
import { fmtDayLong, fmtTime } from "../../utils/format"
import Card from "../../components/Card"
import Badge from "../../components/Badge"
import EmptyState from "../../components/EmptyState"
import Dropdown from "../../components/Dropdown"
import Toast from "../../components/Toast"
import {
  Radar, Play, Loader2, ChevronDown, ChevronUp, UserCheck, MapPinOff, UserX, Users, User, HardHat, AlertTriangle, ListChecks,
} from "lucide-react"

type Tab = "rondes" | "anomalies"
type StatusFilter = "ANOMALIES" | "" | PresenceStatus

const ANOMALIES: PresenceStatus[] = ["HORS_ZONE", "SANS_REPONSE"]

function CheckRow({ c }: { c: PresenceCheck }) {
  const st = PRESENCE_STATUS[c.status]
  return (
    <tr>
      <td className="py-2 pr-3">
        <div className="font-medium text-slate-800">{c.employeeName}</div>
        <div className="text-xs text-slate-400 font-mono">{c.employeeCode}</div>
      </td>
      <td className="py-2 pr-3">
        <div>{c.siteName ?? c.departmentName ?? "—"}</div>
        {c.siteName && c.departmentName && <div className="text-xs text-slate-400">{c.departmentName}</div>}
      </td>
      <td className="py-2 pr-3"><Badge tone={st.tone}>{st.label}</Badge></td>
      <td className="py-2 pr-3 whitespace-nowrap">
        {c.distance != null
          ? <span className={c.radiusMeters != null && c.distance > c.radiusMeters ? "text-rose-600 font-semibold" : ""}>{c.distance} m</span>
          : "—"}
        {c.radiusMeters != null && <span className="text-xs text-slate-400"> / rayon {c.radiusMeters} m</span>}
      </td>
      <td className="py-2 pr-3 whitespace-nowrap">{c.locationAt ? fmtTime(c.locationAt) : <span className="text-slate-400">Aucune position</span>}</td>
      <td className="py-2 pr-3 whitespace-nowrap text-xs text-slate-500">{fmtTime(c.checkedAt)}</td>
    </tr>
  )
}

function ChecksTable({ checks, loading, empty }: { checks: PresenceCheck[]; loading: boolean; empty: string }) {
  if (loading) return <p className="text-sm text-slate-400 py-4 text-center">Chargement...</p>
  if (checks.length === 0) return <EmptyState message={empty} />
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b">
            <th className="py-2 pr-3">Salarié</th><th className="py-2 pr-3">Chantier / lieu</th><th className="py-2 pr-3">Résultat</th>
            <th className="py-2 pr-3">Distance</th><th className="py-2 pr-3">Position reçue</th><th className="py-2 pr-3">Contrôlé à</th>
          </tr>
        </thead>
        <tbody className="divide-y">{checks.map((c) => <CheckRow key={c.id} c={c} />)}</tbody>
      </table>
    </div>
  )
}

export default function AdminPresenceChecks() {
  const confirm = useConfirm()
  const [tab, setTab] = useState<Tab>("rondes")
  const [date, setDate] = useState(todayKey())
  const [interval, setIntervalMin] = useState<number | null>(null)
  const [enabled, setEnabled] = useState(true)

  const [rounds, setRounds] = useState<PresenceRound[]>([])
  const [roundsLoaded, setRoundsLoaded] = useState(false)
  const [openRound, setOpenRound] = useState<string | null>(null)
  const [roundChecks, setRoundChecks] = useState<PresenceCheck[]>([])
  const [roundLoading, setRoundLoading] = useState(false)

  const [employees, setEmployees] = useState<Employee[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [employeeCode, setEmployeeCode] = useState("")
  const [siteId, setSiteId] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ANOMALIES")
  const [dayChecks, setDayChecks] = useState<PresenceCheck[]>([])
  const [dayLoading, setDayLoading] = useState(false)

  const [triggering, setTriggering] = useState(false)
  const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null)

  useEffect(() => {
    getSettings().then((s) => { setIntervalMin(s.presenceCheckIntervalMinutes); setEnabled(s.presenceCheckEnabled) }).catch(() => {})
    listEmployees().then(setEmployees).catch(() => {})
    listSites().then(setSites).catch(() => {})
  }, [])

  useEffect(() => {
    setRoundsLoaded(false)
    setOpenRound(null)
    return subscribeRounds({ from: date, to: date }, (r) => { setRounds(r); setRoundsLoaded(true) },
      () => { setRoundsLoaded(true); setToast({ msg: "Impossible de charger les contrôles.", tone: "error" }) })
  }, [date])

  // Détail de la ronde ouverte, rechargé quand son évaluation se termine.
  const opened = rounds.find((r) => r.id === openRound) ?? null
  useEffect(() => {
    if (!openRound) return
    let cancelled = false
    setRoundLoading(true)
    listChecks({ roundId: openRound })
      .then((c) => { if (!cancelled) setRoundChecks(c) })
      .catch((e) => { if (!cancelled) setToast({ msg: errorMessage(e, "Impossible de charger le détail."), tone: "error" }) })
      .finally(() => { if (!cancelled) setRoundLoading(false) })
    return () => { cancelled = true }
  }, [openRound, opened?.evaluatedAt])

  // Vue « anomalies » : contrôles du jour filtrés.
  const lastEvaluation = rounds.map((r) => r.evaluatedAt ?? "").sort().pop()
  useEffect(() => {
    if (tab !== "anomalies") return
    let cancelled = false
    setDayLoading(true)
    const status = statusFilter && statusFilter !== "ANOMALIES" ? statusFilter : undefined
    listChecks({ date, employeeCode: employeeCode || undefined, siteId: siteId || undefined, status })
      .then((c) => {
        if (cancelled) return
        setDayChecks(statusFilter === "ANOMALIES" ? c.filter((x) => ANOMALIES.includes(x.status)) : c)
      })
      .catch((e) => { if (!cancelled) setToast({ msg: errorMessage(e, "Impossible de charger les contrôles."), tone: "error" }) })
      .finally(() => { if (!cancelled) setDayLoading(false) })
    return () => { cancelled = true }
  }, [tab, date, employeeCode, siteId, statusFilter, lastEvaluation])

  const totals = useMemo(() => rounds.reduce(
    (t, r) => ({ present: t.present + r.present, outOfZone: t.outOfZone + r.outOfZone, noResponse: t.noResponse + r.noResponse }),
    { present: 0, outOfZone: 0, noResponse: 0 },
  ), [rounds])

  async function handleTrigger() {
    const ok = await confirm({
      title: "Lancer un contrôle maintenant ?",
      message: "La position de chaque salarié en poste va être demandée à son téléphone puis comparée à la zone autorisée de son chantier.",
      confirmLabel: "Lancer le contrôle",
    })
    if (!ok) return
    setTriggering(true)
    try {
      const round = await triggerRound()
      setDate(todayKey())
      setTab("rondes")
      setOpenRound(round.id)
      setToast({ msg: "Contrôle lancé. Les résultats arrivent dans quelques minutes.", tone: "success" })
    } catch (e) {
      setToast({ msg: errorMessage(e, "Impossible de lancer le contrôle."), tone: "error" })
    } finally { setTriggering(false) }
  }

  const tabBtn = (t: Tab, label: string, icon: React.ReactNode) => (
    <button onClick={() => setTab(t)}
      className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition ${
        tab === t ? "bg-primary-600 text-white shadow-md shadow-primary-600/20" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
      {icon}{label}
    </button>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center border border-primary-100 shrink-0"><Radar className="w-5 h-5" /></div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Contrôles de présence</h1>
            <p className="text-sm text-slate-500 mt-0.5 max-w-2xl">
              {enabled
                ? <>La position des salariés en poste est vérifiée automatiquement {interval ? <>toutes les <strong>{interval} min</strong></> : "à intervalle régulier"} et comparée à la zone autorisée de leur chantier.</>
                : <>Le contrôle automatique est <strong>désactivé</strong>. Vous pouvez toujours lancer un contrôle manuellement.</>}
              {" "}Réglage dans Paramètres.
            </p>
          </div>
        </div>
        <button onClick={handleTrigger} disabled={triggering}
          className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-primary-600/20 flex items-center gap-2 disabled:opacity-60 shrink-0">
          {triggering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
          Lancer un contrôle maintenant
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {tabBtn("rondes", "Contrôles effectués", <ListChecks className="w-4 h-4" />)}
          {tabBtn("anomalies", "Anomalies du jour", <AlertTriangle className="w-4 h-4" />)}
        </div>
        <input type="date" value={date} max={todayKey()} onChange={(e) => e.target.value && setDate(e.target.value)}
          className="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Contrôles", value: rounds.length, icon: <Radar className="w-5 h-5" />, cls: "bg-blue-50 text-blue-600 border-blue-100" },
          { label: "Présents", value: totals.present, icon: <UserCheck className="w-5 h-5" />, cls: "bg-emerald-50 text-emerald-600 border-emerald-100" },
          { label: "Sorties de zone", value: totals.outOfZone, icon: <MapPinOff className="w-5 h-5" />, cls: "bg-rose-50 text-rose-600 border-rose-100" },
          { label: "Absences détectées", value: totals.noResponse, icon: <UserX className="w-5 h-5" />, cls: "bg-amber-50 text-amber-600 border-amber-100" },
        ].map((s) => (
          <div key={s.label} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">{s.label}</p>
              <p className="text-2xl font-bold text-slate-900">{s.value}</p>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${s.cls}`}>{s.icon}</div>
          </div>
        ))}
      </div>

      {tab === "rondes" && (
        <Card className="rounded-2xl p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 text-sm font-semibold text-slate-700 capitalize">{fmtDayLong(date)}</div>
          {!roundsLoaded && <p className="text-sm text-slate-400 py-6 text-center">Chargement...</p>}
          {roundsLoaded && rounds.length === 0 && <div className="p-4"><EmptyState message="Aucun contrôle ce jour-là." /></div>}
          <div className="divide-y divide-slate-100">
            {rounds.map((r) => {
              const isOpen = openRound === r.id
              const pending = !r.evaluatedAt
              return (
                <div key={r.id}>
                  <button onClick={() => setOpenRound(isOpen ? null : r.id)}
                    className={`w-full text-left px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 transition ${isOpen ? "bg-primary-50" : "hover:bg-slate-50"}`}>
                    <div className="flex items-center gap-2 min-w-[150px]">
                      <span className="font-bold text-slate-900">{fmtTime(r.startedAt)}</span>
                      <Badge tone={r.trigger === "AUTO" ? "gray" : "blue"}>{r.trigger === "AUTO" ? "Automatique" : "Manuel"}</Badge>
                    </div>
                    {pending ? (
                      <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700"><Loader2 className="w-3.5 h-3.5 animate-spin" />En cours d'évaluation…</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <span className="flex items-center gap-1 text-slate-500"><Users className="w-3.5 h-3.5" />{r.total} contrôlé{r.total > 1 ? "s" : ""}</span>
                        <span className="flex items-center gap-1 text-emerald-700 font-semibold"><UserCheck className="w-3.5 h-3.5" />{r.present}</span>
                        <span className={`flex items-center gap-1 font-semibold ${r.outOfZone ? "text-rose-600" : "text-slate-400"}`}><MapPinOff className="w-3.5 h-3.5" />{r.outOfZone}</span>
                        <span className={`flex items-center gap-1 font-semibold ${r.noResponse ? "text-amber-600" : "text-slate-400"}`}><UserX className="w-3.5 h-3.5" />{r.noResponse}</span>
                      </div>
                    )}
                    <span className="ml-auto text-slate-400">{isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 bg-primary-50/40">
                      <ChecksTable checks={roundChecks} loading={roundLoading} empty="Aucun salarié en poste lors de ce contrôle." />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {tab === "anomalies" && (
        <Card className="rounded-2xl space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Dropdown value={statusFilter} onChange={(v) => setStatusFilter(v as StatusFilter)} icon={<AlertTriangle className="w-4 h-4" />}
              options={[
                { value: "ANOMALIES", label: "Anomalies seulement" },
                { value: "HORS_ZONE", label: PRESENCE_STATUS.HORS_ZONE.label },
                { value: "SANS_REPONSE", label: PRESENCE_STATUS.SANS_REPONSE.label },
                { value: "PRESENT", label: PRESENCE_STATUS.PRESENT.label },
                { value: "", label: "Tous les résultats" },
              ]} />
            <Dropdown value={employeeCode} onChange={setEmployeeCode} placeholder="Tous les salariés" icon={<User className="w-4 h-4" />}
              options={[{ value: "", label: "Tous les salariés" }, ...employees.map((e) => ({ value: e.employeeCode, label: `${employeeName(e)} (${e.employeeCode})` }))]} />
            <Dropdown value={siteId} onChange={setSiteId} placeholder="Tous les chantiers" icon={<HardHat className="w-4 h-4" />}
              options={[{ value: "", label: "Tous les chantiers" }, ...sites.map((s) => ({ value: s.id, label: s.name }))]} />
          </div>
          <ChecksTable checks={dayChecks} loading={dayLoading}
            empty={statusFilter === "ANOMALIES" ? "Aucune anomalie ce jour-là 🎉" : "Aucun contrôle pour ces critères."} />
        </Card>
      )}

      {toast && <Toast message={toast.msg} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  )
}
