// src/pages/employee/Salary.tsx
import { useEffect, useState } from "react"
import { useAuth } from "../../hooks/useAuth"
import { getMySalary, type MySalary } from "../../services/salary"
import { listMyPayments, type Payment } from "../../services/payments"
import { formatAriary, minutesToHoursLabel } from "../../utils/salaryCalculator"
import { fmtDay } from "../../utils/format"
import Card from "../../components/Card"
import EmptyState from "../../components/EmptyState"
import { Wallet, Banknote, CheckCircle, Clock, ArrowDownLeft } from "lucide-react"

export default function EmployeeSalary() {
  const { appUser } = useAuth()
  const [salary, setSalary] = useState<MySalary | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])

  useEffect(() => {
    if (!appUser) return
    getMySalary().then(setSalary).catch(() => {})
    listMyPayments().then(setPayments).catch(() => {})
  }, [appUser?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Gagné / payé / reste : calculés par le serveur (un seul calcul pour tout le monde).
  const records = salary?.records ?? []
  const earned = salary?.earned ?? 0
  const paid = salary?.paid ?? 0
  const due = salary?.due ?? 0
  const totalHours = salary?.totalMinutes ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-primary-50 text-primary-600 rounded-xl border border-primary-100">
          <Wallet className="w-5 h-5" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Ma rémunération</h1>
      </div>

      {/* Carte principale Reste à recevoir */}
      <div className="bg-gradient-to-br from-primary-900 to-indigo-900 text-white p-6 rounded-2xl shadow-md text-center relative overflow-hidden">
        <div className="text-xs uppercase tracking-wider font-semibold text-primary-200 mb-1">Reste à recevoir</div>
        <div className="text-4xl font-extrabold my-1">{formatAriary(due)}</div>
        <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-primary-500/20 rounded-full blur-2xl"></div>
      </div>

      {/* Résumé en 3 mini-cartes */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 text-center shadow-sm">
          <div className="text-[11px] uppercase font-semibold text-slate-400 mb-1">Total gagné</div>
          <div className="font-bold text-slate-900 text-sm sm:text-base">{formatAriary(earned)}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 text-center shadow-sm">
          <div className="text-[11px] uppercase font-semibold text-slate-400 mb-1">Total reçu</div>
          <div className="font-bold text-emerald-600 text-sm sm:text-base">{formatAriary(paid)}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 text-center shadow-sm">
          <div className="text-[11px] uppercase font-semibold text-slate-400 mb-1">Heures</div>
          <div className="font-bold text-slate-900 text-sm sm:text-base">{minutesToHoursLabel(totalHours)}</div>
        </div>
      </div>

      {/* Historique des paiements reçus */}
      {payments.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Banknote className="w-4 h-4 text-emerald-600" />
            Paiements reçus
          </h2>
          <Card className="p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="divide-y divide-slate-100">
              {payments.map((p) => (
                <div key={p.id} className="py-2.5 flex justify-between items-center text-sm first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                    <span className="text-slate-600">{fmtDay(p.date)}{p.note ? ` · ${p.note}` : ""}</span>
                  </div>
                  <span className="font-bold text-emerald-600">+{formatAriary(p.amount)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Détail par jour */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-primary-600" />
          Détail par jour travaillé
        </h2>
        
        {salary && records.length === 0 && <EmptyState message="Aucune rémunération enregistrée pour le moment." />}

        <div className="space-y-2.5">
          {records.map((r) => (
            <Card key={r.id} className="p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-2 text-sm">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="font-bold text-slate-800">{fmtDay(r.workDate)}</span>
                <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                  {minutesToHoursLabel(r.workedMinutes)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Salaire du jour :</span>
                <span className="font-semibold text-slate-800">{formatAriary(r.dailySalary)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Cumul gagné :</span>
                <span className="font-bold text-primary-600">{formatAriary(r.cumulativeSalary)}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}