// src/pages/admin/Sites.tsx
// Liste des chantiers : informations principales, avancement, équipe ; création / modification.
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { listSites, createSite, updateSite, SITE_STATUS, type Site, type SiteInput, type SiteStatus } from "../../services/sites"
import { listClients, type Client } from "../../services/clients"
import { listWorkplaces, type Workplace } from "../../services/workplaces"
import { errorMessage } from "../../services/api"
import { fmtDay } from "../../utils/format"
import Card from "../../components/Card"
import Badge from "../../components/Badge"
import EmptyState from "../../components/EmptyState"
import Dropdown from "../../components/Dropdown"
import Toast from "../../components/Toast"
import { HardHat, Plus, Search, X, Building2, MapPin, Users, ListChecks, CalendarDays, Filter } from "lucide-react"

const inputCls = "w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none transition"

export const emptySiteInput: SiteInput = {
  name: "", clientId: null, workplaceId: null, address: null, description: null,
  startDate: null, endDate: null, status: "PREPARATION", manualProgress: 0,
}

/** Barre de progression (0–100 %). */
export function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
        <div className={`h-full rounded-full ${v >= 100 ? "bg-emerald-500" : "bg-primary-600"}`} style={{ width: `${v}%` }} />
      </div>
      <span className="text-xs font-semibold text-slate-600 w-9 text-right">{v} %</span>
    </div>
  )
}

/** Période d'un chantier : « 01/10/2026 → 30/11/2026 ». */
export function sitePeriod(s: Pick<Site, "startDate" | "endDate">) {
  if (!s.startDate && !s.endDate) return "Période non définie"
  return `${fmtDay(s.startDate)} → ${s.endDate ? fmtDay(s.endDate) : "…"}`
}

interface FormProps {
  /** Chantier à modifier ; absent = création. */
  site?: Site | null
  hasSteps?: boolean
  onClose: () => void
  onSaved: (id: string) => void
}

