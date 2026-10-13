// src/pages/employee/History.tsx
import { useEffect, useState } from "react"
import { useAuth } from "../../hooks/useAuth"
import { listMyAttendance, type Attendance } from "../../services/attendance"
import { formatAriary, minutesToHoursLabel } from "../../utils/salaryCalculator"
import { fmtDay, fmtTime } from "../../utils/format"
import Card from "../../components/Card"
import EmptyState from "../../components/EmptyState"
import { History as HistoryIcon, Calendar, Clock, ArrowRight } from "lucide-react"

export default function EmployeeHistory() {
  const { appUser } = useAuth()
  const [history, setHistory] = useState<Attendance[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!appUser) return
    listMyAttendance(60).then(setHistory).catch(() => setHistory([])).finally(() => setLoaded(true))
  }, [appUser?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-primary-50 text-primary-600 rounded-xl border border-primary-100">
          <HistoryIcon className="w-5 h-5" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Mon historique</h1>
      </div>

      {loaded && history.length === 0 && <EmptyState message="Aucun pointage enregistré pour le moment." />}

      <div className="space-y-3">
        {history.map((a) => (
          <Card key={a.id} className="p-4 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
              <span className="font-semibold text-sm text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-primary-600" />
                {fmtDay(a.workDate)}
              </span>
              <span className="text-xs font-bold bg-primary-50 text-primary-700 px-2.5 py-1 rounded-lg">
                {minutesToHoursLabel(a.workedMinutes)}
              </span>
            </div>
            
            <div className="flex justify-between items-center text-sm text-slate-600">
              <span className="flex items-center gap-1 text-xs font-medium bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {fmtTime(a.entryTime)}
                <ArrowRight className="w-3 h-3 text-slate-400 mx-0.5" />
                {a.exitTime ? fmtTime(a.exitTime) : "En cours"}
              </span>
              <span className="font-bold text-slate-900">{formatAriary(a.dailySalary)}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}