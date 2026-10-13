// src/pages/auth/Login.tsx
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ApiError, MOCK_MODE } from "../../services/api"
import DemoAccounts from "../../components/DemoAccounts"
import PasswordInput from "../../components/PasswordInput"
import { useAuth } from "../../hooks/useAuth"
import { 
  Eye, 
  EyeOff, 
  Lock, 
  User, 
  Loader2, 
  Clock, 
  CalendarCheck, 
  TrendingUp, 
  Sparkles,
  CheckCircle2,
  ShieldCheck
} from "lucide-react"

export default function Login() {
  const navigate = useNavigate()
  const { appUser, loading: authLoading, login, registerAdmin } = useAuth()
  
  const [identifier, setIdentifier] = useState(() => localStorage.getItem("rememberedId") ?? "")
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(!!localStorage.getItem("rememberedId"))
  const [showPassword, setShowPassword] = useState(false)
  
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [mode, setMode] = useState<"login" | "register">("login")
  const [regEmail, setRegEmail] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regConfirm, setRegConfirm] = useState("")
  const [regCode, setRegCode] = useState("")

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (regPassword.length < 6) { setError("Le mot de passe doit contenir au moins 6 caractères."); return }
    if (regPassword !== regConfirm) { setError("Les mots de passe ne correspondent pas."); return }
    setLoading(true)
    try {
      // Le compte est créé puis connecté directement : redirection par l'effet ci-dessous.
      await registerAdmin(regEmail.trim(), regPassword, regCode.trim())
    } catch (err) {
      // Messages du serveur : email déjà utilisé, code d'invitation incorrect, trop de tentatives…
      setError(err instanceof ApiError && err.status < 500 ? err.message : "Impossible de créer le compte administrateur.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading && appUser) {
      navigate(appUser.role === "admin" ? "/admin" : "/employe", { replace: true })
    }
  }, [appUser, authLoading, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(identifier.trim(), password)
      if (remember) localStorage.setItem("rememberedId", identifier.trim())
      else localStorage.removeItem("rememberedId")
    } catch (err) {
      // Compte désactivé, trop de tentatives, serveur injoignable : message du serveur ;
      // identifiants refusés (401) : message unique qui ne révèle pas si le compte existe.
      const shown = err instanceof ApiError && err.status !== 401
      setError(shown ? (err as ApiError).message : "Identifiant ou mot de passe incorrect.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white overflow-hidden">
      
      {/* ================= COLONNE GAUCHE : BLOC D'INFO & ANIMATIONS (Masqué sur mobile/tablette) ================= */}
      <div className="hidden lg:flex lg:w-7/12 bg-gradient-to-br from-primary-900 via-primary-800 to-indigo-900 p-12 lg:p-16 text-white flex-col justify-between relative overflow-hidden">
        
        {/* Éléments décoratifs lumineux animés */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl animate-pulse pointer-events-none"></div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse pointer-events-none" style={{ animationDuration: '4s' }}></div>

        {/* En-tête / Badge */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-medium text-primary-200 mb-6 shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-primary-300 animate-spin" style={{ animationDuration: '6s' }} />
            <span>Plateforme de Gestion RH</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight mb-4 leading-tight">
            Suivi des pointages &<br />rémunération en temps réel
          </h1>
          <p className="text-primary-200/90 text-base lg:text-lg max-w-xl leading-relaxed">
            Optimisez le temps de travail de vos équipes, suivez les présences instantanément et automatisez le calcul de la paie en toute simplicité.
          </p>
        </div>

        {/* Cartes d'illustration animées */}
        <div className="relative z-10 my-10 space-y-4 max-w-lg">
          
          {/* Carte 1 */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/15 p-5 rounded-2xl shadow-xl transform transition hover:scale-[1.02] duration-300">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary-500/30 rounded-xl text-primary-300 border border-primary-400/20">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Pointage Instantané</h3>
                <p className="text-sm text-primary-200/70">Enregistrement précis des arrivées et départs.</p>
              </div>
            </div>
          </div>

          {/* Carte 2 */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/15 p-5 rounded-2xl shadow-xl transform transition hover:scale-[1.02] duration-300">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-500/30 rounded-xl text-indigo-300 border border-indigo-400/20">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Calcul de Rémunération</h3>
                <p className="text-sm text-primary-200/70">Heures supplémentaires et primes dynamiques.</p>
              </div>
            </div>
          </div>

          {/* Carte 3 */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/15 p-5 rounded-2xl shadow-xl transform transition hover:scale-[1.02] duration-300">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/30 rounded-xl text-emerald-300 border border-emerald-400/20">
                <CalendarCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Tableaux de Bord RH</h3>
                <p className="text-sm text-primary-200/70">Validation simplifiée par les administrateurs.</p>
              </div>
            </div>
          </div>

        </div>

        {/* Bas du bloc info */}
        <div className="relative z-10 flex items-center justify-between text-xs text-primary-200/60 pt-6 border-t border-white/10">
          <span className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Sécurisé & Conforme
          </span>
          <span>Version Pro 2.0</span>
        </div>

      </div>


      {/* ================= COLONNE DROITE : FORMULAIRE DE CONNEXION (Plein écran sur mobile) ================= */}
      <div className="w-full lg:w-5/12 bg-white flex flex-col justify-between p-6 sm:p-12 lg:p-16 min-h-screen lg:min-h-0">
        
        {/* Logo / Marque en haut */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center border border-primary-100">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="font-bold text-slate-900 text-sm">Pointage & Rémunération</span>
          </div>
        </div>

        {/* Formulaire au centre */}
        <div className="my-auto max-w-md w-full mx-auto py-8">
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mb-2">
              {mode === "login" ? "Bon retour 👋" : "Créer un compte admin"}
            </h2>
            <p className="text-sm text-slate-500">
              {mode === "login"
                ? "Veuillez vous identifier pour accéder à votre portail."
                : "Renseignez vos informations et le code d'invitation administrateur."}
            </p>
          </div>

          {mode === "register" ? (
            <form onSubmit={handleRegister} className="space-y-5">
              {[
                ["Email", "email", regEmail, setRegEmail, "admin@..."],
                ["Mot de passe", "password", regPassword, setRegPassword, "6 caractères minimum"],
                ["Confirmer le mot de passe", "password", regConfirm, setRegConfirm, "••••••••"],
                ["Code d'invitation administrateur", "password", regCode, setRegCode, "Code fourni par le propriétaire"],
              ].map(([label, type, value, set, ph]) => (
                <div key={label as string}>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">{label as string}</label>
                  {(() => {
                    const Field = type === "password" ? PasswordInput : "input"
                    return (
                  <Field
                    type={type as string}
                    value={value as string}
                    onChange={(e) => (set as (v: string) => void)(e.target.value)}
                    placeholder={ph as string}
                    autoComplete="off"
                    className="w-full rounded-xl bg-slate-50 border border-slate-300 text-slate-900 px-4 py-3.5 text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:outline-none transition"
                    required
                  />
                    )
                  })()}
                </div>
              ))}
              {error && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm text-center font-medium">{error}</div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3.5 rounded-xl transition shadow-lg shadow-primary-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 className="w-5 h-5 animate-spin" /><span>Création...</span></> : <span>Créer le compte admin</span>}
              </button>
              <button type="button" onClick={() => { setMode("login"); setError(null) }} className="w-full text-sm text-slate-500 hover:text-slate-700 font-medium">
                ← Retour à la connexion
              </button>
            </form>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Champ Identifiant */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
                Identifiant / Email
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-5 h-5" />
                </span>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="ex: EMP-001 ou admin@..."
                  className="w-full rounded-xl bg-slate-50 border border-slate-300 text-slate-900 pl-11 pr-4 py-3.5 text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:outline-none transition"
                  required
                />
              </div>
            </div>

            {/* Champ Mot de passe avec Show/Hide */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
                Mot de passe / PIN
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl bg-slate-50 border border-slate-300 text-slate-900 pl-11 pr-12 py-3.5 text-sm focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:outline-none transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Se souvenir de moi */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2.5 text-slate-600 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={remember} 
                  onChange={(e) => setRemember(e.target.checked)} 
                  className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                Se souvenir de mon identifiant
              </label>
            </div>

            {/* Message d'erreur */}
            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm text-center font-medium">
                {error}
              </div>
            )}

            {/* Bouton de Connexion */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 hover:bg-primary-700 active:scale-[0.98] text-white font-semibold py-3.5 rounded-xl transition shadow-lg shadow-primary-600/20 disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Connexion en cours...</span>
                </>
              ) : (
                <span>Se Connecter</span>
              )}
            </button>

            <button type="button" onClick={() => { setMode("register"); setError(null) }} className="w-full text-sm text-primary-700 hover:underline font-medium">
              Créer un compte administrateur
            </button>
          </form>
          )}

          {MOCK_MODE && mode === "login" && (
            <DemoAccounts onPick={(id, pwd) => { setIdentifier(id); setPassword(pwd); setError(null) }} />
          )}
        </div>

        {/* Pied de page */}
        <div className="pt-6 border-t border-slate-100 text-center lg:text-left">
          <p className="text-xs text-slate-400">
            Besoin d'assistance technique ? Contactez votre administrateur.
          </p>
        </div>

      </div>

    </div>
  )
}