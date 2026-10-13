// src/pages/admin/Settings.tsx
import { useEffect, useState } from "react"
import { getSettings, updateSettings, DEFAULT_APP_SETTINGS, type AppSettings } from "../../services/settings"
import { verifyAdminPassword } from "../../services/auth"
import { resetAllData } from "../../services/admin"
import { errorMessage } from "../../services/api"
import { getHourlyRate, formatAriary } from "../../utils/salaryCalculator"
import Card from "../../components/Card"
import ThemeToggle from "../../components/ThemeToggle"
import { useConfirm } from "../../contexts/ConfirmContext"
import { Trash2 } from "lucide-react"
import Toast from "../../components/Toast"

const inputCls = "w-full border rounded-lg px-3 py-2 text-sm"

export default function AdminSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS)
  const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null)
  const [saving, setSaving] = useState(false)
  const confirm = useConfirm()
  const [resetOpen, setResetOpen] = useState(false)
  const [resetPwd, setResetPwd] = useState("")
  const [resetBusy, setResetBusy] = useState(false)
  const [resetError, setResetError] = useState("")

  useEffect(() => {
    getSettings().then(setSettings).catch((e) => setToast({ msg: errorMessage(e, "Impossible de charger les paramètres."), tone: "error" }))
  }, [])

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => setSettings((s) => ({ ...s, [key]: value }))

  async function save(fields: (keyof AppSettings)[], e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const data = Object.fromEntries(fields.map((f) => [f, settings[f]])) as Partial<AppSettings>
      await updateSettings(data)
      setToast({ msg: "Paramètres enregistrés.", tone: "success" })
    } catch (err) {
      setToast({ msg: errorMessage(err, "Enregistrement impossible."), tone: "error" })
    } finally {
      setSaving(false)
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setResetError("")
    if (!resetPwd) return
    setResetBusy(true)
    try {
      await verifyAdminPassword(resetPwd) // mot de passe vérifié avant la confirmation
      const ok = await confirm({
        title: "Supprimer toutes les données ?",
        message: "Salariés, comptes salariés, présences, historique, rémunérations, paiements, permissions, contrôles de présence, discussions, matériel… Cette action est irréversible.",
        confirmLabel: "Tout supprimer",
        tone: "danger",
      })
      if (!ok) return
      await resetAllData(resetPwd) // le serveur revérifie le mot de passe
      setToast({ msg: "Toutes les données ont été supprimées.", tone: "success" })
      setResetOpen(false)
      setResetPwd("")
    } catch (err) {
      setResetError(errorMessage(err, "Échec de la réinitialisation."))
    } finally {
      setResetBusy(false)
    }
  }

  const hourlyRate = getHourlyRate(settings)

  return (
    <div className="space-y-4 max-w-lg">
      <h1 className="text-xl font-bold">Paramètres → Apparence</h1>
      <Card>
        <ThemeToggle />
      </Card>

      <h1 className="text-xl font-bold">Paramètres → Rémunération</h1>
      <Card>
        <form onSubmit={(e) => save(["dailySalary", "normalWorkMinutes", "normalEntryTime", "toleranceMinutes"], e)} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Salaire pour une journée complète (Ar) — proposé par défaut aux nouveaux salariés</label>
            <input type="number" min={0} value={settings.dailySalary}
              onChange={(e) => set("dailySalary", Number(e.target.value))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Heures normales (par jour)</label>
            <input type="number" min={1} max={24} step="0.5" value={settings.normalWorkMinutes / 60}
              onChange={(e) => set("normalWorkMinutes", Math.round(Number(e.target.value) * 60))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Heure d'entrée normale</label>
            <input type="time" value={settings.normalEntryTime}
              onChange={(e) => set("normalEntryTime", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tolérance de retard (minutes)</label>
            <input type="number" min={0} value={settings.toleranceMinutes}
              onChange={(e) => set("toleranceMinutes", Number(e.target.value))} className={inputCls} />
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
            Taux horaire calculé : <span className="font-semibold text-gray-900">{formatAriary(hourlyRate)} / heure</span><br />
            Plafond journalier : <span className="font-semibold text-gray-900">{formatAriary(settings.dailySalary)}</span>
          </div>

          <button type="submit" disabled={saving} className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60">
            Enregistrer
          </button>
        </form>
      </Card>

      <h1 className="text-xl font-bold">Paramètres → Contrôle de présence</h1>
      <Card>
        <form onSubmit={(e) => save(["presenceCheckEnabled", "presenceCheckIntervalMinutes"], e)} className="space-y-4">
          <p className="text-xs text-gray-500">
            Pendant leur pointage, la position des salariés est comparée à intervalle régulier à la zone autorisée de leur
            lieu de travail / chantier. Résultats : Dashboard et page « Contrôles de présence ».
          </p>
          <label className="flex items-center justify-between gap-3 text-sm font-medium">
            Vérification automatique
            <input type="checkbox" checked={settings.presenceCheckEnabled}
              onChange={(e) => set("presenceCheckEnabled", e.target.checked)} className="w-5 h-5 accent-primary-600" />
          </label>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Intervalle entre deux contrôles</label>
            <select value={settings.presenceCheckIntervalMinutes} disabled={!settings.presenceCheckEnabled}
              onChange={(e) => set("presenceCheckIntervalMinutes", Number(e.target.value))} className={`${inputCls} disabled:opacity-60`}>
              {[30, 60, 120, 180, 240].map((m) => (
                <option key={m} value={m}>{m < 60 ? `${m} minutes` : `${m / 60} heure${m > 60 ? "s" : ""}`}</option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={saving} className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60">
            Enregistrer
          </button>
        </form>
      </Card>

      <h1 className="text-xl font-bold">Paramètres → Entreprise (devis & factures)</h1>
      <Card>
        <form onSubmit={(e) => save(["companyName", "companyAddress", "companyPhone", "companyEmail", "companyNif", "companyStat", "defaultTaxRate", "documentFooter"], e)} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nom de l'entreprise</label>
            <input value={settings.companyName} onChange={(e) => set("companyName", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Adresse</label>
            <textarea rows={2} value={settings.companyAddress} onChange={(e) => set("companyAddress", e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Téléphone</label>
              <input value={settings.companyPhone} onChange={(e) => set("companyPhone", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input type="email" value={settings.companyEmail} onChange={(e) => set("companyEmail", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">NIF</label>
              <input value={settings.companyNif} onChange={(e) => set("companyNif", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">STAT</label>
              <input value={settings.companyStat} onChange={(e) => set("companyStat", e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">TVA par défaut (%)</label>
            <input type="number" min={0} max={100} step="0.01" value={settings.defaultTaxRate}
              onChange={(e) => set("defaultTaxRate", Number(e.target.value))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Mention en bas des documents (conditions de paiement, coordonnées bancaires…)</label>
            <textarea rows={3} value={settings.documentFooter} onChange={(e) => set("documentFooter", e.target.value)} className={inputCls} />
          </div>
          <button type="submit" disabled={saving} className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-60">
            Enregistrer
          </button>
        </form>
      </Card>

      <Card>
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-red-600">Zone dangereuse</h2>
            <p className="text-xs text-gray-500">
              Supprime tous les salariés, comptes salariés, présences, historique, rémunérations, paiements, permissions,
              contrôles de présence, discussions et matériel. Sont conservés : comptes administrateur, paramètres, lieux de
              travail, chantiers, clients, devis et factures, journal des actions.
            </p>
          </div>
          {!resetOpen ? (
            <button type="button" onClick={() => setResetOpen(true)} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg">
              <Trash2 className="w-4 h-4" /> Réinitialiser les données
            </button>
          ) : (
            <form onSubmit={handleReset} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Entrez votre mot de passe administrateur pour confirmer</label>
                <input type="password" value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} autoFocus autoComplete="current-password" className={inputCls} />
                {resetError && <p className="text-xs text-red-600 mt-1">{resetError}</p>}
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={resetBusy || !resetPwd} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
                  {resetBusy ? "Suppression…" : "Confirmer"}
                </button>
                <button type="button" disabled={resetBusy} onClick={() => { setResetOpen(false); setResetPwd(""); setResetError("") }} className="border text-sm px-4 py-2 rounded-lg">Annuler</button>
              </div>
            </form>
          )}
        </div>
      </Card>
      {toast && <Toast message={toast.msg} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  )
}
