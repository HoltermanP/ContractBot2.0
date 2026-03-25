import { db, projects } from '@/lib/db'
import { and, eq } from 'drizzle-orm'

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
  const existing = await db.query.projects.findFirst({
    where: eq(projects.orgId, orgId),
    orderBy: (p, { asc }) => [asc(p.createdAt)],
  })
  if (existing) return existing.id
  const [created] = await db
    .insert(projects)
    .values({
      orgId,
      name: 'Algemeen',
      description: 'Standaardproject voor contracten',
    })
    .returning()
  return created.id
}

export async function requireProjectInOrg(projectId: string, orgId: string) {
  const row = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.orgId, orgId)),
  })
  if (!row) throw new Error('Project hoort niet bij uw organisatie of bestaat niet')
  return row
}
