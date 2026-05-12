'use client'

import { memo, useMemo, useState } from 'react'
import { colors } from '@/lib/design-tokens'

interface ChartPoint {
  label: string
  value: number
}

interface LightweightAreaChartProps {
  points: ChartPoint[]
  currency: string
  height: number
  gradientId: string
  showAxes?: boolean
  xTickFormatter?: (label: string, index: number) => string
}

const WIDTH = 400

function buildPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return ''
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
}

function LightweightAreaChart({
  points,
  currency,
  height,
  gradientId,
  showAxes = false,
  xTickFormatter,
}: LightweightAreaChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const maxValue = Math.max(...points.map((point) => point.value), 0)
  const chartHeight = showAxes ? height - 30 : height
  const margin = showAxes ? { top: 8, right: 8, bottom: 22, left: 32 } : { top: 4, right: 4, bottom: 4, left: 4 }
  const innerWidth = WIDTH - margin.left - margin.right
  const innerHeight = chartHeight - margin.top - margin.bottom

  const scaled = useMemo(() => {
    if (points.length === 0) return []
    const divisor = Math.max(points.length - 1, 1)
    return points.map((point, index) => {
      const x = margin.left + (index / divisor) * innerWidth
      const y = margin.top + innerHeight - (maxValue > 0 ? (point.value / maxValue) * innerHeight : 0)
      return { ...point, x, y }
    })
  }, [innerHeight, innerWidth, margin.left, margin.top, maxValue, points])

  const linePath = buildPath(scaled)
  const areaPath = scaled.length
    ? `${linePath} L ${scaled[scaled.length - 1]!.x} ${margin.top + innerHeight} L ${scaled[0]!.x} ${margin.top + innerHeight} Z`
    : ''
  const activePoint = activeIndex === null ? null : scaled[activeIndex] ?? null
  const yTicks = showAxes ? [0, 0.5, 1].map((ratio) => ({
    value: maxValue * ratio,
    y: margin.top + innerHeight - ratio * innerHeight,
  })) : []

  return (
    <div
      className="relative w-full"
      style={{ height }}
      onMouseLeave={() => setActiveIndex(null)}
      onMouseMove={(event) => {
        if (scaled.length === 0) return
        const rect = event.currentTarget.getBoundingClientRect()
        const x = ((event.clientX - rect.left) / rect.width) * WIDTH
        let nearest = 0
        let distance = Number.POSITIVE_INFINITY
        scaled.forEach((point, index) => {
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
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.gold} stopOpacity={showAxes ? 0.35 : 0.3} />
            <stop offset="100%" stopColor={colors.gold} stopOpacity={0} />
          </linearGradient>
        </defs>

        {showAxes && yTicks.map((tick) => (
          <g key={tick.y}>
            <line
              x1={margin.left}
              x2={WIDTH - margin.right}
              y1={tick.y}
              y2={tick.y}
              stroke={colors.surface2}
              strokeDasharray="3 3"
            />
            <text
              x={margin.left - 8}
              y={tick.y + 4}
              textAnchor="end"
              fill={colors.muted}
              fontFamily="Satoshi"
              fontSize="11"
            >
              {tick.value > 0 ? tick.value.toFixed(0) : ''}
            </text>
          </g>
        ))}

        {showAxes && scaled.map((point, index) => {
          const label = xTickFormatter ? xTickFormatter(point.label, index) : point.label
          if (!label) return null
          return (
            <text
              key={`${point.label}-${index}`}
              x={point.x}
              y={height - 8}
              textAnchor="middle"
              fill={colors.muted}
              fontFamily="Satoshi"
              fontSize="11"
            >
              {label}
            </text>
          )
        })}

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={linePath} fill="none" stroke={colors.gold} strokeWidth={showAxes ? 2.5 : 2} strokeLinejoin="round" strokeLinecap="round" />
        {activePoint && (
          <circle cx={activePoint.x} cy={activePoint.y} r={showAxes ? 4 : 3} fill={colors.gold} />
        )}
      </svg>

      {activePoint && (
        <div
          className="pointer-events-none absolute rounded-lg border px-3 py-2 shadow-lg text-start"
          style={{
            background: colors.surface,
            borderColor: colors.goldDark,
            left: `${(activePoint.x / WIDTH) * 100}%`,
            top: activePoint.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <p className="font-satoshi text-xs text-brand-muted mb-1">{activePoint.label}</p>
          <p className="font-satoshi text-sm font-bold text-brand-gold tabular-nums">
            {activePoint.value.toFixed(3)} {currency}
          </p>
        </div>
      )}
    </div>
  )
}

export default memo(LightweightAreaChart)
