import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import ReportHeader from '@/components/inventory/reports/ReportHeader'
import StatCard from '@/components/inventory/reports/StatCard'
import EmptyReport from '@/components/inventory/reports/EmptyReport'
import VendorRadarChart from './VendorRadarChart'

interface VendorPerformanceRow {
  id: string
  name_ar: string
  name_en: string | null
  total_orders: number
  total_spent_bhd: number
  delivery_accuracy_pct: number | null
  avg_quality_rating: number | null
  avg_delay_days: number | null
  cancelled_orders: number
}

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager']

export default async function VendorPerformancePage({ params }: PageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'inventory.reports.vendorPerformance' })
  const tCommon = await getTranslations({ locale, namespace: 'common' })
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  const currency = tCommon('currency')
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!ALLOWED_ROLES.includes(user.role ?? '')) redirect(`${prefix}/dashboard`)

  const supabase = await createClient()
  const { data: vendors } = await supabase
    .from('v_vendor_performance')
    .select('*')
    .order('total_spent_bhd', { ascending: false })

  const safeVendors = (vendors ?? []) as VendorPerformanceRow[]

  if (safeVendors.length === 0) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <ReportHeader 
          title={t('title')} 
          description={t('desc')}
          locale={locale} 
        />
        <EmptyReport
          title={t('emptyTitle')}
          description={t('emptyDesc')}
        />
      </div>
    )
  }

  // Best stats
  const bestAccuracy = safeVendors.reduce<VendorPerformanceRow | null>(
    (b, v) => (!b || (v.delivery_accuracy_pct ?? 0) > (b.delivery_accuracy_pct ?? 0) ? v : b), null,
  )
  const bestQuality = safeVendors.reduce<VendorPerformanceRow | null>(
    (b, v) => (!b || (v.avg_quality_rating ?? 0) > (b.avg_quality_rating ?? 0) ? v : b), null,
  )
  const mostSpent = safeVendors[0]

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <ReportHeader
        title={t('title')}
        description={t('desc')}
        locale={locale}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label={t('bestAccuracy')}
          value={isAr ? (bestAccuracy?.name_ar ?? '—') : (bestAccuracy?.name_en ?? bestAccuracy?.name_ar ?? '—')}
          sub={`${(bestAccuracy?.delivery_accuracy_pct ?? 0).toFixed(1)}%`}
          highlight
          trend="up"
        />
        <StatCard
          label={t('bestQuality')}
          value={isAr ? (bestQuality?.name_ar ?? '—') : (bestQuality?.name_en ?? bestQuality?.name_ar ?? '—')}
          sub={`${(bestQuality?.avg_quality_rating ?? 0).toFixed(1)}/5`}
          trend="up"
        />
        <StatCard
          label={t('mostSpent')}
          value={isAr ? (mostSpent?.name_ar ?? '—') : (mostSpent?.name_en ?? mostSpent?.name_ar ?? '—')}
          sub={`${Number(mostSpent?.total_spent_bhd ?? 0).toFixed(3)} ${currency}`}
        />
      </div>

      {/* Radar chart */}
      <VendorRadarChart vendors={safeVendors} />

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-brand-border bg-brand-surface shadow-sm hover:shadow-md transition-all">
        <table className="w-full text-start">
          <thead>
            <tr className="bg-brand-surface-2">
              <th className={`px-5 py-3 text-start ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('vendor')}</th>
              <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('orders')}</th>
              <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('spent')} ({currency})</th>
              <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('accuracy')}</th>
              <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('quality')}</th>
              <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('avgDelay')}</th>
              <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('cancelled')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border/30">
            {safeVendors.map((v) => {
              const accuracy = v.delivery_accuracy_pct ?? 0
              const accuracyColor = accuracy >= 90 ? 'text-brand-success' : accuracy >= 70 ? 'text-brand-gold' : 'text-brand-error'
              const delay = v.avg_delay_days ?? 0
              const delayColor = delay <= 1 ? 'text-brand-success' : delay <= 3 ? 'text-brand-gold' : 'text-brand-error'
              const vendorName = isAr ? v.name_ar : (v.name_en ?? v.name_ar)
              
              return (
                <tr key={v.id} className="hover:bg-brand-surface-2 transition-colors group">
                  <td className={`px-5 py-4 ${font} text-sm font-bold text-brand-text group-hover:text-brand-gold transition-colors`}>
                    {vendorName}
                  </td>
                  <td className="px-5 py-4 text-end font-satoshi text-sm font-bold text-brand-muted tabular-nums">
                    {v.total_orders}
                  </td>
                  <td className="px-5 py-4 text-end font-satoshi text-sm font-black text-brand-gold tabular-nums">
                    {Number(v.total_spent_bhd).toFixed(3)}
                  </td>
                  <td className={`px-5 py-4 text-end font-satoshi text-sm font-black tabular-nums ${accuracyColor}`}>
                    {accuracy.toFixed(1)}%
                  </td>
                  <td className="px-5 py-4 text-end font-satoshi text-sm font-bold text-brand-muted tabular-nums">
                    {v.avg_quality_rating?.toFixed(1) ?? '—'}/5
                  </td>
                  <td className={`px-5 py-4 text-end font-satoshi text-sm font-black tabular-nums ${delayColor}`}>
                    {delay.toFixed(1)}
                  </td>
                  <td className="px-5 py-4 text-end font-satoshi text-sm font-bold text-brand-muted tabular-nums">
                    {v.cancelled_orders}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
