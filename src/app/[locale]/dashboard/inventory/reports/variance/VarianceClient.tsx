'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
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
  currency: string
  locale: string
}

function CustomTooltip({ active, payload, label, currency, locale }: TooltipProps) {
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

function AbcBadge({ cls, font }: { cls: string; font: string }) {
  const color =
    cls === 'A'
      ? 'border-brand-error/30 bg-brand-error/10 text-brand-error'
      : cls === 'B'
        ? 'border-brand-gold/30 bg-brand-gold/10 text-brand-gold'
        : 'border-brand-success/30 bg-brand-success/10 text-brand-success'
  return (
    <span className={`inline-block rounded-md border px-2 py-0.5 ${font} text-[10px] font-black tracking-tighter shadow-sm ${color}`}>
      {cls}
    </span>
  )
}

export default function VarianceClient({
  rows,
  branches,
  locale,
  isGlobal,
}: {
  rows: VarianceRow[]
  branches: { id: string; name_ar: string; name_en?: string | null }[]
  locale: string
  isGlobal: boolean
}) {
  const t = useTranslations('inventory.reports.variance')
  const tCommon = useTranslations('common')
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  const currency = tCommon('currency')

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

  const chartData = top10.map((r) => ({ name: isAr ? r.name_ar : (r.name_en || r.name_ar), value: r.variance_cost_bhd }))

  const exportRows = filtered.map((r) => ({
    name: isAr ? r.name_ar : (r.name_en || r.name_ar),
    abc_class: r.abc_class,
    branch: branches.find(b => b.id === r.branch_id)?.name_ar || r.branch_id,
    theoretical_usage: r.theoretical_usage.toFixed(2),
    actual_usage: r.actual_usage.toFixed(2),
    variance: r.variance.toFixed(2),
    variance_pct: r.variance_pct?.toFixed(1) ?? '0',
    variance_cost_bhd: r.variance_cost_bhd.toFixed(3),
  }))

  const exportColumns = [
    { key: 'name', header: t('ingredient') },
    { key: 'abc_class', header: 'ABC' },
    { key: 'branch', header: tCommon('branch') },
    { key: 'theoretical_usage', header: t('theoretical') },
    { key: 'actual_usage', header: t('actual') },
    { key: 'variance', header: t('diff') },
    { key: 'variance_pct', header: t('diffPct') },
    { key: 'variance_cost_bhd', header: `${t('diffCost')} ${currency}` },
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-brand-gold bg-brand-surface p-5 shadow-sm hover:shadow-md transition-all group">
          <p className={`${font} text-[10px] text-brand-muted uppercase tracking-widest font-bold group-hover:text-brand-gold transition-colors`}>{t('totalCost')}</p>
          <p className="font-satoshi text-2xl font-black text-brand-gold mt-2 tabular-nums">
            {totalVarianceCost.toFixed(3)}
            <span className={`${font} text-xs text-brand-muted font-medium ms-1`}>{currency}</span>
          </p>
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-5 shadow-sm hover:shadow-md transition-all">
          <p className={`${font} text-[10px] text-brand-muted uppercase tracking-widest font-bold`}>{t('itemsHighVariance')}</p>
          <p className="font-satoshi text-2xl font-black text-brand-text mt-2">{highVarianceCount}</p>
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-5 shadow-sm hover:shadow-md transition-all">
          <p className={`${font} text-[10px] text-brand-muted uppercase tracking-widest font-bold`}>{t('totalItems')}</p>
          <p className="font-satoshi text-2xl font-black text-brand-text mt-2">{filtered.length}</p>
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-5 shadow-sm hover:shadow-md transition-all">
          <p className={`${font} text-[10px] text-brand-muted uppercase tracking-widest font-bold`}>{t('refresh')}</p>
          <p className={`${font} text-xs text-brand-muted mt-2 leading-relaxed font-medium`}>{t('refreshNote')}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-brand-border bg-brand-surface p-4 shadow-sm">
        {isGlobal && (
          <div className="flex items-center gap-2">
            <span className={`${font} text-[10px] text-brand-muted uppercase tracking-widest font-bold`}>{tCommon('branch')}</span>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className={`rounded-lg border border-brand-border bg-brand-surface-2 px-4 py-2 ${font} text-xs text-brand-text focus:border-brand-gold focus:outline-none transition-all appearance-none cursor-pointer shadow-inner`}
            >
              <option value="all">{t('allBranches')}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {isAr ? b.name_ar : (b.name_en || b.name_ar)}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className={`${font} text-[10px] text-brand-muted uppercase tracking-widest font-bold`}>ABC</span>
          <select
            value={abcFilter}
            onChange={(e) => setAbcFilter(e.target.value)}
            className={`rounded-lg border border-brand-border bg-brand-surface-2 px-4 py-2 ${font} text-xs text-brand-text focus:border-brand-gold focus:outline-none transition-all appearance-none cursor-pointer shadow-inner`}
          >
            <option value="all">{t('allAbc')}</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className={`${font} text-[10px] text-brand-muted uppercase tracking-widest font-bold`}>{isAr ? 'الحد الأدنى' : 'Min'}</span>
          <input
            type="number"
            placeholder={currency}
            value={minVariance}
            onChange={(e) => setMinVariance(e.target.value)}
            className={`rounded-lg border border-brand-border bg-brand-surface-2 px-4 py-2 ${font} text-xs text-brand-text placeholder:text-brand-muted/50 focus:border-brand-gold focus:outline-none w-32 transition-all shadow-inner tabular-nums font-bold`}
          />
        </div>
        <div className="ms-auto">
          <ExportButton rows={exportRows} columns={exportColumns} filename={t('reportName')} exportAction={exportToExcel} />
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-brand-border bg-brand-surface p-6 shadow-sm hover:shadow-md transition-all">
        <h3 className={`${isAr ? 'font-cairo' : 'font-satoshi'} text-sm font-black text-brand-text mb-6 uppercase tracking-wider`}>{t('topVarianceChart')}</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} opacity={0.3} />
              <XAxis dataKey="name" tick={{ fill: colors.muted, fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: colors.muted, fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: colors.surface2, opacity: 0.4 }} content={<CustomTooltip currency={currency} locale={locale} />} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.value > 0 ? colors.error : colors.success} opacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-brand-border bg-brand-surface shadow-sm">
        <table className="w-full text-start">
          <thead className="bg-brand-surface-2 border-b border-brand-border">
            <tr>
              <th className={`px-5 py-3 text-start ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('ingredient')}</th>
              <th className={`px-5 py-3 text-start ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>ABC</th>
              <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('theoretical')}</th>
              <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('actual')}</th>
              <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('diff')}</th>
              <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('diffPct')}</th>
              <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{currency}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border/30">
            {filtered.map((r, i) => (
              <tr key={r.ingredient_id + i} className="hover:bg-brand-surface-2 transition-colors group">
                <td className={`px-5 py-3 ${font} text-sm font-medium text-brand-text group-hover:text-brand-gold transition-colors`}>{isAr ? r.name_ar : (r.name_en || r.name_ar)}</td>
                <td className="px-5 py-3"><AbcBadge cls={r.abc_class} font={font} /></td>
                <td className="px-5 py-3 text-end font-satoshi text-sm font-bold text-brand-muted tabular-nums">{r.theoretical_usage.toFixed(2)}</td>
                <td className="px-5 py-3 text-end font-satoshi text-sm font-bold text-brand-muted tabular-nums">{r.actual_usage.toFixed(2)}</td>
                <td className={`px-5 py-3 text-end font-satoshi text-sm font-black tabular-nums ${r.variance > 0 ? 'text-brand-error' : 'text-brand-success'}`}>
                  {r.variance > 0 ? '+' : ''}{r.variance.toFixed(2)}
                </td>
                <td className={`px-5 py-3 text-end font-satoshi text-sm tabular-nums ${Math.abs(r.variance_pct ?? 0) > 10 ? 'text-brand-error font-black' : 'text-brand-muted font-bold'}`}>
                  {r.variance_pct?.toFixed(1) ?? '0'}%
                </td>
                <td className={`px-5 py-3 text-end font-satoshi text-sm font-black tabular-nums ${r.variance_cost_bhd > 0 ? 'text-brand-error' : 'text-brand-success'}`}>
                  {r.variance_cost_bhd.toFixed(3)}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className={`px-5 py-12 text-center ${font} text-sm font-bold text-brand-muted uppercase tracking-widest bg-brand-surface-2/30`}>{tCommon('noResults')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}


