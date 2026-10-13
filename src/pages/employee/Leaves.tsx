// src/pages/employee/Leaves.tsx
// Demandes de permission côté salarié : nouvelle demande, suivi des décisions, annulation.
import { useEffect, useMemo, useRef, useState } from "react"
import { useConfirm } from "../../contexts/ConfirmContext"
import {
  subscribeMyLeaves, createLeave, cancelLeave, markLeaveDecisionsSeen, LEAVE_TYPES, LEAVE_STATUS, durationLabel,
  type LeaveRequest, type LeaveType, type DurationUnit,
} from "../../services/leaves"
import { listMySites, type Site } from "../../services/sites"
import { errorMessage } from "../../services/api"
import { todayKey } from "../../utils/date"
import { fmtDay, fmtDateTime } from "../../utils/format"
import Badge from "../../components/Badge"
import EmptyState from "../../components/EmptyState"
import Dropdown from "../../components/Dropdown"
import Toast from "../../components/Toast"
import { CalendarClock, Plus, X, Tag, HardHat, Bell, MessageSquare } from "lucide-react"

const inputCls = "w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-base sm:text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"

const emptyForm = { type: "CONGE" as LeaveType, startDate: "", durationValue: "1", durationUnit: "JOURS" as DurationUnit, reason: "", siteId: "" }

const isUnseenDecision = (l: LeaveRequest) => !l.employeeSeenAt && (l.status === "ACCEPTEE" || l.status === "REFUSEE")

