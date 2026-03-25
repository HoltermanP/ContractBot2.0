import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { contracts, notificationRules, notificationsLog, dashboardNotifications, contractObligations } from '@/lib/db/schema'
import { eq, and, lt, isNotNull, ne } from 'drizzle-orm'
import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? 'placeholder')
}

export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  try {
    const now = new Date()
    let processed = 0

    // Get all active notification rules with their contracts
    const rules = await db.query.notificationRules.findMany({
      where: eq(notificationRules.active, true),
      with: { contractId: true } as any,
    })

    for (const rule of rules) {
      const contract = await db.query.contracts.findFirst({
        where: eq(contracts.id, rule.contractId),
      })
      if (!contract || contract.status === 'verwijderd') continue

      let shouldNotify = false
      let message = ''

      if (rule.triggerType === 'days_before_end' && contract.endDate && rule.triggerValue) {
        const daysLeft = Math.ceil((new Date(contract.endDate).getTime() - now.getTime()) / 86400000)
        if (daysLeft === rule.triggerValue || daysLeft === 0) {
          shouldNotify = true
          message = `Contract "${contract.title}" verloopt over ${daysLeft} dagen (${new Date(contract.endDate).toLocaleDateString('nl-NL')}).`
        }
      }

      if (rule.triggerType === 'days_before_option' && contract.optionDate && rule.triggerValue) {
        const daysLeft = Math.ceil((new Date(contract.optionDate).getTime() - now.getTime()) / 86400000)
        if (daysLeft === rule.triggerValue || daysLeft === 0) {
          shouldNotify = true
          message = `Optiedatum voor "${contract.title}" is over ${daysLeft} dagen.`
        }
      }

      if (rule.triggerType === 'obligation_due' && rule.triggerValue) {
        // Check for obligations coming due within triggerValue days
        const obligations = await db.query.contractObligations.findMany({
          where: and(
            eq(contractObligations.contractId, contract.id),
            ne(contractObligations.status, 'compliant')
          ),
        })
        const targetDate = new Date(now.getTime() + rule.triggerValue * 86400000)
        const dueObligations = obligations.filter(o => {
          if (!o.dueDate) return false
          const daysUntil = Math.ceil((new Date(o.dueDate).getTime() - now.getTime()) / 86400000)
          return daysUntil >= 0 && daysUntil <= rule.triggerValue!
        })
        const nonCompliant = obligations.filter(o => o.status === 'non_compliant')

        if (dueObligations.length > 0) {
          shouldNotify = true
          message = `${dueObligations.length} verplichting(en) voor "${contract.title}" zijn binnenkort verschuldigd.`
        }
        if (nonCompliant.length > 0) {
          shouldNotify = true
          const ncMsg = `${nonCompliant.length} niet-conforme verplichting(en) bij "${contract.title}" vereisen aandacht.`
          message = message ? `${message} ${ncMsg}` : ncMsg
        }
      }

      if (!shouldNotify) continue

      const recipients = Array.isArray(rule.recipientsJson) ? rule.recipientsJson as string[] : []

      // Send email notifications
      if ((rule.channel === 'email' || rule.channel === 'both') && recipients.length > 0) {
        const resend = getResend()
        for (const email of recipients) {
          try {
            await resend.emails.send({
              from: 'AI-Contractbot <noreply@contractbot.nl>',
              to: email,
              subject: `Contractmelding: ${contract.title}`,
              html: `<p>${message}</p><p><a href="${process.env.NEXT_PUBLIC_APP_URL}/contracts/${contract.id}">Contract bekijken</a></p>`,
            })
            await db.insert(notificationsLog).values({
              ruleId: rule.id,
              contractId: contract.id,
              recipientEmail: email,
              status: 'sent',
              message,
            })
          } catch {
            await db.insert(notificationsLog).values({
              ruleId: rule.id,
              contractId: contract.id,
              recipientEmail: email,
              status: 'failed',
              message,
            })
          }
        }
      }

      // Dashboard notification
      if (rule.channel === 'dashboard' || rule.channel === 'both') {
        await db.insert(dashboardNotifications).values({
          orgId: contract.orgId,
          contractId: contract.id,
          title: `Contractmelding: ${contract.title}`,
          message,
          type: 'warning',
          read: false,
        })
      }

      processed++
    }

    return NextResponse.json({ processed })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
