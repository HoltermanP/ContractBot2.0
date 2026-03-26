import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db, organizations } from '@/lib/db'
import { eq } from 'drizzle-orm'
import {
  DEFAULT_ORG_MODULE_VISIBILITY,
  getOrgModuleVisibilityFromSettings,
  mergeSettingsWithModuleVisibility,
  normalizeOrgModuleVisibility,
} from '@/lib/org-modules'
import { canManageOrgSettings } from '@/lib/permissions'

export async function GET() {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, user.orgId),
    })
    if (!org) return NextResponse.json({ error: 'Organisatie niet gevonden' }, { status: 404 })

    return NextResponse.json({
      modules: getOrgModuleVisibilityFromSettings(org.settingsJson),
      defaults: DEFAULT_ORG_MODULE_VISIBILITY,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    if (!canManageOrgSettings(user.role)) {
      return NextResponse.json({ error: 'Onvoldoende rechten' }, { status: 403 })
    }

    const body = await req.json()
    const modules = normalizeOrgModuleVisibility(body?.modules)

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, user.orgId),
    })
    if (!org) return NextResponse.json({ error: 'Organisatie niet gevonden' }, { status: 404 })

    const nextSettings = mergeSettingsWithModuleVisibility(org.settingsJson, modules)

    await db
      .update(organizations)
      .set({ settingsJson: nextSettings })
      .where(eq(organizations.id, org.id))

    return NextResponse.json({ ok: true, modules })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
