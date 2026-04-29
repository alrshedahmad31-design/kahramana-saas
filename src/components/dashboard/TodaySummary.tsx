import type { DashboardData } from '@/lib/dashboard/stats'

interface Props {
  data:     DashboardData
  currency: string
  isRTL:    boolean
}

export default function TodaySummary({ data, currency, isRTL }: Props) {
  if (data.totalOrdersToday === 0) return null

  const stats = [
    {
      labelEn: 'Completed',
      labelAr: 'مكتمل',
      value:   `${data.completedToday}`,
      unitEn:  'orders',
      unitAr:  'طلب',
    },
    {
      labelEn: 'Active',
      labelAr: 'نشط',
      value:   `${data.activeOrders.total}`,
      unitEn:  'orders',
      unitAr:  'طلب',
    },
    ...(data.avgPrepMins > 0 ? [{
      labelEn: 'Avg time',
      labelAr: 'متوسط الوقت',
      value:   `${data.avgPrepMins}`,
      unitEn:  'min',
      unitAr:  'دقيقة',
    }] : []),
    {
      labelEn: 'Revenue',
      labelAr: 'الإيرادات',
      value:   data.todayRevenue.toFixed(3),
      unitEn:  currency,
      unitAr:  currency,
    },
  ]

  return (
    <div className="bg-brand-surface border border-brand-border/60 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm">📊</span>
        <h2 className={`font-satoshi font-black text-sm text-brand-muted uppercase tracking-wider ${isRTL ? 'font-almarai' : ''}`}>
          {isRTL ? 'ملخص اليوم' : "Today's Summary"}
        </h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.labelEn} className="flex flex-col gap-1">
            <p className={`font-satoshi text-xs text-brand-muted ${isRTL ? 'font-almarai' : ''}`}>
              {isRTL ? s.labelAr : s.labelEn}
            </p>
            <p className="font-satoshi font-black text-xl text-brand-text tabular-nums">
              {s.value}
              <span className="text-xs font-medium text-brand-muted ms-1">
                {isRTL ? s.unitAr : s.unitEn}
              </span>
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
