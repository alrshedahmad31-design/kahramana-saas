'use client'

import LightweightAreaChart from '@/components/charts/LightweightAreaChart'
import { formatDateShort } from '@/lib/analytics/calculations'
import type { DailySalesRow } from '@/lib/analytics/queries'

interface Props {
  data:     DailySalesRow[]
  currency: string
}

export default function RevenueChart({ data, currency }: Props) {
  if (!data.length) {
    return (
      <div className="h-48 flex items-center justify-center">
        <p className="font-satoshi text-sm text-brand-muted">No data for this period</p>
      </div>
    )
  }

  const chartData = data.map((r) => ({
    label: formatDateShort(r.order_date),
    value: parseFloat(r.total_revenue_bhd.toFixed(3)),
  }))

  return (
    <LightweightAreaChart
      points={chartData}
      currency={currency}
      height={220}
      gradientId="revenueGrad"
      showAxes
    />
  )
}
