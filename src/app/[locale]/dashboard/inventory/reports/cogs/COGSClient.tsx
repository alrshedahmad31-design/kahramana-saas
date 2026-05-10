'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
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
  currency: string
  locale: string
}

function CustomTooltip({ active, payload, label, currency, locale }: TooltipProps) {
  if (!active || !payload?.length) return null
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  
  return (
    <div className="rounded-xl border px-4 py-3 shadow-xl backdrop-blur-md bg-brand-surface/90" style={{ borderColor: colors.border }}>
      <p className={`${font} text-[10px] text-brand-muted mb-1.5 uppercase tracking-widest font-bold max-w-[180px] truncate`}>
        {label}
      </p>
      <p className="font-satoshi text-lg font-black text-brand-gold tabular-nums">
        {payload[0]?.value?.toFixed(3)}
        <span className={`${font} text-[10px] text-brand-muted font-medium ms-1`}>{currency}</span>
      </p>
    </div>
  )
}

// ─── Margin badge ─────────────────────────────────────────────────────────────
function MarginBadge({ pct, font }: { pct: number | null; font: string }) {
  if (pct === null) return <span className={`${font} text-xs text-brand-muted`}>—</span>
  const cls =
    pct >= 60
      ? 'border-green-500/30 bg-green-500/10 text-green-400'
      : pct >= 40
        ? 'border-brand-gold/30 bg-brand-gold/10 text-brand-gold'
        : 'border-brand-error/30 bg-brand-error/10 text-brand-error'
  return (
    <span className={`inline-block rounded-md border px-2 py-0.5 ${font} text-xs font-bold tabular-nums shadow-sm ${cls}`}>
      {pct.toFixed(1)}%
    </span>
  )
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────
function COGSBarChart({ dishes, title, currency, locale }: { dishes: DishCogsRow[]; title: string; currency: string; locale: string }) {
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  
  const top20 = [...dishes]
    .sort((a, b) => Number(b.cost_bhd) - Number(a.cost_bhd))
    .slice(0, 20)
    .map((d) => ({
      name: isAr ? d.name_ar : (d.name_en || d.name_ar),
      value: Number(d.cost_bhd),
      margin: d.margin_pct ?? 0,
    }))

  const getColor = (margin: number) => {
    if (margin >= 60) return '#22c55e'
    if (margin >= 40) return colors.gold
    return '#ef4444'
  }

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-5 shadow-sm space-y-6">
      <h3 className={`${isAr ? 'font-cairo' : 'font-satoshi'} text-sm font-black text-brand-text`}>{title}</h3>
      <div className="h-[420px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={top20} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.surface2} horizontal={false} />
            <XAxis 
              type="number" 
              tick={{ fill: colors.muted, fontSize: 10, fontWeight: 700 }} 
              tickFormatter={(v: number) => `${v.toFixed(3)}`}
              axisLine={false}
              tickLine={false}
              dy={10}
            />
            <YAxis 
              type="category" 
              dataKey="name" 
              tick={{ fill: colors.muted, fontSize: 10, fontWeight: 700 }} 
              width={140}
              axisLine={false}
              tickLine={false}
              dx={isAr ? 10 : -10}
            />
            <Tooltip content={<CustomTooltip currency={currency} locale={locale} />} cursor={{ fill: colors.surface2, opacity: 0.4 }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
              {top20.map((entry, index) => (
                <Cell key={index} fill={getColor(entry.margin)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Main client component ────────────────────────────────────────────────────
export default function COGSClient({ dishes, locale }: { dishes: DishCogsRow[]; locale: string }) {
  const t = useTranslations('inventory.reports.cogs')
  const tCommon = useTranslations('common')
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  const currency = tCommon('currency')

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
    name: isAr ? d.name_ar : (d.name_en || d.name_ar),
    selling_price: Number(d.selling_price ?? 0).toFixed(3),
    cost_bhd: Number(d.cost_bhd).toFixed(3),
    profit_bhd: Number(d.profit_bhd ?? 0).toFixed(3),
    margin_pct: d.margin_pct?.toFixed(1) ?? '',
  }))
  const exportColumns = [
    { key: 'name', header: t('dish') },
    { key: 'selling_price', header: `${t('price')} ${currency}` },
    { key: 'cost_bhd', header: `${t('cost')} ${currency}` },
    { key: 'profit_bhd', header: `${t('profit')} ${currency}` },
    { key: 'margin_pct', header: `${t('avgMargin')} %` },
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('avgMargin')} value={`${avgMargin.toFixed(1)}%`} highlight />
        <StatCard label={t('totalCogs')} value={totalCogs.toFixed(3)} sub={currency} />
        <StatCard
          label={t('bestDish')}
          value={isAr ? (best?.name_ar ?? '—') : (best?.name_en || best?.name_ar || '—')}
          sub={`${(best?.margin_pct ?? 0).toFixed(1)}%`}
          trend="up"
        />
        <StatCard
          label={t('worstDish')}
          value={isAr ? (worst?.name_ar ?? '—') : (worst?.name_en || worst?.name_ar || '—')}
          sub={`${(worst?.margin_pct ?? 0).toFixed(1)}%`}
          trend="down"
        />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-brand-border bg-brand-surface p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className={`${font} text-[10px] text-brand-muted uppercase tracking-widest font-bold`}>{t('margin')}</span>
          <div className="flex bg-brand-surface-2 rounded-lg p-1 border border-brand-border">
            {[
              { v: 'all', l: t('all') },
              { v: 'lt20', l: '<20%' },
              { v: '20-40', l: '20–40%' },
              { v: 'gt40', l: '>40%' },
            ].map((f) => (
              <button
                key={f.v}
                type="button"
                onClick={() => setMarginFilter(f.v)}
                className={`rounded-md px-4 py-1.5 ${font} text-xs font-black transition-all ${marginFilter === f.v ? 'bg-brand-gold text-brand-black shadow-md' : 'text-brand-muted hover:text-brand-gold'}`}
              >
                {f.l}
              </button>
            ))}
          </div>
        </div>
        <div className="ms-auto">
          <ExportButton rows={exportRows} columns={exportColumns} filename={t('exportFilename')} exportAction={exportToExcel} />
        </div>
      </div>

      {/* Chart */}
      <COGSBarChart dishes={dishes} title={t('topDishesChart')} currency={currency} locale={locale} />

      {/* Table */}
      <div className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-start">
            <thead className="bg-brand-surface-2 border-b border-brand-border">
              <tr>
                <th className={`px-5 py-3 text-start ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('dish')}</th>
                <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('price')} {currency}</th>
                <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('cost')} {currency}</th>
                <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('profit')} {currency}</th>
                <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('avgMargin')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/30">
              {filtered.map((dish, i) => (
                <tr key={dish.slug ?? i} className="hover:bg-brand-surface-2 transition-colors group">
                  <td className={`px-5 py-3 ${font} text-sm font-medium text-brand-text group-hover:text-brand-gold transition-colors`}>
                    {isAr ? dish.name_ar : (dish.name_en || dish.name_ar)}
                  </td>
                  <td className="px-5 py-3 text-end font-satoshi text-sm font-bold text-brand-text tabular-nums">{Number(dish.selling_price ?? 0).toFixed(3)}</td>
                  <td className="px-5 py-3 text-end font-satoshi text-sm font-bold text-brand-muted tabular-nums">{Number(dish.cost_bhd).toFixed(3)}</td>
                  <td className="px-5 py-3 text-end font-satoshi text-sm font-black text-brand-success tabular-nums">{Number(dish.profit_bhd ?? 0).toFixed(3)}</td>
                  <td className="px-5 py-3 text-end"><MarginBadge pct={dish.margin_pct ?? null} font={font} /></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className={`px-5 py-12 text-center ${font} text-sm text-brand-muted italic`}>{t('noResults')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


