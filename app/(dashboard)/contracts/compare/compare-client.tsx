'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { Loader2, GitCompare, AlertTriangle, Info, Minus } from 'lucide-react'

interface ContractOption {
  id: string
  title: string
  contractNumber: string | null
  contractType: string | null
}

interface Difference {
  section: string
  type: string
  description: string
  severity: 'low' | 'medium' | 'high'
  version1_text: string | null
  version2_text: string | null
}

interface ComparisonResult {
  differences: Difference[]
  summary: string
}

const SEVERITY_CONFIG = {
  high: { label: 'Hoog', className: 'bg-red-100 text-red-800 border-red-200', icon: AlertTriangle },
  medium: { label: 'Middel', className: 'bg-orange-100 text-orange-800 border-orange-200', icon: Info },
  low: { label: 'Laag', className: 'bg-blue-100 text-blue-800 border-blue-200', icon: Minus },
}

const TYPE_LABELS: Record<string, string> = {
  new_obligation: 'Nieuwe verplichting',
  changed_amount: 'Gewijzigd bedrag',
  changed_duration: 'Gewijzigde looptijd',
  risk_change: 'Risicowijziging',
  other: 'Overig',
}

export function ContractCompareClient({ contracts }: { contracts: ContractOption[] }) {
  const [contract1, setContract1] = useState('')
  const [contract2, setContract2] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ComparisonResult | null>(null)

  async function handleCompare() {
    if (!contract1 || !contract2) {
      toast({ title: 'Selecteer twee contracten', variant: 'destructive' })
      return
    }
    if (contract1 === contract2) {
      toast({ title: 'Selecteer twee verschillende contracten', variant: 'destructive' })
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/ai/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId1: contract1, contractId2: contract2 }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Vergelijking mislukt')
      setResult(json)
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const c1 = contracts.find(c => c.id === contract1)
  const c2 = contracts.find(c => c.id === contract2)

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="text-sm font-medium">Contract 1</div>
              <Select value={contract1} onValueChange={setContract1}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer een contract" />
                </SelectTrigger>
                <SelectContent>
                  {contracts.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title} {c.contractNumber ? `(${c.contractNumber})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Contract 2</div>
              <Select value={contract2} onValueChange={setContract2}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer een contract" />
                </SelectTrigger>
                <SelectContent>
                  {contracts.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title} {c.contractNumber ? `(${c.contractNumber})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex justify-center">
            <Button onClick={handleCompare} disabled={loading || !contract1 || !contract2} className="px-8">
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />AI vergelijkt...</>
              ) : (
                <><GitCompare className="h-4 w-4 mr-2" />Vergelijken</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-4">
              <div className="text-sm font-medium text-blue-900 mb-1">Samenvatting vergelijking</div>
              <p className="text-sm text-blue-800">{result.summary}</p>
              <div className="mt-2 flex items-center gap-4 text-xs text-blue-700">
                <span>{result.differences.length} verschillen gevonden</span>
                <span>{result.differences.filter(d => d.severity === 'high').length} hoge prioriteit</span>
                {c1 && c2 && (
                  <span>{c1.title} vs {c2.title}</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Column headers */}
          {result.differences.length > 0 && (
            <div className="grid grid-cols-2 gap-4 text-sm font-medium text-muted-foreground px-1">
              <div>{c1?.title ?? 'Contract 1'}</div>
              <div>{c2?.title ?? 'Contract 2'}</div>
            </div>
          )}

          {/* Differences */}
          <div className="space-y-3">
            {result.differences.map((diff, i) => {
              const s = SEVERITY_CONFIG[diff.severity] ?? SEVERITY_CONFIG.low
              const Icon = s.icon
              return (
                <Card key={i} className={`border ${s.className.includes('red') ? 'border-red-200' : s.className.includes('orange') ? 'border-orange-200' : 'border-blue-200'}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span className="font-medium text-sm">{diff.section}</span>
                        <Badge variant="outline" className="text-xs">{TYPE_LABELS[diff.type] ?? diff.type}</Badge>
                      </div>
                      <Badge className={`text-xs ${s.className}`}>{s.label} risico</Badge>
                    </div>
                    <p className="text-sm mb-3">{diff.description}</p>
                    {(diff.version1_text || diff.version2_text) && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-red-50 rounded p-2 text-xs text-red-900 border border-red-200">
                          <div className="font-medium mb-1">Versie 1</div>
                          {diff.version1_text ?? <span className="italic text-muted-foreground">Niet aanwezig</span>}
                        </div>
                        <div className="bg-green-50 rounded p-2 text-xs text-green-900 border border-green-200">
                          <div className="font-medium mb-1">Versie 2</div>
                          {diff.version2_text ?? <span className="italic text-muted-foreground">Niet aanwezig</span>}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {result.differences.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <p>Geen significante inhoudelijke verschillen gevonden</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
