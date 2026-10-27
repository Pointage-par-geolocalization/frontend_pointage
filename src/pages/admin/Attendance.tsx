// src/pages/admin/Attendance.tsx
import { useEffect, useMemo, useState } from "react"
import { todayKey } from "../../utils/date"
import { listAttendance, getAttendanceTotals, adminClockIn, adminClockOut, type Attendance, type AttendanceTotals, type AttendanceStatus } from "../../services/attendance"
import { listEmployees, employeeName, type Employee } from "../../services/employees"
import { listWorkplaces, type Workplace } from "../../services/workplaces"
import { errorMessage } from "../../services/api"
import { formatAriary, minutesToHoursLabel } from "../../utils/salaryCalculator"
import { fmtTime, fmtDateTime } from "../../utils/format"
import Card from "../../components/Card"
import Badge from "../../components/Badge"
import EmptyState from "../../components/EmptyState"
import Dropdown from "../../components/Dropdown"
import Toast from "../../components/Toast"
import { Play, Square, X, Building2, User, Laptop, HardHat } from "lucide-react"

/** Valeur pour <input type="datetime-local"> (heure locale, sans fuseau). */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
/** Normalise les variantes de réponse API sans jamais laisser passer NaN/Infinity. */
function getTotalMinutes(total: AttendanceTotals): number | null {
  const candidates = [
    total.workedMinutes,
    total.totalMinutes,
    total.workedHours == null ? undefined : Number(total.workedHours) * 60,
  ]
  for (const candidate of candidates) {
    if (candidate == null) continue
    const minutes = Number(candidate)
    if (Number.isFinite(minutes) && minutes >= 0) return minutes
  }
  return null
}

