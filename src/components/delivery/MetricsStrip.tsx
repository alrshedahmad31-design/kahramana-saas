'use client'

import { useEffect, useRef } from 'react'
import { DV, DV_STATUS }    from '@/lib/delivery/tokens'
import type { DeliveryMetrics } from '@/lib/delivery/types'

interface Props {
  metrics: DeliveryMetrics
  isAr:    boolean
}

function AnimatedNumber({ value }: { value: number }) {
  const displayRef = useRef<HTMLSpanElement>(null)
  const prev       = useRef(value)

  useEffect(() => {
    const el = displayRef.current
    if (!el) return
    const start = prev.current
    const end   = value
    prev.current = value
    if (start === end) return
    const dur = 600
    const t0  = performance.now()
    function tick(now: number) {
      const p = Math.min((now - t0) / dur, 1)
      const e = 1 - Math.pow(1 - p, 3)
      el!.textContent = String(Math.round(start + (end - start) * e))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value])

  return <span ref={displayRef}>{value}</span>
}

interface Card {
  accent:   string
  pulse?:   boolean
  valueEl:  React.ReactNode
  labelAr:  string
  labelEn:  string
  subEl?:   React.ReactNode
}

export default function MetricsStrip({ metrics, isAr }: Props) {
  const onTimeBad = metrics.on_time_rate < 80 && metrics.completed_today > 0

  const cards: Card[] = [
    {
      accent:  DV_STATUS.successBg,
      labelAr: 'السائقون',
      labelEn: 'Drivers',
      valueEl: (
        <span style={{ fontSize: '26px', fontWeight: 700, color: DV.text, lineHeight: 1.1 }}>
          <AnimatedNumber value={metrics.drivers_available} />
          <span style={{ fontSize: '16px', color: DV.muted, fontWeight: 400 }}>
            /{metrics.drivers_total}
          </span>
        </span>
      ),
      subEl: (
        <span style={{ fontSize: '11px', color: DV_STATUS.successText }}>
          {isAr ? 'متاح' : 'available'}
        </span>
      ),
    },
    {
      accent:  DV.amber,
      labelAr: 'الطلبات النشطة',
      labelEn: 'Active Orders',
      valueEl: (
        <span style={{ fontSize: '26px', fontWeight: 700, color: DV.text, lineHeight: 1.1 }}>
          <AnimatedNumber value={metrics.orders_total} />
        </span>
      ),
    },
    {
      accent:  DV_STATUS.blueBg,
      labelAr: 'قيد التوصيل',
      labelEn: 'Delivering',
      valueEl: (
        <span style={{ fontSize: '26px', fontWeight: 700, color: DV.text, lineHeight: 1.1 }}>
          <AnimatedNumber value={metrics.in_transit} />
        </span>
      ),
    },
    {
      accent:  onTimeBad ? DV_STATUS.errorBg : DV_STATUS.successBg,
      pulse:   onTimeBad && metrics.completed_today > 0,
      labelAr: 'في الوقت',
      labelEn: 'On-Time',
      valueEl: (
        <span style={{
          fontSize: '26px', fontWeight: 700, lineHeight: 1.1,
          color: metrics.completed_today === 0
            ? DV.muted
            : onTimeBad ? DV_STATUS.errorText : DV_STATUS.successText,
        }}>
          {metrics.completed_today === 0
            ? '—'
            : <><AnimatedNumber value={metrics.on_time_rate} />%</>
          }
        </span>
      ),
    },
    {
      accent:  DV_STATUS.successBg,
      labelAr: 'مكتملة اليوم',
      labelEn: 'Done Today',
      valueEl: (
        <span style={{ fontSize: '26px', fontWeight: 700, color: DV.text, lineHeight: 1.1 }}>
          <AnimatedNumber value={metrics.completed_today} />
        </span>
      ),
    },
    {
      accent:  DV_STATUS.errorBg,
      pulse:   metrics.late_count > 0,
      labelAr: 'متأخرة',
      labelEn: 'Late',
      valueEl: (
        <span style={{
          fontSize: '26px', fontWeight: 700, lineHeight: 1.1,
          color: metrics.late_count > 0 ? DV_STATUS.errorText : DV.muted,
        }}>
          <AnimatedNumber value={metrics.late_count} />
        </span>
      ),
    },
  ]

  return (
    <div style={{
      display:             'grid',
      gridTemplateColumns: 'repeat(6, 1fr)',
      gap:                 '1px',
      background:          DV.border,
      borderBottom:        `1px solid ${DV.border}`,
    }}>
      {cards.map((card, i) => (
        <div
          key={i}
          style={{
            background:  DV.bgSurface,
            padding:     '14px 16px',
            borderTop:   `3px solid ${card.accent}`,
            position:    'relative',
            overflow:    'hidden',
          }}
        >
          {card.pulse && (
            <div
              style={{
                position:    'absolute',
                inset:       0,
                background:  `${card.accent}08`,
                pointerEvents: 'none',
                animation:   'pulse 1.2s ease-in-out infinite',
              }}
            />
          )}

          {card.valueEl}

          <div style={{
            fontSize:   '11px',
            color:      DV.muted,
            marginTop:  '4px',
            fontWeight: 500,
            letterSpacing: '0.02em',
          }}>
            {isAr ? card.labelAr : card.labelEn}
          </div>

          {card.subEl && (
            <div style={{ marginTop: '2px' }}>{card.subEl}</div>
          )}
        </div>
      ))}
    </div>
  )
}
