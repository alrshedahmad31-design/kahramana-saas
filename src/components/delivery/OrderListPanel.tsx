'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence }     from 'framer-motion'
import { Clock, Bike, AlertCircle }    from 'lucide-react'
import { DV, DV_STATUS, STATUS_BORDER, STATUS_LABEL } from '@/lib/delivery/tokens'
import type { DeliveryOrder, Driver }  from '@/lib/delivery/types'

interface Props {
  orders:    DeliveryOrder[]
  drivers:   Driver[]
  onSelect:  (id: string) => void
  onHover:   (id: string | null) => void
  isAr:      boolean
  fullWidth?: boolean
}

function useETACountdown(createdAt: string) {
  const [elapsed, setElapsed] = useState(
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000),
  )
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000))
    }, 30_000)
    return () => clearInterval(id)
  }, [createdAt])
  return elapsed
}

function OrderRow({ order, driver, onSelect, onHover, isAr }: {
  order: DeliveryOrder; driver: Driver | undefined; onSelect: () => void; onHover: (id: string | null) => void; isAr: boolean
}) {
  const elapsedMin = useETACountdown(order.created_at)
  const isLate     = elapsedMin > 45
  const borderColor = STATUS_BORDER[order.status] ?? DV.amber

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, x: isAr ? 12 : -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: isAr ? -12 : 12 }}
      transition={{ duration: 0.2 }}
      onClick={onSelect}
      onMouseEnter={() => onHover(order.id)}
      onMouseLeave={() => onHover(null)}
      style={{
        width:        '100%',
        textAlign:    'start',
        background:   DV.bgCard,
        borderRadius: '10px',
        border:       `1px solid ${isLate ? 'rgba(139,32,32,0.5)' : DV.border}`,
        borderRight:  `3px solid ${isLate ? DV_STATUS.errorBg : borderColor}`,
        padding:      '12px 14px',
        cursor:       'pointer',
        fontFamily:   'IBM Plex Sans Arabic, sans-serif',
        transition:   'border-color 0.2s',
        position:     'relative',
      }}
    >
      {/* Late pulse overlay */}
      {isLate && (
        <motion.div
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          style={{
            position: 'absolute', inset: 0, borderRadius: '10px',
            border: '1px solid rgba(139,32,32,0.6)',
            pointerEvents: 'none',
          }}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: DV.amber }}>
              #{order.order_number}
            </span>
            <StatusPill status={order.status} />
            {isLate && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: DV_STATUS.errorBg }}>
                <AlertCircle size={11} />
                متأخر
              </span>
            )}
          </div>
          <div style={{ fontSize: '13px', color: DV.text, fontWeight: 400, marginBottom: '2px' }}>
            {order.customer_name ?? 'عميل'}
          </div>
          {driver && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: DV.muted }}>
              <Bike size={12} />
              {driver.name}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'end', flexShrink: 0 }}>
          <motion.div
            key={elapsedMin}
            initial={{ scale: 1.15 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.2 }}
            style={{
              display:     'flex',
              alignItems:  'center',
              gap:         '3px',
              fontSize:    '13px',
              fontWeight:  600,
              color:       isLate ? DV_STATUS.errorBg : DV.muted,
              justifyContent: 'flex-end',
            }}
          >
            <Clock size={12} />
            {elapsedMin} د
          </motion.div>
          <div style={{ fontSize: '12px', color: DV.muted, marginTop: '2px' }}>
            {order.items_count} صنف
          </div>
          <div style={{ fontSize: '12px', color: DV.amberLight, fontWeight: 600, marginTop: '2px' }}>
            {Number(order.total_bhd).toFixed(3)}
          </div>
        </div>
      </div>
    </motion.button>
  )
}

function StatusPill({ status }: { status: string }) {
  const color  = STATUS_BORDER[status] ?? DV.amber
  const label  = STATUS_LABEL[status]  ?? status
  return (
    <span style={{
      fontSize:     '10px',
      fontWeight:   600,
      color,
      background:   `${color}18`,
      padding:      '1px 6px',
      borderRadius: '4px',
      border:       `1px solid ${color}40`,
      fontFamily:   'IBM Plex Sans Arabic, sans-serif',
    }}>
      {label}
    </span>
  )
}

export default function OrderListPanel({ orders, drivers, onSelect, onHover, isAr, fullWidth }: Props) {
  const driverMap   = new Map(drivers.map(d => [d.id, d]))
  const nowMs       = Date.now()
  const lateOrders  = orders.filter(o => (nowMs - new Date(o.created_at).getTime()) / 60_000 > 45)
  const otherOrders = orders.filter(o => (nowMs - new Date(o.created_at).getTime()) / 60_000 <= 45)
  const sorted      = [...lateOrders, ...otherOrders]

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      height:        '100%',
      background:    DV.bgSurface,
    }}>
      {/* Panel header */}
      <div style={{
        padding:        '12px 16px',
        borderBottom:   `1px solid ${DV.border}`,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        flexShrink:     0,
      }}>
        <span style={{ fontSize: '14px', fontWeight: 700, color: DV.text }}>
          الطلبات النشطة
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {lateOrders.length > 0 && (
            <span style={{
              fontSize: '12px', fontWeight: 600, color: DV_STATUS.errorBg,
              background: `${DV_STATUS.errorBg}18`, padding: '2px 8px', borderRadius: '6px',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}>
              <AlertCircle size={11} /> {lateOrders.length} متأخر
            </span>
          )}
          <span style={{
            fontSize: '12px', fontWeight: 600, color: DV.amber,
            background: `${DV.amber}18`, padding: '2px 8px', borderRadius: '6px',
          }}>
            {orders.length}
          </span>
        </div>
      </div>

      {/* List — 2-column grid in full-width mode */}
      <div style={{
        flex:          1,
        overflow:      'auto',
        padding:       '10px',
        display:       fullWidth ? 'grid' : 'flex',
        ...(fullWidth
          ? { gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '8px', alignContent: 'start' }
          : { flexDirection: 'column', gap: '6px' }),
      }}>
        <AnimatePresence>
          {sorted.map(order => (
            <OrderRow
              key={order.id}
              order={order}
              driver={order.driver_id ? driverMap.get(order.driver_id) : undefined}
              onSelect={() => onSelect(order.id)}
              onHover={onHover}
              isAr={isAr}
            />
          ))}
        </AnimatePresence>

        {orders.length === 0 && (
          <div style={{
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            padding:        '48px 0',
            gap:            '10px',
            color:          DV.muted,
            gridColumn:     fullWidth ? '1 / -1' : undefined,
          }}>
            <span style={{ fontSize: '32px' }}>📦</span>
            <span style={{ fontSize: '13px' }}>لا توجد طلبات نشطة</span>
          </div>
        )}
      </div>
    </div>
  )
}
