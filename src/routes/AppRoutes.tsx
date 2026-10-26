// src/routes/AppRoutes.tsx
// Les pages sont chargées à la demande : l'application démarre plus vite, surtout sur téléphone.
import { lazy, Suspense } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import ProtectedRoute from "./ProtectedRoute"
import PageLoading from "../components/PageLoading"

import Login from "../pages/auth/Login"
import AdminLayout from "../layouts/AdminLayout"
import EmployeeLayout from "../layouts/EmployeeLayout"

const AdminDashboard = lazy(() => import("../pages/admin/Dashboard"))
const AdminEmployees = lazy(() => import("../pages/admin/Employees"))
const AdminAttendance = lazy(() => import("../pages/admin/Attendance"))
const AdminPresenceChecks = lazy(() => import("../pages/admin/PresenceChecks"))
const AdminMap = lazy(() => import("../pages/admin/MapView"))
const AdminSites = lazy(() => import("../pages/admin/Sites"))
const AdminSiteDetail = lazy(() => import("../pages/admin/SiteDetail"))
const AdminLeaves = lazy(() => import("../pages/admin/Leaves"))
const AdminSalaries = lazy(() => import("../pages/admin/Salaries"))
const AdminDocuments = lazy(() => import("../pages/admin/Documents"))
const AdminDocumentEditor = lazy(() => import("../pages/admin/DocumentEditor"))
const AdminDocumentView = lazy(() => import("../pages/admin/DocumentView"))
const AdminClients = lazy(() => import("../pages/admin/Clients"))
const AdminReports = lazy(() => import("../pages/admin/Reports"))
const AdminWorkplaces = lazy(() => import("../pages/admin/Workplaces"))
const AdminAuditLog = lazy(() => import("../pages/admin/AuditLog"))
const AdminSettings = lazy(() => import("../pages/admin/Settings"))
const AdminChat = lazy(() => import("../pages/admin/Chat"))
const AdminEquipment = lazy(() => import("../pages/admin/Equipment"))

const EmployeeHome = lazy(() => import("../pages/employee/Home"))
const EmployeeHistory = lazy(() => import("../pages/employee/History"))
const EmployeeSalary = lazy(() => import("../pages/employee/Salary"))
const EmployeeProfile = lazy(() => import("../pages/employee/Profile"))
const EmployeeChat = lazy(() => import("../pages/employee/Chat"))
const EmployeeEquipment = lazy(() => import("../pages/employee/Equipment"))
const EmployeeLeaves = lazy(() => import("../pages/employee/Leaves"))
const EmployeeTimesheet = lazy(() => import("../pages/employee/Timesheet"))
const EmployeePunctuality = lazy(() => import("../pages/employee/Punctuality"))
const CalendarPage = lazy(() => import("../pages/Calendar"))
const EmployeeSiteMap = lazy(() => import("../pages/employee/SiteMap"))

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute allow="admin" />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="salaries-personnel" element={<AdminEmployees />} />
            <Route path="presences" element={<AdminAttendance />} />
            <Route path="timesheets" element={<EmployeeTimesheet />} />
            <Route path="controles" element={<AdminPresenceChecks />} />
            <Route path="carte" element={<AdminMap />} />
            <Route path="chantiers" element={<AdminSites />} />
            <Route path="chantiers/:id" element={<AdminSiteDetail />} />
            <Route path="permissions" element={<AdminLeaves />} />
            <Route path="remunerations" element={<AdminSalaries />} />
            <Route path="documents" element={<AdminDocuments />} />
            <Route path="documents/nouveau" element={<AdminDocumentEditor />} />
            <Route path="documents/:id" element={<AdminDocumentView />} />
            <Route path="documents/:id/modifier" element={<AdminDocumentEditor />} />
            <Route path="clients" element={<AdminClients />} />
            <Route path="rapports" element={<AdminReports />} />
            <Route path="lieux" element={<AdminWorkplaces />} />
            <Route path="discussions" element={<AdminChat />} />
            <Route path="materiel" element={<AdminEquipment />} />
            <Route path="journal" element={<AdminAuditLog />} />
            <Route path="parametres" element={<AdminSettings />} />
            <Route path="calendrier" element={<CalendarPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allow="employee" />}>
          <Route path="/employe" element={<EmployeeLayout />}>
            <Route index element={<EmployeeHome />} />
            <Route path="historique" element={<EmployeeHistory />} />
            <Route path="timesheet" element={<EmployeeTimesheet />} />
            <Route path="ponctualite" element={<EmployeePunctuality />} />
            <Route path="calendrier" element={<CalendarPage />} />
            <Route path="carte" element={<EmployeeSiteMap />} />
            <Route path="remuneration" element={<EmployeeSalary />} />
            <Route path="permissions" element={<EmployeeLeaves />} />
            <Route path="discussions" element={<EmployeeChat />} />
            <Route path="materiel" element={<EmployeeEquipment />} />
            <Route path="profil" element={<EmployeeProfile />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )
}

