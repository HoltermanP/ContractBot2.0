'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Search, X } from 'lucide-react'
import { useCallback } from 'react'

interface Supplier { id: string; name: string }
interface Project { id: string; name: string }

export function ContractsFilter({
  suppliers,
  projects = [],
  currentParams,
}: {
  suppliers: Supplier[]
  projects?: Project[]
  currentParams: { status?: string; search?: string; type?: string; project?: string }
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateParam = useCallback((key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value && value !== 'all') params.set(key, value)
    else params.delete(key)
    router.push(`/contracts?${params.toString()}`)
  }, [router, searchParams])

  const clearAll = () => router.push('/contracts')

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Zoek op naam of nummer..."
          defaultValue={currentParams.search}
          className="pl-9"
          onChange={e => updateParam('search', e.target.value || undefined)}
        />
      </div>

      <Select defaultValue={currentParams.status ?? 'all'} onValueChange={v => updateParam('status', v)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle statussen</SelectItem>
          <SelectItem value="concept">Concept</SelectItem>
          <SelectItem value="actief">Actief</SelectItem>
          <SelectItem value="verlopen">Verlopen</SelectItem>
          <SelectItem value="gearchiveerd">Gearchiveerd</SelectItem>
        </SelectContent>
      </Select>

      <Select defaultValue={currentParams.type ?? 'all'} onValueChange={v => updateParam('type', v)}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle types</SelectItem>
          <SelectItem value="Leveringscontract">Leveringscontract</SelectItem>
          <SelectItem value="Dienstverleningscontract">Dienstverleningscontract</SelectItem>
          <SelectItem value="SLA">SLA</SelectItem>
          <SelectItem value="Raamovereenkomst">Raamovereenkomst</SelectItem>
          <SelectItem value="NDA">NDA</SelectItem>
          <SelectItem value="Huurovereenkomst">Huurovereenkomst</SelectItem>
        </SelectContent>
      </Select>

      <Select defaultValue={currentParams.project ?? 'all'} onValueChange={v => updateParam('project', v)}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Project" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle projecten</SelectItem>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {(currentParams.status || currentParams.search || currentParams.type || currentParams.project) && (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          <X className="h-4 w-4 mr-1" />
          Filters wissen
        </Button>
      )}
    </div>
  )
}
