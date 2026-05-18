import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import {
  isDashboardGuardError,
  requireDashboardSection,
} from '@/lib/auth/dashboard-guards'
import CateringInquiriesList from './CateringInquiriesList'
import CateringFilters from './CateringFilters'

export const dynamic = 'force-dynamic'

interface PageProps {
  params:       Promise<{ locale: string }>
  searchParams: Promise<{ from?: string; to?: string; occasion?: string; page?: string }>
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

// YYYY-MM-DD whitelist. Anything else is silently dropped, so a bookmarked
// dashboard URL can't trigger a Postgres cast error.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
function safeDate(v?: string): string | undefined {
  return v && ISO_DATE.test(v) ? v : undefined
}

function safePage(v?: string): number {
  const n = Number.parseInt(v ?? '1', 10)
  return Number.isFinite(n) && n >= 1 ? n : 1
}

export default async function CateringPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  const sp         = await searchParams
  const prefix     = locale === 'en' ? '/en' : ''

  try {
    await requireDashboardSection('catering')
  } catch (error) {
    if (isDashboardGuardError(error) && error.code === 'unauthorized') {
      redirect(`${prefix}/login`)
    }
    redirect(`${prefix}/dashboard`)
  }

  const t      = await getTranslations('dashboard.catering')
  const isAr   = locale === 'ar'
  const loc    = locale === 'en' ? 'en' : 'ar'

  const from     = safeDate(sp.from)
  const to       = safeDate(sp.to)
  const occasion = sp.occasion?.trim() || undefined
  const page     = safePage(sp.page)

  // Suspense key forces a fresh fetch when filters change, so the skeleton
  // appears for each navigation rather than flashing stale data.
  const suspenseKey = `${from ?? ''}|${to ?? ''}|${occasion ?? ''}|${page}`

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

      <CateringFilters locale={loc} from={from} to={to} occasion={occasion} />

      <Suspense key={suspenseKey} fallback={<ListSkeleton />}>
        <CateringInquiriesList
          locale={loc}
          from={from}
          to={to}
          occasion={occasion}
          page={page}
        />
      </Suspense>
    </div>
  )
}
