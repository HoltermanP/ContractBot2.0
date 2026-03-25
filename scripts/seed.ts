/**
 * Testdata seed script voor AI-Contractbot
 * Gebruik: npx tsx scripts/seed.ts
 */
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../lib/db/schema'
import { eq, and } from 'drizzle-orm'

/** Publieke demo-PDF (W3C testbestand) — bruikbaar voor download in de UI */
const DEMO_PDF_URL = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
const DEMO_PDF_URL_ALT = 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf'

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql, { schema })

async function seed() {
  console.log('🌱 Testdata laden...\n')

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

  const [microsoft, capgemini, exact, facility, nedap, konica, siemens, adobe, cisco, aws] = createdSuppliers

  // ── Contracten ───────────────────────────────────────────────
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
      title: 'Siemens Gebouwbeheer & Klimaatinstallaties',
      contractNumber: 'UL-2020-INF-002',
      status: 'verlopen' as const,
      contractType: 'Dienstverleningscontract',
      supplierId: siemens.id,
      ownerUserId: manager.id,
      startDate: d(-1460),
      endDate: d(-30),
      noticePeriodDays: 180,
      valueTotal: '2000000',
      valueAnnual: '400000',
      currency: 'EUR',
      autoRenewal: false,
      retentionYears: 10,
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
      title: 'Schoonmaakdiensten Academisch Gebouw',
      contractNumber: 'UL-2022-FAC-003',
      status: 'gearchiveerd' as const,
      contractType: 'Dienstverleningscontract',
      supplierId: facility.id,
      ownerUserId: registrator.id,
      startDate: d(-730),
      endDate: d(-180),
      noticePeriodDays: 60,
      valueTotal: '280000',
      valueAnnual: '140000',
      currency: 'EUR',
      autoRenewal: false,
      retentionYears: 7,
      archivedAt: d(-170),
      archivedBy: admin.id,
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
      title: 'Cisco Netwerk & Security Hardware-onderhoud',
      contractNumber: 'UL-2023-ICT-014',
      status: 'actief' as const,
      contractType: 'Onderhoudscontract',
      supplierId: cisco.id,
      ownerUserId: manager.id,
      startDate: d(-400),
      endDate: d(140),
      noticePeriodDays: 90,
      valueTotal: '310000',
      valueAnnual: '155000',
      currency: 'EUR',
      autoRenewal: false,
      retentionYears: 7,
    },
    {
      title: 'AWS Cloud Services Enterprise Agreement',
      contractNumber: 'UL-2024-ICT-022',
      status: 'actief' as const,
      contractType: 'Cloud SLA',
      supplierId: aws.id,
      ownerUserId: manager.id,
      startDate: d(-200),
      endDate: d(530),
      optionDate: d(480),
      noticePeriodDays: 90,
      valueTotal: '1800000',
      valueAnnual: '600000',
      currency: 'EUR',
      autoRenewal: true,
      autoRenewalTerms: 'Verlenging in lijn met AWS Enterprise Agreement',
      retentionYears: 10,
    },
    {
      title: 'Atlassian Cloud (Jira & Confluence) — implementatiepartner',
      contractNumber: 'UL-2023-ICT-016',
      status: 'actief' as const,
      contractType: 'Dienstverleningscontract',
      supplierId: capgemini.id,
      ownerUserId: registrator.id,
      startDate: d(-500),
      endDate: d(230),
      noticePeriodDays: 60,
      valueTotal: '195000',
      valueAnnual: '65000',
      currency: 'EUR',
      autoRenewal: false,
      retentionYears: 7,
    },
    {
      title: 'Back-up & disaster recovery managed services',
      contractNumber: 'UL-2022-ICT-019',
      status: 'actief' as const,
      contractType: 'SLA',
      supplierId: capgemini.id,
      ownerUserId: manager.id,
      startDate: d(-820),
      endDate: d(100),
      noticePeriodDays: 90,
      valueTotal: '480000',
      valueAnnual: '160000',
      currency: 'EUR',
      autoRenewal: true,
      retentionYears: 7,
    },
    {
      title: 'Telefonie & unified communications (Microsoft Teams Phone)',
      contractNumber: 'UL-2024-ICT-024',
      status: 'actief' as const,
      contractType: 'Leveringscontract',
      supplierId: microsoft.id,
      ownerUserId: registrator.id,
      startDate: d(-90),
      endDate: d(640),
      noticePeriodDays: 60,
      valueTotal: '275000',
      valueAnnual: '55000',
      currency: 'EUR',
      autoRenewal: false,
      retentionYears: 7,
    },
    {
      title: 'Beveiligingscamera’s & videobewaking campus (Nedap uitbreiding)',
      contractNumber: 'UL-2024-SEC-008',
      status: 'actief' as const,
      contractType: 'Leveringscontract',
      supplierId: nedap.id,
      ownerUserId: manager.id,
      startDate: d(-60),
      endDate: d(700),
      noticePeriodDays: 90,
      valueTotal: '125000',
      valueAnnual: '25000',
      currency: 'EUR',
      autoRenewal: false,
      retentionYears: 7,
    },
    {
      title: 'Waterstof- en energiebeheer pilot — Siemens (afgelopen)',
      contractNumber: 'UL-2019-INF-005',
      status: 'verlopen' as const,
      contractType: 'Onderzoekscontract',
      supplierId: siemens.id,
      ownerUserId: admin.id,
      startDate: d(-2000),
      endDate: d(-400),
      noticePeriodDays: 120,
      valueTotal: '150000',
      valueAnnual: '50000',
      currency: 'EUR',
      autoRenewal: false,
      retentionYears: 10,
    },
  ]

  const createdContracts: typeof schema.contracts.$inferSelect[] = []
  for (const c of contractsData) {
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
      projectId: mainProject.id,
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

  const contractByNumber = new Map(
    createdContracts
      .filter((c) => c.contractNumber)
      .map((c) => [c.contractNumber!, c]),
  )

  // ── Contractdocumenten (PDF’s als externe demo-URL’s) ────────
  const documentsSeed: {
    contractNumber: string
    filename: string
    fileUrl: string
    fileType: string
    fileSize: number
    versionNumber: number
    isCurrent: boolean
    aiProcessed?: boolean
    aiExtractedDataJson?: Record<string, unknown>
    uploadedDaysAgo: number
    uploadedByUser: typeof admin
    documentKind?: 'hoofdcontract' | 'addendum'
  }[] = [
    { contractNumber: 'UL-2023-ICT-001', filename: 'Microsoft-365-EA-2023-ondertekend.pdf', fileUrl: DEMO_PDF_URL, fileType: 'application/pdf', fileSize: 284_912, versionNumber: 1, isCurrent: true, aiProcessed: true, aiExtractedDataJson: { leverancier: 'Microsoft', type: 'Enterprise Agreement', taal: 'nl' }, uploadedDaysAgo: 120, uploadedByUser: registrator },
    { contractNumber: 'UL-2023-ICT-001', filename: 'Bijlage-DPA-M365.pdf', fileUrl: DEMO_PDF_URL_ALT, fileType: 'application/pdf', fileSize: 512_000, versionNumber: 2, isCurrent: true, aiProcessed: true, uploadedDaysAgo: 45, uploadedByUser: manager, documentKind: 'addendum' },
    { contractNumber: 'UL-2022-ICT-004', filename: 'Capgemini-SLA-dienstverlening.pdf', fileUrl: DEMO_PDF_URL, fileType: 'application/pdf', fileSize: 1_024_000, versionNumber: 1, isCurrent: true, aiProcessed: true, uploadedDaysAgo: 200, uploadedByUser: registrator },
    { contractNumber: 'UL-2022-ICT-004', filename: 'Bijlage-pen-test-Q4.pdf', fileUrl: DEMO_PDF_URL_ALT, fileType: 'application/pdf', fileSize: 198_000, versionNumber: 2, isCurrent: true, aiProcessed: false, uploadedDaysAgo: 12, uploadedByUser: manager, documentKind: 'addendum' },
    { contractNumber: 'UL-2024-FIN-002', filename: 'Exact-ERP-licentie-2024.pdf', fileUrl: DEMO_PDF_URL, fileType: 'application/pdf', fileSize: 445_200, versionNumber: 1, isCurrent: true, aiProcessed: true, uploadedDaysAgo: 60, uploadedByUser: registrator },
    { contractNumber: 'UL-2024-FAC-001', filename: 'Raamcontract-facilitair-2024.pdf', fileUrl: DEMO_PDF_URL, fileType: 'application/pdf', fileSize: 890_000, versionNumber: 1, isCurrent: true, aiProcessed: true, uploadedDaysAgo: 300, uploadedByUser: registrator },
    { contractNumber: 'UL-2021-SEC-003', filename: 'Nedap-AEOS-overeenkomst.pdf', fileUrl: DEMO_PDF_URL_ALT, fileType: 'application/pdf', fileSize: 620_000, versionNumber: 1, isCurrent: true, aiProcessed: true, uploadedDaysAgo: 400, uploadedByUser: manager },
    { contractNumber: 'UL-2023-FAC-007', filename: 'Konica-printbeheer-contract.pdf', fileUrl: DEMO_PDF_URL, fileType: 'application/pdf', fileSize: 310_000, versionNumber: 1, isCurrent: true, aiProcessed: false, uploadedDaysAgo: 150, uploadedByUser: registrator },
    { contractNumber: 'UL-2020-INF-002', filename: 'Siemens-gebouwbeheer-archief.pdf', fileUrl: DEMO_PDF_URL, fileType: 'application/pdf', fileSize: 2_100_000, versionNumber: 1, isCurrent: true, aiProcessed: true, uploadedDaysAgo: 800, uploadedByUser: manager },
    { contractNumber: 'UL-2024-JUR-011', filename: 'NDA-onderzoekssamenwerking.pdf', fileUrl: DEMO_PDF_URL, fileType: 'application/pdf', fileSize: 88_000, versionNumber: 1, isCurrent: true, aiProcessed: true, uploadedDaysAgo: 85, uploadedByUser: admin },
    { contractNumber: 'UL-2023-ICT-012', filename: 'Azure-hosting-SLA.pdf', fileUrl: DEMO_PDF_URL_ALT, fileType: 'application/pdf', fileSize: 412_000, versionNumber: 1, isCurrent: true, aiProcessed: true, uploadedDaysAgo: 100, uploadedByUser: manager },
    { contractNumber: 'UL-2025-ICT-001', filename: 'CONCEPT-datacenter-RFP-antwoord.pdf', fileUrl: DEMO_PDF_URL, fileType: 'application/pdf', fileSize: 1_200_000, versionNumber: 1, isCurrent: true, aiProcessed: false, uploadedDaysAgo: 5, uploadedByUser: registrator },
    { contractNumber: 'UL-2024-ICT-018', filename: 'Adobe-CCE-orderformulier.pdf', fileUrl: DEMO_PDF_URL, fileType: 'application/pdf', fileSize: 356_000, versionNumber: 1, isCurrent: true, aiProcessed: true, uploadedDaysAgo: 30, uploadedByUser: manager },
    { contractNumber: 'UL-2024-ICT-018', filename: 'Adobe-productvoorwaarden-bijlage.pdf', fileUrl: DEMO_PDF_URL_ALT, fileType: 'application/pdf', fileSize: 720_000, versionNumber: 2, isCurrent: true, aiProcessed: false, uploadedDaysAgo: 28, uploadedByUser: registrator, documentKind: 'addendum' },
    { contractNumber: 'UL-2023-ICT-014', filename: 'Cisco-SmartNet-overzicht.pdf', fileUrl: DEMO_PDF_URL, fileType: 'application/pdf', fileSize: 501_000, versionNumber: 1, isCurrent: true, aiProcessed: true, uploadedDaysAgo: 90, uploadedByUser: manager },
    { contractNumber: 'UL-2024-ICT-022', filename: 'AWS-Enterprise-Agreement-samenvatting.pdf', fileUrl: DEMO_PDF_URL_ALT, fileType: 'application/pdf', fileSize: 980_000, versionNumber: 1, isCurrent: true, aiProcessed: true, uploadedDaysAgo: 40, uploadedByUser: manager },
    { contractNumber: 'UL-2024-ICT-022', filename: 'AWS-bijlage-verwerkersovereenkomst.pdf', fileUrl: DEMO_PDF_URL, fileType: 'application/pdf', fileSize: 240_000, versionNumber: 2, isCurrent: true, aiProcessed: true, uploadedDaysAgo: 38, uploadedByUser: registrator, documentKind: 'addendum' },
    { contractNumber: 'UL-2023-ICT-016', filename: 'Atlassian-cloud-state-of-work.pdf', fileUrl: DEMO_PDF_URL, fileType: 'application/pdf', fileSize: 190_000, versionNumber: 1, isCurrent: true, aiProcessed: false, uploadedDaysAgo: 120, uploadedByUser: registrator },
    { contractNumber: 'UL-2022-ICT-019', filename: 'DR-runbook-en-SLA.pdf', fileUrl: DEMO_PDF_URL_ALT, fileType: 'application/pdf', fileSize: 640_000, versionNumber: 1, isCurrent: true, aiProcessed: true, uploadedDaysAgo: 200, uploadedByUser: manager },
    { contractNumber: 'UL-2024-ICT-024', filename: 'Teams-Phone-overeenkomst.pdf', fileUrl: DEMO_PDF_URL, fileType: 'application/pdf', fileSize: 275_000, versionNumber: 1, isCurrent: true, aiProcessed: true, uploadedDaysAgo: 25, uploadedByUser: registrator },
    { contractNumber: 'UL-2024-SEC-008', filename: 'Nedap-camera-installatie-PO.pdf', fileUrl: DEMO_PDF_URL, fileType: 'application/pdf', fileSize: 155_000, versionNumber: 1, isCurrent: true, aiProcessed: false, uploadedDaysAgo: 14, uploadedByUser: manager },
    { contractNumber: 'UL-2019-INF-005', filename: 'Siemens-energie-pilot-eindrapport.pdf', fileUrl: DEMO_PDF_URL, fileType: 'application/pdf', fileSize: 3_200_000, versionNumber: 1, isCurrent: true, aiProcessed: true, uploadedDaysAgo: 380, uploadedByUser: admin },
  ]

  let documentsInserted = 0
  for (const doc of documentsSeed) {
    const contract = contractByNumber.get(doc.contractNumber)
    if (!contract) {
      console.warn(`⚠ Document overgeslagen: onbekend contractnummer ${doc.contractNumber}`)
      continue
    }
    const exists = await db.query.contractDocuments.findFirst({
      where: and(
        eq(schema.contractDocuments.contractId, contract.id),
        eq(schema.contractDocuments.filename, doc.filename),
      ),
    })
    if (exists) continue

    await db.insert(schema.contractDocuments).values({
      contractId: contract.id,
      filename: doc.filename,
      fileUrl: doc.fileUrl,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      versionNumber: doc.versionNumber,
      isCurrent: doc.isCurrent,
      documentKind: doc.documentKind ?? 'hoofdcontract',
      uploadedBy: doc.uploadedByUser.id,
      uploadedAt: d(-doc.uploadedDaysAgo),
      aiProcessed: doc.aiProcessed ?? false,
      aiExtractedDataJson: doc.aiExtractedDataJson ?? null,
    })
    documentsInserted++
  }
  console.log(`✓ ${documentsInserted} contractdocumenten toegevoegd (${documentsSeed.length} in catalogus)`)

  // ── Verplichtingen ───────────────────────────────────────────
  const obligationsData = [
    { contractIdx: 0, description: 'Jaarlijkse licentie-audit indienen bij Microsoft', category: 'financial' as const, dueDate: d(20), status: 'open' as const },
    { contractIdx: 0, description: 'Verwerkersovereenkomst AVG actualiseren', category: 'privacy' as const, dueDate: d(15), status: 'in_progress' as const },
    { contractIdx: 0, description: 'ISO 27001 certificaat leverancier verifiëren', category: 'it_security' as const, dueDate: d(5), status: 'open' as const },
    { contractIdx: 1, description: 'Kwartaalrapportage SLA-naleving ontvangen Q1', category: 'it_security' as const, dueDate: d(30), status: 'open' as const },
    { contractIdx: 1, description: 'Jaarlijkse evaluatie dienstverleningsniveau', category: 'financial' as const, dueDate: d(60), status: 'open' as const },
    { contractIdx: 1, description: 'Beveiligingsscan resultaten beoordelen', category: 'it_security' as const, dueDate: d(-10), status: 'non_compliant' as const },
    { contractIdx: 2, description: 'Softwareupdate v14.2 testen en goedkeuren', category: 'it_security' as const, dueDate: d(45), status: 'in_progress' as const },
    { contractIdx: 2, description: 'Jaarlijkse financiële afstemming', category: 'financial' as const, dueDate: d(90), status: 'open' as const },
    { contractIdx: 3, description: 'Duurzaamheidsrapportage facilitaire partner', category: 'sustainability' as const, dueDate: d(120), status: 'open' as const },
    { contractIdx: 4, description: 'Penetratietest toegangsbeheersysteem', category: 'it_security' as const, dueDate: d(180), status: 'open' as const },
    { contractIdx: 4, description: 'Privacyimpactanalyse biometrie bijwerken', category: 'privacy' as const, dueDate: d(60), status: 'compliant' as const },
    { contractIdx: 8, description: 'Uptime SLA 99.9% kwartaalrapportage', category: 'it_security' as const, dueDate: d(45), status: 'compliant' as const },
    { contractIdx: 8, description: 'Disaster recovery test uitvoeren', category: 'it_security' as const, dueDate: d(90), status: 'open' as const },
    { contractIdx: 11, description: 'Adobe seat-reconcile met procurement', category: 'financial' as const, dueDate: d(40), status: 'open' as const },
    { contractIdx: 12, description: 'Cisco firmware lifecycle review campus switches', category: 'it_security' as const, dueDate: d(55), status: 'in_progress' as const },
    { contractIdx: 13, description: 'AWS cost optimization review kwartaal', category: 'financial' as const, dueDate: d(25), status: 'open' as const },
    { contractIdx: 14, description: 'Atlassian gebruikerslicenties inventariseren', category: 'it_security' as const, dueDate: d(70), status: 'open' as const },
    { contractIdx: 15, description: 'DR-test jaarlijks uitvoeren en rapporteren', category: 'it_security' as const, dueDate: d(95), status: 'open' as const },
    { contractIdx: 16, description: 'Teams Phone nummerplan actualiseren', category: 'other' as const, dueDate: d(110), status: 'open' as const },
    { contractIdx: 17, description: 'Privacy DPIA cameratoezicht campus bijwerken', category: 'privacy' as const, dueDate: d(50), status: 'in_progress' as const },
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
  console.log(`✓ ${obligationsData.length} verplichtingen aangemaakt`)

  // ── Notificatieregels ────────────────────────────────────────
  const notifData = [
    { contractIdx: 0, triggerType: 'days_before_end' as const, triggerValue: 30, recipients: ['p.vandenberg@universiteitleiden.nl', 's.janssen@universiteitleiden.nl'] },
    { contractIdx: 0, triggerType: 'days_before_option' as const, triggerValue: 14, recipients: ['s.janssen@universiteitleiden.nl'] },
    { contractIdx: 1, triggerType: 'days_before_end' as const, triggerValue: 60, recipients: ['s.janssen@universiteitleiden.nl'] },
    { contractIdx: 1, triggerType: 'days_before_option' as const, triggerValue: 30, recipients: ['p.vandenberg@universiteitleiden.nl'] },
    { contractIdx: 2, triggerType: 'days_before_end' as const, triggerValue: 90, recipients: ['t.degroot@universiteitleiden.nl'] },
    { contractIdx: 4, triggerType: 'days_before_end' as const, triggerValue: 90, recipients: ['s.janssen@universiteitleiden.nl'] },
    { contractIdx: 8, triggerType: 'days_before_end' as const, triggerValue: 90, recipients: ['p.vandenberg@universiteitleiden.nl'] },
    { contractIdx: 13, triggerType: 'days_before_end' as const, triggerValue: 120, recipients: ['s.janssen@universiteitleiden.nl', 'p.vandenberg@universiteitleiden.nl'] },
    { contractIdx: 12, triggerType: 'days_before_end' as const, triggerValue: 60, recipients: ['s.janssen@universiteitleiden.nl'] },
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
  console.log(`✓ ${notifData.length} notificatieregels aangemaakt`)

  // ── Goedkeuringsworkflows ────────────────────────────────────
  const wfData = [
    { contractIdx: 10, type: 'new_contract' as const, status: 'pending' as const },
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
    { contractIdx: 6, action: 'contract.bijgewerkt', userId: admin.id, daysAgo: -15, newValue: { noticePeriodDays: 180 } },
    { contractIdx: 9, action: 'contract.gearchiveerd', userId: admin.id, daysAgo: -170, newValue: { status: 'gearchiveerd' } },
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
    { contractIdx: 0, title: '⚠️ Contract verloopt binnenkort', message: 'Microsoft 365 verloopt over 25 dagen. Controleer de optiedatum.', type: 'warning' },
    { contractIdx: 1, title: '⚠️ Actie vereist: Capgemini contract', message: 'Contract verloopt over 65 dagen. Optiedatum is over 35 dagen.', type: 'warning' },
    { contractIdx: 1, title: '🔴 Non-compliance gedetecteerd', message: 'Beveiligingsscan resultaten zijn niet tijdig beoordeeld.', type: 'error' },
    { contractIdx: 5, title: 'Notificatie: Konica Minolta', message: 'Contract verlenging binnenkort. Evalueer de prestatiecijfers.', type: 'info' },
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
  console.log(`   ${contractsData.length} contracten (actief/verlopen/gearchiveerd/concept)`)
  console.log(`   ${suppliersData.length} leveranciers`)
  console.log(`   ${documentsSeed.length} contractdocumenten (PDF-koppelingen, idempotent)`)
  console.log(`   ${obligationsData.length} verplichtingen`)
  console.log(`   ${notifData.length} notificatieregels`)
  console.log('   3 goedkeuringsworkflows')
  console.log(`   ${fields.length} aangepaste metadatavelden`)
  process.exit(0)
}

seed().catch(e => {
  console.error('❌ Seed mislukt:', e.message)
  process.exit(1)
})
