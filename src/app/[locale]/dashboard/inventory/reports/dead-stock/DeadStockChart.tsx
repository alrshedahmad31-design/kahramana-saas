'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useLocale, useTranslations } from 'next-intl'
import { colors } from '@/lib/design-tokens'

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string }>
  label?: string
}

function CustomTooltip({ active, payload, label, locale, currency }: TooltipProps & { locale: string; currency: string }) {
  if (!active || !payload?.length) return null
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  
  return (
    <div className="rounded-xl border px-4 py-3 shadow-xl backdrop-blur-md bg-brand-surface/90" style={{ borderColor: colors.border }}>
      <p className={`${font} text-[10px] text-brand-muted mb-1.5 uppercase tracking-widest font-bold max-w-[200px] truncate`}>
        {label}
      </p>
      <p className="font-satoshi text-lg font-black text-brand-gold tabular-nums">
        {Number(payload[0]?.value).toFixed(3)}
        <span className={`${font} text-[10px] text-brand-muted font-medium ms-1`}>{currency}</span>
      </p>
    </div>
  )
}

export default function DeadStockBarChart({ data }: { data: { name: string; value: number }[] }) {
  const locale = useLocale()
  const t = useTranslations('inventory.reports.deadStock')
  const tCommon = useTranslations('common')
  const isAr = locale === 'ar'
  const currency = tCommon('currency')

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-6 shadow-sm hover:shadow-md transition-all">
      <h3 className={`${isAr ? 'font-cairo' : 'font-satoshi'} text-sm font-black text-brand-text mb-6 uppercase tracking-wider`}>{t('totalValue')}</h3>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} opacity={0.3} />
            <XAxis 
              dataKey="name" 
              tick={{ fill: colors.muted, fontSize: 10, fontWeight: 600 }} 
              axisLine={{ stroke: colors.border, opacity: 0.5 }}
              tickLine={false}
              hide={data.length > 5}
            />
            <YAxis 
              tick={{ fill: colors.muted, fontSize: 10, fontWeight: 600 }}
              axisLine={{ stroke: colors.border, opacity: 0.5 }}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip locale={locale} currency={currency} />} cursor={{ fill: colors.surface2, opacity: 0.4 }} />
            <Bar 
              dataKey="value" 
              fill={colors.error} 
              radius={[4, 4, 0, 0]} 
              opacity={0.8}
              className="hover:opacity-100 transition-opacity cursor-pointer"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
