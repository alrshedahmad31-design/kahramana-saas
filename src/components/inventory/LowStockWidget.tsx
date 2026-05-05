import Link from 'next/link'
import type { LowStockAlert } from '@/lib/supabase/custom-types'

interface Props {
  items:  LowStockAlert[]
  prefix: string
  locale?: string
}

function abcBadge(cls: string) {
  if (cls === 'A') return 'bg-red-500/10 text-red-400'
  if (cls === 'B') return 'bg-brand-gold/10 text-brand-gold'
  return 'bg-green-500/10 text-green-400'
}

export default function LowStockWidget({ items, prefix, locale = 'ar' }: Props) {
  const isAr    = locale === 'ar'
  const top5    = items.slice(0, 5)
  const hasCrit = items.some(i => (i.days_to_out ?? Infinity) <= 1)

  if (items.length === 0) {
    return (
      <div className="bg-brand-surface border border-brand-border rounded-xl p-5 flex flex-col gap-3 h-full">
        <WidgetHeader hasCrit={false} prefix={prefix} isAr={isAr} total={0} />
        <div className="flex-1 flex items-center justify-center">
          <p className="font-satoshi text-sm text-brand-muted text-center py-4">
            {isAr ? '✅ المخزون كافٍ' : '✅ Stock levels sufficient'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-5 flex flex-col gap-4 h-full">
      <WidgetHeader hasCrit={hasCrit} prefix={prefix} isAr={isAr} total={items.length} />

      <div className="border border-brand-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-brand-surface-2">
            <tr>
              <th className="px-3 py-2 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'المكوّن' : 'Ingredient'}
              </th>
              <th className="px-3 py-2 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'متاح' : 'Avail.'}
              </th>
              <th className="px-3 py-2 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
                {isAr ? 'أيام' : 'Days'}
              </th>
            </tr>
          </thead>
          <tbody>
            {top5.map(item => {
              const critical = (item.days_to_out ?? Infinity) <= 1
              return (
                <tr key={item.ingredient_id} className="border-t border-brand-border hover:bg-brand-surface-2 transition-colors">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {critical && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />}
                      <span className={`inline-flex items-center px-1 py-0.5 rounded text-xs font-satoshi font-bold ${abcBadge(item.abc_class)}`}>
                        {item.abc_class}
                      </span>
                      <span className="font-satoshi text-sm text-brand-text truncate">
                        {isAr ? item.name_ar : item.name_en}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`font-satoshi text-sm font-medium tabular-nums ${Number(item.available) <= 0 ? 'text-red-400' : 'text-brand-gold'}`}>
                      {Number(item.available).toFixed(1)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`font-satoshi text-xs tabular-nums ${critical ? 'text-red-400 font-bold' : 'text-brand-muted'}`}>
                      {item.days_to_out !== null ? item.days_to_out : '—'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {items.length > 5 && (
        <Link
          href={`${prefix}/dashboard/inventory/reports/dead-stock`}
          className="font-satoshi text-xs text-brand-gold hover:text-brand-goldLight transition-colors duration-150 text-center"
        >
          {isAr ? `عرض الكل (${items.length})` : `View all (${items.length})`} →
        </Link>
      )}
    </div>
  )
}

function WidgetHeader({ hasCrit, prefix, isAr, total }: { hasCrit: boolean; prefix: string; isAr: boolean; total: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-brand-surface-2 border border-brand-border flex items-center justify-center text-brand-gold shrink-0 relative">
          <AlertIcon />
          {hasCrit && (
            <span className="absolute -top-1 -end-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          )}
        </div>
        <h3 className="font-satoshi font-bold text-sm text-brand-text">
          {isAr ? 'مخزون منخفض' : 'Low Stock'}
          {total > 0 && (
            <span className="ms-1.5 font-satoshi text-xs text-brand-muted font-normal">({total})</span>
          )}
        </h3>
      </div>
      <Link
        href={`${prefix}/dashboard/inventory`}
        className="font-satoshi text-xs text-brand-muted hover:text-brand-gold transition-colors duration-150 shrink-0"
      >
        {isAr ? 'المخزون ←' : 'Inventory →'}
      </Link>
    </div>
  )
}

function AlertIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  )
}
