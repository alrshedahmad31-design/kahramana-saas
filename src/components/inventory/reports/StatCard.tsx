'use client'

import { useLocale } from 'next-intl'

interface Props {
  label: string
  value: string | number
  sub?: string
  trend?: 'up' | 'down' | 'neutral'
  highlight?: boolean
}

export default function StatCard({ label, value, sub, trend, highlight }: Props) {
  const locale = useLocale()
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'

  return (
    <div className={`bg-brand-surface border rounded-xl p-4 ${highlight ? 'border-brand-gold' : 'border-brand-border'} shadow-sm transition-all hover:shadow-md`}>
      <p className={`${font} text-[10px] text-brand-muted uppercase tracking-wider font-semibold`}>{label}</p>
      <p className={`font-cairo text-2xl font-black mt-1 ${highlight ? 'text-brand-gold' : 'text-brand-text'} tabular-nums`}>
        {value}
      </p>
      {sub && <p className={`${font} text-xs text-brand-muted mt-0.5`}>{sub}</p>}
      {trend && (
        <span className={`${font} text-xs font-medium mt-1 inline-block ${trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-brand-error' : 'text-brand-muted'}`}>
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—'}
        </span>
      )}
    </div>
  )
}

