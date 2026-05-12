'use client'

import { memo, useMemo, useState } from 'react'
import { colors } from '@/lib/design-tokens'

export interface LineSeries {
  key: string
  label: string
  color: string
  values: Array<{ label: string; value: number }>
}

interface LightweightLineChartProps {
  series: LineSeries[]
  locale: string
  height: number
  valueSuffix?: string
  target?: { value: number; label: string; color: string }
  currency?: string
  dateLabels?: boolean
}

const WIDTH = 400

function buildPath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
}

function LightweightLineChart({
  series,
  locale,
  height,
  valueSuffix = '',
  target,
  currency,
  dateLabels = false,
}: LightweightLineChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const isAr = locale === 'ar'
  const fontFamily = isAr ? 'Almarai' : 'Satoshi'
  const allLabels = series[0]?.values.map((point) => point.label) ?? []
  const allValues = series.flatMap((item) => item.values.map((point) => point.value))
  const maxValue = Math.max(...allValues, target?.value ?? 0, 1)
  const margin = { top: 18, right: 12, bottom: 28, left: 40 }
  const innerWidth = WIDTH - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom

  const scaled = useMemo(() => series.map((item) => ({
    ...item,
    points: item.values.map((point, index) => ({
      ...point,
      x: margin.left + (index / Math.max(item.values.length - 1, 1)) * innerWidth,
      y: margin.top + innerHeight - (point.value / maxValue) * innerHeight,
    })),
  })), [innerHeight, innerWidth, margin.left, margin.top, maxValue, series])

  const activeRows = activeIndex === null
    ? []
    : scaled.map((item) => ({ label: item.label, color: item.color, point: item.points[activeIndex] })).filter((item) => item.point)

  function formatLabel(label: string) {
    if (!dateLabels) return label
    return new Date(label).toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB', { day: 'numeric', month: 'short' })
  }

  return (
    <div
      className="relative w-full"
      style={{ height }}
      onMouseLeave={() => setActiveIndex(null)}
      onMouseMove={(event) => {
        if (allLabels.length === 0) return
        const rect = event.currentTarget.getBoundingClientRect()
        const x = ((event.clientX - rect.left) / rect.width) * WIDTH
        let nearest = 0
        let distance = Number.POSITIVE_INFINITY
        const basePoints = scaled[0]?.points ?? []
        basePoints.forEach((point, index) => {
          const nextDistance = Math.abs(point.x - x)
          if (nextDistance < distance) {
            nearest = index
            distance = nextDistance
          }
        })
        setActiveIndex(nearest)
      }}
    >
      <svg width="100%" height={height} viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-hidden="true">
        {[0, 0.5, 1].map((ratio) => {
          const y = margin.top + innerHeight - ratio * innerHeight
          return (
            <g key={ratio}>
              <line x1={margin.left} x2={WIDTH - margin.right} y1={y} y2={y} stroke={colors.surface2} strokeDasharray="3 3" />
              <text x={margin.left - 8} y={y + 4} textAnchor="end" fill={colors.muted} fontSize="10" fontWeight="700" fontFamily={fontFamily}>
                {(maxValue * ratio).toFixed(0)}{valueSuffix}
              </text>
            </g>
          )
        })}
        {target && (
          <>
            <line
              x1={margin.left}
              x2={WIDTH - margin.right}
              y1={margin.top + innerHeight - (target.value / maxValue) * innerHeight}
              y2={margin.top + innerHeight - (target.value / maxValue) * innerHeight}
              stroke={target.color}
              strokeDasharray="5 5"
              strokeWidth="1.5"
            />
            <text
              x={WIDTH - margin.right - 2}
              y={margin.top + innerHeight - (target.value / maxValue) * innerHeight - 6}
              textAnchor="end"
              fill={target.color}
              fontSize="10"
              fontWeight="900"
              fontFamily={fontFamily}
            >
              {target.label}
            </text>
          </>
        )}
        {allLabels.map((label, index) => {
          const shouldShow = allLabels.length <= 8 || index === 0 || index === allLabels.length - 1 || index % Math.ceil(allLabels.length / 5) === 0
          if (!shouldShow) return null
          const x = margin.left + (index / Math.max(allLabels.length - 1, 1)) * innerWidth
          return (
            <text key={`${label}-${index}`} x={x} y={height - 8} textAnchor="middle" fill={colors.muted} fontSize="10" fontWeight="700" fontFamily={fontFamily}>
              {formatLabel(label)}
            </text>
          )
        })}
        {scaled.map((item) => (
          <g key={item.key}>
            <path d={buildPath(item.points)} fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {activeIndex !== null && item.points[activeIndex] && (
              <circle cx={item.points[activeIndex].x} cy={item.points[activeIndex].y} r="5" fill={item.color} stroke={colors.surface} strokeWidth="2" />
            )}
          </g>
        ))}
      </svg>
      {activeRows.length > 0 && (
        <div
          className="pointer-events-none absolute rounded-xl border px-4 py-3 shadow-xl backdrop-blur-md bg-brand-surface/90"
          style={{
            borderColor: colors.border,
            left: `${(activeRows[0]!.point!.x / WIDTH) * 100}%`,
            top: Math.min(...activeRows.map((row) => row.point!.y)),
            transform: 'translate(-50%, -100%)',
          }}
        >
          <p className={`${isAr ? 'font-almarai' : 'font-satoshi'} text-[10px] text-brand-muted mb-2 uppercase tracking-widest font-bold`}>
            {formatLabel(activeRows[0]!.point!.label)}
          </p>
          <div className="space-y-1.5">
            {activeRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4">
                <span className={`${isAr ? 'font-almarai' : 'font-satoshi'} text-xs font-bold text-brand-muted truncate max-w-[120px]`}>{row.label}</span>
                <span className="font-satoshi text-sm font-black tabular-nums" style={{ color: row.color }}>
                  {row.point!.value.toFixed(currency ? 3 : 1)}
                  <span className="text-[10px] ms-1 opacity-70 font-medium">{currency ?? valueSuffix}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(LightweightLineChart)
