'use client'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { Sparkles, AlertTriangle, CheckCircle, Info, Loader2, Shield, Lock, Scale } from 'lucide-react'
import { pickDocumentWithAiExtract } from '@/lib/pick-contract-document'

export function ContractAiAnalysis({ contract, user }: { contract: any; user: any }) {
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<any>(null)

  const doc = pickDocumentWithAiExtract(contract.documents)
  const extraction = doc?.aiExtractedDataJson

  async function runAnalysis() {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId: contract.id }),
      })
      const data = await res.json()
      setAnalysis(data)
    } catch {
      toast({ title: 'Analyse mislukt', variant: 'destructive' })
    } finally {
      setAnalyzing(false)
    }
  }

  const riskColor = (level: string) => {
    if (level === 'high') return 'danger'
    if (level === 'medium') return 'warning'
    return 'success'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={runAnalysis} disabled={analyzing}>
          {analyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          {analyzing ? 'Analyseren...' : 'Analyse uitvoeren'}
        </Button>
      </div>

      {!extraction && !analysis && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Upload een document om AI-analyse te activeren</p>
          </CardContent>
        </Card>
      )}

      {extraction && (
        <>
          {/* Summary */}
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Info className="h-4 w-4" />Samenvatting</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {extraction.summary_short && <p>{extraction.summary_short}</p>}
              {extraction.summary_management && (
                <div className="bg-blue-50 rounded-lg p-3 text-blue-900">{extraction.summary_management}</div>
              )}
              {extraction.implicit_renewal_warning && (
                <div className="flex items-start gap-2 bg-orange-50 rounded-lg p-3">
                  <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
                  <p className="text-orange-800 text-xs">{extraction.implicit_renewal_warning}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Risk indicators */}
          {extraction.risk_indicators?.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Risico-indicatoren</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {extraction.risk_indicators.map((risk: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                      <Badge variant={riskColor(risk.risk_level) as any} className="mt-0.5 shrink-0">
                        {risk.risk_level === 'high' ? 'Hoog' : risk.risk_level === 'medium' ? 'Midden' : 'Laag'}
                      </Badge>
                      <div>
                        <p className="font-medium text-sm">{risk.clause}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{risk.explanation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Clauses */}
          <div className="grid grid-cols-3 gap-4">
            {extraction.it_security_clauses?.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-xs flex items-center gap-1"><Shield className="h-3.5 w-3.5" />IT Security</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {extraction.it_security_clauses.map((c: string, i: number) => (
                      <li key={i} className="text-xs text-muted-foreground">• {c}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            {extraction.privacy_clauses?.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-xs flex items-center gap-1"><Lock className="h-3.5 w-3.5" />Privacy (AVG)</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {extraction.privacy_clauses.map((c: string, i: number) => (
                      <li key={i} className="text-xs text-muted-foreground">• {c}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            {extraction.sustainability_clauses?.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-xs flex items-center gap-1"><Scale className="h-3.5 w-3.5" />Duurzaamheid</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {extraction.sustainability_clauses.map((c: string, i: number) => (
                      <li key={i} className="text-xs text-muted-foreground">• {c}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      {/* Full analysis result */}
      {analysis && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Uitgebreide analyse</CardTitle></CardHeader>
          <CardContent>
            {analysis.riskScore !== undefined && (
              <div className="flex items-center gap-3 mb-4">
                <div className="text-2xl font-bold">{analysis.riskScore}/100</div>
                <div>
                  <div className="text-sm font-medium">Risicoscore</div>
                  <div className="w-48 h-2 bg-gray-200 rounded-full mt-1">
                    <div
                      className={`h-2 rounded-full ${analysis.riskScore > 66 ? 'bg-red-500' : analysis.riskScore > 33 ? 'bg-orange-500' : 'bg-green-500'}`}
                      style={{ width: `${analysis.riskScore}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
            {analysis.findings?.map((f: any, i: number) => (
              <div key={i} className="mb-3 p-3 rounded-lg border text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={riskColor(f.severity) as any}>{f.severity}</Badge>
                  <span className="font-medium">{f.title}</span>
                </div>
                <p className="text-muted-foreground text-xs">{f.description}</p>
                {f.suggestion && <p className="text-blue-700 text-xs mt-1">Suggestie: {f.suggestion}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
