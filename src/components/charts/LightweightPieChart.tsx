'use client'

import { memo, useMemo, useState } from 'react'
import { colors } from '@/lib/design-tokens'

interface PiePoint {
  name: string
  value: number
  color: string
}

interface LightweightPieChartProps {
  data: PiePoint[]
  locale: string
  currency?: string
  showPercentLabels?: boolean
}

function describeArc(cx: number, cy: number, inner: number, outer: number, startAngle: number, endAngle: number) {
  const startOuter = polar(cx, cy, outer, endAngle)
  const endOuter = polar(cx, cy, outer, startAngle)
  const startInner = polar(cx, cy, inner, startAngle)
  const endInner = polar(cx, cy, inner, endAngle)
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outer} ${outer} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${inner} ${inner} 0 ${largeArc} 1 ${endInner.x} ${endInner.y}`,
    'Z',
  ].join(' ')
}

function polar(cx: number, cy: number, radius: number, angle: number) {
  const radians = (angle - 90) * Math.PI / 180
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  }
}

function LightweightPieChart({ data, locale, currency = 'BD', showPercentLabels = false }: LightweightPieChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  const total = data.reduce((sum, point) => sum + point.value, 0)
  const activePoint = activeIndex === null ? null : data[activeIndex] ?? null
  const slices = useMemo(() => {
    let angle = 0
    return data.map((point) => {
      const span = total > 0 ? (point.value / total) * 360 : 0
      const start = angle + 2.5
      const end = angle + span - 2.5
      angle += span
      return { ...point, start, end, mid: start + (end - start) / 2, percent: total > 0 ? point.value / total : 0 }
    })
  }, [data, total])

  return (
    <div className="relative h-full w-full" onMouseLeave={() => setActiveIndex(null)}>
      <svg width="100%" height="100%" viewBox="0 0 300 300" role="img" aria-hidden="true">
        {slices.map((slice, index) => {
          const labelPoint = polar(150, 135, 86, slice.mid)
          return (
            <g key={slice.name}>
              <path
                d={describeArc(150, 135, 60, 100, slice.start, slice.end)}
                fill={slice.color}
                opacity={activeIndex === index ? 1 : 0.8}
                className="transition-opacity cursor-pointer"
                onMouseEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                tabIndex={-1}
              />
              {showPercentLabels && slice.percent > 0.05 && (
                <text x={labelPoint.x} y={labelPoint.y} textAnchor="middle" fill={colors.surface} fontFamily="Satoshi" fontSize="11" fontWeight="700">
                  {(slice.percent * 100).toFixed(0)}%
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {activePoint && (
        <div
          className="pointer-events-none absolute rounded-xl border px-4 py-3 shadow-xl backdrop-blur-md bg-brand-surface/90"
          style={{ borderColor: colors.border, left: '50%', top: '40%', transform: 'translate(-50%, -100%)' }}
        >
          <p className={`${font} text-[10px] text-brand-muted mb-1.5 uppercase tracking-widest font-bold`}>
            {activePoint.name}
          </p>
          <p className="font-satoshi text-lg font-black text-brand-gold tabular-nums">
            {activePoint.value.toFixed(3)}
            <span className={`${font} text-[10px] text-brand-muted font-medium ms-1`}>{currency}</span>
          </p>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {data.map((point) => (
          <span key={point.name} className={`${font} inline-flex items-center gap-2 text-xs font-bold text-brand-muted uppercase tracking-widest`}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: point.color }} />
            {point.name}
          </span>
        ))}
      </div>
    </div>
  )
}

export default memo(LightweightPieChart)
