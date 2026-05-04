import { requireOrgModule } from '@/lib/org-module-access'

export default async function TrainingSectionLayout({ children }: { children: React.ReactNode }) {
  await requireOrgModule('training')
  return <>{children}</>
}
