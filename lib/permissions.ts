import type { UserRole } from './auth'
import { getEffectiveModuleVisibility } from './org-modules'

/** Platform-superuser: alle orgs, alle rechten (tenant-beheer). */
export function isSuperAdmin(role: UserRole): boolean {
  return role === 'super_admin'
}

/** Organisatie-beheerder (admin) of platform-super-admin. */
export function isOrgAdminRole(role: UserRole): boolean {
  return role === 'super_admin' || role === 'admin'
}

/** Hiërarchie alleen voor `requireRole()` — hogere rol erft rechten van lagere drempels. */
export function roleRank(role: UserRole): number {
  const m: Record<UserRole, number> = {
    reader: 0,
    compliance: 1,
    registrator: 2,
    manager: 3,
    admin: 4,
    super_admin: 5,
  }
  return m[role]
}

/** Contract aanmaken/bewerken, leveranciers muteren, documenten uploaden, verplichtingen/notificaties. */
export function canMutateContractData(role: UserRole): boolean {
  return isOrgAdminRole(role) || role === 'manager' || role === 'registrator'
}

export function canViewArchivedContracts(role: UserRole): boolean {
  return role !== 'reader'
}

/** Contractoverzicht: bewerk/archiveren-knoppen (zelfde logica als voorheen, plus compliance uitgesloten). */
export function canEditContractOverview(
  role: UserRole,
  contract: { ownerUserId: string | null },
  userId: string
): boolean {
  if (role === 'compliance' || role === 'reader') return false
  if (isOrgAdminRole(role) || role === 'registrator') return true
  if (role === 'manager' && contract.ownerUserId === userId) return true
  return false
}

export function canArchiveOrUnarchiveContract(role: UserRole): boolean {
  return isOrgAdminRole(role) || role === 'manager'
}

export function canDeleteContract(role: UserRole): boolean {
  return isOrgAdminRole(role)
}

export function canBulkDownloadDocuments(role: UserRole): boolean {
  return role !== 'reader'
}

export function canRestoreDocumentVersion(role: UserRole): boolean {
  return canMutateContractData(role)
}

export function canApproveWorkflow(role: UserRole): boolean {
  return isOrgAdminRole(role) || role === 'manager'
}

export function canManageOrgSettings(role: UserRole): boolean {
  return isOrgAdminRole(role)
}

/** Notificatie-instellingen mogen ook door contractmanagers beheerd worden. */
export function canManageNotificationSettings(role: UserRole): boolean {
  return isOrgAdminRole(role) || role === 'manager'
}

export function canManageProjects(role: UserRole): boolean {
  return isOrgAdminRole(role) || role === 'manager'
}

export function canManageUsers(role: UserRole): boolean {
  return isOrgAdminRole(role)
}

/** Gebruikers uitnodigen/toevoegen binnen eigen organisatie (admin + manager). */
export function canInviteUsers(role: UserRole): boolean {
  return isOrgAdminRole(role) || role === 'manager'
}

export function canManageSupplierWrite(role: UserRole): boolean {
  return canMutateContractData(role)
}

/** Training-sectie (nav, lijst, gepubliceerde cursus) volgens org-instellingen en per-rol matrix. */
export function canViewTrainingSection(settingsJson: unknown, role: UserRole): boolean {
  return getEffectiveModuleVisibility(settingsJson, role).training
}

/** Cursussen aanmaken, bewerken, genereren, concepten: beheerder / super-admin. */
export function canManageTrainingCourses(role: UserRole): boolean {
  return isOrgAdminRole(role)
}

/** Cursus openen: module aan + gepubliceerd voor iedereen met toegang; concept alleen beheerders. */
export function canViewTrainingCourseContent(
  settingsJson: unknown,
  role: UserRole,
  courseStatus: 'draft' | 'published'
): boolean {
  if (!canViewTrainingSection(settingsJson, role)) return false
  if (courseStatus === 'published') return true
  return isOrgAdminRole(role)
}

/** Alleen super-admin mag anderen tot super-admin promoveren. */
export function canAssignSuperAdmin(actorRole: UserRole): boolean {
  return isSuperAdmin(actorRole)
}
