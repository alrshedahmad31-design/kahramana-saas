'use client'

import { usePathname } from '@/i18n/navigation'
import { type ReactNode } from 'react'

export default function ConditionalFooter({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const hide = pathname.includes('/dashboard') || pathname.includes('/driver')
  if (hide) return null
  return <>{children}</>
}
