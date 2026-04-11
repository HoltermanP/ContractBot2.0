import { getOrCreateUser } from '@/lib/auth'
import { canAccessTrainingModule } from '@/lib/permissions'
import { redirect } from 'next/navigation'

export default async function TrainingSectionLayout({ children }: { children: React.ReactNode }) {
  const user = await getOrCreateUser()
  if (!user) redirect('/sign-in')
  if (!canAccessTrainingModule(user.role)) redirect('/dashboard')
  return <>{children}</>
}
