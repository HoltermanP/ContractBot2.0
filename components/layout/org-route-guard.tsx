'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { isPathAllowedByModules, type OrgModuleVisibility } from '@/lib/org-modules'

export function OrgRouteGuard({ moduleVisibility }: { moduleVisibility: OrgModuleVisibility }) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!pathname) return
    if (!isPathAllowedByModules(pathname, moduleVisibility)) {
      router.replace('/dashboard')
    }
  }, [moduleVisibility, pathname, router])

  return null
}
