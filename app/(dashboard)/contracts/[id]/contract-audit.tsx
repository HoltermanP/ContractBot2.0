'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { formatDate } from '@/lib/utils'
import { Download, Loader2 } from 'lucide-react'

interface AuditLogEntry {
  id: string
  action: string
  ipAddress: string | null
  createdAt: string
  newValueJson: unknown
  userId: string | null
}

export function ContractAudit({ contractId, orgId }: { contractId: string; orgId: string }) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    fetch(`/api/audit?contractId=${contractId}`)
      .then(r => r.json())
      .then(data => setLogs(data.logs ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [contractId])

  async function handleExport(format: 'csv' | 'excel') {
    setExporting(true)
    try {
      const res = await fetch('/api/audit/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, contractId }),
      })
      if (!res.ok) throw new Error('Export mislukt')
      const blob = await res.blob()
      const ext = format === 'excel' ? 'xlsx' : 'csv'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `auditlog.${ext}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => handleExport('csv')} disabled={exporting}>
          {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          CSV
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleExport('excel')} disabled={exporting}>
          {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Excel
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Geen auditlogs beschikbaar</p>
          ) : (
            <div className="space-y-2">
              {logs.map(log => (
                <div key={log.id} className="flex items-start gap-4 p-3 rounded-lg border text-sm">
                  <div className="text-xs text-muted-foreground w-36 shrink-0 mt-0.5">
                    {formatDate(log.createdAt)}
                  </div>
                  <div className="flex-1">
                    <span className="font-medium">{log.action}</span>
                    {log.ipAddress && <span className="text-muted-foreground ml-2 text-xs">{log.ipAddress}</span>}
                    {log.newValueJson != null && (
                      <pre className="mt-1 text-xs bg-gray-50 rounded p-2 overflow-auto max-h-24">
                        {JSON.stringify(log.newValueJson as Record<string, unknown>, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
