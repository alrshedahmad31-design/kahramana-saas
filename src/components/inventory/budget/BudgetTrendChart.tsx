'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { colors } from '@/lib/design-tokens'
import type { BudgetVsActual } from '@/lib/supabase/custom-types'

const MONTH_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
const MONTH_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

interface Props {
  rows:  BudgetVsActual[]
  isAr?: boolean
}

export default function BudgetTrendChart({ rows, isAr = true }: Props) {
  const data = rows.map((r) => ({
    month:      isAr ? MONTH_AR[r.month - 1] : MONTH_EN[r.month - 1],
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
        <XAxis dataKey="month" tick={{ fontFamily: 'Satoshi', fontSize: 11, fill: colors.muted }} />
        <YAxis tick={{ fontFamily: 'Satoshi', fontSize: 11, fill: colors.muted }} width={52} />
        <Tooltip
          contentStyle={{
            background: colors.surface2, border: `1px solid ${colors.border}`,
            borderRadius: 8, fontFamily: 'Satoshi', fontSize: 12,
          }}
          labelStyle={{ color: colors.text }}
        />
        <Legend wrapperStyle={{ fontFamily: 'Satoshi', fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="budget"
          name={isAr ? 'ميزانية المشتريات' : 'Purchase Budget'}
          stroke={colors.gold}
          strokeWidth={2}
          fill="url(#bgGrad)"
        />
        <Area
          type="monotone"
          dataKey="actual"
          name={isAr ? 'الإنفاق الفعلي' : 'Actual Spend'}
          stroke={colors.error}
          strokeWidth={2}
          fill="url(#actGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
