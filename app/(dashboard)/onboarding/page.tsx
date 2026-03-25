import { redirect } from 'next/navigation'
import { getOrCreateUser } from '@/lib/auth'

export default async function OnboardingPage() {
  const user = await getOrCreateUser()
  if (!user) redirect('/sign-in')
  redirect('/dashboard')
}
