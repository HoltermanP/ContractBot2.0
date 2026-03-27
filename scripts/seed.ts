/**
 * Testdata seed script voor AI-Contractbot
 * Gebruik: npm run db:seed
 *
 * Compacte set: 10 contracten, 3 projecten, 10 leveranciers; per contract 3 PDF’s (Blob met token).
 *
 * Vereist: DATABASE_URL in .env.local
 * Optioneel: BLOB_READ_WRITE_TOKEN — uploadt per document naar seed/docs/<contractnummer>/<bestand>.pdf (private).
 * PDF-inhoud: Nederlandstalige contracttekst gegenereerd per contract (geen W3C-demo’s).
 */
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { put } from '@vercel/blob'
import { buildSeedContractPdfBuffer } from './seed-contract-pdf'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../lib/db/schema'
import { eq, and } from 'drizzle-orm'

/** Fallback-URL zonder Blob-token (inhoud wijkt af van gegenereerde seed-PDF). */
const DEMO_PDF_URL = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql, { schema })

function blobSafeSegment(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_').slice(0, 180)
}

async function putSeedPdfBuffer(token: string, pathname: string, buf: Buffer): Promise<{ url: string; size: number }> {
  const created = await put(pathname, buf, {
    access: 'private',
    contentType: 'application/pdf',
    token,
    allowOverwrite: true,
  })
  return { url: created.url, size: buf.length }
}

async function clearAllData() {
  console.log('🧹 Bestaande data verwijderen...')

  // Child -> parent volgorde om FK-conflicten te voorkomen
  await db.delete(schema.trainingProgress)
  await db.delete(schema.trainingModules)
  await db.delete(schema.trainingCourseDocuments)
  await db.delete(schema.trainingCourseContracts)
  await db.delete(schema.trainingCourses)
  await db.delete(schema.contractAccess)
  await db.delete(schema.dashboardNotifications)
  await db.delete(schema.auditLog)
  await db.delete(schema.approvalWorkflows)
  await db.delete(schema.notificationsLog)
  await db.delete(schema.notificationRules)
  await db.delete(schema.contractObligations)
  await db.delete(schema.documentVersions)
  await db.delete(schema.contractDocuments)
  await db.delete(schema.contracts)
  await db.delete(schema.suppliers)
  await db.delete(schema.customFields)
  await db.delete(schema.projects)
  await db.delete(schema.organizationMembers)
  await db.delete(schema.users)
  await db.delete(schema.organizations)

  // Nieuwe contract management model
  await db.delete(schema.contractClause)
  await db.delete(schema.contractDocumentNode)
  await db.delete(schema.contractVersion)
  await db.delete(schema.contractProject)
  await db.delete(schema.contract)
  await db.delete(schema.project)
  await db.delete(schema.programme)
  await db.delete(schema.organisation)

  console.log('✓ Alle bestaande data verwijderd')
}

