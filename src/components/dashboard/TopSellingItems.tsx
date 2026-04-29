import type { TopItem } from '@/lib/dashboard/stats'

interface Props {
  items: TopItem[]
  isRTL: boolean
}

export default function TopSellingItems({ items, isRTL }: Props) {
  if (items.length === 0) {
    return (
      <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
        <h2 className={`font-satoshi font-black text-sm text-brand-muted uppercase tracking-wider mb-4 ${isRTL ? 'font-almarai' : ''}`}>
          {isRTL ? 'الأكثر مبيعاً' : 'Best Sellers'}
        </h2>
        <p className="font-satoshi text-sm text-brand-muted/40 text-center py-8">
          {isRTL ? 'لا توجد بيانات بعد' : 'No data yet today'}
        </p>
      </div>
    )
  }

  const max = items[0]?.total_quantity ?? 1

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-base">🔥</span>
        <h2 className={`font-satoshi font-black text-sm text-brand-muted uppercase tracking-wider ${isRTL ? 'font-almarai' : ''}`}>
          {isRTL ? 'الأكثر مبيعاً اليوم' : 'Best Sellers Today'}
        </h2>
      </div>

      <div className="flex flex-col gap-4">
        {items.map((item, i) => {
          const pct = Math.round((item.total_quantity / max) * 100)
          return (
            <div key={`${item.name_ar}-${i}`}>
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-satoshi font-black text-sm text-brand-gold/60 tabular-nums shrink-0 w-4">
                    {i + 1}.
                  </span>
                  <span className={`font-bold text-sm text-brand-text truncate ${isRTL ? 'font-cairo' : 'font-satoshi'}`}>
                    {isRTL ? item.name_ar : item.name_en}
                  </span>
                </div>
                <span className="font-satoshi font-black text-sm text-brand-muted tabular-nums shrink-0">
                  ×{item.total_quantity}
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 bg-brand-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-gold rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
