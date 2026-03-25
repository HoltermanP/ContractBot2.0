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
import { Loader2 } from 'lucide-react'

export function InviteMemberForm({ orgId }: { orgId: string }) {
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
      const res = await fetch(`/api/organizations/${orgId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Fout')
      toast({ title: 'Lid toegevoegd', description: 'De gebruiker kan deze organisatie kiezen via de org-switcher.' })
      setEmail('')
      router.refresh()
    } catch (err: unknown) {
      toast({
        title: err instanceof Error ? err.message : 'Toevoegen mislukt',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-md">
      <div className="space-y-1">
        <Label htmlFor="invite-email">E-mailadres (moet al een keer hebben ingelogd)</Label>
        <Input
          id="invite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="naam@organisatie.nl"
        />
      </div>
      <div className="space-y-1">
        <Label>Rol in deze organisatie</Label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Beheerder</SelectItem>
            <SelectItem value="manager">Contractmanager</SelectItem>
            <SelectItem value="registrator">Contractregistrator</SelectItem>
            <SelectItem value="compliance">Compliance / audit</SelectItem>
            <SelectItem value="reader">Lezer</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Toevoegen aan organisatie
      </Button>
    </form>
  )
}
