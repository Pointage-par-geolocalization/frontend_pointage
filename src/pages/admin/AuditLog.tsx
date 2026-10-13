// src/pages/admin/AuditLog.tsx
// Journal des actions importantes (paiements, pointages à distance, comptes, paramètres, décisions…).
import { useEffect, useState } from "react"
import { listAuditLogs, auditLabel, AUDIT_ACTIONS, type AuditLog } from "../../services/audit"
import { errorMessage } from "../../services/api"
import { dateKey, todayKey } from "../../utils/date"
import { fmtDateTime } from "../../utils/format"
import Card from "../../components/Card"
import EmptyState from "../../components/EmptyState"
import Dropdown from "../../components/Dropdown"
import Toast from "../../components/Toast"
import { ScrollText, Download, Tag } from "lucide-react"

const LIMIT = 200

function defaultFrom() {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return dateKey(d)
}

const csvCell = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`

export default function AdminAuditLog() {
  const [action, setAction] = useState("")
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(todayKey())
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listAuditLogs({ action: action || undefined, from: from || undefined, to: to || undefined, limit: LIMIT })
      .then((l) => { if (!cancelled) setLogs(l) })
      .catch((e) => { if (!cancelled) setError(errorMessage(e, "Impossible de charger le journal.")) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [action, from, to])

  function exportCsv() {
    const header = "Date,Utilisateur,Action,Détail,Cible\n"
    const body = logs.map((l) =>
      [fmtDateTime(l.createdAt), l.userLabel, auditLabel(l.action), l.summary, l.targetId].map(csvCell).join(",")
    ).join("\n")
    // BOM pour qu'Excel ouvre correctement les accents.
    const blob = new Blob(["﻿" + header + body], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `journal_${from || "debut"}_${to || "fin"}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const inputCls = "w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center border border-primary-100"><ScrollText className="w-5 h-5" /></div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Journal des actions</h1>
            <p className="text-sm text-slate-500 mt-0.5">Paiements, pointages à distance, comptes, paramètres et décisions importantes.</p>
          </div>
        </div>
        <button onClick={exportCsv} disabled={logs.length === 0}
          className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 disabled:opacity-50">
          <Download className="w-4 h-4" />Exporter CSV
        </button>
      </div>

      <Card className="rounded-2xl">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Action</label>
            <Dropdown value={action} onChange={setAction} placeholder="Toutes les actions" icon={<Tag className="w-4 h-4" />}
              options={[{ value: "", label: "Toutes les actions" }, ...Object.entries(AUDIT_ACTIONS).map(([value, label]) => ({ value, label }))]} />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Du</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] text-slate-500 mb-1">Au</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
          </div>
        </div>
      </Card>

      <Card className="rounded-2xl overflow-x-auto">
        {loading ? (
          <p className="text-sm text-slate-400 py-6 text-center">Chargement...</p>
        ) : logs.length === 0 ? (
          <EmptyState message="Aucune action enregistrée pour ces critères." />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3 whitespace-nowrap">Date</th>
                  <th className="py-2 pr-3">Utilisateur</th>
                  <th className="py-2 pr-3">Action</th>
                  <th className="py-2 pr-3">Détail</th>
                  <th className="py-2 pr-3">Cible</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((l) => (
                  <tr key={l.id} className="align-top">
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-600">{fmtDateTime(l.createdAt)}</td>
                    <td className="py-2 pr-3">{l.userLabel ?? <span className="text-slate-400">—</span>}</td>
                    <td className="py-2 pr-3 font-medium text-slate-800">{auditLabel(l.action)}</td>
                    <td className="py-2 pr-3 text-slate-600">{l.summary ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs text-slate-400 font-mono break-all">{l.targetId ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length >= LIMIT && (
              <p className="text-xs text-slate-400 mt-3">Seules les {LIMIT} actions les plus récentes sont affichées : réduisez la période pour voir les plus anciennes.</p>
            )}
          </>
        )}
      </Card>

      {error && <Toast message={error} tone="error" onClose={() => setError(null)} />}
    </div>
  )
}
