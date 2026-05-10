'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { useTranslations } from 'next-intl'
import { colors } from '@/lib/design-tokens'
import type { BudgetVsActual } from '@/lib/supabase/custom-types'

interface Props {
  rows:  BudgetVsActual[]
  locale: string
}

export default function BudgetTrendChart({ rows, locale }: Props) {
  const t = useTranslations('inventory.reports.budget')
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'

  const data = rows.map((r) => ({
    month:      t(`months.${r.month}`).substring(0, 3),
    budget:     Number(r.purchase_budget_bhd),
    actual:     Number(r.actual_spend_bhd),
    waste:      Number(r.actual_waste_bhd),
    wasteBudget:Number(r.waste_budget_bhd),
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={colors.gold} stopOpacity={0.2} />
            <stop offset="95%" stopColor={colors.gold} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={colors.error} stopOpacity={0.15} />
            <stop offset="95%" stopColor={colors.error} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={`${colors.border}33`} />
        <XAxis 
          dataKey="month" 
          tick={{ fontFamily: isAr ? 'Almarai' : 'Satoshi', fontSize: 10, fill: colors.muted }} 
          axisLine={{ stroke: colors.border, strokeOpacity: 0.5 }}
          tickLine={false}
        />
        <YAxis 
          tick={{ fontFamily: 'Satoshi', fontSize: 10, fill: colors.muted }} 
          width={40} 
          axisLine={{ stroke: colors.border, strokeOpacity: 0.5 }}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: colors.surface2, 
            border: `1px solid ${colors.border}`,
            borderRadius: 12, 
            fontFamily: isAr ? 'Almarai' : 'Satoshi', 
            fontSize: 12,
            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
          }}
          labelStyle={{ color: colors.text, fontWeight: 'bold', marginBottom: 4 }}
          itemStyle={{ padding: '2px 0' }}
        />
        <Legend 
          verticalAlign="top" 
          align="right"
          iconType="circle"
          wrapperStyle={{ 
            fontFamily: isAr ? 'Almarai' : 'Satoshi', 
            fontSize: 10, 
            paddingBottom: 20,
            opacity: 0.8
          }} 
        />
        <Area
          type="monotone"
          dataKey="budget"
          name={t('budget')}
          stroke={colors.gold}
          strokeWidth={3}
          fill="url(#bgGrad)"
          activeDot={{ r: 6, strokeWidth: 0 }}
        />
        <Area
          type="monotone"
          dataKey="actual"
          name={t('actual')}
          stroke={colors.error}
          strokeWidth={3}
          fill="url(#actGrad)"
          activeDot={{ r: 6, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

