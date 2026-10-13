// src/pages/admin/Reports.tsx
import { useEffect, useState } from "react"
import { dateKey, todayKey } from "../../utils/date"
import { getSalaryReport, type ReportRow } from "../../services/salary"
import { listSites, type Site } from "../../services/sites"
import { errorMessage } from "../../services/api"
import { formatAriary } from "../../utils/salaryCalculator"
import Card from "../../components/Card"
import EmptyState from "../../components/EmptyState"
import Toast from "../../components/Toast"

/** Champ CSV : entre guillemets si nécessaire (virgule, guillemet, retour à la ligne). */
const csvField = (v: string | number) => {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function AdminReports() {
  const [start, setStart] = useState(dateKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))
  const [end, setEnd] = useState(todayKey())
  const [siteId, setSiteId] = useState("")
  const [sites, setSites] = useState<Site[]>([])
  const [rows, setRows] = useState<ReportRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setLoading(true)
    try {
      const report = await getSalaryReport(start, end, siteId || undefined)
      setRows(report.rows)
      setTotal(report.total)
    } catch (e) {
      setError(errorMessage(e, "Impossible de générer le rapport."))
    } finally {
      setLoading(false)
    }
  }

  // Régénère automatiquement le rapport (mois en cours par défaut) à l'ouverture de la page.
  useEffect(() => { generate() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { listSites().then(setSites).catch(() => {}) }, [])

  function exportCsv() {
    const header = "Salarié,Identifiant,Jours travaillés,Heures travaillées,Salaire total\n"
    const body = rows.map((r) => [r.name, r.employeeCode, r.days, (r.minutes / 60).toFixed(1), r.total].map(csvField).join(",")).join("\n")
    const blob = new Blob(["﻿" + header + body], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `rapport_${start}_${end}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Rapports</h1>
      <Card className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Du</label>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Au</label>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm" />
        </div>
        {sites.length > 0 && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Chantier</label>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm">
              <option value="">Tous les chantiers</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
        <button onClick={generate} disabled={loading || !start || !end || start > end} className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60">
          {loading ? "Génération..." : "Générer"}
        </button>
        {rows.length > 0 && (
          <button onClick={exportCsv} className="border text-sm font-medium px-4 py-2 rounded-lg text-gray-700">
            Exporter CSV
          </button>
        )}
      </Card>

      <Card>
        {rows.length === 0 ? (
          <EmptyState message={loading ? "Génération..." : "Aucune rémunération sur cette période."} />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2">Salarié</th>
                  <th className="py-2">Jours</th>
                  <th className="py-2">Heures</th>
                  <th className="py-2">Salaire total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.employeeCode}>
                    <td className="py-2">{r.name}</td>
                    <td className="py-2">{r.days}</td>
                    <td className="py-2">{(r.minutes / 60).toFixed(1)} h</td>
                    <td className="py-2 font-semibold">{formatAriary(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-right mt-3 font-bold">TOTAL : {formatAriary(total)}</div>
          </>
        )}
      </Card>

      {error && <Toast message={error} tone="error" onClose={() => setError(null)} />}
    </div>
  )
}
