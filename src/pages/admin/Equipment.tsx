// src/pages/admin/Equipment.tsx
// Gestion du matériel : demandes à traiter, inventaire, historique complet des prêts.
import { useEffect, useMemo, useState } from "react"
import { useConfirm } from "../../contexts/ConfirmContext"
import {
  subscribeEquipment, subscribeLoans, createEquipment, updateEquipment, setOutOfService, deleteEquipment,
  approveLoan, refuseLoan, confirmReturn, LOAN_STATUS, EQUIPMENT_STATUS,
  type Equipment, type Loan, type EquipmentInput, type LoanStatus,
} from "../../services/equipment"
import { fmtDate, fmtDateTime, fmtDay } from "../../utils/format"
import { errorMessage } from "../../services/api"
import Card from "../../components/Card"
import Badge from "../../components/Badge"
import EmptyState from "../../components/EmptyState"
import Dropdown from "../../components/Dropdown"
import Toast from "../../components/Toast"
import { Package, Plus, X, Check, Ban, Undo2, Pencil, Trash2, Wrench, History, Inbox, Clock, User } from "lucide-react"

type Tab = "demandes" | "inventaire" | "historique"
const emptyForm: EquipmentInput = { name: "", category: "", serialNumber: "", description: "" }

export default function AdminEquipment() {
  const confirm = useConfirm()

  const [tab, setTab] = useState<Tab>("demandes")
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Equipment | null>(null)
  const [form, setForm] = useState<EquipmentInput>(emptyForm)
  const [refusing, setRefusing] = useState<Loan | null>(null)
  const [reason, setReason] = useState("")

  const [histEquipment, setHistEquipment] = useState("")
  const [histStatus, setHistStatus] = useState("")

  useEffect(() => {
    const fail = () => setToast({ msg: "Impossible de charger les données.", tone: "error" })
    const u1 = subscribeEquipment(setEquipment, fail)
    const u2 = subscribeLoans(false, setLoans, fail)
    return () => { u1(); u2() }
  }, [])

  const pending = useMemo(() => loans.filter((l) => l.status === "DEMANDE" || l.status === "RETOUR_DEMANDE"), [loans])
  const eqById = useMemo(() => new Map(equipment.map((e) => [e.id, e])), [equipment])
  const history = useMemo(
    () => loans.filter((l) => (!histEquipment || l.equipmentId === histEquipment) && (!histStatus || l.status === histStatus)),
    [loans, histEquipment, histStatus]
  )

  async function run(key: string, fn: () => Promise<unknown>, okMsg: string) {
    setBusy(key)
    try { await fn(); setToast({ msg: okMsg, tone: "success" }) }
    catch (e) { setToast({ msg: errorMessage(e, "Action impossible."), tone: "error" }) }
    finally { setBusy(null) }
  }

  async function handleApprove(l: Loan) {
    const ok = await confirm({
      title: "Confirmer l'emprunt ?",
      message: `« ${l.equipmentName} » sera attribué à ${l.employeeName}. La date de prêt sera enregistrée maintenant.`,
      confirmLabel: "Confirmer le prêt",
    })
    if (ok) run(l.id, () => approveLoan(l.id), `${l.equipmentName} attribué à ${l.employeeName}.`)
  }

  async function handleConfirmReturn(l: Loan) {
    const ok = await confirm({
      title: "Confirmer le retour ?",
      message: `« ${l.equipmentName} » sera marqué comme retourné par ${l.employeeName} et redeviendra disponible.`,
      confirmLabel: "Confirmer le retour",
    })
    if (ok) run(l.id, () => confirmReturn(l.id), `${l.equipmentName} est de nouveau disponible.`)
  }

  function openForm(eq?: Equipment) {
    setEditing(eq ?? null)
    setForm(eq ? { name: eq.name, category: eq.category ?? "", serialNumber: eq.serialNumber ?? "", description: eq.description ?? "" } : emptyForm)
    setFormOpen(true)
  }

  async function saveForm(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    await run("form", async () => {
      if (editing) await updateEquipment(editing.id, form); else await createEquipment(form)
      setFormOpen(false)
    }, editing ? "Matériel mis à jour." : "Matériel ajouté.")
  }

  async function handleDelete(eq: Equipment) {
    const ok = await confirm({
      title: `Supprimer « ${eq.name} » ?`,
      message: "Le matériel sort de l'inventaire. L'historique de ses prêts est conservé.",
      confirmLabel: "Supprimer", tone: "danger",
    })
    if (ok) run(eq.id, () => deleteEquipment(eq.id), "Matériel supprimé.")
  }

  async function submitRefusal() {
    if (!refusing) return
    const l = refusing
    await run(l.id, () => refuseLoan(l.id, reason), "Demande refusée.")
    setRefusing(null); setReason("")
  }

  function showHistoryOf(eq: Equipment) {
    setHistEquipment(eq.id); setHistStatus(""); setTab("historique")
  }

  const tabBtn = (t: Tab, label: string, icon: React.ReactNode, count?: number) => (
    <button key={t} onClick={() => setTab(t)}
      className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition ${
        tab === t ? "bg-primary-600 text-white shadow-md shadow-primary-600/20" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
      {icon}{label}
      {!!count && <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${
        tab === t ? "bg-white text-primary-700" : "bg-rose-500 text-white"}`}>{count}</span>}
    </button>
  )

  const inputCls = "w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none transition"

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Gestion du matériel</h1>
          <p className="text-sm text-slate-500 mt-0.5">Suivez qui a emprunté quel matériel, à quelle date, et quand il a été rendu.</p>
        </div>
        <button onClick={() => openForm()}
          className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-primary-600/20 flex items-center gap-2">
          <Plus className="w-4 h-4" />Nouveau matériel
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabBtn("demandes", "Demandes", <Inbox className="w-4 h-4" />, pending.length)}
        {tabBtn("inventaire", "Inventaire", <Package className="w-4 h-4" />)}
        {tabBtn("historique", "Historique", <History className="w-4 h-4" />)}
      </div>

      {/* ---------- Demandes à traiter ---------- */}
      {tab === "demandes" && (
        pending.length === 0 ? (
          <Card><EmptyState message="Aucune demande en attente." /></Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {pending.map((l) => {
              const isReturn = l.status === "RETOUR_DEMANDE"
              return (
                <Card key={l.id} className="space-y-3 rounded-2xl">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">{l.equipmentName}</div>
                      <div className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5"><User className="w-3.5 h-3.5" />{l.employeeName} {l.employeeCode && <span className="text-slate-400">({l.employeeCode})</span>}</div>
                    </div>
                    <Badge tone={LOAN_STATUS[l.status].tone}>{isReturn ? "Retour signalé" : "Demande d'emprunt"}</Badge>
                  </div>
                  <dl className="text-xs text-slate-600 space-y-1 bg-slate-50 rounded-xl p-3">
                    <div className="flex justify-between"><dt>Demande envoyée</dt><dd className="font-medium">{fmtDateTime(l.requestedAt)}</dd></div>
                    {l.expectedReturnDate && <div className="flex justify-between"><dt>Retour prévu</dt><dd className="font-medium">{fmtDay(l.expectedReturnDate)}</dd></div>}
                    {isReturn && <div className="flex justify-between"><dt>Prêté le</dt><dd className="font-medium">{fmtDateTime(l.loanedAt)}</dd></div>}
                    {isReturn && <div className="flex justify-between"><dt>Retour signalé</dt><dd className="font-medium">{fmtDateTime(l.returnRequestedAt)}</dd></div>}
                    {(isReturn ? l.returnNote : l.requestNote) && (
                      <div className="pt-1 border-t border-slate-200 text-slate-700 whitespace-pre-line">« {isReturn ? l.returnNote : l.requestNote} »</div>
                    )}
                  </dl>
                  <div className="flex gap-2">
                    {isReturn ? (
                      <button onClick={() => handleConfirmReturn(l)} disabled={busy === l.id}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60">
                        <Undo2 className="w-4 h-4" />Confirmer le retour
                      </button>
                    ) : (
                      <>
                        <button onClick={() => { setRefusing(l); setReason("") }} disabled={busy === l.id}
                          className="flex-1 border border-rose-200 text-rose-600 hover:bg-rose-50 text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60">
                          <Ban className="w-4 h-4" />Refuser
                        </button>
                        <button onClick={() => handleApprove(l)} disabled={busy === l.id}
                          className="flex-1 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60">
                          <Check className="w-4 h-4" />Confirmer
                        </button>
                      </>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )
      )}

      {/* ---------- Inventaire ---------- */}
      {tab === "inventaire" && (
        equipment.length === 0 ? (
          <Card><EmptyState message="Aucun matériel. Ajoutez-en avec « Nouveau matériel »." /></Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {equipment.map((eq) => {
              const cur = loans.find((l) => l.id === eq.currentLoanId)
              return (
                <Card key={eq.id} className="space-y-3 rounded-2xl">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">{eq.name}</div>
                      <div className="text-xs text-slate-500 truncate">{[eq.category, eq.serialNumber && `N° ${eq.serialNumber}`].filter(Boolean).join(" · ") || "—"}</div>
                    </div>
                    <Badge tone={EQUIPMENT_STATUS[eq.status].tone}>{EQUIPMENT_STATUS[eq.status].label}</Badge>
                  </div>
                  {eq.description && <p className="text-sm text-slate-600">{eq.description}</p>}
                  {eq.status === "EMPRUNTE" && (
                    <div className="text-xs bg-blue-50 border border-blue-100 rounded-xl p-3 text-blue-900 space-y-0.5">
                      <div className="flex items-center gap-1.5 font-semibold"><User className="w-3.5 h-3.5" />{eq.currentBorrowerName}</div>
                      <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Depuis le {fmtDateTime(eq.currentLoanedAt ?? cur?.loanedAt)}</div>
                      {cur?.expectedReturnDate && <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Retour prévu le {fmtDay(cur.expectedReturnDate)}</div>}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button onClick={() => showHistoryOf(eq)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 flex items-center gap-1"><History className="w-3.5 h-3.5" />Historique</button>
                    {eq.status === "EMPRUNTE" && cur && (
                      <button onClick={() => handleConfirmReturn(cur)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 flex items-center gap-1"><Undo2 className="w-3.5 h-3.5" />Marquer rendu</button>
                    )}
                    {eq.status !== "EMPRUNTE" && (
                      <button onClick={() => run(eq.id, () => setOutOfService(eq.id, eq.status === "DISPONIBLE"), eq.status === "DISPONIBLE" ? "Matériel mis hors service." : "Matériel de nouveau disponible.")}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 flex items-center gap-1">
                        <Wrench className="w-3.5 h-3.5" />{eq.status === "DISPONIBLE" ? "Hors service" : "Remettre en service"}
                      </button>
                    )}
                    <button onClick={() => openForm(eq)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" title="Modifier"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(eq)} disabled={eq.status === "EMPRUNTE"} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </Card>
              )
            })}
          </div>
        )
      )}

      {/* ---------- Historique ---------- */}
      {tab === "historique" && (
        <Card className="space-y-4 rounded-2xl">
          <div className="grid sm:grid-cols-2 gap-3">
            <Dropdown value={histEquipment} onChange={setHistEquipment} placeholder="Tout le matériel" icon={<Package className="w-4 h-4" />}
              options={[{ value: "", label: "Tout le matériel" }, ...equipment.map((e) => ({ value: e.id, label: e.name }))]} />
            <Dropdown value={histStatus} onChange={setHistStatus} placeholder="Tous les statuts" icon={<Inbox className="w-4 h-4" />}
              options={[{ value: "", label: "Tous les statuts" }, ...(Object.keys(LOAN_STATUS) as LoanStatus[]).map((s) => ({ value: s, label: LOAN_STATUS[s].label }))]} />
          </div>
          {history.length === 0 ? <EmptyState message="Aucun prêt pour ces critères." /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-3">Matériel</th><th className="py-2 pr-3">Salarié</th><th className="py-2 pr-3">Demande</th>
                    <th className="py-2 pr-3">Date de prêt</th><th className="py-2 pr-3">Date de retour</th><th className="py-2 pr-3">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {history.map((l) => (
                    <tr key={l.id}>
                      <td className="py-2 pr-3 font-medium">{l.equipmentName}{(!l.equipmentId || !eqById.has(l.equipmentId)) && <span className="ml-1 text-xs text-slate-400">(supprimé)</span>}</td>
                      <td className="py-2 pr-3">{l.employeeName}<div className="text-xs text-gray-400">{l.employeeCode ?? "—"}</div></td>
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(l.requestedAt)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtDateTime(l.loanedAt)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {fmtDateTime(l.returnedAt)}
                        {!l.returnedAt && l.expectedReturnDate && <div className="text-xs text-slate-400">prévu le {fmtDay(l.expectedReturnDate)}</div>}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge tone={LOAN_STATUS[l.status].tone}>{LOAN_STATUS[l.status].label}</Badge>
                        {l.status === "REFUSEE" && l.refusalReason && <div className="text-xs text-slate-500 mt-1 max-w-[200px]">{l.refusalReason}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ---------- Formulaire matériel ---------- */}
      {formOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <form onSubmit={saveForm} className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <h2 className="font-bold text-lg text-slate-900">{editing ? "Modifier le matériel" : "Nouveau matériel"}</h2>
              <button type="button" onClick={() => setFormOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Nom *</label>
              <input autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex : Perceuse Bosch" className={inputCls} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Catégorie</label>
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Outillage" className={inputCls} /></div>
              <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">N° de série</label>
                <input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} className={inputCls} /></div>
            </div>
            <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Description</label>
              <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} /></div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setFormOpen(false)} className="flex-1 border border-slate-200 text-slate-700 font-medium py-3 rounded-xl hover:bg-slate-50">Annuler</button>
              <button type="submit" disabled={busy === "form" || !form.name.trim()} className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl disabled:opacity-60">{busy === "form" ? "..." : "Enregistrer"}</button>
            </div>
          </form>
        </div>
      )}

      {/* ---------- Motif de refus ---------- */}
      {refusing && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div>
              <h2 className="font-bold text-lg text-slate-900">Refuser la demande</h2>
              <p className="text-sm text-slate-500 mt-1">« {refusing.equipmentName} » — {refusing.employeeName}</p>
            </div>
            <textarea autoFocus rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motif du refus (facultatif, visible par le salarié)" className={inputCls} />
            <div className="flex gap-3">
              <button onClick={() => setRefusing(null)} className="flex-1 border border-slate-200 text-slate-700 font-medium py-3 rounded-xl hover:bg-slate-50">Annuler</button>
              <button onClick={submitRefusal} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold py-3 rounded-xl">Refuser</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.msg} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  )
}
