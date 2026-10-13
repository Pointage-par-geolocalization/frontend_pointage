// src/pages/admin/Documents.tsx
// Espace documentaire unique : tous les devis et factures, classés et recherchables
// (type, statut, client, chantier, période, numéro / client / objet), avec export CSV.
import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import {
  listDocuments, statusInfo, DOCUMENT_STATUS, DOCUMENT_TYPE,
  type DocumentStatus, type DocumentSummary, type DocumentType,
} from "../../services/documents"
import { listClients, type Client } from "../../services/clients"
import { listSites, type Site } from "../../services/sites"
import { errorMessage } from "../../services/api"
import { formatAriary } from "../../utils/salaryCalculator"
import { fmtDay } from "../../utils/format"
import { todayKey } from "../../utils/date"
import Card from "../../components/Card"
import Badge from "../../components/Badge"
import EmptyState from "../../components/EmptyState"
import Dropdown from "../../components/Dropdown"
import Toast from "../../components/Toast"
import { FileText, FilePlus2, Receipt, Search, Download, Building2, HardHat, Filter, Users } from "lucide-react"

type TypeFilter = "" | DocumentType

const ALL_STATUSES: DocumentStatus[] = ["BROUILLON", "ENVOYE", "ACCEPTE", "REFUSE", "EMISE", "PAYEE", "ANNULEE"]

function statusOptions(type: TypeFilter) {
  if (type) {
    return Object.entries(DOCUMENT_STATUS[type]).map(([value, info]) => ({ value, label: info!.label }))
  }
  // Tous types : un statut peut exister pour les deux (Brouillon).
  return ALL_STATUSES.map((s) => {
    const info = DOCUMENT_STATUS.DEVIS[s] ?? DOCUMENT_STATUS.FACTURE[s]
    return { value: s, label: info?.label ?? s }
  })
}

