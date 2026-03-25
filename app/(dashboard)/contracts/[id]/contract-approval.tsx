'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { formatDate } from '@/lib/utils'
import { CheckCircle, XCircle, Clock, Plus, Loader2, Trash2 } from 'lucide-react'
import { canApproveWorkflow, canMutateContractData } from '@/lib/permissions'

const STATUS_CONFIG = {
  pending: { label: 'In behandeling', variant: 'warning' as const, icon: Clock },
  approved: { label: 'Goedgekeurd', variant: 'success' as const, icon: CheckCircle },
  rejected: { label: 'Afgewezen', variant: 'danger' as const, icon: XCircle },
}

export function ContractApproval({ contract, user }: { contract: any; user: any }) {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [showAction, setShowAction] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null)
  const [comment, setComment] = useState('')
  const [type, setType] = useState('new_contract')
  const [loading, setLoading] = useState(false)
  const [steps, setSteps] = useState<{ approver: string }[]>([{ approver: '' }])

  const workflows = contract.approvalWorkflows ?? []

  async function handleCreateWorkflow() {
    setLoading(true)
    try {
      const validSteps = steps.filter(s => s.approver.trim())
      const res = await fetch('/api/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId: contract.id, workflowType: type, steps: validSteps }),
      })
      if (!res.ok) throw new Error()
      toast({ title: 'Goedkeuringsworkflow gestart' })
      setShowCreate(false)
      setSteps([{ approver: '' }])
      router.refresh()
    } catch {
      toast({ title: 'Fout', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  async function handleAction() {
    if (!showAction) return
    setLoading(true)
    try {
      const res = await fetch(`/api/approvals/${showAction.id}/${showAction.action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment }),
      })
      if (!res.ok) throw new Error()
      toast({ title: showAction.action === 'approve' ? 'Goedgekeurd' : 'Afgewezen' })
      setShowAction(null)
      setComment('')
      router.refresh()
    } catch {
      toast({ title: 'Fout', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {canMutateContractData(user.role) && (
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />Workflow starten
        </Button>
      )}

      {workflows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p className="text-sm">Geen goedkeuringsworkflows voor dit contract</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {workflows.map((wf: any) => {
            const s = STATUS_CONFIG[wf.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending
            const steps = (wf.stepsJson as any[]) ?? []
            return (
              <Card key={wf.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">
                      {wf.workflowType === 'new_contract' ? 'Nieuw contract' : wf.workflowType === 'change' ? 'Wijziging' : 'Verlenging'}
                    </CardTitle>
                    <Badge variant={s.variant}>{s.label}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Gestart: {formatDate(wf.createdAt)}
                    {wf.completedAt && ` · Afgerond: ${formatDate(wf.completedAt)}`}
                  </div>
                </CardHeader>
                <CardContent>
                  {steps.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {steps.map((step: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs ${step.status === 'approved' ? 'bg-green-500' : step.status === 'rejected' ? 'bg-red-500' : 'bg-gray-300'}`}>
                            {i + 1}
                          </div>
                          <span>{step.approver}</span>
                          {step.comment && <span className="text-muted-foreground">— {step.comment}</span>}
                          {step.approvedAt && <span className="text-muted-foreground">{formatDate(step.approvedAt)}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {wf.status === 'pending' && canApproveWorkflow(user.role) && (
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline" className="text-green-700 border-green-300" onClick={() => setShowAction({ id: wf.id, action: 'approve' })}>
                        <CheckCircle className="h-4 w-4 mr-1" />Goedkeuren
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-700 border-red-300" onClick={() => setShowAction({ id: wf.id, action: 'reject' })}>
                        <XCircle className="h-4 w-4 mr-1" />Afwijzen
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Goedkeuringsworkflow starten</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type workflow</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new_contract">Nieuw contract</SelectItem>
                  <SelectItem value="change">Wijziging</SelectItem>
                  <SelectItem value="renewal">Verlenging</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Goedkeuringsstappen</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSteps(prev => [...prev, { approver: '' }])}
                >
                  <Plus className="h-3 w-3 mr-1" />Stap toevoegen
                </Button>
              </div>
              <div className="space-y-2">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center shrink-0 font-medium">
                      {i + 1}
                    </div>
                    <input
                      type="text"
                      placeholder={`Naam of e-mail goedkeurder ${i + 1}`}
                      value={step.approver}
                      onChange={e => {
                        const updated = [...steps]
                        updated[i] = { approver: e.target.value }
                        setSteps(updated)
                      }}
                      className="flex-1 h-9 px-3 rounded-md border border-input bg-background text-sm"
                    />
                    {steps.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                        onClick={() => setSteps(prev => prev.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Voeg namen of e-mailadressen toe van de goedkeurders. Stappen worden sequentieel verwerkt.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Annuleren</Button>
            <Button onClick={handleCreateWorkflow} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Starten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showAction} onOpenChange={() => setShowAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{showAction?.action === 'approve' ? 'Goedkeuren' : 'Afwijzen'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Opmerking (optioneel)</Label>
            <Textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAction(null)}>Annuleren</Button>
            <Button
              variant={showAction?.action === 'reject' ? 'destructive' : 'default'}
              onClick={handleAction}
              disabled={loading}
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {showAction?.action === 'approve' ? 'Goedkeuren' : 'Afwijzen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