export default function EmployeeLeaves() {
  const confirm = useConfirm()
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [loaded, setLoaded] = useState(false)
  const [sites, setSites] = useState<Site[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null)
  // Décisions non vues à mettre en évidence pendant toute la visite de la page.
  const [highlight, setHighlight] = useState<Set<string>>(new Set())
  const seenSent = useRef(new Set<string>())

  useEffect(() => subscribeMyLeaves(
    (list) => { setLeaves(list); setLoaded(true) },
    () => { setLoaded(true); setToast({ msg: "Impossible de charger vos demandes.", tone: "error" }) },
  ), [])

  useEffect(() => { listMySites().then(setSites).catch(() => setSites([])) }, [])

  // Les décisions affichées sont marquées comme vues (une fois par décision : pas de boucle
  // si le serveur tarde à les marquer, et une décision arrivée pendant la visite est aussi traitée).
  useEffect(() => {
    const fresh = leaves.filter((l) => isUnseenDecision(l) && !seenSent.current.has(l.id))
    if (fresh.length === 0) return
    setHighlight((prev) => new Set([...prev, ...fresh.map((l) => l.id)]))
    fresh.forEach((l) => seenSent.current.add(l.id))
    markLeaveDecisionsSeen().catch(() => fresh.forEach((l) => seenSent.current.delete(l.id)))
  }, [leaves])

  const pending = useMemo(() => leaves.filter((l) => l.status === "EN_ATTENTE"), [leaves])
  const others = useMemo(() => leaves.filter((l) => l.status !== "EN_ATTENTE"), [leaves])

  function openForm() {
    setForm({ ...emptyForm, startDate: todayKey() })
    setFormError(null)
    setOpen(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    const value = Number(form.durationValue.replace(",", "."))
    if (!form.startDate) { setFormError("Indiquez la date de début."); return }
    if (!Number.isFinite(value) || value <= 0) { setFormError("La durée doit être supérieure à 0."); return }
    if (!form.reason.trim()) { setFormError("Le motif est obligatoire."); return }
    setBusy(true)
    try {
      await createLeave({
        type: form.type, startDate: form.startDate, durationValue: value, durationUnit: form.durationUnit,
        reason: form.reason, siteId: form.siteId || null,
      })
      setOpen(false)
      setToast({ msg: "Demande envoyée à l'administrateur.", tone: "success" })
    } catch (err) {
      setFormError(errorMessage(err, "Impossible d'envoyer la demande."))
    } finally { setBusy(false) }
  }

  async function handleCancel(l: LeaveRequest) {
    const ok = await confirm({
      title: "Annuler la demande ?",
      message: `Votre demande « ${LEAVE_TYPES[l.type]} » du ${fmtDay(l.startDate)} sera annulée.`,
      confirmLabel: "Annuler la demande", cancelLabel: "Garder", tone: "danger",
    })
    if (!ok) return
    try { await cancelLeave(l.id); setToast({ msg: "Demande annulée.", tone: "success" }) }
    catch (err) { setToast({ msg: errorMessage(err, "Impossible d'annuler la demande."), tone: "error" }) }
  }

  const card = (l: LeaveRequest) => {
    const st = LEAVE_STATUS[l.status]
    const isNew = highlight.has(l.id)
    return (
      <div key={l.id} className={`bg-white rounded-2xl border shadow-sm p-4 space-y-3 ${isNew ? "border-primary-400 ring-2 ring-primary-200" : "border-slate-200/80"}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-bold text-slate-900 truncate">{LEAVE_TYPES[l.type]}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {l.startDate === l.endDate ? fmtDay(l.startDate) : `${fmtDay(l.startDate)} → ${fmtDay(l.endDate)}`} · {durationLabel(l)}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge tone={st.tone}>{st.label}</Badge>
            {isNew && <span className="text-[10px] font-bold uppercase tracking-wide text-primary-600 flex items-center gap-1"><Bell className="w-3 h-3" />Nouveau</span>}
          </div>
        </div>
        <dl className="text-xs text-slate-600 space-y-1 bg-slate-50 rounded-xl p-3">
          <div><dt className="inline text-slate-400">Motif : </dt><dd className="inline text-slate-700 whitespace-pre-line">{l.reason}</dd></div>
          {l.siteName && <div className="flex items-center gap-1.5"><HardHat className="w-3.5 h-3.5 text-slate-400" />{l.siteName}</div>}
          <div className="flex justify-between"><dt>Demandée le</dt><dd className="font-medium">{fmtDateTime(l.createdAt)}</dd></div>
          {l.decidedAt && <div className="flex justify-between"><dt>Décision le</dt><dd className="font-medium">{fmtDateTime(l.decidedAt)}</dd></div>}
          {l.decisionNote && (
            <div className={`pt-1 border-t border-slate-200 flex items-start gap-1.5 ${l.status === "REFUSEE" ? "text-rose-700" : "text-slate-700"}`}>
              <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span className="whitespace-pre-line">{l.decisionNote}</span>
            </div>
          )}
        </dl>
        {l.status === "EN_ATTENTE" && (
          <button onClick={() => handleCancel(l)} className="w-full border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold py-2.5 rounded-xl">
            Annuler la demande
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary-50 text-primary-600 rounded-xl border border-primary-100"><CalendarClock className="w-5 h-5" /></div>
          <h1 className="text-xl font-bold text-slate-900">Permissions</h1>
        </div>
        <button onClick={openForm}
          className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-3.5 py-2.5 rounded-xl shadow-md shadow-primary-600/20 flex items-center gap-1.5">
          <Plus className="w-4 h-4" />Nouvelle demande
        </button>
      </div>

      {!loaded && <p className="text-sm text-slate-400 text-center py-6">Chargement...</p>}
      {loaded && leaves.length === 0 && <EmptyState message="Vous n'avez encore fait aucune demande de permission." />}

      {pending.length > 0 && (
        <div className="space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">En attente de décision</div>
          {pending.map(card)}
        </div>
      )}
      {others.length > 0 && (
        <div className="space-y-3">
          <div className="pt-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Historique</div>
          {others.map(card)}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[9999] p-4">
          <form onSubmit={submit} className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-lg text-slate-900">Demande de permission</h2>
                <p className="text-sm text-slate-500 mt-1">L'administrateur vous informera de sa décision.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center shrink-0"><X className="w-4 h-4" /></button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Type de permission</label>
              <Dropdown value={form.type} onChange={(v) => setForm({ ...form, type: v as LeaveType })} icon={<Tag className="w-4 h-4" />}
                options={(Object.keys(LEAVE_TYPES) as LeaveType[]).map((t) => ({ value: t, label: LEAVE_TYPES[t] }))} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date de début</label>
              <input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={inputCls} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Durée</label>
              <div className="flex gap-2">
                <input type="number" min="0.5" step="0.5" inputMode="decimal" required value={form.durationValue}
                  onChange={(e) => setForm({ ...form, durationValue: e.target.value })} className={`${inputCls} flex-1`} />
                <div className="flex rounded-xl border border-slate-300 overflow-hidden shrink-0">
                  {(["JOURS", "HEURES"] as DurationUnit[]).map((u) => (
                    <button key={u} type="button" onClick={() => setForm({ ...form, durationUnit: u })}
                      className={`px-3 text-sm font-semibold transition ${form.durationUnit === u ? "bg-primary-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                      {u === "JOURS" ? "Jours" : "Heures"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Motif *</label>
              <textarea rows={3} required maxLength={1000} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Expliquez la raison de votre demande" className={inputCls} />
            </div>

            {sites.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Chantier concerné (facultatif)</label>
                <Dropdown value={form.siteId} onChange={(v) => setForm({ ...form, siteId: v })} placeholder="Aucun" icon={<HardHat className="w-4 h-4" />}
                  options={[{ value: "", label: "Aucun" }, ...sites.map((s) => ({ value: s.id, label: s.name }))]} />
              </div>
            )}

            {formError && <div className="text-sm text-rose-600 font-medium bg-rose-50 p-3 rounded-xl">{formError}</div>}

            <div className="flex gap-3">
              <button type="button" onClick={() => setOpen(false)} className="flex-1 border border-slate-200 text-slate-700 font-medium py-3 rounded-xl hover:bg-slate-50">Annuler</button>
              <button type="submit" disabled={busy} className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl disabled:opacity-60">{busy ? "..." : "Envoyer"}</button>
            </div>
          </form>
        </div>
      )}

      {toast && <Toast message={toast.msg} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  )
}
