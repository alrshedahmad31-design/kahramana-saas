'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { colors } from '@/lib/design-tokens'
import ExportButton from '@/components/inventory/reports/ExportButton'
import { exportToExcel } from '../actions'

interface VarianceRow {
  ingredient_id: string
  name_ar: string
  name_en: string
  abc_class: string
  branch_id: string
  theoretical_usage: number
  actual_usage: number
  variance: number
  variance_pct: number | null
  variance_cost_bhd: number
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border px-3 py-2 shadow-lg" style={{ background: colors.surface, borderColor: colors.border }}>
      <p className="font-satoshi text-xs text-brand-muted mb-1 max-w-[160px] truncate">{label}</p>
      <p className="font-satoshi text-sm font-bold text-brand-gold tabular-nums">
        BD {payload[0]?.value?.toFixed(3)}
      </p>
    </div>
  )
}

function AbcBadge({ cls }: { cls: string }) {
  const color =
    cls === 'A'
      ? 'border-brand-error/30 bg-brand-error/10 text-brand-error'
      : cls === 'B'
        ? 'border-brand-gold/30 bg-brand-gold/10 text-brand-gold'
        : 'border-green-500/30 bg-green-500/10 text-green-400'
  return (
    <span className={`inline-block rounded-md border px-2 py-0.5 font-satoshi text-xs font-bold ${color}`}>
      {cls}
    </span>
  )
}