export default function AdminAttendance() {
  const [date, setDate] = useState(todayKey())
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [filterEmployee, setFilterEmployee] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterSite, setFilterSite] = useState("")
  const [totals, setTotals] = useState<AttendanceTotals[]>([])
  const [rows, setRows] = useState<Attendance[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [workplaces, setWorkplaces] = useState<Workplace[]>([])
  const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null)

  const [showStart, setShowStart] = useState(false)
  const [pickedEmployee, setPickedEmployee] = useState("")
  const [pickedDept, setPickedDept] = useState("")
  const [starting, setStarting] = useState(false)

  const [stopping, setStopping] = useState<Attendance | null>(null)
  const [exitAt, setExitAt] = useState("")
  const [stopBusy, setStopBusy] = useState(false)

  const isToday = date === todayKey() && !from && !to

  const query = { date: from || to ? undefined : date, from: from || undefined, to: to || undefined, employeeCode: filterEmployee || undefined, status: (filterStatus || undefined) as AttendanceStatus | undefined, siteId: filterSite || undefined }
  async function refresh() {
    try { setRows(await listAttendance(query)); setTotals(await getAttendanceTotals(query)) }
    catch (e) { setToast({ msg: errorMessage(e, "Impossible de charger les présences."), tone: "error" }) }
  }
  useEffect(() => {
    let cancelled = false
    listAttendance(query)
      .then(async (a) => { if (!cancelled) { setRows(a); setTotals(await getAttendanceTotals(query)) } })
      .catch((e) => { if (!cancelled) setToast({ msg: errorMessage(e, "Impossible de charger les présences."), tone: "error" }) })
    return () => { cancelled = true }
  }, [date, from, to, filterEmployee, filterStatus, filterSite])
  useEffect(() => {
    listEmployees().then(setEmployees).catch(() => {})
    listWorkplaces().then(setWorkplaces).catch(() => {})
  }, [])

  const nameFor = (r: Pick<Attendance, "employeeCode" | "employeeName">) => {
    if (r.employeeName) return r.employeeName
    const e = employees.find((x) => x.employeeCode === r.employeeCode)
    return e ? employeeName(e) : r.employeeCode
  }

  // Salariés actifs sans session ouverte (un nouveau pointage est possible après une sortie).
  const available = useMemo(
    () => employees.filter((e) => e.active && !rows.some((r) => r.employeeCode === e.employeeCode && r.status === "EN_COURS")),
    [employees, rows]
  )
  const selectedEmp = employees.find((e) => e.employeeCode === pickedEmployee)
  const deptOptions = useMemo(() => {
    const ids = selectedEmp?.departmentIds ?? []
    const list = workplaces.filter((w) => ids.includes(w.id))
    return (list.length ? list : workplaces).map((w) => ({ value: w.id, label: w.name }))
  }, [selectedEmp, workplaces])

  function openStart() {
    setPickedEmployee(""); setPickedDept(""); setShowStart(true)
  }
  function pickEmployee(code: string) {
    setPickedEmployee(code)
    const emp = employees.find((e) => e.employeeCode === code)
    const first = workplaces.find((w) => emp?.departmentIds?.includes(w.id)) ?? workplaces[0]
    setPickedDept(first?.id ?? "")
  }

  async function handleStart() {
    if (!pickedEmployee || !pickedDept) return
    const label = selectedEmp ? employeeName(selectedEmp) : pickedEmployee
    setStarting(true)
    try {
      await adminClockIn(pickedEmployee, pickedDept)
      setShowStart(false)
      await refresh()
      setToast({ msg: `Pointage démarré pour ${label} (sans vérification GPS).`, tone: "success" })
    } catch (e) {
      setToast({ msg: errorMessage(e, "Impossible de démarrer le pointage."), tone: "error" })
    } finally { setStarting(false) }
  }

  function openStop(r: Attendance) {
    // Session du jour : sortie maintenant par défaut. Session oubliée d'un autre jour : à préciser.
    const entry = new Date(r.entryTime).getTime()
    const proposed = r.workDate === todayKey() ? Date.now() : Math.min(entry + 8 * 3600_000, Date.now())
    setExitAt(toLocalInput(new Date(proposed)))
    setStopping(r)
  }

  async function handleStop() {
    if (!stopping) return
    const exit = new Date(exitAt)
    const entry = new Date(stopping.entryTime)
    if (Number.isNaN(exit.getTime())) { setToast({ msg: "Heure de sortie invalide.", tone: "error" }); return }
    if (exit < entry) { setToast({ msg: "L'heure de sortie doit être après l'heure d'entrée.", tone: "error" }); return }
    if (exit.getTime() > Date.now() + 60_000) { setToast({ msg: "L'heure de sortie ne peut pas être dans le futur.", tone: "error" }); return }
    setStopBusy(true)
    try {
      const res = await adminClockOut(stopping.id, exit.toISOString())
      setStopping(null)
      await refresh()
      setToast({ msg: `Pointage arrêté pour ${nameFor(stopping)} : ${minutesToHoursLabel(res.workedMinutes)} · ${formatAriary(res.dailySalary)}.`, tone: "success" })
    } catch (e) {
      setToast({ msg: errorMessage(e, "Impossible d'arrêter le pointage."), tone: "error" })
    } finally { setStopBusy(false) }
  }

  const hasOpen = rows.some((r) => r.status === "EN_COURS")

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Présences</h1>
        <div className="flex flex-wrap items-center gap-2">
          <input aria-label="Du" type="date" value={from} max={todayKey()} onChange={e=>setFrom(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm" /><input aria-label="Au" type="date" value={to} max={todayKey()} onChange={e=>setTo(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm" />
          {isToday && (
            <button onClick={openStart}
              className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-2">
              <Play className="w-4 h-4 fill-current" /> Démarrer un pointage
            </button>
          )}
        </div>
      </div>

      <Card className="space-y-3"><div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2"><select value={filterEmployee} onChange={e=>setFilterEmployee(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"><option value="">Tous les salariés</option>{employees.map(e=><option key={e.employeeCode} value={e.employeeCode}>{employeeName(e)}</option>)}</select><select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"><option value="">Tous les statuts</option><option value="EN_COURS">En cours</option><option value="TERMINEE">Terminée</option></select><select value={filterSite} onChange={e=>setFilterSite(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"><option value="">Tous les chantiers</option>{workplaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select><button onClick={()=>{setDate("");setFrom("");setTo("");setFilterEmployee("");setFilterStatus("");setFilterSite("")}} className="border rounded-lg px-3 py-2 text-sm">Réinitialiser</button></div><div className="flex flex-wrap gap-3">{totals.map(t=>{const minutes=getTotalMinutes(t);if(minutes===null)return null;return <div key={t.employeeCode} className="rounded-lg bg-slate-50 px-3 py-2 text-xs"><b>{t.employeeName || nameFor({employeeCode:t.employeeCode})}</b>: {minutesToHoursLabel(minutes)} ({(minutes/60).toFixed(2)} h)</div>})}</div></Card>
      <Card className="overflow-x-auto">
        {rows.length === 0 ? (
          <EmptyState message="Aucun pointage pour cette date." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-3">Salarié</th>
                <th className="py-2 pr-3">Département</th>
                <th className="py-2 pr-3">Entrée</th>
                <th className="py-2 pr-3">Sortie</th>
                <th className="py-2 pr-3">Temps</th>
                <th className="py-2 pr-3">Salaire</th>
                <th className="py-2 pr-3">GPS</th>
                <th className="py-2 pr-3">Statut</th>
                {hasOpen && <th className="py-2 pr-3 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 pr-3 font-medium">
                    {nameFor(r)}
                    <div className="text-xs text-gray-400 font-normal">{r.employeeCode}</div>
                  </td>
                  <td className="py-2 pr-3">
                    {r.departmentName || "—"}
                    {r.siteName && <div className="text-xs text-gray-400 flex items-center gap-1"><HardHat className="w-3 h-3" />{r.siteName}</div>}
                  </td>
                  <td className="py-2 pr-3">{fmtTime(r.entryTime)}</td>
                  <td className="py-2 pr-3">{fmtTime(r.exitTime)}</td>
                  <td className="py-2 pr-3">{minutesToHoursLabel(r.workedMinutes)}</td>
                  <td className="py-2 pr-3">{formatAriary(r.dailySalary)}</td>
                  <td className="py-2 pr-3 text-xs text-gray-500">
                    {r.entrySource === "ADMIN" ? <span className="inline-flex items-center gap-1 text-amber-600"><Laptop className="w-3 h-3" />Admin</span>
                      : r.entryGpsCheck ? `${r.entryGpsCheck.distance} m` : "—"}
                    {r.exitSource === "ADMIN" ? <span className="inline-flex items-center gap-1 text-amber-600 ml-1">/ <Laptop className="w-3 h-3" />Admin</span>
                      : r.exitGpsCheck ? ` / ${r.exitGpsCheck.distance} m` : ""}
                  </td>
                  <td className="py-2 pr-3"><Badge tone={r.status === "TERMINEE" ? "green" : "yellow"}>{r.status === "TERMINEE" ? "Terminée" : "En cours"}{r.isLate ? " · En retard" : ""}</Badge></td>
                  {hasOpen && (
                    <td className="py-2 pr-3 text-right">
                      {r.status === "EN_COURS" && (
                        <button onClick={() => openStop(r)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700">
                          <Square className="w-3.5 h-3.5 fill-current" /> Arrêter
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {showStart && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold text-lg text-slate-900">Démarrer un pointage</h2>
                <p className="text-sm text-slate-500 mt-1">À distance, sans vérification de la localisation du salarié.</p>
              </div>
              <button onClick={() => setShowStart(false)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            {available.length === 0 ? (
              <p className="text-sm text-slate-500">Tous les salariés actifs ont déjà une entrée en cours.</p>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Salarié</label>
                  <Dropdown value={pickedEmployee} onChange={pickEmployee} placeholder="Choisir un salarié"
                    icon={<User className="w-4 h-4" />}
                    options={available.map((e) => ({ value: e.employeeCode, label: `${employeeName(e)} (${e.employeeCode})` }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Département</label>
                  <Dropdown value={pickedDept} onChange={setPickedDept} placeholder="Choisir un département"
                    icon={<Building2 className="w-4 h-4" />} options={deptOptions} />
                </div>
              </>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowStart(false)} className="flex-1 border border-slate-200 text-slate-700 font-medium py-3 rounded-xl hover:bg-slate-50">Annuler</button>
              <button onClick={handleStart} disabled={starting || !pickedEmployee || !pickedDept}
                className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl disabled:opacity-60">
                {starting ? "..." : "Démarrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {stopping && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-lg text-slate-900">Arrêter le pointage</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {nameFor(stopping)} — entrée le {fmtDateTime(stopping.entryTime)}.
                  La sortie est enregistrée sans vérification de la localisation ; le salaire est calculé normalement.
                </p>
              </div>
              <button onClick={() => setStopping(null)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Heure de sortie</label>
              <input type="datetime-local" value={exitAt} onChange={(e) => setExitAt(e.target.value)}
                min={toLocalInput(new Date(stopping.entryTime))} max={toLocalInput(new Date())}
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none" />
              {stopping.workDate !== todayKey() && (
                <p className="mt-1.5 text-xs text-amber-700">Session oubliée d'un jour précédent : indiquez l'heure réelle de départ du salarié.</p>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStopping(null)} className="flex-1 border border-slate-200 text-slate-700 font-medium py-3 rounded-xl hover:bg-slate-50">Annuler</button>
              <button onClick={handleStop} disabled={stopBusy || !exitAt}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold py-3 rounded-xl disabled:opacity-60">
                {stopBusy ? "..." : "Arrêter le pointage"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.msg} tone={toast.tone} onClose={() => setToast(null)} />}
    </div>
  )
}


// // src/pages/admin/Attendance.tsx
// import { useEffect, useMemo, useState } from "react"
// import { todayKey } from "../../utils/date"
// import { listAttendance, getAttendanceTotals, adminClockIn, adminClockOut, type Attendance, type AttendanceTotals, type AttendanceStatus } from "../../services/attendance"
// import { listEmployees, employeeName, type Employee } from "../../services/employees"
// import { listWorkplaces, type Workplace } from "../../services/workplaces"
// import { errorMessage } from "../../services/api"
// import { formatAriary, minutesToHoursLabel } from "../../utils/salaryCalculator"
// import { fmtTime, fmtDateTime } from "../../utils/format"
// import Card from "../../components/Card"
// import Badge from "../../components/Badge"
// import EmptyState from "../../components/EmptyState"
// import Dropdown from "../../components/Dropdown"
// import Toast from "../../components/Toast"
// import { Play, Square, X, Building2, User, Laptop, HardHat } from "lucide-react"

// /** Valeur pour <input type="datetime-local"> (heure locale, sans fuseau). */
// function toLocalInput(d: Date): string {
//   const pad = (n: number) => String(n).padStart(2, "0")
//   return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
// }

// export default function AdminAttendance() {
//   const [date, setDate] = useState(todayKey())
//   const [from, setFrom] = useState("")
//   const [to, setTo] = useState("")
//   const [filterEmployee, setFilterEmployee] = useState("")
//   const [filterStatus, setFilterStatus] = useState("")
//   const [filterSite, setFilterSite] = useState("")
//   const [totals, setTotals] = useState<AttendanceTotals[]>([])
//   const [rows, setRows] = useState<Attendance[]>([])
//   const [employees, setEmployees] = useState<Employee[]>([])
//   const [workplaces, setWorkplaces] = useState<Workplace[]>([])
//   const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null)

//   const [showStart, setShowStart] = useState(false)
//   const [pickedEmployee, setPickedEmployee] = useState("")
//   const [pickedDept, setPickedDept] = useState("")
//   const [starting, setStarting] = useState(false)

//   const [stopping, setStopping] = useState<Attendance | null>(null)
//   const [exitAt, setExitAt] = useState("")
//   const [stopBusy, setStopBusy] = useState(false)

//   const isToday = date === todayKey() && !from && !to

//   const query = { date: from || to ? undefined : date, from: from || undefined, to: to || undefined, employeeCode: filterEmployee || undefined, status: (filterStatus || undefined) as AttendanceStatus | undefined, siteId: filterSite || undefined }
//   async function refresh() {
//     try { setRows(await listAttendance(query)); setTotals(await getAttendanceTotals(query)) }
//     catch (e) { setToast({ msg: errorMessage(e, "Impossible de charger les présences."), tone: "error" }) }
//   }
//   useEffect(() => {
//     let cancelled = false
//     listAttendance(query)
//       .then(async (a) => { if (!cancelled) { setRows(a); setTotals(await getAttendanceTotals(query)) } })
//       .catch((e) => { if (!cancelled) setToast({ msg: errorMessage(e, "Impossible de charger les présences."), tone: "error" }) })
//     return () => { cancelled = true }
//   }, [date, from, to, filterEmployee, filterStatus, filterSite])
//   useEffect(() => {
//     listEmployees().then(setEmployees).catch(() => {})
//     listWorkplaces().then(setWorkplaces).catch(() => {})
//   }, [])

//   const nameFor = (r: Pick<Attendance, "employeeCode" | "employeeName">) => {
//     if (r.employeeName) return r.employeeName
//     const e = employees.find((x) => x.employeeCode === r.employeeCode)
//     return e ? employeeName(e) : r.employeeCode
//   }

//   // Salariés actifs sans session ouverte (un nouveau pointage est possible après une sortie).
//   const available = useMemo(
//     () => employees.filter((e) => e.active && !rows.some((r) => r.employeeCode === e.employeeCode && r.status === "EN_COURS")),
//     [employees, rows]
//   )
//   const selectedEmp = employees.find((e) => e.employeeCode === pickedEmployee)
//   const deptOptions = useMemo(() => {
//     const ids = selectedEmp?.departmentIds ?? []
//     const list = workplaces.filter((w) => ids.includes(w.id))
//     return (list.length ? list : workplaces).map((w) => ({ value: w.id, label: w.name }))
//   }, [selectedEmp, workplaces])

//   function openStart() {
//     setPickedEmployee(""); setPickedDept(""); setShowStart(true)
//   }
//   function pickEmployee(code: string) {
//     setPickedEmployee(code)
//     const emp = employees.find((e) => e.employeeCode === code)
//     const first = workplaces.find((w) => emp?.departmentIds?.includes(w.id)) ?? workplaces[0]
//     setPickedDept(first?.id ?? "")
//   }

//   async function handleStart() {
//     if (!pickedEmployee || !pickedDept) return
//     const label = selectedEmp ? employeeName(selectedEmp) : pickedEmployee
//     setStarting(true)
//     try {
//       await adminClockIn(pickedEmployee, pickedDept)
//       setShowStart(false)
//       await refresh()
//       setToast({ msg: `Pointage démarré pour ${label} (sans vérification GPS).`, tone: "success" })
//     } catch (e) {
//       setToast({ msg: errorMessage(e, "Impossible de démarrer le pointage."), tone: "error" })
//     } finally { setStarting(false) }
//   }

//   function openStop(r: Attendance) {
//     // Session du jour : sortie maintenant par défaut. Session oubliée d'un autre jour : à préciser.
//     const entry = new Date(r.entryTime).getTime()
//     const proposed = r.workDate === todayKey() ? Date.now() : Math.min(entry + 8 * 3600_000, Date.now())
//     setExitAt(toLocalInput(new Date(proposed)))
//     setStopping(r)
//   }

//   async function handleStop() {
//     if (!stopping) return
//     const exit = new Date(exitAt)
//     const entry = new Date(stopping.entryTime)
//     if (Number.isNaN(exit.getTime())) { setToast({ msg: "Heure de sortie invalide.", tone: "error" }); return }
//     if (exit < entry) { setToast({ msg: "L'heure de sortie doit être après l'heure d'entrée.", tone: "error" }); return }
//     if (exit.getTime() > Date.now() + 60_000) { setToast({ msg: "L'heure de sortie ne peut pas être dans le futur.", tone: "error" }); return }
//     setStopBusy(true)
//     try {
//       const res = await adminClockOut(stopping.id, exit.toISOString())
//       setStopping(null)
//       await refresh()
//       setToast({ msg: `Pointage arrêté pour ${nameFor(stopping)} : ${minutesToHoursLabel(res.workedMinutes)} · ${formatAriary(res.dailySalary)}.`, tone: "success" })
//     } catch (e) {
//       setToast({ msg: errorMessage(e, "Impossible d'arrêter le pointage."), tone: "error" })
//     } finally { setStopBusy(false) }
//   }

//   const hasOpen = rows.some((r) => r.status === "EN_COURS")

//   return (
//     <div className="space-y-4">
//       <div className="flex flex-wrap items-center justify-between gap-2">
//         <h1 className="text-xl font-bold">Présences</h1>
//         <div className="flex flex-wrap items-center gap-2">
//           <input aria-label="Du" type="date" value={from} max={todayKey()} onChange={e=>setFrom(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm" /><input aria-label="Au" type="date" value={to} max={todayKey()} onChange={e=>setTo(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm" />
//           {isToday && (
//             <button onClick={openStart}
//               className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-2">
//               <Play className="w-4 h-4 fill-current" /> Démarrer un pointage
//             </button>
//           )}
//         </div>
//       </div>

//       <Card className="space-y-3"><div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2"><select value={filterEmployee} onChange={e=>setFilterEmployee(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"><option value="">Tous les salariés</option>{employees.map(e=><option key={e.employeeCode} value={e.employeeCode}>{employeeName(e)}</option>)}</select><select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"><option value="">Tous les statuts</option><option value="EN_COURS">En cours</option><option value="TERMINEE">Terminée</option></select><select value={filterSite} onChange={e=>setFilterSite(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"><option value="">Tous les chantiers</option>{workplaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select><button onClick={()=>{setDate("");setFrom("");setTo("");setFilterEmployee("");setFilterStatus("");setFilterSite("")}} className="border rounded-lg px-3 py-2 text-sm">Réinitialiser</button></div><div className="flex flex-wrap gap-3">{totals.map(t=><div key={t.employeeCode} className="rounded-lg bg-slate-50 px-3 py-2 text-xs"><b>{t.employeeName || nameFor({employeeCode:t.employeeCode})}</b>: {minutesToHoursLabel(t.workedMinutes)} ({(t.workedMinutes/60).toFixed(2)} h)</div>)}</div></Card>
//       <Card className="overflow-x-auto">
//         {rows.length === 0 ? (
//           <EmptyState message="Aucun pointage pour cette date." />
//         ) : (
//           <table className="w-full text-sm">
//             <thead>
//               <tr className="text-left text-gray-500 border-b">
//                 <th className="py-2 pr-3">Salarié</th>
//                 <th className="py-2 pr-3">Département</th>
//                 <th className="py-2 pr-3">Entrée</th>
//                 <th className="py-2 pr-3">Sortie</th>
//                 <th className="py-2 pr-3">Temps</th>
//                 <th className="py-2 pr-3">Salaire</th>
//                 <th className="py-2 pr-3">GPS</th>
//                 <th className="py-2 pr-3">Statut</th>
//                 {hasOpen && <th className="py-2 pr-3 text-right">Action</th>}
//               </tr>
//             </thead>
//             <tbody className="divide-y">
//               {rows.map((r) => (
//                 <tr key={r.id}>
//                   <td className="py-2 pr-3 font-medium">
//                     {nameFor(r)}
//                     <div className="text-xs text-gray-400 font-normal">{r.employeeCode}</div>
//                   </td>
//                   <td className="py-2 pr-3">
//                     {r.departmentName || "—"}
//                     {r.siteName && <div className="text-xs text-gray-400 flex items-center gap-1"><HardHat className="w-3 h-3" />{r.siteName}</div>}
//                   </td>
//                   <td className="py-2 pr-3">{fmtTime(r.entryTime)}</td>
//                   <td className="py-2 pr-3">{fmtTime(r.exitTime)}</td>
//                   <td className="py-2 pr-3">{minutesToHoursLabel(r.workedMinutes)}</td>
//                   <td className="py-2 pr-3">{formatAriary(r.dailySalary)}</td>
//                   <td className="py-2 pr-3 text-xs text-gray-500">
//                     {r.entrySource === "ADMIN" ? <span className="inline-flex items-center gap-1 text-amber-600"><Laptop className="w-3 h-3" />Admin</span>
//                       : r.entryGpsCheck ? `${r.entryGpsCheck.distance} m` : "—"}
//                     {r.exitSource === "ADMIN" ? <span className="inline-flex items-center gap-1 text-amber-600 ml-1">/ <Laptop className="w-3 h-3" />Admin</span>
//                       : r.exitGpsCheck ? ` / ${r.exitGpsCheck.distance} m` : ""}
//                   </td>
//                   <td className="py-2 pr-3"><Badge tone={r.status === "TERMINEE" ? "green" : "yellow"}>{r.status === "TERMINEE" ? "Terminée" : "En cours"}{r.isLate ? " · En retard" : ""}</Badge></td>
//                   {hasOpen && (
//                     <td className="py-2 pr-3 text-right">
//                       {r.status === "EN_COURS" && (
//                         <button onClick={() => openStop(r)}
//                           className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700">
//                           <Square className="w-3.5 h-3.5 fill-current" /> Arrêter
//                         </button>
//                       )}
//                     </td>
//                   )}
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         )}
//       </Card>

//       {showStart && (
//         <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
//           <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-5 shadow-2xl">
//             <div className="flex items-start justify-between">
//               <div>
//                 <h2 className="font-bold text-lg text-slate-900">Démarrer un pointage</h2>
//                 <p className="text-sm text-slate-500 mt-1">À distance, sans vérification de la localisation du salarié.</p>
//               </div>
//               <button onClick={() => setShowStart(false)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center">
//                 <X className="w-4 h-4" />
//               </button>
//             </div>
//             {available.length === 0 ? (
//               <p className="text-sm text-slate-500">Tous les salariés actifs ont déjà une entrée en cours.</p>
//             ) : (
//               <>
//                 <div>
//                   <label className="block text-xs font-semibold text-slate-600 mb-1.5">Salarié</label>
//                   <Dropdown value={pickedEmployee} onChange={pickEmployee} placeholder="Choisir un salarié"
//                     icon={<User className="w-4 h-4" />}
//                     options={available.map((e) => ({ value: e.employeeCode, label: `${employeeName(e)} (${e.employeeCode})` }))} />
//                 </div>
//                 <div>
//                   <label className="block text-xs font-semibold text-slate-600 mb-1.5">Département</label>
//                   <Dropdown value={pickedDept} onChange={setPickedDept} placeholder="Choisir un département"
//                     icon={<Building2 className="w-4 h-4" />} options={deptOptions} />
//                 </div>
//               </>
//             )}
//             <div className="flex gap-3">
//               <button onClick={() => setShowStart(false)} className="flex-1 border border-slate-200 text-slate-700 font-medium py-3 rounded-xl hover:bg-slate-50">Annuler</button>
//               <button onClick={handleStart} disabled={starting || !pickedEmployee || !pickedDept}
//                 className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl disabled:opacity-60">
//                 {starting ? "..." : "Démarrer"}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {stopping && (
//         <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
//           <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-5 shadow-2xl">
//             <div className="flex items-start justify-between gap-3">
//               <div>
//                 <h2 className="font-bold text-lg text-slate-900">Arrêter le pointage</h2>
//                 <p className="text-sm text-slate-500 mt-1">
//                   {nameFor(stopping)} — entrée le {fmtDateTime(stopping.entryTime)}.
//                   La sortie est enregistrée sans vérification de la localisation ; le salaire est calculé normalement.
//                 </p>
//               </div>
//               <button onClick={() => setStopping(null)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center shrink-0">
//                 <X className="w-4 h-4" />
//               </button>
//             </div>
//             <div>
//               <label className="block text-xs font-semibold text-slate-600 mb-1.5">Heure de sortie</label>
//               <input type="datetime-local" value={exitAt} onChange={(e) => setExitAt(e.target.value)}
//                 min={toLocalInput(new Date(stopping.entryTime))} max={toLocalInput(new Date())}
//                 className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none" />
//               {stopping.workDate !== todayKey() && (
//                 <p className="mt-1.5 text-xs text-amber-700">Session oubliée d'un jour précédent : indiquez l'heure réelle de départ du salarié.</p>
//               )}
//             </div>
//             <div className="flex gap-3">
//               <button onClick={() => setStopping(null)} className="flex-1 border border-slate-200 text-slate-700 font-medium py-3 rounded-xl hover:bg-slate-50">Annuler</button>
//               <button onClick={handleStop} disabled={stopBusy || !exitAt}
//                 className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold py-3 rounded-xl disabled:opacity-60">
//                 {stopBusy ? "..." : "Arrêter le pointage"}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {toast && <Toast message={toast.msg} tone={toast.tone} onClose={() => setToast(null)} />}
//     </div>
//   )
// }


// // src/pages/admin/Attendance.tsx
// import { useEffect, useMemo, useState } from "react"
// import { todayKey } from "../../utils/date"
// import { listAttendanceForDate, adminClockIn, adminClockOut, type Attendance } from "../../services/attendance"
// import { listEmployees, employeeName, type Employee } from "../../services/employees"
// import { listWorkplaces, type Workplace } from "../../services/workplaces"
// import { errorMessage } from "../../services/api"
// import { formatAriary, minutesToHoursLabel } from "../../utils/salaryCalculator"
// import { fmtTime, fmtDateTime } from "../../utils/format"
// import Card from "../../components/Card"
// import Badge from "../../components/Badge"
// import EmptyState from "../../components/EmptyState"
// import Dropdown from "../../components/Dropdown"
// import Toast from "../../components/Toast"
// import { Play, Square, X, Building2, User, Laptop, HardHat } from "lucide-react"

// /** Valeur pour <input type="datetime-local"> (heure locale, sans fuseau). */
// function toLocalInput(d: Date): string {
//   const pad = (n: number) => String(n).padStart(2, "0")
//   return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
// }

// export default function AdminAttendance() {
//   const [date, setDate] = useState(todayKey())
//   const [rows, setRows] = useState<Attendance[]>([])
//   const [employees, setEmployees] = useState<Employee[]>([])
//   const [workplaces, setWorkplaces] = useState<Workplace[]>([])
//   const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null)

//   const [showStart, setShowStart] = useState(false)
//   const [pickedEmployee, setPickedEmployee] = useState("")
//   const [pickedDept, setPickedDept] = useState("")
//   const [starting, setStarting] = useState(false)

//   const [stopping, setStopping] = useState<Attendance | null>(null)
//   const [exitAt, setExitAt] = useState("")
//   const [stopBusy, setStopBusy] = useState(false)

//   const isToday = date === todayKey()

//   async function refresh() {
//     try { setRows(await listAttendanceForDate(date)) }
//     catch (e) { setToast({ msg: errorMessage(e, "Impossible de charger les présences."), tone: "error" }) }
//   }
//   useEffect(() => {
//     let cancelled = false
//     listAttendanceForDate(date)
//       .then((a) => { if (!cancelled) setRows(a) })
//       .catch((e) => { if (!cancelled) setToast({ msg: errorMessage(e, "Impossible de charger les présences."), tone: "error" }) })
//     return () => { cancelled = true }
//   }, [date])
//   useEffect(() => {
//     listEmployees().then(setEmployees).catch(() => {})
//     listWorkplaces().then(setWorkplaces).catch(() => {})
//   }, [])

//   const nameFor = (r: Pick<Attendance, "employeeCode" | "employeeName">) => {
//     if (r.employeeName) return r.employeeName
//     const e = employees.find((x) => x.employeeCode === r.employeeCode)
//     return e ? employeeName(e) : r.employeeCode
//   }

//   // Salariés actifs sans session ouverte (un nouveau pointage est possible après une sortie).
//   const available = useMemo(
//     () => employees.filter((e) => e.active && !rows.some((r) => r.employeeCode === e.employeeCode && r.status === "EN_COURS")),
//     [employees, rows]
//   )
//   const selectedEmp = employees.find((e) => e.employeeCode === pickedEmployee)
//   const deptOptions = useMemo(() => {
//     const ids = selectedEmp?.departmentIds ?? []
//     const list = workplaces.filter((w) => ids.includes(w.id))
//     return (list.length ? list : workplaces).map((w) => ({ value: w.id, label: w.name }))
//   }, [selectedEmp, workplaces])

//   function openStart() {
//     setPickedEmployee(""); setPickedDept(""); setShowStart(true)
//   }
//   function pickEmployee(code: string) {
//     setPickedEmployee(code)
//     const emp = employees.find((e) => e.employeeCode === code)
//     const first = workplaces.find((w) => emp?.departmentIds?.includes(w.id)) ?? workplaces[0]
//     setPickedDept(first?.id ?? "")
//   }

//   async function handleStart() {
//     if (!pickedEmployee || !pickedDept) return
//     const label = selectedEmp ? employeeName(selectedEmp) : pickedEmployee
//     setStarting(true)
//     try {
//       await adminClockIn(pickedEmployee, pickedDept)
//       setShowStart(false)
//       await refresh()
//       setToast({ msg: `Pointage démarré pour ${label} (sans vérification GPS).`, tone: "success" })
//     } catch (e) {
//       setToast({ msg: errorMessage(e, "Impossible de démarrer le pointage."), tone: "error" })
//     } finally { setStarting(false) }
//   }

//   function openStop(r: Attendance) {
//     // Session du jour : sortie maintenant par défaut. Session oubliée d'un autre jour : à préciser.
//     const entry = new Date(r.entryTime).getTime()
//     const proposed = r.workDate === todayKey() ? Date.now() : Math.min(entry + 8 * 3600_000, Date.now())
//     setExitAt(toLocalInput(new Date(proposed)))
//     setStopping(r)
//   }

//   async function handleStop() {
//     if (!stopping) return
//     const exit = new Date(exitAt)
//     const entry = new Date(stopping.entryTime)
//     if (Number.isNaN(exit.getTime())) { setToast({ msg: "Heure de sortie invalide.", tone: "error" }); return }
//     if (exit < entry) { setToast({ msg: "L'heure de sortie doit être après l'heure d'entrée.", tone: "error" }); return }
//     if (exit.getTime() > Date.now() + 60_000) { setToast({ msg: "L'heure de sortie ne peut pas être dans le futur.", tone: "error" }); return }
//     setStopBusy(true)
//     try {
//       const res = await adminClockOut(stopping.id, exit.toISOString())
//       setStopping(null)
//       await refresh()
//       setToast({ msg: `Pointage arrêté pour ${nameFor(stopping)} : ${minutesToHoursLabel(res.workedMinutes)} · ${formatAriary(res.dailySalary)}.`, tone: "success" })
//     } catch (e) {
//       setToast({ msg: errorMessage(e, "Impossible d'arrêter le pointage."), tone: "error" })
//     } finally { setStopBusy(false) }
//   }

//   const hasOpen = rows.some((r) => r.status === "EN_COURS")

//   return (
//     <div className="space-y-4">
//       <div className="flex flex-wrap items-center justify-between gap-2">
//         <h1 className="text-xl font-bold">Présences</h1>
//         <div className="flex flex-wrap items-center gap-2">
//           <input type="date" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value || todayKey())} className="border rounded-lg px-3 py-1.5 text-sm" />
//           {isToday && (
//             <button onClick={openStart}
//               className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-2">
//               <Play className="w-4 h-4 fill-current" /> Démarrer un pointage
//             </button>
//           )}
//         </div>
//       </div>

//       <Card className="overflow-x-auto">
//         {rows.length === 0 ? (
//           <EmptyState message="Aucun pointage pour cette date." />
//         ) : (
//           <table className="w-full text-sm">
//             <thead>
//               <tr className="text-left text-gray-500 border-b">
//                 <th className="py-2 pr-3">Salarié</th>
//                 <th className="py-2 pr-3">Département</th>
//                 <th className="py-2 pr-3">Entrée</th>
//                 <th className="py-2 pr-3">Sortie</th>
//                 <th className="py-2 pr-3">Temps</th>
//                 <th className="py-2 pr-3">Salaire</th>
//                 <th className="py-2 pr-3">GPS</th>
//                 <th className="py-2 pr-3">Statut</th>
//                 {hasOpen && <th className="py-2 pr-3 text-right">Action</th>}
//               </tr>
//             </thead>
//             <tbody className="divide-y">
//               {rows.map((r) => (
//                 <tr key={r.id}>
//                   <td className="py-2 pr-3 font-medium">
//                     {nameFor(r)}
//                     <div className="text-xs text-gray-400 font-normal">{r.employeeCode}</div>
//                   </td>
//                   <td className="py-2 pr-3">
//                     {r.departmentName || "—"}
//                     {r.siteName && <div className="text-xs text-gray-400 flex items-center gap-1"><HardHat className="w-3 h-3" />{r.siteName}</div>}
//                   </td>
//                   <td className="py-2 pr-3">{fmtTime(r.entryTime)}</td>
//                   <td className="py-2 pr-3">{fmtTime(r.exitTime)}</td>
//                   <td className="py-2 pr-3">{minutesToHoursLabel(r.workedMinutes)}</td>
//                   <td className="py-2 pr-3">{formatAriary(r.dailySalary)}</td>
//                   <td className="py-2 pr-3 text-xs text-gray-500">
//                     {r.entrySource === "ADMIN" ? <span className="inline-flex items-center gap-1 text-amber-600"><Laptop className="w-3 h-3" />Admin</span>
//                       : r.entryGpsCheck ? `${r.entryGpsCheck.distance} m` : "—"}
//                     {r.exitSource === "ADMIN" ? <span className="inline-flex items-center gap-1 text-amber-600 ml-1">/ <Laptop className="w-3 h-3" />Admin</span>
//                       : r.exitGpsCheck ? ` / ${r.exitGpsCheck.distance} m` : ""}
//                   </td>
//                   <td className="py-2 pr-3"><Badge tone={r.status === "TERMINEE" ? "green" : "yellow"}>{r.status === "TERMINEE" ? "Terminée" : "En cours"}</Badge></td>
//                   {hasOpen && (
//                     <td className="py-2 pr-3 text-right">
//                       {r.status === "EN_COURS" && (
//                         <button onClick={() => openStop(r)}
//                           className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700">
//                           <Square className="w-3.5 h-3.5 fill-current" /> Arrêter
//                         </button>
//                       )}
//                     </td>
//                   )}
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         )}
//       </Card>

//       {showStart && (
//         <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
//           <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-5 shadow-2xl">
//             <div className="flex items-start justify-between">
//               <div>
//                 <h2 className="font-bold text-lg text-slate-900">Démarrer un pointage</h2>
//                 <p className="text-sm text-slate-500 mt-1">À distance, sans vérification de la localisation du salarié.</p>
//               </div>
//               <button onClick={() => setShowStart(false)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center">
//                 <X className="w-4 h-4" />
//               </button>
//             </div>
//             {available.length === 0 ? (
//               <p className="text-sm text-slate-500">Tous les salariés actifs ont déjà une entrée en cours.</p>
//             ) : (
//               <>
//                 <div>
//                   <label className="block text-xs font-semibold text-slate-600 mb-1.5">Salarié</label>
//                   <Dropdown value={pickedEmployee} onChange={pickEmployee} placeholder="Choisir un salarié"
//                     icon={<User className="w-4 h-4" />}
//                     options={available.map((e) => ({ value: e.employeeCode, label: `${employeeName(e)} (${e.employeeCode})` }))} />
//                 </div>
//                 <div>
//                   <label className="block text-xs font-semibold text-slate-600 mb-1.5">Département</label>
//                   <Dropdown value={pickedDept} onChange={setPickedDept} placeholder="Choisir un département"
//                     icon={<Building2 className="w-4 h-4" />} options={deptOptions} />
//                 </div>
//               </>
//             )}
//             <div className="flex gap-3">
//               <button onClick={() => setShowStart(false)} className="flex-1 border border-slate-200 text-slate-700 font-medium py-3 rounded-xl hover:bg-slate-50">Annuler</button>
//               <button onClick={handleStart} disabled={starting || !pickedEmployee || !pickedDept}
//                 className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl disabled:opacity-60">
//                 {starting ? "..." : "Démarrer"}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {stopping && (
//         <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
//           <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-5 shadow-2xl">
//             <div className="flex items-start justify-between gap-3">
//               <div>
//                 <h2 className="font-bold text-lg text-slate-900">Arrêter le pointage</h2>
//                 <p className="text-sm text-slate-500 mt-1">
//                   {nameFor(stopping)} — entrée le {fmtDateTime(stopping.entryTime)}.
//                   La sortie est enregistrée sans vérification de la localisation ; le salaire est calculé normalement.
//                 </p>
//               </div>
//               <button onClick={() => setStopping(null)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center shrink-0">
//                 <X className="w-4 h-4" />
//               </button>
//             </div>
//             <div>
//               <label className="block text-xs font-semibold text-slate-600 mb-1.5">Heure de sortie</label>
//               <input type="datetime-local" value={exitAt} onChange={(e) => setExitAt(e.target.value)}
//                 min={toLocalInput(new Date(stopping.entryTime))} max={toLocalInput(new Date())}
//                 className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none" />
//               {stopping.workDate !== todayKey() && (
//                 <p className="mt-1.5 text-xs text-amber-700">Session oubliée d'un jour précédent : indiquez l'heure réelle de départ du salarié.</p>
//               )}
//             </div>
//             <div className="flex gap-3">
//               <button onClick={() => setStopping(null)} className="flex-1 border border-slate-200 text-slate-700 font-medium py-3 rounded-xl hover:bg-slate-50">Annuler</button>
//               <button onClick={handleStop} disabled={stopBusy || !exitAt}
//                 className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold py-3 rounded-xl disabled:opacity-60">
//                 {stopBusy ? "..." : "Arrêter le pointage"}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {toast && <Toast message={toast.msg} tone={toast.tone} onClose={() => setToast(null)} />}
//     </div>
//   )
// }
