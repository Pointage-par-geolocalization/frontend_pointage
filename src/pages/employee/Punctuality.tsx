import { useEffect, useState } from "react"
import { listMyAttendance, type Attendance } from "../../services/attendance"
import { getSettings } from "../../services/settings"
import Card from "../../components/Card"
import { Clock3, TrendingUp } from "lucide-react"

function monday(date: Date) { const d=new Date(date); d.setHours(0,0,0,0); d.setDate(d.getDate()-((d.getDay()+6)%7)); return d }
function weekId(date: Date) { const m=monday(date); return `${m.getFullYear()}-${String(m.getMonth()+1).padStart(2,"0")}-${String(m.getDate()).padStart(2,"0")}` }
export default function Punctuality() {
  const [rows,setRows]=useState<Attendance[]>([]); const [entryTime,setEntryTime]=useState("08:00"); const [tolerance,setTolerance]=useState(10); const [error,setError]=useState("")
  useEffect(()=>{Promise.all([listMyAttendance(500),getSettings()]).then(([a,s])=>{setRows(a);setEntryTime(s.normalEntryTime||"08:00");setTolerance(s.toleranceMinutes||0)}).catch(()=>setError("Impossible de charger les données de ponctualité."))},[])
  const result=Array.from({length:8},(_,idx)=>{const date=new Date();date.setDate(date.getDate()-7*(7-idx));const id=weekId(date);const punches=rows.filter(r=>weekId(new Date(r.entryTime))===id);const [h,m]=entryTime.split(":").map(Number);const late=punches.filter(r=>{const d=new Date(r.entryTime);return d.getHours()*60+d.getMinutes()>h*60+m+tolerance}).length;return {id,count:punches.length,late,rate:punches.length?Math.round(late/punches.length*1000)/10:0,label:`S${idx+1}`}})
  return <div className="space-y-4"><header><h1 className="text-xl font-bold">Ma ponctualité</h1><p className="text-sm text-slate-500">Taux de retards basé sur vos pointages d’entrée · seuil visé inférieur à 5%</p></header>
    {error&&<p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <Card className="p-4"><div className="flex items-center gap-2 font-semibold"><TrendingUp size={18}/> Retards sur les 8 dernières semaines</div><div className="mt-6 grid grid-cols-4 gap-3 sm:grid-cols-8">{result.map(w=><div key={w.id} className="flex flex-col items-center gap-2"><div className="relative flex h-36 w-full items-end justify-center rounded-lg bg-slate-50"><div title={`${w.rate}%`} className={`w-2/3 rounded-t-md ${w.rate<5?"bg-emerald-500":"bg-rose-500"}`} style={{height:`${Math.max(w.count?5:0,Math.min(100,w.rate*5))}%`}}/><span className="absolute top-1 text-[11px] font-semibold">{w.count?`${w.rate}%`:"—"}</span></div><span className="text-[10px] text-slate-500">{w.label}</span><span className="text-[10px] text-slate-400">{w.late}/{w.count}</span></div>)}</div><div className="mt-4 flex items-center justify-between border-t pt-3 text-sm"><span className="flex items-center gap-2 text-slate-600"><Clock3 size={16}/> Heure attendue {entryTime} + tolérance {tolerance} min</span><span className="font-medium text-emerald-700">Objectif &lt; 5%</span></div></Card>
    <Card className="p-4"><p className="text-sm text-slate-600">Un retard correspond à une entrée après l’heure normale de début, plus la tolérance définie par l’entreprise. Les semaines sans pointage apparaissent avec « — » plutôt qu’un taux de 0%.</p></Card>
  </div>
}