const csvCell = (v: string | number) => {
  const s = String(v)
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function AdminDocuments() {
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [type, setType] = useState<TypeFilter>(() => {
    const t = params.get("type")
    return t === "DEVIS" || t === "FACTURE" ? t : ""
  })
  const [status, setStatus] = useState(params.get("status") ?? "")
  const [clientId, setClientId] = useState(params.get("clientId") ?? "")
  const [siteId, setSiteId] = useState(params.get("siteId") ?? "")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [search, setSearch] = useState(params.get("q") ?? "")
  const [q, setQ] = useState(search)

  const [docs, setDocs] = useState<DocumentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<Client[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    listClients().then(setClients).catch(() => {})
    listSites().then(setSites).catch(() => {})
  }, [])

  // Recherche texte : on attend la fin de la frappe.
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listDocuments({
      type: type || undefined,
      status: (status || undefined) as DocumentStatus | undefined,
      clientId: clientId || undefined,
      siteId: siteId || undefined,
      q: q || undefined,
      from: from || undefined,
      to: to || undefined,
    })
      .then((d) => { if (!cancelled) setDocs(d) })
      .catch((e) => { if (!cancelled) { setDocs([]); setToast(errorMessage(e, "Impossible de charger les documents.")) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [type, status, clientId, siteId, q, from, to])

  function changeType(t: TypeFilter) {
    setType(t)
    // Le statut choisi peut ne pas exister pour l'autre type.
    if (t && status && !DOCUMENT_STATUS[t][status as DocumentStatus]) setStatus("")
  }

  const totals = useMemo(() => {
    const sum = (t: DocumentType) => docs.filter((d) => d.type === t).reduce((s, d) => s + d.total, 0)
    return { quotes: sum("DEVIS"), invoices: sum("FACTURE") }
  }, [docs])

  const hasFilters = !!(status || clientId || siteId || from || to || q)

  function resetFilters() {
    setStatus(""); setClientId(""); setSiteId(""); setFrom(""); setTo(""); setSearch(""); setQ("")
  }

  function exportCsv() {
    const header = ["Numéro", "Type", "Date", "Client", "Chantier", "Objet", "Total", "Statut"]
    const rows = docs.map((d) => [
      d.number, DOCUMENT_TYPE[d.type].label, fmtDay(d.issueDate), d.clientName, d.siteName ?? "", d.subject,
      d.total, statusInfo(d.type, d.status).label,
    ])
    const body = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n")
    // BOM UTF-8 : accents corrects à l'ouverture dans Excel.
    const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `documents_${todayKey()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const inputCls = "w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none transition"

  const typeBtn = (t: TypeFilter, label: string) => (
    <button key={t || "all"} onClick={() => changeType(t)}
      className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
        type === t ? "bg-primary-600 text-white shadow-md shadow-primary-600/20" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
      {label}
    </button>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Devis & factures</h1>
          <p className="text-sm text-slate-500 mt-0.5">Tous vos documents commerciaux, classés et archivés au même endroit.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/clients"
            className="border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2">
            <Users className="w-4 h-4" />Clients
          </Link>
          <button onClick={() => navigate(`/admin/documents/nouveau?type=DEVIS${siteId ? `&siteId=${siteId}` : ""}${clientId ? `&clientId=${clientId}` : ""}`)}
            className="bg-white border border-primary-200 text-primary-700 hover:bg-primary-50 text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2">
            <FilePlus2 className="w-4 h-4" />Nouveau devis
          </button>
          <button onClick={() => navigate(`/admin/documents/nouveau?type=FACTURE${siteId ? `&siteId=${siteId}` : ""}${clientId ? `&clientId=${clientId}` : ""}`)}
            className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-primary-600/20 flex items-center gap-2">
            <Receipt className="w-4 h-4" />Nouvelle facture
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {typeBtn("", "Tous")}
        {typeBtn("DEVIS", "Devis")}
        {typeBtn("FACTURE", "Factures")}
      </div>

      <Card className="space-y-3 rounded-2xl">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un numéro, un client, un objet..."
            className={`${inputCls} pl-10`} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Dropdown value={status} onChange={setStatus} placeholder="Tous les statuts" icon={<Filter className="w-4 h-4" />}
            options={[{ value: "", label: "Tous les statuts" }, ...statusOptions(type)]} />
          <Dropdown value={clientId} onChange={setClientId} placeholder="Tous les clients" icon={<Building2 className="w-4 h-4" />}
            options={[{ value: "", label: "Tous les clients" }, ...clients.map((c) => ({ value: c.id, label: c.name }))]} />
          <Dropdown value={siteId} onChange={setSiteId} placeholder="Tous les chantiers" icon={<HardHat className="w-4 h-4" />}
            options={[{ value: "", label: "Tous les chantiers" }, ...sites.map((s) => ({ value: s.id, label: s.name }))]} />
          <div>
            <label className="sr-only">Du</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="Du" className={inputCls} />
          </div>
          <div>
            <label className="sr-only">Au</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="Au" className={inputCls} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            {loading ? "Chargement..." : `${docs.length} document${docs.length > 1 ? "s" : ""}`}
            {!loading && docs.length > 0 && (
              <> · Devis : <strong className="text-slate-700">{formatAriary(totals.quotes)}</strong> · Factures : <strong className="text-slate-700">{formatAriary(totals.invoices)}</strong></>
            )}
          </span>
          <div className="flex gap-2">
            {hasFilters && (
              <button onClick={resetFilters} className="px-3 py-1.5 rounded-lg font-semibold text-slate-600 hover:bg-slate-100">Effacer les filtres</button>
            )}
            <button onClick={exportCsv} disabled={docs.length === 0}
              className="px-3 py-1.5 rounded-lg font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-40">
              <Download className="w-3.5 h-3.5" />Exporter CSV
            </button>
          </div>
        </div>
      </Card>

      <Card className="p-0 rounded-2xl overflow-hidden">
        {!loading && docs.length === 0 ? (
          <div className="p-8">
            <EmptyState message={hasFilters || type ? "Aucun document pour ces critères." : "Aucun devis ni facture pour le moment."} />
          </div>
        ) : (
          <>
            {/* Ordinateur : tableau */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wider font-bold">
                    <th className="py-3 px-4">Numéro</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Chantier</th>
                    <th className="py-3 px-4">Objet</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {docs.map((d) => {
                    const st = statusInfo(d.type, d.status)
                    return (
                      <tr key={d.id} onClick={() => navigate(`/admin/documents/${d.id}`)} className="cursor-pointer hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 font-mono text-xs">{d.number}</div>
                          <div className="text-xs text-slate-400">{DOCUMENT_TYPE[d.type].label}</div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">{fmtDay(d.issueDate)}</td>
                        <td className="py-3 px-4 font-medium text-slate-800">{d.clientName || "—"}</td>
                        <td className="py-3 px-4 text-slate-600">{d.siteName ?? "—"}</td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{d.subject || "—"}</td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-900 whitespace-nowrap">{formatAriary(d.total)}</td>
                        <td className="py-3 px-4"><Badge tone={st.tone}>{st.label}</Badge></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile : cartes */}
            <div className="md:hidden divide-y divide-slate-100">
              {docs.map((d) => {
                const st = statusInfo(d.type, d.status)
                return (
                  <button key={d.id} onClick={() => navigate(`/admin/documents/${d.id}`)} className="w-full text-left p-4 hover:bg-slate-50 transition space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 min-w-0">
                        {d.type === "DEVIS" ? <FileText className="w-4 h-4 text-primary-600 shrink-0" /> : <Receipt className="w-4 h-4 text-emerald-600 shrink-0" />}
                        <span className="font-bold text-slate-900 font-mono text-xs truncate">{d.number}</span>
                      </span>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                    <div className="text-sm font-medium text-slate-800 truncate">{d.clientName || "—"}</div>
                    {d.subject && <div className="text-xs text-slate-500 truncate">{d.subject}</div>}
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{fmtDay(d.issueDate)}{d.siteName ? ` · ${d.siteName}` : ""}</span>
                      <span className="font-bold text-slate-900 text-sm">{formatAriary(d.total)}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </Card>

      {toast && <Toast message={toast} tone="error" onClose={() => setToast(null)} />}
    </div>
  )
}
