'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { Plus, Loader2 } from 'lucide-react'

export function CustomFieldForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ fieldName: '', fieldType: 'text', required: false, options: '' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const optionsJson = form.fieldType === 'select' && form.options
        ? form.options.split(',').map(o => o.trim()).filter(Boolean)
        : null

      const res = await fetch('/api/custom-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, optionsJson }),
      })
      if (!res.ok) throw new Error()
      toast({ title: 'Veld aangemaakt' })
      setOpen(false)
      router.refresh()
    } catch {
      toast({ title: 'Fout', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />Veld toevoegen
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Veld toevoegen</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Veldnaam *</Label>
              <Input value={form.fieldName} onChange={e => setForm(f => ({ ...f, fieldName: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={form.fieldType} onValueChange={v => setForm(f => ({ ...f, fieldType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Tekst</SelectItem>
                  <SelectItem value="number">Getal</SelectItem>
                  <SelectItem value="date">Datum</SelectItem>
                  <SelectItem value="select">Keuzelijst</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.fieldType === 'select' && (
              <div className="space-y-1">
                <Label>Opties (kommagescheiden)</Label>
                <Input placeholder="Optie 1, Optie 2, Optie 3" value={form.options} onChange={e => setForm(f => ({ ...f, options: e.target.value }))} />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="required" checked={form.required} onChange={e => setForm(f => ({ ...f, required: e.target.checked }))} className="rounded" />
              <Label htmlFor="required">Verplicht veld</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Aanmaken
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
