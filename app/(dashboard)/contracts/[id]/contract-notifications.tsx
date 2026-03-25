'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@radix-ui/react-switch'
import { toast } from '@/hooks/use-toast'
import { Plus, Trash2, Sparkles, Loader2, Bell } from 'lucide-react'
import { canMutateContractData } from '@/lib/permissions'

const TRIGGER_LABELS: Record<string, string> = {
  days_before_end: 'Dagen voor einddatum',
  days_before_option: 'Dagen voor optiedatum',
  obligation_due: 'Verplichting vervalt',
  budget_threshold: 'Budget drempel',
}

const CHANNEL_LABELS: Record<string, string> = {
  email: 'E-mail',
  dashboard: 'Dashboard',
  both: 'E-mail & Dashboard',
}

export function ContractNotifications({ contract, user }: { contract: any; user: any }) {
  const router = useRouter()
  const [showDialog, setShowDialog] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    triggerType: 'days_before_end',
    triggerValue: '30',
    recipients: '',
    channel: 'both',
  })

  const canEdit = canMutateContractData(user.role)
  const rules = contract.notificationRules ?? []

  async function handleAdd() {
    setLoading(true)
    try {
      const recipients = form.recipients.split(',').map(r => r.trim()).filter(Boolean)
      const res = await fetch('/api/notifications/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId: contract.id,
          triggerType: form.triggerType,
          triggerValue: parseInt(form.triggerValue),
          recipientsJson: recipients,
          channel: form.channel,
        }),
      })
      if (!res.ok) throw new Error()
      toast({ title: 'Notificatieregel aangemaakt' })
      setShowDialog(false)
      router.refresh()
    } catch {
      toast({ title: 'Fout', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/notifications/rules/${id}`, { method: 'DELETE' })
    toast({ title: 'Regel verwijderd' })
    router.refresh()
  }

  async function generateFromAi() {
    setGenerating(true)
    try {
      const res = await fetch('/api/ai/notifications/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId: contract.id }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast({ title: `${data.created} notificatieregels aangemaakt door AI` })
      router.refresh()
    } catch {
      toast({ title: 'Fout', variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {canEdit && (
          <>
            <Button size="sm" onClick={() => setShowDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />Regel toevoegen
            </Button>
            <Button size="sm" variant="outline" onClick={generateFromAi} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              AI-notificaties genereren
            </Button>
          </>
        )}
      </div>

      <Card>
        <CardContent className="pt-4">
          {rules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Geen notificatieregels geconfigureerd</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule: any) => (
                <div key={rule.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <div className="font-medium text-sm">{TRIGGER_LABELS[rule.triggerType]}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {rule.triggerValue && `${rule.triggerValue} dagen · `}
                      {CHANNEL_LABELS[rule.channel]} ·{' '}
                      {Array.isArray(rule.recipientsJson) ? rule.recipientsJson.join(', ') : '—'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={rule.active ? 'success' : 'outline'}>{rule.active ? 'Actief' : 'Inactief'}</Badge>
                    {canEdit && (
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(rule.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Notificatieregel toevoegen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Trigger</Label>
              <Select value={form.triggerType} onValueChange={v => setForm(f => ({ ...f, triggerType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="days_before_end">Dagen voor einddatum</SelectItem>
                  <SelectItem value="days_before_option">Dagen voor optiedatum</SelectItem>
                  <SelectItem value="obligation_due">Verplichting vervalt</SelectItem>
                  <SelectItem value="budget_threshold">Budget drempel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Waarde (dagen)</Label>
              <Input type="number" value={form.triggerValue} onChange={e => setForm(f => ({ ...f, triggerValue: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Ontvangers (kommagescheiden e-mails)</Label>
              <Input placeholder="naam@organisatie.nl, manager@org.nl" value={form.recipients} onChange={e => setForm(f => ({ ...f, recipients: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Kanaal</Label>
              <Select value={form.channel} onValueChange={v => setForm(f => ({ ...f, channel: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="dashboard">Dashboard</SelectItem>
                  <SelectItem value="both">E-mail & Dashboard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Annuleren</Button>
            <Button onClick={handleAdd} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Aanmaken
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
