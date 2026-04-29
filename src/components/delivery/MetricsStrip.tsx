'use client'

import { useEffect, useRef } from 'react'
import { motion }            from 'framer-motion'
import { TrendingUp, Package, Truck, CheckCircle, AlertTriangle } from 'lucide-react'
import { DV, DV_STATUS }    from '@/lib/delivery/tokens'
import type { DeliveryMetrics } from '@/lib/delivery/types'

interface Props {
  metrics: DeliveryMetrics
  isAr:    boolean
}

const CARDS = [
  {
    key:      'revenue_today' as keyof DeliveryMetrics,
    label:    'إيرادات اليوم',
    icon:     <TrendingUp size={18} />,
    accent:   DV.amber,
    format:   (v: number) => `${v.toFixed(3)} د.ب`,
    deltaKey: 'revenue_delta' as keyof DeliveryMetrics,
  },
  {
    key:      'orders_total' as keyof DeliveryMetrics,
    label:    'الطلبات الكلية',
    icon:     <Package size={18} />,
    accent:   DV.amberLight,
    format:   (v: number) => String(v),
    deltaKey: 'orders_delta' as keyof DeliveryMetrics,
  },
  {
    key:      'in_transit' as keyof DeliveryMetrics,
    label:    'في الطريق',
    icon:     <Truck size={18} />,
    accent:   DV_STATUS.blueBg,
    format:   (v: number) => String(v),
  },
  {
    key:      'completed_today' as keyof DeliveryMetrics,
    label:    'مكتملة اليوم',
    icon:     <CheckCircle size={18} />,
    accent:   DV_STATUS.successBg,
    format:   (v: number) => String(v),
  },
  {
    key:      'late_count' as keyof DeliveryMetrics,
    label:    'متأخرة',
    icon:     <AlertTriangle size={18} />,
    accent:   DV_STATUS.errorBg,
    format:   (v: number) => String(v),
    pulse:    true,
  },
]

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
    const dur   = 600
    const t0    = performance.now()
    function tick(now: number) {
      const p = Math.min((now - t0) / dur, 1)
      const e = 1 - Math.pow(1 - p, 3) // ease-out cubic
      el!.textContent = String(Math.round(start + (end - start) * e))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [value])

  return <span ref={displayRef}>{value}</span>
}

export default function MetricsStrip({ metrics, isAr: _isAr }: Props) {
  return (
    <div style={{
      display:        'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap:            '1px',
      background:     DV.border,
      borderBottom:   `1px solid ${DV.border}`,
    }}>
      {CARDS.map((card, i) => {
        const raw   = Number(metrics[card.key] ?? 0)
        const delta = card.deltaKey ? Number(metrics[card.deltaKey] ?? 0) : null

        return (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, duration: 0.3 }}
            style={{
              background:    DV.bgSurface,
              padding:       '16px 18px',
              borderTop:     `2px solid ${card.accent}`,
              position:      'relative',
              overflow:      'hidden',
            }}
          >
            {card.pulse && raw > 0 && (
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
                style={{
                  position: 'absolute', inset: 0,
                  background: `${card.accent}08`,
                  pointerEvents: 'none',
                }}
              />
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div style={{ color: card.accent, opacity: 0.9 }}>{card.icon}</div>
              {delta !== null && (
                <span style={{
                  fontSize:     '11px',
                  fontWeight:   600,
                  color:        delta >= 0 ? DV_STATUS.successBg : DV_STATUS.errorBg,
                  background:   delta >= 0 ? `${DV_STATUS.successBg}20` : `${DV_STATUS.errorBg}20`,
                  padding:      '1px 6px',
                  borderRadius: '4px',
                }}>
                  {delta >= 0 ? '↑' : '↓'}{Math.abs(delta)}%
                </span>
              )}
            </div>

            <div style={{ fontSize: '26px', fontWeight: 700, color: DV.text, lineHeight: 1.1 }}>
              {card.key === 'revenue_today'
                ? card.format(raw)
                : <><AnimatedNumber value={raw} /></>}
            </div>
            <div style={{ fontSize: '12px', color: DV.muted, marginTop: '4px', fontWeight: 400 }}>
              {card.label}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
