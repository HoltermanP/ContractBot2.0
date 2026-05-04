import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser, ensureOrgMembership, type UserRole } from '@/lib/auth'
import { db, organizations, organizationMembers } from '@/lib/db'
import { users, projects } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { slugifyOrganizationSlug } from '@/lib/org'
import { userFacingApiError } from '@/lib/user-facing-api-error'
import { isOrgAdminRole, isSuperAdmin } from '@/lib/permissions'

type OrgRow = {
  orgId: string
  role: string
  name: string
  slug: string
  isActive: boolean
}

export async function GET() {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const rows = await db.query.organizationMembers.findMany({
      where: eq(organizationMembers.userId, user.id),
      with: { organization: true },
    })

    const memberByOrgId = new Map(rows.map((r) => [r.orgId, r]))

    let organizationsList: OrgRow[]

    if (isOrgAdminRole(user.role)) {
      const defaultRole: UserRole = isSuperAdmin(user.role) ? 'super_admin' : 'admin'
      const allOrgs = await db.query.organizations.findMany({
        orderBy: (o, { asc }) => [asc(o.name)],
      })
      organizationsList = allOrgs.map((org) => {
        const m = memberByOrgId.get(org.id)
        return {
          orgId: org.id,
          role: m?.role ?? defaultRole,
          name: org.name,
          slug: org.slug,
          isActive: org.id === user.orgId,
        }
      })
    } else {
      organizationsList = rows.map((r) => ({
        orgId: r.orgId,
        role: r.role,
        name: r.organization?.name ?? '',
        slug: r.organization?.slug ?? '',
        isActive: r.orgId === user.orgId,
      }))
    }

    return NextResponse.json({
      organizations: organizationsList,
      isGlobalAdmin: isOrgAdminRole(user.role),
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: userFacingApiError(err) }, { status: 500 })
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

    const creatorOrgRole: UserRole = isSuperAdmin(user.role) ? 'super_admin' : 'admin'
    await ensureOrgMembership(user.id, org.id, creatorOrgRole)

    await db.update(users).set({ orgId: org.id, role: creatorOrgRole }).where(eq(users.id, user.id))

    return NextResponse.json({ id: org.id, name: org.name, slug: org.slug })
  } catch (err: unknown) {
    return NextResponse.json({ error: userFacingApiError(err) }, { status: 500 })
  }
}
