import { NextRequest, NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { organizationMembers, organizations, users } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import type { UserRole } from '@/lib/auth'
import { canAssignSuperAdmin, canManageUsers } from '@/lib/permissions'

function appBaseUrl() {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, '').replace(/\/$/, '')
    return `https://${host}`
  }
  return 'http://localhost:3000'.replace(/\/$/, '')
}

function allowedInviteRoles(forUser: { role: UserRole }): UserRole[] {
  const base: UserRole[] = ['admin', 'manager', 'registrator', 'compliance', 'reader']
  if (canAssignSuperAdmin(forUser.role)) {
    return [...base, 'super_admin']
  }
  return base
}

function messageFromClerkError(err: unknown): string {
  if (err && typeof err === 'object' && 'errors' in err) {
    const e = err as { errors?: Array<{ message?: string; longMessage?: string }> }
    const first = e.errors?.[0]
    if (first?.longMessage) return first.longMessage
    if (first?.message) return first.message
  }
  if (err instanceof Error && err.message && err.message !== 'Bad Request') return err.message
  return 'Uitnodigen mislukt (Clerk). Controleer Clerk-dashboard: uitnodigingen aan, redirect-URL toegestaan.'
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    if (user.orgId !== orgId) return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    if (!canManageUsers(user.role)) return NextResponse.json({ error: 'Geen rechten' }, { status: 403 })

    const orgExists = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      columns: { id: true },
    })
    if (!orgExists) return NextResponse.json({ error: 'Organisatie niet gevonden' }, { status: 404 })

    const body = await req.json()
    const emailRaw = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const roleRaw = typeof body.role === 'string' ? body.role.trim() : ''
    const role = roleRaw as UserRole

    const allowed = allowedInviteRoles(user)
    if (!emailRaw) {
      return NextResponse.json({ error: 'Vul een geldig e-mailadres in' }, { status: 400 })
    }
    if (!roleRaw || !allowed.includes(role as UserRole)) {
      return NextResponse.json({ error: 'De gekozen rol is niet geldig of niet toegestaan voor uw account' }, { status: 400 })
    }
    if (role === 'super_admin' && !canAssignSuperAdmin(user.role)) {
      return NextResponse.json({ error: 'Alleen super-admin kan deze rol toekennen' }, { status: 403 })
    }

    const baseUrl = appBaseUrl()

    const target = await db.query.users.findFirst({ where: eq(users.email, emailRaw) })

    if (target) {
      const existing = await db.query.organizationMembers.findFirst({
        where: and(eq(organizationMembers.userId, target.id), eq(organizationMembers.orgId, orgId)),
      })
      if (existing) {
        return NextResponse.json({ error: 'Gebruiker is al lid van deze organisatie' }, { status: 409 })
      }

      await db.insert(organizationMembers).values({ userId: target.id, orgId, role })

      if (target.orgId === orgId) {
        await db.update(users).set({ role }).where(eq(users.id, target.id))
      }

      try {
        const client = await clerkClient()
        const clerkUser = await client.users.getUser(target.clerkId)
        await client.users.updateUser(target.clerkId, {
          publicMetadata: {
            ...(typeof clerkUser.publicMetadata === 'object' && clerkUser.publicMetadata !== null
              ? clerkUser.publicMetadata
              : {}),
            role,
          },
        })
      } catch {
        /* Clerk-sync is best-effort; applicatie gebruikt DB-rol */
      }

      return NextResponse.json({ ok: true, userId: target.id, path: 'existing_db_user' })
    }

    const client = await clerkClient()

    try {
      await client.invitations.createInvitation({
        emailAddress: emailRaw,
        /** Naar sign-up zodat Clerk de uitnodiging/token op jullie domein kan afhandelen; daarna door naar dashboard (fallback op SignUp). */
        redirectUrl: `${baseUrl}/sign-up`,
        /** Anders faalt Clerk met o.a. "Bad Request" bij tweede uitnodiging of openstaande invite. */
        ignoreExisting: true,
        publicMetadata: {
          role,
          invited_org_id: orgId,
        },
      })
    } catch (invErr: unknown) {
      const list = await client.users.getUserList({ emailAddress: [emailRaw] })
      if (list.data.length === 0) {
        return NextResponse.json({ error: messageFromClerkError(invErr) }, { status: 400 })
      }

      const cu = list.data[0]
      const primaryEmail =
        cu.emailAddresses.find((e) => e.id === cu.primaryEmailAddressId)?.emailAddress ??
        cu.emailAddresses[0]?.emailAddress ??
        emailRaw
      const name = (`${cu.firstName ?? ''} ${cu.lastName ?? ''}`.trim()) || primaryEmail

      let dbUser = await db.query.users.findFirst({ where: eq(users.clerkId, cu.id) })
      if (!dbUser) {
        const [created] = await db
          .insert(users)
          .values({
            clerkId: cu.id,
            orgId,
            role,
            name,
            email: primaryEmail.toLowerCase(),
          })
          .returning()
        dbUser = created
      }

      const mem = await db.query.organizationMembers.findFirst({
        where: and(eq(organizationMembers.userId, dbUser.id), eq(organizationMembers.orgId, orgId)),
      })
      if (!mem) {
        await db.insert(organizationMembers).values({ userId: dbUser.id, orgId, role })
      }

      if (!dbUser.orgId) {
        await db.update(users).set({ orgId, role }).where(eq(users.id, dbUser.id))
      }

      try {
        const clerkUser = await client.users.getUser(cu.id)
        await client.users.updateUser(cu.id, {
          publicMetadata: {
            ...(typeof clerkUser.publicMetadata === 'object' && clerkUser.publicMetadata !== null
              ? clerkUser.publicMetadata
              : {}),
            role,
            invited_org_id: orgId,
          },
        })
      } catch {
        /* best-effort */
      }

      return NextResponse.json({ ok: true, userId: dbUser.id, path: 'clerk_without_db' })
    }

    return NextResponse.json({ ok: true, path: 'invitation_created' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
