import {
  pgTable,
  pgEnum,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  decimal,
  jsonb,
  vector,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'registrator', 'manager', 'compliance', 'reader'])
export const contractStatusEnum = pgEnum('contract_status', ['concept', 'actief', 'verlopen', 'gearchiveerd', 'verwijderd'])
export const obligationCategoryEnum = pgEnum('obligation_category', ['it_security', 'privacy', 'financial', 'sustainability', 'other'])
export const obligationStatusEnum = pgEnum('obligation_status', ['open', 'in_progress', 'compliant', 'non_compliant'])
export const notificationTriggerEnum = pgEnum('notification_trigger', ['days_before_end', 'days_before_option', 'obligation_due', 'budget_threshold'])
export const notificationChannelEnum = pgEnum('notification_channel', ['email', 'dashboard', 'both'])
export const workflowTypeEnum = pgEnum('workflow_type', ['new_contract', 'change', 'renewal'])
export const workflowStatusEnum = pgEnum('workflow_status', ['pending', 'approved', 'rejected'])
export const customFieldTypeEnum = pgEnum('custom_field_type', ['text', 'number', 'date', 'select'])
export const trainingCourseStatusEnum = pgEnum('training_course_status', ['draft', 'published'])
export const documentKindEnum = pgEnum('document_kind', ['hoofdcontract', 'addendum'])

// Organizations
export const organizations = pgTable('organizations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  settingsJson: jsonb('settings_json').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Users
export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  clerkId: varchar('clerk_id', { length: 255 }).notNull().unique(),
  orgId: text('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
  role: userRoleEnum('role').notNull().default('reader'),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Lidmaatschap gebruiker ↔ organisatie (meerdere orgs per gebruiker mogelijk)
export const organizationMembers = pgTable(
  'organization_members',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    role: userRoleEnum('role').notNull().default('reader'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userOrgUnique: uniqueIndex('organization_members_user_org_idx').on(table.userId, table.orgId),
    orgIdx: index('organization_members_org_id_idx').on(table.orgId),
  })
)

// Projecten binnen een organisatie (contracten hangen onder een project)
export const projects = pgTable(
  'projects',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('projects_org_id_idx').on(table.orgId),
  })
)

// Suppliers
export const suppliers = pgTable('suppliers', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  kvk: varchar('kvk', { length: 20 }),
  contactEmail: varchar('contact_email', { length: 255 }),
  contactName: varchar('contact_name', { length: 255 }),
  metadataJson: jsonb('metadata_json').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Contracts
export const contracts = pgTable('contracts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 500 }).notNull(),
  contractNumber: varchar('contract_number', { length: 100 }),
  status: contractStatusEnum('status').notNull().default('concept'),
  contractType: varchar('contract_type', { length: 100 }),
  supplierId: text('supplier_id').references(() => suppliers.id),
  ownerUserId: text('owner_user_id').references(() => users.id),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  optionDate: timestamp('option_date'),
  noticePeriodDays: integer('notice_period_days'),
  valueTotal: decimal('value_total', { precision: 15, scale: 2 }),
  valueAnnual: decimal('value_annual', { precision: 15, scale: 2 }),
  currency: varchar('currency', { length: 3 }).default('EUR'),
  autoRenewal: boolean('auto_renewal').default(false),
  autoRenewalTerms: text('auto_renewal_terms'),
  retentionYears: integer('retention_years'),
  destructionDate: timestamp('destruction_date'),
  metadataJson: jsonb('metadata_json').default({}),
  contentEmbedding: vector('content_embedding', { dimensions: 1536 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdBy: text('created_by').references(() => users.id),
  archivedAt: timestamp('archived_at'),
  archivedBy: text('archived_by').references(() => users.id),
}, (table) => ({
  orgIdIdx: index('contracts_org_id_idx').on(table.orgId),
  projectIdIdx: index('contracts_project_id_idx').on(table.projectId),
  statusIdx: index('contracts_status_idx').on(table.status),
  endDateIdx: index('contracts_end_date_idx').on(table.endDate),
}))

// Contract Documents
export const contractDocuments = pgTable('contract_documents', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  contractId: text('contract_id').notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  filename: varchar('filename', { length: 500 }).notNull(),
  fileUrl: text('file_url').notNull(),
  fileType: varchar('file_type', { length: 50 }).notNull(),
  fileSize: integer('file_size').notNull(),
  versionNumber: integer('version_number').notNull().default(1),
  isCurrent: boolean('is_current').default(true),
  documentKind: documentKindEnum('document_kind').notNull().default('hoofdcontract'),
  uploadedBy: text('uploaded_by').references(() => users.id),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
  aiProcessed: boolean('ai_processed').default(false),
  aiExtractedDataJson: jsonb('ai_extracted_data_json'),
})

// Document Versions
export const documentVersions = pgTable('document_versions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  documentId: text('document_id').notNull().references(() => contractDocuments.id, { onDelete: 'cascade' }),
  versionNumber: integer('version_number').notNull(),
  fileUrl: text('file_url').notNull(),
  uploadedBy: text('uploaded_by').references(() => users.id),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
  changeDescription: text('change_description'),
})