// // src/routes/AppRoutes.tsx
// // Les pages sont chargées à la demande : l'application démarre plus vite, surtout sur téléphone.
// import { lazy, Suspense } from "react"
// import { Routes, Route, Navigate } from "react-router-dom"
// import ProtectedRoute from "./ProtectedRoute"
// import PageLoading from "../components/PageLoading"

// import Login from "../pages/auth/Login"
// import AdminLayout from "../layouts/AdminLayout"
// import EmployeeLayout from "../layouts/EmployeeLayout"

// const AdminDashboard = lazy(() => import("../pages/admin/Dashboard"))
// const AdminEmployees = lazy(() => import("../pages/admin/Employees"))
// const AdminAttendance = lazy(() => import("../pages/admin/Attendance"))
// const AdminPresenceChecks = lazy(() => import("../pages/admin/PresenceChecks"))
// const AdminMap = lazy(() => import("../pages/admin/MapView"))
// const AdminSites = lazy(() => import("../pages/admin/Sites"))
// const AdminSiteDetail = lazy(() => import("../pages/admin/SiteDetail"))
// const AdminLeaves = lazy(() => import("../pages/admin/Leaves"))
// const AdminSalaries = lazy(() => import("../pages/admin/Salaries"))
// const AdminDocuments = lazy(() => import("../pages/admin/Documents"))
// const AdminDocumentEditor = lazy(() => import("../pages/admin/DocumentEditor"))
// const AdminDocumentView = lazy(() => import("../pages/admin/DocumentView"))
// const AdminClients = lazy(() => import("../pages/admin/Clients"))
// const AdminReports = lazy(() => import("../pages/admin/Reports"))
// const AdminWorkplaces = lazy(() => import("../pages/admin/Workplaces"))
// const AdminAuditLog = lazy(() => import("../pages/admin/AuditLog"))
// const AdminSettings = lazy(() => import("../pages/admin/Settings"))
// const AdminChat = lazy(() => import("../pages/admin/Chat"))
// const AdminEquipment = lazy(() => import("../pages/admin/Equipment"))

// const EmployeeHome = lazy(() => import("../pages/employee/Home"))
// const EmployeeHistory = lazy(() => import("../pages/employee/History"))
// const EmployeeSalary = lazy(() => import("../pages/employee/Salary"))
// const EmployeeProfile = lazy(() => import("../pages/employee/Profile"))
// const EmployeeChat = lazy(() => import("../pages/employee/Chat"))
// const EmployeeEquipment = lazy(() => import("../pages/employee/Equipment"))
// const EmployeeLeaves = lazy(() => import("../pages/employee/Leaves"))
// const EmployeeTimesheet = lazy(() => import("../pages/employee/Timesheet"))
// const EmployeePunctuality = lazy(() => import("../pages/employee/Punctuality"))

