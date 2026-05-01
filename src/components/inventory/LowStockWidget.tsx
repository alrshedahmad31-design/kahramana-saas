import type { LowStockAlert } from '@/lib/supabase/custom-types'

interface Props {
  items: LowStockAlert[]
  locale?: string
}

function abcBadge(cls: string) {
  if (cls === 'A') return 'bg-red-500/10 text-red-400'
  if (cls === 'B') return 'bg-brand-gold/10 text-brand-gold'
  return 'bg-green-500/10 text-green-400'
}

export default function LowStockWidget({ items, locale = 'ar' }: Props) {
  const isAr = locale === 'ar'

  if (items.length === 0) {
    return (
      <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
        <p className="font-satoshi text-sm text-brand-muted text-center py-4">
          {isAr ? 'لا يوجد مخزون منخفض' : 'No low stock items'}
        </p>
      </div>
    )
  }

  return (
    <div className="border border-brand-border rounded-xl overflow-hidden">
      <table className="w-full">
        <thead className="bg-brand-surface-2">
          <tr>
            <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
              {isAr ? 'المكوّن' : 'Ingredient'}
            </th>
            <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
              {isAr ? 'متاح' : 'Available'}
            </th>
            <th className="px-4 py-3 text-start font-satoshi text-xs text-brand-muted uppercase tracking-wide">
              {isAr ? 'أيام' : 'Days'}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.ingredient_id} className="border-t border-brand-border hover:bg-brand-surface-2 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-satoshi font-bold ${abcBadge(item.abc_class)}`}>
                    {item.abc_class}
                  </span>
                  <span className="font-satoshi text-sm text-brand-text">
                    {isAr ? item.name_ar : item.name_en}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className={`font-satoshi text-sm font-medium ${item.available <= 0 ? 'text-red-400' : 'text-brand-gold'}`}>
                  {item.available}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="font-satoshi text-xs text-brand-muted">
                  {item.days_to_out !== null ? item.days_to_out : '—'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