// Contract Obligations
export const contractObligations = pgTable('contract_obligations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  contractId: text('contract_id').notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  category: obligationCategoryEnum('category').notNull().default('other'),
  dueDate: timestamp('due_date'),
  recurring: boolean('recurring').default(false),
  status: obligationStatusEnum('status').notNull().default('open'),
  extractedByAi: boolean('extracted_by_ai').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Notification Rules
export const notificationRules = pgTable('notification_rules', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  contractId: text('contract_id').notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  triggerType: notificationTriggerEnum('trigger_type').notNull(),
  triggerValue: integer('trigger_value'),
  recipientsJson: jsonb('recipients_json').notNull().default([]),
  channel: notificationChannelEnum('channel').notNull().default('both'),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Notifications Log
export const notificationsLog = pgTable('notifications_log', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  ruleId: text('rule_id').references(() => notificationRules.id),
  contractId: text('contract_id').references(() => contracts.id),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
  recipientEmail: varchar('recipient_email', { length: 255 }),
  status: varchar('status', { length: 50 }).notNull().default('sent'),
  message: text('message'),
})

// Approval Workflows
export const approvalWorkflows = pgTable('approval_workflows', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  contractId: text('contract_id').notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  workflowType: workflowTypeEnum('workflow_type').notNull(),
  status: workflowStatusEnum('status').notNull().default('pending'),
  stepsJson: jsonb('steps_json').notNull().default([]),
  currentStep: integer('current_step').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  createdBy: text('created_by').references(() => users.id),
})

// Audit Log
export const auditLog = pgTable('audit_log', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  contractId: text('contract_id').references(() => contracts.id),
  userId: text('user_id').references(() => users.id),
  action: varchar('action', { length: 255 }).notNull(),
  oldValueJson: jsonb('old_value_json'),
  newValueJson: jsonb('new_value_json'),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  orgIdIdx: index('audit_log_org_id_idx').on(table.orgId),
  contractIdIdx: index('audit_log_contract_id_idx').on(table.contractId),
  createdAtIdx: index('audit_log_created_at_idx').on(table.createdAt),
}))

// Custom Fields
export const customFields = pgTable('custom_fields', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  fieldName: varchar('field_name', { length: 100 }).notNull(),
  fieldType: customFieldTypeEnum('field_type').notNull(),
  optionsJson: jsonb('options_json'),
  required: boolean('required').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Contract Access Control — optional per-contract access restrictions
export const contractAccess = pgTable('contract_access', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  contractId: text('contract_id').notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  // If userId is set: grant/deny for that specific user
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  // If role is set: grant/deny for that role (and below)
  role: userRoleEnum('role'),
  accessType: varchar('access_type', { length: 20 }).notNull().default('allow'), // 'allow' | 'deny'
  grantedBy: text('granted_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  contractAccessIdx: index('contract_access_contract_id_idx').on(table.contractId),
}))

