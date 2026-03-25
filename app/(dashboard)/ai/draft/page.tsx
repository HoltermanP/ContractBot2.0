'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { Loader2, Upload, Sparkles, CheckCircle, AlertTriangle, Info, X } from 'lucide-react'

interface Suggestion {
  category: string
  priority: 'hoog' | 'middel' | 'laag'
  title: string
  description: string
  suggestedText: string | null
}

interface DraftReviewResult {
  overallScore: number
  summary: string
  suggestions: Suggestion[]
  missingClauses: string[]
  positiveAspects: string[]
}

const PRIORITY_CONFIG = {
  hoog: { className: 'bg-red-100 text-red-800 border-red-200', icon: AlertTriangle },
  middel: { className: 'bg-orange-100 text-orange-800 border-orange-200', icon: Info },
  laag: { className: 'bg-blue-100 text-blue-800 border-blue-200', icon: Info },
}

const CATEGORY_COLORS: Record<string, string> = {
  juridisch: 'bg-purple-100 text-purple-700',
  financieel: 'bg-green-100 text-green-700',
  risico: 'bg-red-100 text-red-700',
  volledigheid: 'bg-yellow-100 text-yellow-700',
  formulering: 'bg-blue-100 text-blue-700',
}

export default function DraftAssistantPage() {
  const [file, setFile] = useState<File | null>(null)
  const [contractType, setContractType] = useState('')
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DraftReviewResult | null>(null)

  async function handleAnalyze() {
    if (!file) {
      toast({ title: 'Selecteer een document', variant: 'destructive' })
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (contractType) fd.append('contractType', contractType)
      if (context) fd.append('context', context)

      const res = await fetch('/api/ai/draft-review', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Analyse mislukt')
      setResult(json)
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const scoreColor = result
    ? result.overallScore >= 70 ? 'text-green-600' : result.overallScore >= 40 ? 'text-orange-600' : 'text-red-600'
    : ''

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Ontwerp-assistent</h1>
        <p className="text-muted-foreground">Upload een contractconcept voor gedetailleerde verbeteringsuggesties</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* File upload */}
          <div className="space-y-2">
            <Label>Contractconcept (PDF of DOCX)</Label>
            {file ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-gray-50">
                <div className="flex-1 text-sm font-medium truncate">{file.name}</div>
                <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</div>
                <button onClick={() => setFile(null)} className="text-muted-foreground hover:text-gray-900">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="cursor-pointer block">
                <input
                  type="file"
                  accept=".pdf,.docx"
                  className="hidden"
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                />
                <div className="flex flex-col items-center justify-center gap-2 p-8 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-colors text-center">
                  <Upload className="h-8 w-8 text-gray-400" />
                  <div className="text-sm font-medium text-gray-700">Klik om een bestand te uploaden</div>
                  <div className="text-xs text-muted-foreground">PDF of DOCX, max 10MB</div>
                </div>
              </label>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Contracttype (optioneel)</Label>
              <Select value={contractType} onValueChange={setContractType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Leveringscontract">Leveringscontract</SelectItem>
                  <SelectItem value="Dienstverleningscontract">Dienstverleningscontract</SelectItem>
                  <SelectItem value="SLA">SLA</SelectItem>
                  <SelectItem value="Raamovereenkomst">Raamovereenkomst</SelectItem>
                  <SelectItem value="NDA">NDA</SelectItem>
                  <SelectItem value="Huurovereenkomst">Huurovereenkomst</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Extra context (optioneel)</Label>
              <Textarea
                value={context}
                onChange={e => setContext(e.target.value)}
                placeholder="Bijv. specifieke aandachtspunten, sector, toepasselijk recht..."
                rows={3}
                className="resize-none"
              />
            </div>
          </div>

          <Button onClick={handleAnalyze} disabled={loading || !file} className="w-full">
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />AI analyseert document...</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" />Concept analyseren</>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          {/* Score overview */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <div className={`text-4xl font-bold ${scoreColor}`}>{result.overallScore}</div>
                <div className="text-sm text-muted-foreground mt-1">Kwaliteitsscore</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-4xl font-bold text-orange-600">{result.suggestions.filter(s => s.priority === 'hoog').length}</div>
                <div className="text-sm text-muted-foreground mt-1">Hoge prioriteit</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <div className="text-4xl font-bold text-blue-600">{result.missingClauses.length}</div>
                <div className="text-sm text-muted-foreground mt-1">Ontbrekende clausules</div>
              </CardContent>
            </Card>
          </div>

          {/* Summary */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-4">
              <div className="text-sm font-medium text-blue-900 mb-1">Samenvatting</div>
              <p className="text-sm text-blue-800">{result.summary}</p>
            </CardContent>
          </Card>

          {/* Positive aspects */}
          {result.positiveAspects.length > 0 && (
            <Card className="border-green-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                  <CheckCircle className="h-4 w-4" />Sterke punten
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {result.positiveAspects.map((p, i) => (
                    <li key={i} className="text-sm text-green-800 flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>{p}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Missing clauses */}
          {result.missingClauses.length > 0 && (
            <Card className="border-yellow-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-yellow-700">
                  <AlertTriangle className="h-4 w-4" />Ontbrekende clausules
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {result.missingClauses.map((c, i) => (
                    <li key={i} className="text-sm text-yellow-800 flex items-start gap-2">
                      <span className="mt-0.5">•</span>{c}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Suggestions */}
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-700">Verbeteringsuggesties ({result.suggestions.length})</div>
            {result.suggestions.map((sug, i) => {
              const p = PRIORITY_CONFIG[sug.priority] ?? PRIORITY_CONFIG.laag
              const Icon = p.icon
              return (
                <Card key={i}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-gray-600" />
                        <span className="font-medium text-sm">{sug.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[sug.category] ?? 'bg-gray-100 text-gray-700'}`}>
                          {sug.category}
                        </span>
                      </div>
                      <Badge className={`text-xs ${p.className}`}>{sug.priority}</Badge>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{sug.description}</p>
                    {sug.suggestedText && (
                      <div className="bg-gray-50 rounded-lg p-3 border">
                        <div className="text-xs font-medium text-muted-foreground mb-1">Suggestie voor tekst:</div>
                        <p className="text-sm italic text-gray-700">"{sug.suggestedText}"</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
