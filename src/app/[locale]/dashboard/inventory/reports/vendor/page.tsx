import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import ReportHeader from '@/components/inventory/reports/ReportHeader'

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
import StatCard from '@/components/inventory/reports/StatCard'
import EmptyReport from '@/components/inventory/reports/EmptyReport'
import VendorRadarChart from './VendorRadarChart'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

const ALLOWED_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager']

export default async function VendorPerformancePage({ params }: PageProps) {
  const { locale } = await params
  const isAr = locale !== 'en'
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
      <div className="space-y-6">
        <ReportHeader title={isAr ? 'أداء الموردين' : 'Vendor Performance'} locale={locale} />
        <EmptyReport
          title={isAr ? 'لا توجد بيانات موردين' : 'No vendor data'}
          description={isAr ? 'لم يتم تسجيل أي طلبات شراء حتى الآن' : 'No purchase orders recorded yet'}
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
    <div className="space-y-6">
      <ReportHeader
        title={isAr ? 'أداء الموردين' : 'Vendor Performance'}
        description={isAr ? 'دقة التسليم والجودة والإنفاق' : 'Delivery accuracy, quality, and spend'}
        locale={locale}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label={isAr ? 'أفضل دقة تسليم' : 'Best Delivery Accuracy'}
          value={bestAccuracy?.name_ar ?? '—'}
          sub={`${(bestAccuracy?.delivery_accuracy_pct ?? 0).toFixed(1)}%`}
          highlight
          trend="up"
        />
        <StatCard
          label={isAr ? 'أعلى تقييم جودة' : 'Highest Quality Rating'}
          value={bestQuality?.name_ar ?? '—'}
          sub={`${(bestQuality?.avg_quality_rating ?? 0).toFixed(1)}/5`}
          trend="up"
        />
        <StatCard
          label={isAr ? 'الأعلى إنفاقاً' : 'Highest Spend'}
          value={mostSpent?.name_ar ?? '—'}
          sub={`BD ${Number(mostSpent?.total_spent_bhd ?? 0).toFixed(3)}`}
        />
      </div>

      {/* Radar chart */}
      <VendorRadarChart vendors={safeVendors} />

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-brand-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-border bg-brand-surface-2">
              <th className="px-4 py-3 text-start font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">{isAr ? 'المورد' : 'Vendor'}</th>
              <th className="px-4 py-3 text-end font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">{isAr ? 'الطلبات' : 'Orders'}</th>
              <th className="px-4 py-3 text-end font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">{isAr ? 'الإنفاق BD' : 'Spent BD'}</th>
              <th className="px-4 py-3 text-end font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">{isAr ? 'دقة التسليم' : 'Accuracy'}</th>
              <th className="px-4 py-3 text-end font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">{isAr ? 'الجودة' : 'Quality'}</th>
              <th className="px-4 py-3 text-end font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">{isAr ? 'التأخير (أيام)' : 'Avg Delay'}</th>
              <th className="px-4 py-3 text-end font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">{isAr ? 'ملغاة' : 'Cancelled'}</th>
            </tr>
          </thead>
          <tbody>
            {safeVendors.map((v) => {
              const accuracy = v.delivery_accuracy_pct ?? 0
              const accuracyColor = accuracy >= 90 ? 'text-green-400' : accuracy >= 70 ? 'text-brand-gold' : 'text-brand-error'
              const delay = v.avg_delay_days ?? 0
              const delayColor = delay <= 1 ? 'text-green-400' : delay <= 3 ? 'text-brand-gold' : 'text-brand-error'
              return (
                <tr key={v.id} className="border-b border-brand-border/50 hover:bg-brand-surface-2 transition-colors">
                  <td className="px-4 py-3 font-satoshi text-brand-text font-medium">{v.name_ar}</td>
                  <td className="px-4 py-3 text-end font-satoshi tabular-nums text-brand-muted">{v.total_orders}</td>
                  <td className="px-4 py-3 text-end font-satoshi tabular-nums text-brand-gold font-semibold">{Number(v.total_spent_bhd).toFixed(3)}</td>
                  <td className={`px-4 py-3 text-end font-satoshi tabular-nums font-semibold ${accuracyColor}`}>
                    {accuracy.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-end font-satoshi tabular-nums text-brand-muted">
                    {v.avg_quality_rating?.toFixed(1) ?? '—'}/5
                  </td>
                  <td className={`px-4 py-3 text-end font-satoshi tabular-nums font-semibold ${delayColor}`}>
                    {delay.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-end font-satoshi tabular-nums text-brand-muted">{v.cancelled_orders}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
