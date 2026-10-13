// src/pages/admin/DocumentView.tsx
// Fiche d'un devis ou d'une facture, mise en page comme le document remis au client :
// impression / PDF, changement de statut, facture depuis un devis, historique des versions.
import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  createInvoiceFromQuote, deleteDocument, getDocument, getDocumentVersion, isEditable, setDocumentStatus, statusInfo, DOCUMENT_TYPE,
  type BusinessDocument, type DocumentStatus, type DocumentType,
} from "../../services/documents"
import { getSettings, DEFAULT_APP_SETTINGS, type AppSettings } from "../../services/settings"
import { errorMessage } from "../../services/api"
import { useConfirm } from "../../contexts/ConfirmContext"
import { formatAriary } from "../../utils/salaryCalculator"
import { fmtDateTime, fmtDay } from "../../utils/format"
import Card from "../../components/Card"
import Badge from "../../components/Badge"
import Toast from "../../components/Toast"
import { ArrowLeft, Printer, Pencil, Trash2, Receipt, History, X, Send, CheckCircle2, XCircle, Ban, Banknote, FileText, Link2 } from "lucide-react"

const PRINT_CSS = `
@media print {
  @page { margin: 14mm; }
  body * { visibility: hidden !important; }
  .print-area, .print-area * { visibility: visible !important; }
  .print-area { position: absolute; left: 0; top: 0; width: 100%; border: 0 !important; box-shadow: none !important; padding: 0 !important; }
  .print-area, .print-area * { color: #0f172a !important; background: transparent !important; border-color: #cbd5e1 !important; }
  .no-print { display: none !important; }
}
`

interface Transition { to: DocumentStatus; label: string; icon: React.ReactNode; tone: "danger" | "default"; message: string }

function transitions(type: DocumentType, status: DocumentStatus): Transition[] {
  if (type === "DEVIS") {
    const sent: Transition = { to: "ENVOYE", label: "Marquer envoyé", icon: <Send className="w-4 h-4" />, tone: "default", message: "Le devis sera marqué comme envoyé au client. Il reste modifiable." }
    const accepted: Transition = { to: "ACCEPTE", label: "Accepté", icon: <CheckCircle2 className="w-4 h-4" />, tone: "default", message: "Le client a accepté le devis. Il ne sera plus modifiable ; vous pourrez en créer la facture." }
    const refused: Transition = { to: "REFUSE", label: "Refusé", icon: <XCircle className="w-4 h-4" />, tone: "danger", message: "Le client a refusé le devis. Il ne sera plus modifiable." }
    if (status === "BROUILLON") return [sent, accepted, refused]
    if (status === "ENVOYE") return [accepted, refused]
    return []
  }
  if (status === "BROUILLON") return [{ to: "EMISE", label: "Émettre la facture", icon: <Send className="w-4 h-4" />, tone: "default", message: "Une fois émise, la facture ne pourra plus être modifiée (seulement marquée payée ou annulée)." }]
  if (status === "EMISE") {
    return [
      { to: "PAYEE", label: "Marquer payée", icon: <Banknote className="w-4 h-4" />, tone: "default", message: "La facture sera marquée comme réglée par le client." },
      { to: "ANNULEE", label: "Annuler la facture", icon: <Ban className="w-4 h-4" />, tone: "danger", message: "La facture sera annulée. Elle reste archivée avec son numéro mais n'est plus due." },
    ]
  }
  return []
}

