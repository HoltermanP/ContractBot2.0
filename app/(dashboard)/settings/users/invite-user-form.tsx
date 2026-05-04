'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { Loader2, UserPlus } from 'lucide-react'

export function InviteUserForm({
  orgId,
  canAssignSuperAdmin = false,
}: {
  orgId: string
  canAssignSuperAdmin?: boolean
}) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('reader')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) {
      toast({ title: 'Vul een e-mailadres in', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/organizations/${orgId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
      })
      const json = (await res.json()) as { error?: string; path?: string }
      if (!res.ok) throw new Error(json.error ?? 'Fout')

      toast({
        title: 'Gebruiker uitgenodigd',
        description:
          json.path === 'invitation_created'
            ? 'Clerk stuurt een uitnodigingsmail om het account te activeren.'
            : 'De gebruiker is toegevoegd aan uw organisatie.',
      })
      setEmail('')
      router.refresh()
    } catch (err: unknown) {
      toast({
        title: err instanceof Error ? err.message : 'Uitnodigen mislukt',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-lg rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">Gebruiker uitnodigen</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Nieuwe gebruikers ontvangen een uitnodiging via Clerk. Bestaande gebruikers worden direct aan uw organisatie
          gekoppeld met de gekozen rol.
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="invite-user-email">E-mailadres</Label>
        <Input
          id="invite-user-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="naam@organisatie.nl"
          autoComplete="off"
        />
      </div>
      <div className="space-y-1">
        <Label>Rol in deze organisatie</Label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {canAssignSuperAdmin && <SelectItem value="super_admin">Super-admin (platform)</SelectItem>}
            <SelectItem value="admin">Beheerder</SelectItem>
            <SelectItem value="manager">Contractmanager</SelectItem>
            <SelectItem value="registrator">Contractregistrator</SelectItem>
            <SelectItem value="compliance">Compliance / audit</SelectItem>
            <SelectItem value="reader">Lezer</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
        Uitnodigen
      </Button>
    </form>
  )
}
