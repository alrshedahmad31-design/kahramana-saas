'use client'

import { useTranslations } from 'next-intl'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { colors } from '@/lib/design-tokens'

const PIE_COLORS = [colors.gold, colors.error, colors.success, colors.muted, colors.border, colors.surface2]

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string; payload: { name: string; value: number } }>
  locale: string
}

function CustomTooltip({ active, payload, locale }: TooltipProps) {
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
        <span className={`${font} text-[10px] text-brand-muted font-medium ms-1`}>BD</span>
      </p>
    </div>
  )
}

export default function ValuationPieChart({ data, locale }: { data: { name: string; value: number }[]; locale: string }) {
  const t = useTranslations('inventory.reports.valuation')
  const isAr = locale === 'ar'
  const font = isAr ? 'font-cairo' : 'font-satoshi'

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <h3 className={`${font} text-sm font-black text-brand-text`}>{t('valueByCategory')}</h3>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={100}
              paddingAngle={5}
              stroke="none"
              label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {data.map((_, index) => (
                <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip locale={locale} />} />
            <Legend 
              formatter={(value) => <span className={`${isAr ? 'font-almarai' : 'font-satoshi'} text-[10px] text-brand-muted font-bold uppercase tracking-widest`}>{value}</span>}
              iconType="circle"
              iconSize={8}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