/** Le document tel qu'il est remis au client (aussi utilisé pour afficher une ancienne version). */
function DocumentSheet({ doc, settings, className = "" }: { doc: BusinessDocument; settings: AppSettings; className?: string }) {
  const typeLabel = DOCUMENT_TYPE[doc.type].label
  const client = doc.client ?? { name: doc.clientName }
  const lines = doc.lines ?? []
  const company = [settings.companyAddress, settings.companyPhone && `Tél. : ${settings.companyPhone}`, settings.companyEmail].filter(Boolean)
  const companyIds = [settings.companyNif && `NIF : ${settings.companyNif}`, settings.companyStat && `STAT : ${settings.companyStat}`].filter(Boolean)
  const clientIds = [client.nif && `NIF : ${client.nif}`, client.stat && `STAT : ${client.stat}`].filter(Boolean)

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-10 text-sm text-slate-800 space-y-8 ${className}`}>
      <div className="flex flex-col sm:flex-row justify-between gap-6">
        <div className="space-y-0.5">
          <div className="text-lg font-extrabold text-slate-900">{settings.companyName || "Votre entreprise"}</div>
          {company.map((l) => <div key={l as string} className="text-slate-600 whitespace-pre-line">{l}</div>)}
          {companyIds.length > 0 && <div className="text-xs text-slate-500 pt-1">{companyIds.join(" · ")}</div>}
        </div>
        <div className="sm:text-right space-y-0.5">
          <div className="text-2xl font-extrabold uppercase tracking-wide text-primary-700">{typeLabel}</div>
          <div className="font-mono font-semibold text-slate-900">N° {doc.number}</div>
          <div className="text-slate-600">Date : {fmtDay(doc.issueDate)}</div>
          {doc.dueDate && <div className="text-slate-600">{doc.type === "DEVIS" ? "Valable jusqu'au" : "Échéance"} : {fmtDay(doc.dueDate)}</div>}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 p-4 space-y-0.5">
          <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-1">Client</div>
          <div className="font-bold text-slate-900">{client.name || "—"}</div>
          {client.contactName && <div className="text-slate-600">À l'attention de {client.contactName}</div>}
          {client.address && <div className="text-slate-600 whitespace-pre-line">{client.address}</div>}
          {client.phone && <div className="text-slate-600">Tél. : {client.phone}</div>}
          {client.email && <div className="text-slate-600">{client.email}</div>}
          {clientIds.length > 0 && <div className="text-xs text-slate-500 pt-1">{clientIds.join(" · ")}</div>}
        </div>
        <div className="space-y-2">
          {doc.subject && (
            <div><span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block">Objet</span><span className="font-semibold text-slate-900">{doc.subject}</span></div>
          )}
          {doc.siteName && (
            <div><span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block">Chantier</span>{doc.siteId
              ? <Link to={`/admin/chantiers/${doc.siteId}`} className="text-slate-800 hover:text-primary-700 hover:underline">{doc.siteName}</Link>
              : <span className="text-slate-800">{doc.siteName}</span>}</div>
          )}
          {doc.sourceDocumentNumber && (
            <div><span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block">Devis d'origine</span><span className="font-mono text-slate-800">{doc.sourceDocumentNumber}</span></div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-slate-300 text-left text-slate-500 text-xs uppercase tracking-wider">
              <th className="py-2 pr-3">Désignation</th>
              <th className="py-2 px-3 text-right">Qté</th>
              <th className="py-2 px-3">Unité</th>
              <th className="py-2 px-3 text-right">Prix unitaire</th>
              <th className="py-2 pl-3 text-right">Montant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {lines.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-center text-slate-400">Aucune prestation.</td></tr>
            )}
            {lines.map((l, i) => (
              <tr key={i}>
                <td className="py-2 pr-3 whitespace-pre-line">{l.description}</td>
                <td className="py-2 px-3 text-right whitespace-nowrap">{l.quantity.toLocaleString("fr-FR")}</td>
                <td className="py-2 px-3">{l.unit || ""}</td>
                <td className="py-2 px-3 text-right whitespace-nowrap">{formatAriary(l.unitPrice)}</td>
                <td className="py-2 pl-3 text-right whitespace-nowrap font-semibold">{formatAriary(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <div className="w-full max-w-xs space-y-1.5">
          <div className="flex justify-between"><span className="text-slate-500">Sous-total</span><span className="font-semibold">{formatAriary(doc.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">TVA ({(doc.taxRate ?? 0).toLocaleString("fr-FR")} %)</span><span className="font-semibold">{formatAriary(doc.taxAmount)}</span></div>
          <div className="flex justify-between pt-2 border-t-2 border-slate-300 text-base"><span className="font-bold text-slate-900">Total</span><span className="font-extrabold text-slate-900">{formatAriary(doc.total)}</span></div>
          {doc.type === "FACTURE" && doc.paidAt && <div className="text-right text-xs text-emerald-700 font-semibold">Réglée le {fmtDay(doc.paidAt)}</div>}
        </div>
      </div>

      {doc.notes && (
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Notes</div>
          <p className="text-slate-700 whitespace-pre-line">{doc.notes}</p>
        </div>
      )}

      {settings.documentFooter && (
        <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 text-center whitespace-pre-line">{settings.documentFooter}</div>
      )}
    </div>
  )
}

export default function DocumentView() {
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const confirm = useConfirm()

  const [doc, setDoc] = useState<BusinessDocument | null>(null)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null)
  const [version, setVersion] = useState<{ number: number; doc: BusinessDocument } | null>(null)
  const [loadingVersion, setLoadingVersion] = useState<number | null>(null)

  async function refresh() {
    try {
      setDoc(await getDocument(id))
      setLoadError(null)
    } catch (e) {
      setLoadError(errorMessage(e, "Document introuvable."))
    }
  }

  useEffect(() => { setDoc(null); refresh() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { getSettings().then(setSettings).catch(() => {}) }, [])

  async function run(fn: () => Promise<unknown>, okMsg: string) {
    setBusy(true)
    try { await fn(); await refresh(); setToast({ msg: okMsg, tone: "success" }) }
    catch (e) { setToast({ msg: errorMessage(e, "Action impossible."), tone: "error" }) }
    finally { setBusy(false) }
  }

  async function changeStatus(t: Transition) {
    if (!doc) return
    const ok = await confirm({ title: `${t.label} — ${doc.number} ?`, message: t.message, confirmLabel: t.label, tone: t.tone })
    if (ok) run(() => setDocumentStatus(doc.id, t.to), `Statut mis à jour : ${statusInfo(doc.type, t.to).label}.`)
  }

  async function handleInvoice() {
    if (!doc) return
    const existing = doc.invoices ?? []
    const ok = await confirm({
      title: "Créer la facture ?",
      message: existing.length
        ? `Ce devis a déjà ${existing.length} facture(s) : ${existing.map((f) => f.number).join(", ")}. Une nouvelle facture brouillon reprenant ses lignes sera créée.`
        : "Une facture brouillon reprenant le client, le chantier et les lignes de ce devis sera créée. Vous pourrez l'ajuster avant de l'émettre.",
      confirmLabel: "Créer la facture",
    })
    if (!ok) return
    setBusy(true)
    try {
      const created = await createInvoiceFromQuote(doc.id)
      navigate(`/admin/documents/${created.id}`)
    } catch (e) {
      setToast({ msg: errorMessage(e, "Impossible de créer la facture."), tone: "error" })
    } finally { setBusy(false) }
  }

  async function handleDelete() {
    if (!doc) return
    const ok = await confirm({
      title: `Supprimer le brouillon ${doc.number} ?`,
      message: "Ce brouillon sera supprimé définitivement.",
      confirmLabel: "Supprimer", tone: "danger",
    })
    if (!ok) return
    setBusy(true)
    try {
      await deleteDocument(doc.id)
      navigate("/admin/documents")
    } catch (e) {
      setToast({ msg: errorMessage(e, "Suppression impossible."), tone: "error" })
      setBusy(false)
    }
  }

  async function openVersion(n: number) {
    setLoadingVersion(n)
    try {
      const v = await getDocumentVersion(id, n)
      setVersion({ number: v.version, doc: { ...doc!, ...v.snapshot } })
    } catch (e) {
      setToast({ msg: errorMessage(e, "Version introuvable."), tone: "error" })
    } finally { setLoadingVersion(null) }
  }

  if (loadError) {
    return (
      <Card className="max-w-lg mx-auto text-center space-y-4 rounded-2xl p-8">
        <p className="text-sm text-slate-600">{loadError}</p>
        <Link to="/admin/documents" className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:underline"><ArrowLeft className="w-4 h-4" />Retour aux documents</Link>
      </Card>
    )
  }
  if (!doc) return <div className="flex justify-center py-20 text-slate-400 text-sm">Chargement...</div>

  const st = statusInfo(doc.type, doc.status)
  const actions = transitions(doc.type, doc.status)
  const versions = [...(doc.versions ?? [])].sort((a, b) => b.version - a.version)
  const btn = "px-3.5 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50 transition"

  return (
    <div className="space-y-5 pb-10">
      <style>{PRINT_CSS}</style>

      <div className="no-print flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-start gap-3 min-w-0">
          <Link to="/admin/documents" className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Retour"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 font-mono">{doc.number}</h1>
              <Badge tone={st.tone}>{st.label}</Badge>
            </div>
            <p className="text-sm text-slate-500 truncate">{DOCUMENT_TYPE[doc.type].label} · {doc.clientName}{doc.subject ? ` · ${doc.subject}` : ""}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => window.print()} className={`${btn} bg-slate-900 hover:bg-slate-800 text-white`}>
            <Printer className="w-4 h-4" />Imprimer / PDF
          </button>
          {isEditable(doc) && (
            <Link to={`/admin/documents/${doc.id}/modifier`} className={`${btn} border border-slate-200 text-slate-700 hover:bg-slate-50`}>
              <Pencil className="w-4 h-4" />Modifier
            </Link>
          )}
          {doc.type === "DEVIS" && doc.status !== "REFUSE" && (
            <button onClick={handleInvoice} disabled={busy} className={`${btn} bg-primary-600 hover:bg-primary-700 text-white`}>
              <Receipt className="w-4 h-4" />Créer la facture
            </button>
          )}
          {doc.status === "BROUILLON" && (
            <button onClick={handleDelete} disabled={busy} className={`${btn} text-rose-600 hover:bg-rose-50`}>
              <Trash2 className="w-4 h-4" />Supprimer
            </button>
          )}
        </div>
      </div>

      {actions.length > 0 && (
        <div className="no-print flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500 font-medium">Changer le statut :</span>
          {actions.map((t) => (
            <button key={t.to} onClick={() => changeStatus(t)} disabled={busy}
              className={`${btn} ${t.tone === "danger" ? "border border-rose-200 text-rose-600 hover:bg-rose-50" : "border border-primary-200 text-primary-700 hover:bg-primary-50"}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_300px] items-start">
        <DocumentSheet doc={doc} settings={settings} className="print-area" />

        <div className="no-print space-y-4">
          {(doc.sourceDocumentId || (doc.invoices?.length ?? 0) > 0) && (
            <Card className="rounded-2xl space-y-2">
              <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2"><Link2 className="w-4 h-4 text-primary-600" />Documents liés</h2>
              {doc.sourceDocumentId && (
                <Link to={`/admin/documents/${doc.sourceDocumentId}`} className="flex items-center gap-2 text-sm text-primary-700 hover:underline">
                  <FileText className="w-4 h-4" />Devis d'origine {doc.sourceDocumentNumber ?? ""}
                </Link>
              )}
              {(doc.invoices ?? []).map((f) => {
                const fs = statusInfo("FACTURE", f.status)
                return (
                  <Link key={f.id} to={`/admin/documents/${f.id}`} className="flex items-center justify-between gap-2 text-sm text-primary-700 hover:underline">
                    <span className="flex items-center gap-2"><Receipt className="w-4 h-4" />Facture {f.number}</span>
                    <Badge tone={fs.tone}>{fs.label}</Badge>
                  </Link>
                )
              })}
            </Card>
          )}

          <Card className="rounded-2xl space-y-3">
            <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2"><History className="w-4 h-4 text-primary-600" />Historique des versions</h2>
            {versions.length === 0 ? (
              <p className="text-xs text-slate-400">Aucune version enregistrée.</p>
            ) : (
              <ol className="space-y-1.5">
                {versions.map((v) => (
                  <li key={v.version}>
                    <button onClick={() => openVersion(v.version)} disabled={loadingVersion !== null}
                      className="w-full text-left rounded-xl px-3 py-2 hover:bg-slate-50 border border-slate-100 transition disabled:opacity-60">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-700">Version {v.version}{v.version === doc.version ? " (actuelle)" : ""}</span>
                        <span className="text-[11px] text-slate-400">{loadingVersion === v.version ? "..." : fmtDateTime(v.changedAt)}</span>
                      </div>
                      <div className="text-xs text-slate-500">{v.changeLabel}{v.changedByLabel ? ` · ${v.changedByLabel}` : ""}</div>
                    </button>
                  </li>
                ))}
              </ol>
            )}
            <p className="text-[11px] text-slate-400">Créé le {fmtDateTime(doc.createdAt)} · modifié le {fmtDateTime(doc.updatedAt)}</p>
          </Card>
        </div>
      </div>

      {version && (
        <div className="no-print fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={() => setVersion(null)}>
          <div className="w-full max-w-4xl max-h-[90dvh] overflow-y-auto space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between bg-white rounded-2xl px-5 py-3 shadow-xl">
              <div>
                <div className="font-bold text-slate-900">Version {version.number}</div>
                <div className="text-xs text-slate-500">Consultation en lecture seule</div>
              </div>
              <button onClick={() => setVersion(null)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center" aria-label="Fermer"><X className="w-4 h-4" /></button>
            </div>
            <DocumentSheet doc={version.doc} settings={settings} />
          </div>
        </div>
      )}

      {toast && <Toast message={toast.msg} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  )
}
