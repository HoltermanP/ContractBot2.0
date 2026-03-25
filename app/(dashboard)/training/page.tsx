import { getOrCreateUser } from '@/lib/auth'
import { db, trainingCourses } from '@/lib/db'
import { and, desc, eq } from 'drizzle-orm'
import { canMutateContractData } from '@/lib/permissions'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, GraduationCap, Presentation } from 'lucide-react'

export default async function TrainingListPage() {
  const user = await getOrCreateUser()
  if (!user) return null

  const whereClause = canMutateContractData(user.role)
    ? eq(trainingCourses.orgId, user.orgId)
    : and(eq(trainingCourses.orgId, user.orgId), eq(trainingCourses.status, 'published'))

  const rows = await db.query.trainingCourses.findMany({
    where: whereClause,
    orderBy: [desc(trainingCourses.updatedAt)],
    with: {
      modules: true,
    },
  })

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
            <GraduationCap className="h-7 w-7 text-blue-600" />
            Contracttraining & e-learning
          </h1>
          <p className="text-slate-600 mt-1">
            Genereer uitgebreide trainingen op basis van contracten en documenten, en optioneel een Gamma-presentatie.
          </p>
        </div>
        {canMutateContractData(user.role) && (
          <Button asChild>
            <Link href="/training/new">
              <Plus className="h-4 w-4 mr-2" />
              Nieuwe training
            </Link>
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nog geen trainingen</CardTitle>
            <CardDescription>
              {canMutateContractData(user.role)
                ? 'Maak een training aan en koppel contracten of specifieke documenten (addenda).'
                : 'Er zijn nog geen gepubliceerde trainingen beschikbaar.'}
            </CardDescription>
          </CardHeader>
          {canMutateContractData(user.role) && (
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/training/new">Start met een nieuwe training</Link>
              </Button>
            </CardContent>
          )}
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/training/${c.id}`} className="block">
                <Card className="hover:border-blue-300 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <CardTitle className="text-lg">{c.title}</CardTitle>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={c.status === 'published' ? 'default' : 'secondary'}>
                          {c.status === 'published' ? 'Gepubliceerd' : 'Concept'}
                        </Badge>
                        <Badge variant="outline">{c.modules.length} module(s)</Badge>
                        {c.gammaUrl && (
                          <Badge variant="outline" className="gap-1">
                            <Presentation className="h-3 w-3" />
                            Gamma
                          </Badge>
                        )}
                      </div>
                    </div>
                    {c.description && (
                      <CardDescription className="line-clamp-2">{c.description}</CardDescription>
                    )}
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