// E-learning / contracttrainingen
export const trainingCourses = pgTable(
  'training_courses',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 500 }).notNull(),
    description: text('description'),
    status: trainingCourseStatusEnum('status').notNull().default('draft'),
    gammaGenerationId: varchar('gamma_generation_id', { length: 255 }),
    gammaUrl: text('gamma_url'),
    gammaExportUrl: text('gamma_export_url'),
    gammaStatus: varchar('gamma_status', { length: 50 }),
    createdBy: text('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index('training_courses_org_id_idx').on(table.orgId),
    statusIdx: index('training_courses_status_idx').on(table.status),
  })
)

export const trainingCourseContracts = pgTable(
  'training_course_contracts',
  {
    courseId: text('course_id')
      .notNull()
      .references(() => trainingCourses.id, { onDelete: 'cascade' }),
    contractId: text('contract_id')
      .notNull()
      .references(() => contracts.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.courseId, table.contractId] }),
  })
)

export const trainingCourseDocuments = pgTable(
  'training_course_documents',
  {
    courseId: text('course_id')
      .notNull()
      .references(() => trainingCourses.id, { onDelete: 'cascade' }),
    documentId: text('document_id')
      .notNull()
      .references(() => contractDocuments.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.courseId, table.documentId] }),
  })
)

export const trainingModules = pgTable(
  'training_modules',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    courseId: text('course_id')
      .notNull()
      .references(() => trainingCourses.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
    title: varchar('title', { length: 500 }).notNull(),
    bodyMarkdown: text('body_markdown').notNull(),
    /** { questions: [{ question, options[], correctIndex }] } */
    quizJson: jsonb('quiz_json'),
    estimatedMinutes: integer('estimated_minutes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    courseIdx: index('training_modules_course_id_idx').on(table.courseId),
  })
)

export const trainingProgress = pgTable(
  'training_progress',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    moduleId: text('module_id')
      .notNull()
      .references(() => trainingModules.id, { onDelete: 'cascade' }),
    completedAt: timestamp('completed_at').defaultNow().notNull(),
  },
  (table) => ({
    userModuleUnique: uniqueIndex('training_progress_user_module_idx').on(table.userId, table.moduleId),
  })
)

// Dashboard Notifications (in-app)
export const dashboardNotifications = pgTable('dashboard_notifications', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orgId: text('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id),
  contractId: text('contract_id').references(() => contracts.id),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  type: varchar('type', { length: 50 }).notNull().default('info'),
  read: boolean('read').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  members: many(organizationMembers),
  projects: many(projects),
  contracts: many(contracts),
  suppliers: many(suppliers),
  customFields: many(customFields),
  trainingCourses: many(trainingCourses),
}))

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, { fields: [users.orgId], references: [organizations.id] }),
  memberships: many(organizationMembers),
  ownedContracts: many(contracts),
  trainingProgress: many(trainingProgress),
}))

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  user: one(users, { fields: [organizationMembers.userId], references: [users.id] }),
  organization: one(organizations, { fields: [organizationMembers.orgId], references: [organizations.id] }),
}))

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, { fields: [projects.orgId], references: [organizations.id] }),
  contracts: many(contracts),
}))

export const contractsRelations = relations(contracts, ({ one, many }) => ({
  organization: one(organizations, { fields: [contracts.orgId], references: [organizations.id] }),
  project: one(projects, { fields: [contracts.projectId], references: [projects.id] }),
  supplier: one(suppliers, { fields: [contracts.supplierId], references: [suppliers.id] }),
  owner: one(users, { fields: [contracts.ownerUserId], references: [users.id] }),
  documents: many(contractDocuments),
  obligations: many(contractObligations),
  notificationRules: many(notificationRules),
  approvalWorkflows: many(approvalWorkflows),
  auditLogs: many(auditLog),
  accessRules: many(contractAccess),
  trainingCourseLinks: many(trainingCourseContracts),
}))

export const suppliersRelations = relations(suppliers, ({ one, many }) => ({
  organization: one(organizations, { fields: [suppliers.orgId], references: [organizations.id] }),
  contracts: many(contracts),
}))

export const contractDocumentsRelations = relations(contractDocuments, ({ one, many }) => ({
  contract: one(contracts, { fields: [contractDocuments.contractId], references: [contracts.id] }),
  versions: many(documentVersions),
  trainingCourseLinks: many(trainingCourseDocuments),
}))

