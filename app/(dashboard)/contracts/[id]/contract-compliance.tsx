'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { Loader2, ShieldCheck, CheckCircle, XCircle, AlertTriangle, Minus } from 'lucide-react'

interface ComplianceFinding {
  requirement: string
  status: 'aanwezig' | 'ontbreekt' | 'onduidelijk'
  description: string
  recommendation: string | null
}

interface ComplianceFramework {
  name: string
  status: 'voldoet' | 'gedeeltelijk' | 'voldoet_niet' | 'niet_van_toepassing'
  score: number
  findings: ComplianceFinding[]
}

interface ComplianceResult {
  overallCompliance: string
  score: number
  frameworks: ComplianceFramework[]
  summary: string
  criticalGaps: string[]
}

const COMPLIANCE_STATUS_CONFIG = {
  voldoet: { label: 'Voldoet', className: 'bg-green-100 text-green-800', icon: CheckCircle },
  gedeeltelijk: { label: 'Gedeeltelijk', className: 'bg-orange-100 text-orange-800', icon: AlertTriangle },
  voldoet_niet: { label: 'Voldoet niet', className: 'bg-red-100 text-red-800', icon: XCircle },
  niet_van_toepassing: { label: 'N.v.t.', className: 'bg-gray-100 text-gray-600', icon: Minus },
}

const FINDING_STATUS_CONFIG = {
  aanwezig: { label: 'Aanwezig', icon: CheckCircle, className: 'text-green-600' },
  ontbreekt: { label: 'Ontbreekt', icon: XCircle, className: 'text-red-600' },
  onduidelijk: { label: 'Onduidelijk', icon: AlertTriangle, className: 'text-orange-600' },
}

export function ContractCompliance({ contract }: { contract: any }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ComplianceResult | null>(null)
  const [expandedFramework, setExpandedFramework] = useState<string | null>(null)

  const hasDocument = contract.documents?.some((d: any) => d.isCurrent)

  async function runCompliance() {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId: contract.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Compliance analyse mislukt')
      setResult(data)
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={runCompliance} disabled={loading || !hasDocument}>
          {loading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyseren...</>
          ) : (
            <><ShieldCheck className="h-4 w-4 mr-2" />Compliance analyse uitvoeren</>
          )}
        </Button>
        {!hasDocument && (
          <p className="text-sm text-muted-foreground">Upload eerst een document voor compliance analyse</p>
        )}
      </div>

      {!result && !loading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <ShieldCheck className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Voer een compliance analyse uit om te controleren op AVG/GDPR, ISO 27001 en duurzaamheidseisen</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <div className="space-y-4">
          {/* Overall score */}
          <div className="grid grid-cols-2 gap-4">
            <Card className={result.score >= 70 ? 'border-green-200 bg-green-50' : result.score >= 40 ? 'border-orange-200 bg-orange-50' : 'border-red-200 bg-red-50'}>
              <CardContent className="pt-4">
                <div className={`text-4xl font-bold ${result.score >= 70 ? 'text-green-700' : result.score >= 40 ? 'text-orange-700' : 'text-red-700'}`}>
                  {result.score}%
                </div>
                <div className="text-sm font-medium mt-1">Totale compliancescore</div>
                {result.overallCompliance && (
                  <div className="mt-2">
                    <Badge className={COMPLIANCE_STATUS_CONFIG[result.overallCompliance as keyof typeof COMPLIANCE_STATUS_CONFIG]?.className ?? 'bg-gray-100'}>
                      {COMPLIANCE_STATUS_CONFIG[result.overallCompliance as keyof typeof COMPLIANCE_STATUS_CONFIG]?.label ?? result.overallCompliance}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-gray-700">{result.summary}</div>
              </CardContent>
            </Card>
          </div>

          {/* Critical gaps */}
          {result.criticalGaps?.length > 0 && (
            <Card className="border-red-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-red-700 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />Kritieke lacunes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {result.criticalGaps.map((gap, i) => (
                    <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                      <span className="shrink-0 mt-0.5">•</span>{gap}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Frameworks */}
          <div className="space-y-3">
            {result.frameworks?.map((framework) => {
              const statusConfig = COMPLIANCE_STATUS_CONFIG[framework.status] ?? COMPLIANCE_STATUS_CONFIG.niet_van_toepassing
              const Icon = statusConfig.icon
              const isExpanded = expandedFramework === framework.name

              return (
                <Card key={framework.name}>
                  <CardHeader
                    className="pb-2 cursor-pointer"
                    onClick={() => setExpandedFramework(isExpanded ? null : framework.name)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className={`h-4 w-4 ${statusConfig.className.includes('green') ? 'text-green-600' : statusConfig.className.includes('orange') ? 'text-orange-600' : statusConfig.className.includes('red') ? 'text-red-600' : 'text-gray-400'}`} />
                        <CardTitle className="text-sm">{framework.name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${framework.score >= 70 ? 'bg-green-500' : framework.score >= 40 ? 'bg-orange-500' : 'bg-red-500'}`}
                              style={{ width: `${framework.score}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium w-8 text-right">{framework.score}%</span>
                        </div>
                        <Badge className={statusConfig.className}>{statusConfig.label}</Badge>
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && framework.findings?.length > 0 && (
                    <CardContent>
                      <div className="space-y-2 border-t pt-3">
                        {framework.findings.map((finding, i) => {
                          const fc = FINDING_STATUS_CONFIG[finding.status] ?? FINDING_STATUS_CONFIG.onduidelijk
                          const FIcon = fc.icon
                          return (
                            <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-gray-50">
                              <FIcon className={`h-4 w-4 shrink-0 mt-0.5 ${fc.className}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium">{finding.requirement}</span>
                                  <Badge variant="outline" className={`text-xs ${fc.className} border-current`}>{fc.label}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">{finding.description}</p>
                                {finding.recommendation && (
                                  <p className="text-xs text-blue-700 mt-1 italic">{finding.recommendation}</p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
