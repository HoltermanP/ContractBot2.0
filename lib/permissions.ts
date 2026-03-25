import type { UserRole } from './auth'

/** Hiërarchie alleen voor `requireRole()` — hogere rol erft rechten van lagere drempels. */
export function roleRank(role: UserRole): number {
  const m: Record<UserRole, number> = {
    reader: 0,
    compliance: 1,
    registrator: 2,
    manager: 3,
    admin: 4,
  }
  return m[role]
}

/** Contract aanmaken/bewerken, leveranciers muteren, documenten uploaden, verplichtingen/notificaties. */
export function canMutateContractData(role: UserRole): boolean {
  return role === 'admin' || role === 'manager' || role === 'registrator'
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
  if (role === 'admin' || role === 'registrator') return true
  if (role === 'manager' && contract.ownerUserId === userId) return true
  return false
}

export function canArchiveOrUnarchiveContract(role: UserRole): boolean {
  return role === 'admin' || role === 'manager'
}

export function canDeleteContract(role: UserRole): boolean {
  return role === 'admin'
}

export function canBulkDownloadDocuments(role: UserRole): boolean {
  return role !== 'reader'
}

export function canRestoreDocumentVersion(role: UserRole): boolean {
  return canMutateContractData(role)
}

export function canApproveWorkflow(role: UserRole): boolean {
  return role === 'admin' || role === 'manager'
}

export function canManageOrgSettings(role: UserRole): boolean {
  return role === 'admin'
}

export function canManageProjects(role: UserRole): boolean {
  return role === 'admin' || role === 'manager'
}

export function canManageUsers(role: UserRole): boolean {
  return role === 'admin'
}

export function canManageSupplierWrite(role: UserRole): boolean {
  return canMutateContractData(role)
}

/** Concept-trainingen alleen voor beheer; gepubliceerde cursussen voor iedereen in de org. */
export function canViewTrainingCourse(role: UserRole, courseStatus: 'draft' | 'published'): boolean {
  if (courseStatus === 'published') return true
  return canMutateContractData(role)
}
