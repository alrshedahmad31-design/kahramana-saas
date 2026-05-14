'use client'

import { usePathname } from '@/i18n/navigation'
import { type ReactNode } from 'react'

export default function ConditionalFooter({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/'
  const hide =
    pathname.includes('/dashboard') ||
    pathname.includes('/driver') ||
    pathname.includes('/waiter') ||
    pathname.includes('/table/')
  // Keep DOM shape identical between SSR and client to avoid a hydration
  // mismatch: usePathname() from next-intl can resolve differently during the
  // SSR → first-render window, which made the null-vs-children branch bubble
  // CartDrawer up into the Footer slot. Toggle visibility via CSS instead.
  return <div style={{ display: hide ? 'none' : 'contents' }}>{children}</div>
}
