// src/pages/admin/Salaries.tsx
import { useEffect, useState } from "react"
import { getSalarySummary, type SalarySummaryRow } from "../../services/salary"
import { createPayment, listPayments, updatePayment, listDeletedPayments, softDeletePayment, type DeletedPayment, type Payment, type PaymentStatus } from "../../services/payments"
import { errorMessage } from "../../services/api"
import { formatAriary } from "../../utils/salaryCalculator"
import { fmtDateTime, fmtDay } from "../../utils/format"
import Card from "../../components/Card"
import { StatCard } from "../../components/Card"
import EmptyState from "../../components/EmptyState"
import Toast from "../../components/Toast"
import { AlertTriangle, Archive, History, X, Pencil, Trash2 } from "lucide-react"
import { listEmployees, employeeName, type Employee } from "../../services/employees"
import { listSites, type Site } from "../../services/sites"

// earned = total gagné, paid = total déjà payé, due = reste à payer (calculés par le serveur)
type Row = SalarySummaryRow

export default function AdminSalaries() {
  const [rows, setRows] = useState<Row[]>([])
  const [totals, setTotals] = useState({ earned: 0, paid: 0, due: 0 })
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [paymentFilters, setPaymentFilters] = useState({ employeeCodes: [] as string[], from: "", to: "", type: "", status: "", siteId: "" })
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([])
  const [editPayment, setEditPayment] = useState<Payment | null>(null)
  const [editForm, setEditForm] = useState({ amount: "", note: "", type: "", status: "EN_ATTENTE" as PaymentStatus, siteId: "" })
  const [openPayFor, setOpenPayFor] = useState<string | null>(null) // employee.id
  const [openHistoryFor, setOpenHistoryFor] = useState<string[]>([])
  const [employeeSelectorOpen, setEmployeeSelectorOpen] = useState(false)
  const [employeeSearch, setEmployeeSearch] = useState("")
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<{ employeeCode: string; payment: Payment } | null>(null)
  const [archiveReason, setArchiveReason] = useState("")
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [showDeletedHistory, setShowDeletedHistory] = useState(false)
  const [deletedPayments, setDeletedPayments] = useState<DeletedPayment[] | null>(null)
  const [loadingDeletedPayments, setLoadingDeletedPayments] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      const summary = await getSalarySummary()
      setRows(summary.rows)
      setTotals(summary.totals)
    } catch (e) {
      setToast({ msg: errorMessage(e, "Impossible de charger les rémunérations."), tone: "error" })
    } finally {
      setLoading(false)
    }
  }

  async function fetchFilteredPayments(filters: typeof paymentFilters): Promise<Payment[]> {
    const selectedCodes = filters.employeeCodes
    const result = await listPayments({
      employeeCode: selectedCodes.length === 1 ? selectedCodes[0] : undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      type: filters.type || undefined,
      status: (filters.status || undefined) as PaymentStatus | undefined,
      siteId: filters.siteId || undefined,
    })
    return selectedCodes.length > 1 ? result.filter((payment) => selectedCodes.includes(payment.employeeCode)) : result
  }

  useEffect(() => { refresh(); listEmployees().then(setEmployees).catch(() => {}); listSites().then(setSites).catch(() => {}) }, [])
  useEffect(() => {
    let active = true
    fetchFilteredPayments(paymentFilters)
      .then((result) => { if (active) setFilteredPayments(result) })
      .catch((e) => { if (active) setToast({ msg: errorMessage(e, "Impossible de filtrer les paiements."), tone: "error" }) })
    return () => { active = false }
  }, [paymentFilters])
  useEffect(() => { setOpenHistoryFor(paymentFilters.employeeCodes) }, [paymentFilters.employeeCodes])

  const displayRows = paymentFilters.employeeCodes.length
    ? rows.filter((row) => paymentFilters.employeeCodes.includes(row.employee.employeeCode))
    : rows
  const displayTotals = paymentFilters.employeeCodes.length
    ? displayRows.reduce((sum, row) => ({ earned: sum.earned + row.earned, paid: sum.paid + row.paid, due: sum.due + row.due }), { earned: 0, paid: 0, due: 0 })
    : totals

  function beginEdit(p: Payment) { setEditPayment(p); setEditForm({ amount: String(p.amount), note: p.note || "", type: p.type || "", status: p.status || "EN_ATTENTE", siteId: p.siteId || "" }) }
  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editPayment) return
    setSaving(true)
    try {
      await updatePayment(editPayment.id, { amount: Number(editForm.amount), note: editForm.note, type: editForm.type, status: editForm.status, siteId: editForm.siteId || null })
      setEditPayment(null)
      setToast({ msg: "Paiement mis à jour.", tone: "success" })
      setFilteredPayments(await fetchFilteredPayments(paymentFilters))
      await refresh()
    } catch (e) { setError(errorMessage(e, "Modification impossible.")) }
    finally { setSaving(false) }
  }

  function toggleHistory(code: string) {
    setOpenHistoryFor((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code])
  }

  function openPayModal(code: string) {
    setOpenPayFor(code)
    setAmount("")
    setNote("")
    setError(null)
  }

  function openArchiveModal(employeeCode: string, payment: Payment) {
    setArchiveTarget({ employeeCode, payment })
    setArchiveReason("")
    setArchiveError(null)
  }

  async function loadDeletedPayments() {
    setLoadingDeletedPayments(true)
    try { setDeletedPayments(await listDeletedPayments()) }
    catch (e) { setToast({ msg: errorMessage(e, "Impossible de charger l’historique des paiements archivés."), tone: "error" }) }
    finally { setLoadingDeletedPayments(false) }
  }

  async function toggleDeletedHistory() {
    const next = !showDeletedHistory
    setShowDeletedHistory(next)
    if (next && deletedPayments === null) await loadDeletedPayments()
  }

  async function handleArchivePayment(event: React.FormEvent) {
    event.preventDefault()
    if (!archiveTarget) return
    const reason = archiveReason.trim()
    if (!reason) {
      setArchiveError("Le motif est obligatoire pour archiver ce paiement.")
      return
    }
    setArchiving(true)
    setArchiveError(null)
    try {
      await softDeletePayment(archiveTarget.payment.id, reason)
      setFilteredPayments((prev) => prev.filter((payment) => payment.id !== archiveTarget.payment.id))
      await refresh()
      if (deletedPayments !== null || showDeletedHistory) await loadDeletedPayments()
      setArchiveTarget(null)
      setArchiveReason("")
      setToast({ msg: "Paiement supprimé et conservé dans l’historique d’audit.", tone: "success" })
    } catch (e) {
      setArchiveError(errorMessage(e, "Impossible d’archiver ce paiement."))
    } finally { setArchiving(false) }
  }
  async function handlePay(e: React.FormEvent, row: Row) {
    e.preventDefault()
    setError(null)
    const value = Number(amount)
    if (!value || value <= 0) {
      setError("Entrez un montant valide.")
      return
    }
    if (value > row.due) {
      setError(`Ce montant dépasse le reste à payer (${formatAriary(row.due)}).`)
      return
    }
    setSaving(true)
    try {
      // Le serveur revérifie que le montant ne dépasse pas le reste à payer et journalise le paiement.
      await createPayment(row.employee.employeeCode, Math.round(value), note)
      setOpenPayFor(null)
      setFilteredPayments(await fetchFilteredPayments(paymentFilters))
      setOpenHistoryFor((current) => current.includes(row.employee.employeeCode) ? current : [...current, row.employee.employeeCode])
      setToast({ msg: `${formatAriary(value)} payé à ${row.employee.firstName} ${row.employee.lastName}.`, tone: "success" })
      await refresh()
    } catch (err) {
      setError(errorMessage(err, "Le paiement n'a pas pu être enregistré."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Rémunérations</h1>
        <button type="button" onClick={() => void toggleDeletedHistory()}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${showDeletedHistory ? "border-primary-200 bg-primary-50 text-primary-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
          <History className="h-4 w-4" />{showDeletedHistory ? "Masquer les archives" : "Paiements archivés"}
        </button>
      </div>

      <Card className="space-y-3">
        <h2 className="font-semibold">Filtrer les paiements</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-6">
          <div className="relative">
            <button type="button" aria-expanded={employeeSelectorOpen} onClick={() => setEmployeeSelectorOpen((open) => !open)} className="flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm">
              <span className="truncate">{paymentFilters.employeeCodes.length === 0 ? "Tous les salariés" : paymentFilters.employeeCodes.length === 1 ? employeeName(employees.find((employee) => employee.employeeCode === paymentFilters.employeeCodes[0])!) : `${paymentFilters.employeeCodes.length} salariés sélectionnés`}</span>
              <span className="text-slate-400">▾</span>
            </button>
            {employeeSelectorOpen && <div className="absolute left-0 top-full z-30 mt-1 w-full min-w-[260px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
              <input autoFocus value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder="Rechercher un salarié…" className="mb-2 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500" />
              <div className="mb-2 flex justify-between gap-2 border-b pb-2 text-xs">
                <button type="button" onClick={() => setPaymentFilters((current) => ({ ...current, employeeCodes: Array.from(new Set([...current.employeeCodes, ...employees.filter((employee) => employeeName(employee).toLowerCase().includes(employeeSearch.toLowerCase()) || employee.employeeCode.toLowerCase().includes(employeeSearch.toLowerCase())).map((employee) => employee.employeeCode)])) }))} className="font-medium text-primary-700">Sélectionner les résultats</button>
                <button type="button" onClick={() => setPaymentFilters((current) => ({ ...current, employeeCodes: [] }))} className="text-slate-500 hover:text-slate-800">Tout effacer</button>
              </div>
              <div className="max-h-56 overflow-y-auto">
                {employees.filter((employee) => employeeName(employee).toLowerCase().includes(employeeSearch.toLowerCase()) || employee.employeeCode.toLowerCase().includes(employeeSearch.toLowerCase())).map((employee) => {
                  const checked = paymentFilters.employeeCodes.includes(employee.employeeCode)
                  return <label key={employee.employeeCode} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-50">
                    <input type="checkbox" checked={checked} onChange={() => setPaymentFilters((current) => ({ ...current, employeeCodes: checked ? current.employeeCodes.filter((code) => code !== employee.employeeCode) : [...current.employeeCodes, employee.employeeCode] }))} />
                    <span className="min-w-0"><span className="block truncate font-medium text-slate-700">{employeeName(employee)}</span><span className="text-xs text-slate-400">{employee.employeeCode}</span></span>
                  </label>
                })}
                {employees.length === 0 && <p className="p-2 text-xs text-slate-500">Chargement des salariés…</p>}
              </div>
            </div>}
          </div>
          <input aria-label="Du" type="date" value={paymentFilters.from} onChange={(event) => setPaymentFilters({ ...paymentFilters, from: event.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
          <input aria-label="Au" type="date" value={paymentFilters.to} onChange={(event) => setPaymentFilters({ ...paymentFilters, to: event.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
          <input placeholder="Type libre" value={paymentFilters.type} onChange={(event) => setPaymentFilters({ ...paymentFilters, type: event.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
          <select value={paymentFilters.status} onChange={(event) => setPaymentFilters({ ...paymentFilters, status: event.target.value })} className="rounded-lg border px-3 py-2 text-sm"><option value="">Tous statuts</option><option value="PAYE">PAYE</option><option value="EN_ATTENTE">EN_ATTENTE</option><option value="ANNULE">ANNULE</option></select>
          <select value={paymentFilters.siteId} onChange={(event) => setPaymentFilters({ ...paymentFilters, siteId: event.target.value })} className="rounded-lg border px-3 py-2 text-sm"><option value="">Tous chantiers</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button onClick={() => setPaymentFilters({ employeeCodes: [], from: "", to: "", type: "", status: "", siteId: "" })} className="text-xs text-primary-700">Réinitialiser les filtres</button>
          {paymentFilters.employeeCodes.length > 0 && <span className="text-xs text-slate-500">L’historique des salariés sélectionnés est ouvert automatiquement.</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="text-left text-slate-500"><th>Date</th><th>Salarié</th><th>Type</th><th>Statut</th><th>Montant</th><th>Note</th><th>Actions</th></tr></thead>
            <tbody className="divide-y">{filteredPayments.map((payment) => <tr key={payment.id}>
              <td className="py-2">{fmtDay(payment.date)}</td><td>{payment.employeeName || payment.employeeCode}</td><td>{payment.type || "—"}</td><td>{payment.status || "—"}</td><td>{formatAriary(payment.amount)}</td><td>{payment.note}</td>
              <td><div className="flex items-center gap-3"><button onClick={() => beginEdit(payment)} className="inline-flex items-center gap-1 text-primary-700"><Pencil className="h-3 w-3" />Éditer</button><button type="button" onClick={() => openArchiveModal(payment.employeeCode, payment)} className="inline-flex items-center gap-1 text-rose-600"><Trash2 className="h-3 w-3" />Supprimer</button></div></td>
            </tr>)}</tbody>
          </table>
          {filteredPayments.length === 0 && <p className="py-3 text-sm text-slate-500">Aucun paiement correspondant aux filtres.</p>}
        </div>
      </Card>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Total gagné" value={formatAriary(displayTotals.earned)} />
        <StatCard label="Total déjà payé" value={formatAriary(displayTotals.paid)} accent="text-green-700" />
        <StatCard label="Total restant à payer" value={formatAriary(displayTotals.due)} accent="text-primary-700" />
      </div>

      {showDeletedHistory && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-slate-900"><Archive className="h-4 w-4 text-primary-600" />Historique des paiements archivés</h2>
              <p className="mt-1 text-xs text-slate-500">Les paiements restent conservés en base avec leur date d’archivage et leur motif.</p>
            </div>
            {deletedPayments && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{deletedPayments.length} archive{deletedPayments.length === 1 ? "" : "s"}</span>}
          </div>
          {loadingDeletedPayments || deletedPayments === null ? (
            <p className="p-5 text-sm text-slate-500">Chargement de l’historique...</p>
          ) : deletedPayments.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">Aucun paiement archivé.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Salarié</th>
                    <th className="px-4 py-3 font-semibold">Paiement</th>
                    <th className="px-4 py-3 font-semibold">Date du paiement</th>
                    <th className="px-4 py-3 font-semibold">Date d’archivage (deleted_at)</th>
                    <th className="px-4 py-3 font-semibold">Motif conservé</th>
                    <th className="px-4 py-3 font-semibold">ID admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deletedPayments.map((payment) => (
                    <tr key={payment.id} className="align-top hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{payment.employeeName}</div>
                        <div className="mt-0.5 text-xs text-slate-500">{payment.employeeCode}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">{formatAriary(payment.amount)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDay(payment.date)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDateTime(payment.deletedAt)}</td>
                      <td className="max-w-xs px-4 py-3 text-slate-600" title={payment.deletionReason}>{payment.deletionReason}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500" title={payment.deletedBy}>{payment.deletedBy.slice(0, 8)}…</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Card>
        {!loading && displayRows.length === 0 && <EmptyState message={paymentFilters.employeeCodes.length ? "Aucun salarié ne correspond à la sélection." : "Aucun salarié."} />}
        <div className="divide-y">
          {displayRows.map((row) => (
            <div key={row.employee.employeeCode} className="py-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-medium text-sm">{row.employee.lastName} {row.employee.firstName}</div>
                  <div className="text-xs text-gray-500">{row.employee.employeeCode}{row.employee.contractType === "CDI" ? ` · CDI · ${formatAriary(row.employee.monthlySalary ?? 0)}/mois` : " · Journalier"}{!row.employee.active && " · inactif"}</div>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <div className="text-right">
                    <div className="text-xs text-gray-400">Gagné</div>
                    <div className="font-medium text-gray-700">{formatAriary(row.earned)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">Payé</div>
                    <div className="font-medium text-green-700">{formatAriary(row.paid)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">Cash restant</div>
                    <div className="font-bold text-primary-700">{formatAriary(row.due)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleHistory(row.employee.employeeCode)}
                    className="text-xs text-gray-500 font-medium"
                  >
                    {openHistoryFor.includes(row.employee.employeeCode) ? "Masquer" : "Historique"}
                  </button>
                  <button
                    onClick={() => openPayModal(row.employee.employeeCode)}
                    disabled={row.due <= 0}
                    className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white text-xs font-medium px-3 py-1.5 rounded-lg"
                  >
                    Payer
                  </button>
                </div>
              </div>

              {openPayFor === row.employee.employeeCode && (
                <form
                  onSubmit={(e) => handlePay(e, row)}
                  className="mt-3 bg-gray-50 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2 items-start"
                >
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Montant (Ar)</label>
                    <input
                      type="number"
                      min={1}
                      max={row.due}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder={`Max ${formatAriary(row.due)}`}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Note (optionnel)</label>
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Ex: avance, acompte..."
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex gap-2 sm:pt-5">
                    <button
                      type="submit"
                      disabled={saving}
                      className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60"
                    >
                      {saving ? "..." : "Confirmer"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenPayFor(null)}
                      className="text-sm text-gray-500 font-medium px-2"
                    >
                      Annuler
                    </button>
                  </div>
                  {error && <div className="sm:col-span-3 text-sm text-red-600">{error}</div>}
                </form>
              )}

              {openHistoryFor.includes(row.employee.employeeCode) && (
                <div className="mt-3 bg-gray-50 rounded-lg p-3">
                  {filteredPayments.filter((payment) => payment.employeeCode === row.employee.employeeCode).length === 0 ? (
                    <div className="text-xs text-gray-500">Aucun paiement correspondant à ces filtres.</div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {filteredPayments.filter((payment) => payment.employeeCode === row.employee.employeeCode).map((p) => (
                        <div key={p.id} className="py-1.5 flex justify-between items-center gap-3 text-xs">
                          <span className="text-gray-500">{fmtDay(p.date)}{p.note ? ` · ${p.note}` : ""}</span>
                          <span className="flex items-center gap-3"><span className="font-medium text-gray-800">{formatAriary(p.amount)}</span><button type="button" onClick={() => openArchiveModal(row.employee.employeeCode,p)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-rose-600 hover:bg-rose-50"><Trash2 className="h-3 w-3"/>Supprimer</button></span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {editPayment && <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 p-4"><form onSubmit={saveEdit} className="w-full max-w-lg rounded-2xl bg-white p-5 space-y-3"><div className="flex justify-between"><h2 className="font-bold">Éditer le paiement</h2><button type="button" onClick={()=>setEditPayment(null)}><X className="w-4 h-4"/></button></div><label className="block text-sm">Montant<input required type="number" min="1" value={editForm.amount} onChange={e=>setEditForm({...editForm,amount:e.target.value})} className="mt-1 w-full border rounded-lg p-2"/></label><label className="block text-sm">Note<textarea value={editForm.note} onChange={e=>setEditForm({...editForm,note:e.target.value})} className="mt-1 w-full border rounded-lg p-2"/></label><label className="block text-sm">Type<input value={editForm.type} onChange={e=>setEditForm({...editForm,type:e.target.value})} className="mt-1 w-full border rounded-lg p-2"/></label><label className="block text-sm">Statut<select value={editForm.status} onChange={e=>setEditForm({...editForm,status:e.target.value as PaymentStatus})} className="mt-1 w-full border rounded-lg p-2"><option value="PAYE">PAYE</option><option value="EN_ATTENTE">EN_ATTENTE</option><option value="ANNULE">ANNULE</option></select></label><label className="block text-sm">Chantier<select value={editForm.siteId} onChange={e=>setEditForm({...editForm,siteId:e.target.value})} className="mt-1 w-full border rounded-lg p-2"><option value="">Aucun</option>{sites.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>{error&&<p className="text-sm text-rose-600">{error}</p>}<button disabled={saving} className="w-full rounded-xl bg-primary-600 text-white py-2">{saving?"Enregistrement...":"Enregistrer"}</button></form></div>}
      {archiveTarget && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => { if (event.target === event.currentTarget && !archiving) setArchiveTarget(null) }}>
          <form onSubmit={handleArchivePayment} className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600"><Archive className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Supprimer ce paiement ?</h2>
                  <p className="mt-1 text-sm text-slate-500">Le paiement sera retiré de la liste active, mais conservé dans les archives d’audit.</p>
                </div>
              </div>
              <button type="button" onClick={() => setArchiveTarget(null)} disabled={archiving} aria-label="Fermer"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X className="h-4 w-4" /></button>
            </header>

            <div className="space-y-4 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{archiveTarget.employeeCode}</div>
                  <div className="mt-1 text-sm text-slate-700">Paiement du {fmtDay(archiveTarget.payment.date)}</div>
                  {archiveTarget.payment.note && <div className="mt-1 truncate text-xs text-slate-500">{archiveTarget.payment.note}</div>}
                </div>
                <div className="shrink-0 text-right text-lg font-bold text-slate-900">{formatAriary(archiveTarget.payment.amount)}</div>
              </div>

              <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Il s’agit d’une suppression logique : le paiement sera retiré de l’historique actif, mais conservé avec <strong>deleted_at</strong>, l’administrateur et le motif. Le total payé et le reste à payer seront recalculés.</p>
              </div>

              <div>
                <label htmlFor="payment-archive-reason" className="mb-1.5 block text-sm font-semibold text-slate-800">Motif obligatoire</label>
                <textarea id="payment-archive-reason" autoFocus required rows={3} maxLength={500} value={archiveReason}
                  onChange={(event) => { setArchiveReason(event.target.value); if (archiveError) setArchiveError(null) }}
                  placeholder="Expliquez pourquoi ce paiement doit être supprimé..."
                  className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:bg-slate-50" disabled={archiving} />
                <div className="mt-1 flex justify-between gap-3 text-xs text-slate-500">
                  <span>Ce motif sera conservé dans l’audit et l’historique des archives.</span>
                  <span>{archiveReason.length}/500</span>
                </div>
                {archiveError && <p role="alert" className="mt-2 text-sm font-medium text-rose-600">{archiveError}</p>}
              </div>
            </div>

            <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 p-4 sm:flex-row sm:justify-end sm:px-6">
              <button type="button" onClick={() => setArchiveTarget(null)} disabled={archiving}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Annuler</button>
              <button type="submit" disabled={archiving || !archiveReason.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">
                <Trash2 className="h-4 w-4" />{archiving ? "Suppression..." : "Confirmer la suppression"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {toast && <Toast message={toast.msg} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  )
}

// // src/pages/admin/Salaries.tsx
// import { useEffect, useState } from "react"
// import { getSalarySummary, type SalarySummaryRow } from "../../services/salary"
// import { createPayment, listPayments, updatePayment, listDeletedPayments, softDeletePayment, type DeletedPayment, type Payment, type PaymentStatus } from "../../services/payments"
// import { errorMessage } from "../../services/api"
// import { formatAriary } from "../../utils/salaryCalculator"
// import { fmtDateTime, fmtDay } from "../../utils/format"
// import Card from "../../components/Card"
// import { StatCard } from "../../components/Card"
// import EmptyState from "../../components/EmptyState"
// import Toast from "../../components/Toast"
// import { AlertTriangle, Archive, History, X, Pencil } from "lucide-react"
// import { listEmployees, employeeName, type Employee } from "../../services/employees"
// import { listSites, type Site } from "../../services/sites"

// // earned = total gagné, paid = total déjà payé, due = reste à payer (calculés par le serveur)
// type Row = SalarySummaryRow

// export default function AdminSalaries() {
//   const [rows, setRows] = useState<Row[]>([])
//   const [totals, setTotals] = useState({ earned: 0, paid: 0, due: 0 })
//   const [payments, setPayments] = useState<Record<string, Payment[]>>({})
//   const [loading, setLoading] = useState(true)
//   const [employees, setEmployees] = useState<Employee[]>([])
//   const [sites, setSites] = useState<Site[]>([])
//   const [paymentFilters, setPaymentFilters] = useState({ employeeCode: "", from: "", to: "", type: "", status: "", siteId: "" })
//   const [filteredPayments, setFilteredPayments] = useState<Payment[]>([])
//   const [editPayment, setEditPayment] = useState<Payment | null>(null)
//   const [editForm, setEditForm] = useState({ amount: "", note: "", type: "", status: "EN_ATTENTE" as PaymentStatus, siteId: "" })
//   const [openPayFor, setOpenPayFor] = useState<string | null>(null) // employee.id
//   const [openHistoryFor, setOpenHistoryFor] = useState<string | null>(null)
//   const [amount, setAmount] = useState("")
//   const [note, setNote] = useState("")
//   const [saving, setSaving] = useState(false)
//   const [error, setError] = useState<string | null>(null)
//   const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null)
//   const [archiveTarget, setArchiveTarget] = useState<{ employeeCode: string; payment: Payment } | null>(null)
//   const [archiveReason, setArchiveReason] = useState("")
//   const [archiveError, setArchiveError] = useState<string | null>(null)
//   const [archiving, setArchiving] = useState(false)
//   const [showDeletedHistory, setShowDeletedHistory] = useState(false)
//   const [deletedPayments, setDeletedPayments] = useState<DeletedPayment[] | null>(null)
//   const [loadingDeletedPayments, setLoadingDeletedPayments] = useState(false)

//   async function refresh() {
//     setLoading(true)
//     try {
//       const summary = await getSalarySummary()
//       setRows(summary.rows)
//       setTotals(summary.totals)
//     } catch (e) {
//       setToast({ msg: errorMessage(e, "Impossible de charger les rémunérations."), tone: "error" })
//     } finally {
//       setLoading(false)
//     }
//   }

//   useEffect(() => { refresh(); listEmployees().then(setEmployees).catch(()=>{}); listSites().then(setSites).catch(()=>{}) }, [])
//   useEffect(() => { listPayments({ employeeCode: paymentFilters.employeeCode || undefined, from: paymentFilters.from || undefined, to: paymentFilters.to || undefined, type: paymentFilters.type || undefined, status: (paymentFilters.status || undefined) as PaymentStatus | undefined, siteId: paymentFilters.siteId || undefined }).then(setFilteredPayments).catch(e=>setToast({msg:errorMessage(e,"Impossible de filtrer les paiements."),tone:"error"})) }, [paymentFilters])
//   function beginEdit(p: Payment) { setEditPayment(p); setEditForm({amount:String(p.amount),note:p.note || "",type:p.type || "",status:p.status || "EN_ATTENTE",siteId:p.siteId || ""}) }
//   async function saveEdit(e: React.FormEvent) { e.preventDefault(); if(!editPayment) return; setSaving(true); try { await updatePayment(editPayment.id,{amount:Number(editForm.amount),note:editForm.note,type:editForm.type,status:editForm.status,siteId:editForm.siteId || null}); setEditPayment(null); setToast({msg:"Paiement mis à jour.",tone:"success"}); const list=await listPayments({employeeCode:paymentFilters.employeeCode || undefined,from:paymentFilters.from || undefined,to:paymentFilters.to || undefined,type:paymentFilters.type || undefined,status:(paymentFilters.status||undefined) as PaymentStatus|undefined,siteId:paymentFilters.siteId||undefined}); setFilteredPayments(list); await refresh() } catch(e){setError(errorMessage(e,"Modification impossible."))} finally{setSaving(false)} }


//   async function toggleHistory(code: string) {
//     if (openHistoryFor === code) { setOpenHistoryFor(null); return }
//     setOpenHistoryFor(code)
//     try {
//       const list = await listPayments(code)
//       setPayments((prev) => ({ ...prev, [code]: list }))
//     } catch (e) {
//       setToast({ msg: errorMessage(e, "Impossible de charger l'historique."), tone: "error" })
//     }
//   }

//   function openPayModal(code: string) {
//     setOpenPayFor(code)
//     setAmount("")
//     setNote("")
//     setError(null)
//   }

//   function openArchiveModal(employeeCode: string, payment: Payment) {
//     setArchiveTarget({ employeeCode, payment })
//     setArchiveReason("")
//     setArchiveError(null)
//   }

//   async function loadDeletedPayments() {
//     setLoadingDeletedPayments(true)
//     try { setDeletedPayments(await listDeletedPayments()) }
//     catch (e) { setToast({ msg: errorMessage(e, "Impossible de charger l’historique des paiements archivés."), tone: "error" }) }
//     finally { setLoadingDeletedPayments(false) }
//   }

//   async function toggleDeletedHistory() {
//     const next = !showDeletedHistory
//     setShowDeletedHistory(next)
//     if (next && deletedPayments === null) await loadDeletedPayments()
//   }

//   async function handleArchivePayment(event: React.FormEvent) {
//     event.preventDefault()
//     if (!archiveTarget) return
//     const reason = archiveReason.trim()
//     if (!reason) {
//       setArchiveError("Le motif est obligatoire pour archiver ce paiement.")
//       return
//     }
//     setArchiving(true)
//     setArchiveError(null)
//     try {
//       await softDeletePayment(archiveTarget.payment.id, reason)
//       setPayments((prev) => ({
//         ...prev,
//         [archiveTarget.employeeCode]: (prev[archiveTarget.employeeCode] || []).filter((payment) => payment.id !== archiveTarget.payment.id),
//       }))
//       await refresh()
//       if (deletedPayments !== null || showDeletedHistory) await loadDeletedPayments()
//       setArchiveTarget(null)
//       setArchiveReason("")
//       setToast({ msg: "Paiement archivé avec motif conservé dans l’audit.", tone: "success" })
//     } catch (e) {
//       setArchiveError(errorMessage(e, "Impossible d’archiver ce paiement."))
//     } finally { setArchiving(false) }
//   }
//   async function handlePay(e: React.FormEvent, row: Row) {
//     e.preventDefault()
//     setError(null)
//     const value = Number(amount)
//     if (!value || value <= 0) {
//       setError("Entrez un montant valide.")
//       return
//     }
//     if (value > row.due) {
//       setError(`Ce montant dépasse le reste à payer (${formatAriary(row.due)}).`)
//       return
//     }
//     setSaving(true)
//     try {
//       // Le serveur revérifie que le montant ne dépasse pas le reste à payer et journalise le paiement.
//       await createPayment(row.employee.employeeCode, Math.round(value), note)
//       setOpenPayFor(null)
//       setPayments((prev) => { const next = { ...prev }; delete next[row.employee.employeeCode]; return next })
//       if (openHistoryFor === row.employee.employeeCode) setOpenHistoryFor(null)
//       setToast({ msg: `${formatAriary(value)} payé à ${row.employee.firstName} ${row.employee.lastName}.`, tone: "success" })
//       refresh()
//     } catch (err) {
//       setError(errorMessage(err, "Le paiement n'a pas pu être enregistré."))
//     } finally {
//       setSaving(false)
//     }
//   }

//   return (
//     <div className="space-y-4">
//       <div className="flex flex-wrap items-center justify-between gap-3">
//         <h1 className="text-xl font-bold">Rémunérations</h1>
//         <button type="button" onClick={() => void toggleDeletedHistory()}
//           className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${showDeletedHistory ? "border-primary-200 bg-primary-50 text-primary-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
//           <History className="h-4 w-4" />{showDeletedHistory ? "Masquer les archives" : "Paiements archivés"}
//         </button>
//       </div>

//       <Card className="space-y-3"><h2 className="font-semibold">Filtrer les paiements</h2><div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-2"><select value={paymentFilters.employeeCode} onChange={e=>setPaymentFilters({...paymentFilters,employeeCode:e.target.value})} className="border rounded-lg px-3 py-2 text-sm"><option value="">Tous les salariés</option>{employees.map(e=><option key={e.employeeCode} value={e.employeeCode}>{employeeName(e)}</option>)}</select><input aria-label="Du" type="date" value={paymentFilters.from} onChange={e=>setPaymentFilters({...paymentFilters,from:e.target.value})} className="border rounded-lg px-3 py-2 text-sm"/><input aria-label="Au" type="date" value={paymentFilters.to} onChange={e=>setPaymentFilters({...paymentFilters,to:e.target.value})} className="border rounded-lg px-3 py-2 text-sm"/><input placeholder="Type libre" value={paymentFilters.type} onChange={e=>setPaymentFilters({...paymentFilters,type:e.target.value})} className="border rounded-lg px-3 py-2 text-sm"/><select value={paymentFilters.status} onChange={e=>setPaymentFilters({...paymentFilters,status:e.target.value})} className="border rounded-lg px-3 py-2 text-sm"><option value="">Tous statuts</option><option value="PAYE">PAYE</option><option value="EN_ATTENTE">EN_ATTENTE</option><option value="ANNULE">ANNULE</option></select><select value={paymentFilters.siteId} onChange={e=>setPaymentFilters({...paymentFilters,siteId:e.target.value})} className="border rounded-lg px-3 py-2 text-sm"><option value="">Tous chantiers</option>{sites.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div><button onClick={()=>setPaymentFilters({employeeCode:"",from:"",to:"",type:"",status:"",siteId:""})} className="text-xs text-primary-700">Réinitialiser</button><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="text-left text-slate-500"><th>Date</th><th>Salarié</th><th>Type</th><th>Statut</th><th>Montant</th><th>Note</th><th></th></tr></thead><tbody className="divide-y">{filteredPayments.map(p=><tr key={p.id}><td className="py-2">{fmtDay(p.date)}</td><td>{p.employeeName || p.employeeCode}</td><td>{p.type || "—"}</td><td>{p.status || "—"}</td><td>{formatAriary(p.amount)}</td><td>{p.note}</td><td><button onClick={()=>beginEdit(p)} className="inline-flex items-center gap-1 text-primary-700"><Pencil className="w-3 h-3"/>Éditer</button></td></tr>)}</tbody></table>{filteredPayments.length===0&&<p className="py-3 text-sm text-slate-500">Aucun paiement correspondant.</p>}</div></Card>
//       <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
//         <StatCard label="Total gagné" value={formatAriary(totals.earned)} />
//         <StatCard label="Total déjà payé" value={formatAriary(totals.paid)} accent="text-green-700" />
//         <StatCard label="Total restant à payer" value={formatAriary(totals.due)} accent="text-primary-700" />
//       </div>

//       {showDeletedHistory && (
//         <Card className="overflow-hidden">
//           <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
//             <div>
//               <h2 className="flex items-center gap-2 font-semibold text-slate-900"><Archive className="h-4 w-4 text-primary-600" />Historique des paiements archivés</h2>
//               <p className="mt-1 text-xs text-slate-500">Les paiements restent conservés en base avec leur date d’archivage et leur motif.</p>
//             </div>
//             {deletedPayments && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{deletedPayments.length} archive{deletedPayments.length === 1 ? "" : "s"}</span>}
//           </div>
//           {loadingDeletedPayments || deletedPayments === null ? (
//             <p className="p-5 text-sm text-slate-500">Chargement de l’historique...</p>
//           ) : deletedPayments.length === 0 ? (
//             <p className="p-5 text-sm text-slate-500">Aucun paiement archivé.</p>
//           ) : (
//             <div className="overflow-x-auto">
//               <table className="w-full min-w-[980px] text-left text-sm">
//                 <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
//                   <tr>
//                     <th className="px-4 py-3 font-semibold">Salarié</th>
//                     <th className="px-4 py-3 font-semibold">Paiement</th>
//                     <th className="px-4 py-3 font-semibold">Date du paiement</th>
//                     <th className="px-4 py-3 font-semibold">Date d’archivage (deleted_at)</th>
//                     <th className="px-4 py-3 font-semibold">Motif conservé</th>
//                     <th className="px-4 py-3 font-semibold">ID admin</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-slate-100">
//                   {deletedPayments.map((payment) => (
//                     <tr key={payment.id} className="align-top hover:bg-slate-50/70">
//                       <td className="px-4 py-3">
//                         <div className="font-medium text-slate-800">{payment.employeeName}</div>
//                         <div className="mt-0.5 text-xs text-slate-500">{payment.employeeCode}</div>
//                       </td>
//                       <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">{formatAriary(payment.amount)}</td>
//                       <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDay(payment.date)}</td>
//                       <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDateTime(payment.deletedAt)}</td>
//                       <td className="max-w-xs px-4 py-3 text-slate-600" title={payment.deletionReason}>{payment.deletionReason}</td>
//                       <td className="px-4 py-3 font-mono text-xs text-slate-500" title={payment.deletedBy}>{payment.deletedBy.slice(0, 8)}…</td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           )}
//         </Card>
//       )}

//       <Card>
//         {!loading && rows.length === 0 && <EmptyState message="Aucun salarié." />}
//         <div className="divide-y">
//           {rows.map((row) => (
//             <div key={row.employee.employeeCode} className="py-3">
//               <div className="flex items-center justify-between gap-3 flex-wrap">
//                 <div>
//                   <div className="font-medium text-sm">{row.employee.lastName} {row.employee.firstName}</div>
//                   <div className="text-xs text-gray-500">{row.employee.employeeCode}{row.employee.contractType === "CDI" ? ` · CDI · ${formatAriary(row.employee.monthlySalary ?? 0)}/mois` : " · Journalier"}{!row.employee.active && " · inactif"}</div>
//                 </div>

//                 <div className="flex items-center gap-4 text-sm">
//                   <div className="text-right">
//                     <div className="text-xs text-gray-400">Gagné</div>
//                     <div className="font-medium text-gray-700">{formatAriary(row.earned)}</div>
//                   </div>
//                   <div className="text-right">
//                     <div className="text-xs text-gray-400">Payé</div>
//                     <div className="font-medium text-green-700">{formatAriary(row.paid)}</div>
//                   </div>
//                   <div className="text-right">
//                     <div className="text-xs text-gray-400">Cash restant</div>
//                     <div className="font-bold text-primary-700">{formatAriary(row.due)}</div>
//                   </div>
//                 </div>

//                 <div className="flex items-center gap-2">
//                   <button
//                     onClick={() => toggleHistory(row.employee.employeeCode)}
//                     className="text-xs text-gray-500 font-medium"
//                   >
//                     {openHistoryFor === row.employee.employeeCode ? "Masquer" : "Historique"}
//                   </button>
//                   <button
//                     onClick={() => openPayModal(row.employee.employeeCode)}
//                     disabled={row.due <= 0}
//                     className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white text-xs font-medium px-3 py-1.5 rounded-lg"
//                   >
//                     Payer
//                   </button>
//                 </div>
//               </div>

//               {openPayFor === row.employee.employeeCode && (
//                 <form
//                   onSubmit={(e) => handlePay(e, row)}
//                   className="mt-3 bg-gray-50 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2 items-start"
//                 >
//                   <div>
//                     <label className="block text-xs text-gray-500 mb-1">Montant (Ar)</label>
//                     <input
//                       type="number"
//                       min={1}
//                       max={row.due}
//                       value={amount}
//                       onChange={(e) => setAmount(e.target.value)}
//                       placeholder={`Max ${formatAriary(row.due)}`}
//                       className="w-full border rounded-lg px-3 py-2 text-sm"
//                       required
//                       autoFocus
//                     />
//                   </div>
//                   <div>
//                     <label className="block text-xs text-gray-500 mb-1">Note (optionnel)</label>
//                     <input
//                       value={note}
//                       onChange={(e) => setNote(e.target.value)}
//                       placeholder="Ex: avance, acompte..."
//                       className="w-full border rounded-lg px-3 py-2 text-sm"
//                     />
//                   </div>
//                   <div className="flex gap-2 sm:pt-5">
//                     <button
//                       type="submit"
//                       disabled={saving}
//                       className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60"
//                     >
//                       {saving ? "..." : "Confirmer"}
//                     </button>
//                     <button
//                       type="button"
//                       onClick={() => setOpenPayFor(null)}
//                       className="text-sm text-gray-500 font-medium px-2"
//                     >
//                       Annuler
//                     </button>
//                   </div>
//                   {error && <div className="sm:col-span-3 text-sm text-red-600">{error}</div>}
//                 </form>
//               )}

//               {openHistoryFor === row.employee.employeeCode && (
//                 <div className="mt-3 bg-gray-50 rounded-lg p-3">
//                   {!payments[row.employee.employeeCode] ? (
//                     <div className="text-xs text-gray-500">Chargement...</div>
//                   ) : payments[row.employee.employeeCode].length === 0 ? (
//                     <div className="text-xs text-gray-500">Aucun paiement enregistré.</div>
//                   ) : (
//                     <div className="divide-y divide-gray-200">
//                       {payments[row.employee.employeeCode].map((p) => (
//                         <div key={p.id} className="py-1.5 flex justify-between items-center gap-3 text-xs">
//                           <span className="text-gray-500">{fmtDay(p.date)}{p.note ? ` · ${p.note}` : ""}</span>
//                           <span className="flex items-center gap-3"><span className="font-medium text-gray-800">{formatAriary(p.amount)}</span><button type="button" onClick={() => openArchiveModal(row.employee.employeeCode,p)} className="rounded-md px-2 py-1 font-semibold text-rose-600 hover:bg-rose-50">Archiver</button></span>
//                         </div>
//                       ))}
//                     </div>
//                   )}
//                 </div>
//               )}
//             </div>
//           ))}
//         </div>
//       </Card>

//       {editPayment && <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 p-4"><form onSubmit={saveEdit} className="w-full max-w-lg rounded-2xl bg-white p-5 space-y-3"><div className="flex justify-between"><h2 className="font-bold">Éditer le paiement</h2><button type="button" onClick={()=>setEditPayment(null)}><X className="w-4 h-4"/></button></div><label className="block text-sm">Montant<input required type="number" min="1" value={editForm.amount} onChange={e=>setEditForm({...editForm,amount:e.target.value})} className="mt-1 w-full border rounded-lg p-2"/></label><label className="block text-sm">Note<textarea value={editForm.note} onChange={e=>setEditForm({...editForm,note:e.target.value})} className="mt-1 w-full border rounded-lg p-2"/></label><label className="block text-sm">Type<input value={editForm.type} onChange={e=>setEditForm({...editForm,type:e.target.value})} className="mt-1 w-full border rounded-lg p-2"/></label><label className="block text-sm">Statut<select value={editForm.status} onChange={e=>setEditForm({...editForm,status:e.target.value as PaymentStatus})} className="mt-1 w-full border rounded-lg p-2"><option value="PAYE">PAYE</option><option value="EN_ATTENTE">EN_ATTENTE</option><option value="ANNULE">ANNULE</option></select></label><label className="block text-sm">Chantier<select value={editForm.siteId} onChange={e=>setEditForm({...editForm,siteId:e.target.value})} className="mt-1 w-full border rounded-lg p-2"><option value="">Aucun</option>{sites.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>{error&&<p className="text-sm text-rose-600">{error}</p>}<button disabled={saving} className="w-full rounded-xl bg-primary-600 text-white py-2">{saving?"Enregistrement...":"Enregistrer"}</button></form></div>}
//       {archiveTarget && (
//         <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
//           onMouseDown={(event) => { if (event.target === event.currentTarget && !archiving) setArchiveTarget(null) }}>
//           <form onSubmit={handleArchivePayment} className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
//             <header className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
//               <div className="flex items-start gap-3">
//                 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600"><Archive className="h-5 w-5" /></div>
//                 <div>
//                   <h2 className="text-lg font-bold text-slate-900">Archiver ce paiement ?</h2>
//                   <p className="mt-1 text-sm text-slate-500">L’enregistrement sera conservé dans l’historique d’audit.</p>
//                 </div>
//               </div>
//               <button type="button" onClick={() => setArchiveTarget(null)} disabled={archiving} aria-label="Fermer"
//                 className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X className="h-4 w-4" /></button>
//             </header>

//             <div className="space-y-4 p-5 sm:p-6">
//               <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
//                 <div className="min-w-0">
//                   <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{archiveTarget.employeeCode}</div>
//                   <div className="mt-1 text-sm text-slate-700">Paiement du {fmtDay(archiveTarget.payment.date)}</div>
//                   {archiveTarget.payment.note && <div className="mt-1 truncate text-xs text-slate-500">{archiveTarget.payment.note}</div>}
//                 </div>
//                 <div className="shrink-0 text-right text-lg font-bold text-slate-900">{formatAriary(archiveTarget.payment.amount)}</div>
//               </div>

//               <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
//                 <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
//                 <p>Le paiement sera masqué de l’historique actif. Il restera conservé avec <strong>deleted_at</strong>, l’administrateur et le motif ; le total payé et le reste à payer seront recalculés.</p>
//               </div>

//               <div>
//                 <label htmlFor="payment-archive-reason" className="mb-1.5 block text-sm font-semibold text-slate-800">Motif obligatoire</label>
//                 <textarea id="payment-archive-reason" autoFocus required rows={3} maxLength={500} value={archiveReason}
//                   onChange={(event) => { setArchiveReason(event.target.value); if (archiveError) setArchiveError(null) }}
//                   placeholder="Expliquez pourquoi ce paiement doit être archivé..."
//                   className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:bg-slate-50" disabled={archiving} />
//                 <div className="mt-1 flex justify-between gap-3 text-xs text-slate-500">
//                   <span>Ce motif sera conservé dans l’audit et l’historique des archives.</span>
//                   <span>{archiveReason.length}/500</span>
//                 </div>
//                 {archiveError && <p role="alert" className="mt-2 text-sm font-medium text-rose-600">{archiveError}</p>}
//               </div>
//             </div>

//             <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 p-4 sm:flex-row sm:justify-end sm:px-6">
//               <button type="button" onClick={() => setArchiveTarget(null)} disabled={archiving}
//                 className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Annuler</button>
//               <button type="submit" disabled={archiving || !archiveReason.trim()}
//                 className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">
//                 <Archive className="h-4 w-4" />{archiving ? "Archivage..." : "Archiver avec motif"}
//               </button>
//             </footer>
//           </form>
//         </div>
//       )}

//       {toast && <Toast message={toast.msg} tone={toast.tone} onClose={() => setToast(null)} />}
//     </div>
//   )
// }

// // // src/pages/admin/Salaries.tsx
// // import { useEffect, useState } from "react"
// // import { getSalarySummary, type SalarySummaryRow } from "../../services/salary"
// // import { createPayment, listPayments, listDeletedPayments, softDeletePayment, type DeletedPayment, type Payment } from "../../services/payments"
// // import { errorMessage } from "../../services/api"
// // import { formatAriary } from "../../utils/salaryCalculator"
// // import { fmtDateTime, fmtDay } from "../../utils/format"
// // import Card from "../../components/Card"
// // import { StatCard } from "../../components/Card"
// // import EmptyState from "../../components/EmptyState"
// // import Toast from "../../components/Toast"
// // import { AlertTriangle, Archive, History, X } from "lucide-react"

// // // earned = total gagné, paid = total déjà payé, due = reste à payer (calculés par le serveur)
// // type Row = SalarySummaryRow

// // export default function AdminSalaries() {
// //   const [rows, setRows] = useState<Row[]>([])
// //   const [totals, setTotals] = useState({ earned: 0, paid: 0, due: 0 })
// //   const [payments, setPayments] = useState<Record<string, Payment[]>>({})
// //   const [loading, setLoading] = useState(true)
// //   const [openPayFor, setOpenPayFor] = useState<string | null>(null) // employee.id
// //   const [openHistoryFor, setOpenHistoryFor] = useState<string | null>(null)
// //   const [amount, setAmount] = useState("")
// //   const [note, setNote] = useState("")
// //   const [saving, setSaving] = useState(false)
// //   const [error, setError] = useState<string | null>(null)
// //   const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null)
// //   const [archiveTarget, setArchiveTarget] = useState<{ employeeCode: string; payment: Payment } | null>(null)
// //   const [archiveReason, setArchiveReason] = useState("")
// //   const [archiveError, setArchiveError] = useState<string | null>(null)
// //   const [archiving, setArchiving] = useState(false)
// //   const [showDeletedHistory, setShowDeletedHistory] = useState(false)
// //   const [deletedPayments, setDeletedPayments] = useState<DeletedPayment[] | null>(null)
// //   const [loadingDeletedPayments, setLoadingDeletedPayments] = useState(false)

// //   async function refresh() {
// //     setLoading(true)
// //     try {
// //       const summary = await getSalarySummary()
// //       setRows(summary.rows)
// //       setTotals(summary.totals)
// //     } catch (e) {
// //       setToast({ msg: errorMessage(e, "Impossible de charger les rémunérations."), tone: "error" })
// //     } finally {
// //       setLoading(false)
// //     }
// //   }

// //   useEffect(() => { refresh() }, [])

// //   async function toggleHistory(code: string) {
// //     if (openHistoryFor === code) { setOpenHistoryFor(null); return }
// //     setOpenHistoryFor(code)
// //     try {
// //       const list = await listPayments(code)
// //       setPayments((prev) => ({ ...prev, [code]: list }))
// //     } catch (e) {
// //       setToast({ msg: errorMessage(e, "Impossible de charger l'historique."), tone: "error" })
// //     }
// //   }

// //   function openPayModal(code: string) {
// //     setOpenPayFor(code)
// //     setAmount("")
// //     setNote("")
// //     setError(null)
// //   }

// //   function openArchiveModal(employeeCode: string, payment: Payment) {
// //     setArchiveTarget({ employeeCode, payment })
// //     setArchiveReason("")
// //     setArchiveError(null)
// //   }

// //   async function loadDeletedPayments() {
// //     setLoadingDeletedPayments(true)
// //     try { setDeletedPayments(await listDeletedPayments()) }
// //     catch (e) { setToast({ msg: errorMessage(e, "Impossible de charger l’historique des paiements archivés."), tone: "error" }) }
// //     finally { setLoadingDeletedPayments(false) }
// //   }

// //   async function toggleDeletedHistory() {
// //     const next = !showDeletedHistory
// //     setShowDeletedHistory(next)
// //     if (next && deletedPayments === null) await loadDeletedPayments()
// //   }

// //   async function handleArchivePayment(event: React.FormEvent) {
// //     event.preventDefault()
// //     if (!archiveTarget) return
// //     const reason = archiveReason.trim()
// //     if (!reason) {
// //       setArchiveError("Le motif est obligatoire pour archiver ce paiement.")
// //       return
// //     }
// //     setArchiving(true)
// //     setArchiveError(null)
// //     try {
// //       await softDeletePayment(archiveTarget.payment.id, reason)
// //       setPayments((prev) => ({
// //         ...prev,
// //         [archiveTarget.employeeCode]: (prev[archiveTarget.employeeCode] || []).filter((payment) => payment.id !== archiveTarget.payment.id),
// //       }))
// //       await refresh()
// //       if (deletedPayments !== null || showDeletedHistory) await loadDeletedPayments()
// //       setArchiveTarget(null)
// //       setArchiveReason("")
// //       setToast({ msg: "Paiement archivé avec motif conservé dans l’audit.", tone: "success" })
// //     } catch (e) {
// //       setArchiveError(errorMessage(e, "Impossible d’archiver ce paiement."))
// //     } finally { setArchiving(false) }
// //   }
// //   async function handlePay(e: React.FormEvent, row: Row) {
// //     e.preventDefault()
// //     setError(null)
// //     const value = Number(amount)
// //     if (!value || value <= 0) {
// //       setError("Entrez un montant valide.")
// //       return
// //     }
// //     if (value > row.due) {
// //       setError(`Ce montant dépasse le reste à payer (${formatAriary(row.due)}).`)
// //       return
// //     }
// //     setSaving(true)
// //     try {
// //       // Le serveur revérifie que le montant ne dépasse pas le reste à payer et journalise le paiement.
// //       await createPayment(row.employee.employeeCode, Math.round(value), note)
// //       setOpenPayFor(null)
// //       setPayments((prev) => { const next = { ...prev }; delete next[row.employee.employeeCode]; return next })
// //       if (openHistoryFor === row.employee.employeeCode) setOpenHistoryFor(null)
// //       setToast({ msg: `${formatAriary(value)} payé à ${row.employee.firstName} ${row.employee.lastName}.`, tone: "success" })
// //       refresh()
// //     } catch (err) {
// //       setError(errorMessage(err, "Le paiement n'a pas pu être enregistré."))
// //     } finally {
// //       setSaving(false)
// //     }
// //   }

// //   return (
// //     <div className="space-y-4">
// //       <div className="flex flex-wrap items-center justify-between gap-3">
// //         <h1 className="text-xl font-bold">Rémunérations</h1>
// //         <button type="button" onClick={() => void toggleDeletedHistory()}
// //           className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${showDeletedHistory ? "border-primary-200 bg-primary-50 text-primary-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
// //           <History className="h-4 w-4" />{showDeletedHistory ? "Masquer les archives" : "Paiements archivés"}
// //         </button>
// //       </div>

// //       <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
// //         <StatCard label="Total gagné" value={formatAriary(totals.earned)} />
// //         <StatCard label="Total déjà payé" value={formatAriary(totals.paid)} accent="text-green-700" />
// //         <StatCard label="Total restant à payer" value={formatAriary(totals.due)} accent="text-primary-700" />
// //       </div>

// //       {showDeletedHistory && (
// //         <Card className="overflow-hidden">
// //           <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
// //             <div>
// //               <h2 className="flex items-center gap-2 font-semibold text-slate-900"><Archive className="h-4 w-4 text-primary-600" />Historique des paiements archivés</h2>
// //               <p className="mt-1 text-xs text-slate-500">Les paiements restent conservés en base avec leur date d’archivage et leur motif.</p>
// //             </div>
// //             {deletedPayments && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{deletedPayments.length} archive{deletedPayments.length === 1 ? "" : "s"}</span>}
// //           </div>
// //           {loadingDeletedPayments || deletedPayments === null ? (
// //             <p className="p-5 text-sm text-slate-500">Chargement de l’historique...</p>
// //           ) : deletedPayments.length === 0 ? (
// //             <p className="p-5 text-sm text-slate-500">Aucun paiement archivé.</p>
// //           ) : (
// //             <div className="overflow-x-auto">
// //               <table className="w-full min-w-[980px] text-left text-sm">
// //                 <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
// //                   <tr>
// //                     <th className="px-4 py-3 font-semibold">Salarié</th>
// //                     <th className="px-4 py-3 font-semibold">Paiement</th>
// //                     <th className="px-4 py-3 font-semibold">Date du paiement</th>
// //                     <th className="px-4 py-3 font-semibold">Date d’archivage (deleted_at)</th>
// //                     <th className="px-4 py-3 font-semibold">Motif conservé</th>
// //                     <th className="px-4 py-3 font-semibold">ID admin</th>
// //                   </tr>
// //                 </thead>
// //                 <tbody className="divide-y divide-slate-100">
// //                   {deletedPayments.map((payment) => (
// //                     <tr key={payment.id} className="align-top hover:bg-slate-50/70">
// //                       <td className="px-4 py-3">
// //                         <div className="font-medium text-slate-800">{payment.employeeName}</div>
// //                         <div className="mt-0.5 text-xs text-slate-500">{payment.employeeCode}</div>
// //                       </td>
// //                       <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">{formatAriary(payment.amount)}</td>
// //                       <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDay(payment.date)}</td>
// //                       <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDateTime(payment.deletedAt)}</td>
// //                       <td className="max-w-xs px-4 py-3 text-slate-600" title={payment.deletionReason}>{payment.deletionReason}</td>
// //                       <td className="px-4 py-3 font-mono text-xs text-slate-500" title={payment.deletedBy}>{payment.deletedBy.slice(0, 8)}…</td>
// //                     </tr>
// //                   ))}
// //                 </tbody>
// //               </table>
// //             </div>
// //           )}
// //         </Card>
// //       )}

// //       <Card>
// //         {!loading && rows.length === 0 && <EmptyState message="Aucun salarié." />}
// //         <div className="divide-y">
// //           {rows.map((row) => (
// //             <div key={row.employee.employeeCode} className="py-3">
// //               <div className="flex items-center justify-between gap-3 flex-wrap">
// //                 <div>
// //                   <div className="font-medium text-sm">{row.employee.lastName} {row.employee.firstName}</div>
// //                   <div className="text-xs text-gray-500">{row.employee.employeeCode}{row.employee.contractType === "CDI" ? ` · CDI · ${formatAriary(row.employee.monthlySalary ?? 0)}/mois` : " · Journalier"}{!row.employee.active && " · inactif"}</div>
// //                 </div>

// //                 <div className="flex items-center gap-4 text-sm">
// //                   <div className="text-right">
// //                     <div className="text-xs text-gray-400">Gagné</div>
// //                     <div className="font-medium text-gray-700">{formatAriary(row.earned)}</div>
// //                   </div>
// //                   <div className="text-right">
// //                     <div className="text-xs text-gray-400">Payé</div>
// //                     <div className="font-medium text-green-700">{formatAriary(row.paid)}</div>
// //                   </div>
// //                   <div className="text-right">
// //                     <div className="text-xs text-gray-400">Cash restant</div>
// //                     <div className="font-bold text-primary-700">{formatAriary(row.due)}</div>
// //                   </div>
// //                 </div>

// //                 <div className="flex items-center gap-2">
// //                   <button
// //                     onClick={() => toggleHistory(row.employee.employeeCode)}
// //                     className="text-xs text-gray-500 font-medium"
// //                   >
// //                     {openHistoryFor === row.employee.employeeCode ? "Masquer" : "Historique"}
// //                   </button>
// //                   <button
// //                     onClick={() => openPayModal(row.employee.employeeCode)}
// //                     disabled={row.due <= 0}
// //                     className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white text-xs font-medium px-3 py-1.5 rounded-lg"
// //                   >
// //                     Payer
// //                   </button>
// //                 </div>
// //               </div>

// //               {openPayFor === row.employee.employeeCode && (
// //                 <form
// //                   onSubmit={(e) => handlePay(e, row)}
// //                   className="mt-3 bg-gray-50 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2 items-start"
// //                 >
// //                   <div>
// //                     <label className="block text-xs text-gray-500 mb-1">Montant (Ar)</label>
// //                     <input
// //                       type="number"
// //                       min={1}
// //                       max={row.due}
// //                       value={amount}
// //                       onChange={(e) => setAmount(e.target.value)}
// //                       placeholder={`Max ${formatAriary(row.due)}`}
// //                       className="w-full border rounded-lg px-3 py-2 text-sm"
// //                       required
// //                       autoFocus
// //                     />
// //                   </div>
// //                   <div>
// //                     <label className="block text-xs text-gray-500 mb-1">Note (optionnel)</label>
// //                     <input
// //                       value={note}
// //                       onChange={(e) => setNote(e.target.value)}
// //                       placeholder="Ex: avance, acompte..."
// //                       className="w-full border rounded-lg px-3 py-2 text-sm"
// //                     />
// //                   </div>
// //                   <div className="flex gap-2 sm:pt-5">
// //                     <button
// //                       type="submit"
// //                       disabled={saving}
// //                       className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60"
// //                     >
// //                       {saving ? "..." : "Confirmer"}
// //                     </button>
// //                     <button
// //                       type="button"
// //                       onClick={() => setOpenPayFor(null)}
// //                       className="text-sm text-gray-500 font-medium px-2"
// //                     >
// //                       Annuler
// //                     </button>
// //                   </div>
// //                   {error && <div className="sm:col-span-3 text-sm text-red-600">{error}</div>}
// //                 </form>
// //               )}

// //               {openHistoryFor === row.employee.employeeCode && (
// //                 <div className="mt-3 bg-gray-50 rounded-lg p-3">
// //                   {!payments[row.employee.employeeCode] ? (
// //                     <div className="text-xs text-gray-500">Chargement...</div>
// //                   ) : payments[row.employee.employeeCode].length === 0 ? (
// //                     <div className="text-xs text-gray-500">Aucun paiement enregistré.</div>
// //                   ) : (
// //                     <div className="divide-y divide-gray-200">
// //                       {payments[row.employee.employeeCode].map((p) => (
// //                         <div key={p.id} className="py-1.5 flex justify-between items-center gap-3 text-xs">
// //                           <span className="text-gray-500">{fmtDay(p.date)}{p.note ? ` · ${p.note}` : ""}</span>
// //                           <span className="flex items-center gap-3"><span className="font-medium text-gray-800">{formatAriary(p.amount)}</span><button type="button" onClick={() => openArchiveModal(row.employee.employeeCode,p)} className="rounded-md px-2 py-1 font-semibold text-rose-600 hover:bg-rose-50">Archiver</button></span>
// //                         </div>
// //                       ))}
// //                     </div>
// //                   )}
// //                 </div>
// //               )}
// //             </div>
// //           ))}
// //         </div>
// //       </Card>

// //       {archiveTarget && (
// //         <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
// //           onMouseDown={(event) => { if (event.target === event.currentTarget && !archiving) setArchiveTarget(null) }}>
// //           <form onSubmit={handleArchivePayment} className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
// //             <header className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
// //               <div className="flex items-start gap-3">
// //                 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600"><Archive className="h-5 w-5" /></div>
// //                 <div>
// //                   <h2 className="text-lg font-bold text-slate-900">Archiver ce paiement ?</h2>
// //                   <p className="mt-1 text-sm text-slate-500">L’enregistrement sera conservé dans l’historique d’audit.</p>
// //                 </div>
// //               </div>
// //               <button type="button" onClick={() => setArchiveTarget(null)} disabled={archiving} aria-label="Fermer"
// //                 className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X className="h-4 w-4" /></button>
// //             </header>

// //             <div className="space-y-4 p-5 sm:p-6">
// //               <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
// //                 <div className="min-w-0">
// //                   <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{archiveTarget.employeeCode}</div>
// //                   <div className="mt-1 text-sm text-slate-700">Paiement du {fmtDay(archiveTarget.payment.date)}</div>
// //                   {archiveTarget.payment.note && <div className="mt-1 truncate text-xs text-slate-500">{archiveTarget.payment.note}</div>}
// //                 </div>
// //                 <div className="shrink-0 text-right text-lg font-bold text-slate-900">{formatAriary(archiveTarget.payment.amount)}</div>
// //               </div>

// //               <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
// //                 <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
// //                 <p>Le paiement sera masqué de l’historique actif. Il restera conservé avec <strong>deleted_at</strong>, l’administrateur et le motif ; le total payé et le reste à payer seront recalculés.</p>
// //               </div>

// //               <div>
// //                 <label htmlFor="payment-archive-reason" className="mb-1.5 block text-sm font-semibold text-slate-800">Motif obligatoire</label>
// //                 <textarea id="payment-archive-reason" autoFocus required rows={3} maxLength={500} value={archiveReason}
// //                   onChange={(event) => { setArchiveReason(event.target.value); if (archiveError) setArchiveError(null) }}
// //                   placeholder="Expliquez pourquoi ce paiement doit être archivé..."
// //                   className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:bg-slate-50" disabled={archiving} />
// //                 <div className="mt-1 flex justify-between gap-3 text-xs text-slate-500">
// //                   <span>Ce motif sera conservé dans l’audit et l’historique des archives.</span>
// //                   <span>{archiveReason.length}/500</span>
// //                 </div>
// //                 {archiveError && <p role="alert" className="mt-2 text-sm font-medium text-rose-600">{archiveError}</p>}
// //               </div>
// //             </div>

// //             <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 p-4 sm:flex-row sm:justify-end sm:px-6">
// //               <button type="button" onClick={() => setArchiveTarget(null)} disabled={archiving}
// //                 className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Annuler</button>
// //               <button type="submit" disabled={archiving || !archiveReason.trim()}
// //                 className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">
// //                 <Archive className="h-4 w-4" />{archiving ? "Archivage..." : "Archiver avec motif"}
// //               </button>
// //             </footer>
// //           </form>
// //         </div>
// //       )}

// //       {toast && <Toast message={toast.msg} tone={toast.tone} onClose={() => setToast(null)} />}
// //     </div>
// //   )
// // }


// // // src/pages/admin/Salaries.tsx
// // import { useEffect, useState } from "react"
// // import { getSalarySummary, type SalarySummaryRow } from "../../services/salary"
// // import { createPayment, listPayments, softDeletePayment, type Payment } from "../../services/payments"
// // import { errorMessage } from "../../services/api"
// // import { formatAriary } from "../../utils/salaryCalculator"
// // import { fmtDay } from "../../utils/format"
// // import Card from "../../components/Card"
// // import { StatCard } from "../../components/Card"
// // import EmptyState from "../../components/EmptyState"
// // import Toast from "../../components/Toast"

// // // earned = total gagné, paid = total déjà payé, due = reste à payer (calculés par le serveur)
// // type Row = SalarySummaryRow

// // export default function AdminSalaries() {
// //   const [rows, setRows] = useState<Row[]>([])
// //   const [totals, setTotals] = useState({ earned: 0, paid: 0, due: 0 })
// //   const [payments, setPayments] = useState<Record<string, Payment[]>>({})
// //   const [loading, setLoading] = useState(true)
// //   const [openPayFor, setOpenPayFor] = useState<string | null>(null) // employee.id
// //   const [openHistoryFor, setOpenHistoryFor] = useState<string | null>(null)
// //   const [amount, setAmount] = useState("")
// //   const [note, setNote] = useState("")
// //   const [saving, setSaving] = useState(false)
// //   const [error, setError] = useState<string | null>(null)
// //   const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null)

// //   async function refresh() {
// //     setLoading(true)
// //     try {
// //       const summary = await getSalarySummary()
// //       setRows(summary.rows)
// //       setTotals(summary.totals)
// //     } catch (e) {
// //       setToast({ msg: errorMessage(e, "Impossible de charger les rémunérations."), tone: "error" })
// //     } finally {
// //       setLoading(false)
// //     }
// //   }

// //   useEffect(() => { refresh() }, [])

// //   async function toggleHistory(code: string) {
// //     if (openHistoryFor === code) { setOpenHistoryFor(null); return }
// //     setOpenHistoryFor(code)
// //     try {
// //       const list = await listPayments(code)
// //       setPayments((prev) => ({ ...prev, [code]: list }))
// //     } catch (e) {
// //       setToast({ msg: errorMessage(e, "Impossible de charger l'historique."), tone: "error" })
// //     }
// //   }

// //   function openPayModal(code: string) {
// //     setOpenPayFor(code)
// //     setAmount("")
// //     setNote("")
// //     setError(null)
// //   }

// //   async function handleDeletePayment(employeeCode: string, payment: Payment) {
// //     const reason = window.prompt("Motif obligatoire de suppression (conservé dans l’audit) :")
// //     if (!reason?.trim()) return
// //     try { await softDeletePayment(payment.id, reason); setPayments((prev) => ({...prev,[employeeCode]:(prev[employeeCode]||[]).filter(p=>p.id!==payment.id)})); await refresh(); setToast({msg:"Paiement archivé avec traçabilité.",tone:"success"}) }
// //     catch(e) { setToast({msg:errorMessage(e,"Impossible d’archiver ce paiement."),tone:"error"}) }
// //   }
// //   async function handlePay(e: React.FormEvent, row: Row) {
// //     e.preventDefault()
// //     setError(null)
// //     const value = Number(amount)
// //     if (!value || value <= 0) {
// //       setError("Entrez un montant valide.")
// //       return
// //     }
// //     if (value > row.due) {
// //       setError(`Ce montant dépasse le reste à payer (${formatAriary(row.due)}).`)
// //       return
// //     }
// //     setSaving(true)
// //     try {
// //       // Le serveur revérifie que le montant ne dépasse pas le reste à payer et journalise le paiement.
// //       await createPayment(row.employee.employeeCode, Math.round(value), note)
// //       setOpenPayFor(null)
// //       setPayments((prev) => { const next = { ...prev }; delete next[row.employee.employeeCode]; return next })
// //       if (openHistoryFor === row.employee.employeeCode) setOpenHistoryFor(null)
// //       setToast({ msg: `${formatAriary(value)} payé à ${row.employee.firstName} ${row.employee.lastName}.`, tone: "success" })
// //       refresh()
// //     } catch (err) {
// //       setError(errorMessage(err, "Le paiement n'a pas pu être enregistré."))
// //     } finally {
// //       setSaving(false)
// //     }
// //   }

// //   return (
// //     <div className="space-y-4">
// //       <div className="flex justify-between items-center">
// //         <h1 className="text-xl font-bold">Rémunérations</h1>
// //       </div>

// //       <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
// //         <StatCard label="Total gagné" value={formatAriary(totals.earned)} />
// //         <StatCard label="Total déjà payé" value={formatAriary(totals.paid)} accent="text-green-700" />
// //         <StatCard label="Total restant à payer" value={formatAriary(totals.due)} accent="text-primary-700" />
// //       </div>

// //       <Card>
// //         {!loading && rows.length === 0 && <EmptyState message="Aucun salarié." />}
// //         <div className="divide-y">
// //           {rows.map((row) => (
// //             <div key={row.employee.employeeCode} className="py-3">
// //               <div className="flex items-center justify-between gap-3 flex-wrap">
// //                 <div>
// //                   <div className="font-medium text-sm">{row.employee.lastName} {row.employee.firstName}</div>
// //                   <div className="text-xs text-gray-500">{row.employee.employeeCode}{row.employee.contractType === "CDI" ? ` · CDI · ${formatAriary(row.employee.monthlySalary ?? 0)}/mois` : " · Journalier"}{!row.employee.active && " · inactif"}</div>
// //                 </div>

// //                 <div className="flex items-center gap-4 text-sm">
// //                   <div className="text-right">
// //                     <div className="text-xs text-gray-400">Gagné</div>
// //                     <div className="font-medium text-gray-700">{formatAriary(row.earned)}</div>
// //                   </div>
// //                   <div className="text-right">
// //                     <div className="text-xs text-gray-400">Payé</div>
// //                     <div className="font-medium text-green-700">{formatAriary(row.paid)}</div>
// //                   </div>
// //                   <div className="text-right">
// //                     <div className="text-xs text-gray-400">Cash restant</div>
// //                     <div className="font-bold text-primary-700">{formatAriary(row.due)}</div>
// //                   </div>
// //                 </div>

// //                 <div className="flex items-center gap-2">
// //                   <button
// //                     onClick={() => toggleHistory(row.employee.employeeCode)}
// //                     className="text-xs text-gray-500 font-medium"
// //                   >
// //                     {openHistoryFor === row.employee.employeeCode ? "Masquer" : "Historique"}
// //                   </button>
// //                   <button
// //                     onClick={() => openPayModal(row.employee.employeeCode)}
// //                     disabled={row.due <= 0}
// //                     className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white text-xs font-medium px-3 py-1.5 rounded-lg"
// //                   >
// //                     Payer
// //                   </button>
// //                 </div>
// //               </div>

// //               {openPayFor === row.employee.employeeCode && (
// //                 <form
// //                   onSubmit={(e) => handlePay(e, row)}
// //                   className="mt-3 bg-gray-50 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2 items-start"
// //                 >
// //                   <div>
// //                     <label className="block text-xs text-gray-500 mb-1">Montant (Ar)</label>
// //                     <input
// //                       type="number"
// //                       min={1}
// //                       max={row.due}
// //                       value={amount}
// //                       onChange={(e) => setAmount(e.target.value)}
// //                       placeholder={`Max ${formatAriary(row.due)}`}
// //                       className="w-full border rounded-lg px-3 py-2 text-sm"
// //                       required
// //                       autoFocus
// //                     />
// //                   </div>
// //                   <div>
// //                     <label className="block text-xs text-gray-500 mb-1">Note (optionnel)</label>
// //                     <input
// //                       value={note}
// //                       onChange={(e) => setNote(e.target.value)}
// //                       placeholder="Ex: avance, acompte..."
// //                       className="w-full border rounded-lg px-3 py-2 text-sm"
// //                     />
// //                   </div>
// //                   <div className="flex gap-2 sm:pt-5">
// //                     <button
// //                       type="submit"
// //                       disabled={saving}
// //                       className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60"
// //                     >
// //                       {saving ? "..." : "Confirmer"}
// //                     </button>
// //                     <button
// //                       type="button"
// //                       onClick={() => setOpenPayFor(null)}
// //                       className="text-sm text-gray-500 font-medium px-2"
// //                     >
// //                       Annuler
// //                     </button>
// //                   </div>
// //                   {error && <div className="sm:col-span-3 text-sm text-red-600">{error}</div>}
// //                 </form>
// //               )}

// //               {openHistoryFor === row.employee.employeeCode && (
// //                 <div className="mt-3 bg-gray-50 rounded-lg p-3">
// //                   {!payments[row.employee.employeeCode] ? (
// //                     <div className="text-xs text-gray-500">Chargement...</div>
// //                   ) : payments[row.employee.employeeCode].length === 0 ? (
// //                     <div className="text-xs text-gray-500">Aucun paiement enregistré.</div>
// //                   ) : (
// //                     <div className="divide-y divide-gray-200">
// //                       {payments[row.employee.employeeCode].map((p) => (
// //                         <div key={p.id} className="py-1.5 flex justify-between items-center gap-3 text-xs">
// //                           <span className="text-gray-500">{fmtDay(p.date)}{p.note ? ` · ${p.note}` : ""}</span>
// //                           <span className="flex items-center gap-3"><span className="font-medium text-gray-800">{formatAriary(p.amount)}</span><button type="button" onClick={() => void handleDeletePayment(row.employee.employeeCode,p)} className="text-rose-600 underline">Archiver</button></span>
// //                         </div>
// //                       ))}
// //                     </div>
// //                   )}
// //                 </div>
// //               )}
// //             </div>
// //           ))}
// //         </div>
// //       </Card>

// //       {toast && <Toast message={toast.msg} tone={toast.tone} onClose={() => setToast(null)} />}
// //     </div>
// //   )
// // }


// // // src/pages/admin/Salaries.tsx
// // import { useEffect, useState } from "react"
// // import { getSalarySummary, type SalarySummaryRow } from "../../services/salary"
// // import { createPayment, listPayments, type Payment } from "../../services/payments"
// // import { errorMessage } from "../../services/api"
// // import { formatAriary } from "../../utils/salaryCalculator"
// // import { fmtDay } from "../../utils/format"
// // import Card from "../../components/Card"
// // import { StatCard } from "../../components/Card"
// // import EmptyState from "../../components/EmptyState"
// // import Toast from "../../components/Toast"

// // // earned = total gagné, paid = total déjà payé, due = reste à payer (calculés par le serveur)
// // type Row = SalarySummaryRow

// // export default function AdminSalaries() {
// //   const [rows, setRows] = useState<Row[]>([])
// //   const [totals, setTotals] = useState({ earned: 0, paid: 0, due: 0 })
// //   const [payments, setPayments] = useState<Record<string, Payment[]>>({})
// //   const [loading, setLoading] = useState(true)
// //   const [openPayFor, setOpenPayFor] = useState<string | null>(null) // employee.id
// //   const [openHistoryFor, setOpenHistoryFor] = useState<string | null>(null)
// //   const [amount, setAmount] = useState("")
// //   const [note, setNote] = useState("")
// //   const [saving, setSaving] = useState(false)
// //   const [error, setError] = useState<string | null>(null)
// //   const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null)

// //   async function refresh() {
// //     setLoading(true)
// //     try {
// //       const summary = await getSalarySummary()
// //       setRows(summary.rows)
// //       setTotals(summary.totals)
// //     } catch (e) {
// //       setToast({ msg: errorMessage(e, "Impossible de charger les rémunérations."), tone: "error" })
// //     } finally {
// //       setLoading(false)
// //     }
// //   }

// //   useEffect(() => { refresh() }, [])

// //   async function toggleHistory(code: string) {
// //     if (openHistoryFor === code) { setOpenHistoryFor(null); return }
// //     setOpenHistoryFor(code)
// //     try {
// //       const list = await listPayments(code)
// //       setPayments((prev) => ({ ...prev, [code]: list }))
// //     } catch (e) {
// //       setToast({ msg: errorMessage(e, "Impossible de charger l'historique."), tone: "error" })
// //     }
// //   }

// //   function openPayModal(code: string) {
// //     setOpenPayFor(code)
// //     setAmount("")
// //     setNote("")
// //     setError(null)
// //   }

// //   async function handlePay(e: React.FormEvent, row: Row) {
// //     e.preventDefault()
// //     setError(null)
// //     const value = Number(amount)
// //     if (!value || value <= 0) {
// //       setError("Entrez un montant valide.")
// //       return
// //     }
// //     if (value > row.due) {
// //       setError(`Ce montant dépasse le reste à payer (${formatAriary(row.due)}).`)
// //       return
// //     }
// //     setSaving(true)
// //     try {
// //       // Le serveur revérifie que le montant ne dépasse pas le reste à payer et journalise le paiement.
// //       await createPayment(row.employee.employeeCode, Math.round(value), note)
// //       setOpenPayFor(null)
// //       setPayments((prev) => { const next = { ...prev }; delete next[row.employee.employeeCode]; return next })
// //       if (openHistoryFor === row.employee.employeeCode) setOpenHistoryFor(null)
// //       setToast({ msg: `${formatAriary(value)} payé à ${row.employee.firstName} ${row.employee.lastName}.`, tone: "success" })
// //       refresh()
// //     } catch (err) {
// //       setError(errorMessage(err, "Le paiement n'a pas pu être enregistré."))
// //     } finally {
// //       setSaving(false)
// //     }
// //   }

// //   return (
// //     <div className="space-y-4">
// //       <div className="flex justify-between items-center">
// //         <h1 className="text-xl font-bold">Rémunérations</h1>
// //       </div>

// //       <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
// //         <StatCard label="Total gagné" value={formatAriary(totals.earned)} />
// //         <StatCard label="Total déjà payé" value={formatAriary(totals.paid)} accent="text-green-700" />
// //         <StatCard label="Total restant à payer" value={formatAriary(totals.due)} accent="text-primary-700" />
// //       </div>

// //       <Card>
// //         {!loading && rows.length === 0 && <EmptyState message="Aucun salarié." />}
// //         <div className="divide-y">
// //           {rows.map((row) => (
// //             <div key={row.employee.employeeCode} className="py-3">
// //               <div className="flex items-center justify-between gap-3 flex-wrap">
// //                 <div>
// //                   <div className="font-medium text-sm">{row.employee.lastName} {row.employee.firstName}</div>
// //                   <div className="text-xs text-gray-500">{row.employee.employeeCode}{!row.employee.active && " · inactif"}</div>
// //                 </div>

// //                 <div className="flex items-center gap-4 text-sm">
// //                   <div className="text-right">
// //                     <div className="text-xs text-gray-400">Gagné</div>
// //                     <div className="font-medium text-gray-700">{formatAriary(row.earned)}</div>
// //                   </div>
// //                   <div className="text-right">
// //                     <div className="text-xs text-gray-400">Payé</div>
// //                     <div className="font-medium text-green-700">{formatAriary(row.paid)}</div>
// //                   </div>
// //                   <div className="text-right">
// //                     <div className="text-xs text-gray-400">Cash restant</div>
// //                     <div className="font-bold text-primary-700">{formatAriary(row.due)}</div>
// //                   </div>
// //                 </div>

// //                 <div className="flex items-center gap-2">
// //                   <button
// //                     onClick={() => toggleHistory(row.employee.employeeCode)}
// //                     className="text-xs text-gray-500 font-medium"
// //                   >
// //                     {openHistoryFor === row.employee.employeeCode ? "Masquer" : "Historique"}
// //                   </button>
// //                   <button
// //                     onClick={() => openPayModal(row.employee.employeeCode)}
// //                     disabled={row.due <= 0}
// //                     className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white text-xs font-medium px-3 py-1.5 rounded-lg"
// //                   >
// //                     Payer
// //                   </button>
// //                 </div>
// //               </div>

// //               {openPayFor === row.employee.employeeCode && (
// //                 <form
// //                   onSubmit={(e) => handlePay(e, row)}
// //                   className="mt-3 bg-gray-50 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2 items-start"
// //                 >
// //                   <div>
// //                     <label className="block text-xs text-gray-500 mb-1">Montant (Ar)</label>
// //                     <input
// //                       type="number"
// //                       min={1}
// //                       max={row.due}
// //                       value={amount}
// //                       onChange={(e) => setAmount(e.target.value)}
// //                       placeholder={`Max ${formatAriary(row.due)}`}
// //                       className="w-full border rounded-lg px-3 py-2 text-sm"
// //                       required
// //                       autoFocus
// //                     />
// //                   </div>
// //                   <div>
// //                     <label className="block text-xs text-gray-500 mb-1">Note (optionnel)</label>
// //                     <input
// //                       value={note}
// //                       onChange={(e) => setNote(e.target.value)}
// //                       placeholder="Ex: avance, acompte..."
// //                       className="w-full border rounded-lg px-3 py-2 text-sm"
// //                     />
// //                   </div>
// //                   <div className="flex gap-2 sm:pt-5">
// //                     <button
// //                       type="submit"
// //                       disabled={saving}
// //                       className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60"
// //                     >
// //                       {saving ? "..." : "Confirmer"}
// //                     </button>
// //                     <button
// //                       type="button"
// //                       onClick={() => setOpenPayFor(null)}
// //                       className="text-sm text-gray-500 font-medium px-2"
// //                     >
// //                       Annuler
// //                     </button>
// //                   </div>
// //                   {error && <div className="sm:col-span-3 text-sm text-red-600">{error}</div>}
// //                 </form>
// //               )}

// //               {openHistoryFor === row.employee.employeeCode && (
// //                 <div className="mt-3 bg-gray-50 rounded-lg p-3">
// //                   {!payments[row.employee.employeeCode] ? (
// //                     <div className="text-xs text-gray-500">Chargement...</div>
// //                   ) : payments[row.employee.employeeCode].length === 0 ? (
// //                     <div className="text-xs text-gray-500">Aucun paiement enregistré.</div>
// //                   ) : (
// //                     <div className="divide-y divide-gray-200">
// //                       {payments[row.employee.employeeCode].map((p) => (
// //                         <div key={p.id} className="py-1.5 flex justify-between text-xs">
// //                           <span className="text-gray-500">{fmtDay(p.date)}{p.note ? ` · ${p.note}` : ""}</span>
// //                           <span className="font-medium text-gray-800">{formatAriary(p.amount)}</span>
// //                         </div>
// //                       ))}
// //                     </div>
// //                   )}
// //                 </div>
// //               )}
// //             </div>
// //           ))}
// //         </div>
// //       </Card>

// //       {toast && <Toast message={toast.msg} tone={toast.tone} onClose={() => setToast(null)} />}
// //     </div>
// //   )
// // }
