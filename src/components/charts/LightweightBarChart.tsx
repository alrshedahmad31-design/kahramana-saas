'use client'

import { memo, useState } from 'react'
import { colors } from '@/lib/design-tokens'

export interface BarPoint {
  name: string
  value: number
  color: string
}

interface LightweightBarChartProps {
  data: BarPoint[]
  locale: string
  currency: string
  height: number
  layout?: 'horizontal' | 'vertical'
  maxLabelWidth?: number
}

function LightweightBarChart({
  data,
  locale,
  currency,
  height,
  layout = 'horizontal',
  maxLabelWidth = 140,
}: LightweightBarChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const maxAbs = Math.max(...data.map((point) => Math.abs(point.value)), 1)
  const activePoint = activeIndex === null ? null : data[activeIndex] ?? null
  const width = 400

  if (layout === 'vertical') {
    const baseY = height - 34
    const chartHeight = height - 62
    const barWidth = 310 / Math.max(data.length, 1)
    return (
      <div className="relative w-full" style={{ height }} onMouseLeave={() => setActiveIndex(null)}>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true">
          {[0.25, 0.5, 0.75].map((ratio) => (
            <line key={ratio} x1="36" x2="392" y1={baseY - ratio * chartHeight} y2={baseY - ratio * chartHeight} stroke={colors.border} strokeDasharray="3 3" opacity="0.3" />
          ))}
          {data.map((item, index) => {
            const x = 46 + index * barWidth
            const h = (Math.abs(item.value) / maxAbs) * chartHeight
            return (
              <g key={`${item.name}-${index}`} onMouseEnter={() => setActiveIndex(index)} onFocus={() => setActiveIndex(index)} tabIndex={-1}>
                <rect x={x} y={baseY - h} width={Math.max(barWidth - 10, 8)} height={h} rx="4" fill={item.color} opacity={activeIndex === index ? 1 : 0.8} className="transition-opacity cursor-pointer" />
                {data.length <= 5 && (
                  <text x={x + (barWidth - 10) / 2} y={height - 8} textAnchor="middle" fill={colors.muted} fontSize="10" fontWeight="600">
                    {item.name}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
        {activePoint && <Tooltip point={activePoint} locale={locale} currency={currency} top={30} left="50%" />}
      </div>
    )
  }

  const rowHeight = height / Math.max(data.length, 1)
  return (
    <div className="relative w-full" style={{ height }} onMouseLeave={() => setActiveIndex(null)}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true">
        {data.map((item, index) => {
          const y = 8 + index * rowHeight
          const barWidth = (Math.abs(item.value) / maxAbs) * (width - maxLabelWidth - 48)
          return (
            <g key={`${item.name}-${index}`} onMouseEnter={() => setActiveIndex(index)} onFocus={() => setActiveIndex(index)} tabIndex={-1}>
              <text x="0" y={y + 16} fill={colors.muted} fontSize="10" fontWeight="700">
                {item.name.length > 24 ? `${item.name.slice(0, 24)}...` : item.name}
              </text>
              <rect x={maxLabelWidth} y={y + 4} width={width - maxLabelWidth - 48} height="16" rx="4" fill={colors.surface2} opacity="0.35" />
              <rect x={maxLabelWidth} y={y + 4} width={barWidth} height="16" rx="4" fill={item.color} />
              <text x={width - 4} y={y + 17} textAnchor="end" fill={colors.muted} fontSize="10" fontWeight="700">
                {item.value.toFixed(3)}
              </text>
            </g>
          )
        })}
      </svg>
      {activePoint && <Tooltip point={activePoint} locale={locale} currency={currency} top={Math.max(24, activeIndex! * rowHeight)} left="50%" />}
    </div>
  )
}

function Tooltip({ point, locale, currency, top, left }: { point: BarPoint; locale: string; currency: string; top: number; left: string }) {
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  return (
    <div
      className="pointer-events-none absolute rounded-xl border px-4 py-3 shadow-xl backdrop-blur-md bg-brand-surface/90"
      style={{ borderColor: colors.border, left, top, transform: 'translate(-50%, -100%)' }}
    >
      <p className={`${font} text-[10px] text-brand-muted mb-1.5 uppercase tracking-widest font-bold max-w-[200px] truncate`}>
        {point.name}
      </p>
      <p className="font-satoshi text-lg font-black text-brand-gold tabular-nums">
        {point.value.toFixed(3)}
        <span className={`${font} text-[10px] text-brand-muted font-medium ms-1`}>{currency}</span>
      </p>
    </div>
  )
}

export default memo(LightweightBarChart)
