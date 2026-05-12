import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

interface Props {
  children: React.ReactNode
}

/**
 * Service Mode wraps its children in a fixed full-viewport overlay that sits
 * above the dashboard sidebar/main padding. This avoids using a route group
 * (the path is required to live under /dashboard/pos/service) while still
 * presenting a true fullscreen tablet surface.
 */
export default function ServiceModeLayout({ children }: Props) {
  return (
    <div className="fixed inset-0 z-50 w-screen h-screen overflow-hidden bg-brand-black">
      {children}
    </div>
  )
}