export default function VarianceClient({
  rows,
  branches,
  isAr,
  isGlobal,
}: {
  rows: VarianceRow[]
  branches: { id: string; name_ar: string }[]
  isAr: boolean
  isGlobal: boolean
}) {
  const [branchFilter, setBranchFilter] = useState('all')
  const [abcFilter, setAbcFilter] = useState('all')
  const [minVariance, setMinVariance] = useState('')

  const filtered = rows.filter((r) => {
    const branchOk = !isGlobal || branchFilter === 'all' || r.branch_id === branchFilter
    const abcOk = abcFilter === 'all' || r.abc_class === abcFilter
    const minOk = !minVariance || Math.abs(r.variance_cost_bhd) >= Number(minVariance)
    return branchOk && abcOk && minOk
  })

  const totalVarianceCost = filtered.reduce((s, r) => s + r.variance_cost_bhd, 0)
  const highVarianceCount = filtered.filter((r) => Math.abs(r.variance_pct ?? 0) > 10).length

  const top10 = [...filtered]
    .sort((a, b) => Math.abs(b.variance_cost_bhd) - Math.abs(a.variance_cost_bhd))
    .slice(0, 10)

  const chartData = top10.map((r) => ({ name: r.name_ar, value: r.variance_cost_bhd }))

  const exportRows = filtered.map((r) => ({
    name_ar: r.name_ar,
    abc_class: r.abc_class,
    branch_id: r.branch_id,
    theoretical_usage: r.theoretical_usage,
    actual_usage: r.actual_usage,
    variance: r.variance,
    variance_pct: r.variance_pct?.toFixed(1) ?? '',
    variance_cost_bhd: r.variance_cost_bhd.toFixed(3),
  }))
  const exportColumns = [
    { key: 'name_ar', header: 'المكوّن' },
    { key: 'abc_class', header: 'ABC' },
    { key: 'branch_id', header: 'الفرع' },
    { key: 'theoretical_usage', header: 'الاستهلاك النظري' },
    { key: 'actual_usage', header: 'الاستهلاك الفعلي' },
    { key: 'variance', header: 'التباين' },
    { key: 'variance_pct', header: 'التباين %' },
    { key: 'variance_cost_bhd', header: 'تكلفة التباين BD' },
  ]

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-brand-gold bg-brand-surface p-4">
          <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'إجمالي تكلفة التباين' : 'Total Variance Cost'}</p>
          <p className="font-cairo text-2xl font-black text-brand-gold mt-1 tabular-nums">BD {totalVarianceCost.toFixed(3)}</p>
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'أصناف بتباين >10%' : 'Items >10% variance'}</p>
          <p className="font-cairo text-2xl font-black text-brand-text mt-1">{highVarianceCount}</p>
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'إجمالي الأصناف' : 'Total Items'}</p>
          <p className="font-cairo text-2xl font-black text-brand-text mt-1">{filtered.length}</p>
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
          <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wide">{isAr ? 'التحديث' : 'Refresh'}</p>
          <p className="font-satoshi text-sm text-brand-muted mt-1">التحديث التلقائي كل ساعة</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-border bg-brand-surface p-4">
        {isGlobal && (
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-1.5 font-satoshi text-xs text-brand-text focus:border-brand-gold focus:outline-none"
          >
            <option value="all">{isAr ? 'كل الفروع' : 'All branches'}</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name_ar}</option>)}
          </select>
        )}
        <select
          value={abcFilter}
          onChange={(e) => setAbcFilter(e.target.value)}
          className="rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-1.5 font-satoshi text-xs text-brand-text focus:border-brand-gold focus:outline-none"
        >
          <option value="all">{isAr ? 'كل التصنيفات' : 'All ABC'}</option>
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="C">C</option>
        </select>
        <input
          type="number"
          placeholder={isAr ? 'حد أدنى للتكلفة BD' : 'Min cost BD'}
          value={minVariance}
          onChange={(e) => setMinVariance(e.target.value)}
          className="rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-1.5 font-satoshi text-xs text-brand-text placeholder:text-brand-muted focus:border-brand-gold focus:outline-none w-36"
        />
        <div className="ms-auto">
          <ExportButton rows={exportRows} columns={exportColumns} filename="variance-report" exportAction={exportToExcel} />
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
        <p className="font-cairo text-sm font-black text-brand-text mb-4">{isAr ? 'أعلى 10 أصناف بتباين' : 'Top 10 by Variance Cost'}</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.surface2} />
            <XAxis dataKey="name" tick={{ fill: colors.muted, fontSize: 11 }} />
            <YAxis tick={{ fill: colors.muted, fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" fill={colors.gold} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-brand-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-border bg-brand-surface-2">
              <th className="px-4 py-3 text-start font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">المكوّن</th>
              <th className="px-4 py-3 text-start font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">ABC</th>
              <th className="px-4 py-3 text-end font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">النظري</th>
              <th className="px-4 py-3 text-end font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">الفعلي</th>
              <th className="px-4 py-3 text-end font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">التباين</th>
              <th className="px-4 py-3 text-end font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">التباين %</th>
              <th className="px-4 py-3 text-end font-satoshi text-xs font-semibold text-brand-muted uppercase tracking-wide">التكلفة BD</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.ingredient_id + i} className="border-b border-brand-border/50 hover:bg-brand-surface-2 transition-colors">
                <td className="px-4 py-3 font-satoshi text-brand-text">{r.name_ar}</td>
                <td className="px-4 py-3"><AbcBadge cls={r.abc_class} /></td>
                <td className="px-4 py-3 text-end font-satoshi tabular-nums text-brand-muted">{r.theoretical_usage.toFixed(2)}</td>
                <td className="px-4 py-3 text-end font-satoshi tabular-nums text-brand-muted">{r.actual_usage.toFixed(2)}</td>
                <td className={`px-4 py-3 text-end font-satoshi tabular-nums font-semibold ${r.variance > 0 ? 'text-brand-error' : 'text-green-400'}`}>
                  {r.variance.toFixed(2)}
                </td>
                <td className={`px-4 py-3 text-end font-satoshi tabular-nums ${Math.abs(r.variance_pct ?? 0) > 10 ? 'text-brand-error font-semibold' : 'text-brand-muted'}`}>
                  {r.variance_pct?.toFixed(1) ?? '—'}%
                </td>
                <td className={`px-4 py-3 text-end font-satoshi tabular-nums font-semibold ${r.variance_cost_bhd > 0 ? 'text-brand-error' : 'text-green-400'}`}>
                  {r.variance_cost_bhd.toFixed(3)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center font-satoshi text-sm text-brand-muted">لا توجد نتائج</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
