import { redirect } from 'next/navigation'
import { requireDashboardSection, isDashboardGuardError } from '@/lib/auth/dashboard-guards'
import DashboardSidebar from '@/components/dashboard/DashboardSidebar'
import WaiterPWAShell from '@/components/waiter/WaiterPWAShell'

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

  // Floor staff (cashier + branch_manager) get the lightweight PWA shell —
  // they're typically on phones/tablets at the table. Owner / GM keep the
  // full dashboard sidebar so they can navigate freely while supervising.
  const PWA_ROLES = ['cashier', 'branch_manager'] as const
  if (user.role && (PWA_ROLES as readonly string[]).includes(user.role)) {
    return (
      <WaiterPWAShell locale={locale}>
        {children}
      </WaiterPWAShell>
    )
  }

  return (
    <div data-staff-shell className="min-h-screen bg-brand-black flex" dir={isAr ? 'rtl' : 'ltr'}>
      <DashboardSidebar userName={user.name} userRole={user.role} />
      <main className="flex-1 min-w-0 pt-16 lg:pt-0">
        {children}
      </main>
    </div>
  )
}
