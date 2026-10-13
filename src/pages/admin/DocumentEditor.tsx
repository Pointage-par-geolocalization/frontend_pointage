// src/pages/admin/DocumentEditor.tsx
// Création / modification d'un devis ou d'une facture : client, chantier, dates, objet,
// prestations (quantité × prix unitaire), TVA et notes. Le numéro est attribué par le serveur.
import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"
import {
  computeTotals, createDocument, getDocument, isEditable, updateDocument, DOCUMENT_TYPE,
  type BusinessDocument, type DocumentInput, type DocumentType,
} from "../../services/documents"
import { listClients, type Client } from "../../services/clients"
import { listSites, type Site } from "../../services/sites"
import { getSettings } from "../../services/settings"
import { errorMessage } from "../../services/api"
import { formatAriary } from "../../utils/salaryCalculator"
import { todayKey } from "../../utils/date"
import Card from "../../components/Card"
import Dropdown from "../../components/Dropdown"
import Toast from "../../components/Toast"
import { ArrowLeft, ArrowDown, ArrowUp, Building2, HardHat, Plus, Save, Trash2, Lock } from "lucide-react"

interface LineForm { key: number; description: string; quantity: string; unit: string; unitPrice: string }

let nextKey = 1
const newLine = (l?: Partial<Omit<LineForm, "key">>): LineForm => ({
  key: nextKey++, description: "", quantity: "1", unit: "", unitPrice: "", ...l,
})

/** "1,5" ou "1.5" → 1.5 (saisie française tolérée). */
const toNumber = (v: string) => Number(v.replace(",", ".").replace(/\s/g, ""))

