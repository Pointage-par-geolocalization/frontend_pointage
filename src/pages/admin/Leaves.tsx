// src/pages/admin/Leaves.tsx
// Demandes de permission : consultation, filtres, acceptation ou refus (le salarié est informé).
import { useEffect, useState } from "react"
import {
  subscribeLeaves, approveLeave, refuseLeave, LEAVE_TYPES, LEAVE_STATUS, durationLabel,
  type LeaveRequest, type LeaveStatus, type LeaveQuery,
} from "../../services/leaves"
import { listEmployees, employeeName, type Employee } from "../../services/employees"
import { listSites, type Site } from "../../services/sites"
import { errorMessage } from "../../services/api"
import { fmtDay, fmtDateTime } from "../../utils/format"
import Card from "../../components/Card"
import Badge from "../../components/Badge"
import EmptyState from "../../components/EmptyState"
import Dropdown from "../../components/Dropdown"
import Toast from "../../components/Toast"
import { CalendarClock, Check, Ban, X, User, HardHat, Filter, MessageSquare } from "lucide-react"

type Decision = { leave: LeaveRequest; kind: "approve" | "refuse" } | null

const inputCls = "w-full min-w-0 h-[46px] border border-slate-300 rounded-xl px-3.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none transition"
const filterLabelCls = "block h-4 text-[11px] font-medium text-slate-500 mb-1"

