import type { Metadata } from 'next'
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import DashboardSidebar from '@/components/dashboard/DashboardSidebar'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

interface Props {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function DashboardLayout({ children, params }: Props) {
  const { locale } = await params
  const user = await getSession()
  const isAr = locale === 'ar'

  if (!user) {
    redirect(locale === 'en' ? '/en/login' : '/login')
  }

  // Defense-in-depth: drivers must never land on any dashboard route.
  // Middleware redirects first; this layout is the last line of defense.
  if (user.role === 'driver') {
    redirect(locale === 'en' ? '/en/driver' : '/driver')
  }

  return (
    <div className="-mt-20 md:-mt-24 min-h-screen bg-brand-black flex" dir={isAr ? 'rtl' : 'ltr'}>
      <DashboardSidebar userName={user.name} userRole={user.role} />

      {/* Main content — sidebar is static in flex on lg+; mobile needs top padding for hamburger */}
      <main className="flex-1 min-w-0 pt-16 lg:pt-0">
        <div className="px-4 sm:px-6 py-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
