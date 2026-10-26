import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import { useAuth } from "../../hooks/useAuth"
import Card from "../../components/Card"
import {
  approveTimesheet,
  listAdminTimesheets,
  listMyTimesheets,
  prefillMyTimesheet,
  returnTimesheet,
  saveMyTimesheet,
  submitMyTimesheet,
  unlockTimesheet,
  type Timesheet,
  type TimesheetEntry,
} from "../../services/timesheets"
import { errorMessage } from "../../services/api"
import { CheckCircle2, Clock3, Send, Save, RotateCcw, X, History } from "lucide-react"

const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]

type ReasonAction = { type: "unlock" | "return"; sheet: Timesheet }

function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function monday(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

function weekBounds(iso: string) {
  const d = new Date(`${iso}T12:00:00`)
  const end = new Date(d)
  end.setDate(end.getDate() + 6)
  return `${d.toLocaleDateString("fr-FR")} – ${end.toLocaleDateString("fr-FR")}`
}

const emptyEntries = (): TimesheetEntry[] => days.map(() => ({ hours: 0, note: "" }))

export default function Timesheet() {
  const { appUser } = useAuth()
  const manager = appUser?.role === "admin"
  const [week, setWeek] = useState(() => localDate(monday(new Date())))
  const [sheets, setSheets] = useState<Timesheet[]>([])
  const [entries, setEntries] = useState<TimesheetEntry[]>(emptyEntries)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null)
  const [reason, setReason] = useState("")
  const [reasonError, setReasonError] = useState("")

  const refresh = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      if (manager) setSheets(await listAdminTimesheets("ALL"))
      else setSheets(await listMyTimesheets())
    } catch (e) {
      setError(errorMessage(e, "Impossible de charger les feuilles de temps."))
    } finally {
      setLoading(false)
    }
  }, [manager])

  useEffect(() => { void refresh() }, [refresh])

  const mine = sheets.find((x) => x.weekStart === week)
  useEffect(() => {
    setEntries(mine?.entries?.length === 7 ? mine.entries : emptyEntries())
  }, [mine?.id, mine?.status, week])

  const total = useMemo(() => entries.reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0), [entries])
  const canEdit = !mine || mine.status === "DRAFT" || mine.status === "RETURNED" || mine.status === "TO_SUBMIT"

  function change(index: number, key: keyof TimesheetEntry, value: string | number) {
    setEntries((previous) => previous.map((entry, i) => i === index ? { ...entry, [key]: value } : entry))
  }

  async function prefill() {
    setSaving(true)
    setError("")
    setMessage("")
    try {
      const result = await prefillMyTimesheet(week)
      if (Array.isArray(result.entries) && result.entries.length === 7) {
        setEntries(result.entries)
        const sourceCount = result.sources.reduce((count, day) => count + day.attendanceIds.length, 0)
        setMessage(sourceCount
          ? `Préremplissage chargé depuis ${sourceCount} pointage(s). Vérifiez et modifiez les heures avant de soumettre.`
          : "Aucun pointage trouvé; les sept jours sont prêts à être complétés.")
      } else {
        setError("Le serveur n’a pas renvoyé les sept jours de la semaine.")
      }
    } catch (e) {
      setError(errorMessage(e, "Préremplissage indisponible."))
    } finally {
      setSaving(false)
    }
  }

  async function save(submit: boolean) {
    setSaving(true)
    setError("")
    setMessage("")
    try {
      await saveMyTimesheet(week, entries)
      if (submit) await submitMyTimesheet(week)
      setMessage(submit ? "Feuille soumise au responsable." : "Brouillon enregistré sur le serveur.")
      await refresh()
    } catch (e) {
      setError(errorMessage(e, "Enregistrement impossible."))
    } finally {
      setSaving(false)
    }
  }

  async function approve(sheet: Timesheet) {
    setSaving(true)
    setError("")
    try {
      await approveTimesheet(sheet.id)
      setMessage(`Semaine ${weekBounds(sheet.weekStart)} approuvée.`)
      await refresh()
    } catch (e) {
      setError(errorMessage(e, "Validation impossible."))
    } finally {
      setSaving(false)
    }
  }

  function openReasonDialog(type: ReasonAction["type"], sheet: Timesheet) {
    setReasonAction({ type, sheet })
    setReason("")
    setReasonError("")
  }

  function closeReasonDialog() {
    if (saving) return
    setReasonAction(null)
    setReason("")
    setReasonError("")
  }

  async function submitReasonAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!reasonAction) return
    const trimmedReason = reason.trim()
    if (trimmedReason.length < 3) {
      setReasonError("Saisissez un motif d’au moins 3 caractères.")
      return
    }

    setSaving(true)
    setReasonError("")
    setError("")
    try {
      if (reasonAction.type === "unlock") {
        await unlockTimesheet(reasonAction.sheet.id, trimmedReason)
        setMessage("Feuille déverrouillée pour correction. Le motif a été enregistré dans l’historique.")
      } else {
        await returnTimesheet(reasonAction.sheet.id, trimmedReason)
        setMessage("Feuille renvoyée au salarié pour correction. Le motif a été enregistré dans l’historique.")
      }
      setReasonAction(null)
      setReason("")
      await refresh()
    } catch (e) {
      setReasonError(errorMessage(e, "L’opération a échoué. Vérifiez votre connexion et réessayez."))
    } finally {
      setSaving(false)
    }
  }

  const labelStatus = (status: string) => ({
    DRAFT: "Brouillon",
    SUBMITTED: "À valider",
    TO_SUBMIT: "À soumettre",
    RETURNED: "À corriger",
    APPROVED: "Approuvée",
    LOCKED: "Verrouillée",
  }[status] || status)

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">Timesheet hebdomadaire</h1>
        <p className="text-sm text-slate-500">Saisie serveur, soumission salarié et validation du responsable</p>
      </header>

      {error && <div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {message && <div role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}

      {loading ? <Card className="p-5 text-sm text-slate-500">Chargement des feuilles…</Card> : manager ? <>
        <Card className="p-4">
          <h2 className="mb-3 font-semibold">En attente de validation ({sheets.filter((s) => s.status === "SUBMITTED").length})</h2>
          {sheets.filter((s) => s.status === "SUBMITTED").length === 0
            ? <p className="text-sm text-slate-500">Aucune feuille soumise en attente.</p>
            : <div className="space-y-3">
              {sheets.filter((s) => s.status === "SUBMITTED").map((sheet) => (
                <section key={sheet.id} className="rounded-xl border p-3">
                  <div className="flex justify-between gap-3">
                    <div>
                      <b>{sheet.employeeName || sheet.employeeCode}</b>
                      <div className="text-xs text-slate-500">{sheet.employeeCode} · {weekBounds(sheet.weekStart)}</div>
                    </div>
                    <b>{sheet.totalHours} h</b>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 text-xs text-slate-600 sm:grid-cols-4">
                    {sheet.entries.map((entry, index) => <span key={index}>{days[index]} : {entry.hours} h{entry.note ? ` · ${entry.note}` : ""}</span>)}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button disabled={saving} onClick={() => void approve(sheet)} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                      <CheckCircle2 size={16} /> Approuver
                    </button>
                    <button disabled={saving} onClick={() => openReasonDialog("return", sheet)} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm disabled:opacity-50">
                      <RotateCcw size={16} /> Renvoyer
                    </button>
                  </div>
                </section>
              ))}
            </div>}
        </Card>

        <Card className="p-4">
          <h2 className="mb-2 font-semibold">Historique approuvé</h2>
          {sheets.filter((s) => s.status === "APPROVED").slice(0, 15).map((sheet) => (
            <div key={sheet.id} className="flex flex-wrap justify-between gap-2 border-t py-2 text-sm">
              <span>{sheet.employeeName || sheet.employeeCode} · {weekBounds(sheet.weekStart)}</span>
              <span className="flex items-center gap-2 text-emerald-700">
                Approuvée · {sheet.totalHours} h
                <button type="button" disabled={saving} onClick={() => openReasonDialog("unlock", sheet)} className="rounded border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50">
                  Déverrouiller avec motif
                </button>
              </span>
            </div>
          ))}
        </Card>
      </> : <>
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <button aria-label="Semaine précédente" className="rounded-lg border px-3 py-2" onClick={() => { const d = new Date(`${week}T12:00:00`); d.setDate(d.getDate() - 7); setWeek(localDate(d)) }}>←</button>
            <div className="text-center">
              <div className="font-semibold">Semaine du {weekBounds(week)}</div>
              <div className="text-xs text-slate-500">{mine ? labelStatus(mine.status) : "Non commencée"}{mine?.managerNote ? ` — ${mine.managerNote}` : ""}</div>
            </div>
            <button aria-label="Semaine suivante" className="rounded-lg border px-3 py-2" onClick={() => { const d = new Date(`${week}T12:00:00`); d.setDate(d.getDate() + 7); setWeek(localDate(d)) }}>→</button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!canEdit || saving} onClick={() => void prefill()} className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50">Préremplir depuis les pointages</button>
            <span className="self-center text-xs text-slate-500">Les heures suggérées restent modifiables avant enregistrement.</span>
          </div>
          {days.map((day, index) => (
            <div key={day} className="grid grid-cols-[4.2rem_5.2rem_1fr] items-center gap-2 border-t pt-2">
              <label className="text-sm">{day}</label>
              <input aria-label={`Heures ${day}`} disabled={!canEdit || saving} type="number" min="0" max="24" step="0.25" value={entries[index]?.hours || ""} onChange={(e) => change(index, "hours", Number(e.target.value) || 0)} placeholder="0 h" className="w-full rounded-lg border px-2 py-2 text-sm disabled:bg-slate-100" />
              <input aria-label={`Tâche ${day}`} disabled={!canEdit || saving} value={entries[index]?.note || ""} onChange={(e) => change(index, "note", e.target.value)} placeholder="Activité / commentaire" className="min-w-0 rounded-lg border px-2 py-2 text-sm disabled:bg-slate-100" />
            </div>
          ))}
          <div className="flex justify-between border-t pt-3 font-semibold"><span>Total saisi</span><span>{total.toLocaleString("fr-FR")} h</span></div>
          {canEdit
            ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button disabled={saving} onClick={() => void save(false)} className="flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-semibold disabled:opacity-50"><Save size={17} /> Enregistrer le brouillon</button>
              <button disabled={saving || total <= 0} onClick={() => void save(true)} className="flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 font-semibold text-white disabled:opacity-50"><Send size={17} /> {saving ? "Envoi…" : "Soumettre au responsable"}</button>
            </div>
            : <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Cette feuille est verrouillée après soumission. Si elle est renvoyée, vous pourrez la corriger puis la resoumettre.</div>}
        </Card>
        <Card className="p-4 text-sm text-slate-600">Les heures préremplies depuis les pointages ne sont que des suggestions. Vérifiez chaque journée avant la soumission. Une feuille approuvée est verrouillée et horodatée côté serveur.</Card>
      </>}

      {reasonAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) closeReasonDialog() }}>
          <section role="dialog" aria-modal="true" aria-labelledby="timesheet-reason-title" className="my-auto w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
            <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${reasonAction.type === "unlock" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                  {reasonAction.type === "unlock" ? <History size={19} /> : <RotateCcw size={19} />}
                </span>
                <div>
                  <h2 id="timesheet-reason-title" className="text-lg font-bold text-slate-900">
                    {reasonAction.type === "unlock" ? "Déverrouiller la feuille" : "Renvoyer pour correction"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {reasonAction.sheet.employeeName || reasonAction.sheet.employeeCode} · semaine du {weekBounds(reasonAction.sheet.weekStart)}
                  </p>
                </div>
              </div>
              <button type="button" onClick={closeReasonDialog} disabled={saving} aria-label="Fermer la fenêtre" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50">
                <X size={18} />
              </button>
            </header>

            <form onSubmit={(event) => void submitReasonAction(event)}>
              <div className="space-y-3 px-5 py-5 sm:px-6">
                <p className="text-sm text-slate-600">
                  {reasonAction.type === "unlock"
                    ? "Indiquez pourquoi cette feuille approuvée doit être rouverte. Le motif sera conservé dans l’historique d’audit."
                    : "Indiquez les corrections attendues. Le motif sera enregistré et transmis avec le retour au salarié."}
                </p>
                <label htmlFor="timesheet-reason" className="block text-sm font-semibold text-slate-700">Motif obligatoire</label>
                <textarea
                  id="timesheet-reason"
                  autoFocus
                  required
                  minLength={3}
                  maxLength={1000}
                  rows={4}
                  value={reason}
                  onChange={(event) => { setReason(event.target.value); setReasonError("") }}
                  placeholder={reasonAction.type === "unlock" ? "Ex. Correction d’une erreur de saisie après vérification…" : "Ex. Préciser les heures manquantes du mercredi…"}
                  aria-invalid={Boolean(reasonError)}
                  aria-describedby={reasonError ? "timesheet-reason-error" : "timesheet-reason-help"}
                  className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
                />
                {reasonError
                  ? <p id="timesheet-reason-error" role="alert" className="text-sm text-rose-600">{reasonError}</p>
                  : <p id="timesheet-reason-help" className="text-xs text-slate-500">Minimum 3 caractères · maximum 1 000 caractères</p>}
              </div>
              <footer className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                <button type="button" onClick={closeReasonDialog} disabled={saving} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Annuler</button>
                <button type="submit" disabled={saving || reason.trim().length < 3} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${reasonAction.type === "unlock" ? "bg-amber-600 hover:bg-amber-700" : "bg-primary-600 hover:bg-primary-700"}`}>
                  {saving ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Traitement…</> : reasonAction.type === "unlock" ? <><History size={16} /> Confirmer le déverrouillage</> : <><RotateCcw size={16} /> Renvoyer la feuille</>}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}


// import { useCallback, useEffect, useMemo, useState } from "react"
// import { useAuth } from "../../hooks/useAuth"
// import Card from "../../components/Card"
// import { approveTimesheet, listAdminTimesheets, listMyTimesheets, prefillMyTimesheet, returnTimesheet, saveMyTimesheet, submitMyTimesheet, unlockTimesheet, type Timesheet, type TimesheetEntry } from "../../services/timesheets"
// import { errorMessage } from "../../services/api"
// import { CheckCircle2, Clock3, Send, Save, RotateCcw } from "lucide-react"
// const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
// function localDate(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}` }
// function monday(d: Date) { const x=new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate()-((x.getDay()+6)%7)); return x }
// function weekBounds(iso: string) { const d=new Date(`${iso}T12:00:00`); const end=new Date(d); end.setDate(end.getDate()+6); return `${d.toLocaleDateString("fr-FR")} – ${end.toLocaleDateString("fr-FR")}` }
// const emptyEntries = (): TimesheetEntry[] => days.map(()=>({hours:0,note:""}))
// export default function Timesheet() {
//   const { appUser }=useAuth(); const manager=appUser?.role==="admin"
//   const [week,setWeek]=useState(()=>localDate(monday(new Date())))
//   const [sheets,setSheets]=useState<Timesheet[]>([]); const [entries,setEntries]=useState<TimesheetEntry[]>(emptyEntries)
//   const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [error,setError]=useState(""); const [message,setMessage]=useState("")
//   const refresh=useCallback(async()=>{setLoading(true);setError("");try{if(manager) setSheets(await listAdminTimesheets("ALL")); else setSheets(await listMyTimesheets())}catch(e){setError(errorMessage(e,"Impossible de charger les feuilles de temps."))}finally{setLoading(false)}},[manager])
//   useEffect(()=>{void refresh()},[refresh])
//   const mine=sheets.find(x=>x.weekStart===week)
//   useEffect(()=>{setEntries(mine?.entries?.length===7?mine.entries:emptyEntries())},[mine?.id,mine?.status,week])
//   const total=useMemo(()=>entries.reduce((s,e)=>s+(Number(e.hours)||0),0),[entries])
//   const canEdit=!mine||mine.status==="DRAFT"||mine.status==="RETURNED"||mine.status==="TO_SUBMIT"
//   function change(i:number,key:keyof TimesheetEntry,value:string|number){setEntries(prev=>prev.map((x,n)=>n===i?{...x,[key]:value}:x))}
//   async function prefill(){setSaving(true);setError("");setMessage("");try{const result=await prefillMyTimesheet(week);if(Array.isArray(result.entries)&&result.entries.length===7){setEntries(result.entries);const sourceCount=result.sources.reduce((n,day)=>n+day.attendanceIds.length,0);setMessage(sourceCount?`Préremplissage chargé depuis ${sourceCount} pointage(s). Vérifiez et modifiez les heures avant de soumettre.`:"Aucun pointage trouvé; les sept jours sont prêts à être complétés.")}else{setError("Le serveur n’a pas renvoyé les sept jours de la semaine.")}}catch(e){setError(errorMessage(e,"Préremplissage indisponible."))}finally{setSaving(false)}}
//   async function save(submit:boolean){setSaving(true);setError("");setMessage("");try{await saveMyTimesheet(week,entries);if(submit)await submitMyTimesheet(week);setMessage(submit?"Feuille soumise au responsable.":"Brouillon enregistré sur le serveur.");await refresh()}catch(e){setError(errorMessage(e,"Enregistrement impossible."))}finally{setSaving(false)}}
//   async function approve(sheet:Timesheet){setSaving(true);setError("");try{await approveTimesheet(sheet.id);setMessage(`Semaine ${weekBounds(sheet.weekStart)} approuvée.`);await refresh()}catch(e){setError(errorMessage(e,"Validation impossible."))}finally{setSaving(false)}}
//   async function unlock(sheet:Timesheet){const reason=window.prompt("Motif obligatoire du déverrouillage (historisé) :");if(!reason?.trim())return;setSaving(true);setError("");try{await unlockTimesheet(sheet.id,reason);setMessage("Feuille déverrouillée pour correction. Motif enregistré.");await refresh()}catch(e){setError(errorMessage(e,"Déverrouillage impossible."))}finally{setSaving(false)}}
//   async function sendBack(sheet:Timesheet){const reason=window.prompt("Motif obligatoire du retour pour correction :");if(!reason?.trim())return;setSaving(true);setError("");try{await returnTimesheet(sheet.id,reason.trim());setMessage("Feuille renvoyée au salarié pour correction.");await refresh()}catch(e){setError(errorMessage(e,"Impossible de renvoyer la feuille."))}finally{setSaving(false)}}
//   const labelStatus=(status:string)=>({DRAFT:"Brouillon",SUBMITTED:"À valider",TO_SUBMIT:"À soumettre",RETURNED:"À corriger",APPROVED:"Approuvée",LOCKED:"Verrouillée"}[status]||status)
//   return <div className="space-y-4"><header><h1 className="text-xl font-bold">Timesheet hebdomadaire</h1><p className="text-sm text-slate-500">Saisie serveur, soumission salarié et validation du responsable</p></header>
//     {error&&<div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}{message&&<div role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}
//     {loading?<Card className="p-5 text-sm text-slate-500">Chargement des feuilles…</Card>:manager?<>
//       <Card className="p-4"><h2 className="font-semibold mb-3">En attente de validation ({sheets.filter(s=>s.status==="SUBMITTED").length})</h2>{sheets.filter(s=>s.status==="SUBMITTED").length===0?<p className="text-sm text-slate-500">Aucune feuille soumise en attente.</p>:<div className="space-y-3">{sheets.filter(s=>s.status==="SUBMITTED").map(s=><section key={s.id} className="rounded-xl border p-3"><div className="flex justify-between gap-3"><div><b>{s.employeeName||s.employeeCode}</b><div className="text-xs text-slate-500">{s.employeeCode} · {weekBounds(s.weekStart)}</div></div><b>{s.totalHours} h</b></div><div className="mt-2 grid grid-cols-2 gap-x-3 text-xs text-slate-600 sm:grid-cols-4">{s.entries.map((e,i)=><span key={i}>{days[i]} : {e.hours} h{e.note?` · ${e.note}`:""}</span>)}</div><div className="mt-3 flex gap-2"><button disabled={saving} onClick={()=>void approve(s)} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><CheckCircle2 size={16}/> Approuver</button><button disabled={saving} onClick={()=>void sendBack(s)} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm disabled:opacity-50"><RotateCcw size={16}/> Renvoyer</button></div></section>)}</div>}</Card>
//       <Card className="p-4"><h2 className="font-semibold mb-2">Historique approuvé</h2>{sheets.filter(s=>s.status==="APPROVED").slice(0,15).map(s=><div key={s.id} className="flex justify-between border-t py-2 text-sm"><span>{s.employeeName||s.employeeCode} · {weekBounds(s.weekStart)}</span><span className="flex items-center gap-2 text-emerald-700">Approuvée · {s.totalHours} h <button type="button" disabled={saving} onClick={()=>void unlock(s)} className="rounded border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50">Déverrouiller avec motif</button></span></div>)}</Card>
//     </>:<>
//       <Card className="space-y-3 p-4"><div className="flex items-center justify-between gap-3"><button aria-label="Semaine précédente" className="rounded-lg border px-3 py-2" onClick={()=>{const d=new Date(`${week}T12:00:00`);d.setDate(d.getDate()-7);setWeek(localDate(d))}}>←</button><div className="text-center"><div className="font-semibold">Semaine du {weekBounds(week)}</div><div className="text-xs text-slate-500">{mine?labelStatus(mine.status):"Non commencée"}{mine?.managerNote?` — ${mine.managerNote}`:""}</div></div><button aria-label="Semaine suivante" className="rounded-lg border px-3 py-2" onClick={()=>{const d=new Date(`${week}T12:00:00`);d.setDate(d.getDate()+7);setWeek(localDate(d))}}>→</button></div>
//       <div className="flex flex-wrap gap-2"><button type="button" disabled={!canEdit||saving} onClick={()=>void prefill()} className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50">Préremplir depuis les pointages</button><span className="self-center text-xs text-slate-500">Les heures suggérées restent modifiables avant enregistrement.</span></div>{days.map((day,i)=><div key={day} className="grid grid-cols-[4.2rem_5.2rem_1fr] items-center gap-2 border-t pt-2"><label className="text-sm">{day}</label><input aria-label={`Heures ${day}`} disabled={!canEdit||saving} type="number" min="0" max="24" step="0.25" value={entries[i]?.hours||""} onChange={e=>change(i,"hours",Number(e.target.value)||0)} placeholder="0 h" className="w-full rounded-lg border px-2 py-2 text-sm disabled:bg-slate-100"/><input aria-label={`Tâche ${day}`} disabled={!canEdit||saving} value={entries[i]?.note||""} onChange={e=>change(i,"note",e.target.value)} placeholder="Activité / commentaire" className="min-w-0 rounded-lg border px-2 py-2 text-sm disabled:bg-slate-100"/></div>)}
//       <div className="flex justify-between border-t pt-3 font-semibold"><span>Total saisi</span><span>{total.toLocaleString("fr-FR")} h</span></div>
//       {canEdit?<div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><button disabled={saving} onClick={()=>void save(false)} className="flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-semibold disabled:opacity-50"><Save size={17}/> Enregistrer le brouillon</button><button disabled={saving||total<=0} onClick={()=>void save(true)} className="flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 font-semibold text-white disabled:opacity-50"><Send size={17}/> {saving?"Envoi…":"Soumettre au responsable"}</button></div>:<div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Cette feuille est verrouillée après soumission. Si elle est renvoyée, vous pourrez la corriger puis la resoumettre.</div>}
//     </Card><Card className="p-4 text-sm text-slate-600">Les heures préremplies depuis les pointages ne sont que des suggestions. Vérifiez chaque journée avant la soumission. Une feuille approuvée est verrouillée et horodatée côté serveur.</Card>
//     </>}
//   </div>
// }

// // import { useCallback, useEffect, useMemo, useState } from "react"
// // import { useAuth } from "../../hooks/useAuth"
// // import Card from "../../components/Card"
// // import { approveTimesheet, listAdminTimesheets, listMyTimesheets, returnTimesheet, saveMyTimesheet, submitMyTimesheet, type Timesheet, type TimesheetEntry } from "../../services/timesheets"
// // import { errorMessage } from "../../services/api"
// // import { getMyEmployee } from "../../services/employees"
// // import { CheckCircle2, Clock3, Send, Save, RotateCcw } from "lucide-react"
// // const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
// // function localDate(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}` }
// // function monday(d: Date) { const x=new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate()-((x.getDay()+6)%7)); return x }
// // function weekBounds(iso: string) { const d=new Date(`${iso}T12:00:00`); const end=new Date(d); end.setDate(end.getDate()+6); return `${d.toLocaleDateString("fr-FR")} – ${end.toLocaleDateString("fr-FR")}` }
// // const emptyEntries = (): TimesheetEntry[] => days.map(()=>({hours:0,note:""}))
// // export default function Timesheet() {
// //   const { appUser }=useAuth(); const manager=appUser?.role==="admin"
// //   const [week,setWeek]=useState(()=>localDate(monday(new Date())))
// //   const [sheets,setSheets]=useState<Timesheet[]>([]); const [entries,setEntries]=useState<TimesheetEntry[]>(emptyEntries)
// //   const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [error,setError]=useState(""); const [message,setMessage]=useState("")
// //   const refresh=useCallback(async()=>{setLoading(true);setError("");try{if(manager) setSheets(await listAdminTimesheets("ALL")); else { const emp=await getMyEmployee(); if(emp.contractType!=="CDI"){setSheets([]);setError("Cette feuille est réservée aux salariés CDI. Votre contrat utilise le pointage direct.");return} setSheets(await listMyTimesheets()) }}catch(e){setError(errorMessage(e,"Impossible de charger les feuilles de temps."))}finally{setLoading(false)}},[manager])
// //   useEffect(()=>{void refresh()},[refresh])
// //   const mine=sheets.find(x=>x.weekStart===week)
// //   useEffect(()=>{setEntries(mine?.entries?.length===7?mine.entries:emptyEntries())},[mine?.id,mine?.status,week])
// //   const total=useMemo(()=>entries.reduce((s,e)=>s+(Number(e.hours)||0),0),[entries])
// //   const canEdit=!mine||mine.status==="DRAFT"||mine.status==="RETURNED"
// //   function change(i:number,key:keyof TimesheetEntry,value:string|number){setEntries(prev=>prev.map((x,n)=>n===i?{...x,[key]:value}:x))}
// //   async function save(submit:boolean){setSaving(true);setError("");setMessage("");try{await saveMyTimesheet(week,entries);if(submit)await submitMyTimesheet(week);setMessage(submit?"Feuille soumise au responsable.":"Brouillon enregistré sur le serveur.");await refresh()}catch(e){setError(errorMessage(e,"Enregistrement impossible."))}finally{setSaving(false)}}
// //   async function approve(sheet:Timesheet){setSaving(true);setError("");try{await approveTimesheet(sheet.id);setMessage(`Semaine ${weekBounds(sheet.weekStart)} approuvée.`);await refresh()}catch(e){setError(errorMessage(e,"Validation impossible."))}finally{setSaving(false)}}
// //   async function sendBack(sheet:Timesheet){const reason=window.prompt("Motif obligatoire du retour pour correction :");if(!reason?.trim())return;setSaving(true);setError("");try{await returnTimesheet(sheet.id,reason.trim());setMessage("Feuille renvoyée au salarié pour correction.");await refresh()}catch(e){setError(errorMessage(e,"Impossible de renvoyer la feuille."))}finally{setSaving(false)}}
// //   const labelStatus=(status:string)=>({DRAFT:"Brouillon",SUBMITTED:"À valider",RETURNED:"À corriger",APPROVED:"Approuvée"}[status]||status)
// //   return <div className="space-y-4"><header><h1 className="text-xl font-bold">Timesheet hebdomadaire CDI</h1><p className="text-sm text-slate-500">Saisie serveur, soumission salarié et validation du responsable</p></header>
// //     {error&&<div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}{message&&<div role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>}
// //     {loading?<Card className="p-5 text-sm text-slate-500">Chargement des feuilles…</Card>:manager?<>
// //       <Card className="p-4"><h2 className="font-semibold mb-3">En attente de validation ({sheets.filter(s=>s.status==="SUBMITTED").length})</h2>{sheets.filter(s=>s.status==="SUBMITTED").length===0?<p className="text-sm text-slate-500">Aucune feuille soumise en attente.</p>:<div className="space-y-3">{sheets.filter(s=>s.status==="SUBMITTED").map(s=><section key={s.id} className="rounded-xl border p-3"><div className="flex justify-between gap-3"><div><b>{s.employeeName||s.employeeCode}</b><div className="text-xs text-slate-500">{s.employeeCode} · {weekBounds(s.weekStart)}</div></div><b>{s.totalHours} h</b></div><div className="mt-2 grid grid-cols-2 gap-x-3 text-xs text-slate-600 sm:grid-cols-4">{s.entries.map((e,i)=><span key={i}>{days[i]} : {e.hours} h{e.note?` · ${e.note}`:""}</span>)}</div><div className="mt-3 flex gap-2"><button disabled={saving} onClick={()=>void approve(s)} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><CheckCircle2 size={16}/> Approuver</button><button disabled={saving} onClick={()=>void sendBack(s)} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm disabled:opacity-50"><RotateCcw size={16}/> Renvoyer</button></div></section>)}</div>}</Card>
// //       <Card className="p-4"><h2 className="font-semibold mb-2">Historique approuvé</h2>{sheets.filter(s=>s.status==="APPROVED").slice(0,15).map(s=><div key={s.id} className="flex justify-between border-t py-2 text-sm"><span>{s.employeeName||s.employeeCode} · {weekBounds(s.weekStart)}</span><span className="text-emerald-700">Approuvée · {s.totalHours} h</span></div>)}</Card>
// //     </>:<>
// //       <Card className="space-y-3 p-4"><div className="flex items-center justify-between gap-3"><button aria-label="Semaine précédente" className="rounded-lg border px-3 py-2" onClick={()=>{const d=new Date(`${week}T12:00:00`);d.setDate(d.getDate()-7);setWeek(localDate(d))}}>←</button><div className="text-center"><div className="font-semibold">Semaine du {weekBounds(week)}</div><div className="text-xs text-slate-500">{mine?labelStatus(mine.status):"Non commencée"}{mine?.managerNote?` — ${mine.managerNote}`:""}</div></div><button aria-label="Semaine suivante" className="rounded-lg border px-3 py-2" onClick={()=>{const d=new Date(`${week}T12:00:00`);d.setDate(d.getDate()+7);setWeek(localDate(d))}}>→</button></div>
// //       {days.map((day,i)=><div key={day} className="grid grid-cols-[4.2rem_5.2rem_1fr] items-center gap-2 border-t pt-2"><label className="text-sm">{day}</label><input aria-label={`Heures ${day}`} disabled={!canEdit||saving} type="number" min="0" max="24" step="0.25" value={entries[i]?.hours||""} onChange={e=>change(i,"hours",Number(e.target.value)||0)} placeholder="0 h" className="w-full rounded-lg border px-2 py-2 text-sm disabled:bg-slate-100"/><input aria-label={`Tâche ${day}`} disabled={!canEdit||saving} value={entries[i]?.note||""} onChange={e=>change(i,"note",e.target.value)} placeholder="Activité / commentaire" className="min-w-0 rounded-lg border px-2 py-2 text-sm disabled:bg-slate-100"/></div>)}
// //       <div className="flex justify-between border-t pt-3 font-semibold"><span>Total saisi</span><span>{total.toLocaleString("fr-FR")} h</span></div>
// //       {canEdit?<div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><button disabled={saving} onClick={()=>void save(false)} className="flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-semibold disabled:opacity-50"><Save size={17}/> Enregistrer le brouillon</button><button disabled={saving||total<=0} onClick={()=>void save(true)} className="flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 font-semibold text-white disabled:opacity-50"><Send size={17}/> {saving?"Envoi…":"Soumettre au responsable"}</button></div>:<div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Cette feuille est verrouillée après soumission. Si elle est renvoyée, vous pourrez la corriger puis la resoumettre.</div>}
// //     </Card><Card className="p-4 text-sm text-slate-600">Les salariés CDI déclarent leurs heures ici et ne peuvent pas pointer en Entrée/Sortie. Les salariés journaliers gardent le pointage direct et n’ont pas accès à cette fonction. Une feuille approuvée est verrouillée et horodatée côté serveur.</Card>
// //     </>}
// //   </div>
// // }