export default function AdminLeaves() {
  const [status, setStatus] = useState<LeaveStatus | "">("EN_ATTENTE")
  const [employeeCode, setEmployeeCode] = useState("")
  const [leaveType, setLeaveType] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [loaded, setLoaded] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [decision, setDecision] = useState<Decision>(null)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null)

  useEffect(() => {
    listEmployees().then(setEmployees).catch(() => {})
    listSites().then(setSites).catch(() => {})
  }, [])

  useEffect(() => {
    setLoaded(false)
    const q: LeaveQuery = {
      status: status || undefined, employeeCode: employeeCode || undefined, type: (leaveType || undefined) as any,
      from: from || undefined, to: to || undefined,
    }
    return subscribeLeaves(q, (list) => { setLeaves(list); setLoaded(true) },
      () => { setLoaded(true); setToast({ msg: "Impossible de charger les demandes.", tone: "error" }) })
  }, [status, employeeCode, leaveType, from, to])

  function openDecision(leave: LeaveRequest, kind: "approve" | "refuse") {
    setNote("")
    setDecision({ leave, kind })
  }

  async function submitDecision() {
    if (!decision) return
    const { leave, kind } = decision
    setBusy(true)
    try {
      if (kind === "approve") await approveLeave(leave.id, note)
      else await refuseLeave(leave.id, note)
      setDecision(null)
      setToast({
        msg: `Demande de ${leave.employeeName} ${kind === "approve" ? "acceptée" : "refusée"}. Le salarié est informé de la décision.`,
        tone: "success",
      })
    } catch (e) {
      setToast({ msg: errorMessage(e, "Action impossible."), tone: "error" })
    } finally { setBusy(false) }
  }

  const hasFilters = !!(employeeCode || leaveType || from || to)

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center border border-primary-100"><CalendarClock className="w-5 h-5" /></div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Demandes de permission</h1>
            <p className="text-sm text-slate-500 mt-0.5">Consultez, acceptez ou refusez les demandes des salariés.</p>
          </div>
        </div>
      </div>

      {/* Filtre statut */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mb-1" role="tablist" aria-label="Filtrer les demandes par statut">
        {([["EN_ATTENTE", "En attente"], ["ACCEPTEE", "Acceptées"], ["REFUSEE", "Refusées"], ["ANNULEE", "Annulées"], ["", "Toutes"]] as [LeaveStatus | "", string][]).map(([s, label]) => (
          <button key={s || "all"} onClick={() => setStatus(s)}
            role="tab" aria-selected={status === s}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
              status === s ? "bg-primary-600 text-white shadow-md shadow-primary-600/20" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Autres filtres */}
      <Card className="rounded-2xl">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3"><Filter className="w-3.5 h-3.5" />Filtres</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0">
            <label className={filterLabelCls}>Salarié</label>
            <Dropdown value={employeeCode} onChange={setEmployeeCode} placeholder="Tous les salariés" icon={<User className="w-4 h-4" />}
              options={[{ value: "", label: "Tous les salariés" }, ...employees.map((e) => ({ value: e.employeeCode, label: `${employeeName(e)} (${e.employeeCode})` }))]} />
          </div>
          <div className="min-w-0"><label className={filterLabelCls}>Type</label><select value={leaveType} onChange={e => setLeaveType(e.target.value)} className={inputCls}><option value="">Tous les types</option>{Object.entries(LEAVE_TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
          <div className="min-w-0">
            <label className={filterLabelCls} htmlFor="leave-date-from">Du</label>
            <input id="leave-date-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
          </div>
          <div className="min-w-0">
            <label className={filterLabelCls} htmlFor="leave-date-to">Au</label>
            <input id="leave-date-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
          </div>
        </div>
        {hasFilters && (
          <button onClick={() => { setEmployeeCode(""); setLeaveType(""); setFrom(""); setTo("") }}
            className="mt-3 text-xs font-medium text-primary-700 hover:underline">Effacer les filtres</button>
        )}
      </Card>

      {!loaded && <p className="text-sm text-slate-400 text-center py-4">Chargement...</p>}
      {loaded && leaves.length === 0 && (
        <Card><EmptyState message={status === "EN_ATTENTE" ? "Aucune demande en attente." : "Aucune demande pour ces critères."} /></Card>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {leaves.map((l) => {
          const st = LEAVE_STATUS[l.status]
          return (
            <Card key={l.id} className="space-y-3 rounded-2xl">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 truncate">{l.employeeName}</div>
                  <div className="text-xs text-slate-400 font-mono">{l.employeeCode}</div>
                </div>
                <Badge tone={st.tone}>{st.label}</Badge>
              </div>
              <dl className="text-xs text-slate-600 space-y-1.5 bg-slate-50 rounded-xl p-3">
                <div className="flex justify-between gap-2"><dt>Type</dt><dd className="font-semibold text-slate-800">{LEAVE_TYPES[l.type]}</dd></div>
                <div className="flex justify-between gap-2">
                  <dt>Période</dt>
                  <dd className="font-medium text-right">{l.startDate === l.endDate ? fmtDay(l.startDate) : `${fmtDay(l.startDate)} → ${fmtDay(l.endDate)}`}</dd>
                </div>
                <div className="flex justify-between gap-2"><dt>Durée</dt><dd className="font-medium">{durationLabel(l)}</dd></div>
                {l.siteName && <div className="flex justify-between gap-2"><dt>Chantier</dt><dd className="font-medium text-right">{l.siteName}</dd></div>}
                <div className="flex justify-between gap-2"><dt>Demandée le</dt><dd className="font-medium">{fmtDateTime(l.createdAt)}</dd></div>
                <div className="pt-1.5 border-t border-slate-200 text-slate-700 whitespace-pre-line">« {l.reason} »</div>
              </dl>
              {l.status !== "EN_ATTENTE" && l.decidedAt && (
                <div className="text-xs text-slate-500 space-y-1">
                  <div>Décision le {fmtDateTime(l.decidedAt)}{l.decidedByName ? ` par ${l.decidedByName}` : ""}</div>
                  {l.decisionNote && <div className="flex items-start gap-1.5 text-slate-600"><MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span className="whitespace-pre-line">{l.decisionNote}</span></div>}
                </div>
              )}
              {l.status === "EN_ATTENTE" && (
                <div className="flex gap-2">
                  <button onClick={() => openDecision(l, "refuse")}
                    className="flex-1 border border-rose-200 text-rose-600 hover:bg-rose-50 text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2">
                    <Ban className="w-4 h-4" />Refuser
                  </button>
                  <button onClick={() => openDecision(l, "approve")}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2">
                    <Check className="w-4 h-4" />Accepter
                  </button>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {decision && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-lg text-slate-900">{decision.kind === "approve" ? "Accepter la demande" : "Refuser la demande"}</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {decision.leave.employeeName} — {LEAVE_TYPES[decision.leave.type]}, {durationLabel(decision.leave)} à partir du {fmtDay(decision.leave.startDate)}
                </p>
              </div>
              <button onClick={() => setDecision(null)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center shrink-0"><X className="w-4 h-4" /></button>
            </div>
            <textarea autoFocus rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500}
              placeholder={decision.kind === "approve" ? "Message pour le salarié (facultatif)" : "Motif du refus (facultatif, visible par le salarié)"}
              className={inputCls} />
            <div className="flex gap-3">
              <button onClick={() => setDecision(null)} className="flex-1 border border-slate-200 text-slate-700 font-medium py-3 rounded-xl hover:bg-slate-50">Annuler</button>
              <button onClick={submitDecision} disabled={busy}
                className={`flex-1 text-white font-semibold py-3 rounded-xl disabled:opacity-60 ${decision.kind === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}`}>
                {busy ? "..." : decision.kind === "approve" ? "Accepter" : "Refuser"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.msg} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  )
}


// // src/pages/admin/Leaves.tsx
// // Demandes de permission : consultation, filtres, acceptation ou refus (le salarié est informé).
// import { useEffect, useState } from "react"
// import {
//   subscribeLeaves, approveLeave, refuseLeave, LEAVE_TYPES, LEAVE_STATUS, durationLabel,
//   type LeaveRequest, type LeaveStatus, type LeaveQuery,
// } from "../../services/leaves"
// import { listEmployees, employeeName, type Employee } from "../../services/employees"
// import { listSites, type Site } from "../../services/sites"
// import { errorMessage } from "../../services/api"
// import { fmtDay, fmtDateTime } from "../../utils/format"
// import Card from "../../components/Card"
// import Badge from "../../components/Badge"
// import EmptyState from "../../components/EmptyState"
// import Dropdown from "../../components/Dropdown"
// import Toast from "../../components/Toast"
// import { CalendarClock, Check, Ban, X, User, HardHat, Filter, MessageSquare } from "lucide-react"

// type Decision = { leave: LeaveRequest; kind: "approve" | "refuse" } | null

// const inputCls = "w-full min-w-0 h-[46px] border border-slate-300 rounded-xl px-3.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none transition"
// const filterLabelCls = "block h-4 text-[11px] font-medium text-slate-500 mb-1"

// export default function AdminLeaves() {
//   const [status, setStatus] = useState<LeaveStatus | "">("EN_ATTENTE")
//   const [employeeCode, setEmployeeCode] = useState("")
//   const [siteId, setSiteId] = useState("")
//   const [from, setFrom] = useState("")
//   const [to, setTo] = useState("")

//   const [leaves, setLeaves] = useState<LeaveRequest[]>([])
//   const [loaded, setLoaded] = useState(false)
//   const [employees, setEmployees] = useState<Employee[]>([])
//   const [sites, setSites] = useState<Site[]>([])
//   const [decision, setDecision] = useState<Decision>(null)
//   const [note, setNote] = useState("")
//   const [busy, setBusy] = useState(false)
//   const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null)

//   useEffect(() => {
//     listEmployees().then(setEmployees).catch(() => {})
//     listSites().then(setSites).catch(() => {})
//   }, [])

//   useEffect(() => {
//     setLoaded(false)
//     const q: LeaveQuery = {
//       status: status || undefined, employeeCode: employeeCode || undefined, siteId: siteId || undefined,
//       from: from || undefined, to: to || undefined,
//     }
//     return subscribeLeaves(q, (list) => { setLeaves(list); setLoaded(true) },
//       () => { setLoaded(true); setToast({ msg: "Impossible de charger les demandes.", tone: "error" }) })
//   }, [status, employeeCode, siteId, from, to])

//   function openDecision(leave: LeaveRequest, kind: "approve" | "refuse") {
//     setNote("")
//     setDecision({ leave, kind })
//   }

//   async function submitDecision() {
//     if (!decision) return
//     const { leave, kind } = decision
//     setBusy(true)
//     try {
//       if (kind === "approve") await approveLeave(leave.id, note)
//       else await refuseLeave(leave.id, note)
//       setDecision(null)
//       setToast({
//         msg: `Demande de ${leave.employeeName} ${kind === "approve" ? "acceptée" : "refusée"}. Le salarié est informé de la décision.`,
//         tone: "success",
//       })
//     } catch (e) {
//       setToast({ msg: errorMessage(e, "Action impossible."), tone: "error" })
//     } finally { setBusy(false) }
//   }

//   const hasFilters = !!(employeeCode || siteId || from || to)

//   return (
//     <div className="space-y-5">
//       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
//         <div className="flex items-center gap-3">
//           <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center border border-primary-100"><CalendarClock className="w-5 h-5" /></div>
//           <div>
//             <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Demandes de permission</h1>
//             <p className="text-sm text-slate-500 mt-0.5">Consultez, acceptez ou refusez les demandes des salariés.</p>
//           </div>
//         </div>
//       </div>

//       {/* Filtre statut */}
//       <div className="flex gap-2 overflow-x-auto pb-1 -mb-1" role="tablist" aria-label="Filtrer les demandes par statut">
//         {([["EN_ATTENTE", "En attente"], ["ACCEPTEE", "Acceptées"], ["REFUSEE", "Refusées"], ["ANNULEE", "Annulées"], ["", "Toutes"]] as [LeaveStatus | "", string][]).map(([s, label]) => (
//           <button key={s || "all"} onClick={() => setStatus(s)}
//             role="tab" aria-selected={status === s}
//             className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
//               status === s ? "bg-primary-600 text-white shadow-md shadow-primary-600/20" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
//             {label}
//           </button>
//         ))}
//       </div>

//       {/* Autres filtres */}
//       <Card className="rounded-2xl">
//         <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3"><Filter className="w-3.5 h-3.5" />Filtres</div>
//         <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
//           <div className="min-w-0">
//             <label className={filterLabelCls}>Salarié</label>
//             <Dropdown value={employeeCode} onChange={setEmployeeCode} placeholder="Tous les salariés" icon={<User className="w-4 h-4" />}
//               options={[{ value: "", label: "Tous les salariés" }, ...employees.map((e) => ({ value: e.employeeCode, label: `${employeeName(e)} (${e.employeeCode})` }))]} />
//           </div>
//           <div className="min-w-0">
//             <label className={filterLabelCls}>Chantier</label>
//             <Dropdown value={siteId} onChange={setSiteId} placeholder="Tous les chantiers" icon={<HardHat className="w-4 h-4" />}
//               options={[{ value: "", label: "Tous les chantiers" }, ...sites.map((s) => ({ value: s.id, label: s.name }))]} />
//           </div>
//           <div className="min-w-0">
//             <label className={filterLabelCls} htmlFor="leave-date-from">Du</label>
//             <input id="leave-date-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
//           </div>
//           <div className="min-w-0">
//             <label className={filterLabelCls} htmlFor="leave-date-to">Au</label>
//             <input id="leave-date-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
//           </div>
//         </div>
//         {hasFilters && (
//           <button onClick={() => { setEmployeeCode(""); setSiteId(""); setFrom(""); setTo("") }}
//             className="mt-3 text-xs font-medium text-primary-700 hover:underline">Effacer les filtres</button>
//         )}
//       </Card>

//       {!loaded && <p className="text-sm text-slate-400 text-center py-4">Chargement...</p>}
//       {loaded && leaves.length === 0 && (
//         <Card><EmptyState message={status === "EN_ATTENTE" ? "Aucune demande en attente." : "Aucune demande pour ces critères."} /></Card>
//       )}

//       <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
//         {leaves.map((l) => {
//           const st = LEAVE_STATUS[l.status]
//           return (
//             <Card key={l.id} className="space-y-3 rounded-2xl">
//               <div className="flex items-start justify-between gap-3">
//                 <div className="min-w-0">
//                   <div className="font-bold text-slate-900 truncate">{l.employeeName}</div>
//                   <div className="text-xs text-slate-400 font-mono">{l.employeeCode}</div>
//                 </div>
//                 <Badge tone={st.tone}>{st.label}</Badge>
//               </div>
//               <dl className="text-xs text-slate-600 space-y-1.5 bg-slate-50 rounded-xl p-3">
//                 <div className="flex justify-between gap-2"><dt>Type</dt><dd className="font-semibold text-slate-800">{LEAVE_TYPES[l.type]}</dd></div>
//                 <div className="flex justify-between gap-2">
//                   <dt>Période</dt>
//                   <dd className="font-medium text-right">{l.startDate === l.endDate ? fmtDay(l.startDate) : `${fmtDay(l.startDate)} → ${fmtDay(l.endDate)}`}</dd>
//                 </div>
//                 <div className="flex justify-between gap-2"><dt>Durée</dt><dd className="font-medium">{durationLabel(l)}</dd></div>
//                 {l.siteName && <div className="flex justify-between gap-2"><dt>Chantier</dt><dd className="font-medium text-right">{l.siteName}</dd></div>}
//                 <div className="flex justify-between gap-2"><dt>Demandée le</dt><dd className="font-medium">{fmtDateTime(l.createdAt)}</dd></div>
//                 <div className="pt-1.5 border-t border-slate-200 text-slate-700 whitespace-pre-line">« {l.reason} »</div>
//               </dl>
//               {l.status !== "EN_ATTENTE" && l.decidedAt && (
//                 <div className="text-xs text-slate-500 space-y-1">
//                   <div>Décision le {fmtDateTime(l.decidedAt)}{l.decidedByName ? ` par ${l.decidedByName}` : ""}</div>
//                   {l.decisionNote && <div className="flex items-start gap-1.5 text-slate-600"><MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span className="whitespace-pre-line">{l.decisionNote}</span></div>}
//                 </div>
//               )}
//               {l.status === "EN_ATTENTE" && (
//                 <div className="flex gap-2">
//                   <button onClick={() => openDecision(l, "refuse")}
//                     className="flex-1 border border-rose-200 text-rose-600 hover:bg-rose-50 text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2">
//                     <Ban className="w-4 h-4" />Refuser
//                   </button>
//                   <button onClick={() => openDecision(l, "approve")}
//                     className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2">
//                     <Check className="w-4 h-4" />Accepter
//                   </button>
//                 </div>
//               )}
//             </Card>
//           )
//         })}
//       </div>

//       {decision && (
//         <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
//           <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
//             <div className="flex items-start justify-between gap-3">
//               <div>
//                 <h2 className="font-bold text-lg text-slate-900">{decision.kind === "approve" ? "Accepter la demande" : "Refuser la demande"}</h2>
//                 <p className="text-sm text-slate-500 mt-1">
//                   {decision.leave.employeeName} — {LEAVE_TYPES[decision.leave.type]}, {durationLabel(decision.leave)} à partir du {fmtDay(decision.leave.startDate)}
//                 </p>
//               </div>
//               <button onClick={() => setDecision(null)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center shrink-0"><X className="w-4 h-4" /></button>
//             </div>
//             <textarea autoFocus rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500}
//               placeholder={decision.kind === "approve" ? "Message pour le salarié (facultatif)" : "Motif du refus (facultatif, visible par le salarié)"}
//               className={inputCls} />
//             <div className="flex gap-3">
//               <button onClick={() => setDecision(null)} className="flex-1 border border-slate-200 text-slate-700 font-medium py-3 rounded-xl hover:bg-slate-50">Annuler</button>
//               <button onClick={submitDecision} disabled={busy}
//                 className={`flex-1 text-white font-semibold py-3 rounded-xl disabled:opacity-60 ${decision.kind === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}`}>
//                 {busy ? "..." : decision.kind === "approve" ? "Accepter" : "Refuser"}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {toast && <Toast message={toast.msg} tone={toast.tone} onClose={() => setToast(null)} />}
//     </div>
//   )
// }


// // src/pages/admin/Leaves.tsx
// // Demandes de permission : consultation, filtres, acceptation ou refus (le salarié est informé).
// import { useEffect, useState } from "react"
// import {
//   subscribeLeaves, approveLeave, refuseLeave, LEAVE_TYPES, LEAVE_STATUS, durationLabel,
//   type LeaveRequest, type LeaveStatus, type LeaveQuery,
// } from "../../services/leaves"
// import { listEmployees, employeeName, type Employee } from "../../services/employees"
// import { listSites, type Site } from "../../services/sites"
// import { errorMessage } from "../../services/api"
// import { fmtDay, fmtDateTime } from "../../utils/format"
// import Card from "../../components/Card"
// import Badge from "../../components/Badge"
// import EmptyState from "../../components/EmptyState"
// import Dropdown from "../../components/Dropdown"
// import Toast from "../../components/Toast"
// import { CalendarClock, Check, Ban, X, User, HardHat, Filter, MessageSquare } from "lucide-react"

// type Decision = { leave: LeaveRequest; kind: "approve" | "refuse" } | null

// const inputCls = "w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none transition"

// export default function AdminLeaves() {
//   const [status, setStatus] = useState<LeaveStatus | "">("EN_ATTENTE")
//   const [employeeCode, setEmployeeCode] = useState("")
//   const [siteId, setSiteId] = useState("")
//   const [from, setFrom] = useState("")
//   const [to, setTo] = useState("")

//   const [leaves, setLeaves] = useState<LeaveRequest[]>([])
//   const [loaded, setLoaded] = useState(false)
//   const [employees, setEmployees] = useState<Employee[]>([])
//   const [sites, setSites] = useState<Site[]>([])
//   const [decision, setDecision] = useState<Decision>(null)
//   const [note, setNote] = useState("")
//   const [busy, setBusy] = useState(false)
//   const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null)

//   useEffect(() => {
//     listEmployees().then(setEmployees).catch(() => {})
//     listSites().then(setSites).catch(() => {})
//   }, [])

//   useEffect(() => {
//     setLoaded(false)
//     const q: LeaveQuery = {
//       status: status || undefined, employeeCode: employeeCode || undefined, siteId: siteId || undefined,
//       from: from || undefined, to: to || undefined,
//     }
//     return subscribeLeaves(q, (list) => { setLeaves(list); setLoaded(true) },
//       () => { setLoaded(true); setToast({ msg: "Impossible de charger les demandes.", tone: "error" }) })
//   }, [status, employeeCode, siteId, from, to])

//   function openDecision(leave: LeaveRequest, kind: "approve" | "refuse") {
//     setNote("")
//     setDecision({ leave, kind })
//   }

//   async function submitDecision() {
//     if (!decision) return
//     const { leave, kind } = decision
//     setBusy(true)
//     try {
//       if (kind === "approve") await approveLeave(leave.id, note)
//       else await refuseLeave(leave.id, note)
//       setDecision(null)
//       setToast({
//         msg: `Demande de ${leave.employeeName} ${kind === "approve" ? "acceptée" : "refusée"}. Le salarié est informé de la décision.`,
//         tone: "success",
//       })
//     } catch (e) {
//       setToast({ msg: errorMessage(e, "Action impossible."), tone: "error" })
//     } finally { setBusy(false) }
//   }

//   const hasFilters = !!(employeeCode || siteId || from || to)

//   return (
//     <div className="space-y-5">
//       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
//         <div className="flex items-center gap-3">
//           <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center border border-primary-100"><CalendarClock className="w-5 h-5" /></div>
//           <div>
//             <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Demandes de permission</h1>
//             <p className="text-sm text-slate-500 mt-0.5">Consultez, acceptez ou refusez les demandes des salariés.</p>
//           </div>
//         </div>
//       </div>

//       {/* Filtre statut */}
//       <div className="flex flex-wrap gap-2">
//         {([["EN_ATTENTE", "En attente"], ["ACCEPTEE", "Acceptées"], ["REFUSEE", "Refusées"], ["ANNULEE", "Annulées"], ["", "Toutes"]] as [LeaveStatus | "", string][]).map(([s, label]) => (
//           <button key={s || "all"} onClick={() => setStatus(s)}
//             className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
//               status === s ? "bg-primary-600 text-white shadow-md shadow-primary-600/20" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
//             {label}
//           </button>
//         ))}
//       </div>

//       {/* Autres filtres */}
//       <Card className="rounded-2xl">
//         <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3"><Filter className="w-3.5 h-3.5" />Filtres</div>
//         <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
//           <Dropdown value={employeeCode} onChange={setEmployeeCode} placeholder="Tous les salariés" icon={<User className="w-4 h-4" />}
//             options={[{ value: "", label: "Tous les salariés" }, ...employees.map((e) => ({ value: e.employeeCode, label: `${employeeName(e)} (${e.employeeCode})` }))]} />
//           <Dropdown value={siteId} onChange={setSiteId} placeholder="Tous les chantiers" icon={<HardHat className="w-4 h-4" />}
//             options={[{ value: "", label: "Tous les chantiers" }, ...sites.map((s) => ({ value: s.id, label: s.name }))]} />
//           <div>
//             <label className="block text-[11px] text-slate-500 mb-1">Du</label>
//             <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
//           </div>
//           <div>
//             <label className="block text-[11px] text-slate-500 mb-1">Au</label>
//             <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
//           </div>
//         </div>
//         {hasFilters && (
//           <button onClick={() => { setEmployeeCode(""); setSiteId(""); setFrom(""); setTo("") }}
//             className="mt-3 text-xs font-medium text-primary-700 hover:underline">Effacer les filtres</button>
//         )}
//       </Card>

//       {!loaded && <p className="text-sm text-slate-400 text-center py-4">Chargement...</p>}
//       {loaded && leaves.length === 0 && (
//         <Card><EmptyState message={status === "EN_ATTENTE" ? "Aucune demande en attente." : "Aucune demande pour ces critères."} /></Card>
//       )}

//       <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
//         {leaves.map((l) => {
//           const st = LEAVE_STATUS[l.status]
//           return (
//             <Card key={l.id} className="space-y-3 rounded-2xl">
//               <div className="flex items-start justify-between gap-3">
//                 <div className="min-w-0">
//                   <div className="font-bold text-slate-900 truncate">{l.employeeName}</div>
//                   <div className="text-xs text-slate-400 font-mono">{l.employeeCode}</div>
//                 </div>
//                 <Badge tone={st.tone}>{st.label}</Badge>
//               </div>
//               <dl className="text-xs text-slate-600 space-y-1.5 bg-slate-50 rounded-xl p-3">
//                 <div className="flex justify-between gap-2"><dt>Type</dt><dd className="font-semibold text-slate-800">{LEAVE_TYPES[l.type]}</dd></div>
//                 <div className="flex justify-between gap-2">
//                   <dt>Période</dt>
//                   <dd className="font-medium text-right">{l.startDate === l.endDate ? fmtDay(l.startDate) : `${fmtDay(l.startDate)} → ${fmtDay(l.endDate)}`}</dd>
//                 </div>
//                 <div className="flex justify-between gap-2"><dt>Durée</dt><dd className="font-medium">{durationLabel(l)}</dd></div>
//                 {l.siteName && <div className="flex justify-between gap-2"><dt>Chantier</dt><dd className="font-medium text-right">{l.siteName}</dd></div>}
//                 <div className="flex justify-between gap-2"><dt>Demandée le</dt><dd className="font-medium">{fmtDateTime(l.createdAt)}</dd></div>
//                 <div className="pt-1.5 border-t border-slate-200 text-slate-700 whitespace-pre-line">« {l.reason} »</div>
//               </dl>
//               {l.status !== "EN_ATTENTE" && l.decidedAt && (
//                 <div className="text-xs text-slate-500 space-y-1">
//                   <div>Décision le {fmtDateTime(l.decidedAt)}{l.decidedByName ? ` par ${l.decidedByName}` : ""}</div>
//                   {l.decisionNote && <div className="flex items-start gap-1.5 text-slate-600"><MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span className="whitespace-pre-line">{l.decisionNote}</span></div>}
//                 </div>
//               )}
//               {l.status === "EN_ATTENTE" && (
//                 <div className="flex gap-2">
//                   <button onClick={() => openDecision(l, "refuse")}
//                     className="flex-1 border border-rose-200 text-rose-600 hover:bg-rose-50 text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2">
//                     <Ban className="w-4 h-4" />Refuser
//                   </button>
//                   <button onClick={() => openDecision(l, "approve")}
//                     className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2">
//                     <Check className="w-4 h-4" />Accepter
//                   </button>
//                 </div>
//               )}
//             </Card>
//           )
//         })}
//       </div>

//       {decision && (
//         <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
//           <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
//             <div className="flex items-start justify-between gap-3">
//               <div>
//                 <h2 className="font-bold text-lg text-slate-900">{decision.kind === "approve" ? "Accepter la demande" : "Refuser la demande"}</h2>
//                 <p className="text-sm text-slate-500 mt-1">
//                   {decision.leave.employeeName} — {LEAVE_TYPES[decision.leave.type]}, {durationLabel(decision.leave)} à partir du {fmtDay(decision.leave.startDate)}
//                 </p>
//               </div>
//               <button onClick={() => setDecision(null)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center shrink-0"><X className="w-4 h-4" /></button>
//             </div>
//             <textarea autoFocus rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500}
//               placeholder={decision.kind === "approve" ? "Message pour le salarié (facultatif)" : "Motif du refus (facultatif, visible par le salarié)"}
//               className={inputCls} />
//             <div className="flex gap-3">
//               <button onClick={() => setDecision(null)} className="flex-1 border border-slate-200 text-slate-700 font-medium py-3 rounded-xl hover:bg-slate-50">Annuler</button>
//               <button onClick={submitDecision} disabled={busy}
//                 className={`flex-1 text-white font-semibold py-3 rounded-xl disabled:opacity-60 ${decision.kind === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}`}>
//                 {busy ? "..." : decision.kind === "approve" ? "Accepter" : "Refuser"}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {toast && <Toast message={toast.msg} tone={toast.tone} onClose={() => setToast(null)} />}
//     </div>
//   )
// }
