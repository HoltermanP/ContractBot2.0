'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { Sparkles, Loader2, TrendingUp, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'

interface PortfolioSummary {
  samenvatting: string
  hoogtepunten: string[]
  aandachtspunten: string[]
  aanbevelingen: string[]
  risicoprofiel: 'laag' | 'middel' | 'hoog'
}

const RISK_CONFIG = {
  laag: { label: 'Laag risico', className: 'bg-green-100 text-green-800' },
  middel: { label: 'Middel risico', className: 'bg-orange-100 text-orange-800' },
  hoog: { label: 'Hoog risico', className: 'bg-red-100 text-red-800' },
}

export function AiPortfolioSummary() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PortfolioSummary | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  async function generateSummary() {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/portfolio-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: 'current' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Samenvatting mislukt')
      setResult(data)
      setCollapsed(false)
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={generateSummary} disabled={loading} variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50">
          {loading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Samenvatting genereren...</>
          ) : (
            <><Sparkles className="h-4 w-4 mr-2" />AI Portfoliosamenvatting</>
          )}
        </Button>
        {result && (
          <button onClick={() => setCollapsed(c => !c)} className="text-muted-foreground hover:text-gray-700">
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        )}
      </div>

      {result && !collapsed && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2 text-blue-900">
                <Sparkles className="h-4 w-4" />AI Portfoliosamenvatting
              </CardTitle>
              <Badge className={RISK_CONFIG[result.risicoprofiel]?.className}>
                {RISK_CONFIG[result.risicoprofiel]?.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-blue-900">{result.samenvatting}</p>

            <div className="grid grid-cols-3 gap-4">
              {result.hoogtepunten?.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-green-700 mb-1 flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" />Hoogtepunten
                  </div>
                  <ul className="space-y-1">
                    {result.hoogtepunten.map((h, i) => (
                      <li key={i} className="text-xs text-green-800">• {h}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.aandachtspunten?.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-orange-700 mb-1 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />Aandachtspunten
                  </div>
                  <ul className="space-y-1">
                    {result.aandachtspunten.map((a, i) => (
                      <li key={i} className="text-xs text-orange-800">• {a}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.aanbevelingen?.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-blue-700 mb-1 flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5" />Aanbevelingen
                  </div>
                  <ul className="space-y-1">
                    {result.aanbevelingen.map((r, i) => (
                      <li key={i} className="text-xs text-blue-800">• {r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
