'use client'

import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { colors } from '@/lib/design-tokens'

interface MenuEngineeringRow {
  menu_item_slug: string
  name_ar: string
  name_en: string
  total_sold: number
  revenue_bhd: number
  cost_bhd: number
  profit_bhd: number
  margin_pct: number | null
  ideal_cost_pct: number | null
  is_above_ideal_cost: boolean
  category: string
}

type ScatterPoint = {
  x: number
  y: number
  z: number
  name: string
  margin: number | null
  slug: string
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: ScatterPoint }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="rounded-lg border px-3 py-2 shadow-lg" style={{ background: colors.surface, borderColor: colors.border }}>
      <p className="font-satoshi text-sm font-semibold text-brand-text">{d?.name}</p>
      <p className="font-satoshi text-xs text-brand-muted mt-1">مبيع: <span className="text-brand-gold tabular-nums">{d?.x}</span></p>
      <p className="font-satoshi text-xs text-brand-muted">ربح: <span className="text-brand-gold tabular-nums">BD {d?.y?.toFixed(3)}</span></p>
      {d?.margin !== null && (
        <p className="font-satoshi text-xs text-brand-muted">هامش: <span className="text-brand-gold tabular-nums">{d?.margin?.toFixed(1)}%</span></p>
      )}
    </div>
  )
}

function getQuadrant(row: MenuEngineeringRow, avgSold: number, avgProfit: number): string {
  const highSold = row.total_sold >= avgSold
  const highProfit = row.profit_bhd >= avgProfit
  if (highSold && highProfit) return 'Stars'
  if (!highSold && highProfit) return 'Puzzles'
  if (highSold && !highProfit) return 'Plowhorses'
  return 'Dogs'
}

const QUADRANT_LABELS: Record<string, { ar: string; color: string }> = {
  Stars:       { ar: 'النجوم',       color: colors.gold },
  Puzzles:     { ar: 'الألغاز',      color: colors.success },
  Plowhorses:  { ar: 'الخيول',       color: colors.muted },
  Dogs:        { ar: 'الكلاب',       color: colors.error },
}

export default function MenuEngineeringMatrix({ rows }: { rows: MenuEngineeringRow[] }) {
  if (!rows.length) return null

  const avgSold = rows.reduce((s, r) => s + r.total_sold, 0) / rows.length
  const avgProfit = rows.reduce((s, r) => s + r.profit_bhd, 0) / rows.length

  const scatterData: ScatterPoint[] = rows.map((r) => ({
    x: r.total_sold,
    y: r.profit_bhd,
    z: Math.max(r.revenue_bhd, 1),
    name: r.name_ar,
    margin: r.margin_pct,
    slug: r.menu_item_slug,
  }))

  // Group by quadrant
  const quadrants = ['Stars', 'Puzzles', 'Plowhorses', 'Dogs']
  const grouped = Object.fromEntries(
    quadrants.map((q) => [q, rows.filter((r) => getQuadrant(r, avgSold, avgProfit) === q)]),
  )

  const recommendations: Record<string, string> = {
    Stars:      'حافظ على الجودة والتوفر — هذه هي القائمة الذهبية',
    Puzzles:    'قلّل التكلفة أو أعد التسعير — الهامش عالٍ لكن الطلب منخفض',
    Plowhorses: 'راجع تسعيرها لتحسين الهامش — مبيعاتها قوية',
    Dogs:       'أزِل هذه الأصناف أو طوِّرها جذرياً',
  }

  return (
    <div className="space-y-6">
      {/* Scatter chart */}
      <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
        <p className="font-cairo text-sm font-black text-brand-text mb-1">مصفوفة هندسة القائمة</p>
        <p className="font-satoshi text-xs text-brand-muted mb-4">X = الوحدات المباعة · Y = الربح BD · الحجم = الإيراد</p>
        <ResponsiveContainer width="100%" height={380}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <XAxis
              type="number"
              dataKey="x"
              name="مباع"
              tick={{ fill: colors.muted, fontSize: 11 }}
              label={{ value: 'الوحدات المباعة', position: 'insideBottom', offset: -10, fill: colors.muted, fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="ربح"
              tick={{ fill: colors.muted, fontSize: 11 }}
              label={{ value: 'الربح BD', angle: -90, position: 'insideLeft', fill: colors.muted, fontSize: 11 }}
            />
            <ZAxis type="number" dataKey="z" range={[40, 300]} />
            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: colors.border }} />
            <ReferenceLine x={avgSold} stroke={colors.muted} strokeDasharray="4 4" />
            <ReferenceLine y={avgProfit} stroke={colors.muted} strokeDasharray="4 4" />
            <Scatter data={scatterData} fill={colors.gold} fillOpacity={0.8} />
          </ScatterChart>
        </ResponsiveContainer>
        {/* Quadrant legend */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
          {quadrants.map((q) => (
            <div key={q} className="flex items-center gap-2 rounded-lg border border-brand-border px-3 py-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: QUADRANT_LABELS[q].color }} />
              <span className="font-satoshi text-xs text-brand-muted">{QUADRANT_LABELS[q].ar} <span className="text-brand-text font-semibold">({grouped[q]?.length ?? 0})</span></span>
            </div>
          ))}
        </div>
      </div>

      {/* Categorized tables */}
      {quadrants.map((q) => {
        const items = grouped[q] ?? []
        if (!items.length) return null
        return (
          <div key={q} className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-brand-border" style={{ borderLeftColor: QUADRANT_LABELS[q].color }}>
              <span className="w-2 h-2 rounded-full" style={{ background: QUADRANT_LABELS[q].color }} />
              <h3 className="font-cairo text-sm font-black text-brand-text">{QUADRANT_LABELS[q].ar} — {q} ({items.length})</h3>
              <p className="font-satoshi text-xs text-brand-muted ms-auto">{recommendations[q]}</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border bg-brand-surface-2">
                  <th className="px-4 py-2 text-start font-satoshi text-xs font-semibold text-brand-muted">الصنف</th>
                  <th className="px-4 py-2 text-end font-satoshi text-xs font-semibold text-brand-muted">مباع</th>
                  <th className="px-4 py-2 text-end font-satoshi text-xs font-semibold text-brand-muted">إيراد BD</th>
                  <th className="px-4 py-2 text-end font-satoshi text-xs font-semibold text-brand-muted">ربح BD</th>
                  <th className="px-4 py-2 text-end font-satoshi text-xs font-semibold text-brand-muted">هامش %</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.menu_item_slug} className="border-b border-brand-border/30 hover:bg-brand-surface-2 transition-colors">
                    <td className="px-4 py-2 font-satoshi text-brand-text">{r.name_ar}</td>
                    <td className="px-4 py-2 text-end font-satoshi tabular-nums text-brand-muted">{r.total_sold}</td>
                    <td className="px-4 py-2 text-end font-satoshi tabular-nums text-brand-muted">{r.revenue_bhd.toFixed(3)}</td>
                    <td className="px-4 py-2 text-end font-satoshi tabular-nums text-brand-gold font-semibold">{r.profit_bhd.toFixed(3)}</td>
                    <td className="px-4 py-2 text-end font-satoshi tabular-nums text-brand-muted">{r.margin_pct?.toFixed(1) ?? '—'}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