/** Modale de création / modification d'un chantier (partagée avec la fiche du chantier). */
export function SiteFormModal({ site, hasSteps, onClose, onSaved }: FormProps) {
  const [form, setForm] = useState<SiteInput>(() => site ? {
    name: site.name, clientId: site.clientId ?? null, workplaceId: site.workplaceId ?? null,
    address: site.address ?? null, description: site.description ?? null,
    startDate: site.startDate ?? null, endDate: site.endDate ?? null, status: site.status,
    manualProgress: site.manualProgress ?? 0,
  } : emptySiteInput)
  const [clients, setClients] = useState<Client[]>([])
  const [workplaces, setWorkplaces] = useState<Workplace[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listClients().then(setClients).catch(() => {})
    listWorkplaces().then(setWorkplaces).catch(() => {})
  }, [])

  const set = <K extends keyof SiteInput>(k: K, v: SiteInput[K]) => setForm((f) => ({ ...f, [k]: v }))
  const text = (v: string) => (v.trim() ? v : null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.name.trim()) { setError("Le nom du chantier est obligatoire."); return }
    if (form.startDate && form.endDate && form.endDate < form.startDate) { setError("La date de fin doit être après la date de début."); return }
    const progress = Math.max(0, Math.min(100, Math.round(Number(form.manualProgress) || 0)))
    const payload: SiteInput = { ...form, name: form.name.trim(), manualProgress: progress }
    setSaving(true)
    try {
      if (site) {
        await updateSite(site.id, payload)
        onSaved(site.id)
      } else {
        const { id } = await createSite(payload)
        onSaved(id)
      }
    } catch (err) {
      setError(errorMessage(err, "Enregistrement impossible."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <form onSubmit={submit} className="bg-white rounded-3xl w-full max-w-2xl p-6 space-y-4 shadow-2xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <h2 className="font-bold text-lg text-slate-900">{site ? "Modifier le chantier" : "Nouveau chantier"}</h2>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nom du chantier *</label>
            <input autoFocus required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex : Rénovation entrepôt Tanambao" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Client</label>
            <Dropdown value={form.clientId ?? ""} onChange={(v) => set("clientId", v || null)} icon={<Building2 className="w-4 h-4" />}
              placeholder="Aucun client"
              options={[{ value: "", label: "Aucun client" }, ...clients.map((c) => ({ value: c.id, label: c.name }))]} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Statut</label>
            <Dropdown value={form.status} onChange={(v) => set("status", v as SiteStatus)}
              options={(Object.keys(SITE_STATUS) as SiteStatus[]).map((s) => ({ value: s, label: SITE_STATUS[s].label }))} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Lieu de pointage (zone GPS)</label>
            <Dropdown value={form.workplaceId ?? ""} onChange={(v) => set("workplaceId", v || null)} icon={<MapPin className="w-4 h-4" />}
              placeholder="Aucun lieu"
              options={[{ value: "", label: "Aucun lieu" }, ...workplaces.map((w) => ({ value: w.id, label: w.name }))]} />
            <p className="mt-1 text-xs text-slate-400">L'équipe pointe sur ce lieu : ses pointages sont rattachés au chantier et les contrôles de présence comparent les positions à sa zone autorisée.</p>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Adresse</label>
            <input value={form.address ?? ""} onChange={(e) => set("address", text(e.target.value))} placeholder="Quartier, ville…" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date de début</label>
            <input type="date" value={form.startDate ?? ""} onChange={(e) => set("startDate", e.target.value || null)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date de fin prévue</label>
            <input type="date" value={form.endDate ?? ""} onChange={(e) => set("endDate", e.target.value || null)} className={inputCls} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description</label>
            <textarea rows={3} value={form.description ?? ""} onChange={(e) => set("description", text(e.target.value))} placeholder="Travaux prévus, contraintes, remarques…" className={inputCls} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Avancement manuel (%)</label>
            <input type="number" min={0} max={100} value={form.manualProgress} disabled={hasSteps}
              onChange={(e) => set("manualProgress", Number(e.target.value))} className={`${inputCls} disabled:opacity-60`} />
            <p className="mt-1 text-xs text-slate-400">
              {hasSteps
                ? "Ce chantier a des étapes : l'avancement est calculé automatiquement à partir des étapes terminées."
                : "Utilisé tant que le chantier n'a pas d'étapes ; dès qu'il en a, l'avancement est calculé à partir des étapes terminées."}
            </p>
          </div>
        </div>

        {error && <div className="text-sm text-rose-600 font-medium bg-rose-50 p-3 rounded-xl">{error}</div>}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 border border-slate-200 text-slate-700 font-medium py-3 rounded-xl hover:bg-slate-50">Annuler</button>
          <button type="submit" disabled={saving} className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl disabled:opacity-60">
            {saving ? "Enregistrement..." : site ? "Mettre à jour" : "Créer le chantier"}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function AdminSites() {
  const navigate = useNavigate()
  const [sites, setSites] = useState<Site[]>([])
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  async function refresh() {
    try { setSites(await listSites()) }
    catch (e) { setToast(errorMessage(e, "Impossible de charger les chantiers.")) }
    finally { setLoaded(true) }
  }
  useEffect(() => { refresh() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return sites.filter((s) =>
      (!status || s.status === status) &&
      (!q || `${s.name} ${s.clientName ?? ""} ${s.workplaceName ?? ""} ${s.address ?? ""}`.toLowerCase().includes(q)))
  }, [sites, search, status])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const s of sites) c[s.status] = (c[s.status] ?? 0) + 1
    return c
  }, [sites])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Suivi des chantiers</h1>
          <p className="text-sm text-slate-500 mt-0.5">Équipes, avancement, pointages, permissions, devis et factures de chaque chantier.</p>
        </div>
        <button onClick={() => setFormOpen(true)}
          className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-md shadow-primary-600/20 flex items-center gap-2">
          <Plus className="w-4 h-4" />Nouveau chantier
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(SITE_STATUS) as SiteStatus[]).map((s) => (
          <button key={s} onClick={() => setStatus(status === s ? "" : s)}
            className={`bg-white p-4 rounded-2xl border text-left shadow-sm transition ${status === s ? "border-primary-500 ring-2 ring-primary-500/20" : "border-slate-200 hover:shadow-md"}`}>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{SITE_STATUS[s].label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{counts[s] ?? 0}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un chantier, un client, un lieu…"
            className="w-full border border-slate-300 rounded-xl pl-10 pr-3 py-3 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none" />
        </div>
        <div className="sm:w-60">
          <Dropdown value={status} onChange={setStatus} icon={<Filter className="w-4 h-4" />} placeholder="Tous les statuts"
            options={[{ value: "", label: "Tous les statuts" }, ...(Object.keys(SITE_STATUS) as SiteStatus[]).map((s) => ({ value: s, label: SITE_STATUS[s].label }))]} />
        </div>
      </div>

      {loaded && filtered.length === 0 ? (
        <Card><EmptyState message={sites.length === 0 ? "Aucun chantier. Créez-en un avec « Nouveau chantier »." : "Aucun chantier pour ces critères."} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => (
            <button key={s.id} onClick={() => navigate(`/admin/chantiers/${s.id}`)}
              className="text-left bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-3 hover:shadow-md hover:border-primary-300 transition">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
                    <HardHat className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">{s.name}</div>
                    <div className="text-xs text-slate-500 truncate">{s.clientName ?? "Sans client"}</div>
                  </div>
                </div>
                <Badge tone={SITE_STATUS[s.status].tone}>{SITE_STATUS[s.status].label}</Badge>
              </div>
              <ProgressBar value={s.progress} />
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" /><span className="truncate">{s.workplaceName ?? "Aucun lieu de pointage"}</span></div>
                <div className="flex items-center gap-2"><CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />{sitePeriod(s)}</div>
              </div>
              <div className="flex items-center gap-4 pt-2 border-t border-slate-100 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{s.memberCount} membre{s.memberCount > 1 ? "s" : ""}</span>
                <span className="flex items-center gap-1.5"><ListChecks className="w-3.5 h-3.5" />{s.stepsDone}/{s.stepsTotal} étape{s.stepsTotal > 1 ? "s" : ""}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {formOpen && (
        <SiteFormModal onClose={() => setFormOpen(false)}
          onSaved={(id) => { setFormOpen(false); navigate(`/admin/chantiers/${id}`) }} />
      )}

      {toast && <Toast message={toast} tone="error" onClose={() => setToast(null)} />}
    </div>
  )
}
