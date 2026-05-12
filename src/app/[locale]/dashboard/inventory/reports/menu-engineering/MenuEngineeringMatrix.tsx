'use client'

import { useMemo, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
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

function MatrixTooltip({ point, locale }: { point: ScatterPoint; locale: string }) {
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  
  return (
    <div className="rounded-xl border px-4 py-3 shadow-xl backdrop-blur-md bg-brand-surface/90" style={{ borderColor: colors.border }}>
      <p className={`${font} text-sm font-black text-brand-text mb-2`}>{point.name}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className={`${font} text-[10px] font-bold text-brand-muted uppercase`}>{isAr ? 'المباع' : 'Sold'}</span>
          <span className="font-satoshi text-xs font-black text-brand-gold tabular-nums">{point.x}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className={`${font} text-[10px] font-bold text-brand-muted uppercase`}>{isAr ? 'الربح' : 'Profit'}</span>
          <span className="font-satoshi text-xs font-black text-brand-gold tabular-nums">{point.y.toFixed(3)}</span>
        </div>
        {point.margin !== null && (
          <div className="flex items-center justify-between gap-4 pt-1 border-t border-brand-border/30">
            <span className={`${font} text-[10px] font-bold text-brand-muted uppercase`}>{isAr ? 'الهامش' : 'Margin'}</span>
            <span className="font-satoshi text-xs font-black text-brand-success tabular-nums">{point.margin.toFixed(1)}%</span>
          </div>
        )}
      </div>
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

export default function MenuEngineeringMatrix({ rows }: { rows: MenuEngineeringRow[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const locale = useLocale()
  const t = useTranslations('inventory.reports.menuEngineering')
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  const avgSold = rows.length ? rows.reduce((s, r) => s + r.total_sold, 0) / rows.length : 0
  const avgProfit = rows.length ? rows.reduce((s, r) => s + r.profit_bhd, 0) / rows.length : 0
  const maxSold = Math.max(...rows.map((row) => row.total_sold), avgSold, 1)
  const maxProfit = Math.max(...rows.map((row) => row.profit_bhd), avgProfit, 1)
  const maxRevenue = Math.max(...rows.map((row) => row.revenue_bhd), 1)

  const scatterData: ScatterPoint[] = rows.map((r) => ({
    x: r.total_sold,
    y: r.profit_bhd,
    z: Math.max(r.revenue_bhd, 1),
    name: isAr ? r.name_ar : (r.name_en ?? r.name_ar),
    margin: r.margin_pct,
    slug: r.menu_item_slug,
  }))

  const quadrants = ['Stars', 'Puzzles', 'Plowhorses', 'Dogs']
  const grouped = Object.fromEntries(
    quadrants.map((q) => [q, rows.filter((r) => getQuadrant(r, avgSold, avgProfit) === q)]),
  )
  const scaledPoints = useMemo(() => {
    const margin = { top: 20, right: 20, bottom: 34, left: 42 }
    const width = 400
    const height = 400
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom
    return scatterData.map((point) => ({
      point,
      x: margin.left + (point.x / maxSold) * innerWidth,
      y: margin.top + innerHeight - (point.y / maxProfit) * innerHeight,
      r: 5 + (point.z / maxRevenue) * 12,
    }))
  }, [maxProfit, maxRevenue, maxSold, scatterData])
  const activePoint = activeIndex === null ? null : scaledPoints[activeIndex] ?? null

  if (!rows.length) return null

  const QUADRANT_CONFIG: Record<string, { label: string; desc: string; color: string }> = {
    Stars:      { label: t('matrix.stars'),      desc: t('matrix.starsDesc'),      color: colors.gold },
    Puzzles:    { label: t('matrix.puzzles'),    desc: t('matrix.puzzlesDesc'),    color: colors.success },
    Plowhorses: { label: t('matrix.plowhorses'), desc: t('matrix.plowhorsesDesc'), color: colors.muted },
    Dogs:       { label: t('matrix.dogs'),       desc: t('matrix.dogsDesc'),       color: colors.error },
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Scatter chart */}
      <div className="rounded-xl border border-brand-border bg-brand-surface p-6 shadow-sm hover:shadow-md transition-all">
        <div className="mb-6">
          <h3 className={`${font} text-sm font-black text-brand-text uppercase tracking-wider`}>{t('matrixTitle')}</h3>
          <p className={`${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest mt-1`}>
            {isAr ? 'X = الوحدات المباعة · Y = الربح د.ب · الحجم = الإيراد' : 'X = Units Sold · Y = Profit BHD · Size = Revenue'}
          </p>
        </div>
        
        <div className="h-[400px] w-full">
          <div className="relative h-full w-full" onMouseLeave={() => setActiveIndex(null)}>
            <svg width="100%" height="100%" viewBox="0 0 400 400" role="img" aria-hidden="true">
              {[0.25, 0.5, 0.75].map((ratio) => (
                <g key={ratio}>
                  <line x1="42" x2="380" y1={20 + 346 * ratio} y2={20 + 346 * ratio} stroke={colors.border} strokeDasharray="3 3" opacity="0.35" />
                  <line x1={42 + 338 * ratio} x2={42 + 338 * ratio} y1="20" y2="366" stroke={colors.border} strokeDasharray="3 3" opacity="0.35" />
                </g>
              ))}
              <line x1="42" x2="380" y1="366" y2="366" stroke={colors.border} opacity="0.6" />
              <line x1="42" x2="42" y1="20" y2="366" stroke={colors.border} opacity="0.6" />
              <line x1={42 + (avgSold / maxSold) * 338} x2={42 + (avgSold / maxSold) * 338} y1="20" y2="366" stroke={colors.border} strokeDasharray="6 6" strokeWidth="2" />
              <line x1="42" x2="380" y1={20 + 346 - (avgProfit / maxProfit) * 346} y2={20 + 346 - (avgProfit / maxProfit) * 346} stroke={colors.border} strokeDasharray="6 6" strokeWidth="2" />
              {[0, 0.5, 1].map((ratio) => (
                <g key={ratio}>
                  <text x="34" y={366 - ratio * 346 + 4} textAnchor="end" fill={colors.muted} fontSize="10" fontWeight="700">
                    {(maxProfit * ratio).toFixed(0)}
                  </text>
                  <text x={42 + ratio * 338} y="386" textAnchor="middle" fill={colors.muted} fontSize="10" fontWeight="700">
                    {(maxSold * ratio).toFixed(0)}
                  </text>
                </g>
              ))}
              {scaledPoints.map((item, index) => (
                <circle
                  key={item.point.slug}
                  cx={item.x}
                  cy={item.y}
                  r={item.r}
                  fill={colors.gold}
                  fillOpacity={activeIndex === index ? 0.9 : 0.6}
                  stroke={colors.gold}
                  strokeWidth="2"
                  onMouseEnter={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  tabIndex={-1}
                />
              ))}
            </svg>
            {activePoint && (
              <div
                className="pointer-events-none absolute"
                style={{
                  left: `${(activePoint.x / 400) * 100}%`,
                  top: `${(activePoint.y / 400) * 100}%`,
                  transform: 'translate(-50%, -100%)',
                }}
              >
                <MatrixTooltip point={activePoint.point} locale={locale} />
              </div>
            )}
          </div>
        </div>

        {/* Quadrant legend */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
          {quadrants.map((q) => (
            <div key={q} className="flex flex-col gap-1 rounded-xl border border-brand-border bg-brand-surface-2 p-3 shadow-sm hover:shadow-md transition-all border-s-4" style={{ borderColor: QUADRANT_CONFIG[q].color }}>
              <span className={`${font} text-[10px] font-black text-brand-text uppercase tracking-widest`}>{QUADRANT_CONFIG[q].label}</span>
              <span className="font-satoshi text-[14px] font-black text-brand-gold tabular-nums">
                {grouped[q]?.length ?? 0} <span className="text-[10px] font-bold text-brand-muted uppercase">{t('items')}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Categorized tables */}
      <div className="space-y-6">
        {quadrants.map((q) => {
          const items = grouped[q] ?? []
          if (!items.length) return null
          const config = QUADRANT_CONFIG[q]
          
          return (
            <div key={q} className="rounded-xl border border-brand-border bg-brand-surface overflow-hidden shadow-sm hover:shadow-md transition-all">
              <div className="flex flex-wrap items-center gap-4 px-5 py-4 border-b border-brand-border bg-brand-surface-2/50">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shadow-sm" style={{ background: config.color }} />
                  <h3 className={`${font} text-sm font-black text-brand-text uppercase tracking-wider`}>
                    {config.label} <span className="opacity-40 px-2">|</span> {items.length} {t('items')}
                  </h3>
                </div>
                <p className={`${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest ms-auto opacity-80`}>
                  {config.desc}
                </p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-start">
                  <thead>
                    <tr className="bg-brand-surface-2">
                      <th className={`px-5 py-3 text-start ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('item')}</th>
                      <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('sold')}</th>
                      <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{isAr ? 'الإيراد' : 'Revenue'}</th>
                      <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('profit')}</th>
                      <th className={`px-5 py-3 text-end ${font} text-[10px] font-bold text-brand-muted uppercase tracking-widest`}>{t('margin')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border/30">
                    {items.map((r) => {
                      const itemName = isAr ? r.name_ar : (r.name_en ?? r.name_ar)
                      return (
                        <tr key={r.menu_item_slug} className="hover:bg-brand-surface-2 transition-colors group">
                          <td className={`px-5 py-3 ${font} text-sm font-bold text-brand-text group-hover:text-brand-gold transition-colors`}>
                            {itemName}
                          </td>
                          <td className="px-5 py-3 text-end font-satoshi text-sm font-bold text-brand-muted tabular-nums">
                            {r.total_sold}
                          </td>
                          <td className="px-5 py-3 text-end font-satoshi text-sm font-bold text-brand-muted tabular-nums">
                            {r.revenue_bhd.toFixed(3)}
                          </td>
                          <td className="px-5 py-3 text-end font-satoshi text-sm font-black text-brand-gold tabular-nums">
                            {r.profit_bhd.toFixed(3)}
                          </td>
                          <td className="px-5 py-3 text-end font-satoshi text-sm font-black text-brand-success tabular-nums">
                            {r.margin_pct?.toFixed(1) ?? '—'}%
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
