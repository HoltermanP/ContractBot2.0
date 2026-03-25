'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { formatDate, OBLIGATION_CATEGORY_LABELS } from '@/lib/utils'
import { Plus, Sparkles, CheckCircle, AlertCircle, Clock, Loader2 } from 'lucide-react'
import { canMutateContractData } from '@/lib/permissions'
import { pickDocumentWithAiExtract } from '@/lib/pick-contract-document'

const STATUS_MAP = {
  open: { label: 'Open', variant: 'outline' as const, icon: Clock },
  in_progress: { label: 'In behandeling', variant: 'warning' as const, icon: Clock },
  compliant: { label: 'Compliant', variant: 'success' as const, icon: CheckCircle },
  non_compliant: { label: 'Non-compliant', variant: 'danger' as const, icon: AlertCircle },
}

export function ContractObligations({ contract, user }: { contract: any; user: any }) {
  const router = useRouter()
  const [showDialog, setShowDialog] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ description: '', category: 'other', dueDate: '', status: 'open' })

  const canEdit = canMutateContractData(user.role)

  async function handleAdd() {
    setLoading(true)
    try {
      const res = await fetch('/api/obligations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, contractId: contract.id }),
      })
      if (!res.ok) throw new Error()
      toast({ title: 'Verplichting toegevoegd' })
      setShowDialog(false)
      router.refresh()
    } catch {
      toast({ title: 'Fout', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/obligations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    router.refresh()
  }

  async function generateFromAi() {
    setGenerating(true)
    try {
      const doc = pickDocumentWithAiExtract(contract.documents)
      if (!doc?.aiExtractedDataJson?.obligations?.length) {
        toast({ title: 'Geen AI-data beschikbaar', description: 'Upload eerst een document voor AI-extractie.' })
        return
      }
      const res = await fetch('/api/obligations/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId: contract.id, obligations: doc.aiExtractedDataJson.obligations }),
      })
      if (!res.ok) throw new Error()
      toast({ title: 'Verplichtingen gegenereerd door AI' })
      router.refresh()
    } catch {
      toast({ title: 'Fout', variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  const obligations = contract.obligations ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {canEdit && (
          <>
            <Button size="sm" onClick={() => setShowDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />Verplichting toevoegen
            </Button>
            <Button size="sm" variant="outline" onClick={generateFromAi} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Genereren via AI
            </Button>
          </>
        )}
      </div>

      <Card>
        <CardContent className="pt-4">
          {obligations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Geen verplichtingen geregistreerd</p>
          ) : (
            <div className="space-y-3">
              {obligations.map((obl: any) => {
                const s = STATUS_MAP[obl.status as keyof typeof STATUS_MAP] ?? STATUS_MAP.open
                return (
                  <div key={obl.id} className="flex items-start justify-between p-3 rounded-lg border">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{OBLIGATION_CATEGORY_LABELS[obl.category] ?? obl.category}</Badge>
                        {obl.extractedByAi && <Badge variant="secondary" className="text-xs"><Sparkles className="h-3 w-3 mr-1" />AI</Badge>}
                      </div>
                      <p className="text-sm">{obl.description}</p>
                      {obl.dueDate && <p className="text-xs text-muted-foreground mt-1">Vervaldatum: {formatDate(obl.dueDate)}</p>}
                    </div>
                    <div className="ml-4 shrink-0">
                      {canEdit ? (
                        <Select value={obl.status} onValueChange={v => updateStatus(obl.id, v)}>
                          <SelectTrigger className="w-36 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In behandeling</SelectItem>
                            <SelectItem value="compliant">Compliant</SelectItem>
                            <SelectItem value="non_compliant">Non-compliant</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={s.variant}>{s.label}</Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Verplichting toevoegen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Beschrijving</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Categorie</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="it_security">IT Security</SelectItem>
                    <SelectItem value="privacy">Privacy</SelectItem>
                    <SelectItem value="financial">Financieel</SelectItem>
                    <SelectItem value="sustainability">Duurzaamheid</SelectItem>
                    <SelectItem value="other">Overig</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Vervaldatum</Label>
                <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Annuleren</Button>
            <Button onClick={handleAdd} disabled={loading || !form.description}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Toevoegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
