// src/pages/employee/Equipment.tsx
// Matériel côté salarié : liste des matériels, demande d'emprunt, suivi de mes emprunts, signalement du retour.
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "../../hooks/useAuth"
import { useConfirm } from "../../contexts/ConfirmContext"
import {
  subscribeEquipment, subscribeLoans, requestLoan, cancelRequest, reportReturn, LOAN_STATUS, EQUIPMENT_STATUS,
  type Equipment, type Loan,
} from "../../services/equipment"
import { fmtDate, fmtDateTime, fmtDay } from "../../utils/format"
import { errorMessage } from "../../services/api"
import { todayKey } from "../../utils/date"
import Badge from "../../components/Badge"
import EmptyState from "../../components/EmptyState"
import Toast from "../../components/Toast"
import { Package, Send, X, Undo2, Clock, Search } from "lucide-react"

type Tab = "liste" | "mes"
type Dialog = { kind: "request"; eq: Equipment } | { kind: "return"; loan: Loan } | null

export default function EmployeeEquipment() {
  const { appUser } = useAuth()
  const confirm = useConfirm()
  const employeeCode = appUser?.employeeCode ?? ""

  const [tab, setTab] = useState<Tab>("liste")
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [search, setSearch] = useState("")
  const [dialog, setDialog] = useState<Dialog>(null)
  const [note, setNote] = useState("")
  const [returnBy, setReturnBy] = useState("")
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null)

  useEffect(() => {
    if (!employeeCode) return
    const fail = () => setToast({ msg: "Impossible de charger le matériel.", tone: "error" })
    const u1 = subscribeEquipment(setEquipment, fail)
    const u2 = subscribeLoans(true, setLoans, fail)
    return () => { u1(); u2() }
  }, [employeeCode])

  const pendingByEq = useMemo(() => new Set(loans.filter((l) => l.status === "DEMANDE").map((l) => l.equipmentId)), [loans])
  const active = loans.filter((l) => l.status === "EN_COURS" || l.status === "RETOUR_DEMANDE" || l.status === "DEMANDE")
  const past = loans.filter((l) => !active.includes(l))
  const filtered = equipment.filter((e) => `${e.name} ${e.category ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()))

  function open(d: Dialog) { setNote(""); setReturnBy(""); setDialog(d) }

  async function submit() {
    if (!dialog) return
    setBusy(true)
    try {
      if (dialog.kind === "request") {
        await requestLoan(dialog.eq.id, note, returnBy || undefined)
        setToast({ msg: "Demande envoyée à l'administrateur.", tone: "success" })
        setTab("mes")
      } else {
        await reportReturn(dialog.loan.id, note)
        setToast({ msg: "Retour signalé. L'administrateur doit le confirmer.", tone: "success" })
      }
      setDialog(null)
    } catch (e) {
      setToast({ msg: errorMessage(e, "Action impossible."), tone: "error" })
    } finally { setBusy(false) }
  }

  async function handleCancel(l: Loan) {
    const ok = await confirm({ title: "Annuler la demande ?", message: `Votre demande pour « ${l.equipmentName} » sera annulée.`, confirmLabel: "Annuler la demande", cancelLabel: "Garder", tone: "danger" })
    if (!ok) return
    try { await cancelRequest(l.id); setToast({ msg: "Demande annulée.", tone: "success" }) }
    catch (e) { setToast({ msg: errorMessage(e, "Impossible d'annuler la demande."), tone: "error" }) }
  }

  const tabBtn = (t: Tab, label: string, count?: number) => (
    <button onClick={() => setTab(t)}
      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 ${
        tab === t ? "bg-primary-600 text-white shadow-md shadow-primary-600/20" : "bg-white border border-slate-200 text-slate-600"}`}>
      {label}{!!count && <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${tab === t ? "bg-white text-primary-700" : "bg-primary-100 text-primary-700"}`}>{count}</span>}
    </button>
  )

  const loanCard = (l: Loan) => (
    <div key={l.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="font-bold text-slate-900 truncate">{l.equipmentName}</div>
        <Badge tone={LOAN_STATUS[l.status].tone}>{LOAN_STATUS[l.status].label}</Badge>
      </div>
      <dl className="text-xs text-slate-600 space-y-1 bg-slate-50 rounded-xl p-3">
        <div className="flex justify-between"><dt>Demandé le</dt><dd className="font-medium">{fmtDate(l.requestedAt)}</dd></div>
        {l.expectedReturnDate && <div className="flex justify-between"><dt>Retour prévu</dt><dd className="font-medium">{fmtDay(l.expectedReturnDate)}</dd></div>}
        <div className="flex justify-between"><dt>Date de prêt</dt><dd className="font-medium">{fmtDateTime(l.loanedAt)}</dd></div>
        <div className="flex justify-between"><dt>Date de retour</dt><dd className="font-medium">{l.status === "RETOUR_DEMANDE" ? "En attente de confirmation" : fmtDateTime(l.returnedAt)}</dd></div>
        {l.status === "REFUSEE" && l.refusalReason && <div className="pt-1 border-t border-slate-200 text-rose-700">Motif : {l.refusalReason}</div>}
      </dl>
      {l.status === "DEMANDE" && (
        <button onClick={() => handleCancel(l)} className="w-full border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-semibold py-2.5 rounded-xl">Annuler la demande</button>
      )}
      {l.status === "EN_COURS" && (
        <button onClick={() => open({ kind: "return", loan: l })} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2">
          <Undo2 className="w-4 h-4" />Signaler le retour
        </button>
      )}
      {l.status === "RETOUR_DEMANDE" && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-2.5 flex items-center gap-2"><Clock className="w-4 h-4 shrink-0" />Retour signalé : l'administrateur doit le confirmer.</div>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-primary-50 text-primary-600 rounded-xl border border-primary-100"><Package className="w-5 h-5" /></div>
        <h1 className="text-xl font-bold text-slate-900">Matériel</h1>
      </div>

      <div className="flex gap-2">{tabBtn("liste", "Matériel")}{tabBtn("mes", "Mes emprunts", active.length)}</div>

      {tab === "liste" && (
        <>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un matériel..."
              className="w-full border border-slate-300 rounded-xl pl-10 pr-3 py-3 text-base sm:text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none" />
          </div>
          {filtered.length === 0 && <EmptyState message={equipment.length === 0 ? "Aucun matériel enregistré pour le moment." : "Aucun résultat."} />}
          <div className="space-y-3">
            {filtered.map((eq) => {
              const requested = pendingByEq.has(eq.id)
              const mine = !!employeeCode && eq.currentBorrowerCode === employeeCode
              return (
                <div key={eq.id} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">{eq.name}</div>
                      {(eq.category || eq.serialNumber) && <div className="text-xs text-slate-500">{[eq.category, eq.serialNumber && `N° ${eq.serialNumber}`].filter(Boolean).join(" · ")}</div>}
                    </div>
                    <Badge tone={EQUIPMENT_STATUS[eq.status].tone}>{mine ? "Emprunté par vous" : EQUIPMENT_STATUS[eq.status].label}</Badge>
                  </div>
                  {eq.description && <p className="text-sm text-slate-600">{eq.description}</p>}
                  {eq.status === "DISPONIBLE" && (
                    requested
                      ? <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-2.5 flex items-center gap-2"><Clock className="w-4 h-4" />Demande envoyée, en attente de l'administrateur.</div>
                      : <button onClick={() => open({ kind: "request", eq })} className="w-full bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2"><Send className="w-4 h-4" />Demander cet emprunt</button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {tab === "mes" && (
        <div className="space-y-3">
          {loans.length === 0 && <EmptyState message="Vous n'avez encore fait aucune demande." />}
          {active.map(loanCard)}
          {past.length > 0 && <div className="pt-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Historique</div>}
          {past.map(loanCard)}
        </div>
      )}

      {dialog && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-lg text-slate-900">{dialog.kind === "request" ? "Demande d'emprunt" : "Signaler le retour"}</h2>
                <p className="text-sm text-slate-500 mt-1">{dialog.kind === "request" ? dialog.eq.name : dialog.loan.equipmentName}</p>
              </div>
              <button onClick={() => setDialog(null)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center shrink-0"><X className="w-4 h-4" /></button>
            </div>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300}
              placeholder={dialog.kind === "request" ? "Motif ou durée souhaitée (facultatif)" : "Remarque sur l'état du matériel (facultatif)"}
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-base sm:text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none" />
            {dialog.kind === "request" && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Jusqu'à quand ? (facultatif)</label>
                <input type="date" value={returnBy} min={todayKey()} onChange={(e) => setReturnBy(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-base sm:text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none" />
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setDialog(null)} className="flex-1 border border-slate-200 text-slate-700 font-medium py-3 rounded-xl hover:bg-slate-50">Annuler</button>
              <button onClick={submit} disabled={busy} className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl disabled:opacity-60">{busy ? "..." : dialog.kind === "request" ? "Envoyer" : "Signaler"}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.msg} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  )
}
