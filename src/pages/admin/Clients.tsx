// src/pages/admin/Clients.tsx
// Fichier clients : coordonnées reprises sur les chantiers, devis et factures.
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { createClient, deleteClient, listClients, updateClient, type Client, type ClientInput } from "../../services/clients"
import { errorMessage } from "../../services/api"
import { useConfirm } from "../../contexts/ConfirmContext"
import Card from "../../components/Card"
import EmptyState from "../../components/EmptyState"
import Toast from "../../components/Toast"
import { Building2, Plus, Search, Pencil, Trash2, X, Phone, Mail, MapPin, FileText, FilePlus2, User } from "lucide-react"

type FormState = Record<keyof ClientInput, string>

const emptyForm: FormState = { name: "", contactName: "", phone: "", email: "", address: "", nif: "", stat: "", notes: "" }

const FIELDS: { key: keyof ClientInput; label: string; placeholder?: string; type?: string }[] = [
  { key: "name", label: "Nom / raison sociale *", placeholder: "Ex : Société ABC" },
  { key: "contactName", label: "Personne à contacter" },
  { key: "phone", label: "Téléphone", type: "tel" },
  { key: "email", label: "Email", type: "email" },
  { key: "nif", label: "NIF" },
  { key: "stat", label: "STAT" },
]

const toInput = (f: FormState): ClientInput => ({
  name: f.name.trim(),
  contactName: f.contactName.trim() || null,
  phone: f.phone.trim() || null,
  email: f.email.trim() || null,
  address: f.address.trim() || null,
  nif: f.nif.trim() || null,
  stat: f.stat.trim() || null,
  notes: f.notes.trim() || null,
})

export default function AdminClients() {
  const confirm = useConfirm()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null)

  async function refresh() {
    try { setClients(await listClients()) }
    catch (e) { setToast({ msg: errorMessage(e, "Impossible de charger les clients."), tone: "error" }) }
    finally { setLoading(false) }
  }
  useEffect(() => { refresh() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = [...clients].sort((a, b) => a.name.localeCompare(b.name, "fr"))
    if (!q) return list
    return list.filter((c) =>
      [c.name, c.contactName, c.phone, c.email, c.address, c.nif].some((v) => v?.toLowerCase().includes(q)))
  }, [clients, search])

  function openForm(c?: Client) {
    setEditing(c ?? null)
    setForm(c ? {
      name: c.name, contactName: c.contactName ?? "", phone: c.phone ?? "", email: c.email ?? "",
      address: c.address ?? "", nif: c.nif ?? "", stat: c.stat ?? "", notes: c.notes ?? "",
    } : emptyForm)
    setFormError(null)
    setFormOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setFormError("Le nom du client est obligatoire."); return }
    setSaving(true); setFormError(null)
    try {
      if (editing) await updateClient(editing.id, toInput(form))
      else await createClient(toInput(form))
      setFormOpen(false)
      setToast({ msg: editing ? "Client mis à jour." : "Client ajouté.", tone: "success" })
      refresh()
    } catch (err) {
      setFormError(errorMessage(err, "Le client n'a pas pu être enregistré."))
    } finally { setSaving(false) }
  }

  async function handleDelete(c: Client) {
    const ok = await confirm({
      title: `Supprimer « ${c.name} » ?`,
      message: "Le client sera retiré de la liste. Les chantiers, devis et factures existants conservent ses coordonnées.",
      confirmLabel: "Supprimer", tone: "danger",
    })
    if (!ok) return
    try {
      await deleteClient(c.id)
      setToast({ msg: "Client supprimé.", tone: "success" })
      refresh()
    } catch (err) {
      setToast({ msg: errorMessage(err, "Suppression impossible."), tone: "error" })
    }
  }

  const inputCls = "w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none transition"

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Clients</h1>
          <p className="text-sm text-slate-500 mt-0.5">Coordonnées reprises sur vos chantiers, devis et factures.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/documents" className="border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2">
            <FileText className="w-4 h-4" />Devis & factures
          </Link>
          <button onClick={() => openForm()}
            className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-primary-600/20 flex items-center gap-2">
            <Plus className="w-4 h-4" />Nouveau client
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un client (nom, contact, téléphone, NIF...)"
          className="w-full border border-slate-300 rounded-xl pl-10 pr-3 py-3 text-base sm:text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none" />
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-10">Chargement...</p>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl"><EmptyState message={clients.length === 0 ? "Aucun client. Ajoutez-en avec « Nouveau client »." : "Aucun résultat."} /></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <Card key={c.id} className="rounded-2xl space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0"><Building2 className="w-5 h-5" /></div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 truncate">{c.name}</div>
                    {c.contactName && <div className="text-xs text-slate-500 flex items-center gap-1 truncate"><User className="w-3 h-3" />{c.contactName}</div>}
                  </div>
                </div>
                <div className="flex shrink-0">
                  <button onClick={() => openForm(c)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" title="Modifier"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Supprimer"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="text-xs text-slate-600 space-y-1">
                {c.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-slate-400" />{c.phone}</div>}
                {c.email && <div className="flex items-center gap-2 truncate"><Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />{c.email}</div>}
                {c.address && <div className="flex items-start gap-2"><MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" /><span className="whitespace-pre-line">{c.address}</span></div>}
                {(c.nif || c.stat) && <div className="text-slate-500">{[c.nif && `NIF : ${c.nif}`, c.stat && `STAT : ${c.stat}`].filter(Boolean).join(" · ")}</div>}
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
                <Link to={`/admin/documents?clientId=${c.id}`} className="mt-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />Voir ses documents
                </Link>
                <Link to={`/admin/documents/nouveau?type=DEVIS&clientId=${c.id}`} className="mt-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 flex items-center gap-1">
                  <FilePlus2 className="w-3.5 h-3.5" />Nouveau devis
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <form onSubmit={handleSubmit} className="bg-white rounded-3xl w-full max-w-xl p-6 space-y-4 shadow-2xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <h2 className="font-bold text-lg text-slate-900">{editing ? "Modifier le client" : "Nouveau client"}</h2>
              <button type="button" onClick={() => setFormOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center" aria-label="Fermer"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FIELDS.map((f) => (
                <div key={f.key} className={f.key === "name" ? "sm:col-span-2" : ""}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">{f.label}</label>
                  <input type={f.type ?? "text"} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder} required={f.key === "name"} autoFocus={f.key === "name"} className={inputCls} />
                </div>
              ))}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Adresse</label>
                <textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notes</label>
                <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} />
              </div>
            </div>
            {formError && <div className="text-sm text-rose-600 font-medium bg-rose-50 p-3 rounded-xl">{formError}</div>}
            <div className="flex gap-3">
              <button type="button" onClick={() => setFormOpen(false)} className="flex-1 border border-slate-200 text-slate-700 font-medium py-3 rounded-xl hover:bg-slate-50">Annuler</button>
              <button type="submit" disabled={saving || !form.name.trim()} className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl disabled:opacity-60">
                {saving ? "..." : "Enregistrer"}
              </button>
            </div>
          </form>
        </div>
      )}

      {toast && <Toast message={toast.msg} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  )
}
