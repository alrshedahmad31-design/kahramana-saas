'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { colors } from '@/lib/design-tokens'
import type { DishCogsRow } from '@/lib/supabase/custom-types'
import StatCard from '@/components/inventory/reports/StatCard'
import ExportButton from '@/components/inventory/reports/ExportButton'
import { exportToExcel } from '../actions'

// ─── Tooltip ──────────────────────────────────────────────────────────────────
interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border px-3 py-2 shadow-lg" style={{ background: colors.surface, borderColor: colors.border }}>
      <p className="font-satoshi text-xs text-brand-muted mb-1 max-w-[180px] truncate">{label}</p>
      <p className="font-satoshi text-sm font-bold text-brand-gold tabular-nums">
        BD {payload[0]?.value?.toFixed(3)}
      </p>
    </div>
  )
}

// ─── Margin badge ─────────────────────────────────────────────────────────────
function MarginBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="font-satoshi text-xs text-brand-muted">—</span>
  const cls =
    pct >= 60
      ? 'border-green-500/30 bg-green-500/10 text-green-400'
      : pct >= 40
        ? 'border-brand-gold/30 bg-brand-gold/10 text-brand-gold'
        : 'border-brand-error/30 bg-brand-error/10 text-brand-error'
  return (
    <span className={`inline-block rounded-md border px-2 py-0.5 font-satoshi text-xs font-semibold tabular-nums ${cls}`}>
      {pct.toFixed(1)}%
    </span>
  )
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────
function COGSBarChart({ dishes }: { dishes: DishCogsRow[] }) {
  const top20 = [...dishes]
    .sort((a, b) => Number(b.cost_bhd) - Number(a.cost_bhd))
    .slice(0, 20)
    .map((d) => ({
      name: d.name_ar,
      value: Number(d.cost_bhd),
      margin: d.margin_pct ?? 0,
    }))

  const getColor = (margin: number) => {
    if (margin >= 60) return colors.success
    if (margin >= 40) return colors.gold
    return colors.error
  }

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
      <p className="font-cairo text-sm font-black text-brand-text mb-4">أعلى 20 طبق من حيث التكلفة</p>
      <ResponsiveContainer width="100%" height={420}>
        <BarChart data={top20} layout="vertical" margin={{ right: 16, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.surface2} horizontal={false} />
          <XAxis type="number" tick={{ fill: colors.muted, fontSize: 11 }} tickFormatter={(v: number) => `${v.toFixed(2)}`} />
          <YAxis type="category" dataKey="name" tick={{ fill: colors.muted, fontSize: 11 }} width={120} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {top20.map((entry, index) => (
              <Cell key={index} fill={getColor(entry.margin)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Main client component ────────────────────────────────────────────────────
export default function COGSClient({ dishes, isAr }: { dishes: DishCogsRow[]; isAr: boolean }) {
  const [marginFilter, setMarginFilter] = useState('all')

  const avgMargin =
    dishes.length > 0
      ? dishes.reduce((s, d) => s + (d.margin_pct ?? 0), 0) / dishes.length
      : 0
  const totalCogs = dishes.reduce((s, d) => s + Number(d.cost_bhd), 0)
  const best = dishes.reduce<DishCogsRow | null>(
    (b, d) => (!b || (d.margin_pct ?? 0) > (b.margin_pct ?? 0) ? d : b),
    null,
  )
  const worst = dishes.reduce<DishCogsRow | null>(
    (w, d) => (!w || (d.margin_pct ?? 0) < (w.margin_pct ?? 0) ? d : w),
    null,
  )

  const filtered = dishes.filter((d) => {
    return (
      marginFilter === 'all' ||
      (marginFilter === 'lt20' && (d.margin_pct ?? 100) < 20) ||
      (marginFilter === '20-40' && (d.margin_pct ?? 0) >= 20 && (d.margin_pct ?? 0) < 40) ||
      (marginFilter === 'gt40' && (d.margin_pct ?? 0) >= 40)
    )
  })

  const exportRows = filtered.map((d) => ({
    name_ar: d.name_ar,
    selling_price: Number(d.selling_price ?? 0).toFixed(3),
    cost_bhd: Number(d.cost_bhd).toFixed(3),
    profit_bhd: Number(d.profit_bhd ?? 0).toFixed(3),
    margin_pct: d.margin_pct?.toFixed(1) ?? '',
  }))
  const exportColumns = [
    { key: 'name_ar', header: 'الطبق' },
    { key: 'selling_price', header: 'السعر BD' },
    { key: 'cost_bhd', header: 'التكلفة BD' },
    { key: 'profit_bhd', header: 'الربح BD' },
    { key: 'margin_pct', header: 'هامش الربح %' },
  ]

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={isAr ? 'متوسط هامش الربح' : 'Avg Margin'} value={`${avgMargin.toFixed(1)}%`} highlight />
        <StatCard label={isAr ? 'إجمالي COGS' : 'Total COGS'} value={`BD ${totalCogs.toFixed(3)}`} />
        <StatCard
          label={isAr ? 'أفضل طبق' : 'Best Dish'}
          value={best?.name_ar ?? '—'}
          sub={`${(best?.margin_pct ?? 0).toFixed(1)}%`}
          trend="up"
        />
        <StatCard
          label={isAr ? 'أضعف طبق' : 'Worst Dish'}
          value={worst?.name_ar ?? '—'}
          sub={`${(worst?.margin_pct ?? 0).toFixed(1)}%`}
          trend="down"
        />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-border bg-brand-surface p-4">
        <span className="font-satoshi text-sm text-brand-muted">{isAr ? 'الهامش:' : 'Margin:'}</span>
        {[
          { v: 'all', l: isAr ? 'الكل' : 'All' },
          { v: 'lt20', l: '<20%' },
          { v: '20-40', l: '20–40%' },
          { v: 'gt40', l: '>40%' },
        ].map((f) => (
          <button
            key={f.v}
            type="button"
            onClick={() => setMarginFilter(f.v)}
            className={`rounded-lg px-3 py-1.5 font-satoshi text-xs font-medium transition-colors ${marginFilter === f.v ? 'bg-brand-gold text-brand-black' : 'border border-brand-border text-brand-muted hover:border-brand-gold hover:text-brand-gold'}`}
          >
            {f.l}
          </button>
        ))}
        <div className="ms-auto">
          <ExportButton rows={exportRows} columns={exportColumns} filename="cogs-report" exportAction={exportToExcel} />
        </div>
      </div>

      {/* Chart */}
      <COGSBarChart dishes={dishes} />

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-brand-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-border bg-brand-surface-2">
              <th className="px-4 py-3 text-start font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">{isAr ? 'الطبق' : 'Dish'}</th>
              <th className="px-4 py-3 text-end font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">{isAr ? 'السعر BD' : 'Price BD'}</th>
              <th className="px-4 py-3 text-end font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">{isAr ? 'التكلفة BD' : 'Cost BD'}</th>
              <th className="px-4 py-3 text-end font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">{isAr ? 'الربح BD' : 'Profit BD'}</th>
              <th className="px-4 py-3 text-end font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">{isAr ? 'هامش الربح' : 'Margin'}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((dish, i) => (
              <tr key={dish.slug ?? i} className="border-b border-brand-border/50 hover:bg-brand-surface-2 transition-colors">
                <td className="px-4 py-3 font-satoshi text-brand-text">{dish.name_ar}</td>
                <td className="px-4 py-3 text-end font-satoshi tabular-nums text-brand-text">{Number(dish.selling_price ?? 0).toFixed(3)}</td>
                <td className="px-4 py-3 text-end font-satoshi tabular-nums text-brand-muted">{Number(dish.cost_bhd).toFixed(3)}</td>
                <td className="px-4 py-3 text-end font-satoshi tabular-nums text-brand-text">{Number(dish.profit_bhd ?? 0).toFixed(3)}</td>
                <td className="px-4 py-3 text-end"><MarginBadge pct={dish.margin_pct ?? null} /></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center font-satoshi text-sm text-brand-muted">{isAr ? 'لا توجد نتائج' : 'No results'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
