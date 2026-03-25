'use client'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { Plus, Trash2, Loader2, Shield, Users, User } from 'lucide-react'

interface AccessRule {
  id: string
  userId: string | null
  userName: string | null
  role: string | null
  accessType: string
  createdAt: string
}

interface OrgUser {
  id: string
  name: string
  email: string
  role: string
}

export function ContractAccess({ contract, currentUser, orgUsers }: {
  contract: any
  currentUser: any
  orgUsers: OrgUser[]
}) {
  const [rules, setRules] = useState<AccessRule[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [addType, setAddType] = useState<'user' | 'role'>('user')
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [accessType, setAccessType] = useState('allow')

  const isAdmin = currentUser.role === 'admin'

  useEffect(() => {
    fetch(`/api/contracts/${contract.id}/access`)
      .then(r => r.json())
      .then(data => setRules(data.rules ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [contract.id])

  async function handleAdd() {
    setSubmitting(true)
    try {
      const body = addType === 'user'
        ? { userId: selectedUser, accessType }
        : { role: selectedRole, accessType }

      const res = await fetch(`/api/contracts/${contract.id}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Fout')

      const user = orgUsers.find(u => u.id === selectedUser)
      setRules(prev => [...prev, { ...data, userName: user?.name ?? null }])
      setShowAdd(false)
      setSelectedUser('')
      setSelectedRole('')
      toast({ title: 'Toegangsregel aangemaakt' })
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(ruleId: string) {
    try {
      await fetch(`/api/contracts/${contract.id}/access`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId }),
      })
      setRules(prev => prev.filter(r => r.id !== ruleId))
      toast({ title: 'Regel verwijderd' })
    } catch {
      toast({ title: 'Fout bij verwijderen', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Beheer wie toegang heeft tot dit contract. Standaard is iedereen in de organisatie toegestaan.
            Voeg expliciete regels toe om toegang te beperken of te verlenen.
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-2" />Regel toevoegen
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Geen toegangsregels ingesteld — standaard toegang voor alle gebruikers</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map(rule => (
                <div key={rule.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    {rule.userId ? (
                      <User className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Users className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <div className="text-sm font-medium">
                        {rule.userId ? (rule.userName ?? rule.userId) : `Rol: ${rule.role}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={rule.accessType === 'allow' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {rule.accessType === 'allow' ? 'Toegestaan' : 'Geweigerd'}
                    </Badge>
                    {isAdmin && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600" onClick={() => handleDelete(rule.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Toegangsregel toevoegen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type regel</Label>
              <Select value={addType} onValueChange={v => setAddType(v as 'user' | 'role')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Specifieke gebruiker</SelectItem>
                  <SelectItem value="role">Rol</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {addType === 'user' ? (
              <div className="space-y-2">
                <Label>Gebruiker</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger><SelectValue placeholder="Selecteer gebruiker" /></SelectTrigger>
                  <SelectContent>
                    {orgUsers.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger><SelectValue placeholder="Selecteer rol" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reader">Lezer</SelectItem>
                    <SelectItem value="registrator">Registrator</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Toegangstype</Label>
              <Select value={accessType} onValueChange={setAccessType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="allow">Toegestaan</SelectItem>
                  <SelectItem value="deny">Geweigerd</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Annuleren</Button>
            <Button onClick={handleAdd} disabled={submitting || (addType === 'user' && !selectedUser) || (addType === 'role' && !selectedRole)}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Toevoegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
