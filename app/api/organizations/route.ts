import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser, ensureOrgMembership } from '@/lib/auth'
import { db, organizations, organizationMembers } from '@/lib/db'
import { users, projects } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { slugifyOrganizationSlug } from '@/lib/org'

export async function GET() {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const rows = await db.query.organizationMembers.findMany({
      where: eq(organizationMembers.userId, user.id),
      with: { organization: true },
    })

    return NextResponse.json(
      rows.map((r) => ({
        orgId: r.orgId,
        role: r.role,
        name: r.organization?.name ?? '',
        slug: r.organization?.slug ?? '',
        isActive: r.orgId === user.orgId,
      }))
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body = await req.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 })

    let base = typeof body.slug === 'string' && body.slug.trim() ? slugifyOrganizationSlug(body.slug) : slugifyOrganizationSlug(name)
    let slug = base
    let n = 0
    while (await db.query.organizations.findFirst({ where: eq(organizations.slug, slug) })) {
      n += 1
      slug = `${base}-${n}`
    }

    const [org] = await db
      .insert(organizations)
      .values({ name, slug, settingsJson: {} })
      .returning()

    await db.insert(projects).values({
      orgId: org.id,
      name: 'Algemeen',
      description: 'Standaardproject voor contracten',
    })

    await ensureOrgMembership(user.id, org.id, 'admin')

    await db.update(users).set({ orgId: org.id, role: 'admin' }).where(eq(users.id, user.id))

    return NextResponse.json({ id: org.id, name: org.name, slug: org.slug })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