export const documentVersionsRelations = relations(documentVersions, ({ one }) => ({
  document: one(contractDocuments, { fields: [documentVersions.documentId], references: [contractDocuments.id] }),
}))

export const contractObligationsRelations = relations(contractObligations, ({ one }) => ({
  contract: one(contracts, { fields: [contractObligations.contractId], references: [contracts.id] }),
}))

export const notificationRulesRelations = relations(notificationRules, ({ one }) => ({
  contract: one(contracts, { fields: [notificationRules.contractId], references: [contracts.id] }),
}))

export const approvalWorkflowsRelations = relations(approvalWorkflows, ({ one }) => ({
  contract: one(contracts, { fields: [approvalWorkflows.contractId], references: [contracts.id] }),
  creator: one(users, { fields: [approvalWorkflows.createdBy], references: [users.id] }),
}))

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  organization: one(organizations, { fields: [auditLog.orgId], references: [organizations.id] }),
  contract: one(contracts, { fields: [auditLog.contractId], references: [contracts.id] }),
  user: one(users, { fields: [auditLog.userId], references: [users.id] }),
}))

export const contractAccessRelations = relations(contractAccess, ({ one }) => ({
  organization: one(organizations, { fields: [contractAccess.orgId], references: [organizations.id] }),
  contract: one(contracts, { fields: [contractAccess.contractId], references: [contracts.id] }),
  user: one(users, { fields: [contractAccess.userId], references: [users.id] }),
  grantedByUser: one(users, { fields: [contractAccess.grantedBy], references: [users.id] }),
}))

export const customFieldsRelations = relations(customFields, ({ one }) => ({
  organization: one(organizations, { fields: [customFields.orgId], references: [organizations.id] }),
}))

export const dashboardNotificationsRelations = relations(dashboardNotifications, ({ one }) => ({
  organization: one(organizations, { fields: [dashboardNotifications.orgId], references: [organizations.id] }),
  user: one(users, { fields: [dashboardNotifications.userId], references: [users.id] }),
  contract: one(contracts, { fields: [dashboardNotifications.contractId], references: [contracts.id] }),
}))

export const notificationsLogRelations = relations(notificationsLog, ({ one }) => ({
  rule: one(notificationRules, { fields: [notificationsLog.ruleId], references: [notificationRules.id] }),
  contract: one(contracts, { fields: [notificationsLog.contractId], references: [contracts.id] }),
}))

export const trainingCoursesRelations = relations(trainingCourses, ({ one, many }) => ({
  organization: one(organizations, { fields: [trainingCourses.orgId], references: [organizations.id] }),
  creator: one(users, { fields: [trainingCourses.createdBy], references: [users.id] }),
  modules: many(trainingModules),
  courseContracts: many(trainingCourseContracts),
  courseDocuments: many(trainingCourseDocuments),
}))

export const trainingCourseContractsRelations = relations(trainingCourseContracts, ({ one }) => ({
  course: one(trainingCourses, { fields: [trainingCourseContracts.courseId], references: [trainingCourses.id] }),
  contract: one(contracts, { fields: [trainingCourseContracts.contractId], references: [contracts.id] }),
}))

export const trainingCourseDocumentsRelations = relations(trainingCourseDocuments, ({ one }) => ({
  course: one(trainingCourses, { fields: [trainingCourseDocuments.courseId], references: [trainingCourses.id] }),
  document: one(contractDocuments, { fields: [trainingCourseDocuments.documentId], references: [contractDocuments.id] }),
}))

export const trainingModulesRelations = relations(trainingModules, ({ one, many }) => ({
  course: one(trainingCourses, { fields: [trainingModules.courseId], references: [trainingCourses.id] }),
  progress: many(trainingProgress),
}))

export const trainingProgressRelations = relations(trainingProgress, ({ one }) => ({
  user: one(users, { fields: [trainingProgress.userId], references: [users.id] }),
  module: one(trainingModules, { fields: [trainingProgress.moduleId], references: [trainingModules.id] }),
}))
