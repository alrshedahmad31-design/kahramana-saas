import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import {
  isDashboardGuardError,
  requireDashboardSection,
} from '@/lib/auth/dashboard-guards'
import CateringInquiriesList from './CateringInquiriesList'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string }>
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-brand-surface border border-brand-border rounded-xl p-4 animate-pulse h-32"
        />
      ))}
    </div>
  )
}

export default async function CateringPage({ params }: PageProps) {
  const { locale } = await params
  const prefix = locale === 'en' ? '/en' : ''

  try {
    await requireDashboardSection('catering')
  } catch (error) {
    if (isDashboardGuardError(error) && error.code === 'unauthorized') {
      redirect(`${prefix}/login`)
    }
    redirect(`${prefix}/dashboard`)
  }

  const t = await getTranslations('dashboard.catering')
  const isAr = locale === 'ar'

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto w-full">
      <header className="flex flex-col gap-1">
        <h1
          className={`text-2xl md:text-3xl font-black text-brand-text ${
            isAr ? 'font-cairo' : 'font-satoshi'
          }`}
        >
          {t('title')}
        </h1>
        <p
          className={`text-sm text-brand-muted ${
            isAr ? 'font-almarai' : 'font-satoshi'
          }`}
        >
          {t('subtitle')}
        </p>
      </header>

      <Suspense fallback={<ListSkeleton />}>
        <CateringInquiriesList locale={locale === 'en' ? 'en' : 'ar'} />
      </Suspense>
    </div>
  )
}
