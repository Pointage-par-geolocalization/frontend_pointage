// src/pages/admin/SiteDetail.tsx
// Espace de suivi centralisé d'un chantier : équipe, étapes, pointages, contrôles de présence,
// permissions, devis & factures et journal de chantier.
import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  getSite, updateSite, deleteSite, setSiteMembers, addSiteStep, updateSiteStep, deleteSiteStep, addSiteNote, deleteSiteNote,
  SITE_STATUS, type SiteDetail, type SiteStatus, type SiteStep,
} from "../../services/sites"
import { listEmployees, employeeName, type Employee } from "../../services/employees"
import { listAttendance, type Attendance } from "../../services/attendance"
import { listChecks, PRESENCE_STATUS, type PresenceCheck } from "../../services/presence"
import { listLeaves, LEAVE_TYPES, LEAVE_STATUS, durationLabel, type LeaveRequest } from "../../services/leaves"
import { listDocuments, statusInfo, DOCUMENT_TYPE, type DocumentSummary } from "../../services/documents"
import { errorMessage } from "../../services/api"
import { addSiteAttachment, deleteSiteAttachment, listSiteAttachments, openSiteAttachment, type SiteAttachment } from "../../services/siteAttachments"
import { useConfirm } from "../../contexts/ConfirmContext"
import { fmtDay, fmtDateTime, fmtTime } from "../../utils/format"
import { formatAriary, minutesToHoursLabel } from "../../utils/salaryCalculator"
import { dateKey, todayKey } from "../../utils/date"
import Card from "../../components/Card"
import Badge from "../../components/Badge"
import EmptyState from "../../components/EmptyState"
import Dropdown from "../../components/Dropdown"
import Toast from "../../components/Toast"
import { SiteFormModal, ProgressBar, sitePeriod } from "./Sites"
import {
  ArrowLeft, HardHat, Pencil, Trash2, Users, ListChecks, Clock, Radar, CalendarOff, FileText, NotebookPen,
  UserCheck, Wallet, FileSignature, Receipt, Building2, MapPin, CalendarDays, Plus, ChevronUp, ChevronDown, X, Search, Send,
} from "lucide-react"

type Tab = "equipe" | "etapes" | "pointages" | "presence" | "permissions" | "documents" | "journal"
type Notify = (msg: string, tone?: "success" | "error") => void

const inputCls = "w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none transition"

