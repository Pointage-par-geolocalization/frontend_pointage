// src/pages/admin/Salaries.tsx
import { useEffect, useState } from "react"
import { getSalarySummary, type SalarySummaryRow } from "../../services/salary"
import { createPayment, listPayments, type Payment } from "../../services/payments"
import { errorMessage } from "../../services/api"
import { formatAriary } from "../../utils/salaryCalculator"
import { fmtDay } from "../../utils/format"
import Card from "../../components/Card"
import { StatCard } from "../../components/Card"
import EmptyState from "../../components/EmptyState"
import Toast from "../../components/Toast"

// earned = total gagné, paid = total déjà payé, due = reste à payer (calculés par le serveur)
type Row = SalarySummaryRow

export default function AdminSalaries() {
  const [rows, setRows] = useState<Row[]>([])
  const [totals, setTotals] = useState({ earned: 0, paid: 0, due: 0 })
  const [payments, setPayments] = useState<Record<string, Payment[]>>({})
  const [loading, setLoading] = useState(true)
  const [openPayFor, setOpenPayFor] = useState<string | null>(null) // employee.id
  const [openHistoryFor, setOpenHistoryFor] = useState<string | null>(null)
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null)

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

  useEffect(() => { refresh() }, [])

  async function toggleHistory(code: string) {
    if (openHistoryFor === code) { setOpenHistoryFor(null); return }
    setOpenHistoryFor(code)
    try {
      const list = await listPayments(code)
      setPayments((prev) => ({ ...prev, [code]: list }))
    } catch (e) {
      setToast({ msg: errorMessage(e, "Impossible de charger l'historique."), tone: "error" })
    }
  }

  function openPayModal(code: string) {
    setOpenPayFor(code)
    setAmount("")
    setNote("")
    setError(null)
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
      setPayments((prev) => { const next = { ...prev }; delete next[row.employee.employeeCode]; return next })
      if (openHistoryFor === row.employee.employeeCode) setOpenHistoryFor(null)
      setToast({ msg: `${formatAriary(value)} payé à ${row.employee.firstName} ${row.employee.lastName}.`, tone: "success" })
      refresh()
    } catch (err) {
      setError(errorMessage(err, "Le paiement n'a pas pu être enregistré."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">Rémunérations</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Total gagné" value={formatAriary(totals.earned)} />
        <StatCard label="Total déjà payé" value={formatAriary(totals.paid)} accent="text-green-700" />
        <StatCard label="Total restant à payer" value={formatAriary(totals.due)} accent="text-primary-700" />
      </div>

      <Card>
        {!loading && rows.length === 0 && <EmptyState message="Aucun salarié." />}
        <div className="divide-y">
          {rows.map((row) => (
            <div key={row.employee.employeeCode} className="py-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-medium text-sm">{row.employee.lastName} {row.employee.firstName}</div>
                  <div className="text-xs text-gray-500">{row.employee.employeeCode}{!row.employee.active && " · inactif"}</div>
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
                    {openHistoryFor === row.employee.employeeCode ? "Masquer" : "Historique"}
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

              {openHistoryFor === row.employee.employeeCode && (
                <div className="mt-3 bg-gray-50 rounded-lg p-3">
                  {!payments[row.employee.employeeCode] ? (
                    <div className="text-xs text-gray-500">Chargement...</div>
                  ) : payments[row.employee.employeeCode].length === 0 ? (
                    <div className="text-xs text-gray-500">Aucun paiement enregistré.</div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {payments[row.employee.employeeCode].map((p) => (
                        <div key={p.id} className="py-1.5 flex justify-between text-xs">
                          <span className="text-gray-500">{fmtDay(p.date)}{p.note ? ` · ${p.note}` : ""}</span>
                          <span className="font-medium text-gray-800">{formatAriary(p.amount)}</span>
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

      {toast && <Toast message={toast.msg} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  )
}
