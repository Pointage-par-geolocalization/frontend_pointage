// src/pages/admin/Employees.tsx
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  listEmployees, createEmployee, updateEmployee, setEmployeeActive, deleteEmployee, changeEmployeePassword,
  getEmployeeBalance, type Employee, type Balance,
} from "../../services/employees"
import { listWorkplaces, type Workplace } from "../../services/workplaces"
import { getSettings } from "../../services/settings"
import { errorMessage } from "../../services/api"
import { formatAriary } from "../../utils/salaryCalculator"
import { fmtDay } from "../../utils/format"
import { useConfirm } from "../../contexts/ConfirmContext"
import PasswordInput from "../../components/PasswordInput"
import Card from "../../components/Card"
import Badge from "../../components/Badge"
import EmptyState from "../../components/EmptyState"
import Toast from "../../components/Toast"
import { Eye, Edit3, Power, Trash2, UserPlus, X, Building2, Phone, Mail, Calendar, Wallet, MapPin } from "lucide-react"

const emptyForm = {
  employeeCode: "", firstName: "", lastName: "", address: "", email: "",
  phone: "", position: "", hireDate: "", baseDailySalary: "20000", contractType: "JOURNALIER", monthlySalary: "",
}

export default function AdminEmployees() {
  const confirm = useConfirm()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [workplaces, setWorkplaces] = useState<Workplace[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([])
  const [password, setPassword] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // État pour la modale "Voir"
  const [viewEmployee, setViewEmployee] = useState<Employee | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [defaultSalary, setDefaultSalary] = useState("20000")
  const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null)

  async function refresh() {
    try { setEmployees(await listEmployees()) }
    catch (e) { setToast({ msg: errorMessage(e, "Impossible de charger les salariés."), tone: "error" }) }
  }
  useEffect(() => { refresh() }, [])
  useEffect(() => { listWorkplaces().then(setWorkplaces).catch(() => {}) }, [])
  useEffect(() => {
    getSettings().then((s) => setDefaultSalary(String(s.dailySalary))).catch(() => {})
  }, [])

  function departmentNames(ids: string[]): string {
    if (ids.length === 0) return "Aucun département"
    return ids.map((id) => workplaces.find((w) => w.id === id)?.name ?? id).join(", ")
  }

  function toggleDept(id: string) {
    setSelectedDeptIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  function startEdit(e: Employee) {
    setEditingId(e.employeeCode)
    setForm({
      employeeCode: e.employeeCode, firstName: e.firstName, lastName: e.lastName,
      address: e.address ?? "", email: e.email ?? "", phone: e.phone ?? "",
      position: e.position, hireDate: e.hireDate ?? "",
      baseDailySalary: String(e.baseDailySalary ?? 0), contractType: e.contractType || "JOURNALIER", monthlySalary: e.monthlySalary == null ? "" : String(e.monthlySalary),
    })
    setSelectedDeptIds(e.departmentIds ?? [])
    setPassword("")
    setNewPassword(""); setPwMsg(null)
    setError(null)
    setShowForm(true)
  }

  /** L'admin choisit directement le nouveau mot de passe / PIN (l'ancien n'est pas demandé). */
  async function handleChangePassword() {
    setPwMsg(null)
    if (!editingId) return
    if (newPassword.length < 6) {
      setPwMsg({ ok: false, text: "Le nouveau mot de passe doit contenir au moins 6 caractères." })
      return
    }
    setPwSaving(true)
    try {
      await changeEmployeePassword(editingId, newPassword)
      setNewPassword("")
      setPwMsg({ ok: true, text: "Mot de passe modifié. Le salarié doit se reconnecter avec le nouveau mot de passe." })
    } catch (err) {
      setPwMsg({ ok: false, text: errorMessage(err, "Opération impossible.") })
    } finally {
      setPwSaving(false)
    }
  }

  async function handleToggleActive(e: Employee) {
    if (e.active) {
      const ok = await confirm({
        title: `Désactiver ${e.firstName} ${e.lastName} ?`,
        message: "Son accès à l'application est coupé immédiatement. Ses données sont conservées et vous pourrez le réactiver.",
        confirmLabel: "Désactiver", tone: "danger",
      })
      if (!ok) return
    }
    try {
      await setEmployeeActive(e.employeeCode, !e.active)
      setToast({ msg: e.active ? "Salarié désactivé." : "Salarié réactivé.", tone: "success" })
      refresh()
    } catch (err) {
      setToast({ msg: errorMessage(err, "Opération impossible."), tone: "error" })
    }
  }

  async function handleDelete(e: Employee) {
    const ok = await confirm({
      title: `Supprimer ${e.firstName} ${e.lastName} ?`,
      message: "Son accès sera immédiatement coupé. Cette action est irréversible. Un salarié qui a déjà des pointages ou des paiements ne peut pas être supprimé : désactivez-le.",
      confirmLabel: "Supprimer", tone: "danger",
    })
    if (!ok) return
    try {
      await deleteEmployee(e.employeeCode)
      setToast({ msg: "Salarié supprimé.", tone: "success" })
      refresh()
    } catch (err) {
      setToast({ msg: errorMessage(err, "Suppression impossible."), tone: "error" })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!editingId && password.length < 6) {
      setError("Le mot de passe / code PIN doit contenir au moins 6 caractères.")
      return
    }
    if (selectedDeptIds.length === 0) {
      setError("Sélectionnez au moins un département pour ce salarié.")
      return
    }

    const salary = Number(form.baseDailySalary)
    if (!Number.isFinite(salary) || salary < 0) {
      setError("Le salaire de base doit être un nombre positif.")
      return
    }
    const monthly = Number(form.monthlySalary)
    if (form.contractType === "CDI" && (!Number.isFinite(monthly) || monthly <= 0)) { setError("Le salaire mensuel forfaitaire est obligatoire pour un CDI."); return }
    const nullable = (v: string) => v.trim() || null
    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      address: nullable(form.address),
      email: nullable(form.email),
      phone: nullable(form.phone),
      position: form.position.trim(),
      hireDate: form.hireDate || null,
      baseDailySalary: form.contractType === "CDI" ? 0 : Math.round(salary),
      contractType: form.contractType as "JOURNALIER" | "CDI",
      monthlySalary: form.contractType === "CDI" ? Math.round(monthly) : null,
      departmentIds: selectedDeptIds,
    }

    setSaving(true)
    try {
      // Le statut actif n'est jamais modifié par l'édition (il a son propre bouton).
      if (editingId) {
        await updateEmployee(editingId, payload)
      } else {
        await createEmployee("", payload, password)
      }
      setForm(emptyForm)
      setSelectedDeptIds([])
      setPassword("")
      setEditingId(null)
      setShowForm(false)
      setToast({ msg: "Salarié enregistré.", tone: "success" })
      refresh()
    } catch (err) {
      // Messages du serveur : identifiant déjà utilisé, champ invalide…
      setError(errorMessage(err, "Une erreur est survenue lors de l'enregistrement."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      
      {/* En-tête de page */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Gestion des Salariés</h1>
          <p className="text-sm text-slate-500 mt-0.5">Consultez, ajoutez ou modifiez les profils de vos collaborateurs.</p>
        </div>
        <button
          onClick={() => {
            setForm({ ...emptyForm, baseDailySalary: defaultSalary })
            setSelectedDeptIds([])
            setPassword(""); setError(null); setEditingId(null); setShowForm((v) => !v)
          }}
          className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4.5 py-2.5 rounded-xl transition shadow-md shadow-primary-600/20 flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          <span>{showForm ? "Fermer le formulaire" : "Nouveau salarié"}</span>
        </button>
      </div>

      {/* Formulaire d'ajout / modification */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
        <Card className="p-6 border border-slate-200/80 shadow-2xl rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
            <h2 className="font-bold text-base text-slate-900">
              {editingId ? "Modifier le salarié" : "Créer un nouveau salarié"}
            </h2>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {([
              ["firstName", "Prénom", "text"], ["lastName", "Nom", "text"],
              ["email", "Email professionnel", "email"], ["phone", "Téléphone", "tel"],
              ["position", "Poste / Fonction", "text"], ["hireDate", "Date d'embauche", "date"], ["address", "Adresse physique", "text"],
            ] as const).map(([key, label, type]) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none transition disabled:opacity-60"
                  required={["firstName", "lastName"].includes(key)}
                />

              </div>
            ))}

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Type de contrat</label>
              <select value={form.contractType} onChange={e=>setForm({...form,contractType:e.target.value,baseDailySalary:e.target.value==="CDI"?"0":(form.baseDailySalary==="0"?defaultSalary:form.baseDailySalary)})} className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm">
                <option value="JOURNALIER">Salarié journalier — pointage direct</option><option value="CDI">Salarié CDI — timesheet hebdomadaire</option>
              </select>
            </div>
            {editingId && <div className="md:col-span-2"><label className="block text-xs font-semibold text-slate-600 mb-1.5">Numéro salarié (lecture seule)</label><input value={employees.find(e => e.employeeCode === editingId)?.employeeNumber || editingId} readOnly className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-slate-100" /></div>}
            {!editingId && <div className="md:col-span-2 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">L’identifiant salarié permanent sera généré automatiquement par le serveur. Le code de connexion historique reste inchangé pour les comptes existants.</div>}
            {form.contractType === "CDI" ? <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Forfait mensuel contractuel (Ar)</label>
              <input type="number" min="1" value={form.monthlySalary} onChange={e=>setForm({...form,monthlySalary:e.target.value})} className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm" required />
              <p className="mt-1 text-xs text-slate-400">Le CDI saisit et soumet ses heures dans le module Timesheet ; l’entrée/sortie directe est désactivée.</p>
            </div> : <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Salaire de base (Ar / journée de 8h)</label>
              <input
                type="number"
                min="0"
                value={form.baseDailySalary}
                onChange={(e) => setForm({ ...form, baseDailySalary: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none transition"
                required
              />
              <p className="mt-1 text-xs text-slate-400">Propre à ce salarié.</p>
            </div>}

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Départements affectés</label>
              {workplaces.length === 0 ? (
                <p className="text-xs text-rose-600">
                  Aucun département configuré. <Link to="/admin/lieux" className="underline font-medium">En ajouter un</Link> d'abord.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {workplaces.map((w) => (
                    <label
                      key={w.id}
                      className={`flex items-center gap-2 text-sm px-3.5 py-2 rounded-xl border cursor-pointer transition ${
                        selectedDeptIds.includes(w.id) 
                          ? "bg-primary-50 border-primary-500 text-primary-700 font-medium shadow-sm" 
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedDeptIds.includes(w.id)}
                        onChange={() => toggleDept(w.id)}
                        className="accent-primary-600 w-4 h-4 rounded"
                      />
                      {w.name}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {!editingId && (
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mot de passe / code PIN (connexion du salarié)</label>
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  placeholder="6 caractères minimum"
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none transition"
                  required
                />
              </div>
            )}
            
            {editingId && (
              <div className="md:col-span-2 bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                <div className="text-xs font-semibold text-slate-600">Modifier le mot de passe / code PIN du salarié</div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <PasswordInput
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nouveau mot de passe (6 caractères min.)"
                      autoComplete="new-password"
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleChangePassword}
                    disabled={pwSaving || !newPassword}
                    className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl disabled:opacity-60"
                  >
                    {pwSaving ? "..." : "Changer le mot de passe"}
                  </button>
                </div>
                {pwMsg && (
                  <div className={`text-xs font-medium ${pwMsg.ok ? "text-emerald-600" : "text-rose-600"}`}>{pwMsg.text}</div>
                )}
              </div>
            )}

            {error && <div className="md:col-span-2 text-sm text-rose-600 font-medium bg-rose-50 p-3 rounded-xl">{error}</div>}

            <div className="md:col-span-2 pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-md transition disabled:opacity-60"
              >
                {saving ? "Enregistrement..." : "Enregistrer le salarié"}
              </button>
            </div>
          </form>
        </Card>
        </div>
      )}

      {/* Liste des salariés sous forme de tableau responsive avec Scroll */}
      <Card className="p-0 border border-slate-200/80 shadow-sm rounded-2xl overflow-hidden">
        {employees.length === 0 ? (
          <div className="p-8">
            <EmptyState message="Aucun salarié enregistré pour le moment." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wider font-bold">
                  <th className="py-3.5 px-4">Salarié</th>
                  <th className="py-3.5 px-4">Poste & Départements</th>
                  <th className="py-3.5 px-4">Salaire Journalier</th>
                  <th className="py-3.5 px-4">Statut</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {employees.map((e) => (
                  <tr key={e.employeeCode} className="hover:bg-slate-50/50 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{e.lastName} {e.firstName}</div>
                      <div className="text-xs text-slate-400 font-mono">Numéro: {e.employeeNumber ?? e.employeeCode}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-slate-800 font-medium">{e.position || "Non défini"}</div>
                      <div className="text-xs text-slate-500 truncate max-w-xs">{departmentNames(e.departmentIds ?? [])}</div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {formatAriary(e.baseDailySalary ?? 0)}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge tone={e.active ? "green" : "gray"}>{e.active ? "Actif" : "Inactif"}</Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Bouton Voir */}
                        <button
                          onClick={() => setViewEmployee(e)}
                          className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
                          title="Voir les informations"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {/* Bouton Modifier */}
                        <button
                          onClick={() => startEdit(e)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Modifier"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {/* Activer / Désactiver */}
                        <button
                          onClick={() => handleToggleActive(e)}
                          className={`p-1.5 rounded-lg transition ${e.active ? "text-amber-500 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"}`}
                          title={e.active ? "Désactiver" : "Réactiver"}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        {/* Supprimer */}
                        <button
                          onClick={() => handleDelete(e)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* MODALE DE CONSULTATION GLOBALE ET FINANCIÈRE */}
      {viewEmployee && (
        <EmployeeDetailsModal employee={viewEmployee} onClose={() => setViewEmployee(null)} workplaces={workplaces} />
      )}

      {toast && <Toast message={toast.msg} tone={toast.tone} onClose={() => setToast(null)} />}

    </div>
  )
}

// Sous-composant gérant la Fiche Salarié détaillée avec les montants
function EmployeeDetailsModal({ employee, onClose, workplaces }: { employee: Employee; onClose: () => void; workplaces: Workplace[] }) {
  const [balance, setBalance] = useState<Balance | null>(null)
  const [loadingBalance, setLoadingBalance] = useState(true)

  useEffect(() => {
    getEmployeeBalance(employee.employeeCode)
      .then(setBalance)
      .catch(() => setBalance(null))
      .finally(() => setLoadingBalance(false))
  }, [employee.employeeCode])

  function departmentNames(ids: string[]): string {
    if (ids.length === 0) return "Aucun département"
    return ids.map((id) => workplaces.find((w) => w.id === id)?.name ?? id).join(", ")
  }

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-6 shadow-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto">
        
        <div className="flex justify-between items-start border-b border-slate-100 pb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-primary-600 bg-primary-50 px-2.5 py-1 rounded-lg">
              Fiche Salarié & Montants
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 mt-2">
              {employee.lastName} {employee.firstName}
            </h2>
            <p className="text-xs text-slate-400 font-mono">Identifiant de connexion : {employee.employeeCode}</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 text-sm">
          
          {/* Bloc Montants / Financier */}
          <div className="bg-gradient-to-br from-primary-900 to-primary-800 text-white p-4 rounded-2xl shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-semibold text-primary-200 block mb-0.5">Solde cumulé total (gagné)</span>
                <div className="text-2xl font-extrabold">
                  {loadingBalance ? "Chargement..." : balance ? formatAriary(balance.earned) : "—"}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-primary-200">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
            {balance && (
              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-white/15 text-xs">
                <div><span className="text-primary-200 block">Déjà payé</span><strong className="text-sm">{formatAriary(balance.paid)}</strong></div>
                <div><span className="text-primary-200 block">Reste à payer</span><strong className="text-sm">{formatAriary(balance.due)}</strong></div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div>
              <span className="text-xs text-slate-400 block mb-0.5">Poste occupé</span>
              <strong className="text-slate-800">{employee.position || "Non spécifié"}</strong>
            </div>
            <div>
              <span className="text-xs text-slate-400 block mb-0.5">Statut du compte</span>
              <Badge tone={employee.active ? "green" : "gray"}>
                {employee.active ? "Actif" : "Inactif"}
              </Badge>
            </div>
          </div>

          <div className="space-y-3 px-1">
            <div className="flex items-center gap-3 text-slate-600">
              <Wallet className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Salaire journalier de base (8h) : <strong className="text-slate-900">{formatAriary(employee.baseDailySalary ?? 0)}</strong></span>
            </div>
            <div className="flex items-center gap-3 text-slate-600">
              <Mail className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Email pro : <strong className="text-slate-900">{employee.email || "Aucun"}</strong></span>
            </div>
            <div className="flex items-center gap-3 text-slate-600">
              <Phone className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Téléphone : <strong className="text-slate-900">{employee.phone || "Non renseigné"}</strong></span>
            </div>
            <div className="flex items-center gap-3 text-slate-600">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Date d'embauche : <strong className="text-slate-900">{employee.hireDate ? fmtDay(employee.hireDate) : "Non renseignée"}</strong></span>
            </div>
            <div className="flex items-center gap-3 text-slate-600">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Adresse : <strong className="text-slate-900">{employee.address || "Non renseignée"}</strong></span>
            </div>
            <div className="flex items-start gap-3 text-slate-600 pt-2 border-t border-slate-100">
              <Building2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="block text-xs text-slate-400 mb-0.5">Départements autorisés au pointage :</span>
                <strong className="text-slate-800">{departmentNames(employee.departmentIds ?? [])}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-xl transition shadow-md"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  )
}

// // src/pages/admin/Employees.tsx
// import { useEffect, useState } from "react"
// import { Link } from "react-router-dom"
// import {
//   listEmployees, createEmployee, updateEmployee, setEmployeeActive, deleteEmployee, changeEmployeePassword,
//   getEmployeeBalance, type Employee, type Balance,
// } from "../../services/employees"
// import { listWorkplaces, type Workplace } from "../../services/workplaces"
// import { getSettings } from "../../services/settings"
// import { errorMessage } from "../../services/api"
// import { formatAriary } from "../../utils/salaryCalculator"
// import { fmtDay } from "../../utils/format"
// import { useConfirm } from "../../contexts/ConfirmContext"
// import PasswordInput from "../../components/PasswordInput"
// import Card from "../../components/Card"
// import Badge from "../../components/Badge"
// import EmptyState from "../../components/EmptyState"
// import Toast from "../../components/Toast"
// import { Eye, Edit3, Power, Trash2, UserPlus, X, Building2, Phone, Mail, Calendar, Wallet, MapPin } from "lucide-react"

// const emptyForm = {
//   employeeCode: "", firstName: "", lastName: "", address: "", email: "",
//   phone: "", position: "", hireDate: "", baseDailySalary: "20000", contractType: "JOURNALIER", monthlySalary: "",
// }

// export default function AdminEmployees() {
//   const confirm = useConfirm()
//   const [employees, setEmployees] = useState<Employee[]>([])
//   const [workplaces, setWorkplaces] = useState<Workplace[]>([])
//   const [showForm, setShowForm] = useState(false)
//   const [form, setForm] = useState(emptyForm)
//   const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([])
//   const [password, setPassword] = useState("")
//   const [editingId, setEditingId] = useState<string | null>(null)
//   const [newPassword, setNewPassword] = useState("")
//   const [pwSaving, setPwSaving] = useState(false)
//   const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)

//   // État pour la modale "Voir"
//   const [viewEmployee, setViewEmployee] = useState<Employee | null>(null)

//   const [error, setError] = useState<string | null>(null)
//   const [saving, setSaving] = useState(false)
//   const [defaultSalary, setDefaultSalary] = useState("20000")
//   const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null)

//   async function refresh() {
//     try { setEmployees(await listEmployees()) }
//     catch (e) { setToast({ msg: errorMessage(e, "Impossible de charger les salariés."), tone: "error" }) }
//   }
//   useEffect(() => { refresh() }, [])
//   useEffect(() => { listWorkplaces().then(setWorkplaces).catch(() => {}) }, [])
//   useEffect(() => {
//     getSettings().then((s) => setDefaultSalary(String(s.dailySalary))).catch(() => {})
//   }, [])

//   function departmentNames(ids: string[]): string {
//     if (ids.length === 0) return "Aucun département"
//     return ids.map((id) => workplaces.find((w) => w.id === id)?.name ?? id).join(", ")
//   }

//   function toggleDept(id: string) {
//     setSelectedDeptIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
//   }

//   function startEdit(e: Employee) {
//     setEditingId(e.employeeCode)
//     setForm({
//       employeeCode: e.employeeCode, firstName: e.firstName, lastName: e.lastName,
//       address: e.address ?? "", email: e.email ?? "", phone: e.phone ?? "",
//       position: e.position, hireDate: e.hireDate ?? "",
//       baseDailySalary: String(e.baseDailySalary ?? 0), contractType: e.contractType || "JOURNALIER", monthlySalary: e.monthlySalary == null ? "" : String(e.monthlySalary),
//     })
//     setSelectedDeptIds(e.departmentIds ?? [])
//     setPassword("")
//     setNewPassword(""); setPwMsg(null)
//     setError(null)
//     setShowForm(true)
//   }

//   /** L'admin choisit directement le nouveau mot de passe / PIN (l'ancien n'est pas demandé). */
//   async function handleChangePassword() {
//     setPwMsg(null)
//     if (!editingId) return
//     if (newPassword.length < 6) {
//       setPwMsg({ ok: false, text: "Le nouveau mot de passe doit contenir au moins 6 caractères." })
//       return
//     }
//     setPwSaving(true)
//     try {
//       await changeEmployeePassword(editingId, newPassword)
//       setNewPassword("")
//       setPwMsg({ ok: true, text: "Mot de passe modifié. Le salarié doit se reconnecter avec le nouveau mot de passe." })
//     } catch (err) {
//       setPwMsg({ ok: false, text: errorMessage(err, "Opération impossible.") })
//     } finally {
//       setPwSaving(false)
//     }
//   }

//   async function handleToggleActive(e: Employee) {
//     if (e.active) {
//       const ok = await confirm({
//         title: `Désactiver ${e.firstName} ${e.lastName} ?`,
//         message: "Son accès à l'application est coupé immédiatement. Ses données sont conservées et vous pourrez le réactiver.",
//         confirmLabel: "Désactiver", tone: "danger",
//       })
//       if (!ok) return
//     }
//     try {
//       await setEmployeeActive(e.employeeCode, !e.active)
//       setToast({ msg: e.active ? "Salarié désactivé." : "Salarié réactivé.", tone: "success" })
//       refresh()
//     } catch (err) {
//       setToast({ msg: errorMessage(err, "Opération impossible."), tone: "error" })
//     }
//   }

//   async function handleDelete(e: Employee) {
//     const ok = await confirm({
//       title: `Supprimer ${e.firstName} ${e.lastName} ?`,
//       message: "Son accès sera immédiatement coupé. Cette action est irréversible. Un salarié qui a déjà des pointages ou des paiements ne peut pas être supprimé : désactivez-le.",
//       confirmLabel: "Supprimer", tone: "danger",
//     })
//     if (!ok) return
//     try {
//       await deleteEmployee(e.employeeCode)
//       setToast({ msg: "Salarié supprimé.", tone: "success" })
//       refresh()
//     } catch (err) {
//       setToast({ msg: errorMessage(err, "Suppression impossible."), tone: "error" })
//     }
//   }

//   async function handleSubmit(e: React.FormEvent) {
//     e.preventDefault()
//     setError(null)

//     if (!editingId && password.length < 6) {
//       setError("Le mot de passe / code PIN doit contenir au moins 6 caractères.")
//       return
//     }
//     if (selectedDeptIds.length === 0) {
//       setError("Sélectionnez au moins un département pour ce salarié.")
//       return
//     }

//     const salary = Number(form.baseDailySalary)
//     if (!Number.isFinite(salary) || salary < 0) {
//       setError("Le salaire de base doit être un nombre positif.")
//       return
//     }
//     const monthly = Number(form.monthlySalary)
//     if (form.contractType === "CDI" && (!Number.isFinite(monthly) || monthly <= 0)) { setError("Le salaire mensuel forfaitaire est obligatoire pour un CDI."); return }
//     const nullable = (v: string) => v.trim() || null
//     const payload = {
//       firstName: form.firstName.trim(),
//       lastName: form.lastName.trim(),
//       address: nullable(form.address),
//       email: nullable(form.email),
//       phone: nullable(form.phone),
//       position: form.position.trim(),
//       hireDate: form.hireDate || null,
//       baseDailySalary: form.contractType === "CDI" ? 0 : Math.round(salary),
//       contractType: form.contractType as "JOURNALIER" | "CDI",
//       monthlySalary: form.contractType === "CDI" ? Math.round(monthly) : null,
//       departmentIds: selectedDeptIds,
//     }

//     setSaving(true)
//     try {
//       // Le statut actif n'est jamais modifié par l'édition (il a son propre bouton).
//       if (editingId) {
//         await updateEmployee(editingId, payload)
//       } else {
//         await createEmployee(form.employeeCode.trim(), payload, password)
//       }
//       setForm(emptyForm)
//       setSelectedDeptIds([])
//       setPassword("")
//       setEditingId(null)
//       setShowForm(false)
//       setToast({ msg: "Salarié enregistré.", tone: "success" })
//       refresh()
//     } catch (err) {
//       // Messages du serveur : identifiant déjà utilisé, champ invalide…
//       setError(errorMessage(err, "Une erreur est survenue lors de l'enregistrement."))
//     } finally {
//       setSaving(false)
//     }
//   }

//   return (
//     <div className="space-y-6">
      
//       {/* En-tête de page */}
//       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
//         <div>
//           <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Gestion des Salariés</h1>
//           <p className="text-sm text-slate-500 mt-0.5">Consultez, ajoutez ou modifiez les profils de vos collaborateurs.</p>
//         </div>
//         <button
//           onClick={() => {
//             setForm({ ...emptyForm, baseDailySalary: defaultSalary })
//             setSelectedDeptIds([])
//             setPassword(""); setError(null); setEditingId(null); setShowForm((v) => !v)
//           }}
//           className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4.5 py-2.5 rounded-xl transition shadow-md shadow-primary-600/20 flex items-center gap-2"
//         >
//           <UserPlus className="w-4 h-4" />
//           <span>{showForm ? "Fermer le formulaire" : "Nouveau salarié"}</span>
//         </button>
//       </div>

//       {/* Formulaire d'ajout / modification */}
//       {showForm && (
//         <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
//         <Card className="p-6 border border-slate-200/80 shadow-2xl rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
//           <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
//             <h2 className="font-bold text-base text-slate-900">
//               {editingId ? "Modifier le salarié" : "Créer un nouveau salarié"}
//             </h2>
//             <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
//               <X className="w-5 h-5" />
//             </button>
//           </div>

//           <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
//             {([
//               ["employeeCode", "Identifiant de connexion (ex: EMP-001)", "text"], ["firstName", "Prénom", "text"], ["lastName", "Nom", "text"],
//               ["email", "Email professionnel", "email"], ["phone", "Téléphone", "tel"],
//               ["position", "Poste / Fonction", "text"], ["hireDate", "Date d'embauche", "date"], ["address", "Adresse physique", "text"],
//             ] as const).map(([key, label, type]) => (
//               <div key={key}>
//                 <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
//                 <input
//                   type={type}
//                   value={form[key]}
//                   onChange={(e) => setForm({ ...form, [key]: e.target.value })}
//                   disabled={key === "employeeCode" && !!editingId}
//                   maxLength={key === "employeeCode" ? 30 : undefined}
//                   className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none transition disabled:opacity-60"
//                   required={["employeeCode", "firstName", "lastName"].includes(key)}
//                 />
//                 {key === "employeeCode" && !editingId && (
//                   <p className="mt-1 text-xs text-slate-400">Le salarié se connecte avec cet identifiant. Non modifiable ensuite.</p>
//                 )}
//               </div>
//             ))}

//             <div className="md:col-span-2">
//               <label className="block text-xs font-semibold text-slate-600 mb-1.5">Type de contrat</label>
//               <select value={form.contractType} onChange={e=>setForm({...form,contractType:e.target.value,baseDailySalary:e.target.value==="CDI"?"0":(form.baseDailySalary==="0"?defaultSalary:form.baseDailySalary)})} className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm">
//                 <option value="JOURNALIER">Salarié journalier — pointage direct</option><option value="CDI">Salarié CDI — timesheet hebdomadaire</option>
//               </select>
//             </div>
//             {form.contractType === "CDI" ? <div className="md:col-span-2">
//               <label className="block text-xs font-semibold text-slate-600 mb-1.5">Forfait mensuel contractuel (Ar)</label>
//               <input type="number" min="1" value={form.monthlySalary} onChange={e=>setForm({...form,monthlySalary:e.target.value})} className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm" required />
//               <p className="mt-1 text-xs text-slate-400">Le CDI saisit et soumet ses heures dans le module Timesheet ; l’entrée/sortie directe est désactivée.</p>
//             </div> : <div>
//               <label className="block text-xs font-semibold text-slate-600 mb-1.5">Salaire de base (Ar / journée de 8h)</label>
//               <input
//                 type="number"
//                 min="0"
//                 value={form.baseDailySalary}
//                 onChange={(e) => setForm({ ...form, baseDailySalary: e.target.value })}
//                 className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none transition"
//                 required
//               />
//               <p className="mt-1 text-xs text-slate-400">Propre à ce salarié.</p>
//             </div>}

//             <div className="md:col-span-2">
//               <label className="block text-xs font-semibold text-slate-600 mb-1.5">Départements affectés</label>
//               {workplaces.length === 0 ? (
//                 <p className="text-xs text-rose-600">
//                   Aucun département configuré. <Link to="/admin/lieux" className="underline font-medium">En ajouter un</Link> d'abord.
//                 </p>
//               ) : (
//                 <div className="flex flex-wrap gap-2">
//                   {workplaces.map((w) => (
//                     <label
//                       key={w.id}
//                       className={`flex items-center gap-2 text-sm px-3.5 py-2 rounded-xl border cursor-pointer transition ${
//                         selectedDeptIds.includes(w.id) 
//                           ? "bg-primary-50 border-primary-500 text-primary-700 font-medium shadow-sm" 
//                           : "border-slate-200 text-slate-600 hover:bg-slate-50"
//                       }`}
//                     >
//                       <input
//                         type="checkbox"
//                         checked={selectedDeptIds.includes(w.id)}
//                         onChange={() => toggleDept(w.id)}
//                         className="accent-primary-600 w-4 h-4 rounded"
//                       />
//                       {w.name}
//                     </label>
//                   ))}
//                 </div>
//               )}
//             </div>

//             {!editingId && (
//               <div className="md:col-span-2">
//                 <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mot de passe / code PIN (connexion du salarié)</label>
//                 <PasswordInput
//                   value={password}
//                   onChange={(e) => setPassword(e.target.value)}
//                   minLength={6}
//                   placeholder="6 caractères minimum"
//                   className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none transition"
//                   required
//                 />
//               </div>
//             )}
            
//             {editingId && (
//               <div className="md:col-span-2 bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
//                 <div className="text-xs font-semibold text-slate-600">Modifier le mot de passe / code PIN du salarié</div>
//                 <div className="flex flex-col sm:flex-row gap-3">
//                   <div className="flex-1">
//                     <PasswordInput
//                       value={newPassword}
//                       onChange={(e) => setNewPassword(e.target.value)}
//                       placeholder="Nouveau mot de passe (6 caractères min.)"
//                       autoComplete="new-password"
//                       className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
//                     />
//                   </div>
//                   <button
//                     type="button"
//                     onClick={handleChangePassword}
//                     disabled={pwSaving || !newPassword}
//                     className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl disabled:opacity-60"
//                   >
//                     {pwSaving ? "..." : "Changer le mot de passe"}
//                   </button>
//                 </div>
//                 {pwMsg && (
//                   <div className={`text-xs font-medium ${pwMsg.ok ? "text-emerald-600" : "text-rose-600"}`}>{pwMsg.text}</div>
//                 )}
//               </div>
//             )}

//             {error && <div className="md:col-span-2 text-sm text-rose-600 font-medium bg-rose-50 p-3 rounded-xl">{error}</div>}

//             <div className="md:col-span-2 pt-2 flex justify-end gap-3">
//               <button
//                 type="button"
//                 onClick={() => setShowForm(false)}
//                 className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
//               >
//                 Annuler
//               </button>
//               <button
//                 type="submit"
//                 disabled={saving}
//                 className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-md transition disabled:opacity-60"
//               >
//                 {saving ? "Enregistrement..." : "Enregistrer le salarié"}
//               </button>
//             </div>
//           </form>
//         </Card>
//         </div>
//       )}

//       {/* Liste des salariés sous forme de tableau responsive avec Scroll */}
//       <Card className="p-0 border border-slate-200/80 shadow-sm rounded-2xl overflow-hidden">
//         {employees.length === 0 ? (
//           <div className="p-8">
//             <EmptyState message="Aucun salarié enregistré pour le moment." />
//           </div>
//         ) : (
//           <div className="overflow-x-auto">
//             <table className="w-full text-left border-collapse">
//               <thead>
//                 <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wider font-bold">
//                   <th className="py-3.5 px-4">Salarié</th>
//                   <th className="py-3.5 px-4">Poste & Départements</th>
//                   <th className="py-3.5 px-4">Salaire Journalier</th>
//                   <th className="py-3.5 px-4">Statut</th>
//                   <th className="py-3.5 px-4 text-right">Actions</th>
//                 </tr>
//               </thead>
//               <tbody className="divide-y divide-slate-100 text-sm">
//                 {employees.map((e) => (
//                   <tr key={e.employeeCode} className="hover:bg-slate-50/50 transition">
//                     <td className="py-3.5 px-4">
//                       <div className="font-bold text-slate-900">{e.lastName} {e.firstName}</div>
//                       <div className="text-xs text-slate-400 font-mono">ID: {e.employeeCode}</div>
//                     </td>
//                     <td className="py-3.5 px-4">
//                       <div className="text-slate-800 font-medium">{e.position || "Non défini"}</div>
//                       <div className="text-xs text-slate-500 truncate max-w-xs">{departmentNames(e.departmentIds ?? [])}</div>
//                     </td>
//                     <td className="py-3.5 px-4 font-semibold text-slate-900">
//                       {formatAriary(e.baseDailySalary ?? 0)}
//                     </td>
//                     <td className="py-3.5 px-4">
//                       <Badge tone={e.active ? "green" : "gray"}>{e.active ? "Actif" : "Inactif"}</Badge>
//                     </td>
//                     <td className="py-3.5 px-4 text-right">
//                       <div className="flex items-center justify-end gap-2">
//                         {/* Bouton Voir */}
//                         <button
//                           onClick={() => setViewEmployee(e)}
//                           className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
//                           title="Voir les informations"
//                         >
//                           <Eye className="w-4 h-4" />
//                         </button>
//                         {/* Bouton Modifier */}
//                         <button
//                           onClick={() => startEdit(e)}
//                           className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
//                           title="Modifier"
//                         >
//                           <Edit3 className="w-4 h-4" />
//                         </button>
//                         {/* Activer / Désactiver */}
//                         <button
//                           onClick={() => handleToggleActive(e)}
//                           className={`p-1.5 rounded-lg transition ${e.active ? "text-amber-500 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"}`}
//                           title={e.active ? "Désactiver" : "Réactiver"}
//                         >
//                           <Power className="w-4 h-4" />
//                         </button>
//                         {/* Supprimer */}
//                         <button
//                           onClick={() => handleDelete(e)}
//                           className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
//                           title="Supprimer"
//                         >
//                           <Trash2 className="w-4 h-4" />
//                         </button>
//                       </div>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         )}
//       </Card>

//       {/* MODALE DE CONSULTATION GLOBALE ET FINANCIÈRE */}
//       {viewEmployee && (
//         <EmployeeDetailsModal employee={viewEmployee} onClose={() => setViewEmployee(null)} workplaces={workplaces} />
//       )}

//       {toast && <Toast message={toast.msg} tone={toast.tone} onClose={() => setToast(null)} />}

//     </div>
//   )
// }

// // Sous-composant gérant la Fiche Salarié détaillée avec les montants
// function EmployeeDetailsModal({ employee, onClose, workplaces }: { employee: Employee; onClose: () => void; workplaces: Workplace[] }) {
//   const [balance, setBalance] = useState<Balance | null>(null)
//   const [loadingBalance, setLoadingBalance] = useState(true)

//   useEffect(() => {
//     getEmployeeBalance(employee.employeeCode)
//       .then(setBalance)
//       .catch(() => setBalance(null))
//       .finally(() => setLoadingBalance(false))
//   }, [employee.employeeCode])

//   function departmentNames(ids: string[]): string {
//     if (ids.length === 0) return "Aucun département"
//     return ids.map((id) => workplaces.find((w) => w.id === id)?.name ?? id).join(", ")
//   }

//   return (
//     <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
//       <div className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-6 shadow-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto">
        
//         <div className="flex justify-between items-start border-b border-slate-100 pb-4">
//           <div>
//             <span className="text-xs font-bold uppercase tracking-wider text-primary-600 bg-primary-50 px-2.5 py-1 rounded-lg">
//               Fiche Salarié & Montants
//             </span>
//             <h2 className="text-xl font-extrabold text-slate-900 mt-2">
//               {employee.lastName} {employee.firstName}
//             </h2>
//             <p className="text-xs text-slate-400 font-mono">Identifiant de connexion : {employee.employeeCode}</p>
//           </div>
//           <button 
//             onClick={onClose}
//             className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition"
//           >
//             <X className="w-4 h-4" />
//           </button>
//         </div>

//         <div className="space-y-4 text-sm">
          
//           {/* Bloc Montants / Financier */}
//           <div className="bg-gradient-to-br from-primary-900 to-primary-800 text-white p-4 rounded-2xl shadow-md">
//             <div className="flex items-center justify-between">
//               <div>
//                 <span className="text-[11px] uppercase tracking-wider font-semibold text-primary-200 block mb-0.5">Solde cumulé total (gagné)</span>
//                 <div className="text-2xl font-extrabold">
//                   {loadingBalance ? "Chargement..." : balance ? formatAriary(balance.earned) : "—"}
//                 </div>
//               </div>
//               <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-primary-200">
//                 <Wallet className="w-5 h-5" />
//               </div>
//             </div>
//             {balance && (
//               <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-white/15 text-xs">
//                 <div><span className="text-primary-200 block">Déjà payé</span><strong className="text-sm">{formatAriary(balance.paid)}</strong></div>
//                 <div><span className="text-primary-200 block">Reste à payer</span><strong className="text-sm">{formatAriary(balance.due)}</strong></div>
//               </div>
//             )}
//           </div>

//           <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
//             <div>
//               <span className="text-xs text-slate-400 block mb-0.5">Poste occupé</span>
//               <strong className="text-slate-800">{employee.position || "Non spécifié"}</strong>
//             </div>
//             <div>
//               <span className="text-xs text-slate-400 block mb-0.5">Statut du compte</span>
//               <Badge tone={employee.active ? "green" : "gray"}>
//                 {employee.active ? "Actif" : "Inactif"}
//               </Badge>
//             </div>
//           </div>

//           <div className="space-y-3 px-1">
//             <div className="flex items-center gap-3 text-slate-600">
//               <Wallet className="w-4 h-4 text-slate-400 shrink-0" />
//               <span>Salaire journalier de base (8h) : <strong className="text-slate-900">{formatAriary(employee.baseDailySalary ?? 0)}</strong></span>
//             </div>
//             <div className="flex items-center gap-3 text-slate-600">
//               <Mail className="w-4 h-4 text-slate-400 shrink-0" />
//               <span>Email pro : <strong className="text-slate-900">{employee.email || "Aucun"}</strong></span>
//             </div>
//             <div className="flex items-center gap-3 text-slate-600">
//               <Phone className="w-4 h-4 text-slate-400 shrink-0" />
//               <span>Téléphone : <strong className="text-slate-900">{employee.phone || "Non renseigné"}</strong></span>
//             </div>
//             <div className="flex items-center gap-3 text-slate-600">
//               <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
//               <span>Date d'embauche : <strong className="text-slate-900">{employee.hireDate ? fmtDay(employee.hireDate) : "Non renseignée"}</strong></span>
//             </div>
//             <div className="flex items-center gap-3 text-slate-600">
//               <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
//               <span>Adresse : <strong className="text-slate-900">{employee.address || "Non renseignée"}</strong></span>
//             </div>
//             <div className="flex items-start gap-3 text-slate-600 pt-2 border-t border-slate-100">
//               <Building2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
//               <div>
//                 <span className="block text-xs text-slate-400 mb-0.5">Départements autorisés au pointage :</span>
//                 <strong className="text-slate-800">{departmentNames(employee.departmentIds ?? [])}</strong>
//               </div>
//             </div>
//           </div>
//         </div>

//         <div className="pt-2">
//           <button
//             onClick={onClose}
//             className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-xl transition shadow-md"
//           >
//             Fermer
//           </button>
//         </div>

//       </div>
//     </div>
//   )
// }

// // src/pages/admin/Employees.tsx
// import { useEffect, useState } from "react"
// import { Link } from "react-router-dom"
// import {
//   listEmployees, createEmployee, updateEmployee, setEmployeeActive, deleteEmployee, changeEmployeePassword,
//   getEmployeeBalance, type Employee, type Balance,
// } from "../../services/employees"
// import { listWorkplaces, type Workplace } from "../../services/workplaces"
// import { getSettings } from "../../services/settings"
// import { errorMessage } from "../../services/api"
// import { formatAriary } from "../../utils/salaryCalculator"
// import { fmtDay } from "../../utils/format"
// import { useConfirm } from "../../contexts/ConfirmContext"
// import PasswordInput from "../../components/PasswordInput"
// import Card from "../../components/Card"
// import Badge from "../../components/Badge"
// import EmptyState from "../../components/EmptyState"
// import Toast from "../../components/Toast"
// import { Eye, Edit3, Power, Trash2, UserPlus, X, Building2, Phone, Mail, Calendar, Wallet, MapPin } from "lucide-react"

// const emptyForm = {
//   employeeCode: "", firstName: "", lastName: "", address: "", email: "",
//   phone: "", position: "", hireDate: "", baseDailySalary: "20000",
// }

// export default function AdminEmployees() {
//   const confirm = useConfirm()
//   const [employees, setEmployees] = useState<Employee[]>([])
//   const [workplaces, setWorkplaces] = useState<Workplace[]>([])
//   const [showForm, setShowForm] = useState(false)
//   const [form, setForm] = useState(emptyForm)
//   const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([])
//   const [password, setPassword] = useState("")
//   const [editingId, setEditingId] = useState<string | null>(null)
//   const [newPassword, setNewPassword] = useState("")
//   const [pwSaving, setPwSaving] = useState(false)
//   const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)

//   // État pour la modale "Voir"
//   const [viewEmployee, setViewEmployee] = useState<Employee | null>(null)

//   const [error, setError] = useState<string | null>(null)
//   const [saving, setSaving] = useState(false)
//   const [defaultSalary, setDefaultSalary] = useState("20000")
//   const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null)

//   async function refresh() {
//     try { setEmployees(await listEmployees()) }
//     catch (e) { setToast({ msg: errorMessage(e, "Impossible de charger les salariés."), tone: "error" }) }
//   }
//   useEffect(() => { refresh() }, [])
//   useEffect(() => { listWorkplaces().then(setWorkplaces).catch(() => {}) }, [])
//   useEffect(() => {
//     getSettings().then((s) => setDefaultSalary(String(s.dailySalary))).catch(() => {})
//   }, [])

//   function departmentNames(ids: string[]): string {
//     if (ids.length === 0) return "Aucun département"
//     return ids.map((id) => workplaces.find((w) => w.id === id)?.name ?? id).join(", ")
//   }

//   function toggleDept(id: string) {
//     setSelectedDeptIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
//   }

//   function startEdit(e: Employee) {
//     setEditingId(e.employeeCode)
//     setForm({
//       employeeCode: e.employeeCode, firstName: e.firstName, lastName: e.lastName,
//       address: e.address ?? "", email: e.email ?? "", phone: e.phone ?? "",
//       position: e.position, hireDate: e.hireDate ?? "",
//       baseDailySalary: String(e.baseDailySalary ?? 0),
//     })
//     setSelectedDeptIds(e.departmentIds ?? [])
//     setPassword("")
//     setNewPassword(""); setPwMsg(null)
//     setError(null)
//     setShowForm(true)
//   }

//   /** L'admin choisit directement le nouveau mot de passe / PIN (l'ancien n'est pas demandé). */
//   async function handleChangePassword() {
//     setPwMsg(null)
//     if (!editingId) return
//     if (newPassword.length < 6) {
//       setPwMsg({ ok: false, text: "Le nouveau mot de passe doit contenir au moins 6 caractères." })
//       return
//     }
//     setPwSaving(true)
//     try {
//       await changeEmployeePassword(editingId, newPassword)
//       setNewPassword("")
//       setPwMsg({ ok: true, text: "Mot de passe modifié. Le salarié doit se reconnecter avec le nouveau mot de passe." })
//     } catch (err) {
//       setPwMsg({ ok: false, text: errorMessage(err, "Opération impossible.") })
//     } finally {
//       setPwSaving(false)
//     }
//   }

//   async function handleToggleActive(e: Employee) {
//     if (e.active) {
//       const ok = await confirm({
//         title: `Désactiver ${e.firstName} ${e.lastName} ?`,
//         message: "Son accès à l'application est coupé immédiatement. Ses données sont conservées et vous pourrez le réactiver.",
//         confirmLabel: "Désactiver", tone: "danger",
//       })
//       if (!ok) return
//     }
//     try {
//       await setEmployeeActive(e.employeeCode, !e.active)
//       setToast({ msg: e.active ? "Salarié désactivé." : "Salarié réactivé.", tone: "success" })
//       refresh()
//     } catch (err) {
//       setToast({ msg: errorMessage(err, "Opération impossible."), tone: "error" })
//     }
//   }

//   async function handleDelete(e: Employee) {
//     const ok = await confirm({
//       title: `Supprimer ${e.firstName} ${e.lastName} ?`,
//       message: "Son accès sera immédiatement coupé. Cette action est irréversible. Un salarié qui a déjà des pointages ou des paiements ne peut pas être supprimé : désactivez-le.",
//       confirmLabel: "Supprimer", tone: "danger",
//     })
//     if (!ok) return
//     try {
//       await deleteEmployee(e.employeeCode)
//       setToast({ msg: "Salarié supprimé.", tone: "success" })
//       refresh()
//     } catch (err) {
//       setToast({ msg: errorMessage(err, "Suppression impossible."), tone: "error" })
//     }
//   }

//   async function handleSubmit(e: React.FormEvent) {
//     e.preventDefault()
//     setError(null)

//     if (!editingId && password.length < 6) {
//       setError("Le mot de passe / code PIN doit contenir au moins 6 caractères.")
//       return
//     }
//     if (selectedDeptIds.length === 0) {
//       setError("Sélectionnez au moins un département pour ce salarié.")
//       return
//     }

//     const salary = Number(form.baseDailySalary)
//     if (!Number.isFinite(salary) || salary < 0) {
//       setError("Le salaire de base doit être un nombre positif.")
//       return
//     }
//     const nullable = (v: string) => v.trim() || null
//     const payload = {
//       firstName: form.firstName.trim(),
//       lastName: form.lastName.trim(),
//       address: nullable(form.address),
//       email: nullable(form.email),
//       phone: nullable(form.phone),
//       position: form.position.trim(),
//       hireDate: form.hireDate || null,
//       baseDailySalary: Math.round(salary),
//       departmentIds: selectedDeptIds,
//     }

//     setSaving(true)
//     try {
//       // Le statut actif n'est jamais modifié par l'édition (il a son propre bouton).
//       if (editingId) {
//         await updateEmployee(editingId, payload)
//       } else {
//         await createEmployee(form.employeeCode.trim(), payload, password)
//       }
//       setForm(emptyForm)
//       setSelectedDeptIds([])
//       setPassword("")
//       setEditingId(null)
//       setShowForm(false)
//       setToast({ msg: "Salarié enregistré.", tone: "success" })
//       refresh()
//     } catch (err) {
//       // Messages du serveur : identifiant déjà utilisé, champ invalide…
//       setError(errorMessage(err, "Une erreur est survenue lors de l'enregistrement."))
//     } finally {
//       setSaving(false)
//     }
//   }

//   return (
//     <div className="space-y-6">
      
//       {/* En-tête de page */}
//       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
//         <div>
//           <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Gestion des Salariés</h1>
//           <p className="text-sm text-slate-500 mt-0.5">Consultez, ajoutez ou modifiez les profils de vos collaborateurs.</p>
//         </div>
//         <button
//           onClick={() => {
//             setForm({ ...emptyForm, baseDailySalary: defaultSalary })
//             setSelectedDeptIds([])
//             setPassword(""); setError(null); setEditingId(null); setShowForm((v) => !v)
//           }}
//           className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4.5 py-2.5 rounded-xl transition shadow-md shadow-primary-600/20 flex items-center gap-2"
//         >
//           <UserPlus className="w-4 h-4" />
//           <span>{showForm ? "Fermer le formulaire" : "Nouveau salarié"}</span>
//         </button>
//       </div>

//       {/* Formulaire d'ajout / modification */}
//       {showForm && (
//         <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
//         <Card className="p-6 border border-slate-200/80 shadow-2xl rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
//           <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
//             <h2 className="font-bold text-base text-slate-900">
//               {editingId ? "Modifier le salarié" : "Créer un nouveau salarié"}
//             </h2>
//             <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
//               <X className="w-5 h-5" />
//             </button>
//           </div>

//           <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
//             {([
//               ["employeeCode", "Identifiant de connexion (ex: EMP-001)", "text"], ["firstName", "Prénom", "text"], ["lastName", "Nom", "text"],
//               ["email", "Email professionnel", "email"], ["phone", "Téléphone", "tel"],
//               ["position", "Poste / Fonction", "text"], ["hireDate", "Date d'embauche", "date"], ["address", "Adresse physique", "text"],
//             ] as const).map(([key, label, type]) => (
//               <div key={key}>
//                 <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
//                 <input
//                   type={type}
//                   value={form[key]}
//                   onChange={(e) => setForm({ ...form, [key]: e.target.value })}
//                   disabled={key === "employeeCode" && !!editingId}
//                   maxLength={key === "employeeCode" ? 30 : undefined}
//                   className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none transition disabled:opacity-60"
//                   required={["employeeCode", "firstName", "lastName"].includes(key)}
//                 />
//                 {key === "employeeCode" && !editingId && (
//                   <p className="mt-1 text-xs text-slate-400">Le salarié se connecte avec cet identifiant. Non modifiable ensuite.</p>
//                 )}
//               </div>
//             ))}

//             <div>
//               <label className="block text-xs font-semibold text-slate-600 mb-1.5">Salaire de base (Ar / journée de 8h)</label>
//               <input
//                 type="number"
//                 min="0"
//                 value={form.baseDailySalary}
//                 onChange={(e) => setForm({ ...form, baseDailySalary: e.target.value })}
//                 className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none transition"
//                 required
//               />
//               <p className="mt-1 text-xs text-slate-400">Propre à ce salarié.</p>
//             </div>

//             <div className="md:col-span-2">
//               <label className="block text-xs font-semibold text-slate-600 mb-1.5">Départements affectés</label>
//               {workplaces.length === 0 ? (
//                 <p className="text-xs text-rose-600">
//                   Aucun département configuré. <Link to="/admin/lieux" className="underline font-medium">En ajouter un</Link> d'abord.
//                 </p>
//               ) : (
//                 <div className="flex flex-wrap gap-2">
//                   {workplaces.map((w) => (
//                     <label
//                       key={w.id}
//                       className={`flex items-center gap-2 text-sm px-3.5 py-2 rounded-xl border cursor-pointer transition ${
//                         selectedDeptIds.includes(w.id) 
//                           ? "bg-primary-50 border-primary-500 text-primary-700 font-medium shadow-sm" 
//                           : "border-slate-200 text-slate-600 hover:bg-slate-50"
//                       }`}
//                     >
//                       <input
//                         type="checkbox"
//                         checked={selectedDeptIds.includes(w.id)}
//                         onChange={() => toggleDept(w.id)}
//                         className="accent-primary-600 w-4 h-4 rounded"
//                       />
//                       {w.name}
//                     </label>
//                   ))}
//                 </div>
//               )}
//             </div>

//             {!editingId && (
//               <div className="md:col-span-2">
//                 <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mot de passe / code PIN (connexion du salarié)</label>
//                 <PasswordInput
//                   value={password}
//                   onChange={(e) => setPassword(e.target.value)}
//                   minLength={6}
//                   placeholder="6 caractères minimum"
//                   className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none transition"
//                   required
//                 />
//               </div>
//             )}
            
//             {editingId && (
//               <div className="md:col-span-2 bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
//                 <div className="text-xs font-semibold text-slate-600">Modifier le mot de passe / code PIN du salarié</div>
//                 <div className="flex flex-col sm:flex-row gap-3">
//                   <div className="flex-1">
//                     <PasswordInput
//                       value={newPassword}
//                       onChange={(e) => setNewPassword(e.target.value)}
//                       placeholder="Nouveau mot de passe (6 caractères min.)"
//                       autoComplete="new-password"
//                       className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
//                     />
//                   </div>
//                   <button
//                     type="button"
//                     onClick={handleChangePassword}
//                     disabled={pwSaving || !newPassword}
//                     className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2.5 rounded-xl disabled:opacity-60"
//                   >
//                     {pwSaving ? "..." : "Changer le mot de passe"}
//                   </button>
//                 </div>
//                 {pwMsg && (
//                   <div className={`text-xs font-medium ${pwMsg.ok ? "text-emerald-600" : "text-rose-600"}`}>{pwMsg.text}</div>
//                 )}
//               </div>
//             )}

//             {error && <div className="md:col-span-2 text-sm text-rose-600 font-medium bg-rose-50 p-3 rounded-xl">{error}</div>}

//             <div className="md:col-span-2 pt-2 flex justify-end gap-3">
//               <button
//                 type="button"
//                 onClick={() => setShowForm(false)}
//                 className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
//               >
//                 Annuler
//               </button>
//               <button
//                 type="submit"
//                 disabled={saving}
//                 className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-md transition disabled:opacity-60"
//               >
//                 {saving ? "Enregistrement..." : "Enregistrer le salarié"}
//               </button>
//             </div>
//           </form>
//         </Card>
//         </div>
//       )}

//       {/* Liste des salariés sous forme de tableau responsive avec Scroll */}
//       <Card className="p-0 border border-slate-200/80 shadow-sm rounded-2xl overflow-hidden">
//         {employees.length === 0 ? (
//           <div className="p-8">
//             <EmptyState message="Aucun salarié enregistré pour le moment." />
//           </div>
//         ) : (
//           <div className="overflow-x-auto">
//             <table className="w-full text-left border-collapse">
//               <thead>
//                 <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-400 text-[11px] uppercase tracking-wider font-bold">
//                   <th className="py-3.5 px-4">Salarié</th>
//                   <th className="py-3.5 px-4">Poste & Départements</th>
//                   <th className="py-3.5 px-4">Salaire Journalier</th>
//                   <th className="py-3.5 px-4">Statut</th>
//                   <th className="py-3.5 px-4 text-right">Actions</th>
//                 </tr>
//               </thead>
//               <tbody className="divide-y divide-slate-100 text-sm">
//                 {employees.map((e) => (
//                   <tr key={e.employeeCode} className="hover:bg-slate-50/50 transition">
//                     <td className="py-3.5 px-4">
//                       <div className="font-bold text-slate-900">{e.lastName} {e.firstName}</div>
//                       <div className="text-xs text-slate-400 font-mono">ID: {e.employeeCode}</div>
//                     </td>
//                     <td className="py-3.5 px-4">
//                       <div className="text-slate-800 font-medium">{e.position || "Non défini"}</div>
//                       <div className="text-xs text-slate-500 truncate max-w-xs">{departmentNames(e.departmentIds ?? [])}</div>
//                     </td>
//                     <td className="py-3.5 px-4 font-semibold text-slate-900">
//                       {formatAriary(e.baseDailySalary ?? 0)}
//                     </td>
//                     <td className="py-3.5 px-4">
//                       <Badge tone={e.active ? "green" : "gray"}>{e.active ? "Actif" : "Inactif"}</Badge>
//                     </td>
//                     <td className="py-3.5 px-4 text-right">
//                       <div className="flex items-center justify-end gap-2">
//                         {/* Bouton Voir */}
//                         <button
//                           onClick={() => setViewEmployee(e)}
//                           className="p-1.5 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
//                           title="Voir les informations"
//                         >
//                           <Eye className="w-4 h-4" />
//                         </button>
//                         {/* Bouton Modifier */}
//                         <button
//                           onClick={() => startEdit(e)}
//                           className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
//                           title="Modifier"
//                         >
//                           <Edit3 className="w-4 h-4" />
//                         </button>
//                         {/* Activer / Désactiver */}
//                         <button
//                           onClick={() => handleToggleActive(e)}
//                           className={`p-1.5 rounded-lg transition ${e.active ? "text-amber-500 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"}`}
//                           title={e.active ? "Désactiver" : "Réactiver"}
//                         >
//                           <Power className="w-4 h-4" />
//                         </button>
//                         {/* Supprimer */}
//                         <button
//                           onClick={() => handleDelete(e)}
//                           className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
//                           title="Supprimer"
//                         >
//                           <Trash2 className="w-4 h-4" />
//                         </button>
//                       </div>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         )}
//       </Card>

//       {/* MODALE DE CONSULTATION GLOBALE ET FINANCIÈRE */}
//       {viewEmployee && (
//         <EmployeeDetailsModal employee={viewEmployee} onClose={() => setViewEmployee(null)} workplaces={workplaces} />
//       )}

//       {toast && <Toast message={toast.msg} tone={toast.tone} onClose={() => setToast(null)} />}

//     </div>
//   )
// }

// // Sous-composant gérant la Fiche Salarié détaillée avec les montants
// function EmployeeDetailsModal({ employee, onClose, workplaces }: { employee: Employee; onClose: () => void; workplaces: Workplace[] }) {
//   const [balance, setBalance] = useState<Balance | null>(null)
//   const [loadingBalance, setLoadingBalance] = useState(true)

//   useEffect(() => {
//     getEmployeeBalance(employee.employeeCode)
//       .then(setBalance)
//       .catch(() => setBalance(null))
//       .finally(() => setLoadingBalance(false))
//   }, [employee.employeeCode])

//   function departmentNames(ids: string[]): string {
//     if (ids.length === 0) return "Aucun département"
//     return ids.map((id) => workplaces.find((w) => w.id === id)?.name ?? id).join(", ")
//   }

//   return (
//     <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
//       <div className="bg-white rounded-3xl w-full max-w-lg p-6 space-y-6 shadow-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto">
        
//         <div className="flex justify-between items-start border-b border-slate-100 pb-4">
//           <div>
//             <span className="text-xs font-bold uppercase tracking-wider text-primary-600 bg-primary-50 px-2.5 py-1 rounded-lg">
//               Fiche Salarié & Montants
//             </span>
//             <h2 className="text-xl font-extrabold text-slate-900 mt-2">
//               {employee.lastName} {employee.firstName}
//             </h2>
//             <p className="text-xs text-slate-400 font-mono">Identifiant de connexion : {employee.employeeCode}</p>
//           </div>
//           <button 
//             onClick={onClose}
//             className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition"
//           >
//             <X className="w-4 h-4" />
//           </button>
//         </div>

//         <div className="space-y-4 text-sm">
          
//           {/* Bloc Montants / Financier */}
//           <div className="bg-gradient-to-br from-primary-900 to-primary-800 text-white p-4 rounded-2xl shadow-md">
//             <div className="flex items-center justify-between">
//               <div>
//                 <span className="text-[11px] uppercase tracking-wider font-semibold text-primary-200 block mb-0.5">Solde cumulé total (gagné)</span>
//                 <div className="text-2xl font-extrabold">
//                   {loadingBalance ? "Chargement..." : balance ? formatAriary(balance.earned) : "—"}
//                 </div>
//               </div>
//               <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-primary-200">
//                 <Wallet className="w-5 h-5" />
//               </div>
//             </div>
//             {balance && (
//               <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-white/15 text-xs">
//                 <div><span className="text-primary-200 block">Déjà payé</span><strong className="text-sm">{formatAriary(balance.paid)}</strong></div>
//                 <div><span className="text-primary-200 block">Reste à payer</span><strong className="text-sm">{formatAriary(balance.due)}</strong></div>
//               </div>
//             )}
//           </div>

//           <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
//             <div>
//               <span className="text-xs text-slate-400 block mb-0.5">Poste occupé</span>
//               <strong className="text-slate-800">{employee.position || "Non spécifié"}</strong>
//             </div>
//             <div>
//               <span className="text-xs text-slate-400 block mb-0.5">Statut du compte</span>
//               <Badge tone={employee.active ? "green" : "gray"}>
//                 {employee.active ? "Actif" : "Inactif"}
//               </Badge>
//             </div>
//           </div>

//           <div className="space-y-3 px-1">
//             <div className="flex items-center gap-3 text-slate-600">
//               <Wallet className="w-4 h-4 text-slate-400 shrink-0" />
//               <span>Salaire journalier de base (8h) : <strong className="text-slate-900">{formatAriary(employee.baseDailySalary ?? 0)}</strong></span>
//             </div>
//             <div className="flex items-center gap-3 text-slate-600">
//               <Mail className="w-4 h-4 text-slate-400 shrink-0" />
//               <span>Email pro : <strong className="text-slate-900">{employee.email || "Aucun"}</strong></span>
//             </div>
//             <div className="flex items-center gap-3 text-slate-600">
//               <Phone className="w-4 h-4 text-slate-400 shrink-0" />
//               <span>Téléphone : <strong className="text-slate-900">{employee.phone || "Non renseigné"}</strong></span>
//             </div>
//             <div className="flex items-center gap-3 text-slate-600">
//               <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
//               <span>Date d'embauche : <strong className="text-slate-900">{employee.hireDate ? fmtDay(employee.hireDate) : "Non renseignée"}</strong></span>
//             </div>
//             <div className="flex items-center gap-3 text-slate-600">
//               <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
//               <span>Adresse : <strong className="text-slate-900">{employee.address || "Non renseignée"}</strong></span>
//             </div>
//             <div className="flex items-start gap-3 text-slate-600 pt-2 border-t border-slate-100">
//               <Building2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
//               <div>
//                 <span className="block text-xs text-slate-400 mb-0.5">Départements autorisés au pointage :</span>
//                 <strong className="text-slate-800">{departmentNames(employee.departmentIds ?? [])}</strong>
//               </div>
//             </div>
//           </div>
//         </div>

//         <div className="pt-2">
//           <button
//             onClick={onClose}
//             className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-xl transition shadow-md"
//           >
//             Fermer
//           </button>
//         </div>

//       </div>
//     </div>
//   )
// }
