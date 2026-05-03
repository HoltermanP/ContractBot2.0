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
      const json = await res.json() as { data?: { id?: string }; error?: string | null }
      if (!res.ok) throw new Error(json.error ?? 'Fout')
      const id = json.data?.id
      if (!id) throw new Error('Geen project-id in antwoord')
      toast({ title: 'Project aangemaakt' })
      setName('')
      setDescription('')
      router.push(`/projects/${id}`)
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
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="p-name" className="text-zinc-700">
            Naam
          </Label>
          <Input
            id="p-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bijv. Inkoop 2025"
            className="rounded-xl border-zinc-200"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-desc" className="font-normal text-zinc-500">
            Omschrijving (optioneel)
          </Label>
          <Textarea
            id="p-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="min-h-[72px] resize-y rounded-xl border-zinc-200"
          />
        </div>
      </div>
      <div className="flex justify-start border-t border-zinc-100 pt-4">
        <Button type="submit" disabled={loading} className="rounded-xl">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          Project aanmaken
        </Button>
      </div>
    </form>
  )
}
