'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import { Loader2, Upload, Sparkles } from 'lucide-react'

interface Supplier { id: string; name: string }
interface User { id: string; name: string }
interface ProjectOption { id: string; name: string }
interface AuthUser { id: string; orgId: string; role: string }
interface CustomField { id: string; fieldName: string; fieldType: string; optionsJson: unknown; required: boolean | null }

interface ContractData {
  projectId: string
  title: string
  contractNumber: string
  status: string
  contractType: string
  supplierId: string
  ownerUserId: string
  startDate: string
  endDate: string
  optionDate: string
  noticePeriodDays: string
  valueTotal: string
  valueAnnual: string
  currency: string
  autoRenewal: boolean
  autoRenewalTerms: string
  retentionYears: string
}

export function ContractForm({
  suppliers,
  users,
  projects = [],
  currentUser,
  initialData,
  contractId,
  customFields = [],
  initialCustomValues = {},
}: {
  suppliers: Supplier[]
  users: User[]
  projects?: ProjectOption[]
  currentUser: AuthUser
  initialData?: Partial<ContractData>
  contractId?: string
  customFields?: CustomField[]
  initialCustomValues?: Record<string, string>
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [customValues, setCustomValues] = useState<Record<string, string>>(initialCustomValues)
  const [data, setData] = useState<ContractData>({
    projectId: initialData?.projectId ?? (projects[0]?.id ?? ''),
    title: initialData?.title ?? '',
    contractNumber: initialData?.contractNumber ?? '',
    status: initialData?.status ?? 'concept',
    contractType: initialData?.contractType ?? '',
    supplierId: initialData?.supplierId ?? '',
    ownerUserId: initialData?.ownerUserId ?? currentUser.id,
    startDate: initialData?.startDate ?? '',
    endDate: initialData?.endDate ?? '',
    optionDate: initialData?.optionDate ?? '',
    noticePeriodDays: initialData?.noticePeriodDays ?? '',
    valueTotal: initialData?.valueTotal ?? '',
    valueAnnual: initialData?.valueAnnual ?? '',
    currency: initialData?.currency ?? 'EUR',
    autoRenewal: initialData?.autoRenewal ?? false,
    autoRenewalTerms: initialData?.autoRenewalTerms ?? '',
    retentionYears: initialData?.retentionYears ?? '7',
  })

  const set = (key: keyof ContractData, value: string | boolean) =>
    setData(prev => ({ ...prev, [key]: value }))

  async function handleExtract(file: File) {
    setExtracting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/ai/extract', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) {
        toast({ title: 'Extractie mislukt', description: json.error ?? 'Onbekende fout', variant: 'destructive' })
        return
      }
      if (json.extraction) {
        const e = json.extraction
        if (e.start_date) set('startDate', e.start_date.split('T')[0])
        if (e.end_date) set('endDate', e.end_date.split('T')[0])
        if (e.option_date) set('optionDate', e.option_date.split('T')[0])
        if (e.notice_period_days) set('noticePeriodDays', String(e.notice_period_days))
        if (e.contract_value?.total) set('valueTotal', String(e.contract_value.total))
        if (e.contract_value?.annual) set('valueAnnual', String(e.contract_value.annual))
        if (e.contract_value?.currency) set('currency', e.contract_value.currency)
        if (e.contract_type) set('contractType', e.contract_type)
        if (typeof e.auto_renewal === 'boolean') set('autoRenewal', e.auto_renewal)
        if (e.auto_renewal_terms) set('autoRenewalTerms', e.auto_renewal_terms)
        if (e.parties?.[0]?.name && !data.title) set('title', e.parties[0].name)
        toast({ title: 'AI-extractie geslaagd', description: 'Velden zijn automatisch ingevuld op basis van het document.' })
      } else {
        toast({ title: 'Extractie leverde geen resultaat', description: 'Controleer of het bestand leesbare tekst bevat.', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Extractie mislukt', description: 'Netwerkfout of onleesbaar bestand.', variant: 'destructive' })
    } finally {
      setExtracting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!data.projectId) {
      toast({ title: 'Selecteer een project', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const url = contractId ? `/api/contracts/${contractId}` : '/api/contracts'
      const method = contractId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, metadataJson: customValues }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Fout')
      toast({ title: contractId ? 'Contract bijgewerkt' : 'Contract aangemaakt' })
      router.push(`/contracts/${json.data?.id ?? json.id ?? contractId}`)
      router.refresh()
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* AI Upload */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-blue-900 text-sm">AI-extractie</div>
              <div className="text-blue-700 text-xs mb-3">Upload een PDF of DOCX om velden automatisch in te vullen</div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".pdf,.docx"
                  className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleExtract(e.target.files[0]) }}
                />
                <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-blue-300 bg-white text-sm text-blue-700 hover:bg-blue-50 w-fit">
                  {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {extracting ? 'Bezig met analyseren...' : 'Document uploaden voor extractie'}
                </div>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Basisgegevens</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1">
            <Label>Project *</Label>
            <Select value={data.projectId || undefined} onValueChange={v => set('projectId', v)}>
              <SelectTrigger><SelectValue placeholder="Selecteer project" /></SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {projects.length === 0 && (
              <p className="text-xs text-amber-700">Geen projecten beschikbaar. Maak eerst een project aan onder Projecten.</p>
            )}
          </div>
          <div className="col-span-2 space-y-1">
            <Label htmlFor="title">Contractnaam *</Label>
            <Input id="title" value={data.title} onChange={e => set('title', e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="contractNumber">Contractnummer</Label>
            <Input id="contractNumber" value={data.contractNumber} onChange={e => set('contractNumber', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={data.status} onValueChange={v => set('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="concept">Concept</SelectItem>
                <SelectItem value="actief">Actief</SelectItem>
                <SelectItem value="verlopen">Verlopen</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={data.contractType} onValueChange={v => set('contractType', v)}>
              <SelectTrigger><SelectValue placeholder="Selecteer type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Leveringscontract">Leveringscontract</SelectItem>
                <SelectItem value="Dienstverleningscontract">Dienstverleningscontract</SelectItem>
                <SelectItem value="SLA">SLA</SelectItem>
                <SelectItem value="Raamovereenkomst">Raamovereenkomst</SelectItem>
                <SelectItem value="NDA">NDA</SelectItem>
                <SelectItem value="Huurovereenkomst">Huurovereenkomst</SelectItem>
                <SelectItem value="Inkoopcontract">Inkoopcontract</SelectItem>
                <SelectItem value="Anders">Anders</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {suppliers.length > 0 && (
            <div className="space-y-1">
              <Label>Leverancier</Label>
              <Select value={data.supplierId || undefined} onValueChange={v => set('supplierId', v)}>
                <SelectTrigger><SelectValue placeholder="Selecteer leverancier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {users.length > 0 && (
            <div className="space-y-1">
              <Label>Eigenaar</Label>
              <Select value={data.ownerUserId || undefined} onValueChange={v => set('ownerUserId', v)}>
                <SelectTrigger><SelectValue placeholder="Selecteer eigenaar" /></SelectTrigger>
                <SelectContent>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Looptijd</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="startDate">Startdatum</Label>
            <Input id="startDate" type="date" value={data.startDate} onChange={e => set('startDate', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="endDate">Einddatum</Label>
            <Input id="endDate" type="date" value={data.endDate} onChange={e => set('endDate', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="optionDate">Optiedatum</Label>
            <Input id="optionDate" type="date" value={data.optionDate} onChange={e => set('optionDate', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="noticePeriodDays">Opzegtermijn (dagen)</Label>
            <Input id="noticePeriodDays" type="number" value={data.noticePeriodDays} onChange={e => set('noticePeriodDays', e.target.value)} />
          </div>
          <div className="space-y-1 flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              id="autoRenewal"
              checked={data.autoRenewal}
              onChange={e => set('autoRenewal', e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="autoRenewal">Automatische verlenging</Label>
          </div>
          {data.autoRenewal && (
            <div className="col-span-2 space-y-1">
              <Label htmlFor="autoRenewalTerms">Verlengingsvoorwaarden</Label>
              <Textarea id="autoRenewalTerms" value={data.autoRenewalTerms} onChange={e => set('autoRenewalTerms', e.target.value)} rows={2} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Financiën</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label htmlFor="valueTotal">Totale waarde</Label>
            <Input id="valueTotal" type="number" step="0.01" value={data.valueTotal} onChange={e => set('valueTotal', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="valueAnnual">Jaarwaarde</Label>
            <Input id="valueAnnual" type="number" step="0.01" value={data.valueAnnual} onChange={e => set('valueAnnual', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Valuta</Label>
            <Select value={data.currency} onValueChange={v => set('currency', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Bewaar- en vernietigingstermijnen</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1 max-w-xs">
            <Label htmlFor="retentionYears">Bewaartermijn (jaren na afloop)</Label>
            <Input id="retentionYears" type="number" value={data.retentionYears} onChange={e => set('retentionYears', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {customFields.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Aangepaste velden</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {customFields.map(field => (
              <div key={field.id} className="space-y-1">
                <Label htmlFor={field.id}>
                  {field.fieldName}
                  {field.required && <span className="text-red-500 ml-0.5">*</span>}
                </Label>
                {field.fieldType === 'select' ? (
                  <Select
                    value={customValues[field.id] ?? ''}
                    onValueChange={v => setCustomValues(prev => ({ ...prev, [field.id]: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecteer..." /></SelectTrigger>
                    <SelectContent>
                      {((field.optionsJson as string[]) ?? []).map((opt: string) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={field.id}
                    type={field.fieldType === 'number' ? 'number' : field.fieldType === 'date' ? 'date' : 'text'}
                    value={customValues[field.id] ?? ''}
                    onChange={e => setCustomValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                    required={field.required ?? false}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()}>Annuleren</Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {contractId ? 'Bijwerken' : 'Aanmaken'}
        </Button>
      </div>
    </form>
  )
}
