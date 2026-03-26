export interface Organisation {
  id: string
  name: string
  slug: string
  createdAt: Date | null
}

export interface Programme {
  id: string
  organisationId: string
  name: string
  status: string
  createdAt: Date | null
}

export interface Project {
  id: string
  organisationId: string
  programmeId: string | null
  name: string
  status: string
  createdAt: Date | null
}

export interface Contract {
  id: string
  reference: string
  contractType: string
  status: string
  startDate: string | null
  endDate: string | null
  createdAt: Date | null
}

export interface ContractVersion {
  id: string
  contractId: string
  versionNumber: number
  label: string | null
  validFrom: string | null
  isCurrent: boolean
  createdAt: Date | null
}

export interface ContractDocument {
  id: string
  contractVersionId: string
  docType: string
  title: string
  sortOrder: number
  createdAt: Date | null
}

export interface ContractClause {
  id: string
  contractDocumentId: string
  clauseType: string
  ownerParty: string | null
  dueDate: string | null
  status: string
  content: string | null
  aiLabel: string | null
  aiRiskScore: number | null
  createdAt: Date | null
}

export interface ContractWithProjects {
  contract: Contract
  projects: Array<{
    projectId: string
    role: string
  }>
}
