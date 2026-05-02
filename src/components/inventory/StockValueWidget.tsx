'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { colors } from '@/lib/design-tokens'
import type { InventoryValuationRow } from '@/lib/supabase/custom-types'

interface DailyPoint {
  date:  string
  value: number
}

interface Props {
  valuations:  InventoryValuationRow[]
  trendPoints: DailyPoint[]
  currency:    string
  isAr?:       boolean
}

interface TooltipProps { active?: boolean; payload?: Array<{ value: number }>; label?: string; currency: string }

function CustomTooltip({ active, payload, label, currency }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border px-3 py-2 shadow-lg" style={{ background: colors.surface, borderColor: colors.goldDark }}>
      <p className="font-satoshi text-xs text-brand-muted mb-1">{label}</p>
      <p className="font-satoshi text-sm font-bold text-brand-gold tabular-nums">
        {(payload[0]?.value ?? 0).toFixed(3)} {currency}
      </p>
    </div>
  )
}

export default function StockValueWidget({ valuations, trendPoints, currency, isAr = true }: Props) {
  const totalValue = valuations.reduce((s, r) => s + r.total_value_bhd, 0)

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-5 flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-brand-surface-2 border border-brand-border flex items-center justify-center text-brand-gold shrink-0">
          <ChartIcon />
        </div>
        <h3 className="font-satoshi font-bold text-sm text-brand-text">
          {isAr ? 'قيمة المخزون' : 'Stock Value'}
        </h3>
      </div>

      {/* Total */}
      <div>
        <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wider mb-1">
          {isAr ? 'الإجمالي' : 'Total'}
        </p>
        <p className="font-satoshi font-black text-3xl text-brand-gold tabular-nums leading-none">
          {totalValue.toFixed(3)}
          <span className="text-sm font-medium text-brand-muted ms-1.5">{currency}</span>
        </p>
      </div>

      {/* Branch breakdown */}
      {valuations.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {valuations.map(b => (
            <div key={b.branch_id} className="flex items-center justify-between gap-2">
              <span className="font-satoshi text-xs text-brand-muted truncate">
                {isAr ? b.branch_name : b.branch_name}
              </span>
              <span className="font-satoshi text-xs font-medium text-brand-text tabular-nums shrink-0">
                {b.total_value_bhd.toFixed(3)} {currency}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Mini trend chart */}
      {trendPoints.length > 1 && (
        <div className="mt-auto">
          <p className="font-satoshi text-xs text-brand-muted mb-2">
            {isAr ? 'آخر 14 يوم' : 'Last 14 days'}
          </p>
          <ResponsiveContainer width="100%" height={80}>
            <AreaChart data={trendPoints} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="stockValGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={colors.gold} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={colors.gold} stopOpacity={0}   />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <Tooltip content={<CustomTooltip currency={currency} />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={colors.gold}
                strokeWidth={2}
                fill="url(#stockValGrad)"
                dot={false}
                activeDot={{ r: 3, fill: colors.gold, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function ChartIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}
