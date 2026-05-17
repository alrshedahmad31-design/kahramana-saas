import { redirect } from 'next/navigation'
import {
  requireDashboardSection,
  isDashboardGuardError,
} from '@/lib/auth/dashboard-guards'

interface Props {
  children: React.ReactNode
  params:   Promise<{ locale: string }>
}

export const dynamic = 'force-dynamic'

export default async function MobileKDSLayout({ children, params }: Props) {
  const { locale } = await params

  try {
    await requireDashboardSection('kds')
  } catch (e) {
    if (isDashboardGuardError(e)) redirect(`/${locale}/dashboard`)
    throw e
  }

  // Negate the parent locale layout's pt-20 md:pt-24 + pb-24 md:pb-0 so the
  // KDS surface owns the full viewport. Header/Footer/MobileBottomNav are
  // already hidden via path checks in their components.
  return (
    <div className="-mt-20 md:-mt-24 -mb-24 md:mb-0 min-h-screen bg-brand-black">
      {children}
    </div>
  )
}
