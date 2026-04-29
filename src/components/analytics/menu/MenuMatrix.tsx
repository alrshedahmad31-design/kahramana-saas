import type { MenuItemPerformanceRow } from '@/lib/analytics/queries'

interface MatrixItem extends MenuItemPerformanceRow {
  quadrant: 'star' | 'puzzle' | 'plowhorse' | 'dog'
}

function getQuadrant(
  item:     MenuItemPerformanceRow,
  avgProfit: number,
  avgVolume: number,
): MatrixItem['quadrant'] {
  const highProfit = item.estimated_profit > avgProfit
  const highVolume = item.total_quantity  > avgVolume
  if (highProfit && highVolume)  return 'star'
  if (highProfit && !highVolume) return 'puzzle'
  if (!highProfit && highVolume) return 'plowhorse'
  return 'dog'
}

const QUADRANT_META = {
  star: {
    labelEn: 'Stars',        labelAr: 'النجوم',
    descEn:  'High profit, high volume — protect & maintain',
    descAr:  'ربح عالٍ وحجم عالٍ — احمِ هذه الأصناف',
    icon:    '★',
    border:  'border-brand-gold',
    bg:      'bg-brand-gold/5',
    titleColor: 'text-brand-gold',
  },
  puzzle: {
    labelEn: 'Puzzles',      labelAr: 'الألغاز',
    descEn:  'High profit, low volume — promote more',
    descAr:  'ربح عالٍ وحجم منخفض — روّج أكثر',
    icon:    '?',
    border:  'border-brand-success',
    bg:      'bg-brand-success/5',
    titleColor: 'text-brand-success',
  },
  plowhorse: {
    labelEn: 'Plowhorses',   labelAr: 'الأحصنة',
    descEn:  'Low profit, high volume — re-price or bundle',
    descAr:  'ربح منخفض وحجم عالٍ — أعِد التسعير أو ادمج',
    icon:    '~',
    border:  'border-brand-border',
    bg:      'bg-brand-surface-2',
    titleColor: 'text-brand-text',
  },
  dog: {
    labelEn: 'Dogs',         labelAr: 'الكلاب',
    descEn:  'Low profit, low volume — review or remove',
    descAr:  'ربح منخفض وحجم منخفض — راجع أو احذف',
    icon:    '×',
    border:  'border-brand-error/50',
    bg:      'bg-brand-error/5',
    titleColor: 'text-brand-error',
  },
}

const ORDER: MatrixItem['quadrant'][] = ['star', 'puzzle', 'plowhorse', 'dog']

interface Props {
  items: MenuItemPerformanceRow[]
  isRTL: boolean
}

export default function MenuMatrix({ items, isRTL }: Props) {
  if (!items.length) {
    return (
      <p className={`text-sm text-brand-muted ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
        {isRTL ? 'لا توجد بيانات' : 'No menu data yet'}
      </p>
    )
  }

  const avgProfit = items.reduce((s, i) => s + i.estimated_profit, 0) / items.length
  const avgVolume = items.reduce((s, i) => s + i.total_quantity,   0) / items.length

  const byQuadrant: Record<MatrixItem['quadrant'], MenuItemPerformanceRow[]> = {
    star: [], puzzle: [], plowhorse: [], dog: [],
  }
  for (const item of items) {
    byQuadrant[getQuadrant(item, avgProfit, avgVolume)].push(item)
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {ORDER.map((q) => {
        const meta  = QUADRANT_META[q]
        const group = byQuadrant[q]
        return (
          <div
            key={q}
            className={`rounded-xl border ${meta.border} ${meta.bg} p-4 min-h-[160px]`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-lg font-bold ${meta.titleColor}`}>{meta.icon}</span>
              <div>
                <p className={`text-sm font-bold ${meta.titleColor} ${isRTL ? 'font-cairo' : 'font-satoshi'}`}>
                  {isRTL ? meta.labelAr : meta.labelEn}
                </p>
                <p className={`text-xs text-brand-muted ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                  {isRTL ? meta.descAr : meta.descEn}
                </p>
              </div>
            </div>

            {group.length === 0 ? (
              <p className="text-xs text-brand-muted font-satoshi italic">—</p>
            ) : (
              <ul className="space-y-1">
                {group.slice(0, 5).map((item) => (
                  <li key={item.item_id} className={`text-xs text-brand-text truncate ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                    {isRTL ? item.name_ar : item.name_en}
                  </li>
                ))}
                {group.length > 5 && (
                  <li className="text-xs text-brand-muted font-satoshi">+{group.length - 5} more</li>
                )}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