export default function DocumentEditor() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const editing = !!id

  const [type, setType] = useState<DocumentType>(params.get("type") === "FACTURE" ? "FACTURE" : "DEVIS")
  const [issueDate, setIssueDate] = useState(todayKey())
  const [dueDate, setDueDate] = useState("")
  const [clientId, setClientId] = useState(params.get("clientId") ?? "")
  const [siteId, setSiteId] = useState(params.get("siteId") ?? "")
  const [subject, setSubject] = useState("")
  const [lines, setLines] = useState<LineForm[]>(() => [newLine()])
  const [taxRate, setTaxRate] = useState("0")
  const [notes, setNotes] = useState("")

  const [existing, setExisting] = useState<BusinessDocument | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(editing)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    listClients().then(setClients).catch(() => setToast("Impossible de charger les clients."))
    listSites().then(setSites).catch(() => {})
  }, [])

  // Nouveau document : TVA par défaut des paramètres ; client du chantier si fourni.
  useEffect(() => {
    if (editing) return
    getSettings().then((s) => setTaxRate(String(s.defaultTaxRate ?? 0))).catch(() => {})
  }, [editing])

  useEffect(() => {
    if (editing || clientId || !siteId) return
    const site = sites.find((s) => s.id === siteId)
    if (site?.clientId) setClientId(site.clientId)
  }, [sites]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!id) return
    let cancelled = false
    getDocument(id)
      .then((d) => {
        if (cancelled) return
        setExisting(d)
        setType(d.type)
        setIssueDate(d.issueDate)
        setDueDate(d.dueDate ?? "")
        setClientId(d.clientId ?? "")
        setSiteId(d.siteId ?? "")
        setSubject(d.subject)
        setLines(d.lines.length ? d.lines.map((l) => newLine({
          description: l.description, quantity: String(l.quantity), unit: l.unit ?? "", unitPrice: String(l.unitPrice),
        })) : [newLine()])
        setTaxRate(String(d.taxRate))
        setNotes(d.notes)
      })
      .catch((e) => { if (!cancelled) setLoadError(errorMessage(e, "Document introuvable.")) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  const parsedLines = useMemo(
    () => lines.map((l) => ({ description: l.description.trim(), quantity: toNumber(l.quantity) || 0, unit: l.unit.trim(), unitPrice: toNumber(l.unitPrice) || 0 })),
    [lines],
  )
  const totals = useMemo(() => computeTotals(parsedLines, toNumber(taxRate) || 0), [parsedLines, taxRate])

  function selectSite(v: string) {
    setSiteId(v)
    const site = sites.find((s) => s.id === v)
    if (site?.clientId && !clientId) setClientId(site.clientId)
  }

  function updateLine(key: number, patch: Partial<LineForm>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function moveLine(index: number, delta: number) {
    setLines((prev) => {
      const target = index + delta
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function removeLine(key: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : [newLine()]))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!clientId) { setError("Choisissez le client du document."); return }
    const filled = parsedLines.filter((l) => l.description || l.unitPrice)
    if (filled.length === 0) { setError("Ajoutez au moins une prestation."); return }
    const bad = filled.findIndex((l) => !l.description || l.quantity <= 0 || l.unitPrice < 0)
    if (bad >= 0) { setError(`Ligne ${bad + 1} : désignation, quantité (> 0) et prix unitaire (≥ 0) sont requis.`); return }
    const rate = toNumber(taxRate)
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) { setError("Le taux de TVA doit être compris entre 0 et 100 %."); return }
    if (dueDate && dueDate < issueDate) { setError(`La date ${type === "DEVIS" ? "de validité" : "d'échéance"} doit être postérieure à la date d'émission.`); return }

    const payload: DocumentInput = {
      type, issueDate, dueDate: dueDate || null, clientId, siteId: siteId || null,
      subject: subject.trim(), lines: filled, taxRate: rate, notes: notes.trim(),
    }
    setSaving(true)
    try {
      if (id) {
        const { type: _type, ...changes } = payload
        await updateDocument(id, changes)
        navigate(`/admin/documents/${id}`)
      } else {
        const created = await createDocument(payload)
        navigate(`/admin/documents/${created.id}`)
      }
    } catch (err) {
      setError(errorMessage(err, "Le document n'a pas pu être enregistré."))
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none transition"
  const backTo = id ? `/admin/documents/${id}` : "/admin/documents"

  if (loading) {
    return <div className="flex justify-center py-20 text-slate-400 text-sm">Chargement...</div>
  }

  if (loadError || (existing && !isEditable(existing))) {
    return (
      <Card className="max-w-lg mx-auto text-center space-y-4 rounded-2xl p-8">
        <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto"><Lock className="w-6 h-6" /></div>
        <p className="text-sm text-slate-600">
          {loadError ?? (existing?.type === "FACTURE"
            ? "Cette facture n'est plus modifiable : seule une facture en brouillon peut être modifiée. Vous pouvez l'annuler et en créer une nouvelle."
            : "Ce devis n'est plus modifiable car il a été accepté ou refusé.")}
        </p>
        <Link to={existing ? `/admin/documents/${existing.id}` : "/admin/documents"}
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:underline">
          <ArrowLeft className="w-4 h-4" />Retour
        </Link>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-start gap-3">
          <Link to={backTo} className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Retour"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
              {id ? `Modifier ${type === "DEVIS" ? "le devis" : "la facture"}` : type === "DEVIS" ? "Nouveau devis" : "Nouvelle facture"}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              N° <span className="font-mono font-semibold text-slate-700">{existing?.number ?? "attribué à l'enregistrement"}</span>
            </p>
          </div>
        </div>
        {!id && (
          <div className="flex gap-1 bg-slate-100/80 p-1 rounded-xl">
            {(["DEVIS", "FACTURE"] as DocumentType[]).map((t) => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${type === t ? "bg-white text-primary-700 shadow-sm" : "text-slate-500"}`}>
                {DOCUMENT_TYPE[t].label}
              </button>
            ))}
          </div>
        )}
      </div>

      <Card className="rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-600">Client *</label>
            <Link to="/admin/clients" className="text-xs font-medium text-primary-700 hover:underline">Gérer les clients</Link>
          </div>
          {clients.length === 0 ? (
            <p className="text-xs text-rose-600 py-2.5">Aucun client. <Link to="/admin/clients" className="underline font-medium">Créez-en un</Link> d'abord.</p>
          ) : (
            <Dropdown value={clientId} onChange={setClientId} placeholder="Choisir un client" icon={<Building2 className="w-4 h-4" />}
              options={clients.map((c) => ({ value: c.id, label: c.name }))} />
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Chantier (facultatif)</label>
          <Dropdown value={siteId} onChange={selectSite} placeholder="Aucun chantier" icon={<HardHat className="w-4 h-4" />}
            options={[{ value: "", label: "Aucun chantier" }, ...sites.map((s) => ({ value: s.id, label: s.name }))]} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date d'émission *</label>
          <input type="date" required value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">{type === "DEVIS" ? "Valable jusqu'au" : "Date d'échéance"}</label>
          <input type="date" value={dueDate} min={issueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Objet</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200}
            placeholder="Ex : Rénovation de la toiture — bâtiment B" className={inputCls} />
        </div>
      </Card>

      <Card className="rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Prestations</h2>
          <button type="button" onClick={() => setLines((p) => [...p, newLine()])}
            className="text-sm font-semibold text-primary-700 hover:bg-primary-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
            <Plus className="w-4 h-4" />Ajouter une ligne
          </button>
        </div>

        <div className="hidden md:grid grid-cols-[1fr_90px_90px_130px_130px_auto] gap-2 text-[11px] uppercase tracking-wider font-bold text-slate-400 px-1">
          <span>Désignation</span><span>Quantité</span><span>Unité</span><span>Prix unitaire (Ar)</span><span className="text-right">Montant</span><span className="w-[88px]" />
        </div>

        <div className="space-y-3 md:space-y-2">
          {lines.map((l, i) => (
            <div key={l.key} className="grid grid-cols-2 md:grid-cols-[1fr_90px_90px_130px_130px_auto] gap-2 items-center bg-slate-50 md:bg-transparent rounded-xl p-3 md:p-0 border border-slate-100 md:border-0">
              <input value={l.description} onChange={(e) => updateLine(l.key, { description: e.target.value })} placeholder="Désignation"
                aria-label={`Désignation ligne ${i + 1}`} className={`${inputCls} col-span-2 md:col-span-1`} />
              <input value={l.quantity} onChange={(e) => updateLine(l.key, { quantity: e.target.value })} inputMode="decimal" placeholder="Qté"
                aria-label={`Quantité ligne ${i + 1}`} className={inputCls} />
              <input value={l.unit} onChange={(e) => updateLine(l.key, { unit: e.target.value })} placeholder="u, m², h…" maxLength={20}
                aria-label={`Unité ligne ${i + 1}`} className={inputCls} />
              <input value={l.unitPrice} onChange={(e) => updateLine(l.key, { unitPrice: e.target.value })} inputMode="decimal" placeholder="0"
                aria-label={`Prix unitaire ligne ${i + 1}`} className={inputCls} />
              <div className="text-right font-semibold text-slate-900 text-sm px-1">{formatAriary(totals.lines[i]?.amount ?? 0)}</div>
              <div className="flex items-center justify-end gap-0.5 col-span-2 md:col-span-1">
                <button type="button" onClick={() => moveLine(i, -1)} disabled={i === 0} title="Monter"
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
                <button type="button" onClick={() => moveLine(i, 1)} disabled={i === lines.length - 1} title="Descendre"
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
                <button type="button" onClick={() => removeLine(l.key)} title="Supprimer la ligne"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-end gap-1.5 pt-3 border-t border-slate-100 text-sm">
          <div className="flex justify-between w-full max-w-xs"><span className="text-slate-500">Sous-total</span><span className="font-semibold text-slate-900">{formatAriary(totals.subtotal)}</span></div>
          <div className="flex justify-between items-center w-full max-w-xs gap-3">
            <label className="text-slate-500 flex items-center gap-2">
              TVA
              <input value={taxRate} onChange={(e) => setTaxRate(e.target.value)} inputMode="decimal" aria-label="Taux de TVA (%)"
                className="w-16 border border-slate-300 rounded-lg px-2 py-1 text-sm bg-slate-50 text-right" /> %
            </label>
            <span className="font-semibold text-slate-900">{formatAriary(totals.taxAmount)}</span>
          </div>
          <div className="flex justify-between w-full max-w-xs pt-1.5 border-t border-slate-200 text-base"><span className="font-bold text-slate-900">Total</span><span className="font-extrabold text-primary-700">{formatAriary(totals.total)}</span></div>
        </div>
      </Card>

      <Card className="rounded-2xl">
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notes / conditions</label>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000}
          placeholder="Conditions de paiement, délais d'exécution, mentions particulières..." className={inputCls} />
      </Card>

      {error && <div className="text-sm text-rose-600 font-medium bg-rose-50 p-3 rounded-xl">{error}</div>}

      <div className="flex justify-end gap-3">
        <Link to={backTo} className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition">Annuler</Link>
        <button type="submit" disabled={saving}
          className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-md transition disabled:opacity-60 flex items-center gap-2">
          <Save className="w-4 h-4" />{saving ? "Enregistrement..." : `Enregistrer ${type === "DEVIS" ? "le devis" : "la facture"}`}
        </button>
      </div>

      {toast && <Toast message={toast} tone="error" onClose={() => setToast(null)} />}
    </form>
  )
}
