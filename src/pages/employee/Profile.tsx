// src/pages/employee/Profile.tsx
import { useEffect, useState } from "react"
import { useAuth } from "../../hooks/useAuth"
import { getMyEmployee, type Employee } from "../../services/employees"
import { listWorkplaces, type Workplace } from "../../services/workplaces"
import { formatAriary } from "../../utils/salaryCalculator"
import { fmtDay } from "../../utils/format"
import ThemeToggle from "../../components/ThemeToggle"
import Card from "../../components/Card"
import { User, Briefcase, Building, Mail, Phone, Calendar, Shield } from "lucide-react"

export default function EmployeeProfile() {
  const { appUser } = useAuth()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [departments, setDepartments] = useState<Workplace[]>([])

  useEffect(() => {
    if (appUser) getMyEmployee().then(setEmployee).catch(() => {})
  }, [appUser?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { listWorkplaces().then(setDepartments).catch(() => {}) }, [])

  const myDepartmentNames = departments
    .filter((d) => employee?.departmentIds?.includes(d.id))
    .map((d) => d.name)
    .join(", ") || "—"

  if (!employee) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-primary-50 text-primary-600 rounded-xl border border-primary-100">
          <User className="w-5 h-5" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Mon profil</h1>
      </div>

      <Card className="p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 text-sm">
        
        {/* En-tête Avatar & Nom */}
        <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
          <div className="w-14 h-14 bg-primary-100 text-primary-700 font-bold text-xl rounded-2xl flex items-center justify-center border border-primary-200">
            {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
          </div>
          <div>
            <h2 className="font-extrabold text-slate-900 text-lg">{employee.lastName} {employee.firstName}</h2>
            <p className="text-xs text-slate-500 font-medium">ID : {employee.employeeCode}</p>
          </div>
        </div>

        {/* Liste des informations */}
        <div className="space-y-3">
          <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
            <span className="text-slate-400 flex items-center gap-2"><Briefcase className="w-4 h-4" /> Poste</span>
            <span className="font-semibold text-slate-800">{employee.position}</span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
            <span className="text-slate-400 flex items-center gap-2"><Building className="w-4 h-4" /> Départements</span>
            <span className="font-semibold text-slate-800 text-right">{myDepartmentNames}</span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
            <span className="text-slate-400 flex items-center gap-2"><Shield className="w-4 h-4" /> Salaire de base (8h)</span>
            <span className="font-bold text-primary-600">{formatAriary(employee.baseDailySalary ?? 0)}</span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
            <span className="text-slate-400 flex items-center gap-2"><Mail className="w-4 h-4" /> Email</span>
            <span className="font-semibold text-slate-800">{employee.email || "—"}</span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-slate-50">
            <span className="text-slate-400 flex items-center gap-2"><Phone className="w-4 h-4" /> Téléphone</span>
            <span className="font-semibold text-slate-800">{employee.phone || "—"}</span>
          </div>

          <div className="flex items-center justify-between py-1.5">
            <span className="text-slate-400 flex items-center gap-2"><Calendar className="w-4 h-4" /> Date d'embauche</span>
            <span className="font-semibold text-slate-800">{fmtDay(employee.hireDate)}</span>
          </div>
        </div>

      </Card>

      <Card className="p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <ThemeToggle />
      </Card>
    </div>
  )
}