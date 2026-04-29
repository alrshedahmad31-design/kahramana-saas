import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { canAccessDriver } from '@/lib/auth/rbac'
import DriverPWAShell from '@/components/driver/DriverPWAShell'
import DashboardSidebar from '@/components/dashboard/DashboardSidebar'

interface Props {
  children:  React.ReactNode
  params:    Promise<{ locale: string }>
}

export const dynamic = 'force-dynamic'

export default async function DriverLayout({ children, params }: Props) {
  const { locale } = await params
  const isAr = locale === 'ar'

  const user = await getSession()
  if (!user) redirect(locale === 'en' ? '/en/login' : '/login')
  if (!canAccessDriver(user)) redirect(`/${locale}/dashboard`)

  // Managers and above get the full dashboard sidebar so they don't lose navigation.
  // Driver-only role gets the lightweight PWA shell.
  if (user.role !== 'driver') {
    return (
      <div className="min-h-screen bg-brand-black flex" dir={isAr ? 'rtl' : 'ltr'}>
        <DashboardSidebar userName={user.name} userRole={user.role} />
        <main className="flex-1 min-w-0 pt-16 lg:pt-0">
          {children}
        </main>
      </div>
    )
  }

  return (
    <DriverPWAShell locale={locale}>
      {children}
    </DriverPWAShell>
  )
}
