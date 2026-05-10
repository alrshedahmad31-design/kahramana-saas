'use client'

import { useTranslations } from 'next-intl'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { colors } from '@/lib/design-tokens'

const PIE_COLORS = [colors.gold, '#ef4444', '#22c55e', colors.muted, colors.border]

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string; payload: { name: string; value: number; date?: string } }>
  label?: string
  locale: string
}

function CustomPieTooltip({ active, payload, locale }: TooltipProps) {
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

function CustomLineTooltip({ active, payload, label, locale }: TooltipProps) {
  if (!active || !payload?.length) return null
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  
  return (
    <div className="rounded-xl border px-4 py-3 shadow-xl backdrop-blur-md bg-brand-surface/90" style={{ borderColor: colors.border }}>
      <p className={`${font} text-[10px] text-brand-muted mb-1.5 uppercase tracking-widest font-bold`}>
        {new Date(label || '').toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB', { day: 'numeric', month: 'short' })}
      </p>
      <p className="font-satoshi text-lg font-black text-brand-gold tabular-nums">
        {Number(payload[0]?.value).toFixed(3)}
        <span className={`${font} text-[10px] text-brand-muted font-medium ms-1`}>BD</span>
      </p>
    </div>
  )
}

export function WasteByReasonChart({ data, locale }: { data: { name: string; value: number }[]; locale: string }) {
  const t = useTranslations('inventory.reports.wasteReport')
  const isAr = locale === 'ar'
  const font = isAr ? 'font-cairo' : 'font-satoshi'

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <h3 className={`${font} text-sm font-black text-brand-text`}>{t('byReason')}</h3>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie 
              data={data} 
              dataKey="value" 
              nameKey="name" 
              cx="50%" 
              cy="50%" 
              innerRadius={60}
              outerRadius={90} 
              paddingAngle={5}
              stroke="none"
              label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {data.map((_, index) => (
                <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomPieTooltip locale={locale} />} />
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

export function WasteTrendChart({ data, locale }: { data: { date: string; cost: number }[]; locale: string }) {
  const t = useTranslations('inventory.reports.wasteReport')
  const isAr = locale === 'ar'
  const font = isAr ? 'font-cairo' : 'font-satoshi'

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
      <h3 className={`${font} text-sm font-black text-brand-text`}>{t('dailyTrend')}</h3>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.surface2} vertical={false} />
            <XAxis 
              dataKey="date" 
              tick={{ fill: colors.muted, fontSize: 10, fontWeight: 700 }} 
              tickFormatter={(v) => new Date(v).toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB', { day: 'numeric', month: 'short' })}
              axisLine={false}
              tickLine={false}
              dy={10}
            />
            <YAxis 
              tick={{ fill: colors.muted, fontSize: 10, fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
              dx={-10}
            />
            <Tooltip content={<CustomLineTooltip locale={locale} />} cursor={{ stroke: colors.surface2, strokeWidth: 1 }} />
            <Line 
              type="monotone" 
              dataKey="cost" 
              stroke={colors.gold} 
              strokeWidth={3} 
              dot={{ fill: colors.gold, r: 0, strokeWidth: 2 }} 
              activeDot={{ r: 5, fill: colors.gold, stroke: colors.surface, strokeWidth: 2 }}
              animationDuration={1500}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