async function seed() {
  console.log('🌱 Testdata laden...\n')
  await clearAllData()

  // ── Organisatie ──────────────────────────────────────────────
  const [org] = await db.insert(schema.organizations).values({
    name: 'Universiteit Leiden',
    slug: 'universiteit-leiden',
    settingsJson: { theme: 'default' },
  }).onConflictDoUpdate({
    target: schema.organizations.slug,
    set: { name: 'Universiteit Leiden' },
  }).returning()
  console.log(`✓ Organisatie: ${org.name} (${org.id})`)

  let mainProject = await db.query.projects.findFirst({
    where: eq(schema.projects.orgId, org.id),
    orderBy: (p, { asc }) => [asc(p.createdAt)],
  })
  if (!mainProject) {
    const [p] = await db
      .insert(schema.projects)
      .values({
        orgId: org.id,
        name: 'Algemeen',
        description: 'Standaardproject voor contracten',
      })
      .returning()
    mainProject = p
    console.log(`✓ Project: ${mainProject.name}`)
  }

  const createdProjects: typeof schema.projects.$inferSelect[] = [mainProject]
  for (const extra of [
    { name: 'Project ICT & digitale dienstverlening', description: 'Testproject voor ICT-contracten' },
    { name: 'Project Facility & huisvesting', description: 'Testproject voor facilitaire contracten' },
  ]) {
    const [project] = await db
      .insert(schema.projects)
      .values({
        orgId: org.id,
        name: extra.name,
        description: extra.description,
      })
      .returning()
    createdProjects.push(project)
  }
  console.log(`✓ ${createdProjects.length} projecten beschikbaar`)

  // ── Gebruikers ───────────────────────────────────────────────
  const usersData = [
    { clerkId: 'seed_admin_001', role: 'admin' as const, name: 'Pieter van den Berg', email: 'p.vandenberg@universiteitleiden.nl' },
    { clerkId: 'seed_manager_001', role: 'manager' as const, name: 'Sophie Janssen', email: 's.janssen@universiteitleiden.nl' },
    { clerkId: 'seed_registrator_001', role: 'registrator' as const, name: 'Thomas de Groot', email: 't.degroot@universiteitleiden.nl' },
    { clerkId: 'seed_compliance_001', role: 'compliance' as const, name: 'Eva Dekker', email: 'e.dekker@universiteitleiden.nl' },
    { clerkId: 'seed_reader_001', role: 'reader' as const, name: 'Anna Visser', email: 'a.visser@universiteitleiden.nl' },
  ]

  const createdUsers: Record<string, typeof schema.users.$inferSelect> = {}
  for (const u of usersData) {
    const [user] = await db.insert(schema.users).values({
      ...u,
      orgId: org.id,
    }).onConflictDoUpdate({
      target: schema.users.clerkId,
      set: { name: u.name, orgId: org.id },
    }).returning()
    createdUsers[u.role] = user
    console.log(`✓ Gebruiker: ${user.name} (${user.role})`)

    const hasMember = await db.query.organizationMembers.findFirst({
      where: and(
        eq(schema.organizationMembers.userId, user.id),
        eq(schema.organizationMembers.orgId, org.id)
      ),
    })
    if (!hasMember) {
      await db.insert(schema.organizationMembers).values({ userId: user.id, orgId: org.id, role: u.role })
    }
  }

  const admin = createdUsers['admin']
  const manager = createdUsers['manager']
  const registrator = createdUsers['registrator']

  // ── Leveranciers ─────────────────────────────────────────────
  const suppliersData = [
    { name: 'Microsoft Nederland B.V.', kvk: '34113641', contactEmail: 'enterprise@microsoft.nl', contactName: 'Erik Smits' },
    { name: 'Capgemini Nederland B.V.', kvk: '33207223', contactEmail: 'contracts@capgemini.com', contactName: 'Laura de Vries' },
    { name: 'Exact Software B.V.', kvk: '27177171', contactEmail: 'sales@exact.nl', contactName: 'Mark Hendriks' },
    { name: 'Facility Services Nederland', kvk: '12345678', contactEmail: 'info@fsn.nl', contactName: 'Kees Bakker' },
    { name: 'Nedap N.V.', kvk: '06010655', contactEmail: 'contracten@nedap.nl', contactName: 'Ingrid Laan' },
    { name: 'Konica Minolta Business Solutions', kvk: '33079635', contactEmail: 'support@konicaminolta.nl', contactName: 'Rob Timmers' },
    { name: 'Siemens Nederland N.V.', kvk: '34108598', contactEmail: 'contracts@siemens.nl', contactName: 'Henk Wolters' },
    { name: 'Adobe Systems Software Ireland Ltd', kvk: '87654321', contactEmail: 'enterprise@adobe.com', contactName: 'Marieke Jansen' },
    { name: 'Cisco Systems Netherlands B.V.', kvk: '87654322', contactEmail: 'contracts@cisco.com', contactName: 'Bas Meijer' },
    { name: 'Amazon Web Services EMEA SARL (NL)', kvk: '87654323', contactEmail: 'aws-contracts@amazon.nl', contactName: 'Lisa Chen' },
  ]

  const createdSuppliers: typeof schema.suppliers.$inferSelect[] = []
  for (const s of suppliersData) {
    const existing = await db.query.suppliers.findFirst({
      where: eq(schema.suppliers.kvk, s.kvk),
    })
    if (existing) {
      createdSuppliers.push(existing)
    } else {
      const [supplier] = await db.insert(schema.suppliers).values({
        orgId: org.id,
        ...s,
      }).returning()
      createdSuppliers.push(supplier)
    }
    console.log(`✓ Leverancier: ${s.name}`)
  }

  const [microsoft, capgemini, exact, facility, nedap, konica, _siemens, adobe] = createdSuppliers

  // ── Contracten (compacte testset: 10 stuks) ──────────────────
  const now = new Date()
  const d = (offsetDays: number) => new Date(now.getTime() + offsetDays * 86400000)

  const contractsData = [
    {
      title: 'Microsoft 365 Enterprise Licentieovereenkomst',
      contractNumber: 'UL-2023-ICT-001',
      status: 'actief' as const,
      contractType: 'Leveringscontract',
      supplierId: microsoft.id,
      ownerUserId: manager.id,
      startDate: d(-730),
      endDate: d(25),
      optionDate: d(10),
      noticePeriodDays: 90,
      valueTotal: '285000',
      valueAnnual: '95000',
      currency: 'EUR',
      autoRenewal: true,
      autoRenewalTerms: 'Stilzwijgende verlenging met 1 jaar bij niet-opzegging 90 dagen voor afloop',
      retentionYears: 7,
    },
    {
      title: 'Capgemini IT Dienstverlening & Beheer',
      contractNumber: 'UL-2022-ICT-004',
      status: 'actief' as const,
      contractType: 'Dienstverleningscontract',
      supplierId: capgemini.id,
      ownerUserId: manager.id,
      startDate: d(-548),
      endDate: d(65),
      optionDate: d(35),
      noticePeriodDays: 60,
      valueTotal: '1200000',
      valueAnnual: '400000',
      currency: 'EUR',
      autoRenewal: false,
      retentionYears: 10,
    },
    {
      title: 'Exact ERP Software Licentie & Onderhoud',
      contractNumber: 'UL-2024-FIN-002',
      status: 'actief' as const,
      contractType: 'SLA',
      supplierId: exact.id,
      ownerUserId: manager.id,
      startDate: d(-180),
      endDate: d(185),
      noticePeriodDays: 60,
      valueTotal: '240000',
      valueAnnual: '60000',
      currency: 'EUR',
      autoRenewal: true,
      autoRenewalTerms: 'Jaarlijkse verlenging tenzij 60 dagen voor vervaldatum opgezegd',
      retentionYears: 7,
    },
    {
      title: 'Facilitaire Diensten Raamovereenkomst 2024',
      contractNumber: 'UL-2024-FAC-001',
      status: 'actief' as const,
      contractType: 'Raamovereenkomst',
      supplierId: facility.id,
      ownerUserId: registrator.id,
      startDate: d(-365),
      endDate: d(365),
      noticePeriodDays: 30,
      valueTotal: '500000',
      valueAnnual: '125000',
      currency: 'EUR',
      autoRenewal: false,
      retentionYears: 7,
    },
    {
      title: 'Nedap AEOS Toegangsbeheersysteem',
      contractNumber: 'UL-2021-SEC-003',
      status: 'actief' as const,
      contractType: 'Dienstverleningscontract',
      supplierId: nedap.id,
      ownerUserId: manager.id,
      startDate: d(-1095),
      endDate: d(270),
      noticePeriodDays: 90,
      valueTotal: '180000',
      valueAnnual: '45000',
      currency: 'EUR',
      autoRenewal: true,
      autoRenewalTerms: 'Automatische verlenging met 2 jaar',
      retentionYears: 7,
    },
    {
      title: 'Konica Minolta Printbeheer Overeenkomst',
      contractNumber: 'UL-2023-FAC-007',
      status: 'actief' as const,
      contractType: 'Leveringscontract',
      supplierId: konica.id,
      ownerUserId: registrator.id,
      startDate: d(-400),
      endDate: d(320),
      noticePeriodDays: 30,
      valueTotal: '90000',
      valueAnnual: '30000',
      currency: 'EUR',
      autoRenewal: false,
      retentionYears: 7,
    },
    {
      title: 'NDA Onderzoekssamenwerking Industrie',
      contractNumber: 'UL-2024-JUR-011',
      status: 'actief' as const,
      contractType: 'NDA',
      supplierId: capgemini.id,
      ownerUserId: admin.id,
      startDate: d(-90),
      endDate: d(275),
      noticePeriodDays: 30,
      valueTotal: null,
      valueAnnual: null,
      currency: 'EUR',
      autoRenewal: false,
      retentionYears: 5,
    },
    {
      title: 'Cloud Hosting SLA Primaire Systemen',
      contractNumber: 'UL-2023-ICT-012',
      status: 'actief' as const,
      contractType: 'SLA',
      supplierId: microsoft.id,
      ownerUserId: manager.id,
      startDate: d(-200),
      endDate: d(530),
      noticePeriodDays: 90,
      valueTotal: '360000',
      valueAnnual: '120000',
      currency: 'EUR',
      autoRenewal: true,
      autoRenewalTerms: 'Jaarlijkse verlenging',
      retentionYears: 7,
    },
    {
      title: 'Adobe Creative Cloud for Enterprise',
      contractNumber: 'UL-2024-ICT-018',
      status: 'actief' as const,
      contractType: 'Licentieovereenkomst',
      supplierId: adobe.id,
      ownerUserId: manager.id,
      startDate: d(-120),
      endDate: d(245),
      noticePeriodDays: 60,
      valueTotal: '420000',
      valueAnnual: '140000',
      currency: 'EUR',
      autoRenewal: true,
      autoRenewalTerms: 'Automatische jaarlijkse verlenging',
      retentionYears: 7,
    },
    {
      title: 'Concept: Nieuwe Datacenter Overeenkomst 2025',
      contractNumber: 'UL-2025-ICT-001',
      status: 'concept' as const,
      contractType: 'Leveringscontract',
      supplierId: capgemini.id,
      ownerUserId: registrator.id,
      startDate: d(30),
      endDate: d(1095),
      noticePeriodDays: 180,
      valueTotal: '900000',
      valueAnnual: '300000',
      currency: 'EUR',
      autoRenewal: false,
      retentionYears: 10,
    },
  ]

  const createdContracts: typeof schema.contracts.$inferSelect[] = []
  for (const [idx, c] of contractsData.entries()) {
    const existing = await db.query.contracts.findFirst({
      where: eq(schema.contracts.contractNumber, c.contractNumber!),
    })
    if (existing) {
      createdContracts.push(existing)
      console.log(`↩ Contract bestaat al: ${c.title}`)
      continue
    }

    const retentionYears = c.retentionYears ?? 7
    const destructionDate = c.endDate
      ? new Date(c.endDate.getTime() + retentionYears * 365 * 86400000)
      : null

    const [contract] = await db.insert(schema.contracts).values({
      orgId: org.id,
      projectId: createdProjects[idx % createdProjects.length].id,
      title: c.title,
      contractNumber: c.contractNumber,
      status: c.status,
      contractType: c.contractType,
      supplierId: c.supplierId,
      ownerUserId: c.ownerUserId,
      startDate: c.startDate,
      endDate: c.endDate,
      optionDate: (c as any).optionDate ?? null,
      noticePeriodDays: c.noticePeriodDays,
      valueTotal: c.valueTotal,
      valueAnnual: c.valueAnnual,
      currency: c.currency,
      autoRenewal: c.autoRenewal,
      autoRenewalTerms: (c as any).autoRenewalTerms ?? null,
      retentionYears,
      destructionDate,
      createdBy: admin.id,
      updatedAt: new Date(),
      archivedAt: (c as any).archivedAt ?? null,
      archivedBy: (c as any).archivedBy ?? null,
    }).returning()
    createdContracts.push(contract)
    console.log(`✓ Contract: ${contract.title}`)
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim() || null

  if (blobToken) {
    console.log('📤 Vercel Blob: per document uploaden (private), realistische contract-PDF’s onder seed/docs/<contract>/ …')
  } else {
    console.log('ℹ Geen BLOB_READ_WRITE_TOKEN — file_url wijst naar fallback demo-PDF; gegenereerde grootte blijft wel logisch')
  }

  // ── Contractdocumenten: per contract een paar PDF’s (Blob = eigen pad per bestand) ──
  const docSpecsPerContract: Array<{
    suffix: string
    seedDocKind: 'main' | 'annex' | 'order'
    documentKind: 'hoofdcontract' | 'addendum'
    versionNumber: number
  }> = [
    { suffix: 'hoofdovereenkomst.pdf', seedDocKind: 'main', documentKind: 'hoofdcontract', versionNumber: 1 },
    { suffix: 'bijlage-diensten.pdf', seedDocKind: 'annex', documentKind: 'addendum', versionNumber: 1 },
    { suffix: 'ondertekende-order.pdf', seedDocKind: 'order', documentKind: 'hoofdcontract', versionNumber: 2 },
  ]

  let documentsInserted = 0
  let blobUploadCount = 0

  for (let ci = 0; ci < createdContracts.length; ci++) {
    const c = createdContracts[ci]
    const cn = c.contractNumber
    if (!cn) continue

    for (let di = 0; di < docSpecsPerContract.length; di++) {
      const spec = docSpecsPerContract[di]
      const filename = `${cn}-${spec.suffix}`
      const exists = await db.query.contractDocuments.findFirst({
        where: and(eq(schema.contractDocuments.contractId, c.id), eq(schema.contractDocuments.filename, filename)),
      })
      if (exists) continue

      const supplierName = createdSuppliers.find((s) => s.id === c.supplierId)?.name ?? 'Onbekend'
      const pdfBuf = await buildSeedContractPdfBuffer({
        orgName: org.name,
        contractTitle: c.title,
        contractNumber: cn,
        supplierName,
        contractType: c.contractType ?? null,
        startDate: c.startDate ?? null,
        endDate: c.endDate ?? null,
        noticePeriodDays: c.noticePeriodDays ?? null,
        valueTotal: c.valueTotal != null ? String(c.valueTotal) : null,
        valueAnnual: c.valueAnnual != null ? String(c.valueAnnual) : null,
        currency: c.currency ?? null,
        autoRenewal: c.autoRenewal ?? null,
        autoRenewalTerms: c.autoRenewalTerms ?? null,
        seedDocKind: spec.seedDocKind,
        versionNumber: spec.versionNumber,
      })

      let fileUrl = DEMO_PDF_URL
      let fileSize = pdfBuf.length

      if (blobToken) {
        const path = `seed/docs/${blobSafeSegment(cn)}/${blobSafeSegment(filename)}`
        try {
          const up = await putSeedPdfBuffer(blobToken, path, pdfBuf)
          fileUrl = up.url
          fileSize = up.size
          blobUploadCount++
        } catch (e) {
          console.warn(`⚠ Blob-upload mislukt voor ${path}:`, e instanceof Error ? e.message : e)
        }
      }

      const uploadedBy = di % 2 === 0 ? registrator.id : manager.id
      await db.insert(schema.contractDocuments).values({
        contractId: c.id,
        filename,
        fileUrl,
        fileType: 'application/pdf',
        fileSize,
        versionNumber: spec.versionNumber,
        isCurrent: true,
        documentKind: spec.documentKind,
        uploadedBy,
        uploadedAt: d(-(20 + ci * 2 + di)),
        aiProcessed: di !== 1,
        aiExtractedDataJson: { source: 'compact-seed', contractNumber: cn, docIndex: di },
      })
      documentsInserted++
    }
  }

  if (blobToken) {
    console.log(`✓ ${blobUploadCount} PDF-objecten op Vercel Blob gezet (private)`)
  }
  console.log(`✓ ${documentsInserted} contractdocumenten toegevoegd (${docSpecsPerContract.length} per contract)`)

  // ── Verplichtingen ───────────────────────────────────────────
  const obligationsData = [
    { contractIdx: 0, description: 'Jaarlijkse licentie-audit indienen bij Microsoft', category: 'financial' as const, dueDate: d(20), status: 'open' as const },
    { contractIdx: 0, description: 'Verwerkersovereenkomst AVG actualiseren', category: 'privacy' as const, dueDate: d(15), status: 'in_progress' as const },
    { contractIdx: 1, description: 'Kwartaalrapportage SLA-naleving ontvangen Q1', category: 'it_security' as const, dueDate: d(30), status: 'open' as const },
    { contractIdx: 2, description: 'Jaarlijkse financiële afstemming Exact', category: 'financial' as const, dueDate: d(90), status: 'open' as const },
    { contractIdx: 3, description: 'Duurzaamheidsrapportage facilitaire partner', category: 'sustainability' as const, dueDate: d(120), status: 'open' as const },
    { contractIdx: 4, description: 'Penetratietest toegangsbeheersysteem', category: 'it_security' as const, dueDate: d(180), status: 'open' as const },
    { contractIdx: 8, description: 'Adobe seat-reconcile met procurement', category: 'financial' as const, dueDate: d(40), status: 'open' as const },
    { contractIdx: 9, description: 'Concept datacenter — definitieve offerte opvolgen', category: 'other' as const, dueDate: d(60), status: 'open' as const },
  ]

  for (const o of obligationsData) {
    const contract = createdContracts[o.contractIdx]
    if (!contract) continue
    await db.insert(schema.contractObligations).values({
      contractId: contract.id,
      description: o.description,
      category: o.category,
      dueDate: o.dueDate,
      status: o.status,
      recurring: false,
      extractedByAi: false,
    })
  }
  const extraObligationStatuses: Array<typeof schema.contractObligations.$inferInsert.status> = [
    'open',
    'in_progress',
    'compliant',
    'non_compliant',
  ]
  const extraObligationCategories: Array<typeof schema.contractObligations.$inferInsert.category> = [
    'it_security',
    'privacy',
    'financial',
    'sustainability',
    'other',
  ]
  let extraObligations = 0
  for (let i = 0; i < createdContracts.length; i++) {
    const contract = createdContracts[i]
    await db.insert(schema.contractObligations).values({
      contractId: contract.id,
      description: `Periodieke review voor ${contract.contractNumber ?? contract.id}`,
      category: extraObligationCategories[i % extraObligationCategories.length],
      dueDate: d(14 + i * 3),
      status: extraObligationStatuses[i % extraObligationStatuses.length],
      recurring: false,
      extractedByAi: false,
    })
    extraObligations++
  }
  console.log(`✓ ${obligationsData.length + extraObligations} verplichtingen aangemaakt`)

  // ── Notificatieregels ────────────────────────────────────────
  const notifData = [
    { contractIdx: 0, triggerType: 'days_before_end' as const, triggerValue: 30, recipients: ['p.vandenberg@universiteitleiden.nl', 's.janssen@universiteitleiden.nl'] },
    { contractIdx: 0, triggerType: 'days_before_option' as const, triggerValue: 14, recipients: ['s.janssen@universiteitleiden.nl'] },
    { contractIdx: 1, triggerType: 'days_before_end' as const, triggerValue: 60, recipients: ['s.janssen@universiteitleiden.nl'] },
    { contractIdx: 2, triggerType: 'days_before_end' as const, triggerValue: 90, recipients: ['t.degroot@universiteitleiden.nl'] },
    { contractIdx: 4, triggerType: 'days_before_end' as const, triggerValue: 90, recipients: ['s.janssen@universiteitleiden.nl'] },
    { contractIdx: 7, triggerType: 'days_before_end' as const, triggerValue: 90, recipients: ['p.vandenberg@universiteitleiden.nl'] },
    { contractIdx: 8, triggerType: 'days_before_end' as const, triggerValue: 60, recipients: ['s.janssen@universiteitleiden.nl'] },
  ]

  for (const n of notifData) {
    const contract = createdContracts[n.contractIdx]
    if (!contract) continue
    await db.insert(schema.notificationRules).values({
      contractId: contract.id,
      triggerType: n.triggerType,
      triggerValue: n.triggerValue,
      recipientsJson: n.recipients as any,
      channel: 'both',
      active: true,
    })
  }
  let extraNotifRules = 0
  for (let i = 0; i < createdContracts.length; i++) {
    await db.insert(schema.notificationRules).values({
      contractId: createdContracts[i].id,
      triggerType: 'days_before_end',
      triggerValue: 15 + (i % 6) * 15,
      recipientsJson: ['s.janssen@universiteitleiden.nl'] as any,
      channel: 'both',
      active: i % 5 !== 0,
    })
    extraNotifRules++
  }
  console.log(`✓ ${notifData.length + extraNotifRules} notificatieregels aangemaakt`)

  // ── Goedkeuringsworkflows ────────────────────────────────────
  const wfData = [
    { contractIdx: 9, type: 'new_contract' as const, status: 'pending' as const },
    { contractIdx: 1, type: 'renewal' as const, status: 'approved' as const },
    { contractIdx: 6, type: 'change' as const, status: 'rejected' as const },
  ]

  for (const w of wfData) {
    const contract = createdContracts[w.contractIdx]
    if (!contract) continue
    const steps = w.status === 'approved'
      ? [{ approver: admin.name, action: 'approved', approvedAt: d(-10).toISOString(), comment: 'Akkoord na budgetcontrole' }]
      : w.status === 'rejected'
        ? [{ approver: manager.name, action: 'rejected', rejectedAt: d(-5).toISOString(), comment: 'Aanvullende informatie vereist' }]
        : []

    await db.insert(schema.approvalWorkflows).values({
      contractId: contract.id,
      workflowType: w.type,
      status: w.status,
      stepsJson: steps as any,
      currentStep: steps.length,
      createdBy: admin.id,
      completedAt: w.status !== 'pending' ? d(-5) : null,
    })
  }
  console.log(`✓ 3 goedkeuringsworkflows aangemaakt`)

  // ── Auditlog ─────────────────────────────────────────────────
  const auditEntries = [
    { contractIdx: 0, action: 'contract.aangemaakt', userId: registrator.id, daysAgo: -180 },
    { contractIdx: 0, action: 'contract.bijgewerkt', userId: manager.id, daysAgo: -30, newValue: { status: 'actief' } },
    { contractIdx: 1, action: 'contract.aangemaakt', userId: registrator.id, daysAgo: -548 },
    { contractIdx: 6, action: 'contract.bijgewerkt', userId: admin.id, daysAgo: -15, newValue: { noticePeriodDays: 30 } },
    { contractIdx: 9, action: 'contract.concept_bijgewerkt', userId: registrator.id, daysAgo: -5, newValue: { status: 'concept' } },
    { contractIdx: 2, action: 'document.geupload', userId: registrator.id, daysAgo: -60, newValue: { filename: 'exact-contract-2024.pdf' } },
    { contractIdx: 3, action: 'gebruiker.rol_gewijzigd', userId: admin.id, daysAgo: -90, newValue: { role: 'registrator' } },
  ]

  for (const a of auditEntries) {
    const contract = createdContracts[a.contractIdx]
    if (!contract) continue
    await db.insert(schema.auditLog).values({
      orgId: org.id,
      contractId: contract.id,
      userId: a.userId,
      action: a.action,
      newValueJson: (a as any).newValue ?? null,
      createdAt: d(a.daysAgo),
    })
  }
  console.log(`✓ ${auditEntries.length} auditlog entries aangemaakt`)

  // ── Dashboard notificaties ───────────────────────────────────
  const dashNotifs = [
    { contractIdx: 0, title: '⚠️ Contract verloopt binnenkort', message: 'Microsoft 365 verloopt binnenkort. Controleer de optiedatum.', type: 'warning' },
    { contractIdx: 1, title: '⚠️ Actie vereist: Capgemini contract', message: 'Controleer eind- en optiedatum.', type: 'warning' },
    { contractIdx: 5, title: 'Notificatie: Konica Minolta', message: 'Contract evaluatie plannen.', type: 'info' },
  ]

  for (const n of dashNotifs) {
    const contract = createdContracts[n.contractIdx]
    if (!contract) continue
    await db.insert(schema.dashboardNotifications).values({
      orgId: org.id,
      contractId: contract.id,
      title: n.title,
      message: n.message,
      type: n.type,
      read: false,
    })
  }
  console.log(`✓ ${dashNotifs.length} dashboardmeldingen aangemaakt`)

  // ── Aangepaste velden ────────────────────────────────────────
  const fields = [
    { fieldName: 'Aanbestedingsnummer', fieldType: 'text' as const, required: false },
    { fieldName: 'Kostenplaats', fieldType: 'text' as const, required: true },
    { fieldName: 'Risicocategorie', fieldType: 'select' as const, required: false, optionsJson: ['Laag', 'Midden', 'Hoog', 'Kritiek'] },
    { fieldName: 'Jaarlijkse indexatie (%)', fieldType: 'number' as const, required: false },
    { fieldName: 'Laatste evaluatiedatum', fieldType: 'date' as const, required: false },
  ]

  for (const f of fields) {
    const existing = await db.query.customFields.findFirst({
      where: eq(schema.customFields.fieldName, f.fieldName),
    })
    if (!existing) {
      await db.insert(schema.customFields).values({
        orgId: org.id,
        fieldName: f.fieldName,
        fieldType: f.fieldType,
        optionsJson: (f as any).optionsJson ?? null,
        required: f.required,
      })
    }
  }
  console.log(`✓ ${fields.length} aangepaste velden aangemaakt`)

  console.log('\n✅ Testdata succesvol geladen!')
  console.log('\n📋 Inloggegevens (gebruik Clerk om echte accounts aan te maken):')
  console.log('   Organisatie: Universiteit Leiden')
  console.log('   Admin:       p.vandenberg@universiteitleiden.nl')
  console.log('   Manager:     s.janssen@universiteitleiden.nl')
  console.log('\n📊 Overzicht:')
  console.log(`   ${createdProjects.length} projecten`)
  console.log(`   ${createdContracts.length} contracten (compacte testset)`)
  console.log(`   ${createdSuppliers.length} leveranciers`)
  console.log(`   ${documentsInserted} contractdocumenten`)
  console.log(`   ${obligationsData.length + extraObligations} verplichtingen`)
  console.log(`   ${notifData.length + extraNotifRules} notificatieregels`)
  console.log('   3 goedkeuringsworkflows')
  console.log(`   ${fields.length} aangepaste metadatavelden`)
  process.exit(0)
}

seed().catch(e => {
  console.error('❌ Seed mislukt:', e.message)
  process.exit(1)
})
