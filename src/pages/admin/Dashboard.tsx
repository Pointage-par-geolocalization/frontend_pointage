// src/pages/admin/Dashboard.tsx
import { useEffect, useState } from "react"
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
  Sparkles,
  Radar,
  CalendarClock,
  Package,
  HardHat,
  ChevronRight,
} from "lucide-react"

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardToday | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = () => getDashboardToday()
      .then((d) => { if (!cancelled) { setData(d); setError(null) } })
      .catch((e) => { if (!cancelled) setError(errorMessage(e, "Impossible de charger le tableau de bord.")) })
    load()
    // Rafraîchi à chaque contrôle de présence / décision, et toutes les minutes.
    const off = onEvents(["presence.updated", "leave.updated", "loans.pending", "attendance.updated", "resync"], load)
    const timer = setInterval(() => { if (!document.hidden) load() }, 60000)
    return () => { cancelled = true; off(); clearInterval(timer) }
  }, [])

  // Date du jour formatée proprement en français
  const formattedDate = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const lastRound = data?.presence.lastRound ?? null

  return (
    <div className="space-y-8 pb-10">

      {/* En-tête du Dashboard */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-primary-600 text-xs font-semibold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Tableau de bord Administrateur</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 capitalize">Aperçu Général</h1>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-600">
          <CalendarDays className="w-4 h-4 text-primary-600" />
          <span className="capitalize">{formattedDate}</span>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium">{error}</div>
      )}

      {/* Grille des statistiques principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Salariés Actifs" value={data?.activeEmployees} icon={<Users className="w-6 h-6" />} tone="blue" />
        <StatTile label="Présents" value={data?.presentCount} icon={<UserCheck className="w-6 h-6" />} tone="emerald" />
        <StatTile label="Absents" value={data?.absent.length} icon={<UserX className="w-6 h-6" />} tone="rose" />
        <StatTile
          label="Heures Cumulées"
          value={data ? <>{(data.totalMinutes / 60).toFixed(1)} <span className="text-sm font-normal text-slate-500">h</span></> : undefined}
          icon={<Clock className="w-6 h-6" />} tone="indigo"
        />
      </div>

      {/* Statistiques financières du jour */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-primary-900 to-primary-800 text-white p-6 rounded-2xl shadow-md flex items-center justify-between relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-200 mb-1">Paie du jour estimée</p>
            <h3 className="text-2xl sm:text-3xl font-extrabold">{data ? formatAriary(data.dailyPay) : "..."}</h3>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center text-primary-200 relative z-10">
            <Wallet className="w-7 h-7" />
          </div>
          <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-primary-600/30 rounded-full blur-2xl"></div>
        </div>

        <Link to="/admin/remunerations" className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-md flex items-center justify-between relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">Cash restant à payer (Global)</p>
            <h3 className="text-2xl sm:text-3xl font-extrabold">{data ? formatAriary(data.cashDue) : "..."}</h3>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center text-slate-200 relative z-10">
            <Banknote className="w-7 h-7" />
          </div>
          <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-slate-700/30 rounded-full blur-2xl"></div>
        </Link>
      </div>

      {/* À traiter */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <QuickLink to="/admin/permissions" icon={<CalendarClock className="w-5 h-5" />} label="Permissions en attente" value={data?.pendingLeaves} highlight={!!data?.pendingLeaves} />
        <QuickLink to="/admin/materiel" icon={<Package className="w-5 h-5" />} label="Demandes de matériel" value={data?.pendingLoans} highlight={!!data?.pendingLoans} />
        <QuickLink to="/admin/chantiers" icon={<HardHat className="w-5 h-5" />} label="Chantiers en cours" value={data?.activeSites} />
      </div>

      {/* Contrôle de présence sur les chantiers */}
      <Card>
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary-50 text-primary-600 border border-primary-100">
              <Radar className="w-5 h-5" />
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
            Historique <ChevronRight className="w-3.5 h-3.5" />
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
          <p className="text-sm text-slate-400">Aucune anomalie détectée aujourd'hui.</p>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Classement des heures */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <Trophy className="w-5 h-5" />
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
                <span className="font-bold text-primary-600 bg-primary-50 px-3 py-1 rounded-lg text-xs">
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
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <h2 className="text-base font-bold text-slate-900">En poste actuellement</h2>
          </div>

          {data?.currentlyIn.length === 0 && <EmptyState message="Personne n'est pointé entrée en ce moment." />}

          <div className="space-y-3">
            {data?.currentlyIn.map((r) => (
              <div key={r.attendanceId} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0"></span>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 truncate">{r.name}</div>
                    <div className="text-xs text-slate-500 truncate">{r.siteName ?? r.departmentName}</div>
                  </div>
                </div>
                <span className="text-slate-500 text-xs font-medium bg-white px-2.5 py-1 rounded-md border border-slate-200 shrink-0">
                  Entré à {fmtTime(r.entryTime)}
                </span>
              </div>
            ))}
          </div>
        </Card>

      </div>

      {/* Sections Retards & Absents */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Retards */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <AlertCircle className="w-5 h-5" />
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
              <UserX className="w-5 h-5" />
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
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">En permission</p>
              <div className="flex flex-wrap gap-2">
                {data.onLeave.map((e) => (
                  <Badge key={e.employeeCode} tone="blue">{e.name} · {LEAVE_TYPES[e.type as LeaveType] ?? e.type}</Badge>
                ))}
              </div>
            </div>
          )}
        </Card>

      </div>

      <p className="text-xs text-slate-400 text-center pt-4">
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

function StatTile({ label, value, icon, tone }: { label: string; value: React.ReactNode; icon: React.ReactNode; tone: keyof typeof TONES }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between transition hover:shadow-md">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
        <h3 className={`text-2xl font-bold ${VALUE_TONES[tone]}`}>{value ?? "..."}</h3>
      </div>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${TONES[tone]}`}>{icon}</div>
    </div>
  )
}

function QuickLink({ to, icon, label, value, highlight }: { to: string; icon: React.ReactNode; label: string; value?: number; highlight?: boolean }) {
  return (
    <Link to={to} className={`flex items-center gap-3 p-4 rounded-2xl border shadow-sm transition hover:shadow-md ${
      highlight ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${highlight ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-slate-500 truncate">{label}</div>
        <div className="text-lg font-bold text-slate-900">{value ?? "..."}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-400" />
    </Link>
  )
}