// export default function AppRoutes() {
//   return (
//     <Suspense fallback={<PageLoading />}>
//       <Routes>
//         <Route path="/login" element={<Login />} />

//         <Route element={<ProtectedRoute allow="admin" />}>
//           <Route path="/admin" element={<AdminLayout />}>
//             <Route index element={<AdminDashboard />} />
//             <Route path="salaries-personnel" element={<AdminEmployees />} />
//             <Route path="presences" element={<AdminAttendance />} />
//             <Route path="timesheets" element={<EmployeeTimesheet />} />
//             <Route path="controles" element={<AdminPresenceChecks />} />
//             <Route path="carte" element={<AdminMap />} />
//             <Route path="chantiers" element={<AdminSites />} />
//             <Route path="chantiers/:id" element={<AdminSiteDetail />} />
//             <Route path="permissions" element={<AdminLeaves />} />
//             <Route path="remunerations" element={<AdminSalaries />} />
//             <Route path="documents" element={<AdminDocuments />} />
//             <Route path="documents/nouveau" element={<AdminDocumentEditor />} />
//             <Route path="documents/:id" element={<AdminDocumentView />} />
//             <Route path="documents/:id/modifier" element={<AdminDocumentEditor />} />
//             <Route path="clients" element={<AdminClients />} />
//             <Route path="rapports" element={<AdminReports />} />
//             <Route path="lieux" element={<AdminWorkplaces />} />
//             <Route path="discussions" element={<AdminChat />} />
//             <Route path="materiel" element={<AdminEquipment />} />
//             <Route path="journal" element={<AdminAuditLog />} />
//             <Route path="parametres" element={<AdminSettings />} />
//           </Route>
//         </Route>

//         <Route element={<ProtectedRoute allow="employee" />}>
//           <Route path="/employe" element={<EmployeeLayout />}>
//             <Route index element={<EmployeeHome />} />
//             <Route path="historique" element={<EmployeeHistory />} />
//             <Route path="timesheet" element={<EmployeeTimesheet />} />
//             <Route path="ponctualite" element={<EmployeePunctuality />} />
//             <Route path="remuneration" element={<EmployeeSalary />} />
//             <Route path="permissions" element={<EmployeeLeaves />} />
//             <Route path="discussions" element={<EmployeeChat />} />
//             <Route path="materiel" element={<EmployeeEquipment />} />
//             <Route path="profil" element={<EmployeeProfile />} />
//           </Route>
//         </Route>

//         <Route path="/" element={<Navigate to="/login" replace />} />
//         <Route path="*" element={<Navigate to="/login" replace />} />
//       </Routes>
//     </Suspense>
//   )
// }


// // src/routes/AppRoutes.tsx
// // Les pages sont chargées à la demande : l'application démarre plus vite, surtout sur téléphone.
// import { lazy, Suspense } from "react"
// import { Routes, Route, Navigate } from "react-router-dom"
// import ProtectedRoute from "./ProtectedRoute"
// import PageLoading from "../components/PageLoading"

// import Login from "../pages/auth/Login"
// import AdminLayout from "../layouts/AdminLayout"
// import EmployeeLayout from "../layouts/EmployeeLayout"

