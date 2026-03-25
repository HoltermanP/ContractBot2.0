'use client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { Trash2 } from 'lucide-react'

export function DeleteFieldButton({ id }: { id: string }) {
  const router = useRouter()

  async function handleDelete() {
    if (!confirm('Veld verwijderen?')) return
    await fetch(`/api/custom-fields/${id}`, { method: 'DELETE' })
    toast({ title: 'Veld verwijderd' })
    router.refresh()
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleDelete}>
      <Trash2 className="h-4 w-4 text-red-500" />
    </Button>
  )
}
