import { db, organizations, organisation, programme, project } from '@/lib/db'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

export function slugifyOrganizationSlug(input: string): string {
  const s = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72)
  return s || 'org'
}

/** Zorgt dat elke organisatie minstens één project heeft (bestaande databases / imports). */
export async function ensureDefaultProjectForOrg(orgId: string): Promise<string> {
  const parsedOrgId = z.string().uuid().safeParse(orgId)
  if (!parsedOrgId.success) throw new Error('Ongeldige organisatie-id')
  const normalizedOrgId = parsedOrgId.data

  // Nieuwe contract-management tabellen verwijzen naar `organisation`.
  // Na een volledige reset kan die tabel leeg zijn terwijl `organizations` nog wel gebruikt wordt.
  const genericOrg = await db.query.organisation.findFirst({
    where: eq(organisation.id, normalizedOrgId),
  })
  if (!genericOrg) {
    const legacyOrg = await db.query.organizations.findFirst({
      where: eq(organizations.id, normalizedOrgId),
    })
    if (!legacyOrg) {
      throw new Error('Organisatie niet gevonden')
    }
    await db.insert(organisation).values({
      id: normalizedOrgId,
      name: legacyOrg.name,
      slug: legacyOrg.slug,
    })
  }

  const existing = await db.query.project.findFirst({
    where: eq(project.organisationId, normalizedOrgId),
    orderBy: (p, { asc }) => [asc(p.createdAt)],
  })
  if (existing) return existing.id

  let defaultProgramme = await db.query.programme.findFirst({
    where: eq(programme.organisationId, normalizedOrgId),
    orderBy: (p, { asc }) => [asc(p.createdAt)],
  })
  if (!defaultProgramme) {
    ;[defaultProgramme] = await db
      .insert(programme)
      .values({
        organisationId: normalizedOrgId,
        name: 'Standaardprogramma',
        status: 'active',
      })
      .returning()
  }

  const [created] = await db
    .insert(project)
    .values({
      organisationId: normalizedOrgId,
      programmeId: defaultProgramme.id,
      name: 'Algemeen',
      status: 'active',
    })
    .returning()
  return created.id
}

export async function requireProjectInOrg(projectId: string, orgId: string) {
  const parsedOrgId = z.string().uuid().safeParse(orgId)
  if (!parsedOrgId.success) throw new Error('Ongeldige organisatie-id')

  const row = await db.query.project.findFirst({
    where: and(eq(project.id, projectId), eq(project.organisationId, parsedOrgId.data)),
  })
  if (!row) throw new Error('Project hoort niet bij uw organisatie of bestaat niet')
  return row
}
