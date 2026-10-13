// src/pages/admin/Workplaces.tsx
import { useEffect, useState } from "react"
import { listWorkplaces, createWorkplace, updateWorkplace, deleteWorkplace, type Workplace } from "../../services/workplaces"
import { useConfirm } from "../../contexts/ConfirmContext"
import Card from "../../components/Card"
import Badge from "../../components/Badge"
import EmptyState from "../../components/EmptyState"
import LocationPicker, { type LatLng } from "../../components/LocationPicker"
import { MapPin, Plus, Edit3, Trash2, Power, X, Navigation } from "lucide-react"

const emptyForm = { name: "", latitude: "", longitude: "", radiusMeters: "100", geofencingEnabled: true }

export default function AdminWorkplaces() {
  const confirm = useConfirm()
  const [list, setList] = useState<Workplace[]>([])
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Position sélectionnée (null tant que les champs ne contiennent pas des coordonnées valides).
  const lat = parseFloat(form.latitude)
  const lng = parseFloat(form.longitude)
  const coordsValid = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  const picked: LatLng | null = coordsValid ? { latitude: lat, longitude: lng } : null
  const radius = parseFloat(form.radiusMeters)

  function setPosition(p: LatLng) {
    setForm((f) => ({ ...f, latitude: p.latitude.toFixed(6), longitude: p.longitude.toFixed(6) }))
  }

  function closeForm() {
    setForm(emptyForm)
    setEditingId(null)
    setFormError(null)
    setShowForm(false)
  }

  async function refresh() { setList(await listWorkplaces()) }
  useEffect(() => { refresh() }, [])

  function startEdit(w: Workplace) {
    setEditingId(w.id)
    setFormError(null)
    setForm({
      name: w.name,
      latitude: String(w.latitude),
      longitude: String(w.longitude),
      radiusMeters: String(w.radiusMeters),
      geofencingEnabled: w.geofencingEnabled,
    })
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!coordsValid) { setFormError("Sélectionnez une position sur la carte ou saisissez des coordonnées valides."); return }
    if (!Number.isFinite(radius) || radius <= 0) { setFormError("Le rayon doit être supérieur à 0 mètre."); return }
    const payload = {
      name: form.name.trim(),
      latitude: lat,
      longitude: lng,
      radiusMeters: radius,
      geofencingEnabled: form.geofencingEnabled,
    }

    setSaving(true); setFormError(null)
    try {
      if (editingId) {
        await updateWorkplace(editingId, payload)
      } else {
        await createWorkplace(payload)
      }
      closeForm()
      refresh()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Échec de l'enregistrement.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      
      {/* En-tête de page */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Lieux de travail & Départements</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gérez les emplacements géographiques et les zones autorisées pour le pointage.</p>
        </div>
        <button
          onClick={() => {
            if (showForm) { closeForm(); return }
            setForm(emptyForm)
            setEditingId(null)
            setShowForm(true)
          }}
          className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4.5 py-2.5 rounded-xl transition shadow-md shadow-primary-600/20 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>{showForm ? "Fermer le formulaire" : "Nouveau lieu"}</span>
        </button>
      </div>

      {/* Formulaire d'ajout / modification */}
      {showForm && (
        <Card className="p-6 border border-slate-200/80 shadow-sm rounded-2xl">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
            <h2 className="font-bold text-base text-slate-900">
              {editingId ? "Modifier le lieu de travail" : "Créer un nouveau lieu de travail"}
            </h2>
            <button 
              type="button"
              onClick={closeForm} 
              className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nom du lieu / Département</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Siège Social, Entrepôt..."
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none transition"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Rayon autorisé (mètres)</label>
              <input
                type="number"
                min={1}
                value={form.radiusMeters}
                onChange={(e) => setForm({ ...form, radiusMeters: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none transition"
                required
              />
            </div>
            <div className="md:col-span-2 bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary-600" />
                <span className="text-sm font-semibold text-slate-800">Choisir l'emplacement sur la carte</span>
              </div>
              <LocationPicker value={picked} radiusMeters={Number.isFinite(radius) ? radius : undefined} onChange={setPosition} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Latitude</label>
              <input
                value={form.latitude}
                type="number"
                step="any"
                inputMode="decimal"
                onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                placeholder="Ex: -18.91368"
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none transition"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Longitude</label>
              <input
                value={form.longitude}
                type="number"
                step="any"
                inputMode="decimal"
                onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                placeholder="Ex: 47.52529"
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none transition"
                required
              />
            </div>

            <div className="md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-slate-800 block">Activer le géofencing (contrôle GPS)</span>
                <span className="text-xs text-slate-500">Restreindre le pointage aux coordonnées exactes de ce lieu.</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.geofencingEnabled}
                  onChange={(e) => setForm({ ...form, geofencingEnabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>

            {formError && <p className="md:col-span-2 text-sm text-rose-600 font-medium">{formError}</p>}

            <div className="md:col-span-2 pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeForm}
                className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-md transition disabled:opacity-60"
              >
                {saving ? "Enregistrement..." : editingId ? "Mettre à jour" : "Enregistrer le lieu"}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Liste des lieux */}
      <Card className="p-0 border border-slate-200/80 shadow-sm rounded-2xl overflow-hidden">
        {list.length === 0 ? (
          <div className="p-8">
            <EmptyState message="Aucun lieu de travail défini pour le moment." />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {list.map((w) => (
              <div key={w.id} className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-slate-50/60 transition">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{w.name}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1 font-mono bg-slate-100 px-2 py-0.5 rounded-md text-slate-600">
                        <Navigation className="w-3 h-3 text-slate-400" />
                        {w.latitude.toFixed(5)}, {w.longitude.toFixed(5)}
                      </span>
                      <span>•</span>
                      <span>Rayon : <strong className="text-slate-700">{w.radiusMeters} m</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                  <Badge tone={w.geofencingEnabled ? "green" : "gray"}>
                    {w.geofencingEnabled ? "Géofencing Actif" : "Désactivé"}
                  </Badge>

                  <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl">
                    {/* Bouton Modifier */}
                    <button
                      onClick={() => startEdit(w)}
                      className="p-2 text-slate-600 hover:text-blue-600 hover:bg-white rounded-lg transition shadow-sm"
                      title="Modifier ce lieu"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    {/* Activer / Désactiver rapidement */}
                    <button
                      onClick={() => updateWorkplace(w.id, { geofencingEnabled: !w.geofencingEnabled }).then(refresh)}
                      className={`p-2 rounded-lg transition shadow-sm ${w.geofencingEnabled ? "text-amber-600 hover:bg-white" : "text-emerald-600 hover:bg-white"}`}
                      title={w.geofencingEnabled ? "Désactiver le géofencing" : "Activer le géofencing"}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                    {/* Supprimer */}
                    <button
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Supprimer « ${w.name} » ?`,
                          message: "Les salariés affectés à ce lieu ne pourront plus l'utiliser pour pointer.",
                          confirmLabel: "Supprimer", tone: "danger",
                        })
                        if (ok) deleteWorkplace(w.id).then(refresh)
                      }}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition shadow-sm"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      
    </div>
  )
}