'use client'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { Search, Sparkles, Loader2 } from 'lucide-react'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [semantic, setSemantic] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setSearched(true)
    try {
      if (semantic) {
        const res = await fetch('/api/ai/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        })
        const data = await res.json()
        setResults(data.results ?? [])
      } else {
        const res = await fetch(`/api/contracts?search=${encodeURIComponent(query)}`)
        const data = await res.json()
        setResults(data)
      }
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Zoeken</h1>
        <p className="text-muted-foreground">Doorzoek uw volledige contractportfolio</p>
      </div>

      <form onSubmit={handleSearch} className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            className="pl-10 h-12 text-base"
            placeholder="Zoek op naam, clausule, leverancier..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={semantic}
              onChange={e => setSemantic(e.target.checked)}
              className="rounded"
            />
            <Sparkles className="h-4 w-4 text-blue-500" />
            Semantisch zoeken (AI)
          </label>
          <Button type="submit" disabled={loading || !query.trim()}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Zoeken
          </Button>
        </div>
      </form>

      {searched && (
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            {results.length} resultaten voor &ldquo;{query}&rdquo;
            {semantic && ' (semantisch)'}
          </div>
          {results.map((r: any) => (
            <Card key={r.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <Link href={`/contracts/${r.id}`} className="font-medium text-blue-600 hover:underline">
                      {r.title}
                    </Link>
                    <div className="text-xs text-muted-foreground mt-1">
                      {r.contract_number && `#${r.contract_number} · `}
                      {r.status && <Badge variant="outline" className="text-xs">{r.status}</Badge>}
                      {r.end_date && ` · Verloopt: ${formatDate(r.end_date)}`}
                    </div>
                  </div>
                  {r.similarity !== undefined && (
                    <Badge variant="secondary">{Math.round(r.similarity * 100)}% match</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {results.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Geen resultaten gevonden</p>
              {!semantic && <p className="text-xs mt-1">Probeer semantisch zoeken voor betere resultaten</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
