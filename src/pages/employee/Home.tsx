// src/pages/employee/Home.tsx
import { useEffect, useState } from "react"
import { useAuth } from "../../hooks/useAuth"
import { Link } from "react-router-dom"
import { useGeolocation } from "../../hooks/useGeolocation"
import {
  listMySessionsToday, currentSession, clockIn, clockOut, getMyBalance,
  GpsOutOfRangeError, type Attendance, type GpsCheck,
} from "../../services/attendance"
import { getSettings } from "../../services/settings"
import { getMyEmployee, type Employee } from "../../services/employees"
import { listWorkplaces, type Workplace } from "../../services/workplaces"
import { errorMessage } from "../../services/api"
import { calculateDailySalary, formatAriary, minutesToHoursLabel } from "../../utils/salaryCalculator"
import { fmtTime } from "../../utils/format"
import Card from "../../components/Card"
import Dropdown from "../../components/Dropdown"
import Toast from "../../components/Toast"
import { Play, Square, MapPin, Clock, Wallet, Building2, CheckCircle2, Radar } from "lucide-react"

export default function EmployeeHome() {
  const { appUser } = useAuth()
  const { capture, loading: gpsLoading, error: gpsError, clearError } = useGeolocation()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [departments, setDepartments] = useState<Workplace[]>([])
  const [attendance, setAttendance] = useState<Attendance | null>(null)
  const [sessions, setSessions] = useState<Attendance[]>([])
  const [balance, setBalance] = useState<number>(0)
  const [toast, setToast] = useState<string | null>(null)
  const [toastTone, setToastTone] = useState<"error" | "success">("success")
  const [now, setNow] = useState(new Date())

  const [showDeptPicker, setShowDeptPicker] = useState(false)
  const [pickedDeptId, setPickedDeptId] = useState("")
  const [punching, setPunching] = useState(false)
  const [settingsCache, setSettingsCache] = useState<{ normalWorkMinutes: number } | null>(null)

  function closeToast() { setToast(null); clearError() }

  async function refresh() {
    try {
      const [list, bal, emp] = await Promise.all([listMySessionsToday(), getMyBalance(), getMyEmployee()])
      setAttendance(currentSession(list))
      setSessions(list)
      setBalance(bal.earned)
      setEmployee(emp)
    } catch (e) {
      setToastTone("error")
      setToast(errorMessage(e, "Impossible de charger vos données."))
    }
  }

  useEffect(() => { if (appUser) refresh() }, [appUser?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    listWorkplaces().then(setDepartments).catch(() => {})
    getSettings().then((s) => setSettingsCache({ normalWorkMinutes: s.normalWorkMinutes })).catch(() => {})
  }, [])
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  const myDepartments = departments.filter((d) => employee?.departmentIds?.includes(d.id))

  function openDeptPicker() {
    if (myDepartments.length === 0) {
      setToastTone("error")
      setToast("Aucun département ne vous est affecté. Contactez votre administrateur.")
      return
    }
    setPickedDeptId(myDepartments[0].id)
    setShowDeptPicker(true)
  }

  function successMessage(label: string, gps: GpsCheck | null, departmentName: string) {
    return `${label} enregistrée — Département : ${departmentName}${gps ? ` · Distance : ${gps.distance} m` : ""}`
  }

  async function handleConfirmClockIn() {
    if (!pickedDeptId) return
    const department = departments.find((d) => d.id === pickedDeptId)
    if (!department) return
    setPunching(true)
    const loc = await capture()
    if (!loc) { setPunching(false); return }
    try {
      const { gpsCheck } = await clockIn(department.id, loc)
      setShowDeptPicker(false)
      await refresh()
      setToastTone("success")
      setToast(successMessage("Entrée", gpsCheck, department.name))
    } catch (e) {
      setToastTone("error")
      if (e instanceof GpsOutOfRangeError) {
        setToast(`Pointage refusé — ${e.message}`)
      } else {
        setToast(errorMessage(e, "Erreur lors du pointage."))
      }
    } finally {
      setPunching(false)
    }
  }

  // La sortie est contrôlée par le serveur sur le même département que l'entrée.
  async function handleClockOut() {
    if (!attendance || attendance.status !== "EN_COURS" || punching) return
    setPunching(true)
    const loc = await capture()
    if (!loc) { setPunching(false); return }
    try {
      const { gpsCheck } = await clockOut(loc)
      await refresh()
      setToastTone("success")
      setToast(successMessage("Sortie", gpsCheck, attendance.departmentName))
    } catch (e) {
      setToastTone("error")
      if (e instanceof GpsOutOfRangeError) {
        setToast(`Pointage refusé — ${e.message}`)
      } else {
        setToast(errorMessage(e, "Erreur lors du pointage."))
      }
    } finally {
      setPunching(false)
    }
  }

  const entryTime = attendance ? new Date(attendance.entryTime) : undefined
  const elapsedMinutes = entryTime && attendance?.status === "EN_COURS"
    ? Math.max(0, Math.round((now.getTime() - entryTime.getTime()) / 60000))
    : 0
  // Plusieurs sessions par jour : le plafond journalier s'applique au total du jour.
  const doneSessions = sessions.filter((x) => x.status === "TERMINEE")
  const doneMinutes = doneSessions.reduce((sum, x) => sum + x.workedMinutes, 0)
  const doneSalary = doneSessions.reduce((sum, x) => sum + x.dailySalary, 0)
  const salarySettings = employee
    ? { dailySalary: employee.baseDailySalary, normalWorkMinutes: settingsCache?.normalWorkMinutes ?? 8 * 60 }
    : undefined
  const liveSalary = attendance?.status === "EN_COURS"
    ? Math.max(0, calculateDailySalary(doneMinutes + elapsedMinutes, salarySettings) - calculateDailySalary(doneMinutes, salarySettings))
    : 0

  const greeting = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })

  if (employee?.contractType === "CDI") return <div className="space-y-4"><Card className="p-6 space-y-3"><div className="flex items-center gap-3"><div className="rounded-xl bg-primary-50 p-3 text-primary-700"><Clock className="h-6 w-6"/></div><div><h1 className="text-lg font-bold">Contrat CDI · forfait mensuel</h1><p className="text-sm text-slate-500">{formatAriary(employee.monthlySalary||0)} / mois</p></div></div><p className="text-sm text-slate-600">Votre contrat utilise la feuille de temps hebdomadaire. Le pointage direct Entrée / Sortie n’est pas activé pour les CDI.</p><Link to="/employe/timesheet" className="block rounded-xl bg-primary-600 px-4 py-3 text-center font-semibold text-white">Ouvrir mon Timesheet</Link><Link to="/employe/profil" className="block text-center text-sm text-primary-700">Voir mes lieux de travail et mon périmètre GPS</Link></Card></div>
  return (
    <div className="space-y-6">
      
      {/* En-tête */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 capitalize">
          Bonjour, {employee?.firstName ?? appUser?.employeeCode ?? ""} 👋
        </h1>
        <p className="text-sm text-slate-500 capitalize mt-0.5">{greeting}</p>
      </div>

      {/* Carte Solde Global */}
      <div className="bg-gradient-to-br from-primary-900 to-primary-800 text-white p-6 rounded-2xl shadow-md relative overflow-hidden flex items-center justify-between">
        <div className="relative z-10">
          <div className="text-xs uppercase tracking-wider font-semibold text-primary-200 mb-1">Mon solde cumulé</div>
          <div className="text-3xl font-extrabold">{formatAriary(balance)}</div>
        </div>
        <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center text-primary-200 relative z-10">
          <Wallet className="w-6 h-6" />
        </div>
        <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-primary-600/30 rounded-full blur-xl"></div>
      </div>

      {/* Carte principale de Pointage */}
      <Card className="p-6 border border-slate-200/80 shadow-sm rounded-2xl">
        {!attendance && (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <Clock className="w-8 h-8" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-800">Prêt à commencer ?</p>
              <p className="text-sm text-slate-500 mt-0.5">Aucun pointage actif pour aujourd'hui.</p>
            </div>
            <button
              onClick={openDeptPicker}
              disabled={gpsLoading || punching}
              className="w-full max-w-sm mx-auto bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3.5 rounded-xl transition shadow-lg shadow-primary-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>{gpsLoading ? "Localisation GPS..." : "POINTAGE ENTRÉE"}</span>
            </button>
          </div>
        )}

        {attendance?.status === "EN_COURS" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
                <span className="text-emerald-700 font-bold text-sm uppercase tracking-wide">Entrée Enregistrée</span>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg">
                En poste
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm">
              <div>
                <span className="text-slate-400 block text-xs">Heure d'arrivée</span>
                <span className="font-bold text-slate-800 text-base">{fmtTime(attendance.entryTime)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-xs">Temps écoulé</span>
                <span className="font-bold text-primary-600 text-base">{minutesToHoursLabel(elapsedMinutes)}</span>
              </div>
            </div>

            <div className="space-y-2 text-sm text-slate-600">
              <p className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Département : <strong className="text-slate-800">{attendance.departmentName}</strong></span>
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{attendance.entrySource === "ADMIN" ? "Pointage démarré par l'administrateur" : attendance.entryLocation?.address ?? "Position GPS validée"}</span>
              </p>
              {attendance.siteName && (
                <p className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Chantier : <strong className="text-slate-800">{attendance.siteName}</strong></span>
                </p>
              )}
              <p className="flex items-start gap-2 text-xs text-slate-500">
                <Radar className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Pendant votre pointage, votre position est vérifiée régulièrement par rapport à la zone du lieu de travail. Gardez l'application ouverte et la localisation activée.</span>
              </p>
              <p className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-slate-500">Salaire estimé en direct :</span>
                <strong className="text-slate-900 text-base">{formatAriary(liveSalary)}</strong>
              </p>
            </div>

            <button
              onClick={handleClockOut}
              disabled={gpsLoading || punching}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-3.5 rounded-xl transition shadow-lg shadow-rose-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <Square className="w-5 h-5 fill-current" />
              <span>{gpsLoading ? "Localisation GPS..." : "POINTAGE SORTIE"}</span>
            </button>
          </div>
        )}

        {attendance?.status === "TERMINEE" && (
          <div className="text-center py-6 space-y-4">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <p className="text-emerald-700 font-bold text-sm">Session terminée 🎉</p>
              <p className="text-xs text-slate-400 mt-1">Vous pouvez démarrer un nouveau pointage à tout moment.</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm space-y-2 text-left">
              <div className="flex justify-between">
                <span className="text-slate-500">Département :</span>
                <span className="font-semibold text-slate-800">{attendance.departmentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Heure de sortie :</span>
                <span className="font-semibold text-slate-800">{fmtTime(attendance.exitTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Temps travaillé :</span>
                <span className="font-semibold text-primary-600">{minutesToHoursLabel(attendance.workedMinutes)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200">
                <span className="text-slate-500">Total du jour ({doneSessions.length} session{doneSessions.length > 1 ? "s" : ""}) :</span>
                <span className="font-bold text-slate-900">{minutesToHoursLabel(doneMinutes)} · {formatAriary(doneSalary)}</span>
              </div>
            </div>
            <button
              onClick={openDeptPicker}
              disabled={gpsLoading || punching}
              className="w-full max-w-sm mx-auto bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3.5 rounded-xl transition shadow-lg shadow-primary-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>NOUVEAU POINTAGE ENTRÉE</span>
            </button>
          </div>
        )}
      </Card>

      {/* Sélection du département (z-index maximal) */}
      {showDeptPicker && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-5 shadow-2xl animate-fade-in-up">
            <div>
              <h2 className="font-bold text-lg text-slate-900">Département du jour</h2>
              <p className="text-sm text-slate-500 mt-1">
                Sélectionnez le lieu où vous effectuez votre pointage.
              </p>
            </div>
            <Dropdown
              value={pickedDeptId}
              onChange={setPickedDeptId}
              options={myDepartments.map((d) => ({ value: d.id, label: d.name }))}
              placeholder="Choisir un département"
              icon={<Building2 className="w-4 h-4" />}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeptPicker(false)}
                className="flex-1 border border-slate-200 text-slate-700 font-medium py-3 rounded-xl hover:bg-slate-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmClockIn}
                disabled={punching || gpsLoading}
                className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl shadow-md disabled:opacity-60 transition"
              >
                {punching || gpsLoading ? "GPS..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {(gpsError || toast) && (
        <Toast message={gpsError ?? toast ?? ""} tone={gpsError ? "error" : toastTone} onClose={closeToast} />
      )}
    </div>
  )
}

// // src/pages/employee/Home.tsx
// import { useEffect, useState } from "react"
// import { useAuth } from "../../hooks/useAuth"
// import { useGeolocation } from "../../hooks/useGeolocation"
// import {
//   listMySessionsToday, currentSession, clockIn, clockOut, getMyBalance,
//   GpsOutOfRangeError, type Attendance, type GpsCheck,
// } from "../../services/attendance"
// import { getSettings } from "../../services/settings"
// import { getMyEmployee, type Employee } from "../../services/employees"
// import { listWorkplaces, type Workplace } from "../../services/workplaces"
// import { errorMessage } from "../../services/api"
// import { calculateDailySalary, formatAriary, minutesToHoursLabel } from "../../utils/salaryCalculator"
// import { fmtTime } from "../../utils/format"
// import Card from "../../components/Card"
// import Dropdown from "../../components/Dropdown"
// import Toast from "../../components/Toast"
// import { Play, Square, MapPin, Clock, Wallet, Building2, CheckCircle2, Radar } from "lucide-react"

// export default function EmployeeHome() {
//   const { appUser } = useAuth()
//   const { capture, loading: gpsLoading, error: gpsError, clearError } = useGeolocation()
//   const [employee, setEmployee] = useState<Employee | null>(null)
//   const [departments, setDepartments] = useState<Workplace[]>([])
//   const [employeeLoading, setEmployeeLoading] = useState(true)
//   const [departmentsLoading, setDepartmentsLoading] = useState(true)
//   const [departmentLoadError, setDepartmentLoadError] = useState<string | null>(null)
//   const [attendance, setAttendance] = useState<Attendance | null>(null)
//   const [sessions, setSessions] = useState<Attendance[]>([])
//   const [balance, setBalance] = useState<number>(0)
//   const [toast, setToast] = useState<string | null>(null)
//   const [toastTone, setToastTone] = useState<"error" | "success">("success")
//   const [now, setNow] = useState(new Date())

//   const [showDeptPicker, setShowDeptPicker] = useState(false)
//   const [pickedDeptId, setPickedDeptId] = useState("")
//   const [punching, setPunching] = useState(false)
//   const [settingsCache, setSettingsCache] = useState<{ normalWorkMinutes: number } | null>(null)

//   function closeToast() { setToast(null); clearError() }

//   async function refresh() {
//     try {
//       const [list, bal, emp] = await Promise.all([listMySessionsToday(), getMyBalance(), getMyEmployee()])
//       setAttendance(currentSession(list))
//       setSessions(list)
//       setBalance(bal.earned)
//       setEmployee(emp)
//     } catch (e) {
//       setToastTone("error")
//       setToast(errorMessage(e, "Impossible de charger vos données."))
//     } finally {
//       setEmployeeLoading(false)
//     }
//   }

//   useEffect(() => {
//     if (!appUser) return
//     setEmployeeLoading(true)
//     void refresh()
//   }, [appUser?.id]) // eslint-disable-line react-hooks/exhaustive-deps
//   useEffect(() => {
//     if (!appUser) return
//     const refreshOnResume = () => {
//       if (document.visibilityState === "visible") void refresh()
//     }
//     window.addEventListener("focus", refreshOnResume)
//     document.addEventListener("visibilitychange", refreshOnResume)
//     return () => {
//       window.removeEventListener("focus", refreshOnResume)
//       document.removeEventListener("visibilitychange", refreshOnResume)
//     }
//   }, [appUser?.id]) // eslint-disable-line react-hooks/exhaustive-deps
//   useEffect(() => {
//     let active = true
//     setDepartmentsLoading(true)
//     listWorkplaces()
//       .then((items) => { if (active) setDepartments(items) })
//       .catch((e) => {
//         if (!active) return
//         const message = errorMessage(e, "Impossible de charger la liste des lieux de travail.")
//         setDepartmentLoadError(message)
//         setToastTone("error")
//         setToast(message)
//       })
//       .finally(() => { if (active) setDepartmentsLoading(false) })
//     getSettings().then((s) => setSettingsCache({ normalWorkMinutes: s.normalWorkMinutes })).catch(() => {})
//     return () => { active = false }
//   }, [])
//   useEffect(() => {
//     const t = setInterval(() => setNow(new Date()), 30000)
//     return () => clearInterval(t)
//   }, [])

//   const myDepartments = departments.filter((d) => employee?.departmentIds?.includes(d.id))

//   function openDeptPicker() {
//     if (employeeLoading || departmentsLoading) {
//       setToastTone("error")
//       setToast("Chargement de votre fiche et des lieux de travail. Réessayez dans un instant.")
//       return
//     }
//     if (departmentLoadError) {
//       setToastTone("error")
//       setToast(departmentLoadError)
//       return
//     }
//     if (!employee) {
//       setToastTone("error")
//       setToast("Impossible de charger votre fiche salarié. Déconnectez-vous puis reconnectez-vous.")
//       return
//     }
//     if (myDepartments.length === 0) {
//       setToastTone("error")
//       setToast(!employee.departmentIds?.length
//         ? "Aucun lieu de travail n’est associé à votre compte. Demandez à l’administrateur de vous affecter à un département."
//         : "Vos lieux affectés ne sont pas disponibles dans la liste. Demandez à l’administrateur de vérifier les affectations.")
//       return
//     }
//     setPickedDeptId(myDepartments[0].id)
//     setShowDeptPicker(true)
//   }

//   function successMessage(label: string, gps: GpsCheck | null, departmentName: string) {
//     return `${label} enregistrée — Département : ${departmentName}${gps ? ` · Distance : ${gps.distance} m` : ""}`
//   }

//   async function handleConfirmClockIn() {
//     if (!pickedDeptId) return
//     const department = departments.find((d) => d.id === pickedDeptId)
//     if (!department) return
//     setPunching(true)
//     const loc = await capture()
//     if (!loc) { setPunching(false); return }
//     try {
//       const { gpsCheck } = await clockIn(department.id, loc)
//       setShowDeptPicker(false)
//       await refresh()
//       setToastTone("success")
//       setToast(successMessage("Entrée", gpsCheck, department.name))
//     } catch (e) {
//       setToastTone("error")
//       if (e instanceof GpsOutOfRangeError) {
//         setToast(`Pointage refusé — ${e.message}`)
//       } else {
//         setToast(errorMessage(e, "Erreur lors du pointage."))
//       }
//     } finally {
//       setPunching(false)
//     }
//   }

//   // La sortie est contrôlée par le serveur sur le même département que l'entrée.
//   async function handleClockOut() {
//     if (!attendance || attendance.status !== "EN_COURS" || punching) return
//     setPunching(true)
//     const loc = await capture()
//     if (!loc) { setPunching(false); return }
//     try {
//       const { gpsCheck } = await clockOut(loc)
//       await refresh()
//       setToastTone("success")
//       setToast(successMessage("Sortie", gpsCheck, attendance.departmentName))
//     } catch (e) {
//       setToastTone("error")
//       if (e instanceof GpsOutOfRangeError) {
//         setToast(`Pointage refusé — ${e.message}`)
//       } else {
//         setToast(errorMessage(e, "Erreur lors du pointage."))
//       }
//     } finally {
//       setPunching(false)
//     }
//   }

//   const entryTime = attendance ? new Date(attendance.entryTime) : undefined
//   const elapsedMinutes = entryTime && attendance?.status === "EN_COURS"
//     ? Math.max(0, Math.round((now.getTime() - entryTime.getTime()) / 60000))
//     : 0
//   // Plusieurs sessions par jour : le plafond journalier s'applique au total du jour.
//   const doneSessions = sessions.filter((x) => x.status === "TERMINEE")
//   const doneMinutes = doneSessions.reduce((sum, x) => sum + x.workedMinutes, 0)
//   const doneSalary = doneSessions.reduce((sum, x) => sum + x.dailySalary, 0)
//   const salarySettings = employee
//     ? { dailySalary: employee.baseDailySalary, normalWorkMinutes: settingsCache?.normalWorkMinutes ?? 8 * 60 }
//     : undefined
//   const liveSalary = attendance?.status === "EN_COURS"
//     ? Math.max(0, calculateDailySalary(doneMinutes + elapsedMinutes, salarySettings) - calculateDailySalary(doneMinutes, salarySettings))
//     : 0

//   const greeting = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
//   const todayDateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
//   const attendanceFromPreviousDay = Boolean(attendance?.status === "EN_COURS" && attendance.workDate < todayDateKey)
//   const previousAttendanceDate = attendanceFromPreviousDay && attendance
//     ? new Date(`${attendance.workDate}T12:00:00`).toLocaleDateString("fr-FR")
//     : ""

//   return (
//     <div className="space-y-6">
      
//       {/* En-tête */}
//       <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
//         <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 capitalize">
//           Bonjour, {employee?.firstName ?? appUser?.employeeCode ?? ""}
//         </h1>
//         <p className="text-sm text-slate-500 capitalize mt-0.5">{greeting}</p>
//       </div>

//       {/* Carte Solde Global */}
//       <div className="bg-gradient-to-br from-primary-900 to-primary-800 text-white p-6 rounded-2xl shadow-md relative overflow-hidden flex items-center justify-between">
//         <div className="relative z-10">
//           <div className="text-xs uppercase tracking-wider font-semibold text-primary-200 mb-1">Mon solde cumulé</div>
//           <div className="text-3xl font-extrabold">{formatAriary(balance)}</div>
//         </div>
//         <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center text-primary-200 relative z-10">
//           <Wallet className="w-6 h-6" />
//         </div>
//         <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-primary-600/30 rounded-full blur-xl"></div>
//       </div>

//       {/* Carte principale de Pointage */}
//       <Card className="p-6 border border-slate-200/80 shadow-sm rounded-2xl">
//         {!attendance && (
//           <div className="text-center py-8 space-y-4">
//             <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
//               <Clock className="w-8 h-8" />
//             </div>
//             <div>
//               <p className="text-base font-bold text-slate-800">Prêt à commencer ?</p>
//               <p className="text-sm text-slate-500 mt-0.5">Aucun pointage actif pour aujourd'hui.</p>
//             </div>
//             <button
//               onClick={openDeptPicker}
//               disabled={gpsLoading || punching || employeeLoading || departmentsLoading}
//               className="w-full max-w-sm mx-auto bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3.5 rounded-xl transition shadow-lg shadow-primary-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
//             >
//               <Play className="w-5 h-5 fill-current" />
//               <span>{gpsLoading ? "Localisation GPS..." : employeeLoading || departmentsLoading ? "Chargement des lieux..." : "POINTAGE ENTRÉE"}</span>
//             </button>
//           </div>
//         )}

//         {attendance?.status === "EN_COURS" && (
//           <div className="space-y-5">
//             <div className="flex items-center justify-between border-b border-slate-100 pb-4">
//               <div className="flex items-center gap-2">
//                 <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
//                 <span className={`font-bold text-sm uppercase tracking-wide ${attendanceFromPreviousDay ? "text-amber-700" : "text-emerald-700"}`}>
//                   {attendanceFromPreviousDay ? "Pointage précédent à clôturer" : "Entrée Enregistrée"}
//                 </span>
//               </div>
//               <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${attendanceFromPreviousDay ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
//                 {attendanceFromPreviousDay ? "À régulariser" : "En poste"}
//               </span>
//             </div>

//             <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm">
//               <div>
//                 <span className="text-slate-400 block text-xs">Heure d'arrivée</span>
//                 <span className="font-bold text-slate-800 text-base">{fmtTime(attendance.entryTime)}</span>
//               </div>
//               <div>
//                 <span className="text-slate-400 block text-xs">{attendanceFromPreviousDay ? "Pointage commencé le" : "Temps écoulé"}</span>
//                 <span className="font-bold text-primary-600 text-base">
//                   {attendanceFromPreviousDay ? previousAttendanceDate : minutesToHoursLabel(elapsedMinutes)}
//                 </span>
//               </div>
//             </div>

//             <div className="space-y-2 text-sm text-slate-600">
//               <p className="flex items-center gap-2">
//                 <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
//                 <span>Département : <strong className="text-slate-800">{attendance.departmentName}</strong></span>
//               </p>
//               <p className="flex items-center gap-2">
//                 <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
//                 <span>{attendance.entrySource === "ADMIN" ? "Pointage démarré par l'administrateur" : attendance.entryLocation?.address ?? "Position GPS validée"}</span>
//               </p>
//               {attendance.siteName && (
//                 <p className="flex items-center gap-2">
//                   <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
//                   <span>Chantier : <strong className="text-slate-800">{attendance.siteName}</strong></span>
//                 </p>
//               )}
//               <p className="flex items-start gap-2 text-xs text-slate-500">
//                 <Radar className="w-4 h-4 text-slate-400 shrink-0" />
//                 <span>Pendant votre pointage, votre position est vérifiée régulièrement par rapport à la zone du lieu de travail. Gardez l'application ouverte et la localisation activée.</span>
//               </p>
//               {attendanceFromPreviousDay ? (
//                 <p className="pt-2 border-t border-amber-100 text-xs text-amber-700">
//                   Ce pointage est resté ouvert depuis la veille. Clôturez-le pour régulariser la durée; la pause de midi est exclue du calcul.
//                 </p>
//               ) : (
//                 <p className="flex items-center justify-between pt-2 border-t border-slate-100">
//                   <span className="text-slate-500">Salaire estimé en direct :</span>
//                   <strong className="text-slate-900 text-base">{formatAriary(liveSalary)}</strong>
//                 </p>
//               )}
//             </div>

//             <button
//               onClick={handleClockOut}
//               disabled={gpsLoading || punching}
//               className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-3.5 rounded-xl transition shadow-lg shadow-rose-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
//             >
//               <Square className="w-5 h-5 fill-current" />
//               <span>{gpsLoading ? "Localisation GPS..." : attendanceFromPreviousDay ? "CLÔTURER LE POINTAGE OUBLIÉ" : "POINTAGE SORTIE"}</span>
//             </button>
//           </div>
//         )}

//         {attendance?.status === "TERMINEE" && (
//           <div className="text-center py-6 space-y-4">
//             <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
//               <CheckCircle2 className="w-7 h-7" />
//             </div>
//             <div>
//               <p className="text-emerald-700 font-bold text-sm">Session terminée 🎉</p>
//               <p className="text-xs text-slate-400 mt-1">Vous pouvez démarrer un nouveau pointage à tout moment.</p>
//             </div>
//             <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm space-y-2 text-left">
//               <div className="flex justify-between">
//                 <span className="text-slate-500">Département :</span>
//                 <span className="font-semibold text-slate-800">{attendance.departmentName}</span>
//               </div>
//               <div className="flex justify-between">
//                 <span className="text-slate-500">Heure de sortie :</span>
//                 <span className="font-semibold text-slate-800">{fmtTime(attendance.exitTime)}</span>
//               </div>
//               <div className="flex justify-between">
//                 <span className="text-slate-500">Temps travaillé :</span>
//                 <span className="font-semibold text-primary-600">{minutesToHoursLabel(attendance.workedMinutes)}</span>
//               </div>
//               <div className="flex justify-between pt-2 border-t border-slate-200">
//                 <span className="text-slate-500">Total du jour ({doneSessions.length} session{doneSessions.length > 1 ? "s" : ""}) :</span>
//                 <span className="font-bold text-slate-900">{minutesToHoursLabel(doneMinutes)} · {formatAriary(doneSalary)}</span>
//               </div>
//             </div>
//             <button
//               onClick={openDeptPicker}
//               disabled={gpsLoading || punching || employeeLoading || departmentsLoading}
//               className="w-full max-w-sm mx-auto bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3.5 rounded-xl transition shadow-lg shadow-primary-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
//             >
//               <Play className="w-5 h-5 fill-current" />
//               <span>{employeeLoading || departmentsLoading ? "Chargement des lieux..." : "NOUVEAU POINTAGE ENTRÉE"}</span>
//             </button>
//           </div>
//         )}
//       </Card>

//       {/* Sélection du département (z-index maximal) */}
//       {showDeptPicker && (
//         <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
//           <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-5 shadow-2xl animate-fade-in-up">
//             <div>
//               <h2 className="font-bold text-lg text-slate-900">Département du jour</h2>
//               <p className="text-sm text-slate-500 mt-1">
//                 Sélectionnez le lieu où vous effectuez votre pointage.
//               </p>
//             </div>
//             <Dropdown
//               value={pickedDeptId}
//               onChange={setPickedDeptId}
//               options={myDepartments.map((d) => ({ value: d.id, label: d.name }))}
//               placeholder="Choisir un département"
//               icon={<Building2 className="w-4 h-4" />}
//             />
//             <div className="flex gap-3">
//               <button
//                 onClick={() => setShowDeptPicker(false)}
//                 className="flex-1 border border-slate-200 text-slate-700 font-medium py-3 rounded-xl hover:bg-slate-50 transition"
//               >
//                 Annuler
//               </button>
//               <button
//                 onClick={handleConfirmClockIn}
//                 disabled={punching || gpsLoading}
//                 className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl shadow-md disabled:opacity-60 transition"
//               >
//                 {punching || gpsLoading ? "GPS..." : "Confirmer"}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {(gpsError || toast) && (
//         <Toast message={gpsError ?? toast ?? ""} tone={gpsError ? "error" : toastTone} onClose={closeToast} />
//       )}
//     </div>
//   )
// }



// // // src/pages/employee/Home.tsx
// // import { useEffect, useState } from "react"
// // import { useAuth } from "../../hooks/useAuth"
// // import { useGeolocation } from "../../hooks/useGeolocation"
// // import {
// //   listMySessionsToday, currentSession, clockIn, clockOut, getMyBalance,
// //   GpsOutOfRangeError, type Attendance, type GpsCheck,
// // } from "../../services/attendance"
// // import { getSettings } from "../../services/settings"
// // import { getMyEmployee, type Employee } from "../../services/employees"
// // import { listWorkplaces, type Workplace } from "../../services/workplaces"
// // import { errorMessage } from "../../services/api"
// // import { calculateDailySalary, formatAriary, minutesToHoursLabel } from "../../utils/salaryCalculator"
// // import { fmtTime } from "../../utils/format"
// // import Card from "../../components/Card"
// // import Dropdown from "../../components/Dropdown"
// // import Toast from "../../components/Toast"
// // import { Play, Square, MapPin, Clock, Wallet, Building2, CheckCircle2, Radar } from "lucide-react"

// // export default function EmployeeHome() {
// //   const { appUser } = useAuth()
// //   const { capture, loading: gpsLoading, error: gpsError, clearError } = useGeolocation()
// //   const [employee, setEmployee] = useState<Employee | null>(null)
// //   const [departments, setDepartments] = useState<Workplace[]>([])
// //   const [attendance, setAttendance] = useState<Attendance | null>(null)
// //   const [sessions, setSessions] = useState<Attendance[]>([])
// //   const [balance, setBalance] = useState<number>(0)
// //   const [toast, setToast] = useState<string | null>(null)
// //   const [toastTone, setToastTone] = useState<"error" | "success">("success")
// //   const [now, setNow] = useState(new Date())

// //   const [showDeptPicker, setShowDeptPicker] = useState(false)
// //   const [pickedDeptId, setPickedDeptId] = useState("")
// //   const [punching, setPunching] = useState(false)
// //   const [settingsCache, setSettingsCache] = useState<{ normalWorkMinutes: number } | null>(null)

// //   function closeToast() { setToast(null); clearError() }

// //   async function refresh() {
// //     try {
// //       const [list, bal, emp] = await Promise.all([listMySessionsToday(), getMyBalance(), getMyEmployee()])
// //       setAttendance(currentSession(list))
// //       setSessions(list)
// //       setBalance(bal.earned)
// //       setEmployee(emp)
// //     } catch (e) {
// //       setToastTone("error")
// //       setToast(errorMessage(e, "Impossible de charger vos données."))
// //     }
// //   }

// //   useEffect(() => { if (appUser) refresh() }, [appUser?.id]) // eslint-disable-line react-hooks/exhaustive-deps
// //   useEffect(() => {
// //     listWorkplaces().then(setDepartments).catch(() => {})
// //     getSettings().then((s) => setSettingsCache({ normalWorkMinutes: s.normalWorkMinutes })).catch(() => {})
// //   }, [])
// //   useEffect(() => {
// //     const t = setInterval(() => setNow(new Date()), 30000)
// //     return () => clearInterval(t)
// //   }, [])

// //   const myDepartments = departments.filter((d) => employee?.departmentIds?.includes(d.id))

// //   function openDeptPicker() {
// //     if (myDepartments.length === 0) {
// //       setToastTone("error")
// //       setToast("Aucun département ne vous est affecté. Contactez votre administrateur.")
// //       return
// //     }
// //     setPickedDeptId(myDepartments[0].id)
// //     setShowDeptPicker(true)
// //   }

// //   function successMessage(label: string, gps: GpsCheck | null, departmentName: string) {
// //     return `${label} enregistrée — Département : ${departmentName}${gps ? ` · Distance : ${gps.distance} m` : ""}`
// //   }

// //   async function handleConfirmClockIn() {
// //     if (!pickedDeptId) return
// //     const department = departments.find((d) => d.id === pickedDeptId)
// //     if (!department) return
// //     setPunching(true)
// //     const loc = await capture()
// //     if (!loc) { setPunching(false); return }
// //     try {
// //       const { gpsCheck } = await clockIn(department.id, loc)
// //       setShowDeptPicker(false)
// //       await refresh()
// //       setToastTone("success")
// //       setToast(successMessage("Entrée", gpsCheck, department.name))
// //     } catch (e) {
// //       setToastTone("error")
// //       if (e instanceof GpsOutOfRangeError) {
// //         setToast(`Pointage refusé — ${e.message}`)
// //       } else {
// //         setToast(errorMessage(e, "Erreur lors du pointage."))
// //       }
// //     } finally {
// //       setPunching(false)
// //     }
// //   }

// //   // La sortie est contrôlée par le serveur sur le même département que l'entrée.
// //   async function handleClockOut() {
// //     if (!attendance || attendance.status !== "EN_COURS" || punching) return
// //     setPunching(true)
// //     const loc = await capture()
// //     if (!loc) { setPunching(false); return }
// //     try {
// //       const { gpsCheck } = await clockOut(loc)
// //       await refresh()
// //       setToastTone("success")
// //       setToast(successMessage("Sortie", gpsCheck, attendance.departmentName))
// //     } catch (e) {
// //       setToastTone("error")
// //       if (e instanceof GpsOutOfRangeError) {
// //         setToast(`Pointage refusé — ${e.message}`)
// //       } else {
// //         setToast(errorMessage(e, "Erreur lors du pointage."))
// //       }
// //     } finally {
// //       setPunching(false)
// //     }
// //   }

// //   const entryTime = attendance ? new Date(attendance.entryTime) : undefined
// //   const elapsedMinutes = entryTime && attendance?.status === "EN_COURS"
// //     ? Math.max(0, Math.round((now.getTime() - entryTime.getTime()) / 60000))
// //     : 0
// //   // Plusieurs sessions par jour : le plafond journalier s'applique au total du jour.
// //   const doneSessions = sessions.filter((x) => x.status === "TERMINEE")
// //   const doneMinutes = doneSessions.reduce((sum, x) => sum + x.workedMinutes, 0)
// //   const doneSalary = doneSessions.reduce((sum, x) => sum + x.dailySalary, 0)
// //   const salarySettings = employee
// //     ? { dailySalary: employee.baseDailySalary, normalWorkMinutes: settingsCache?.normalWorkMinutes ?? 8 * 60 }
// //     : undefined
// //   const liveSalary = attendance?.status === "EN_COURS"
// //     ? Math.max(0, calculateDailySalary(doneMinutes + elapsedMinutes, salarySettings) - calculateDailySalary(doneMinutes, salarySettings))
// //     : 0

// //   const greeting = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })

// //   return (
// //     <div className="space-y-6">
      
// //       {/* En-tête */}
// //       <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
// //         <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 capitalize">
// //           Bonjour, {employee?.firstName ?? appUser?.employeeCode ?? ""}
// //         </h1>
// //         <p className="text-sm text-slate-500 capitalize mt-0.5">{greeting}</p>
// //       </div>

// //       {/* Carte Solde Global */}
// //       <div className="bg-gradient-to-br from-primary-900 to-primary-800 text-white p-6 rounded-2xl shadow-md relative overflow-hidden flex items-center justify-between">
// //         <div className="relative z-10">
// //           <div className="text-xs uppercase tracking-wider font-semibold text-primary-200 mb-1">Mon solde cumulé</div>
// //           <div className="text-3xl font-extrabold">{formatAriary(balance)}</div>
// //         </div>
// //         <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center text-primary-200 relative z-10">
// //           <Wallet className="w-6 h-6" />
// //         </div>
// //         <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-primary-600/30 rounded-full blur-xl"></div>
// //       </div>

// //       {/* Carte principale de Pointage */}
// //       <Card className="p-6 border border-slate-200/80 shadow-sm rounded-2xl">
// //         {!attendance && (
// //           <div className="text-center py-8 space-y-4">
// //             <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
// //               <Clock className="w-8 h-8" />
// //             </div>
// //             <div>
// //               <p className="text-base font-bold text-slate-800">Prêt à commencer ?</p>
// //               <p className="text-sm text-slate-500 mt-0.5">Aucun pointage actif pour aujourd'hui.</p>
// //             </div>
// //             <button
// //               onClick={openDeptPicker}
// //               disabled={gpsLoading || punching}
// //               className="w-full max-w-sm mx-auto bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3.5 rounded-xl transition shadow-lg shadow-primary-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
// //             >
// //               <Play className="w-5 h-5 fill-current" />
// //               <span>{gpsLoading ? "Localisation GPS..." : "POINTAGE ENTRÉE"}</span>
// //             </button>
// //           </div>
// //         )}

// //         {attendance?.status === "EN_COURS" && (
// //           <div className="space-y-5">
// //             <div className="flex items-center justify-between border-b border-slate-100 pb-4">
// //               <div className="flex items-center gap-2">
// //                 <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
// //                 <span className="text-emerald-700 font-bold text-sm uppercase tracking-wide">Entrée Enregistrée</span>
// //               </div>
// //               <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg">
// //                 En poste
// //               </span>
// //             </div>

// //             <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm">
// //               <div>
// //                 <span className="text-slate-400 block text-xs">Heure d'arrivée</span>
// //                 <span className="font-bold text-slate-800 text-base">{fmtTime(attendance.entryTime)}</span>
// //               </div>
// //               <div>
// //                 <span className="text-slate-400 block text-xs">Temps écoulé</span>
// //                 <span className="font-bold text-primary-600 text-base">{minutesToHoursLabel(elapsedMinutes)}</span>
// //               </div>
// //             </div>

// //             <div className="space-y-2 text-sm text-slate-600">
// //               <p className="flex items-center gap-2">
// //                 <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
// //                 <span>Département : <strong className="text-slate-800">{attendance.departmentName}</strong></span>
// //               </p>
// //               <p className="flex items-center gap-2">
// //                 <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
// //                 <span>{attendance.entrySource === "ADMIN" ? "Pointage démarré par l'administrateur" : attendance.entryLocation?.address ?? "Position GPS validée"}</span>
// //               </p>
// //               {attendance.siteName && (
// //                 <p className="flex items-center gap-2">
// //                   <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
// //                   <span>Chantier : <strong className="text-slate-800">{attendance.siteName}</strong></span>
// //                 </p>
// //               )}
// //               <p className="flex items-start gap-2 text-xs text-slate-500">
// //                 <Radar className="w-4 h-4 text-slate-400 shrink-0" />
// //                 <span>Pendant votre pointage, votre position est vérifiée régulièrement par rapport à la zone du lieu de travail. Gardez l'application ouverte et la localisation activée.</span>
// //               </p>
// //               <p className="flex items-center justify-between pt-2 border-t border-slate-100">
// //                 <span className="text-slate-500">Salaire estimé en direct :</span>
// //                 <strong className="text-slate-900 text-base">{formatAriary(liveSalary)}</strong>
// //               </p>
// //             </div>

// //             <button
// //               onClick={handleClockOut}
// //               disabled={gpsLoading || punching}
// //               className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-3.5 rounded-xl transition shadow-lg shadow-rose-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
// //             >
// //               <Square className="w-5 h-5 fill-current" />
// //               <span>{gpsLoading ? "Localisation GPS..." : "POINTAGE SORTIE"}</span>
// //             </button>
// //           </div>
// //         )}

// //         {attendance?.status === "TERMINEE" && (
// //           <div className="text-center py-6 space-y-4">
// //             <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
// //               <CheckCircle2 className="w-7 h-7" />
// //             </div>
// //             <div>
// //               <p className="text-emerald-700 font-bold text-sm">Session terminée 🎉</p>
// //               <p className="text-xs text-slate-400 mt-1">Vous pouvez démarrer un nouveau pointage à tout moment.</p>
// //             </div>
// //             <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm space-y-2 text-left">
// //               <div className="flex justify-between">
// //                 <span className="text-slate-500">Département :</span>
// //                 <span className="font-semibold text-slate-800">{attendance.departmentName}</span>
// //               </div>
// //               <div className="flex justify-between">
// //                 <span className="text-slate-500">Heure de sortie :</span>
// //                 <span className="font-semibold text-slate-800">{fmtTime(attendance.exitTime)}</span>
// //               </div>
// //               <div className="flex justify-between">
// //                 <span className="text-slate-500">Temps travaillé :</span>
// //                 <span className="font-semibold text-primary-600">{minutesToHoursLabel(attendance.workedMinutes)}</span>
// //               </div>
// //               <div className="flex justify-between pt-2 border-t border-slate-200">
// //                 <span className="text-slate-500">Total du jour ({doneSessions.length} session{doneSessions.length > 1 ? "s" : ""}) :</span>
// //                 <span className="font-bold text-slate-900">{minutesToHoursLabel(doneMinutes)} · {formatAriary(doneSalary)}</span>
// //               </div>
// //             </div>
// //             <button
// //               onClick={openDeptPicker}
// //               disabled={gpsLoading || punching}
// //               className="w-full max-w-sm mx-auto bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3.5 rounded-xl transition shadow-lg shadow-primary-600/20 disabled:opacity-60 flex items-center justify-center gap-2"
// //             >
// //               <Play className="w-5 h-5 fill-current" />
// //               <span>NOUVEAU POINTAGE ENTRÉE</span>
// //             </button>
// //           </div>
// //         )}
// //       </Card>

// //       {/* Sélection du département (z-index maximal) */}
// //       {showDeptPicker && (
// //         <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
// //           <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-5 shadow-2xl animate-fade-in-up">
// //             <div>
// //               <h2 className="font-bold text-lg text-slate-900">Département du jour</h2>
// //               <p className="text-sm text-slate-500 mt-1">
// //                 Sélectionnez le lieu où vous effectuez votre pointage.
// //               </p>
// //             </div>
// //             <Dropdown
// //               value={pickedDeptId}
// //               onChange={setPickedDeptId}
// //               options={myDepartments.map((d) => ({ value: d.id, label: d.name }))}
// //               placeholder="Choisir un département"
// //               icon={<Building2 className="w-4 h-4" />}
// //             />
// //             <div className="flex gap-3">
// //               <button
// //                 onClick={() => setShowDeptPicker(false)}
// //                 className="flex-1 border border-slate-200 text-slate-700 font-medium py-3 rounded-xl hover:bg-slate-50 transition"
// //               >
// //                 Annuler
// //               </button>
// //               <button
// //                 onClick={handleConfirmClockIn}
// //                 disabled={punching || gpsLoading}
// //                 className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl shadow-md disabled:opacity-60 transition"
// //               >
// //                 {punching || gpsLoading ? "GPS..." : "Confirmer"}
// //               </button>
// //             </div>
// //           </div>
// //         </div>
// //       )}

// //       {(gpsError || toast) && (
// //         <Toast message={gpsError ?? toast ?? ""} tone={gpsError ? "error" : toastTone} onClose={closeToast} />
// //       )}
// //     </div>
// //   )
// // }