// const AdminDashboard = lazy(() => import("../pages/admin/Dashboard"))
// const AdminEmployees = lazy(() => import("../pages/admin/Employees"))
// const AdminAttendance = lazy(() => import("../pages/admin/Attendance"))
// const AdminPresenceChecks = lazy(() => import("../pages/admin/PresenceChecks"))
// const AdminMap = lazy(() => import("../pages/admin/MapView"))
// const AdminSites = lazy(() => import("../pages/admin/Sites"))
// const AdminSiteDetail = lazy(() => import("../pages/admin/SiteDetail"))
// const AdminLeaves = lazy(() => import("../pages/admin/Leaves"))
// const AdminSalaries = lazy(() => import("../pages/admin/Salaries"))
// const AdminDocuments = lazy(() => import("../pages/admin/Documents"))
// const AdminDocumentEditor = lazy(() => import("../pages/admin/DocumentEditor"))
// const AdminDocumentView = lazy(() => import("../pages/admin/DocumentView"))
// const AdminClients = lazy(() => import("../pages/admin/Clients"))
// const AdminReports = lazy(() => import("../pages/admin/Reports"))
// const AdminWorkplaces = lazy(() => import("../pages/admin/Workplaces"))
// const AdminAuditLog = lazy(() => import("../pages/admin/AuditLog"))
// const AdminSettings = lazy(() => import("../pages/admin/Settings"))
// const AdminChat = lazy(() => import("../pages/admin/Chat"))
// const AdminEquipment = lazy(() => import("../pages/admin/Equipment"))

// const EmployeeHome = lazy(() => import("../pages/employee/Home"))
// const EmployeeHistory = lazy(() => import("../pages/employee/History"))
// const EmployeeSalary = lazy(() => import("../pages/employee/Salary"))
// const EmployeeProfile = lazy(() => import("../pages/employee/Profile"))
// const EmployeeChat = lazy(() => import("../pages/employee/Chat"))
// const EmployeeEquipment = lazy(() => import("../pages/employee/Equipment"))
// const EmployeeLeaves = lazy(() => import("../pages/employee/Leaves"))

// export default function AppRoutes() {
//   return (
//     <Suspense fallback={<PageLoading />}>
//       <Routes>
//         <Route path="/login" element={<Login />} />

//         <Route element={<ProtectedRoute allow="admin" />}>
//           <Route path="/admin" element={<AdminLayout />}>
//             <Route index element={<AdminDashboard />} />
//             <Route path="salaries-personnel" element={<AdminEmployees />} />
//             <Route path="presences" element={<AdminAttendance />} />
//             <Route path="controles" element={<AdminPresenceChecks />} />
//             <Route path="carte" element={<AdminMap />} />
//             <Route path="chantiers" element={<AdminSites />} />
//             <Route path="chantiers/:id" element={<AdminSiteDetail />} />
//             <Route path="permissions" element={<AdminLeaves />} />
//             <Route path="remunerations" element={<AdminSalaries />} />
//             <Route path="documents" element={<AdminDocuments />} />
//             <Route path="documents/nouveau" element={<AdminDocumentEditor />} />
//             <Route path="documents/:id" element={<AdminDocumentView />} />
//             <Route path="documents/:id/modifier" element={<AdminDocumentEditor />} />
//             <Route path="clients" element={<AdminClients />} />
//             <Route path="rapports" element={<AdminReports />} />
//             <Route path="lieux" element={<AdminWorkplaces />} />
//             <Route path="discussions" element={<AdminChat />} />
//             <Route path="materiel" element={<AdminEquipment />} />
//             <Route path="journal" element={<AdminAuditLog />} />
//             <Route path="parametres" element={<AdminSettings />} />
//           </Route>
//         </Route>

//         <Route element={<ProtectedRoute allow="employee" />}>
//           <Route path="/employe" element={<EmployeeLayout />}>
//             <Route index element={<EmployeeHome />} />
//             <Route path="historique" element={<EmployeeHistory />} />
//             <Route path="remuneration" element={<EmployeeSalary />} />
//             <Route path="permissions" element={<EmployeeLeaves />} />
//             <Route path="discussions" element={<EmployeeChat />} />
//             <Route path="materiel" element={<EmployeeEquipment />} />
//             <Route path="profil" element={<EmployeeProfile />} />
//           </Route>
//         </Route>

//         <Route path="/" element={<Navigate to="/login" replace />} />
//         <Route path="*" element={<Navigate to="/login" replace />} />
//       </Routes>
//     </Suspense>
//   )
// }
