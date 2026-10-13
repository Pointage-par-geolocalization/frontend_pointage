// src/services/audit.ts
// Journal des actions importantes. Écrit uniquement par le serveur (paiements, pointages à distance,
// comptes, paramètres, décisions…), consultable par l'administrateur.
import { get } from "./api"

export interface AuditLog {
  id: string
  createdAt: string
  userLabel: string | null
  action: string
  targetId: string | null
  summary: string | null
}

export const AUDIT_ACTIONS: Record<string, string> = {
  ADMIN_CREATED: "Compte administrateur créé",
  EMPLOYEE_CREATED: "Salarié créé",
  EMPLOYEE_UPDATED: "Salarié modifié",
  EMPLOYEE_DISABLED: "Salarié désactivé",
  EMPLOYEE_ENABLED: "Salarié réactivé",
  EMPLOYEE_DELETED: "Salarié supprimé",
  EMPLOYEE_PASSWORD_CHANGED: "Mot de passe salarié modifié",
  SETTINGS_UPDATED: "Paramètres modifiés",
  WORKPLACE_CREATED: "Lieu de travail créé",
  WORKPLACE_UPDATED: "Lieu de travail modifié",
  WORKPLACE_DELETED: "Lieu de travail supprimé",
  ATTENDANCE_CREATED: "Pointage démarré à distance",
  ATTENDANCE_UPDATED: "Pointage arrêté à distance",
  PAYMENT_CREATED: "Paiement enregistré",
  LOAN_APPROVED: "Prêt de matériel accordé",
  LOAN_REFUSED: "Prêt de matériel refusé",
  LOAN_RETURNED: "Retour de matériel confirmé",
  LEAVE_APPROVED: "Permission acceptée",
  LEAVE_REFUSED: "Permission refusée",
  PRESENCE_CHECK_TRIGGERED: "Contrôle de présence lancé",
  SITE_CREATED: "Chantier créé",
  SITE_UPDATED: "Chantier modifié",
  SITE_DELETED: "Chantier supprimé",
  DOCUMENT_CREATED: "Document créé",
  DOCUMENT_UPDATED: "Document modifié",
  DOCUMENT_STATUS_CHANGED: "Statut de document modifié",
  DOCUMENT_DELETED: "Document supprimé",
  DATA_RESET: "Réinitialisation des données",
}

export const auditLabel = (action: string) => AUDIT_ACTIONS[action] ?? action

export const listAuditLogs = (q: { action?: string; from?: string; to?: string; limit?: number }) =>
  get<AuditLog[]>("/audit-logs", q)