export default function AdminSiteDetail() {
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [site, setSite] = useState<SiteDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>("equipe")
  const [editOpen, setEditOpen] = useState(false)
  const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null)

  const notify: Notify = (msg, tone = "success") => setToast({ msg, tone })

  async function refresh() {
    try {
      setSite(await getSite(id))
      setLoadError(null)
    } catch (e) {
      setLoadError(errorMessage(e, "Impossible de charger le chantier."))
    }
  }
  useEffect(() => { setSite(null); refresh() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Exécute une action puis recharge la fiche. */
  async function run(fn: () => Promise<unknown>, okMsg?: string) {
    try {
      await fn()
      if (okMsg) notify(okMsg)
    } catch (e) {
      notify(errorMessage(e, "Action impossible."), "error")
    } finally {
      await refresh()
    }
  }

  async function handleDelete() {
    if (!site) return
    const ok = await confirm({
      title: `Supprimer le chantier « ${site.name} » ?`,
      message: "Les pointages, permissions, devis et factures liés sont conservés mais ne seront plus rattachés à ce chantier.",
      confirmLabel: "Supprimer", tone: "danger",
    })
    if (!ok) return
    try {
      await deleteSite(site.id)
      navigate("/admin/chantiers", { replace: true })
    } catch (e) {
      notify(errorMessage(e, "Suppression impossible."), "error")
    }
  }

  if (loadError && !site) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card><EmptyState message={loadError} /></Card>
      </div>
    )
  }

  if (!site) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  const s = site.stats
  const tabs: { key: Tab; label: string; icon: ReactNode; count?: number }[] = [
    { key: "equipe", label: "Équipe", icon: <Users className="w-4 h-4" />, count: site.members.length },
    { key: "etapes", label: "Étapes", icon: <ListChecks className="w-4 h-4" />, count: site.steps.length },
    { key: "pointages", label: "Pointages", icon: <Clock className="w-4 h-4" /> },
    { key: "presence", label: "Présence", icon: <Radar className="w-4 h-4" /> },
    { key: "permissions", label: "Permissions", icon: <CalendarOff className="w-4 h-4" />, count: s.pendingLeaves },
    { key: "documents", label: "Devis & factures", icon: <FileText className="w-4 h-4" /> },
    { key: "journal", label: "Journal", icon: <NotebookPen className="w-4 h-4" />, count: site.notes.length },
  ]

  return (
    <div className="space-y-6">
      <BackLink />

      {/* En-tête */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
              <HardHat className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 break-words">{site.name}</h1>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-sm text-slate-500">
                <span className="flex items-center gap-1.5"><Building2 className="w-4 h-4 text-slate-400" />{site.clientName ?? "Sans client"}</span>
                <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-slate-400" />{site.workplaceName ?? "Aucun lieu de pointage"}</span>
                <span className="flex items-center gap-1.5"><CalendarDays className="w-4 h-4 text-slate-400" />{sitePeriod(site)}</span>
              </div>
              {site.address && <p className="text-xs text-slate-400 mt-1">{site.address}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="w-48">
              <Dropdown value={site.status}
                onChange={(v) => { if (v !== site.status) run(() => updateSite(site.id, { status: v as SiteStatus }), `Statut : ${SITE_STATUS[v as SiteStatus].label}.`) }}
                options={(Object.keys(SITE_STATUS) as SiteStatus[]).map((st) => ({ value: st, label: SITE_STATUS[st].label }))} />
            </div>
            <button onClick={() => setEditOpen(true)} className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold flex items-center gap-1.5">
              <Pencil className="w-4 h-4" />Modifier
            </button>
            <button onClick={handleDelete} className="p-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Supprimer le chantier">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span className="font-semibold uppercase tracking-wider">Avancement</span>
            <span>{site.stepsTotal > 0 ? `${site.stepsDone}/${site.stepsTotal} étapes terminées` : "Saisi manuellement"}</span>
          </div>
          <ProgressBar value={site.progress} />
        </div>
        {site.description && <p className="text-sm text-slate-600 whitespace-pre-line border-t border-slate-100 pt-3">{site.description}</p>}
      </div>

      {/* Chiffres clés */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat icon={<UserCheck className="w-5 h-5" />} tone="emerald" label="En poste maintenant" value={String(s.presentNow)} />
        <Stat icon={<Clock className="w-5 h-5" />} tone="indigo" label="Heures cumulées" value={minutesToHoursLabel(s.totalMinutes)} hint={`${s.attendanceCount} pointage${s.attendanceCount > 1 ? "s" : ""}`} />
        <Stat icon={<Wallet className="w-5 h-5" />} tone="blue" label="Coût main-d'œuvre" value={formatAriary(s.totalSalary)} />
        <Stat icon={<CalendarOff className="w-5 h-5" />} tone="amber" label="Permissions en attente" value={String(s.pendingLeaves)} />
        <Stat icon={<FileSignature className="w-5 h-5" />} tone="slate" label="Devis" value={formatAriary(s.quotesTotal)} />
        <Stat icon={<Receipt className="w-5 h-5" />} tone="emerald" label="Facturé / payé" value={formatAriary(s.invoicesTotal)} hint={`Payé : ${formatAriary(s.invoicesPaid)}`} />
      </div>

      {/* Onglets */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 whitespace-nowrap transition ${
              tab === t.key ? "bg-primary-600 text-white shadow-md shadow-primary-600/20" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
            {t.icon}{t.label}
            {!!t.count && <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${
              tab === t.key ? "bg-white text-primary-700" : "bg-slate-100 text-slate-600"}`}>{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === "equipe" && <TeamTab site={site} run={run} />}
      {tab === "etapes" && <StepsTab site={site} run={run} />}
      {tab === "pointages" && <AttendanceTab siteId={site.id} notify={notify} />}
      {tab === "presence" && <PresenceTab siteId={site.id} notify={notify} />}
      {tab === "permissions" && <LeavesTab siteId={site.id} notify={notify} />}
      {tab === "documents" && <DocumentsTab site={site} notify={notify} />}
      {tab === "journal" && <JournalTab site={site} run={run} />}

      {editOpen && (
        <SiteFormModal site={site} hasSteps={site.steps.length > 0} onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); notify("Chantier mis à jour."); refresh() }} />
      )}

      {toast && <Toast message={toast.msg} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  )
}

function BackLink() {
  const navigate = useNavigate()
  return (
    <button onClick={() => navigate("/admin/chantiers")} className="text-sm text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1.5">
      <ArrowLeft className="w-4 h-4" />Tous les chantiers
    </button>
  )
}

const STAT_TONES: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
  blue: "bg-blue-50 text-blue-600 border-blue-100",
  amber: "bg-amber-50 text-amber-600 border-amber-100",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
}

function Stat({ icon, label, value, hint, tone }: { icon: ReactNode; label: string; value: string; hint?: string; tone: string }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${STAT_TONES[tone]}`}>{icon}</div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 leading-tight">{label}</p>
        <p className="text-lg font-bold text-slate-900 mt-0.5 break-words">{value}</p>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  )
}

type Run = (fn: () => Promise<unknown>, okMsg?: string) => Promise<void>

// ---------- Équipe ----------

function TeamTab({ site, run }: { site: SiteDetail; run: Run }) {
  const [open, setOpen] = useState(false)
  return (
    <Card className="rounded-2xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h2 className="font-bold text-slate-900">Équipe affectée</h2><p className="text-xs text-slate-500">Salariés qui travaillent sur ce chantier.</p></div>
        <button onClick={() => setOpen(true)} className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-2 self-start"><Users className="w-4 h-4" />Gérer l'équipe</button>
      </div>
      {site.members.length === 0 ? <EmptyState message="Aucun salarié affecté à ce chantier." /> : <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{site.members.map((m) => <div key={m.employeeCode} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100"><div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 font-bold text-sm flex items-center justify-center shrink-0">{m.name.trim().charAt(0).toUpperCase() || "?"}</div><div className="min-w-0 flex-1"><div className="font-semibold text-sm text-slate-800 truncate">{m.name}</div><div className="text-xs text-slate-500 truncate">{m.employeeCode}{m.position ? ` · ${m.position}` : ""}</div></div>{!m.active && <Badge tone="gray">Inactif</Badge>}</div>)}</div>}
      {open && <TeamModal site={site} onClose={() => setOpen(false)} onSave={(codes) => run(() => setSiteMembers(site.id, codes), "Équipe mise à jour.").then(() => setOpen(false))} />}
    </Card>
  )
}

function TeamModal({ site, onClose, onSave }: { site: SiteDetail; onClose: () => void; onSave: (codes: string[]) => Promise<void> }) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selected, setSelected] = useState<string[]>(() => site.members.map((m) => m.employeeCode))
  const [search, setSearch] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => { listEmployees().then(setEmployees).catch(() => {}) }, [])

  // Salariés actifs + membres actuels (même désactivés, pour pouvoir les retirer).
  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase()
    return employees
      .filter((e) => e.active || selected.includes(e.employeeCode))
      .filter((e) => !q || `${employeeName(e)} ${e.employeeCode} ${e.position}`.toLowerCase().includes(q))
  }, [employees, search, selected])

  const toggle = (code: string) => setSelected((prev) => prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code])

  async function save() {
    setSaving(true)
    try { await onSave(selected) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl max-h-[90dvh] flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-lg text-slate-900">Équipe du chantier</h2>
            <p className="text-sm text-slate-500 mt-1">
              {site.workplaceName
                ? <>Les membres seront autorisés à pointer sur « {site.workplaceName} », le lieu de pointage du chantier.</>
                : "Ce chantier n'a pas de lieu de pointage : associez-en un pour que l'équipe puisse y pointer."}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center shrink-0"><X className="w-4 h-4" /></button>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un salarié…" className={`${inputCls} pl-10`} />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 -mx-1 px-1">
          {candidates.length === 0 && <EmptyState message="Aucun salarié." />}
          {candidates.map((e) => {
            const on = selected.includes(e.employeeCode)
            return (
              <label key={e.employeeCode}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border cursor-pointer transition ${
                  on ? "bg-primary-50 border-primary-500" : "border-slate-200 hover:bg-slate-50"}`}>
                <input type="checkbox" checked={on} onChange={() => toggle(e.employeeCode)} className="accent-primary-600 w-4 h-4" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-slate-800 truncate">{employeeName(e)}</span>
                  <span className="block text-xs text-slate-500 truncate">{e.employeeCode}{e.position ? ` · ${e.position}` : ""}{!e.active ? " · inactif" : ""}</span>
                </span>
              </label>
            )
          })}
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{selected.length} salarié{selected.length > 1 ? "s" : ""} sélectionné{selected.length > 1 ? "s" : ""}</span>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-slate-200 text-slate-700 font-medium py-3 rounded-xl hover:bg-slate-50">Annuler</button>
          <button onClick={save} disabled={saving} className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl disabled:opacity-60">
            {saving ? "..." : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- Étapes ----------

function StepsTab({ site, run }: { site: SiteDetail; run: Run }) {
  const confirm = useConfirm()
  const [title, setTitle] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [adding, setAdding] = useState(false)

  // Ordre d'affichage : position, puis ordre renvoyé par le serveur.
  const steps = useMemo(
    () => site.steps.map((st, i) => ({ st, i })).sort((a, b) => a.st.position - b.st.position || a.i - b.i).map((x) => x.st),
    [site.steps]
  )

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setAdding(true)
    await run(() => addSiteStep(site.id, { title: title.trim(), dueDate: dueDate || null }), "Étape ajoutée.")
    setTitle(""); setDueDate("")
    setAdding(false)
  }

  /** Déplace une étape d'un cran ; renumérote les positions pour qu'elles soient distinctes. */
  function move(index: number, delta: -1 | 1) {
    const target = index + delta
    if (target < 0 || target >= steps.length) return
    const order = [...steps]
    ;[order[index], order[target]] = [order[target], order[index]]
    const changes = order.map((st, pos) => ({ st, pos })).filter(({ st, pos }) => st.position !== pos)
    run(() => Promise.all(changes.map(({ st, pos }) => updateSiteStep(site.id, st.id, { position: pos }))))
  }

  async function remove(st: SiteStep) {
    const ok = await confirm({ title: `Supprimer l'étape « ${st.title} » ?`, confirmLabel: "Supprimer", tone: "danger" })
    if (ok) run(() => deleteSiteStep(site.id, st.id), "Étape supprimée.")
  }

  const today = todayKey()

  return (
    <Card className="rounded-2xl space-y-4">
      <div>
        <h2 className="font-bold text-slate-900">Étapes du chantier</h2>
        <p className="text-xs text-slate-500">Cochez les étapes réalisées : l'avancement du chantier est calculé automatiquement.</p>
      </div>

      <form onSubmit={add} className="flex flex-col sm:flex-row gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nouvelle étape (ex : Fondations, Gros œuvre…)" className={`${inputCls} flex-1`} />
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} title="Échéance (facultative)" className={`${inputCls} sm:w-44`} />
        <button type="submit" disabled={adding || !title.trim()} className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-60">
          <Plus className="w-4 h-4" />Ajouter
        </button>
      </form>

      {steps.length === 0 ? <EmptyState message="Aucune étape définie pour ce chantier." /> : (
        <ol className="space-y-2">
          {steps.map((st, i) => {
            const late = !st.done && !!st.dueDate && st.dueDate < today
            return (
              <li key={st.id} className={`flex items-start gap-3 p-3 rounded-xl border ${st.done ? "bg-emerald-50/60 border-emerald-100" : "bg-white border-slate-200"}`}>
                <input type="checkbox" checked={st.done} title={st.done ? "Marquer comme non terminée" : "Marquer comme terminée"}
                  onChange={() => run(() => updateSiteStep(site.id, st.id, { done: !st.done }), st.done ? "Étape rouverte." : "Étape terminée.")}
                  className="mt-0.5 w-5 h-5 accent-emerald-600 shrink-0 cursor-pointer" />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold ${st.done ? "text-slate-500 line-through" : "text-slate-800"}`}>
                    <span className="text-slate-400 font-normal mr-1.5">{i + 1}.</span>{st.title}
                  </div>
                  {st.description && <p className="text-xs text-slate-500 mt-0.5 whitespace-pre-line">{st.description}</p>}
                  <div className="flex flex-wrap gap-x-3 text-xs mt-1">
                    {st.dueDate && <span className={late ? "text-rose-600 font-semibold" : "text-slate-500"}>Échéance : {fmtDay(st.dueDate)}{late ? " (dépassée)" : ""}</span>}
                    {st.done && st.doneAt && <span className="text-emerald-700">Terminée le {fmtDateTime(st.doneAt)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Monter"><ChevronUp className="w-4 h-4" /></button>
                  <button onClick={() => move(i, 1)} disabled={i === steps.length - 1} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Descendre"><ChevronDown className="w-4 h-4" /></button>
                  <button onClick={() => remove(st)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}

// ---------- Pointages ----------

function AttendanceTab({ siteId, notify }: { siteId: string; notify: Notify }) {
  const [from, setFrom] = useState(() => dateKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))
  const [to, setTo] = useState(todayKey())
  const [rows, setRows] = useState<Attendance[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setRows(null)
    listAttendance({ siteId, from, to })
      .then((r) => { if (!cancelled) setRows(r) })
      .catch((e) => { if (!cancelled) { setRows([]); notify(errorMessage(e, "Impossible de charger les pointages."), "error") } })
    return () => { cancelled = true }
  }, [siteId, from, to]) // eslint-disable-line react-hooks/exhaustive-deps

  const list = rows ?? []
  const totalMinutes = list.reduce((s, r) => s + r.workedMinutes, 0)
  const totalSalary = list.reduce((s, r) => s + r.dailySalary, 0)
  const people = new Set(list.map((r) => r.employeeCode)).size

  return (
    <Card className="rounded-2xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900">Pointages sur le chantier</h2>
          <p className="text-xs text-slate-500">Entrées et sorties effectuées sur le lieu de pointage du chantier.</p>
        </div>
        <div className="flex gap-2">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Du</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Au</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
          </div>
        </div>
      </div>

      {rows === null ? <p className="text-sm text-slate-400 py-6 text-center">Chargement...</p> : list.length === 0 ? (
        <EmptyState message="Aucun pointage sur cette période." />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100"><div className="text-[11px] uppercase font-semibold text-slate-400">Salariés</div><div className="font-bold text-slate-900">{people}</div></div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100"><div className="text-[11px] uppercase font-semibold text-slate-400">Heures</div><div className="font-bold text-slate-900">{minutesToHoursLabel(totalMinutes)}</div></div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100"><div className="text-[11px] uppercase font-semibold text-slate-400">Salaires</div><div className="font-bold text-slate-900">{formatAriary(totalSalary)}</div></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3">Salarié</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Entrée</th>
                  <th className="py-2 pr-3">Sortie</th><th className="py-2 pr-3">Durée</th><th className="py-2 pr-3 text-right">Salaire</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-3 font-medium">{r.employeeName ?? r.employeeCode}<div className="text-xs text-gray-400 font-normal">{r.employeeCode}</div></td>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDay(r.workDate)}</td>
                    <td className="py-2 pr-3">{fmtTime(r.entryTime)}{r.entrySource === "ADMIN" && <span className="ml-1 text-xs text-amber-600">(admin)</span>}</td>
                    <td className="py-2 pr-3">{r.status === "EN_COURS" ? <Badge tone="yellow">En cours</Badge> : fmtTime(r.exitTime)}</td>
                    <td className="py-2 pr-3">{minutesToHoursLabel(r.workedMinutes)}</td>
                    <td className="py-2 pr-3 text-right font-semibold">{formatAriary(r.dailySalary)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-bold">
                  <td className="py-2 pr-3" colSpan={4}>Total</td>
                  <td className="py-2 pr-3">{minutesToHoursLabel(totalMinutes)}</td>
                  <td className="py-2 pr-3 text-right">{formatAriary(totalSalary)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </Card>
  )
}

// ---------- Contrôles de présence ----------

function PresenceTab({ siteId, notify }: { siteId: string; notify: Notify }) {
  const [checks, setChecks] = useState<PresenceCheck[] | null>(null)

  useEffect(() => {
    let cancelled = false
    listChecks({ siteId })
      .then((c) => { if (!cancelled) setChecks(c) })
      .catch((e) => { if (!cancelled) { setChecks([]); notify(errorMessage(e, "Impossible de charger les contrôles de présence."), "error") } })
    return () => { cancelled = true }
  }, [siteId]) // eslint-disable-line react-hooks/exhaustive-deps

  const list = checks ?? []
  const anomalies = list.filter((c) => c.status === "HORS_ZONE" || c.status === "SANS_REPONSE").length

  return (
    <Card className="rounded-2xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="font-bold text-slate-900">Contrôles de présence</h2>
          <p className="text-xs text-slate-500">Vérifications régulières de la position des salariés en poste sur le chantier.</p>
        </div>
        {list.length > 0 && (
          <Badge tone={anomalies > 0 ? "red" : "green"}>{anomalies > 0 ? `${anomalies} anomalie${anomalies > 1 ? "s" : ""}` : "Aucune anomalie"}</Badge>
        )}
      </div>
      {checks === null ? <p className="text-sm text-slate-400 py-6 text-center">Chargement...</p> : list.length === 0 ? (
        <EmptyState message="Aucun contrôle de présence enregistré pour ce chantier." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-3">Contrôle</th><th className="py-2 pr-3">Salarié</th><th className="py-2 pr-3">Résultat</th>
                <th className="py-2 pr-3">Distance</th><th className="py-2 pr-3">Position reçue</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((c) => (
                <tr key={c.id}>
                  <td className="py-2 pr-3 whitespace-nowrap">{fmtDateTime(c.checkedAt)}</td>
                  <td className="py-2 pr-3 font-medium">{c.employeeName}<div className="text-xs text-gray-400 font-normal">{c.employeeCode}</div></td>
                  <td className="py-2 pr-3"><Badge tone={PRESENCE_STATUS[c.status].tone}>{PRESENCE_STATUS[c.status].label}</Badge></td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {c.distance != null ? `${c.distance} m` : "—"}
                    {c.radiusMeters != null && <span className="text-xs text-slate-400"> / {c.radiusMeters} m</span>}
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap text-xs text-slate-500">{c.locationAt ? fmtTime(c.locationAt) : "Aucune"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ---------- Permissions ----------

function LeavesTab({ siteId, notify }: { siteId: string; notify: Notify }) {
  const [leaves, setLeaves] = useState<LeaveRequest[] | null>(null)

  useEffect(() => {
    let cancelled = false
    listLeaves({ siteId })
      .then((l) => { if (!cancelled) setLeaves(l) })
      .catch((e) => { if (!cancelled) { setLeaves([]); notify(errorMessage(e, "Impossible de charger les permissions."), "error") } })
    return () => { cancelled = true }
  }, [siteId]) // eslint-disable-line react-hooks/exhaustive-deps

  const list = leaves ?? []

  return (
    <Card className="rounded-2xl space-y-4">
      <div>
        <h2 className="font-bold text-slate-900">Demandes de permission</h2>
        <p className="text-xs text-slate-500">Permissions demandées par l'équipe pour ce chantier. Les décisions se prennent dans « Permissions ».</p>
      </div>
      {leaves === null ? <p className="text-sm text-slate-400 py-6 text-center">Chargement...</p> : list.length === 0 ? (
        <EmptyState message="Aucune demande de permission liée à ce chantier." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((l) => (
            <div key={l.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 truncate">{l.employeeName}</div>
                  <div className="text-xs text-slate-500">{LEAVE_TYPES[l.type]} · {durationLabel(l)}</div>
                </div>
                <Badge tone={LEAVE_STATUS[l.status].tone}>{LEAVE_STATUS[l.status].label}</Badge>
              </div>
              <div className="text-xs text-slate-600">
                {l.startDate === l.endDate ? `Le ${fmtDay(l.startDate)}` : `Du ${fmtDay(l.startDate)} au ${fmtDay(l.endDate)}`}
              </div>
              <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-2.5 whitespace-pre-line">« {l.reason} »</p>
              {l.decisionNote && <p className="text-xs text-slate-500">Réponse : {l.decisionNote}</p>}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ---------- Devis & factures ----------

function DocumentsTab({ site, notify }: { site: SiteDetail; notify: Notify }) {
  const navigate = useNavigate()
  const [docs, setDocs] = useState<DocumentSummary[] | null>(null)
  const [attachments, setAttachments] = useState<SiteAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [attachmentType, setAttachmentType] = useState("Autre")

  useEffect(() => {
    listSiteAttachments(site.id).then(setAttachments).catch(e => notify(errorMessage(e, "Impossible de charger les pièces jointes."), "error"))
  }, [site.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function uploadFile(file?: File) {
    if (!file) return
    const allowed = ["application/pdf", "image/jpeg", "image/png", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/msword", "application/vnd.ms-excel"]
    if (!allowed.includes(file.type) && !/\.(pdf|jpe?g|png|docx?|xlsx?)$/i.test(file.name)) { notify("Format non pris en charge. Choisissez PDF, image, Excel ou Word.", "error"); return }
    setUploading(true); setUploadProgress(0)
    try { await addSiteAttachment(site.id, file, attachmentType, setUploadProgress); setAttachments(await listSiteAttachments(site.id)); notify("Pièce jointe ajoutée.") }
    catch(e) { notify(errorMessage(e, "Échec de l’envoi. Vérifiez le type et la taille autorisés par le serveur."), "error") }
    finally { setUploading(false); setUploadProgress(0) }
  }

  useEffect(() => {
    let cancelled = false
    listDocuments({ siteId: site.id })
      .then((d) => { if (!cancelled) setDocs(d) })
      .catch((e) => { if (!cancelled) { setDocs([]); notify(errorMessage(e, "Impossible de charger les documents."), "error") } })
    return () => { cancelled = true }
  }, [site.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function create(type: "DEVIS" | "FACTURE") {
    const qs = new URLSearchParams({ type, siteId: site.id })
    if (site.clientId) qs.set("clientId", site.clientId)
    navigate(`/admin/documents/nouveau?${qs.toString()}`)
  }

  const list = docs ?? []

  return (
    <div className="space-y-4">
    <Card className="rounded-2xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0"><h2 className="font-bold text-slate-900">Pièces jointes du chantier</h2><p className="text-xs text-slate-500">PDF, images, Excel ou Word; taille contrôlée par le serveur.</p></div>
        <div className="flex flex-wrap gap-2"><select value={attachmentType} onChange={e=>setAttachmentType(e.target.value)} className="rounded-lg border px-2 py-2 text-sm"><option>Autre</option><option>Devis</option><option>Facture</option><option>Justificatif</option><option>Document technique</option></select><label className={`cursor-pointer rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white ${uploading?"opacity-50":""}`}>{uploading?`Envoi ${uploadProgress}%`:"Ajouter un fichier"}<input type="file" className="hidden" disabled={uploading} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" onChange={e=>{void uploadFile(e.target.files?.[0]);e.currentTarget.value=""}} /></label></div>
      </div>
      {attachments.length===0?<p className="text-sm text-slate-500">Aucune pièce jointe.</p>:<ul className="divide-y">{attachments.map(a=><li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm"><div className="min-w-0"><div className="font-medium truncate">{a.name}</div><div className="text-xs text-slate-500">{a.type||"Autre"} · {a.mimeType||"type inconnu"} · {Math.ceil(a.size/1024)} Ko · {fmtDateTime(a.createdAt)}{a.uploadedBy?` · ${a.uploadedBy}`:""}</div></div><div className="flex gap-2"><button onClick={()=>void openSiteAttachment(site.id,a.id,a.name).catch(e=>notify(errorMessage(e,"Téléchargement impossible."),"error"))} className="rounded border px-2 py-1 text-xs">Télécharger</button><button onClick={async()=>{if(await (window.confirm(`Archiver la pièce jointe « ${a.name} » ?`))){try{await deleteSiteAttachment(site.id,a.id);setAttachments(x=>x.filter(v=>v.id!==a.id));notify("Pièce jointe supprimée.")}catch(e){notify(errorMessage(e,"Suppression impossible."),"error")}}}} className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700">Supprimer</button></div></li>)}</ul>}
    </Card>
    <Card className="rounded-2xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900">Devis & factures du chantier</h2>
          <p className="text-xs text-slate-500">Documents rattachés à ce chantier.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => create("DEVIS")} className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold flex items-center gap-1.5">
            <FileSignature className="w-4 h-4" />Nouveau devis
          </button>
          <button onClick={() => create("FACTURE")} className="px-3.5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold flex items-center gap-1.5">
            <Receipt className="w-4 h-4" />Nouvelle facture
          </button>
        </div>
      </div>
      {docs === null ? <p className="text-sm text-slate-400 py-6 text-center">Chargement...</p> : list.length === 0 ? (
        <EmptyState message="Aucun devis ni facture pour ce chantier." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-3">Numéro</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Objet</th><th className="py-2 pr-3">Statut</th><th className="py-2 pr-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((d) => {
                const st = statusInfo(d.type, d.status)
                return (
                  <tr key={d.id} onClick={() => navigate(`/admin/documents/${d.id}`)} className="cursor-pointer hover:bg-slate-50">
                    <td className="py-2 pr-3 font-mono font-semibold text-primary-700">{d.number}</td>
                    <td className="py-2 pr-3">{DOCUMENT_TYPE[d.type].label}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDay(d.issueDate)}</td>
                    <td className="py-2 pr-3 max-w-[240px] truncate">{d.subject || d.clientName}</td>
                    <td className="py-2 pr-3"><Badge tone={st.tone}>{st.label}</Badge></td>
                    <td className="py-2 pr-3 text-right font-semibold whitespace-nowrap">{formatAriary(d.total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
    </div>
  )
}

// ---------- Journal de chantier ----------

function JournalTab({ site, run }: { site: SiteDetail; run: Run }) {
  const confirm = useConfirm()
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setSending(true)
    await run(() => addSiteNote(site.id, text), "Note ajoutée au journal.")
    setText("")
    setSending(false)
  }

  async function remove(noteId: string) {
    const ok = await confirm({ title: "Supprimer cette note ?", confirmLabel: "Supprimer", tone: "danger" })
    if (ok) run(() => deleteSiteNote(site.id, noteId), "Note supprimée.")
  }

  return (
    <Card className="rounded-2xl space-y-4">
      <div>
        <h2 className="font-bold text-slate-900">Journal de chantier</h2>
        <p className="text-xs text-slate-500">Observations, incidents, décisions, livraisons…</p>
      </div>
      <form onSubmit={add} className="flex flex-col sm:flex-row gap-2">
        <textarea rows={2} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ajouter une note au journal…" className={`${inputCls} flex-1`} />
        <button type="submit" disabled={sending || !text.trim()} className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-60 sm:self-end">
          <Send className="w-4 h-4" />Publier
        </button>
      </form>
      {site.notes.length === 0 ? <EmptyState message="Le journal est vide." /> : (
        <ul className="space-y-2.5">
          {site.notes.map((n) => (
            <li key={n.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-700">{n.authorName}<span className="font-normal text-slate-400"> · {fmtDateTime(n.createdAt)}</span></span>
                <button onClick={() => remove(n.id)} className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-line break-words">{n.text}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// // src/pages/admin/SiteDetail.tsx
// // Espace de suivi centralisé d'un chantier : équipe, étapes, pointages, contrôles de présence,
// // permissions, devis & factures et journal de chantier.
// import { useEffect, useMemo, useState, type ReactNode } from "react"
// import { useNavigate, useParams } from "react-router-dom"
// import {
//   getSite, updateSite, deleteSite, setSiteMembers, addSiteStep, updateSiteStep, deleteSiteStep, addSiteNote, deleteSiteNote,
//   SITE_STATUS, type SiteDetail, type SiteStatus, type SiteStep,
// } from "../../services/sites"
// import { listEmployees, employeeName, type Employee } from "../../services/employees"
// import { listAttendance, type Attendance } from "../../services/attendance"
// import { listChecks, PRESENCE_STATUS, type PresenceCheck } from "../../services/presence"
// import { listLeaves, LEAVE_TYPES, LEAVE_STATUS, durationLabel, type LeaveRequest } from "../../services/leaves"
// import { listDocuments, statusInfo, DOCUMENT_TYPE, type DocumentSummary } from "../../services/documents"
// import { errorMessage } from "../../services/api"
// import { useConfirm } from "../../contexts/ConfirmContext"
// import { fmtDay, fmtDateTime, fmtTime } from "../../utils/format"
// import { formatAriary, minutesToHoursLabel } from "../../utils/salaryCalculator"
// import { dateKey, todayKey } from "../../utils/date"
// import Card from "../../components/Card"
// import Badge from "../../components/Badge"
// import EmptyState from "../../components/EmptyState"
// import Dropdown from "../../components/Dropdown"
// import Toast from "../../components/Toast"
// import { SiteFormModal, ProgressBar, sitePeriod } from "./Sites"
// import {
//   ArrowLeft, HardHat, Pencil, Trash2, Users, ListChecks, Clock, Radar, CalendarOff, FileText, NotebookPen,
//   UserCheck, Wallet, FileSignature, Receipt, Building2, MapPin, CalendarDays, Plus, ChevronUp, ChevronDown, X, Search, Send,
// } from "lucide-react"

// type Tab = "equipe" | "etapes" | "pointages" | "presence" | "permissions" | "documents" | "journal"
// type Notify = (msg: string, tone?: "success" | "error") => void

// const inputCls = "w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none transition"

// export default function AdminSiteDetail() {
//   const { id = "" } = useParams()
//   const navigate = useNavigate()
//   const confirm = useConfirm()
//   const [site, setSite] = useState<SiteDetail | null>(null)
//   const [loadError, setLoadError] = useState<string | null>(null)
//   const [tab, setTab] = useState<Tab>("equipe")
//   const [editOpen, setEditOpen] = useState(false)
//   const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null)

//   const notify: Notify = (msg, tone = "success") => setToast({ msg, tone })

//   async function refresh() {
//     try {
//       setSite(await getSite(id))
//       setLoadError(null)
//     } catch (e) {
//       setLoadError(errorMessage(e, "Impossible de charger le chantier."))
//     }
//   }
//   useEffect(() => { setSite(null); refresh() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

//   /** Exécute une action puis recharge la fiche. */
//   async function run(fn: () => Promise<unknown>, okMsg?: string) {
//     try {
//       await fn()
//       if (okMsg) notify(okMsg)
//     } catch (e) {
//       notify(errorMessage(e, "Action impossible."), "error")
//     } finally {
//       await refresh()
//     }
//   }

//   async function handleDelete() {
//     if (!site) return
//     const ok = await confirm({
//       title: `Supprimer le chantier « ${site.name} » ?`,
//       message: "Les pointages, permissions, devis et factures liés sont conservés mais ne seront plus rattachés à ce chantier.",
//       confirmLabel: "Supprimer", tone: "danger",
//     })
//     if (!ok) return
//     try {
//       await deleteSite(site.id)
//       navigate("/admin/chantiers", { replace: true })
//     } catch (e) {
//       notify(errorMessage(e, "Suppression impossible."), "error")
//     }
//   }

//   if (loadError && !site) {
//     return (
//       <div className="space-y-4">
//         <BackLink />
//         <Card><EmptyState message={loadError} /></Card>
//       </div>
//     )
//   }

//   if (!site) {
//     return (
//       <div className="flex justify-center items-center py-20">
//         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
//       </div>
//     )
//   }

//   const s = site.stats
//   const tabs: { key: Tab; label: string; icon: ReactNode; count?: number }[] = [
//     { key: "equipe", label: "Équipe", icon: <Users className="w-4 h-4" />, count: site.members.length },
//     { key: "etapes", label: "Étapes", icon: <ListChecks className="w-4 h-4" />, count: site.steps.length },
//     { key: "pointages", label: "Pointages", icon: <Clock className="w-4 h-4" /> },
//     { key: "presence", label: "Présence", icon: <Radar className="w-4 h-4" /> },
//     { key: "permissions", label: "Permissions", icon: <CalendarOff className="w-4 h-4" />, count: s.pendingLeaves },
//     { key: "documents", label: "Devis & factures", icon: <FileText className="w-4 h-4" /> },
//     { key: "journal", label: "Journal", icon: <NotebookPen className="w-4 h-4" />, count: site.notes.length },
//   ]

//   return (
//     <div className="space-y-6">
//       <BackLink />

//       {/* En-tête */}
//       <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
//         <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
//           <div className="flex items-start gap-3.5 min-w-0">
//             <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
//               <HardHat className="w-6 h-6" />
//             </div>
//             <div className="min-w-0">
//               <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 break-words">{site.name}</h1>
//               <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-sm text-slate-500">
//                 <span className="flex items-center gap-1.5"><Building2 className="w-4 h-4 text-slate-400" />{site.clientName ?? "Sans client"}</span>
//                 <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-slate-400" />{site.workplaceName ?? "Aucun lieu de pointage"}</span>
//                 <span className="flex items-center gap-1.5"><CalendarDays className="w-4 h-4 text-slate-400" />{sitePeriod(site)}</span>
//               </div>
//               {site.address && <p className="text-xs text-slate-400 mt-1">{site.address}</p>}
//             </div>
//           </div>
//           <div className="flex flex-wrap items-center gap-2 shrink-0">
//             <div className="w-48">
//               <Dropdown value={site.status}
//                 onChange={(v) => { if (v !== site.status) run(() => updateSite(site.id, { status: v as SiteStatus }), `Statut : ${SITE_STATUS[v as SiteStatus].label}.`) }}
//                 options={(Object.keys(SITE_STATUS) as SiteStatus[]).map((st) => ({ value: st, label: SITE_STATUS[st].label }))} />
//             </div>
//             <button onClick={() => setEditOpen(true)} className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold flex items-center gap-1.5">
//               <Pencil className="w-4 h-4" />Modifier
//             </button>
//             <button onClick={handleDelete} className="p-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Supprimer le chantier">
//               <Trash2 className="w-4 h-4" />
//             </button>
//           </div>
//         </div>
//         <div>
//           <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
//             <span className="font-semibold uppercase tracking-wider">Avancement</span>
//             <span>{site.stepsTotal > 0 ? `${site.stepsDone}/${site.stepsTotal} étapes terminées` : "Saisi manuellement"}</span>
//           </div>
//           <ProgressBar value={site.progress} />
//         </div>
//         {site.description && <p className="text-sm text-slate-600 whitespace-pre-line border-t border-slate-100 pt-3">{site.description}</p>}
//       </div>

//       {/* Chiffres clés */}
//       <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
//         <Stat icon={<UserCheck className="w-5 h-5" />} tone="emerald" label="En poste maintenant" value={String(s.presentNow)} />
//         <Stat icon={<Clock className="w-5 h-5" />} tone="indigo" label="Heures cumulées" value={minutesToHoursLabel(s.totalMinutes)} hint={`${s.attendanceCount} pointage${s.attendanceCount > 1 ? "s" : ""}`} />
//         <Stat icon={<Wallet className="w-5 h-5" />} tone="blue" label="Coût main-d'œuvre" value={formatAriary(s.totalSalary)} />
//         <Stat icon={<CalendarOff className="w-5 h-5" />} tone="amber" label="Permissions en attente" value={String(s.pendingLeaves)} />
//         <Stat icon={<FileSignature className="w-5 h-5" />} tone="slate" label="Devis" value={formatAriary(s.quotesTotal)} />
//         <Stat icon={<Receipt className="w-5 h-5" />} tone="emerald" label="Facturé / payé" value={formatAriary(s.invoicesTotal)} hint={`Payé : ${formatAriary(s.invoicesPaid)}`} />
//       </div>

//       {/* Onglets */}
//       <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
//         {tabs.map((t) => (
//           <button key={t.key} onClick={() => setTab(t.key)}
//             className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 whitespace-nowrap transition ${
//               tab === t.key ? "bg-primary-600 text-white shadow-md shadow-primary-600/20" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
//             {t.icon}{t.label}
//             {!!t.count && <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${
//               tab === t.key ? "bg-white text-primary-700" : "bg-slate-100 text-slate-600"}`}>{t.count}</span>}
//           </button>
//         ))}
//       </div>

//       {tab === "equipe" && <TeamTab site={site} run={run} />}
//       {tab === "etapes" && <StepsTab site={site} run={run} />}
//       {tab === "pointages" && <AttendanceTab siteId={site.id} notify={notify} />}
//       {tab === "presence" && <PresenceTab siteId={site.id} notify={notify} />}
//       {tab === "permissions" && <LeavesTab siteId={site.id} notify={notify} />}
//       {tab === "documents" && <DocumentsTab site={site} notify={notify} />}
//       {tab === "journal" && <JournalTab site={site} run={run} />}

//       {editOpen && (
//         <SiteFormModal site={site} hasSteps={site.steps.length > 0} onClose={() => setEditOpen(false)}
//           onSaved={() => { setEditOpen(false); notify("Chantier mis à jour."); refresh() }} />
//       )}

//       {toast && <Toast message={toast.msg} tone={toast.tone} onClose={() => setToast(null)} />}
//     </div>
//   )
// }

// function BackLink() {
//   const navigate = useNavigate()
//   return (
//     <button onClick={() => navigate("/admin/chantiers")} className="text-sm text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1.5">
//       <ArrowLeft className="w-4 h-4" />Tous les chantiers
//     </button>
//   )
// }

// const STAT_TONES: Record<string, string> = {
//   emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
//   indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
//   blue: "bg-blue-50 text-blue-600 border-blue-100",
//   amber: "bg-amber-50 text-amber-600 border-amber-100",
//   slate: "bg-slate-100 text-slate-600 border-slate-200",
// }

// function Stat({ icon, label, value, hint, tone }: { icon: ReactNode; label: string; value: string; hint?: string; tone: string }) {
//   return (
//     <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
//       <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${STAT_TONES[tone]}`}>{icon}</div>
//       <div>
//         <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 leading-tight">{label}</p>
//         <p className="text-lg font-bold text-slate-900 mt-0.5 break-words">{value}</p>
//         {hint && <p className="text-xs text-slate-500">{hint}</p>}
//       </div>
//     </div>
//   )
// }

// type Run = (fn: () => Promise<unknown>, okMsg?: string) => Promise<void>

// // ---------- Équipe ----------

// function TeamTab({ site, run }: { site: SiteDetail; run: Run }) {
//   const [open, setOpen] = useState(false)
//   return (
//     <Card className="rounded-2xl space-y-4">
//       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
//         <div>
//           <h2 className="font-bold text-slate-900">Équipe affectée</h2>
//           <p className="text-xs text-slate-500">Salariés qui travaillent sur ce chantier.</p>
//         </div>
//         <button onClick={() => setOpen(true)} className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-2 self-start">
//           <Users className="w-4 h-4" />Gérer l'équipe
//         </button>
//       </div>
//       {site.members.length === 0 ? <EmptyState message="Aucun salarié affecté à ce chantier." /> : (
//         <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
//           {site.members.map((m) => (
//             <div key={m.employeeCode} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
//               <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 font-bold text-sm flex items-center justify-center shrink-0">
//                 {m.name.trim().charAt(0).toUpperCase() || "?"}
//               </div>
//               <div className="min-w-0 flex-1">
//                 <div className="font-semibold text-sm text-slate-800 truncate">{m.name}</div>
//                 <div className="text-xs text-slate-500 truncate">{m.employeeCode}{m.position ? ` · ${m.position}` : ""}</div>
//               </div>
//               {!m.active && <Badge tone="gray">Inactif</Badge>}
//             </div>
//           ))}
//         </div>
//       )}
//       {open && (
//         <TeamModal site={site} onClose={() => setOpen(false)}
//           onSave={(codes) => run(() => setSiteMembers(site.id, codes), "Équipe mise à jour.").then(() => setOpen(false))} />
//       )}
//     </Card>
//   )
// }

// function TeamModal({ site, onClose, onSave }: { site: SiteDetail; onClose: () => void; onSave: (codes: string[]) => Promise<void> }) {
//   const [employees, setEmployees] = useState<Employee[]>([])
//   const [selected, setSelected] = useState<string[]>(() => site.members.map((m) => m.employeeCode))
//   const [search, setSearch] = useState("")
//   const [saving, setSaving] = useState(false)

//   useEffect(() => { listEmployees().then(setEmployees).catch(() => {}) }, [])

//   // Salariés actifs + membres actuels (même désactivés, pour pouvoir les retirer).
//   const candidates = useMemo(() => {
//     const q = search.trim().toLowerCase()
//     return employees
//       .filter((e) => e.active || selected.includes(e.employeeCode))
//       .filter((e) => !q || `${employeeName(e)} ${e.employeeCode} ${e.position}`.toLowerCase().includes(q))
//   }, [employees, search, selected])

//   const toggle = (code: string) => setSelected((prev) => prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code])

//   async function save() {
//     setSaving(true)
//     try { await onSave(selected) } finally { setSaving(false) }
//   }

//   return (
//     <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
//       <div className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl max-h-[90dvh] flex flex-col">
//         <div className="flex items-start justify-between gap-3">
//           <div>
//             <h2 className="font-bold text-lg text-slate-900">Équipe du chantier</h2>
//             <p className="text-sm text-slate-500 mt-1">
//               {site.workplaceName
//                 ? <>Les membres seront autorisés à pointer sur « {site.workplaceName} », le lieu de pointage du chantier.</>
//                 : "Ce chantier n'a pas de lieu de pointage : associez-en un pour que l'équipe puisse y pointer."}
//             </p>
//           </div>
//           <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center shrink-0"><X className="w-4 h-4" /></button>
//         </div>
//         <div className="relative">
//           <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
//           <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un salarié…" className={`${inputCls} pl-10`} />
//         </div>
//         <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 -mx-1 px-1">
//           {candidates.length === 0 && <EmptyState message="Aucun salarié." />}
//           {candidates.map((e) => {
//             const on = selected.includes(e.employeeCode)
//             return (
//               <label key={e.employeeCode}
//                 className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border cursor-pointer transition ${
//                   on ? "bg-primary-50 border-primary-500" : "border-slate-200 hover:bg-slate-50"}`}>
//                 <input type="checkbox" checked={on} onChange={() => toggle(e.employeeCode)} className="accent-primary-600 w-4 h-4" />
//                 <span className="flex-1 min-w-0">
//                   <span className="block text-sm font-semibold text-slate-800 truncate">{employeeName(e)}</span>
//                   <span className="block text-xs text-slate-500 truncate">{e.employeeCode}{e.position ? ` · ${e.position}` : ""}{!e.active ? " · inactif" : ""}</span>
//                 </span>
//               </label>
//             )
//           })}
//         </div>
//         <div className="flex items-center justify-between text-xs text-slate-500">
//           <span>{selected.length} salarié{selected.length > 1 ? "s" : ""} sélectionné{selected.length > 1 ? "s" : ""}</span>
//         </div>
//         <div className="flex gap-3">
//           <button onClick={onClose} className="flex-1 border border-slate-200 text-slate-700 font-medium py-3 rounded-xl hover:bg-slate-50">Annuler</button>
//           <button onClick={save} disabled={saving} className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl disabled:opacity-60">
//             {saving ? "..." : "Enregistrer"}
//           </button>
//         </div>
//       </div>
//     </div>
//   )
// }

// // ---------- Étapes ----------

// function StepsTab({ site, run }: { site: SiteDetail; run: Run }) {
//   const confirm = useConfirm()
//   const [title, setTitle] = useState("")
//   const [dueDate, setDueDate] = useState("")
//   const [adding, setAdding] = useState(false)

//   // Ordre d'affichage : position, puis ordre renvoyé par le serveur.
//   const steps = useMemo(
//     () => site.steps.map((st, i) => ({ st, i })).sort((a, b) => a.st.position - b.st.position || a.i - b.i).map((x) => x.st),
//     [site.steps]
//   )

//   async function add(e: React.FormEvent) {
//     e.preventDefault()
//     if (!title.trim()) return
//     setAdding(true)
//     await run(() => addSiteStep(site.id, { title: title.trim(), dueDate: dueDate || null }), "Étape ajoutée.")
//     setTitle(""); setDueDate("")
//     setAdding(false)
//   }

//   /** Déplace une étape d'un cran ; renumérote les positions pour qu'elles soient distinctes. */
//   function move(index: number, delta: -1 | 1) {
//     const target = index + delta
//     if (target < 0 || target >= steps.length) return
//     const order = [...steps]
//     ;[order[index], order[target]] = [order[target], order[index]]
//     const changes = order.map((st, pos) => ({ st, pos })).filter(({ st, pos }) => st.position !== pos)
//     run(() => Promise.all(changes.map(({ st, pos }) => updateSiteStep(site.id, st.id, { position: pos }))))
//   }

//   async function remove(st: SiteStep) {
//     const ok = await confirm({ title: `Supprimer l'étape « ${st.title} » ?`, confirmLabel: "Supprimer", tone: "danger" })
//     if (ok) run(() => deleteSiteStep(site.id, st.id), "Étape supprimée.")
//   }

//   const today = todayKey()

//   return (
//     <Card className="rounded-2xl space-y-4">
//       <div>
//         <h2 className="font-bold text-slate-900">Étapes du chantier</h2>
//         <p className="text-xs text-slate-500">Cochez les étapes réalisées : l'avancement du chantier est calculé automatiquement.</p>
//       </div>

//       <form onSubmit={add} className="flex flex-col sm:flex-row gap-2">
//         <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nouvelle étape (ex : Fondations, Gros œuvre…)" className={`${inputCls} flex-1`} />
//         <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} title="Échéance (facultative)" className={`${inputCls} sm:w-44`} />
//         <button type="submit" disabled={adding || !title.trim()} className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-60">
//           <Plus className="w-4 h-4" />Ajouter
//         </button>
//       </form>

//       {steps.length === 0 ? <EmptyState message="Aucune étape définie pour ce chantier." /> : (
//         <ol className="space-y-2">
//           {steps.map((st, i) => {
//             const late = !st.done && !!st.dueDate && st.dueDate < today
//             return (
//               <li key={st.id} className={`flex items-start gap-3 p-3 rounded-xl border ${st.done ? "bg-emerald-50/60 border-emerald-100" : "bg-white border-slate-200"}`}>
//                 <input type="checkbox" checked={st.done} title={st.done ? "Marquer comme non terminée" : "Marquer comme terminée"}
//                   onChange={() => run(() => updateSiteStep(site.id, st.id, { done: !st.done }), st.done ? "Étape rouverte." : "Étape terminée.")}
//                   className="mt-0.5 w-5 h-5 accent-emerald-600 shrink-0 cursor-pointer" />
//                 <div className="flex-1 min-w-0">
//                   <div className={`text-sm font-semibold ${st.done ? "text-slate-500 line-through" : "text-slate-800"}`}>
//                     <span className="text-slate-400 font-normal mr-1.5">{i + 1}.</span>{st.title}
//                   </div>
//                   {st.description && <p className="text-xs text-slate-500 mt-0.5 whitespace-pre-line">{st.description}</p>}
//                   <div className="flex flex-wrap gap-x-3 text-xs mt-1">
//                     {st.dueDate && <span className={late ? "text-rose-600 font-semibold" : "text-slate-500"}>Échéance : {fmtDay(st.dueDate)}{late ? " (dépassée)" : ""}</span>}
//                     {st.done && st.doneAt && <span className="text-emerald-700">Terminée le {fmtDateTime(st.doneAt)}</span>}
//                   </div>
//                 </div>
//                 <div className="flex items-center gap-0.5 shrink-0">
//                   <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Monter"><ChevronUp className="w-4 h-4" /></button>
//                   <button onClick={() => move(i, 1)} disabled={i === steps.length - 1} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Descendre"><ChevronDown className="w-4 h-4" /></button>
//                   <button onClick={() => remove(st)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
//                 </div>
//               </li>
//             )
//           })}
//         </ol>
//       )}
//     </Card>
//   )
// }

// // ---------- Pointages ----------

// function AttendanceTab({ siteId, notify }: { siteId: string; notify: Notify }) {
//   const [from, setFrom] = useState(() => dateKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))
//   const [to, setTo] = useState(todayKey())
//   const [rows, setRows] = useState<Attendance[] | null>(null)

//   useEffect(() => {
//     let cancelled = false
//     setRows(null)
//     listAttendance({ siteId, from, to })
//       .then((r) => { if (!cancelled) setRows(r) })
//       .catch((e) => { if (!cancelled) { setRows([]); notify(errorMessage(e, "Impossible de charger les pointages."), "error") } })
//     return () => { cancelled = true }
//   }, [siteId, from, to]) // eslint-disable-line react-hooks/exhaustive-deps

//   const list = rows ?? []
//   const totalMinutes = list.reduce((s, r) => s + r.workedMinutes, 0)
//   const totalSalary = list.reduce((s, r) => s + r.dailySalary, 0)
//   const people = new Set(list.map((r) => r.employeeCode)).size

//   return (
//     <Card className="rounded-2xl space-y-4">
//       <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
//         <div>
//           <h2 className="font-bold text-slate-900">Pointages sur le chantier</h2>
//           <p className="text-xs text-slate-500">Entrées et sorties effectuées sur le lieu de pointage du chantier.</p>
//         </div>
//         <div className="flex gap-2">
//           <div>
//             <label className="block text-xs text-slate-500 mb-1">Du</label>
//             <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
//           </div>
//           <div>
//             <label className="block text-xs text-slate-500 mb-1">Au</label>
//             <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
//           </div>
//         </div>
//       </div>

//       {rows === null ? <p className="text-sm text-slate-400 py-6 text-center">Chargement...</p> : list.length === 0 ? (
//         <EmptyState message="Aucun pointage sur cette période." />
//       ) : (
//         <>
//           <div className="grid grid-cols-3 gap-3 text-center">
//             <div className="bg-slate-50 rounded-xl p-3 border border-slate-100"><div className="text-[11px] uppercase font-semibold text-slate-400">Salariés</div><div className="font-bold text-slate-900">{people}</div></div>
//             <div className="bg-slate-50 rounded-xl p-3 border border-slate-100"><div className="text-[11px] uppercase font-semibold text-slate-400">Heures</div><div className="font-bold text-slate-900">{minutesToHoursLabel(totalMinutes)}</div></div>
//             <div className="bg-slate-50 rounded-xl p-3 border border-slate-100"><div className="text-[11px] uppercase font-semibold text-slate-400">Salaires</div><div className="font-bold text-slate-900">{formatAriary(totalSalary)}</div></div>
//           </div>
//           <div className="overflow-x-auto">
//             <table className="w-full text-sm">
//               <thead>
//                 <tr className="text-left text-gray-500 border-b">
//                   <th className="py-2 pr-3">Salarié</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Entrée</th>
//                   <th className="py-2 pr-3">Sortie</th><th className="py-2 pr-3">Durée</th><th className="py-2 pr-3 text-right">Salaire</th>
//                 </tr>
//               </thead>
//               <tbody className="divide-y">
//                 {list.map((r) => (
//                   <tr key={r.id}>
//                     <td className="py-2 pr-3 font-medium">{r.employeeName ?? r.employeeCode}<div className="text-xs text-gray-400 font-normal">{r.employeeCode}</div></td>
//                     <td className="py-2 pr-3 whitespace-nowrap">{fmtDay(r.workDate)}</td>
//                     <td className="py-2 pr-3">{fmtTime(r.entryTime)}{r.entrySource === "ADMIN" && <span className="ml-1 text-xs text-amber-600">(admin)</span>}</td>
//                     <td className="py-2 pr-3">{r.status === "EN_COURS" ? <Badge tone="yellow">En cours</Badge> : fmtTime(r.exitTime)}</td>
//                     <td className="py-2 pr-3">{minutesToHoursLabel(r.workedMinutes)}</td>
//                     <td className="py-2 pr-3 text-right font-semibold">{formatAriary(r.dailySalary)}</td>
//                   </tr>
//                 ))}
//               </tbody>
//               <tfoot>
//                 <tr className="border-t font-bold">
//                   <td className="py-2 pr-3" colSpan={4}>Total</td>
//                   <td className="py-2 pr-3">{minutesToHoursLabel(totalMinutes)}</td>
//                   <td className="py-2 pr-3 text-right">{formatAriary(totalSalary)}</td>
//                 </tr>
//               </tfoot>
//             </table>
//           </div>
//         </>
//       )}
//     </Card>
//   )
// }

// // ---------- Contrôles de présence ----------

// function PresenceTab({ siteId, notify }: { siteId: string; notify: Notify }) {
//   const [checks, setChecks] = useState<PresenceCheck[] | null>(null)

//   useEffect(() => {
//     let cancelled = false
//     listChecks({ siteId })
//       .then((c) => { if (!cancelled) setChecks(c) })
//       .catch((e) => { if (!cancelled) { setChecks([]); notify(errorMessage(e, "Impossible de charger les contrôles de présence."), "error") } })
//     return () => { cancelled = true }
//   }, [siteId]) // eslint-disable-line react-hooks/exhaustive-deps

//   const list = checks ?? []
//   const anomalies = list.filter((c) => c.status === "HORS_ZONE" || c.status === "SANS_REPONSE").length

//   return (
//     <Card className="rounded-2xl space-y-4">
//       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
//         <div>
//           <h2 className="font-bold text-slate-900">Contrôles de présence</h2>
//           <p className="text-xs text-slate-500">Vérifications régulières de la position des salariés en poste sur le chantier.</p>
//         </div>
//         {list.length > 0 && (
//           <Badge tone={anomalies > 0 ? "red" : "green"}>{anomalies > 0 ? `${anomalies} anomalie${anomalies > 1 ? "s" : ""}` : "Aucune anomalie"}</Badge>
//         )}
//       </div>
//       {checks === null ? <p className="text-sm text-slate-400 py-6 text-center">Chargement...</p> : list.length === 0 ? (
//         <EmptyState message="Aucun contrôle de présence enregistré pour ce chantier." />
//       ) : (
//         <div className="overflow-x-auto">
//           <table className="w-full text-sm">
//             <thead>
//               <tr className="text-left text-gray-500 border-b">
//                 <th className="py-2 pr-3">Contrôle</th><th className="py-2 pr-3">Salarié</th><th className="py-2 pr-3">Résultat</th>
//                 <th className="py-2 pr-3">Distance</th><th className="py-2 pr-3">Position reçue</th>
//               </tr>
//             </thead>
//             <tbody className="divide-y">
//               {list.map((c) => (
//                 <tr key={c.id}>
//                   <td className="py-2 pr-3 whitespace-nowrap">{fmtDateTime(c.checkedAt)}</td>
//                   <td className="py-2 pr-3 font-medium">{c.employeeName}<div className="text-xs text-gray-400 font-normal">{c.employeeCode}</div></td>
//                   <td className="py-2 pr-3"><Badge tone={PRESENCE_STATUS[c.status].tone}>{PRESENCE_STATUS[c.status].label}</Badge></td>
//                   <td className="py-2 pr-3 whitespace-nowrap">
//                     {c.distance != null ? `${c.distance} m` : "—"}
//                     {c.radiusMeters != null && <span className="text-xs text-slate-400"> / {c.radiusMeters} m</span>}
//                   </td>
//                   <td className="py-2 pr-3 whitespace-nowrap text-xs text-slate-500">{c.locationAt ? fmtTime(c.locationAt) : "Aucune"}</td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//       )}
//     </Card>
//   )
// }

// // ---------- Permissions ----------

// function LeavesTab({ siteId, notify }: { siteId: string; notify: Notify }) {
//   const [leaves, setLeaves] = useState<LeaveRequest[] | null>(null)

//   useEffect(() => {
//     let cancelled = false
//     listLeaves({ siteId })
//       .then((l) => { if (!cancelled) setLeaves(l) })
//       .catch((e) => { if (!cancelled) { setLeaves([]); notify(errorMessage(e, "Impossible de charger les permissions."), "error") } })
//     return () => { cancelled = true }
//   }, [siteId]) // eslint-disable-line react-hooks/exhaustive-deps

//   const list = leaves ?? []

//   return (
//     <Card className="rounded-2xl space-y-4">
//       <div>
//         <h2 className="font-bold text-slate-900">Demandes de permission</h2>
//         <p className="text-xs text-slate-500">Permissions demandées par l'équipe pour ce chantier. Les décisions se prennent dans « Permissions ».</p>
//       </div>
//       {leaves === null ? <p className="text-sm text-slate-400 py-6 text-center">Chargement...</p> : list.length === 0 ? (
//         <EmptyState message="Aucune demande de permission liée à ce chantier." />
//       ) : (
//         <div className="grid gap-3 md:grid-cols-2">
//           {list.map((l) => (
//             <div key={l.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
//               <div className="flex items-start justify-between gap-2">
//                 <div className="min-w-0">
//                   <div className="font-semibold text-slate-900 truncate">{l.employeeName}</div>
//                   <div className="text-xs text-slate-500">{LEAVE_TYPES[l.type]} · {durationLabel(l)}</div>
//                 </div>
//                 <Badge tone={LEAVE_STATUS[l.status].tone}>{LEAVE_STATUS[l.status].label}</Badge>
//               </div>
//               <div className="text-xs text-slate-600">
//                 {l.startDate === l.endDate ? `Le ${fmtDay(l.startDate)}` : `Du ${fmtDay(l.startDate)} au ${fmtDay(l.endDate)}`}
//               </div>
//               <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-2.5 whitespace-pre-line">« {l.reason} »</p>
//               {l.decisionNote && <p className="text-xs text-slate-500">Réponse : {l.decisionNote}</p>}
//             </div>
//           ))}
//         </div>
//       )}
//     </Card>
//   )
// }

// // ---------- Devis & factures ----------

// function DocumentsTab({ site, notify }: { site: SiteDetail; notify: Notify }) {
//   const navigate = useNavigate()
//   const [docs, setDocs] = useState<DocumentSummary[] | null>(null)

//   useEffect(() => {
//     let cancelled = false
//     listDocuments({ siteId: site.id })
//       .then((d) => { if (!cancelled) setDocs(d) })
//       .catch((e) => { if (!cancelled) { setDocs([]); notify(errorMessage(e, "Impossible de charger les documents."), "error") } })
//     return () => { cancelled = true }
//   }, [site.id]) // eslint-disable-line react-hooks/exhaustive-deps

//   function create(type: "DEVIS" | "FACTURE") {
//     const qs = new URLSearchParams({ type, siteId: site.id })
//     if (site.clientId) qs.set("clientId", site.clientId)
//     navigate(`/admin/documents/nouveau?${qs.toString()}`)
//   }

//   const list = docs ?? []

//   return (
//     <Card className="rounded-2xl space-y-4">
//       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
//         <div>
//           <h2 className="font-bold text-slate-900">Devis & factures du chantier</h2>
//           <p className="text-xs text-slate-500">Documents rattachés à ce chantier.</p>
//         </div>
//         <div className="flex gap-2">
//           <button onClick={() => create("DEVIS")} className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold flex items-center gap-1.5">
//             <FileSignature className="w-4 h-4" />Nouveau devis
//           </button>
//           <button onClick={() => create("FACTURE")} className="px-3.5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold flex items-center gap-1.5">
//             <Receipt className="w-4 h-4" />Nouvelle facture
//           </button>
//         </div>
//       </div>
//       {docs === null ? <p className="text-sm text-slate-400 py-6 text-center">Chargement...</p> : list.length === 0 ? (
//         <EmptyState message="Aucun devis ni facture pour ce chantier." />
//       ) : (
//         <div className="overflow-x-auto">
//           <table className="w-full text-sm">
//             <thead>
//               <tr className="text-left text-gray-500 border-b">
//                 <th className="py-2 pr-3">Numéro</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Date</th>
//                 <th className="py-2 pr-3">Objet</th><th className="py-2 pr-3">Statut</th><th className="py-2 pr-3 text-right">Total</th>
//               </tr>
//             </thead>
//             <tbody className="divide-y">
//               {list.map((d) => {
//                 const st = statusInfo(d.type, d.status)
//                 return (
//                   <tr key={d.id} onClick={() => navigate(`/admin/documents/${d.id}`)} className="cursor-pointer hover:bg-slate-50">
//                     <td className="py-2 pr-3 font-mono font-semibold text-primary-700">{d.number}</td>
//                     <td className="py-2 pr-3">{DOCUMENT_TYPE[d.type].label}</td>
//                     <td className="py-2 pr-3 whitespace-nowrap">{fmtDay(d.issueDate)}</td>
//                     <td className="py-2 pr-3 max-w-[240px] truncate">{d.subject || d.clientName}</td>
//                     <td className="py-2 pr-3"><Badge tone={st.tone}>{st.label}</Badge></td>
//                     <td className="py-2 pr-3 text-right font-semibold whitespace-nowrap">{formatAriary(d.total)}</td>
//                   </tr>
//                 )
//               })}
//             </tbody>
//           </table>
//         </div>
//       )}
//     </Card>
//   )
// }

// // ---------- Journal de chantier ----------

// function JournalTab({ site, run }: { site: SiteDetail; run: Run }) {
//   const confirm = useConfirm()
//   const [text, setText] = useState("")
//   const [sending, setSending] = useState(false)

//   async function add(e: React.FormEvent) {
//     e.preventDefault()
//     if (!text.trim()) return
//     setSending(true)
//     await run(() => addSiteNote(site.id, text), "Note ajoutée au journal.")
//     setText("")
//     setSending(false)
//   }

//   async function remove(noteId: string) {
//     const ok = await confirm({ title: "Supprimer cette note ?", confirmLabel: "Supprimer", tone: "danger" })
//     if (ok) run(() => deleteSiteNote(site.id, noteId), "Note supprimée.")
//   }

//   return (
//     <Card className="rounded-2xl space-y-4">
//       <div>
//         <h2 className="font-bold text-slate-900">Journal de chantier</h2>
//         <p className="text-xs text-slate-500">Observations, incidents, décisions, livraisons…</p>
//       </div>
//       <form onSubmit={add} className="flex flex-col sm:flex-row gap-2">
//         <textarea rows={2} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ajouter une note au journal…" className={`${inputCls} flex-1`} />
//         <button type="submit" disabled={sending || !text.trim()} className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-60 sm:self-end">
//           <Send className="w-4 h-4" />Publier
//         </button>
//       </form>
//       {site.notes.length === 0 ? <EmptyState message="Le journal est vide." /> : (
//         <ul className="space-y-2.5">
//           {site.notes.map((n) => (
//             <li key={n.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
//               <div className="flex items-center justify-between gap-2 mb-1">
//                 <span className="text-xs font-semibold text-slate-700">{n.authorName}<span className="font-normal text-slate-400"> · {fmtDateTime(n.createdAt)}</span></span>
//                 <button onClick={() => remove(n.id)} className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></button>
//               </div>
//               <p className="text-sm text-slate-700 whitespace-pre-line break-words">{n.text}</p>
//             </li>
//           ))}
//         </ul>
//       )}
//     </Card>
//   )
// }
