'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'

export function NewProjectForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast({ title: 'Projectnaam is verplicht', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Fout')
      toast({ title: 'Project aangemaakt' })
      setName('')
      setDescription('')
      router.push(`/projects/${json.id}`)
      router.refresh()
    } catch (err: unknown) {
      toast({
        title: err instanceof Error ? err.message : 'Mislukt',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
      <div className="space-y-1 flex-1 min-w-[200px]">
        <Label htmlFor="p-name">Nieuw project</Label>
        <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Naam" />
      </div>
      <div className="space-y-1 flex-[2] min-w-[220px]">
        <Label htmlFor="p-desc" className="text-muted-foreground font-normal">
          Omschrijving (optioneel)
        </Label>
        <Textarea id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={1} className="min-h-[40px]" />
      </div>
      <Button type="submit" disabled={loading} className="shrink-0">
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Aanmaken
      </Button>
    </form>
  )
}
