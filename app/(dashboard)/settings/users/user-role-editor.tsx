'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'

export function UserRoleEditor({ userId, currentRole, currentName }: { userId: string; currentRole: string; currentName: string }) {
  const router = useRouter()
  const [role, setRole] = useState(currentRole)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, name: currentName }),
      })
      if (!res.ok) throw new Error()
      toast({ title: 'Rol bijgewerkt' })
      router.refresh()
    } catch {
      toast({ title: 'Fout', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={role} onValueChange={setRole}>
        <SelectTrigger className="w-44 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="admin">Beheerder</SelectItem>
          <SelectItem value="manager">Contractmanager</SelectItem>
          <SelectItem value="registrator">Contractregistrator</SelectItem>
          <SelectItem value="compliance">Compliance / audit</SelectItem>
          <SelectItem value="reader">Lezer</SelectItem>
        </SelectContent>
      </Select>
      {role !== currentRole && (
        <Button size="sm" onClick={save} disabled={saving} className="h-8 text-xs">
          {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          Opslaan
        </Button>
      )}
    </div>
  )
}
