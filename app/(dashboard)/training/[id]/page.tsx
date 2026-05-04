import { getOrCreateUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { canManageTrainingCourses } from '@/lib/permissions'
import { TrainingCourseView } from './training-course-view'

export default async function TrainingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getOrCreateUser()
  if (!user) redirect('/sign-in')
  const { id } = await params
  return <TrainingCourseView courseId={id} canManage={canManageTrainingCourses(user.role)} />
}
