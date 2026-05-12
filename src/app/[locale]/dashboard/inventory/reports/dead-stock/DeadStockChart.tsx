'use client'

import {
  useState,
} from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { colors } from '@/lib/design-tokens'

function CustomTooltip({ label, value, locale, currency }: { label: string; value: number; locale: string; currency: string }) {
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  
  return (
    <div className="rounded-xl border px-4 py-3 shadow-xl backdrop-blur-md bg-brand-surface/90" style={{ borderColor: colors.border }}>
      <p className={`${font} text-[10px] text-brand-muted mb-1.5 uppercase tracking-widest font-bold max-w-[200px] truncate`}>
        {label}
      </p>
      <p className="font-satoshi text-lg font-black text-brand-gold tabular-nums">
        {value.toFixed(3)}
        <span className={`${font} text-[10px] text-brand-muted font-medium ms-1`}>{currency}</span>
      </p>
    </div>
  )
}

export default function DeadStockBarChart({ data }: { data: { name: string; value: number }[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const locale = useLocale()
  const t = useTranslations('inventory.reports.deadStock')
  const tCommon = useTranslations('common')
  const isAr = locale === 'ar'
  const currency = tCommon('currency')
  const maxValue = Math.max(...data.map((item) => item.value), 1)
  const activeItem = activeIndex === null ? null : data[activeIndex] ?? null

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-6 shadow-sm hover:shadow-md transition-all">
      <h3 className={`${isAr ? 'font-cairo' : 'font-satoshi'} text-sm font-black text-brand-text mb-6 uppercase tracking-wider`}>{t('totalValue')}</h3>
      <div className="relative h-[300px] w-full" onMouseLeave={() => setActiveIndex(null)}>
        <svg width="100%" height="300" viewBox="0 0 400 300" role="img" aria-hidden="true">
          {[0.25, 0.5, 0.75].map((ratio) => (
            <line key={ratio} x1="36" x2="392" y1={260 - ratio * 220} y2={260 - ratio * 220} stroke={colors.border} strokeDasharray="3 3" opacity="0.3" />
          ))}
          {data.map((item, index) => {
            const barWidth = 300 / Math.max(data.length, 1)
            const x = 46 + index * barWidth
            const h = (item.value / maxValue) * 220
            return (
              <g key={item.name} onMouseEnter={() => setActiveIndex(index)} onFocus={() => setActiveIndex(index)} tabIndex={-1}>
                <rect x={x} y={260 - h} width={Math.max(barWidth - 10, 8)} height={h} rx="4" fill={colors.error} opacity={activeIndex === index ? 1 : 0.8} className="transition-opacity cursor-pointer" />
                {data.length <= 5 && (
                  <text x={x + (barWidth - 10) / 2} y="282" textAnchor="middle" fill={colors.muted} fontSize="10" fontWeight="600">
                    {item.name}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
        {activeItem && (
          <div className="pointer-events-none absolute" style={{ left: '50%', top: 30, transform: 'translateX(-50%)' }}>
            <CustomTooltip label={activeItem.name} value={activeItem.value} locale={locale} currency={currency} />
          </div>
        )}
      </div>
    </div>
  )
}
