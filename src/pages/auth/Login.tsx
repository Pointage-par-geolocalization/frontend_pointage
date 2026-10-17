// src/pages/auth/Login.tsx
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ApiError, MOCK_MODE } from "../../services/api"
import DemoAccounts from "../../components/DemoAccounts"
import { useAuth } from "../../hooks/useAuth"
import {
  ArrowRight, BadgeCheck, CalendarCheck2, Check, Clock3, Eye, EyeOff,
  Fingerprint, KeyRound, Loader2, LockKeyhole, Mail, ShieldCheck, Sparkles,
  TrendingUp, UserRound,
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

  useEffect(() => {
    if (!authLoading && appUser) navigate(appUser.role === "admin" ? "/admin" : "/employe", { replace: true })
  }, [appUser, authLoading, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(null); setLoading(true)
    try {
      await login(identifier.trim(), password)
      if (remember) localStorage.setItem("rememberedId", identifier.trim())
      else localStorage.removeItem("rememberedId")
    } catch (err) {
      const shown = err instanceof ApiError && err.status !== 401
      setError(shown ? err.message : "Identifiant ou mot de passe incorrect.")
    } finally { setLoading(false) }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault(); setError(null)
    if (regPassword.length < 8) { setError("Choisissez un mot de passe d’au moins 8 caractères."); return }
    if (regPassword !== regConfirm) { setError("Les mots de passe ne correspondent pas."); return }
    setLoading(true)
    try { await registerAdmin(regEmail.trim(), regPassword, regCode.trim()) }
    catch (err) { setError(err instanceof ApiError && err.status < 500 ? err.message : "Impossible de créer le compte administrateur.") }
    finally { setLoading(false) }
  }

  const fieldClass = "w-full rounded-xl border border-slate-200 bg-slate-50/80 px-11 py-3 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
  const labelClass = "mb-1.5 block text-[11px] font-bold uppercase tracking-[.11em] text-slate-600"

  return (
    <main className="auth-shell flex h-[100dvh] w-full overflow-hidden bg-[#f6f8fc] p-3 sm:p-5 lg:p-7">
      <div className="auth-frame mx-auto grid h-full w-full max-w-[1500px] overflow-hidden rounded-[26px] border border-white bg-white shadow-[0_24px_80px_-30px_rgba(28,42,87,.28)] lg:grid-cols-[1.08fr_.92fr]">
        <section className="hero-panel relative hidden overflow-hidden p-9 text-white sm:flex sm:flex-col sm:justify-between lg:p-12 xl:p-14">
          <div className="hero-photo absolute inset-0" />
          <div className="hero-shade absolute inset-0" />
          <div className="hero-grid absolute inset-0 opacity-[.14]" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/15 shadow-lg backdrop-blur-md"><Fingerprint className="h-6 w-6" /></div>
            <div><div className="text-[15px] font-bold tracking-tight">Tempo<span className="text-cyan-300">+</span></div><div className="text-[10px] font-medium uppercase tracking-[.2em] text-white/65">Gestion des équipes</div></div>
          </div>
          <div className="relative z-10 my-auto max-w-[620px] py-8">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-[11px] font-semibold tracking-wide text-white/90 backdrop-blur-md"><Sparkles className="h-3.5 w-3.5 text-cyan-300" /> Votre espace de travail, en mieux</div>
            <h1 className="max-w-[600px] text-4xl font-semibold leading-[1.08] tracking-[-.045em] xl:text-[54px]">Le temps de vos équipes.<br/><span className="text-cyan-200">Maîtrisé simplement.</span></h1>
            <p className="mt-5 max-w-[490px] text-[15px] leading-7 text-white/75">Pointage, présence et rémunération réunis dans un espace clair, fiable et pensé pour le terrain.</p>
            <div className="mt-8 grid max-w-[540px] grid-cols-3 gap-2.5">
              {[{ icon: Clock3, title: "Pointage", sub: "En temps réel" }, { icon: TrendingUp, title: "Rémunération", sub: "Calcul simplifié" }, { icon: CalendarCheck2, title: "Présences", sub: "Vue d’ensemble" }].map(({icon: Icon,title,sub}) => <div key={title} className="rounded-2xl border border-white/15 bg-white/[.11] p-3.5 backdrop-blur-md"><Icon className="mb-3 h-[18px] w-[18px] text-cyan-200"/><div className="text-[12px] font-semibold">{title}</div><div className="mt-1 text-[10px] text-white/60">{sub}</div></div>)}
            </div>
          </div>
          <div className="relative z-10 flex items-center justify-between border-t border-white/20 pt-4 text-[11px] text-white/65"><span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300"/> Accès sécurisé</span><span>Une gestion plus sereine, chaque jour.</span></div>
        </section>

        <section className="relative flex min-h-0 flex-col justify-center overflow-hidden px-5 py-5 sm:px-9 sm:py-6 lg:overflow-hidden lg:px-10 xl:px-16">
          <div className="mb-5 flex items-center gap-2.5 sm:hidden"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white"><Fingerprint className="h-5 w-5"/></span><span className="font-bold text-slate-900">Tempo<span className="text-indigo-600">+</span></span></div>
          <div className="mx-auto w-full max-w-[410px]">
            <div className="mb-6 sm:mb-7">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><LockKeyhole className="h-5 w-5"/></div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[.17em] text-indigo-600">{mode === "login" ? "Espace sécurisé" : "Accès administrateur"}</p>
              <h2 className="text-[28px] font-semibold tracking-[-.04em] text-slate-950 sm:text-[32px]">{mode === "login" ? "Ravi de vous revoir" : "Créer votre compte"}</h2>
              <p className="mt-1.5 text-[13px] leading-5 text-slate-500">{mode === "login" ? "Connectez-vous pour accéder à votre espace de gestion." : "Renseignez vos informations et votre code d’invitation."}</p>
            </div>

            {mode === "login" ? <form onSubmit={handleSubmit} className="space-y-4">
              <div><label htmlFor="identifier" className={labelClass}>Identifiant ou e-mail</label><div className="relative"><UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-slate-400"/><input id="identifier" type="text" autoComplete="username" value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="Ex. EMP-001 ou nom@entreprise.fr" className={fieldClass} required /></div></div>
              <div><label htmlFor="password" className={labelClass}>Mot de passe ou code PIN</label><div className="relative"><KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-slate-400"/><input id="password" type={showPassword ? "text":"password"} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Saisissez votre mot de passe" className={`${fieldClass} pr-12`} required/><button type="button" aria-label={showPassword ? "Masquer le mot de passe":"Afficher le mot de passe"} onClick={()=>setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-700">{showPassword?<EyeOff className="h-[17px] w-[17px]"/>:<Eye className="h-[17px] w-[17px]"/>}</button></div></div>
              <label className="flex cursor-pointer items-center gap-2.5 py-0.5 text-[12px] text-slate-600"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-indigo-600"/>Se souvenir de mon identifiant</label>
              {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12px] font-medium text-rose-700">{error}</div>}
              <button type="submit" disabled={loading} className="group flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(79,70,229,.75)] transition hover:-translate-y-0.5 hover:bg-indigo-700 disabled:pointer-events-none disabled:opacity-60">{loading?<><Loader2 className="h-4 w-4 animate-spin"/>Connexion en cours…</>:<>Accéder à mon espace<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1"/></>}</button>
              <div className="flex items-center gap-3 py-0.5"><span className="h-px flex-1 bg-slate-100"/><span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Nouveau sur Tempo+</span><span className="h-px flex-1 bg-slate-100"/></div>
              <button type="button" onClick={()=>{setMode("register");setError(null)}} className="w-full rounded-xl border border-slate-200 bg-white py-3 text-[12px] font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700">Créer un compte administrateur</button>
            </form> : <form onSubmit={handleRegister} className="space-y-3">
              {[{label:"Adresse e-mail",type:"email",value:regEmail,set:setRegEmail,placeholder:"vous@entreprise.fr",icon:Mail,auto:"email"},{label:"Mot de passe",type:"password",value:regPassword,set:setRegPassword,placeholder:"8 caractères minimum",icon:KeyRound,auto:"new-password"},{label:"Confirmer le mot de passe",type:"password",value:regConfirm,set:setRegConfirm,placeholder:"Répétez votre mot de passe",icon:Check,auto:"new-password"},{label:"Code d’invitation administrateur",type:"password",value:regCode,set:setRegCode,placeholder:"Code fourni par le propriétaire",icon:ShieldCheck,auto:"off"}].map(({label,type,value,set,placeholder,icon:Icon,auto})=><div key={label}><label className={labelClass}>{label}</label><div className="relative"><Icon className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-slate-400"/><input type={type} value={value} onChange={e=>set(e.target.value)} placeholder={placeholder} autoComplete={auto} className={fieldClass} required/></div></div>)}
              {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12px] font-medium text-rose-700">{error}</div>}
              <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3.5 text-[13px] font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:opacity-60">{loading?<><Loader2 className="h-4 w-4 animate-spin"/>Création en cours…</>:<>Créer mon compte<ArrowRight className="h-4 w-4"/></>}</button>
              <button type="button" onClick={()=>{setMode("login");setError(null)}} className="w-full py-2 text-[12px] font-semibold text-slate-500 transition hover:text-indigo-700">← Retour à la connexion</button>
            </form>}
            {MOCK_MODE && mode === "login" && <div className="mt-4"><DemoAccounts onPick={(id,pwd)=>{setIdentifier(id);setPassword(pwd);setError(null)}}/></div>}
            <div className="mt-6 flex items-center justify-center gap-1.5 text-[10px] text-slate-400"><BadgeCheck className="h-3.5 w-3.5 text-emerald-500"/>Vos données sont protégées et confidentielles</div>
          </div>
          <div className="absolute bottom-3 left-0 right-0 hidden text-center text-[10px] text-slate-300 lg:block">Tempo+ · Gestion des équipes</div>
        </section>
      </div>
      <style>{`
        .hero-photo{background-image:url('/logiciel-de-pointage-technicien-tablette.webp');background-size:cover;background-position:center 42%;transform:scale(1.02)}
        .hero-shade{background:linear-gradient(112deg,rgba(11,24,62,.93) 0%,rgba(20,38,92,.84) 52%,rgba(14,66,105,.66) 100%)}
        .hero-grid{background-image:radial-gradient(rgba(255,255,255,.42) .65px,transparent .65px);background-size:19px 19px;mask-image:linear-gradient(90deg,black,transparent 90%)}
        @media(max-height:700px){.auth-shell{padding:10px}.auth-frame{border-radius:20px}.auth-frame section:last-child{padding-top:12px;padding-bottom:12px}.auth-frame section:last-child>div:first-child:not(.sm\\:hidden){transform:scale(.94);transform-origin:center}.hero-panel{padding-top:26px;padding-bottom:26px}}
        @media(max-width:639px){.auth-shell{min-height:100dvh;padding:0}.auth-frame{border:0;border-radius:0}}
        @media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition:none!important}}
      `}</style>
    </main>
  )
}
