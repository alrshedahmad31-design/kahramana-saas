'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { colors } from '@/lib/design-tokens'
import type { BudgetVsActual } from '@/lib/supabase/custom-types'

interface Props {
  rows:  BudgetVsActual[]
  locale: string
}

export default function BudgetTrendChart({ rows, locale }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const t = useTranslations('inventory.reports.budget')
  const isAr = locale === 'ar'

  const data = rows.map((r) => ({
    month:      t(`months.${r.month}`).substring(0, 3),
    budget:     Number(r.purchase_budget_bhd),
    actual:     Number(r.actual_spend_bhd),
    waste:      Number(r.actual_waste_bhd),
    wasteBudget:Number(r.waste_budget_bhd),
  }))
  const width = 400
  const height = 220
  const margin = { top: 30, right: 8, bottom: 20, left: 40 }
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom
  const maxValue = Math.max(...data.flatMap((point) => [point.budget, point.actual]), 1)
  const points = useMemo(() => data.map((point, index) => {
    const x = margin.left + (index / Math.max(data.length - 1, 1)) * innerWidth
    return {
      ...point,
      x,
      budgetY: margin.top + innerHeight - (point.budget / maxValue) * innerHeight,
      actualY: margin.top + innerHeight - (point.actual / maxValue) * innerHeight,
    }
  }), [data, innerHeight, innerWidth, margin.left, margin.top, maxValue])
  const activePoint = activeIndex === null ? null : points[activeIndex] ?? null
  const pathFor = (key: 'budgetY' | 'actualY') => points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point[key]}`)
    .join(' ')

  return (
    <div
      className="relative w-full"
      style={{ height }}
      onMouseLeave={() => setActiveIndex(null)}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        const x = ((event.clientX - rect.left) / rect.width) * width
        let nearest = 0
        let distance = Number.POSITIVE_INFINITY
        points.forEach((point, index) => {
          const nextDistance = Math.abs(point.x - x)
          if (nextDistance < distance) {
            nearest = index
            distance = nextDistance
          }
        })
        setActiveIndex(nearest)
      }}
    >
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true">
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
        {[0, 0.5, 1].map((ratio) => {
          const y = margin.top + innerHeight - ratio * innerHeight
          return (
            <g key={ratio}>
              <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} stroke={`${colors.border}33`} strokeDasharray="3 3" />
              <text x={margin.left - 8} y={y + 3} textAnchor="end" fill={colors.muted} fontFamily="Satoshi" fontSize="10">
                {(maxValue * ratio).toFixed(0)}
              </text>
            </g>
          )
        })}
        {points.map((point) => (
          <text key={point.month} x={point.x} y={height - 6} textAnchor="middle" fill={colors.muted} fontFamily={isAr ? 'Almarai' : 'Satoshi'} fontSize="10">
            {point.month}
          </text>
        ))}
        <path d={`${pathFor('budgetY')} L ${points.at(-1)?.x ?? margin.left} ${margin.top + innerHeight} L ${points[0]?.x ?? margin.left} ${margin.top + innerHeight} Z`} fill="url(#bgGrad)" />
        <path d={`${pathFor('actualY')} L ${points.at(-1)?.x ?? margin.left} ${margin.top + innerHeight} L ${points[0]?.x ?? margin.left} ${margin.top + innerHeight} Z`} fill="url(#actGrad)" />
        <path d={pathFor('budgetY')} fill="none" stroke={colors.gold} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d={pathFor('actualY')} fill="none" stroke={colors.error} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {activePoint && (
          <>
            <circle cx={activePoint.x} cy={activePoint.budgetY} r="6" fill={colors.gold} />
            <circle cx={activePoint.x} cy={activePoint.actualY} r="6" fill={colors.error} />
          </>
        )}
      </svg>
      <div
        className="absolute flex items-center gap-3"
        style={{
          top: 0,
          right: isAr ? undefined : 0,
          left: isAr ? 0 : undefined,
          fontFamily: isAr ? 'Almarai' : 'Satoshi',
          fontSize: 10,
          opacity: 0.8,
        }}
      >
        <span className="inline-flex items-center gap-1 text-brand-muted"><span className="h-2 w-2 rounded-full bg-brand-gold" />{t('budget')}</span>
        <span className="inline-flex items-center gap-1 text-brand-muted"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.error }} />{t('actual')}</span>
      </div>
      {activePoint && (
        <div
          className="pointer-events-none absolute rounded-xl border px-4 py-3 shadow-xl"
          style={{
            background: colors.surface2,
            borderColor: colors.border,
            left: `${(activePoint.x / width) * 100}%`,
            top: Math.min(activePoint.budgetY, activePoint.actualY),
            transform: 'translate(-50%, -100%)',
            fontFamily: isAr ? 'Almarai' : 'Satoshi',
            fontSize: 12,
          }}
        >
          <p className="text-brand-text font-bold mb-1">{activePoint.month}</p>
          <p className="text-brand-gold tabular-nums">{t('budget')}: {activePoint.budget.toFixed(3)}</p>
          <p className="text-brand-error tabular-nums">{t('actual')}: {activePoint.actual.toFixed(3)}</p>
        </div>
      )}
    </div>
  )
}
