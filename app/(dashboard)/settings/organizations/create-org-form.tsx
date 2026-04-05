'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'

export function CreateOrgForm() {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast({ title: 'Vul een organisatienaam in', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Fout')
      toast({ title: 'Organisatie aangemaakt', description: 'U werkt nu in de nieuwe organisatie als beheerder.' })
      setName('')
      setSlug('')
      // Hard reload zodat de OrgSwitcher (client component) de nieuwe org oppikt
      window.location.href = '/settings/organizations'
    } catch (err: unknown) {
      toast({
        title: err instanceof Error ? err.message : 'Aanmaken mislukt',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-md">
      <div className="space-y-1">
        <Label htmlFor="org-name">Naam *</Label>
        <Input
          id="org-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bijv. Gemeente Voorbeeld"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="org-slug">URL-slug (optioneel)</Label>
        <Input
          id="org-slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="Laat leeg voor automatische slug"
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Nieuwe organisatie aanmaken
      </Button>
    </form>
  )
}
