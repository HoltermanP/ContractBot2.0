'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { formatDate } from '@/lib/utils'
import { Upload, Download, RotateCcw, FileText, Loader2, Archive, FileStack } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  canBulkDownloadDocuments,
  canMutateContractData,
  canRestoreDocumentVersion,
} from '@/lib/permissions'

export function ContractDocuments({ contract, user }: { contract: any; user: any }) {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [uploadKind, setUploadKind] = useState<'hoofdcontract' | 'addendum'>('hoofdcontract')
  const fileRef = useRef<HTMLInputElement>(null)
  const MAX_UPLOAD_SIZE_BYTES = 4 * 1024 * 1024

  const canUpload = canMutateContractData(user.role)
  const canZip = canBulkDownloadDocuments(user.role)
  const canRestore = canRestoreDocumentVersion(user.role)

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_UPLOAD_SIZE_BYTES) {
          throw new Error(
            `Bestand "${file.name}" is te groot (${(file.size / 1024 / 1024).toFixed(1)} MB). Op Vercel via deze route is max ~4 MB.`
          )
        }

        const fd = new FormData()
        fd.append('file', file)
        fd.append('contractId', contract.id)
        fd.append('documentKind', uploadKind)
        const res = await fetch('/api/documents/upload', { method: 'POST', body: fd })
        if (!res.ok) {
          let message = 'Upload mislukt'
          try {
            const json = await res.json()
            if (json?.error && typeof json.error === 'string') message = json.error
          } catch {
            // ignore JSON parse errors and fall back to generic message
          }
          throw new Error(message)
        }
      }
      toast({ title: 'Document(en) geüpload', description: 'AI-extractie wordt op de achtergrond uitgevoerd.' })
      router.refresh()
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  async function handleRestore(documentId: string, versionId: string) {
    try {
      await fetch(`/api/documents/${documentId}/restore-version/${versionId}`, { method: 'POST' })
      toast({ title: 'Versie hersteld' })
      router.refresh()
    } catch {
      toast({ title: 'Herstel mislukt', variant: 'destructive' })
    }
  }

  async function handleBulkDownload() {
    try {
      const res = await fetch(`/api/documents/bulk-download?contractId=${contract.id}`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${contract.title}-documenten.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast({ title: 'Download mislukt', variant: 'destructive' })
    }
  }

  const currentAll = contract.documents?.filter((d: any) => d.isCurrent) ?? []
  const currentMain = currentAll.filter((d: any) => d.documentKind !== 'addendum')
  const currentAddenda = currentAll.filter((d: any) => d.documentKind === 'addendum')
  const olderDocs = contract.documents?.filter((d: any) => !d.isCurrent) ?? []

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      {canUpload && (
        <Card className="border-dashed border-2 border-gray-200 bg-gray-50">
          <CardContent className="pt-6 pb-6">
            <div className="text-center space-y-4 max-w-md mx-auto">
              <Upload className="h-8 w-8 mx-auto text-gray-400" />
              <p className="text-sm text-muted-foreground">PDF of DOCX slepen of klikken om te uploaden</p>
              <div className="text-left space-y-2">
                <Label htmlFor="doc-kind" className="text-xs text-muted-foreground">
                  Documenttype
                </Label>
                <Select value={uploadKind} onValueChange={(v) => setUploadKind(v as 'hoofdcontract' | 'addendum')}>
                  <SelectTrigger id="doc-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hoofdcontract">Hoofdcontract (vervangt vorige hoofdversie)</SelectItem>
                    <SelectItem value="addendum">Addendum / wijziging (aanvullend; heeft voorrang bij vragen)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx"
                multiple
                className="hidden"
                onChange={e => handleUpload(e.target.files)}
              />
              <Button
                variant="outline"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {uploading ? 'Uploaden...' : 'Document uploaden'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current versions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Huidige documenten ({currentAll.length})</CardTitle>
          {currentAll.length > 0 && canZip && (
            <Button variant="outline" size="sm" onClick={handleBulkDownload}>
              <Archive className="h-4 w-4 mr-2" />
              Alles als ZIP
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {currentAll.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nog geen documenten geüpload</p>
          ) : (
            <>
              {currentMain.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hoofdcontract</p>
                  {currentMain.map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border bg-white">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-blue-500 shrink-0" />
                        <div>
                          <div className="font-medium text-sm">{doc.filename}</div>
                          <div className="text-xs text-muted-foreground">
                            v{doc.versionNumber} · {(doc.fileSize / 1024).toFixed(0)} KB · {formatDate(doc.uploadedAt)}
                            {doc.aiProcessed && <Badge variant="success" className="ml-2">AI verwerkt</Badge>}
                          </div>
                        </div>
                      </div>
                      <Button asChild variant="ghost" size="sm">
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {currentAddenda.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <FileStack className="h-3.5 w-3.5" />
                    Addenda en wijzigingen (voorrang bij contractvragen)
                  </p>
                  {currentAddenda.map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border border-amber-200/80 bg-amber-50/50">
                      <div className="flex items-center gap-3">
                        <FileStack className="h-5 w-5 text-amber-700 shrink-0" />
                        <div>
                          <div className="font-medium text-sm">{doc.filename}</div>
                          <div className="text-xs text-muted-foreground">
                            v{doc.versionNumber} · {(doc.fileSize / 1024).toFixed(0)} KB · {formatDate(doc.uploadedAt)}
                            {doc.aiProcessed && <Badge variant="success" className="ml-2">AI verwerkt</Badge>}
                          </div>
                        </div>
                      </div>
                      <Button asChild variant="ghost" size="sm">
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Version history */}
      {olderDocs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Versiehistorie</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {olderDocs.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                    <div>
                      <div className="text-sm text-muted-foreground">{doc.filename}</div>
                      <div className="text-xs text-muted-foreground">v{doc.versionNumber} · {formatDate(doc.uploadedAt)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="ghost" size="sm">
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                    {canRestore && (
                      <Button variant="ghost" size="sm" onClick={() => handleRestore(doc.id, doc.id)}>
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
