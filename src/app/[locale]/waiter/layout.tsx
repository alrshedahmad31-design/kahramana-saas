import { redirect } from 'next/navigation'
import { requireDashboardSection, isDashboardGuardError } from '@/lib/auth/dashboard-guards'
import DashboardSidebar from '@/components/dashboard/DashboardSidebar'

interface Props {
  children: React.ReactNode
  params:   Promise<{ locale: string }>
}

export const dynamic = 'force-dynamic'

export default async function WaiterLayout({ children, params }: Props) {
  const { locale } = await params
  const isAr = locale === 'ar'
  const prefix = locale === 'en' ? '/en' : ''

  let user
  try {
    user = await requireDashboardSection('waiter')
  } catch (e) {
    if (isDashboardGuardError(e) && e.code === 'unauthorized') {
      redirect(`${prefix}/login`)
    }
    redirect(`${prefix}/dashboard`)
  }

  // Single shell for every role — same as the dashboard layout used on /pos,
  // /kds, /orders, etc. Consistency over role-specific chrome.
  return (
    <div data-staff-shell className="-mt-20 md:-mt-24 min-h-screen bg-brand-black flex" dir={isAr ? 'rtl' : 'ltr'}>
      <DashboardSidebar userName={user.name} userRole={user.role} />
      <main className="flex-1 min-w-0 pt-16 lg:pt-0">
        <div className="px-4 sm:px-6 py-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
