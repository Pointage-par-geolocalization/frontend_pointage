// src/pages/auth/Login.tsx
import { useState, useEffect, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { Capacitor } from "@capacitor/core"
import { ApiError, MOCK_MODE } from "../../services/api"
import DemoAccounts from "../../components/DemoAccounts"
import { useAuth } from "../../hooks/useAuth"
import technicienImg from "../../assets/technicien-hologramme.webp"
import {
  Eye,
  EyeOff,
  Lock,
  User,
  Mail,
  KeyRound,
  Loader2,
  Clock,
  CalendarCheck,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  type LucideIcon,
} from "lucide-react"

/* ------------------------------------------------------------------ */
/*  Styles propres à la page (animations + champs à label flottant)    */
/* ------------------------------------------------------------------ */
const css = `
.auth-root { --fh: clamp(46px, 7.2vh, 56px); }

/* ---------- Animations ---------- */
@keyframes auth-float   { 0%,100% { transform: translateY(0) }   50% { transform: translateY(-12px) } }
@keyframes auth-spin    { to { transform: rotate(360deg) } }
@keyframes auth-border  { 0% { background-position: 0% 50% } 100% { background-position: 300% 50% } }
@keyframes auth-in      { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
@keyframes auth-card-in { from { opacity: 0; transform: translateY(18px) scale(.985) } to { opacity: 1; transform: none } }
@keyframes auth-shake   { 0%,100% { transform: translateX(0) } 20%,60% { transform: translateX(-5px) } 40%,80% { transform: translateX(5px) } }

.auth-float     { animation: auth-float 7s ease-in-out infinite; }
.auth-float-b   { animation: auth-float 6s ease-in-out -2s infinite; }
.auth-float-c   { animation: auth-float 8s ease-in-out -4s infinite; }
.auth-spin-slow { animation: auth-spin 90s linear infinite; }
.auth-spin-rev  { animation: auth-spin 140s linear infinite reverse; }
.auth-in        { animation: auth-in .45s cubic-bezier(.2,.8,.2,1) both; }
.auth-card-in   { animation: auth-card-in .7s cubic-bezier(.2,.8,.2,1) both; }
.auth-shake     { animation: auth-shake .4s ease-in-out; }

/* ---------- Décors ---------- */
.auth-grid {
  background-image:
    linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px);
  background-size: 44px 44px;
  -webkit-mask-image: radial-gradient(ellipse at 70% 55%, #000 20%, transparent 70%);
          mask-image: radial-gradient(ellipse at 70% 55%, #000 20%, transparent 70%);
}
.auth-dots {
  background-image: radial-gradient(rgba(71,85,105,.22) 1px, transparent 1px);
  background-size: 22px 22px;
  -webkit-mask-image: radial-gradient(ellipse at center, #000 25%, transparent 75%);
          mask-image: radial-gradient(ellipse at center, #000 25%, transparent 75%);
}
.auth-halo {
  background: radial-gradient(circle, rgba(125,170,255,.55) 0%, rgba(99,102,241,.22) 42%, transparent 70%);
}
.auth-card-border {
  background: linear-gradient(120deg, rgba(99,102,241,.7), rgba(255,255,255,.9), rgba(56,130,246,.7), rgba(255,255,255,.9), rgba(99,102,241,.7));
  background-size: 300% 300%;
  animation: auth-border 9s linear infinite;
}

/* ---------- Champs à label flottant ---------- */
.auth-field { position: relative; }
.auth-input {
  width: 100%;
  height: var(--fh);
  padding: 1.05rem 2.9rem 0 2.8rem;
  font-size: .9rem;
  color: #0f172a;
  background: rgba(248,250,252,.9);
  border: 1.5px solid #e2e8f0;
  border-radius: .9rem;
  outline: none;
  transition: border-color .2s, box-shadow .2s, background-color .2s;
}
.auth-input:hover { border-color: #cbd5e1; }
.auth-label {
  position: absolute;
  left: 2.8rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: .875rem;
  color: #64748b;
  pointer-events: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: calc(100% - 5.2rem);
  transition: top .18s ease, transform .18s ease, font-size .18s ease, letter-spacing .18s ease;
}
.auth-input:focus ~ .auth-label,
.auth-input:not(:placeholder-shown) ~ .auth-label,
.auth-input:-webkit-autofill ~ .auth-label {
  top: .5rem;
  transform: none;
  font-size: .625rem;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
}

/* ---------- Bouton principal : reflet au survol ---------- */
.auth-btn { position: relative; overflow: hidden; }
.auth-btn::after {
  content: "";
  position: absolute; inset: 0;
  background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,.35) 50%, transparent 70%);
  transform: translateX(-120%);
  transition: transform .8s ease;
}
.auth-btn:hover:not(:disabled)::after { transform: translateX(120%); }

/* ---------- Scroll masqué (simple filet de sécurité sur très petits écrans) ---------- */
.auth-noscrollbar { scrollbar-width: none; }
.auth-noscrollbar::-webkit-scrollbar { display: none; }

/* ---------- Écrans peu hauts : on compacte pour tout garder sans défiler ---------- */
@media (max-height: 700px) { .auth-hide-short  { display: none !important; } }
@media (max-height: 620px) { .auth-hide-xshort { display: none !important; } }

@media (prefers-reduced-motion: reduce) {
  .auth-float, .auth-float-b, .auth-float-c, .auth-spin-slow, .auth-spin-rev, .auth-card-border, .auth-in, .auth-card-in { animation: none !important; }
}
`

/* ------------------------------------------------------------------ */
/*  Champ de formulaire réutilisable                                   */
/* ------------------------------------------------------------------ */
type FieldProps = {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  icon: LucideIcon
  type?: string
  secret?: boolean
  autoComplete?: string
}

function Field({ id, label, value, onChange, icon: Icon, type = "text", secret = false, autoComplete = "off" }: FieldProps) {
  const [visible, setVisible] = useState(false)
  const inputType = secret ? (visible ? "text" : "password") : type

  return (
    <div className="auth-field">
      <input
        id={id}
        type={inputType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder=" "
        autoComplete={autoComplete}
        required
        className="auth-input peer focus:bg-white focus:border-primary-500 focus:shadow-[0_0_0_4px_rgba(59,108,246,0.14)]"
      />
      <label htmlFor={id} className="auth-label peer-focus:text-primary-600">
        {label}
      </label>
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 transition-colors peer-focus:text-primary-600">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      {secret && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 transition-colors hover:text-primary-600"
        >
          {visible ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
        </button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Heure en direct (composant isolé pour ne pas re-rendre le formulaire) */
/* ------------------------------------------------------------------ */
function LiveClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return <>{now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</>
}

/* ------------------------------------------------------------------ */
/*  Données du bloc d'information (texte inchangé)                     */
/* ------------------------------------------------------------------ */
const features: { icon: LucideIcon; title: string; text: string; tone: string }[] = [
  {
    icon: Clock,
    title: "Pointage Instantané",
    text: "Enregistrement précis des arrivées et départs.",
    tone: "bg-primary-500/30 text-primary-200 border-primary-300/20",
  },
  {
    icon: TrendingUp,
    title: "Calcul de Rémunération",
    text: "Heures supplémentaires et primes dynamiques.",
    tone: "bg-indigo-500/30 text-indigo-200 border-indigo-300/20",
  },
  {
    icon: CalendarCheck,
    title: "Tableaux de Bord RH",
    text: "Validation simplifiée par les administrateurs.",
    tone: "bg-emerald-500/30 text-emerald-200 border-emerald-300/20",
  },
]

export default function Login() {
  const navigate = useNavigate()
  const { appUser, loading: authLoading, login, registerAdmin } = useAuth()
  const isNativeApp = Capacitor.isNativePlatform()

  const [identifier, setIdentifier] = useState(() => localStorage.getItem("rememberedId") ?? "")
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(!!localStorage.getItem("rememberedId"))

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [mode, setMode] = useState<"login" | "register">("login")
  const [regEmail, setRegEmail] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regConfirm, setRegConfirm] = useState("")
  const [regCode, setRegCode] = useState("")

  async function handleRegister(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (isNativeApp) {
      setError("La création de comptes administrateur est réservée au portail web.")
      return
    }
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

  async function handleSubmit(e: FormEvent) {
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

  function switchMode(next: "login" | "register") {
    if (isNativeApp && next === "register") return
    if (next === mode) return
    setMode(next)
    setError(null)
  }

  const errorBox = error && (
    <div
      key={error}
      role="alert"
      className="auth-shake flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] font-medium leading-snug text-red-600"
    >
      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
      <span>{error}</span>
    </div>
  )

  return (
    <div
      className="auth-root flex w-full overflow-hidden bg-slate-50 font-sans"
      style={{ height: "100dvh" }}
    >
      <style>{css}</style>

      {/* ================= COLONNE GAUCHE : INFO + PHOTO (masquée sur mobile/tablette) ================= */}
      <aside className="relative hidden h-full overflow-hidden bg-gradient-to-br from-primary-900 via-primary-800 to-indigo-900 text-white lg:flex lg:w-7/12">

        {/* Trame + lueurs décoratives */}
        <div className="auth-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 animate-pulse rounded-full bg-primary-500/20 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 animate-pulse rounded-full bg-indigo-500/20 blur-3xl" style={{ animationDuration: "4s" }} aria-hidden />

        {/* ---- Photo en arrière-plan du texte ---- */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <img
            src={technicienImg}
            alt=""
            draggable={false}
            className="absolute bottom-0 left-0 h-[74%] w-auto max-w-none select-none object-cover object-left"
            style={{
              WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, #000 30%, #000 100%)",
              maskImage: "linear-gradient(to bottom, transparent 0%, #000 30%, #000 100%)",
            }}
          />
          {/* Teinte de marque pour fondre la photo dans le bleu */}
          <div className="absolute inset-0 bg-gradient-to-t from-primary-900/70 via-primary-800/15 to-primary-900/40 mix-blend-multiply" />
          <div className="absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-indigo-900/60 to-transparent" />
        </div>

        {/* Voile de lisibilité pour le texte du haut */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[46%] bg-gradient-to-b from-primary-900 via-primary-900/75 to-transparent" aria-hidden />

        {/* Widget « pointage en direct » */}
        <div className="pointer-events-none absolute inset-0 z-[5]" aria-hidden>
          <div className="auth-float-b absolute right-[5%] top-[30%] flex items-center gap-3 rounded-2xl bg-white/95 py-2.5 pl-2.5 pr-4 shadow-2xl shadow-primary-900/40 ring-1 ring-white/60">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                Arrivée enregistrée
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
              </p>
              <p className="text-lg font-bold tabular-nums tracking-tight text-slate-900"><LiveClock /></p>
            </div>
          </div>
        </div>

        {/* ---- Contenu texte ---- */}
        <div className="relative z-10 flex h-full w-full flex-col justify-between px-12 py-[clamp(1.25rem,5vh,3.5rem)] xl:px-16">
          <div>
            <div className="mb-[clamp(.6rem,2.4vh,1.5rem)] inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-primary-100 shadow-inner backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 animate-spin text-primary-300" style={{ animationDuration: "6s" }} />
              <span>Plateforme de Gestion RH</span>
            </div>
            <h1 className="mb-[clamp(.5rem,1.8vh,1rem)] text-[clamp(1.75rem,min(5.4vh,3.7vw),3rem)] font-extrabold leading-[1.1] tracking-tight">
              Suivi des pointages &amp;<br />rémunération en temps réel
            </h1>
            <p className="max-w-[26rem] text-[clamp(.85rem,2.1vh,1.1rem)] leading-relaxed text-primary-100/90">
              Optimisez le temps de travail de vos équipes, suivez les présences instantanément et automatisez le calcul de la paie en toute simplicité.
            </p>
          </div>

          {/* Cartes en rangée, en bas, pour laisser la photo respirer */}
          <div className="grid grid-cols-3 gap-[clamp(.5rem,1.4vh,.75rem)]">
            {features.map(({ icon: Icon, title, text, tone }) => (
              <div
                key={title}
                className="flex items-start gap-2.5 rounded-2xl border border-white/15 bg-primary-900/50 p-[clamp(.55rem,1.5vh,.8rem)] shadow-xl backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:bg-primary-800/60"
              >
                <div className={`shrink-0 rounded-lg border p-2 ${tone}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[13px] font-semibold leading-tight text-white">{title}</h3>
                  <p className="auth-hide-xshort mt-0.5 text-[11px] leading-snug text-primary-100/75">{text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-white/10 pt-[clamp(.5rem,1.8vh,1.25rem)] text-xs text-primary-100/70">
            <span className="flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Sécurisé &amp; Conforme
            </span>
          </div>
        </div>
      </aside>

      {/* ================= COLONNE DROITE : FORMULAIRE ================= */}
      <main className="auth-noscrollbar relative h-full w-full overflow-y-auto lg:w-5/12">
        {/* Décor : aurore + trame de points */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary-200/60 blur-3xl" />
          <div className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-indigo-200/60 blur-3xl" />
          <div className="absolute right-[18%] top-[55%] h-40 w-40 rounded-full bg-sky-200/50 blur-3xl" />
          <div className="auth-dots absolute inset-0" />
        </div>

        <div className="relative flex min-h-full items-center justify-center p-4 sm:p-8">
          {/* Carte avec bordure dégradée animée */}
          <div className="auth-card-in auth-card-border w-full max-w-[440px] rounded-[26px] p-px shadow-2xl shadow-primary-900/10">
            <div className="rounded-[25px] bg-white/85 p-[clamp(1.1rem,3.4vh,2rem)] backdrop-blur-xl sm:px-[clamp(1.4rem,3.2vh,2.25rem)]">

              {/* Marque */}
              <div className="mb-[clamp(.7rem,2vh,1.1rem)] flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-indigo-600 text-white shadow-lg shadow-primary-600/30">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-bold text-slate-900">Pointage &amp; Rémunération</p>
                  <p className="text-[11px] font-medium text-slate-500">Portail sécurisé</p>
                </div>
              </div>

              {/* Sélecteur de mode (pastille animée) */}
              <div className={`relative mb-[clamp(.7rem,2.2vh,1.25rem)] grid ${isNativeApp ? "grid-cols-1" : "grid-cols-2"} rounded-xl bg-slate-100 p-1`} role="group" aria-label="Choix du mode">
                {!isNativeApp && (
                  <span
                    className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg bg-white shadow-sm ring-1 ring-slate-200/70 transition-transform duration-300 ease-out"
                    style={{ transform: mode === "register" ? "translateX(100%)" : "translateX(0)" }}
                    aria-hidden
                  />
                )}
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  aria-pressed={mode === "login"}
                  className={`relative z-10 rounded-lg py-2 text-[13px] font-semibold transition-colors ${isNativeApp ? "w-full" : ""} ${mode === "login" ? "text-primary-700" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Connexion
                </button>
                {!isNativeApp && (
                  <button
                    type="button"
                    onClick={() => switchMode("register")}
                    aria-pressed={mode === "register"}
                    className={`relative z-10 rounded-lg py-2 text-[13px] font-semibold transition-colors ${mode === "register" ? "text-primary-700" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    Créer un compte
                  </button>
                )}
              </div>

              {/* Titre */}
              <div key={`title-${mode}`} className="auth-in mb-[clamp(.7rem,2.2vh,1.25rem)]">
                <h2 className="text-[clamp(1.35rem,3.4vh,1.75rem)] font-bold tracking-tight text-slate-900">
                  {mode === "login" ? "Content de vous revoir" : "Compte administrateur"}
                </h2>
                <p className="auth-hide-xshort mt-1 text-[13px] leading-snug text-slate-500">
                  {mode === "login"
                    ? "Identifiez-vous pour accéder à votre espace de pointage et de paie."
                    : "Renseignez vos informations et le code d'invitation fourni par le propriétaire."}
                </p>
              </div>

              {/* ---------- Formulaire ---------- */}
              {mode === "register" ? (
                <form key="register" onSubmit={handleRegister} className="auth-in space-y-[clamp(.55rem,1.6vh,.9rem)]">
                  <Field id="reg-email" label="Adresse e-mail" type="email" icon={Mail} value={regEmail} onChange={setRegEmail} autoComplete="email" />
                  <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                    <Field id="reg-password" label="Mot de passe" icon={Lock} secret value={regPassword} onChange={setRegPassword} autoComplete="new-password" />
                    <Field id="reg-confirm" label="Confirmation" icon={Lock} secret value={regConfirm} onChange={setRegConfirm} autoComplete="new-password" />
                  </div>
                  <p className="auth-hide-short -mt-1 text-[11px] text-slate-400">6 caractères minimum.</p>
                  <Field id="reg-code" label="Code d'invitation administrateur" icon={KeyRound} secret value={regCode} onChange={setRegCode} />

                  {errorBox}

                  <button
                    type="submit"
                    disabled={loading}
                    className="auth-btn group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 via-primary-500 to-indigo-500 py-[clamp(.7rem,1.9vh,.95rem)] text-sm font-semibold text-white shadow-lg shadow-primary-600/30 transition hover:shadow-xl hover:shadow-primary-600/40 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Création en cours...</span>
                      </>
                    ) : (
                      <>
                        <span>Créer le compte administrateur</span>
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form key="login" onSubmit={handleSubmit} className="auth-in space-y-[clamp(.55rem,1.6vh,.9rem)]">
                  <Field id="login-id" label="Identifiant ou e-mail" icon={User} value={identifier} onChange={setIdentifier} autoComplete="username" />
                  <Field id="login-pwd" label="Mot de passe ou PIN" icon={Lock} secret value={password} onChange={setPassword} autoComplete="current-password" />

                  {/* Se souvenir de moi */}
                  <label className="flex w-fit cursor-pointer select-none items-center gap-2.5 text-[13px] text-slate-600">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    Se souvenir de mon identifiant
                  </label>

                  {errorBox}

                  <button
                    type="submit"
                    disabled={loading}
                    className="auth-btn group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 via-primary-500 to-indigo-500 py-[clamp(.7rem,1.9vh,.95rem)] text-sm font-semibold text-white shadow-lg shadow-primary-600/30 transition hover:shadow-xl hover:shadow-primary-600/40 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Connexion en cours...</span>
                      </>
                    ) : (
                      <>
                        <span>Se connecter</span>
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {MOCK_MODE && mode === "login" && (
                <DemoAccounts onPick={(id, pwd) => { setIdentifier(id); setPassword(pwd); setError(null) }} />
              )}

              {/* Pied de carte */}
              <p className="auth-hide-short mt-[clamp(.6rem,1.8vh,1.1rem)] flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                <Lock className="h-3 w-3" /> Connexion sécurisée et chiffrée
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}


// // src/pages/auth/Login.tsx
// import { useState, useEffect, type FormEvent } from "react"
// import { useNavigate } from "react-router-dom"
// import { ApiError, MOCK_MODE } from "../../services/api"
// import DemoAccounts from "../../components/DemoAccounts"
// import { useAuth } from "../../hooks/useAuth"
// import technicienImg from "../../assets/technicien-hologramme.webp"
// import {
//   Eye,
//   EyeOff,
//   Lock,
//   User,
//   Mail,
//   KeyRound,
//   Loader2,
//   Clock,
//   CalendarCheck,
//   TrendingUp,
//   Sparkles,
//   CheckCircle2,
//   ShieldCheck,
//   ArrowRight,
//   type LucideIcon,
// } from "lucide-react"

// /* ------------------------------------------------------------------ */
// /*  Styles propres à la page (animations + champs à label flottant)    */
// /* ------------------------------------------------------------------ */
// const css = `
// .auth-root { --fh: clamp(46px, 7.2vh, 56px); }

// /* ---------- Animations ---------- */
// @keyframes auth-float   { 0%,100% { transform: translateY(0) }   50% { transform: translateY(-12px) } }
// @keyframes auth-spin    { to { transform: rotate(360deg) } }
// @keyframes auth-border  { 0% { background-position: 0% 50% } 100% { background-position: 300% 50% } }
// @keyframes auth-in      { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
// @keyframes auth-card-in { from { opacity: 0; transform: translateY(18px) scale(.985) } to { opacity: 1; transform: none } }
// @keyframes auth-shake   { 0%,100% { transform: translateX(0) } 20%,60% { transform: translateX(-5px) } 40%,80% { transform: translateX(5px) } }

// .auth-float     { animation: auth-float 7s ease-in-out infinite; }
// .auth-float-b   { animation: auth-float 6s ease-in-out -2s infinite; }
// .auth-float-c   { animation: auth-float 8s ease-in-out -4s infinite; }
// .auth-spin-slow { animation: auth-spin 90s linear infinite; }
// .auth-spin-rev  { animation: auth-spin 140s linear infinite reverse; }
// .auth-in        { animation: auth-in .45s cubic-bezier(.2,.8,.2,1) both; }
// .auth-card-in   { animation: auth-card-in .7s cubic-bezier(.2,.8,.2,1) both; }
// .auth-shake     { animation: auth-shake .4s ease-in-out; }

// /* ---------- Décors ---------- */
// .auth-grid {
//   background-image:
//     linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px),
//     linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px);
//   background-size: 44px 44px;
//   -webkit-mask-image: radial-gradient(ellipse at 70% 55%, #000 20%, transparent 70%);
//           mask-image: radial-gradient(ellipse at 70% 55%, #000 20%, transparent 70%);
// }
// .auth-dots {
//   background-image: radial-gradient(rgba(71,85,105,.22) 1px, transparent 1px);
//   background-size: 22px 22px;
//   -webkit-mask-image: radial-gradient(ellipse at center, #000 25%, transparent 75%);
//           mask-image: radial-gradient(ellipse at center, #000 25%, transparent 75%);
// }
// .auth-halo {
//   background: radial-gradient(circle, rgba(125,170,255,.55) 0%, rgba(99,102,241,.22) 42%, transparent 70%);
// }
// .auth-card-border {
//   background: linear-gradient(120deg, rgba(99,102,241,.7), rgba(255,255,255,.9), rgba(56,130,246,.7), rgba(255,255,255,.9), rgba(99,102,241,.7));
//   background-size: 300% 300%;
//   animation: auth-border 9s linear infinite;
// }

// /* ---------- Champs à label flottant ---------- */
// .auth-field { position: relative; }
// .auth-input {
//   width: 100%;
//   height: var(--fh);
//   padding: 1.05rem 2.9rem 0 2.8rem;
//   font-size: .9rem;
//   color: #0f172a;
//   background: rgba(248,250,252,.9);
//   border: 1.5px solid #e2e8f0;
//   border-radius: .9rem;
//   outline: none;
//   transition: border-color .2s, box-shadow .2s, background-color .2s;
// }
// .auth-input:hover { border-color: #cbd5e1; }
// .auth-label {
//   position: absolute;
//   left: 2.8rem;
//   top: 50%;
//   transform: translateY(-50%);
//   font-size: .875rem;
//   color: #64748b;
//   pointer-events: none;
//   white-space: nowrap;
//   overflow: hidden;
//   text-overflow: ellipsis;
//   max-width: calc(100% - 5.2rem);
//   transition: top .18s ease, transform .18s ease, font-size .18s ease, letter-spacing .18s ease;
// }
// .auth-input:focus ~ .auth-label,
// .auth-input:not(:placeholder-shown) ~ .auth-label,
// .auth-input:-webkit-autofill ~ .auth-label {
//   top: .5rem;
//   transform: none;
//   font-size: .625rem;
//   font-weight: 700;
//   letter-spacing: .08em;
//   text-transform: uppercase;
// }

// /* ---------- Bouton principal : reflet au survol ---------- */
// .auth-btn { position: relative; overflow: hidden; }
// .auth-btn::after {
//   content: "";
//   position: absolute; inset: 0;
//   background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,.35) 50%, transparent 70%);
//   transform: translateX(-120%);
//   transition: transform .8s ease;
// }
// .auth-btn:hover:not(:disabled)::after { transform: translateX(120%); }

// /* ---------- Scroll masqué (simple filet de sécurité sur très petits écrans) ---------- */
// .auth-noscrollbar { scrollbar-width: none; }
// .auth-noscrollbar::-webkit-scrollbar { display: none; }

// /* ---------- Écrans peu hauts : on compacte pour tout garder sans défiler ---------- */
// @media (max-height: 700px) { .auth-hide-short  { display: none !important; } }
// @media (max-height: 620px) { .auth-hide-xshort { display: none !important; } }

// @media (prefers-reduced-motion: reduce) {
//   .auth-float, .auth-float-b, .auth-float-c, .auth-spin-slow, .auth-spin-rev, .auth-card-border, .auth-in, .auth-card-in { animation: none !important; }
// }
// `

// /* ------------------------------------------------------------------ */
// /*  Champ de formulaire réutilisable                                   */
// /* ------------------------------------------------------------------ */
// type FieldProps = {
//   id: string
//   label: string
//   value: string
//   onChange: (v: string) => void
//   icon: LucideIcon
//   type?: string
//   secret?: boolean
//   autoComplete?: string
// }

// function Field({ id, label, value, onChange, icon: Icon, type = "text", secret = false, autoComplete = "off" }: FieldProps) {
//   const [visible, setVisible] = useState(false)
//   const inputType = secret ? (visible ? "text" : "password") : type

//   return (
//     <div className="auth-field">
//       <input
//         id={id}
//         type={inputType}
//         value={value}
//         onChange={(e) => onChange(e.target.value)}
//         placeholder=" "
//         autoComplete={autoComplete}
//         required
//         className="auth-input peer focus:bg-white focus:border-primary-500 focus:shadow-[0_0_0_4px_rgba(59,108,246,0.14)]"
//       />
//       <label htmlFor={id} className="auth-label peer-focus:text-primary-600">
//         {label}
//       </label>
//       <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 transition-colors peer-focus:text-primary-600">
//         <Icon className="h-[18px] w-[18px]" />
//       </span>
//       {secret && (
//         <button
//           type="button"
//           tabIndex={-1}
//           onClick={() => setVisible((v) => !v)}
//           aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
//           className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 transition-colors hover:text-primary-600"
//         >
//           {visible ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
//         </button>
//       )}
//     </div>
//   )
// }

// /* ------------------------------------------------------------------ */
// /*  Heure en direct (composant isolé pour ne pas re-rendre le formulaire) */
// /* ------------------------------------------------------------------ */
// function LiveClock() {
//   const [now, setNow] = useState(() => new Date())
//   useEffect(() => {
//     const t = setInterval(() => setNow(new Date()), 1000)
//     return () => clearInterval(t)
//   }, [])
//   return <>{now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</>
// }

// /* ------------------------------------------------------------------ */
// /*  Données du bloc d'information (texte inchangé)                     */
// /* ------------------------------------------------------------------ */
// const features: { icon: LucideIcon; title: string; text: string; tone: string }[] = [
//   {
//     icon: Clock,
//     title: "Pointage Instantané",
//     text: "Enregistrement précis des arrivées et départs.",
//     tone: "bg-primary-500/30 text-primary-200 border-primary-300/20",
//   },
//   {
//     icon: TrendingUp,
//     title: "Calcul de Rémunération",
//     text: "Heures supplémentaires et primes dynamiques.",
//     tone: "bg-indigo-500/30 text-indigo-200 border-indigo-300/20",
//   },
//   {
//     icon: CalendarCheck,
//     title: "Tableaux de Bord RH",
//     text: "Validation simplifiée par les administrateurs.",
//     tone: "bg-emerald-500/30 text-emerald-200 border-emerald-300/20",
//   },
// ]

// export default function Login() {
//   const navigate = useNavigate()
//   const { appUser, loading: authLoading, login, registerAdmin } = useAuth()

//   const [identifier, setIdentifier] = useState(() => localStorage.getItem("rememberedId") ?? "")
//   const [password, setPassword] = useState("")
//   const [remember, setRemember] = useState(!!localStorage.getItem("rememberedId"))

//   const [error, setError] = useState<string | null>(null)
//   const [loading, setLoading] = useState(false)

//   const [mode, setMode] = useState<"login" | "register">("login")
//   const [regEmail, setRegEmail] = useState("")
//   const [regPassword, setRegPassword] = useState("")
//   const [regConfirm, setRegConfirm] = useState("")
//   const [regCode, setRegCode] = useState("")

//   async function handleRegister(e: FormEvent) {
//     e.preventDefault()
//     setError(null)
//     if (regPassword.length < 6) { setError("Le mot de passe doit contenir au moins 6 caractères."); return }
//     if (regPassword !== regConfirm) { setError("Les mots de passe ne correspondent pas."); return }
//     setLoading(true)
//     try {
//       // Le compte est créé puis connecté directement : redirection par l'effet ci-dessous.
//       await registerAdmin(regEmail.trim(), regPassword, regCode.trim())
//     } catch (err) {
//       // Messages du serveur : email déjà utilisé, code d'invitation incorrect, trop de tentatives…
//       setError(err instanceof ApiError && err.status < 500 ? err.message : "Impossible de créer le compte administrateur.")
//     } finally {
//       setLoading(false)
//     }
//   }

//   useEffect(() => {
//     if (!authLoading && appUser) {
//       navigate(appUser.role === "admin" ? "/admin" : "/employe", { replace: true })
//     }
//   }, [appUser, authLoading, navigate])

//   async function handleSubmit(e: FormEvent) {
//     e.preventDefault()
//     setError(null)
//     setLoading(true)
//     try {
//       await login(identifier.trim(), password)
//       if (remember) localStorage.setItem("rememberedId", identifier.trim())
//       else localStorage.removeItem("rememberedId")
//     } catch (err) {
//       // Compte désactivé, trop de tentatives, serveur injoignable : message du serveur ;
//       // identifiants refusés (401) : message unique qui ne révèle pas si le compte existe.
//       const shown = err instanceof ApiError && err.status !== 401
//       setError(shown ? (err as ApiError).message : "Identifiant ou mot de passe incorrect.")
//     } finally {
//       setLoading(false)
//     }
//   }

//   function switchMode(next: "login" | "register") {
//     if (next === mode) return
//     setMode(next)
//     setError(null)
//   }

//   const errorBox = error && (
//     <div
//       key={error}
//       role="alert"
//       className="auth-shake flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] font-medium leading-snug text-red-600"
//     >
//       <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
//       <span>{error}</span>
//     </div>
//   )

//   return (
//     <div
//       className="auth-root flex w-full overflow-hidden bg-slate-50 font-sans"
//       style={{ height: "100dvh" }}
//     >
//       <style>{css}</style>

//       {/* ================= COLONNE GAUCHE : INFO + PHOTO (masquée sur mobile/tablette) ================= */}
//       <aside className="relative hidden h-full overflow-hidden bg-gradient-to-br from-primary-900 via-primary-800 to-indigo-900 text-white lg:flex lg:w-7/12">

//         {/* Trame + lueurs décoratives */}
//         <div className="auth-grid pointer-events-none absolute inset-0" aria-hidden />
//         <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 animate-pulse rounded-full bg-primary-500/20 blur-3xl" aria-hidden />
//         <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 animate-pulse rounded-full bg-indigo-500/20 blur-3xl" style={{ animationDuration: "4s" }} aria-hidden />

//         {/* ---- Photo en arrière-plan du texte ---- */}
//         <div className="pointer-events-none absolute inset-0" aria-hidden>
//           <img
//             src={technicienImg}
//             alt=""
//             draggable={false}
//             className="absolute bottom-0 left-0 h-[74%] w-auto max-w-none select-none object-cover object-left"
//             style={{
//               WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, #000 30%, #000 100%)",
//               maskImage: "linear-gradient(to bottom, transparent 0%, #000 30%, #000 100%)",
//             }}
//           />
//           {/* Teinte de marque pour fondre la photo dans le bleu */}
//           <div className="absolute inset-0 bg-gradient-to-t from-primary-900/70 via-primary-800/15 to-primary-900/40 mix-blend-multiply" />
//           <div className="absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-indigo-900/60 to-transparent" />
//         </div>

//         {/* Voile de lisibilité pour le texte du haut */}
//         <div className="pointer-events-none absolute inset-x-0 top-0 h-[46%] bg-gradient-to-b from-primary-900 via-primary-900/75 to-transparent" aria-hidden />

//         {/* Widget « pointage en direct » */}
//         <div className="pointer-events-none absolute inset-0 z-[5]" aria-hidden>
//           <div className="auth-float-b absolute right-[5%] top-[30%] flex items-center gap-3 rounded-2xl bg-white/95 py-2.5 pl-2.5 pr-4 shadow-2xl shadow-primary-900/40 ring-1 ring-white/60">
//             <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
//               <CheckCircle2 className="h-5 w-5" />
//             </span>
//             <div className="leading-tight">
//               <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
//                 Arrivée enregistrée
//                 <span className="relative flex h-1.5 w-1.5">
//                   <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
//                   <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
//                 </span>
//               </p>
//               <p className="text-lg font-bold tabular-nums tracking-tight text-slate-900"><LiveClock /></p>
//             </div>
//           </div>
//         </div>

//         {/* ---- Contenu texte ---- */}
//         <div className="relative z-10 flex h-full w-full flex-col justify-between px-12 py-[clamp(1.25rem,5vh,3.5rem)] xl:px-16">
//           <div>
//             <div className="mb-[clamp(.6rem,2.4vh,1.5rem)] inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-primary-100 shadow-inner backdrop-blur-md">
//               <Sparkles className="h-3.5 w-3.5 animate-spin text-primary-300" style={{ animationDuration: "6s" }} />
//               <span>Plateforme de Gestion RH</span>
//             </div>
//             <h1 className="mb-[clamp(.5rem,1.8vh,1rem)] text-[clamp(1.75rem,min(5.4vh,3.7vw),3rem)] font-extrabold leading-[1.1] tracking-tight">
//               Suivi des pointages &amp;<br />rémunération en temps réel
//             </h1>
//             <p className="max-w-[26rem] text-[clamp(.85rem,2.1vh,1.1rem)] leading-relaxed text-primary-100/90">
//               Optimisez le temps de travail de vos équipes, suivez les présences instantanément et automatisez le calcul de la paie en toute simplicité.
//             </p>
//           </div>

//           {/* Cartes en rangée, en bas, pour laisser la photo respirer */}
//           <div className="grid grid-cols-3 gap-[clamp(.5rem,1.4vh,.75rem)]">
//             {features.map(({ icon: Icon, title, text, tone }) => (
//               <div
//                 key={title}
//                 className="flex items-start gap-2.5 rounded-2xl border border-white/15 bg-primary-900/50 p-[clamp(.55rem,1.5vh,.8rem)] shadow-xl backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:bg-primary-800/60"
//               >
//                 <div className={`shrink-0 rounded-lg border p-2 ${tone}`}>
//                   <Icon className="h-4 w-4" />
//                 </div>
//                 <div className="min-w-0">
//                   <h3 className="text-[13px] font-semibold leading-tight text-white">{title}</h3>
//                   <p className="auth-hide-xshort mt-0.5 text-[11px] leading-snug text-primary-100/75">{text}</p>
//                 </div>
//               </div>
//             ))}
//           </div>

//           <div className="flex items-center justify-between border-t border-white/10 pt-[clamp(.5rem,1.8vh,1.25rem)] text-xs text-primary-100/70">
//             <span className="flex items-center gap-1.5 font-medium">
//               <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Sécurisé &amp; Conforme
//             </span>
//           </div>
//         </div>
//       </aside>

//       {/* ================= COLONNE DROITE : FORMULAIRE ================= */}
//       <main className="auth-noscrollbar relative h-full w-full overflow-y-auto lg:w-5/12">
//         {/* Décor : aurore + trame de points */}
//         <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
//           <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary-200/60 blur-3xl" />
//           <div className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-indigo-200/60 blur-3xl" />
//           <div className="absolute right-[18%] top-[55%] h-40 w-40 rounded-full bg-sky-200/50 blur-3xl" />
//           <div className="auth-dots absolute inset-0" />
//         </div>

//         <div className="relative flex min-h-full items-center justify-center p-4 sm:p-8">
//           {/* Carte avec bordure dégradée animée */}
//           <div className="auth-card-in auth-card-border w-full max-w-[440px] rounded-[26px] p-px shadow-2xl shadow-primary-900/10">
//             <div className="rounded-[25px] bg-white/85 p-[clamp(1.1rem,3.4vh,2rem)] backdrop-blur-xl sm:px-[clamp(1.4rem,3.2vh,2.25rem)]">

//               {/* Marque */}
//               <div className="mb-[clamp(.7rem,2vh,1.1rem)] flex items-center gap-3">
//                 <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-indigo-600 text-white shadow-lg shadow-primary-600/30">
//                   <ShieldCheck className="h-5 w-5" />
//                 </div>
//                 <div className="leading-tight">
//                   <p className="text-sm font-bold text-slate-900">Pointage &amp; Rémunération</p>
//                   <p className="text-[11px] font-medium text-slate-500">Portail sécurisé</p>
//                 </div>
//               </div>

//               {/* Sélecteur de mode (pastille animée) */}
//               <div className="relative mb-[clamp(.7rem,2.2vh,1.25rem)] grid grid-cols-2 rounded-xl bg-slate-100 p-1" role="group" aria-label="Choix du mode">
//                 <span
//                   className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg bg-white shadow-sm ring-1 ring-slate-200/70 transition-transform duration-300 ease-out"
//                   style={{ transform: mode === "register" ? "translateX(100%)" : "translateX(0)" }}
//                   aria-hidden
//                 />
//                 <button
//                   type="button"
//                   onClick={() => switchMode("login")}
//                   aria-pressed={mode === "login"}
//                   className={`relative z-10 rounded-lg py-2 text-[13px] font-semibold transition-colors ${mode === "login" ? "text-primary-700" : "text-slate-500 hover:text-slate-700"}`}
//                 >
//                   Connexion
//                 </button>
//                 <button
//                   type="button"
//                   onClick={() => switchMode("register")}
//                   aria-pressed={mode === "register"}
//                   className={`relative z-10 rounded-lg py-2 text-[13px] font-semibold transition-colors ${mode === "register" ? "text-primary-700" : "text-slate-500 hover:text-slate-700"}`}
//                 >
//                   Créer un compte
//                 </button>
//               </div>

//               {/* Titre */}
//               <div key={`title-${mode}`} className="auth-in mb-[clamp(.7rem,2.2vh,1.25rem)]">
//                 <h2 className="text-[clamp(1.35rem,3.4vh,1.75rem)] font-bold tracking-tight text-slate-900">
//                   {mode === "login" ? "Content de vous revoir" : "Compte administrateur"}
//                 </h2>
//                 <p className="auth-hide-xshort mt-1 text-[13px] leading-snug text-slate-500">
//                   {mode === "login"
//                     ? "Identifiez-vous pour accéder à votre espace de pointage et de paie."
//                     : "Renseignez vos informations et le code d'invitation fourni par le propriétaire."}
//                 </p>
//               </div>

//               {/* ---------- Formulaire ---------- */}
//               {mode === "register" ? (
//                 <form key="register" onSubmit={handleRegister} className="auth-in space-y-[clamp(.55rem,1.6vh,.9rem)]">
//                   <Field id="reg-email" label="Adresse e-mail" type="email" icon={Mail} value={regEmail} onChange={setRegEmail} autoComplete="email" />
//                   <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
//                     <Field id="reg-password" label="Mot de passe" icon={Lock} secret value={regPassword} onChange={setRegPassword} autoComplete="new-password" />
//                     <Field id="reg-confirm" label="Confirmation" icon={Lock} secret value={regConfirm} onChange={setRegConfirm} autoComplete="new-password" />
//                   </div>
//                   <p className="auth-hide-short -mt-1 text-[11px] text-slate-400">6 caractères minimum.</p>
//                   <Field id="reg-code" label="Code d'invitation administrateur" icon={KeyRound} secret value={regCode} onChange={setRegCode} />

//                   {errorBox}

//                   <button
//                     type="submit"
//                     disabled={loading}
//                     className="auth-btn group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 via-primary-500 to-indigo-500 py-[clamp(.7rem,1.9vh,.95rem)] text-sm font-semibold text-white shadow-lg shadow-primary-600/30 transition hover:shadow-xl hover:shadow-primary-600/40 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
//                   >
//                     {loading ? (
//                       <>
//                         <Loader2 className="h-5 w-5 animate-spin" />
//                         <span>Création en cours...</span>
//                       </>
//                     ) : (
//                       <>
//                         <span>Créer le compte administrateur</span>
//                         <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
//                       </>
//                     )}
//                   </button>
//                 </form>
//               ) : (
//                 <form key="login" onSubmit={handleSubmit} className="auth-in space-y-[clamp(.55rem,1.6vh,.9rem)]">
//                   <Field id="login-id" label="Identifiant ou e-mail" icon={User} value={identifier} onChange={setIdentifier} autoComplete="username" />
//                   <Field id="login-pwd" label="Mot de passe ou PIN" icon={Lock} secret value={password} onChange={setPassword} autoComplete="current-password" />

//                   {/* Se souvenir de moi */}
//                   <label className="flex w-fit cursor-pointer select-none items-center gap-2.5 text-[13px] text-slate-600">
//                     <input
//                       type="checkbox"
//                       checked={remember}
//                       onChange={(e) => setRemember(e.target.checked)}
//                       className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
//                     />
//                     Se souvenir de mon identifiant
//                   </label>

//                   {errorBox}

//                   <button
//                     type="submit"
//                     disabled={loading}
//                     className="auth-btn group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 via-primary-500 to-indigo-500 py-[clamp(.7rem,1.9vh,.95rem)] text-sm font-semibold text-white shadow-lg shadow-primary-600/30 transition hover:shadow-xl hover:shadow-primary-600/40 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
//                   >
//                     {loading ? (
//                       <>
//                         <Loader2 className="h-5 w-5 animate-spin" />
//                         <span>Connexion en cours...</span>
//                       </>
//                     ) : (
//                       <>
//                         <span>Se connecter</span>
//                         <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
//                       </>
//                     )}
//                   </button>
//                 </form>
//               )}

//               {MOCK_MODE && mode === "login" && (
//                 <DemoAccounts onPick={(id, pwd) => { setIdentifier(id); setPassword(pwd); setError(null) }} />
//               )}

//               {/* Pied de carte */}
//               <p className="auth-hide-short mt-[clamp(.6rem,1.8vh,1.1rem)] flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
//                 <Lock className="h-3 w-3" /> Connexion sécurisée et chiffrée
//               </p>
//             </div>
//           </div>
//         </div>
//       </main>
//     </div>
//   )
// }
