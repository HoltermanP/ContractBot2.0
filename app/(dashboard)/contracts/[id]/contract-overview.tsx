'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { formatDate, formatCurrency, daysUntil, getExpiryBadgeClass, STATUS_LABELS } from '@/lib/utils'
import { Edit, Archive, Trash2, RotateCcw, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { toast } from '@/hooks/use-toast'
import {
  canArchiveOrUnarchiveContract,
  canDeleteContract,
  canEditContractOverview,
} from '@/lib/permissions'

export function ContractOverview({ contract, user }: { contract: any; user: any }) {
  const router = useRouter()
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [loading, setLoading] = useState(false)

  const days = daysUntil(contract.endDate)

  async function handleArchive() {
    setLoading(true)
    try {
      await fetch(`/api/contracts/${contract.id}/archive`, { method: 'PATCH' })
      toast({ title: 'Contract gearchiveerd' })
      router.refresh()
      setShowArchiveDialog(false)
    } catch {
      toast({ title: 'Fout bij archiveren', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    setLoading(true)
    try {
      await fetch(`/api/contracts/${contract.id}`, { method: 'DELETE' })
      toast({ title: 'Contract verwijderd' })
      router.push('/contracts')
    } catch {
      toast({ title: 'Fout bij verwijderen', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  async function handleUnarchive() {
    setLoading(true)
    try {
      const res = await fetch(`/api/contracts/${contract.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'actief' }),
      })
      if (res.ok) {
        toast({ title: 'Contract gedearchiveerd' })
        router.refresh()
      }
    } catch {
      toast({ title: 'Fout', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const canEdit = canEditContractOverview(user.role, contract, user.id)

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex items-center gap-2">
        {canEdit && contract.status !== 'verwijderd' && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/contracts/${contract.id}/edit`}>
              <Edit className="h-4 w-4 mr-2" />Bewerken
            </Link>
          </Button>
        )}
        {canArchiveOrUnarchiveContract(user.role) && contract.status !== 'gearchiveerd' && contract.status !== 'verwijderd' && (
          <Button variant="outline" size="sm" onClick={() => setShowArchiveDialog(true)}>
            <Archive className="h-4 w-4 mr-2" />Archiveren
          </Button>
        )}
        {contract.status === 'gearchiveerd' && canArchiveOrUnarchiveContract(user.role) && (
          <Button variant="outline" size="sm" onClick={handleUnarchive} disabled={loading}>
            <RotateCcw className="h-4 w-4 mr-2" />Dearchiveren
          </Button>
        )}
        {canDeleteContract(user.role) && contract.status !== 'verwijderd' && (
          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="h-4 w-4 mr-2" />Verwijderen
          </Button>
        )}
      </div>

      {/* Auto renewal warning */}
      {contract.autoRenewal && contract.endDate && (days ?? 999) < 90 && (
        <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
          <div className="text-sm text-orange-800">
            <strong>Let op: automatische verlenging</strong>
            <p className="mt-1">Dit contract verlengt automatisch. {contract.autoRenewalTerms && `Voorwaarden: ${contract.autoRenewalTerms}`}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Contractgegevens</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Status">
              <Badge variant={contract.status === 'actief' ? 'success' : contract.status === 'verlopen' ? 'danger' : 'outline'}>
                {STATUS_LABELS[contract.status]}
              </Badge>
            </Row>
            <Row label="Nummer">{contract.contractNumber ?? '—'}</Row>
            <Row label="Type">{contract.contractType ?? '—'}</Row>
            <Row label="Leverancier">{contract.supplier?.name ?? '—'}</Row>
            <Row label="Eigenaar">{contract.owner?.name ?? '—'}</Row>
            <Row label="Aangemaakt">{formatDate(contract.createdAt)}</Row>
            <Row label="Bijgewerkt">{formatDate(contract.updatedAt)}</Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Looptijd</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Startdatum">{formatDate(contract.startDate)}</Row>
            <Row label="Einddatum">
              {contract.endDate ? (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getExpiryBadgeClass(days)}`}>
                  {formatDate(contract.endDate)}
                  {days !== null && ` (${days > 0 ? `${days} dagen` : 'Verlopen'})`}
                </span>
              ) : '—'}
            </Row>
            <Row label="Optiedatum">{formatDate(contract.optionDate)}</Row>
            <Row label="Opzegtermijn">{contract.noticePeriodDays ? `${contract.noticePeriodDays} dagen` : '—'}</Row>
            <Row label="Automatische verlenging">{contract.autoRenewal ? 'Ja' : 'Nee'}</Row>
            {contract.autoRenewalTerms && <Row label="Verlengingsvoorwaarden">{contract.autoRenewalTerms}</Row>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Financiën</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Totale waarde">{formatCurrency(contract.valueTotal, contract.currency)}</Row>
            <Row label="Jaarwaarde">{formatCurrency(contract.valueAnnual, contract.currency)}</Row>
            <Row label="Valuta">{contract.currency ?? '—'}</Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Bewaring</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Bewaartermijn">{contract.retentionYears ? `${contract.retentionYears} jaar` : '—'}</Row>
            <Row label="Vernietigingsdatum">{formatDate(contract.destructionDate)}</Row>
            {contract.archivedAt && <Row label="Gearchiveerd op">{formatDate(contract.archivedAt)}</Row>}
          </CardContent>
        </Card>
      </div>

      {/* Archive Dialog */}
      <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contract archiveren</DialogTitle>
            <DialogDescription>
              Weet u zeker dat u &ldquo;{contract.title}&rdquo; wilt archiveren? Gearchiveerde contracten zijn niet meer zichtbaar voor lezers.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowArchiveDialog(false)}>Annuleren</Button>
            <Button onClick={handleArchive} disabled={loading}>Archiveren</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contract verwijderen</DialogTitle>
            <DialogDescription>
              <strong>Let op: deze actie is onomkeerbaar.</strong> Weet u zeker dat u &ldquo;{contract.title}&rdquo; permanent wilt verwijderen?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Annuleren</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>Definitief verwijderen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right ml-4">{children}</span>
    </div>
  )
}
