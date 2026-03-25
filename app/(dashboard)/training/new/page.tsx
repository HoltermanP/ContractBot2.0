'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ArrowLeft } from 'lucide-react'

type ContractRow = { id: string; title: string }
type DocRow = { id: string; filename: string; contractId: string }

export default function NewTrainingPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [contracts, setContracts] = useState<ContractRow[]>([])
  const [selectedContracts, setSelectedContracts] = useState<Record<string, boolean>>({})
  const [docsByContract, setDocsByContract] = useState<Record<string, DocRow[]>>({})
  const [selectedDocs, setSelectedDocs] = useState<Record<string, boolean>>({})
  const [useSpecificDocs, setUseSpecificDocs] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingContracts, setLoadingContracts] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/contracts')
        const data = await res.json()
        if (!cancelled && Array.isArray(data)) {
          setContracts(data.map((c: { id: string; title: string }) => ({ id: c.id, title: c.title })))
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoadingContracts(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function loadDocsForContract(contractId: string) {
    if (docsByContract[contractId]) return
    const res = await fetch(`/api/contracts/${contractId}`)
    if (!res.ok) return
    const c = await res.json()
    const docs: DocRow[] = (c.documents ?? []).map((d: { id: string; filename: string; contractId: string }) => ({
      id: d.id,
      filename: d.filename,
      contractId: d.contractId ?? contractId,
    }))
    setDocsByContract((prev) => ({ ...prev, [contractId]: docs }))
  }

  function toggleContract(id: string) {
    setSelectedContracts((s) => {
      const next = { ...s, [id]: !s[id] }
      if (next[id]) void loadDocsForContract(id)
      return next
    })
  }

  function toggleDoc(id: string) {
    setSelectedDocs((s) => ({ ...s, [id]: !s[id] }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const t = title.trim()
    if (!t) {
      setError('Vul een titel in')
      return
    }
    const cids = Object.keys(selectedContracts).filter((id) => selectedContracts[id])
    const dids = Object.keys(selectedDocs).filter((id) => selectedDocs[id])
    if (cids.length === 0 && dids.length === 0) {
      setError('Selecteer minstens één contract of specifiek document')
      return
    }
    if (useSpecificDocs && dids.length === 0) {
      setError('Kies specifieke documenten, of schakel “alleen specifieke documenten” uit.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const create = await fetch('/api/training/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: t, description: description.trim() || undefined }),
      })
      const created = await create.json()
      if (!create.ok) throw new Error(created.error ?? 'Aanmaken mislukt')

      const sourceBody =
        useSpecificDocs && dids.length > 0
          ? { contractIds: [] as string[], documentIds: dids }
          : { contractIds: cids, documentIds: [] as string[] }

      const put = await fetch(`/api/training/courses/${created.id}/sources`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sourceBody),
      })
      const putJson = await put.json()
      if (!put.ok) throw new Error(putJson.error ?? 'Bronnen opslaan mislukt')

      const gen = await fetch(`/api/training/courses/${created.id}/generate`, { method: 'POST' })
      const genJson = await gen.json()
      if (!gen.ok) throw new Error(genJson.error ?? 'Genereren mislukt')

      router.push(`/training/${created.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/training">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Terug
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Nieuwe contracttraining</CardTitle>
          <CardDescription>
            Kies één of meer contracten (alle huidige documenten) of specifieke contractdocumenten/addenda. Daarna wordt
            automatisch een uitgebreide e-learning gegenereerd.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Titel</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Bijv. Training leverancierscontract IT-dienstverlening"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Korte omschrijving (optioneel)</Label>
              <Textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Wordt overschreven door de AI-intro na generatie"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="specific"
                  checked={useSpecificDocs}
                  onChange={(e) => setUseSpecificDocs(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <Label htmlFor="specific" className="font-normal cursor-pointer">
                  Alleen geselecteerde documenten gebruiken (addenda/bijlagen)
                </Label>
              </div>
              <p className="text-xs text-slate-500">
                Uit: alle actuele PDF/DOCX-documenten van de aangevinkte contracten. Aan: alleen de documenten die u hieronder
                aanvinkt (contracten zijn dan alleen nodig om documenten te laden).
              </p>
            </div>

            {!useSpecificDocs ? (
              <div className="space-y-2">
                <Label>Contracten</Label>
                {loadingContracts ? (
                  <p className="text-sm text-slate-500">Laden…</p>
                ) : contracts.length === 0 ? (
                  <p className="text-sm text-amber-700">Geen contracten gevonden.</p>
                ) : (
                  <ul className="border rounded-md divide-y max-h-56 overflow-y-auto">
                    {contracts.map((c) => (
                      <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                        <input
                          type="checkbox"
                          id={`c-${c.id}`}
                          checked={!!selectedContracts[c.id]}
                          onChange={() => toggleContract(c.id)}
                          className="rounded border-slate-300"
                        />
                        <label htmlFor={`c-${c.id}`} className="text-sm cursor-pointer flex-1">
                          {c.title}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <Label>Contracten om documenten te kiezen</Label>
                <ul className="border rounded-md divide-y max-h-40 overflow-y-auto">
                  {contracts.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                      <input
                        type="checkbox"
                        id={`sc-${c.id}`}
                        checked={!!selectedContracts[c.id]}
                        onChange={() => toggleContract(c.id)}
                        className="rounded border-slate-300"
                      />
                      <label htmlFor={`sc-${c.id}`} className="text-sm cursor-pointer flex-1">
                        {c.title}
                      </label>
                    </li>
                  ))}
                </ul>
                {Object.keys(selectedContracts)
                  .filter((id) => selectedContracts[id])
                  .map((contractId) => (
                    <div key={contractId} className="pl-2 border-l-2 border-blue-200 space-y-2">
                      <p className="text-sm font-medium text-slate-700">
                        Documenten — {contracts.find((x) => x.id === contractId)?.title}
                      </p>
                      {!docsByContract[contractId] ? (
                        <p className="text-xs text-slate-500">Documenten laden…</p>
                      ) : docsByContract[contractId].length === 0 ? (
                        <p className="text-xs text-amber-700">Geen documenten bij dit contract.</p>
                      ) : (
                        <ul className="space-y-1">
                          {docsByContract[contractId].map((d) => (
                            <li key={d.id} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`d-${d.id}`}
                                checked={!!selectedDocs[d.id]}
                                onChange={() => toggleDoc(d.id)}
                                className="rounded border-slate-300"
                              />
                              <label htmlFor={`d-${d.id}`} className="text-sm cursor-pointer">
                                {d.filename}
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Bezig met genereren…
                </>
              ) : (
                'Training aanmaken & genereren'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
