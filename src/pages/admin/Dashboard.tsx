// src/pages/admin/Dashboard.tsx
import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { getDashboardToday, type DashboardToday } from "../../services/admin"
import { errorMessage } from "../../services/api"
import { onEvents } from "../../services/realtime"
import { PRESENCE_STATUS } from "../../services/presence"
import { LEAVE_TYPES, type LeaveType } from "../../services/leaves"
import { formatAriary, minutesToHoursLabel } from "../../utils/salaryCalculator"
import { fmtTime } from "../../utils/format"
import Card from "../../components/Card"
import Badge from "../../components/Badge"
import EmptyState from "../../components/EmptyState"
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Wallet,
  Banknote,
  Trophy,
  Activity,
  AlertCircle,
  CalendarDays,
  Radar,
  CalendarClock,
  Package,
  HardHat,
  ChevronRight,
  ArrowUpRight,
  RefreshCw,
  CheckCircle2,
} from "lucide-react"

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardToday | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const alive = useRef(true)

  const load = useCallback(async () => {
    try {
      const d = await getDashboardToday()
      if (!alive.current) return
      setData(d)
      setError(null)
      setUpdatedAt(new Date())
    } catch (e) {
      if (alive.current) setError(errorMessage(e, "Impossible de charger le tableau de bord."))
    }
  }, [])

  useEffect(() => {
    alive.current = true
    load()
    // Rafraîchi à chaque contrôle de présence / décision, et toutes les minutes.
    const off = onEvents(["presence.updated", "leave.updated", "loans.pending", "attendance.updated", "resync"], load)
    const timer = setInterval(() => { if (!document.hidden) load() }, 60000)
    return () => { alive.current = false; off(); clearInterval(timer) }
  }, [load])

  async function refresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  // Date du jour formatée proprement en français
  const formattedDate = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const lastRound = data?.presence.lastRound ?? null
  const pending = (data?.pendingLeaves ?? 0) + (data?.pendingLoans ?? 0)

  // Contexte des chiffres : un « 0 » seul ne dit pas si c'est normal ou non.
  const presentSub = data
    ? `sur ${data.activeEmployees} salarié${data.activeEmployees > 1 ? "s" : ""} actif${data.activeEmployees > 1 ? "s" : ""}${data.late.length > 0 ? ` · ${data.late.length} en retard` : ""}`
    : undefined
  const absentSub = data
    ? data.absent.length === 0 ? "Aucune absence aujourd'hui" : data.onLeave.length > 0 ? `${data.onLeave.length} en permission` : "Aucune permission acceptée"
    : undefined
  const hoursSub = data
    ? data.currentlyIn.length > 0 ? `${data.currentlyIn.length} en poste maintenant` : "Personne en poste actuellement"
    : undefined

  return (
    <div className="dash space-y-6 pb-10">

      {/* En-tête du Dashboard */}
      <div className="relative overflow-hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary-100/70 blur-3xl" />
        <div className="relative">
          <h1 className="text-2xl font-extrabold text-slate-900">Aperçu général</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
            <CalendarDays className="w-4 h-4 text-primary-600" aria-hidden="true" />
            <span className="capitalize">{formattedDate}</span>
          </p>
        </div>
        <div className="relative flex items-center gap-2 text-xs text-slate-500">
          {updatedAt && (
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Mis à jour à {fmtTime(updatedAt.toISOString())}
            </span>
          )}
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            aria-label="Actualiser le tableau de bord"
            title="Actualiser"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium">
          <span>{error}</span>
          <button type="button" onClick={refresh} className="shrink-0 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50">
            Réessayer
          </button>
        </div>
      )}

      {/* Grille des statistiques principales */}
      <section aria-label="Présences du jour" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Salariés actifs" value={data?.activeEmployees} icon={<Users className="w-5 h-5" />} tone="blue"
          sub={data ? `${data.activeSites} chantier${data.activeSites > 1 ? "s" : ""} en cours` : undefined} />
        <StatTile label="Présents" value={data?.presentCount} icon={<UserCheck className="w-5 h-5" />} tone="emerald"
          sub={presentSub}
          progress={data && data.activeEmployees > 0 ? data.presentCount / data.activeEmployees : undefined} />
        <StatTile label="Absents" value={data?.absent.length} icon={<UserX className="w-5 h-5" />} tone="rose" sub={absentSub} />
        <StatTile
          label="Heures cumulées"
          value={data ? <>{(data.totalMinutes / 60).toFixed(1)} <span className="text-sm font-normal text-slate-500">h</span></> : undefined}
          icon={<Clock className="w-5 h-5" />} tone="indigo" sub={hoursSub}
        />
      </section>

      {/* Statistiques financières du jour */}
      <section aria-label="Finances" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-primary-900 to-primary-800 text-white p-6 rounded-2xl shadow-md flex items-center justify-between relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-200 mb-1">Paie du jour estimée</p>
            <p className="text-2xl sm:text-3xl font-extrabold tabular-nums">{data ? formatAriary(data.dailyPay) : <SkeletonDark className="h-9 w-40" />}</p>
            <p className="mt-1 text-xs text-primary-200">Estimation d'après les pointages du jour</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center text-primary-200 relative z-10">
            <Wallet className="w-7 h-7" aria-hidden="true" />
          </div>
          <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-primary-600/30 rounded-full blur-2xl"></div>
        </div>

        <Link
          to="/admin/remunerations"
          className="group bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-md flex items-center justify-between relative overflow-hidden transition hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          <div className="relative z-10">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">Cash restant à payer (global)</p>
            <p className="text-2xl sm:text-3xl font-extrabold tabular-nums">{data ? formatAriary(data.cashDue) : <SkeletonDark className="h-9 w-40" />}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-300">
              Voir le détail des rémunérations
              <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
            </p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center text-slate-200 relative z-10">
            <Banknote className="w-7 h-7" aria-hidden="true" />
          </div>
          <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-slate-700/30 rounded-full blur-2xl"></div>
        </Link>
      </section>

      {/* À traiter */}
      <section aria-labelledby="todo-title">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id="todo-title" className="text-sm font-bold text-slate-900">À traiter</h2>
          {data && (
            pending > 0 ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">{pending} en attente</span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Tout est à jour
              </span>
            )
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <QuickLink to="/admin/permissions" icon={<CalendarClock className="w-5 h-5" />} label="Permissions en attente" value={data?.pendingLeaves} highlight={!!data?.pendingLeaves} />
          <QuickLink to="/admin/materiel" icon={<Package className="w-5 h-5" />} label="Demandes de matériel" value={data?.pendingLoans} highlight={!!data?.pendingLoans} />
          <QuickLink to="/admin/chantiers" icon={<HardHat className="w-5 h-5" />} label="Chantiers en cours" value={data?.activeSites} />
        </div>
      </section>

      {/* Contrôle de présence sur les chantiers */}
      <Card>
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary-50 text-primary-600 border border-primary-100">
              <Radar className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Contrôle de présence</h2>
              <p className="text-xs text-slate-500">
                {lastRound
                  ? `Dernier contrôle à ${fmtTime(lastRound.startedAt)}${lastRound.evaluatedAt ? "" : " (en cours d'évaluation)"}`
                  : "Aucun contrôle aujourd'hui pour l'instant."}
              </p>
            </div>
          </div>
          <Link to="/admin/controles" className="text-xs font-semibold text-primary-700 hover:underline flex items-center gap-0.5 shrink-0">
            Historique <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        {lastRound && lastRound.evaluatedAt && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
              <div className="text-xl font-bold text-emerald-700">{lastRound.present}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700/80">Équipe présente</div>
            </div>
            <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-center">
              <div className="text-xl font-bold text-rose-700">{lastRound.outOfZone}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-700/80">Sortis de zone</div>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-center">
              <div className="text-xl font-bold text-amber-700">{lastRound.noResponse}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700/80">Absences détectées</div>
            </div>
          </div>
        )}

        {data && data.presence.anomalies.length === 0 ? (
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" /> Aucune anomalie détectée aujourd'hui.
          </p>
        ) : (
          <div className="space-y-2">
            {data?.presence.anomalies.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800 truncate">{c.employeeName}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {c.siteName ?? c.departmentName ?? "—"} · {fmtTime(c.checkedAt)}
                    {c.distance != null && ` · ${c.distance} m (rayon ${c.radiusMeters} m)`}
                  </div>
                </div>
                <Badge tone={PRESENCE_STATUS[c.status].tone}>{PRESENCE_STATUS[c.status].label}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Sections de détails (Classement & Poste actuel) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Classement des heures */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <Trophy className="w-5 h-5" aria-hidden="true" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Heures travaillées aujourd'hui</h2>
          </div>

          {data?.topWorked.length === 0 && <EmptyState message="Aucun pointage terminé aujourd'hui pour l'instant." />}

          <div className="space-y-3">
            {data?.topWorked.map((r, i) => (
              <div key={r.employeeCode} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${i === 0 ? 'bg-amber-500 text-white' : i === 1 ? 'bg-slate-300 text-slate-800' : i === 2 ? 'bg-amber-700/60 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {i + 1}
                  </span>
                  <span className="font-semibold text-slate-800 truncate">{r.name}</span>
                </div>
                <span className="font-bold text-primary-600 bg-primary-50 px-3 py-1 rounded-lg text-xs tabular-nums">
                  {minutesToHoursLabel(r.minutes)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* En poste actuellement */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Activity className="w-5 h-5 animate-pulse" aria-hidden="true" />
            </div>
            <h2 className="text-base font-bold text-slate-900">En poste actuellement</h2>
          </div>

          {data?.currentlyIn.length === 0 && <EmptyState message="Personne n'est pointé entrée en ce moment." />}

          <div className="space-y-3">
            {data?.currentlyIn.map((r) => (
              <div key={r.attendanceId} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 truncate">{r.name}</div>
                    <div className="text-xs text-slate-500 truncate">{r.siteName ?? r.departmentName}</div>
                  </div>
                </div>
                <span className="text-slate-600 text-xs font-medium bg-white px-2.5 py-1 rounded-md border border-slate-200 shrink-0">
                  Entré à {fmtTime(r.entryTime)}
                </span>
              </div>
            ))}
          </div>
        </Card>

      </div>

      {/* Sections Retards & Absents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Retards */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <AlertCircle className="w-5 h-5" aria-hidden="true" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Retards aujourd'hui</h2>
          </div>

          {data?.late.length === 0 && <EmptyState message="Aucun retard enregistré aujourd'hui 🎉" />}

          <div className="space-y-3">
            {data?.late.map((r) => (
              <div key={r.employeeCode} className="flex items-center justify-between p-3 rounded-xl bg-amber-50/50 border border-amber-100 text-sm">
                <span className="font-semibold text-slate-800 truncate">{r.name}</span>
                <Badge tone="yellow">
                  +{r.lateMinutes >= 60 ? minutesToHoursLabel(r.lateMinutes) : `${r.lateMinutes} min`}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Absents */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
              <UserX className="w-5 h-5" aria-hidden="true" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Absents aujourd'hui</h2>
          </div>

          {data && data.absent.length === 0 && data.onLeave.length === 0 && <EmptyState message="Tout le monde a pointé aujourd'hui 🎉" />}

          <div className="flex flex-wrap gap-2">
            {data?.absent.map((e) => (
              <Badge key={e.employeeCode} tone="red">{e.name}</Badge>
            ))}
          </div>

          {data && data.onLeave.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">En permission</p>
              <div className="flex flex-wrap gap-2">
                {data.onLeave.map((e) => (
                  <Badge key={e.employeeCode} tone="blue">{e.name} · {LEAVE_TYPES[e.type as LeaveType] ?? e.type}</Badge>
                ))}
              </div>
            </div>
          )}
        </Card>

      </div>

      <p className="text-xs text-slate-500 text-center pt-4">
        * Le classement des heures ne compte que les pointages du jour déjà terminés (sortie effectuée). Le retard est calculé sur la première entrée de la journée. Le détail complet reste disponible dans Rémunérations / Rapports.
      </p>

    </div>
  )
}

const TONES = {
  blue: "bg-blue-50 text-blue-600 border-blue-100",
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  rose: "bg-rose-50 text-rose-600 border-rose-100",
  indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
}
const VALUE_TONES = { blue: "text-slate-900", emerald: "text-emerald-600", rose: "text-rose-600", indigo: "text-slate-900" }

function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-md bg-slate-200 ${className}`} />
}
function SkeletonDark({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-md bg-white/15 ${className}`} />
}

function StatTile({ label, value, icon, tone, sub, progress }: {
  label: string
  value: React.ReactNode
  icon: React.ReactNode
  tone: keyof typeof TONES
  /** Phrase de contexte sous le chiffre (« sur 5 salariés actifs »…). */
  sub?: string
  /** 0 → 1 : barre de progression sous le chiffre. */
  progress?: number
}) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</p>
          <div className={`text-3xl font-bold leading-tight tabular-nums ${VALUE_TONES[tone]}`}>
            {value ?? <Skeleton className="mt-1 h-8 w-14" />}
          </div>
        </div>
        <div className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center border ${TONES[tone]}`} aria-hidden="true">{icon}</div>
      </div>
      {progress != null && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label={`${label} : ${Math.round(progress * 100)} %`}>
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      <p className="mt-2 min-h-[1rem] text-xs text-slate-500">{sub}</p>
    </div>
  )
}

function QuickLink({ to, icon, label, value, highlight }: { to: string; icon: React.ReactNode; label: string; value?: number; highlight?: boolean }) {
  return (
    <Link to={to} className={`group flex items-center gap-3 p-4 rounded-2xl border shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
      highlight ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${highlight ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`} aria-hidden="true">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-slate-600 truncate">{label}</div>
        <div className="text-lg font-bold text-slate-900 tabular-nums">{value ?? <Skeleton className="mt-1 h-5 w-8" />}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  )
}


// // src/pages/admin/Dashboard.tsx
// import { useEffect, useState } from "react"
// import { Link } from "react-router-dom"
// import { getDashboardToday, type DashboardToday } from "../../services/admin"
// import { errorMessage } from "../../services/api"
// import { onEvents } from "../../services/realtime"
// import { PRESENCE_STATUS } from "../../services/presence"
// import { LEAVE_TYPES, type LeaveType } from "../../services/leaves"
// import { formatAriary, minutesToHoursLabel } from "../../utils/salaryCalculator"
// import { fmtTime } from "../../utils/format"
// import Card from "../../components/Card"
// import Badge from "../../components/Badge"
// import EmptyState from "../../components/EmptyState"
// import {
//   Users,
//   UserCheck,
//   UserX,
//   Clock,
//   Wallet,
//   Banknote,
//   Trophy,
//   Activity,
//   AlertCircle,
//   CalendarDays,
//   Sparkles,
//   Radar,
//   CalendarClock,
//   Package,
//   HardHat,
//   ChevronRight,
// } from "lucide-react"

// export default function AdminDashboard() {
//   const [data, setData] = useState<DashboardToday | null>(null)
//   const [error, setError] = useState<string | null>(null)

//   useEffect(() => {
//     let cancelled = false
//     const load = () => getDashboardToday()
//       .then((d) => { if (!cancelled) { setData(d); setError(null) } })
//       .catch((e) => { if (!cancelled) setError(errorMessage(e, "Impossible de charger le tableau de bord.")) })
//     load()
//     // Rafraîchi à chaque contrôle de présence / décision, et toutes les minutes.
//     const off = onEvents(["presence.updated", "leave.updated", "loans.pending", "attendance.updated", "resync"], load)
//     const timer = setInterval(() => { if (!document.hidden) load() }, 60000)
//     return () => { cancelled = true; off(); clearInterval(timer) }
//   }, [])

//   // Date du jour formatée proprement en français
//   const formattedDate = new Date().toLocaleDateString("fr-FR", {
//     weekday: "long",
//     year: "numeric",
//     month: "long",
//     day: "numeric",
//   })

//   const lastRound = data?.presence.lastRound ?? null

//   return (
//     <div className="space-y-8 pb-10">

//       {/* En-tête du Dashboard */}
//       <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
//         <div>
//           <div className="flex items-center gap-2 text-primary-600 text-xs font-semibold uppercase tracking-wider mb-1">
//             <Sparkles className="w-4 h-4" />
//             <span>Tableau de bord Administrateur</span>
//           </div>
//           <h1 className="text-2xl font-extrabold text-slate-900 capitalize">Aperçu Général</h1>
//         </div>
//         <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-600">
//           <CalendarDays className="w-4 h-4 text-primary-600" />
//           <span className="capitalize">{formattedDate}</span>
//         </div>
//       </div>

//       {error && (
//         <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium">{error}</div>
//       )}

//       {/* Grille des statistiques principales */}
//       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
//         <StatTile label="Salariés Actifs" value={data?.activeEmployees} icon={<Users className="w-6 h-6" />} tone="blue" />
//         <StatTile label="Présents" value={data?.presentCount} icon={<UserCheck className="w-6 h-6" />} tone="emerald" />
//         <StatTile label="Absents" value={data?.absent.length} icon={<UserX className="w-6 h-6" />} tone="rose" />
//         <StatTile
//           label="Heures Cumulées"
//           value={data ? <>{(data.totalMinutes / 60).toFixed(1)} <span className="text-sm font-normal text-slate-500">h</span></> : undefined}
//           icon={<Clock className="w-6 h-6" />} tone="indigo"
//         />
//       </div>

//       {/* Statistiques financières du jour */}
//       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//         <div className="bg-gradient-to-br from-primary-900 to-primary-800 text-white p-6 rounded-2xl shadow-md flex items-center justify-between relative overflow-hidden">
//           <div className="relative z-10">
//             <p className="text-xs font-semibold uppercase tracking-wider text-primary-200 mb-1">Paie du jour estimée</p>
//             <h3 className="text-2xl sm:text-3xl font-extrabold">{data ? formatAriary(data.dailyPay) : "..."}</h3>
//           </div>
//           <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center text-primary-200 relative z-10">
//             <Wallet className="w-7 h-7" />
//           </div>
//           <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-primary-600/30 rounded-full blur-2xl"></div>
//         </div>

//         <Link to="/admin/remunerations" className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-md flex items-center justify-between relative overflow-hidden">
//           <div className="relative z-10">
//             <p className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">Cash restant à payer (Global)</p>
//             <h3 className="text-2xl sm:text-3xl font-extrabold">{data ? formatAriary(data.cashDue) : "..."}</h3>
//           </div>
//           <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center text-slate-200 relative z-10">
//             <Banknote className="w-7 h-7" />
//           </div>
//           <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-slate-700/30 rounded-full blur-2xl"></div>
//         </Link>
//       </div>

//       {/* À traiter */}
//       <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
//         <QuickLink to="/admin/permissions" icon={<CalendarClock className="w-5 h-5" />} label="Permissions en attente" value={data?.pendingLeaves} highlight={!!data?.pendingLeaves} />
//         <QuickLink to="/admin/materiel" icon={<Package className="w-5 h-5" />} label="Demandes de matériel" value={data?.pendingLoans} highlight={!!data?.pendingLoans} />
//         <QuickLink to="/admin/chantiers" icon={<HardHat className="w-5 h-5" />} label="Chantiers en cours" value={data?.activeSites} />
//       </div>

//       {/* Contrôle de présence sur les chantiers */}
//       <Card>
//         <div className="flex items-center justify-between gap-2 mb-4">
//           <div className="flex items-center gap-2">
//             <div className="p-2 rounded-xl bg-primary-50 text-primary-600 border border-primary-100">
//               <Radar className="w-5 h-5" />
//             </div>
//             <div>
//               <h2 className="text-base font-bold text-slate-900">Contrôle de présence</h2>
//               <p className="text-xs text-slate-500">
//                 {lastRound
//                   ? `Dernier contrôle à ${fmtTime(lastRound.startedAt)}${lastRound.evaluatedAt ? "" : " (en cours d'évaluation)"}`
//                   : "Aucun contrôle aujourd'hui pour l'instant."}
//               </p>
//             </div>
//           </div>
//           <Link to="/admin/controles" className="text-xs font-semibold text-primary-700 hover:underline flex items-center gap-0.5 shrink-0">
//             Historique <ChevronRight className="w-3.5 h-3.5" />
//           </Link>
//         </div>

//         {lastRound && lastRound.evaluatedAt && (
//           <div className="grid grid-cols-3 gap-3 mb-4">
//             <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-center">
//               <div className="text-xl font-bold text-emerald-700">{lastRound.present}</div>
//               <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700/80">Équipe présente</div>
//             </div>
//             <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-center">
//               <div className="text-xl font-bold text-rose-700">{lastRound.outOfZone}</div>
//               <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-700/80">Sortis de zone</div>
//             </div>
//             <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-center">
//               <div className="text-xl font-bold text-amber-700">{lastRound.noResponse}</div>
//               <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700/80">Absences détectées</div>
//             </div>
//           </div>
//         )}

//         {data && data.presence.anomalies.length === 0 ? (
//           <p className="text-sm text-slate-400">Aucune anomalie détectée aujourd'hui.</p>
//         ) : (
//           <div className="space-y-2">
//             {data?.presence.anomalies.map((c) => (
//               <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm">
//                 <div className="min-w-0">
//                   <div className="font-semibold text-slate-800 truncate">{c.employeeName}</div>
//                   <div className="text-xs text-slate-500 truncate">
//                     {c.siteName ?? c.departmentName ?? "—"} · {fmtTime(c.checkedAt)}
//                     {c.distance != null && ` · ${c.distance} m (rayon ${c.radiusMeters} m)`}
//                   </div>
//                 </div>
//                 <Badge tone={PRESENCE_STATUS[c.status].tone}>{PRESENCE_STATUS[c.status].label}</Badge>
//               </div>
//             ))}
//           </div>
//         )}
//       </Card>

//       {/* Sections de détails (Classement & Poste actuel) */}
//       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

//         {/* Classement des heures */}
//         <Card>
//           <div className="flex items-center gap-2 mb-4">
//             <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
//               <Trophy className="w-5 h-5" />
//             </div>
//             <h2 className="text-base font-bold text-slate-900">Heures travaillées aujourd'hui</h2>
//           </div>

//           {data?.topWorked.length === 0 && <EmptyState message="Aucun pointage terminé aujourd'hui pour l'instant." />}

//           <div className="space-y-3">
//             {data?.topWorked.map((r, i) => (
//               <div key={r.employeeCode} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm">
//                 <div className="flex items-center gap-3 min-w-0">
//                   <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${i === 0 ? 'bg-amber-500 text-white' : i === 1 ? 'bg-slate-300 text-slate-800' : i === 2 ? 'bg-amber-700/60 text-white' : 'bg-slate-200 text-slate-600'}`}>
//                     {i + 1}
//                   </span>
//                   <span className="font-semibold text-slate-800 truncate">{r.name}</span>
//                 </div>
//                 <span className="font-bold text-primary-600 bg-primary-50 px-3 py-1 rounded-lg text-xs">
//                   {minutesToHoursLabel(r.minutes)}
//                 </span>
//               </div>
//             ))}
//           </div>
//         </Card>

//         {/* En poste actuellement */}
//         <Card>
//           <div className="flex items-center gap-2 mb-4">
//             <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
//               <Activity className="w-5 h-5 animate-pulse" />
//             </div>
//             <h2 className="text-base font-bold text-slate-900">En poste actuellement</h2>
//           </div>

//           {data?.currentlyIn.length === 0 && <EmptyState message="Personne n'est pointé entrée en ce moment." />}

//           <div className="space-y-3">
//             {data?.currentlyIn.map((r) => (
//               <div key={r.attendanceId} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm">
//                 <div className="flex items-center gap-2.5 min-w-0">
//                   <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0"></span>
//                   <div className="min-w-0">
//                     <div className="font-semibold text-slate-800 truncate">{r.name}</div>
//                     <div className="text-xs text-slate-500 truncate">{r.siteName ?? r.departmentName}</div>
//                   </div>
//                 </div>
//                 <span className="text-slate-500 text-xs font-medium bg-white px-2.5 py-1 rounded-md border border-slate-200 shrink-0">
//                   Entré à {fmtTime(r.entryTime)}
//                 </span>
//               </div>
//             ))}
//           </div>
//         </Card>

//       </div>

//       {/* Sections Retards & Absents */}
//       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

//         {/* Retards */}
//         <Card>
//           <div className="flex items-center gap-2 mb-4">
//             <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
//               <AlertCircle className="w-5 h-5" />
//             </div>
//             <h2 className="text-base font-bold text-slate-900">Retards aujourd'hui</h2>
//           </div>

//           {data?.late.length === 0 && <EmptyState message="Aucun retard enregistré aujourd'hui 🎉" />}

//           <div className="space-y-3">
//             {data?.late.map((r) => (
//               <div key={r.employeeCode} className="flex items-center justify-between p-3 rounded-xl bg-amber-50/50 border border-amber-100 text-sm">
//                 <span className="font-semibold text-slate-800 truncate">{r.name}</span>
//                 <Badge tone="yellow">
//                   +{r.lateMinutes >= 60 ? minutesToHoursLabel(r.lateMinutes) : `${r.lateMinutes} min`}
//                 </Badge>
//               </div>
//             ))}
//           </div>
//         </Card>

//         {/* Absents */}
//         <Card>
//           <div className="flex items-center gap-2 mb-4">
//             <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
//               <UserX className="w-5 h-5" />
//             </div>
//             <h2 className="text-base font-bold text-slate-900">Absents aujourd'hui</h2>
//           </div>

//           {data && data.absent.length === 0 && data.onLeave.length === 0 && <EmptyState message="Tout le monde a pointé aujourd'hui 🎉" />}

//           <div className="flex flex-wrap gap-2">
//             {data?.absent.map((e) => (
//               <Badge key={e.employeeCode} tone="red">{e.name}</Badge>
//             ))}
//           </div>

//           {data && data.onLeave.length > 0 && (
//             <div className="mt-4 pt-3 border-t border-slate-100">
//               <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">En permission</p>
//               <div className="flex flex-wrap gap-2">
//                 {data.onLeave.map((e) => (
//                   <Badge key={e.employeeCode} tone="blue">{e.name} · {LEAVE_TYPES[e.type as LeaveType] ?? e.type}</Badge>
//                 ))}
//               </div>
//             </div>
//           )}
//         </Card>

//       </div>

//       <p className="text-xs text-slate-400 text-center pt-4">
//         * Le classement des heures ne compte que les pointages du jour déjà terminés (sortie effectuée). Le retard est calculé sur la première entrée de la journée. Le détail complet reste disponible dans Rémunérations / Rapports.
//       </p>

//     </div>
//   )
// }

// const TONES = {
//   blue: "bg-blue-50 text-blue-600 border-blue-100",
//   emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
//   rose: "bg-rose-50 text-rose-600 border-rose-100",
//   indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
// }
// const VALUE_TONES = { blue: "text-slate-900", emerald: "text-emerald-600", rose: "text-rose-600", indigo: "text-slate-900" }

// function StatTile({ label, value, icon, tone }: { label: string; value: React.ReactNode; icon: React.ReactNode; tone: keyof typeof TONES }) {
//   return (
//     <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between transition hover:shadow-md">
//       <div>
//         <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
//         <h3 className={`text-2xl font-bold ${VALUE_TONES[tone]}`}>{value ?? "..."}</h3>
//       </div>
//       <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${TONES[tone]}`}>{icon}</div>
//     </div>
//   )
// }

// function QuickLink({ to, icon, label, value, highlight }: { to: string; icon: React.ReactNode; label: string; value?: number; highlight?: boolean }) {
//   return (
//     <Link to={to} className={`flex items-center gap-3 p-4 rounded-2xl border shadow-sm transition hover:shadow-md ${
//       highlight ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"}`}>
//       <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${highlight ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{icon}</div>
//       <div className="flex-1 min-w-0">
//         <div className="text-xs font-semibold text-slate-500 truncate">{label}</div>
//         <div className="text-lg font-bold text-slate-900">{value ?? "..."}</div>
//       </div>
//       <ChevronRight className="w-4 h-4 text-slate-400" />
//     </Link>
//   )
// }
