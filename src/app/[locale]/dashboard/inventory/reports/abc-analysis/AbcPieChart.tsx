'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useLocale, useTranslations } from 'next-intl'
import { colors } from '@/lib/design-tokens'

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string; payload: { name: string; value: number } }>
}

function CustomTooltip({ active, payload, locale, currency }: TooltipProps & { locale: string; currency: string }) {
  if (!active || !payload?.length) return null
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  
  return (
    <div className="rounded-xl border px-4 py-3 shadow-xl backdrop-blur-md bg-brand-surface/90" style={{ borderColor: colors.border }}>
      <p className={`${font} text-[10px] text-brand-muted mb-1.5 uppercase tracking-widest font-bold`}>
        {payload[0]?.payload?.name}
      </p>
      <p className="font-satoshi text-lg font-black text-brand-gold tabular-nums">
        {Number(payload[0]?.value).toFixed(3)}
        <span className={`${font} text-[10px] text-brand-muted font-medium ms-1`}>{currency}</span>
      </p>
    </div>
  )
}

const ABC_COLORS: Record<string, string> = {
  A: colors.error,
  B: colors.gold,
  C: colors.success,
}

export default function AbcPieChart({ data }: { data: { name: string; value: number }[] }) {
  const locale = useLocale()
  const t = useTranslations('inventory.reports.abcAnalysis')
  const tCommon = useTranslations('common')
  const isAr = locale === 'ar'
  const currency = tCommon('currency')

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-6 shadow-sm hover:shadow-md transition-all">
      <h3 className={`${isAr ? 'font-cairo' : 'font-satoshi'} text-sm font-black text-brand-text mb-6 uppercase tracking-wider`}>{t('chartTitle')}</h3>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={5}
              stroke="none"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={ABC_COLORS[entry.name] ?? colors.muted} opacity={0.8} className="hover:opacity-100 transition-opacity cursor-pointer" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip locale={locale} currency={currency} />} />
            <Legend 
              verticalAlign="bottom" 
              align="center"
              formatter={(value) => (
                <span className={`${isAr ? 'font-almarai' : 'font-satoshi'} text-xs font-bold text-brand-muted uppercase tracking-widest ms-2`}>
                  {value}
                </span>
              )} 
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}


