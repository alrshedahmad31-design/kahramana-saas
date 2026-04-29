'use client'

import { Phone, MapPin, PackageCheck } from 'lucide-react'
import { motion }      from 'framer-motion'
import { DV, DRIVER_STATUS } from '@/lib/delivery/tokens'
import type { DeliveryOrder, Driver } from '@/lib/delivery/types'

const STATUS_DOT_CLS: Record<string, string> = {
  available:  'bg-brand-success',
  delivering: 'bg-sky-400',
  busy:       'bg-brand-gold',
  returning:  'bg-pink-400',
  offline:    'bg-brand-muted',
}

const STATUS_BADGE_CLS: Record<string, string> = {
  available:  'bg-brand-success/15 text-brand-success',
  delivering: 'bg-sky-400/20 text-sky-400',
  busy:       'bg-brand-gold/15 text-brand-gold',
  returning:  'bg-pink-400/20 text-pink-400',
  offline:    'bg-brand-surface-2 text-brand-muted',
}

interface Props {
  drivers:  Driver[]
  orders:   DeliveryOrder[]
  onAssign: (order?: DeliveryOrder) => void
  isAr:     boolean
}

function DailyRating({ completed }: { completed: number }) {
  // 0–2 → 1★, 3–5 → 2★, 6–8 → 3★, 9–11 → 4★, 12+ → 5★ (0 = no orders yet)
  const stars = completed === 0 ? 0
    : completed <= 2  ? 1
    : completed <= 5  ? 2
    : completed <= 8  ? 3
    : completed <= 11 ? 4
    : 5

  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      padding:        '6px 8px',
      background:     DV.bgSurface,
      borderRadius:   '6px',
      border:         `1px solid ${DV.border}`,
    }}>
      <span style={{ fontSize: '10px', color: DV.muted }}>تقييم اليوم</span>
      <span style={{ fontSize: '13px', letterSpacing: '1px', lineHeight: 1 }}>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} style={{ color: i < stars ? DV.amber : `${DV.amber}30` }}>★</span>
        ))}
      </span>
    </div>
  )
}

function DriverCard({ driver, currentOrder, onAssign, isAr: _isAr, index }: {
  driver: Driver; currentOrder: DeliveryOrder | undefined; onAssign: () => void; isAr: boolean; index: number
}) {
  const statusCfg  = DRIVER_STATUS[driver.status] ?? DRIVER_STATUS.offline
  const initials   = driver.name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.25 }}
      style={{
        flexShrink:     0,
        width:          '200px',
        background:     DV.bgCard,
        border:         `1px solid ${DV.border}`,
        borderRadius:   '10px',
        padding:        '14px',
        display:        'flex',
        flexDirection:  'column',
        gap:            '10px',
        fontFamily:     'IBM Plex Sans Arabic, sans-serif',
      }}
    >
      {/* Avatar + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width:          '40px',
            height:         '40px',
            borderRadius:   '50%',
            background:     `${DV.amber}20`,
            border:         `1px solid ${DV.border}`,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontSize:       '15px',
            fontWeight:     700,
            color:          DV.amber,
          }}>
            {driver.avatar_url
              ? <img src={driver.avatar_url} alt={driver.name ?? 'driver'} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              : initials
            }
          </div>
          {/* Status dot */}
          <span
            className={`absolute bottom-[-1px] end-[-1px] w-[11px] h-[11px] rounded-full ${STATUS_DOT_CLS[driver.status] ?? 'bg-brand-muted'}`}
            style={{ border: `2px solid ${DV.bgCard}` }}
          />
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: DV.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {driver.name}
          </div>
          <span
            className={`inline-block text-[11px] font-semibold px-[6px] py-[1px] rounded mt-[2px] ${STATUS_BADGE_CLS[driver.status] ?? 'bg-brand-surface-2 text-brand-muted'}`}
          >
            {statusCfg.label}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: DV.text }}>{driver.completed_today}</div>
          <div style={{ fontSize: '10px', color: DV.muted }}>مكتملة</div>
        </div>
        {driver.phone && (
          <a
            href={`tel:${driver.phone}`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '32px', height: '32px',
              background: `${DV.amber}15`,
              border: `1px solid ${DV.border}`,
              borderRadius: '8px', color: DV.amber,
              textDecoration: 'none',
            }}
          >
            <Phone size={14} />
          </a>
        )}
        {driver.location && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '32px', height: '32px',
            background: `${DV.amber}15`, border: `1px solid ${DV.border}`,
            borderRadius: '8px', color: DV.amber,
          }}>
            <MapPin size={14} />
          </div>
        )}
      </div>

      {/* Daily rating */}
      <DailyRating completed={driver.completed_today} />

      {/* Current order */}
      {currentOrder && (
        <div style={{
          padding:      '7px 10px',
          background:   DV.bgSurface,
          borderRadius: '7px',
          border:       `1px solid ${DV.border}`,
          fontSize:     '12px',
          color:        DV.muted,
          display:      'flex',
          alignItems:   'center',
          gap:          '5px',
        }}>
          <PackageCheck size={12} color={DV.amber} />
          <span style={{ color: DV.text }}>#{currentOrder.order_number}</span>
          <span style={{ marginInlineStart: 'auto' }}>{currentOrder.customer_name?.split(' ')[0] ?? '—'}</span>
        </div>
      )}

      {/* Action */}
      <button
        type="button"
        onClick={onAssign}
        style={{
          padding:      '7px',
          background:   driver.status === 'available' ? DV.amber : `${DV.amber}18`,
          color:        driver.status === 'available' ? DV.bgPage : DV.amber,
          border:       `1px solid ${DV.amber}40`,
          borderRadius: '7px',
          fontSize:     '12px',
          fontWeight:   600,
          cursor:       'pointer',
          fontFamily:   'IBM Plex Sans Arabic, sans-serif',
          transition:   'all 0.15s',
        }}
      >
        {driver.status === 'available' ? 'تعيين طلب' : 'عرض مسار'}
      </button>
    </motion.div>
  )
}

export default function DriverFleetPanel({ drivers, orders, onAssign, isAr }: Props) {
  const orderMap = new Map(orders.map(o => [o.id, o]))

  return (
    <div style={{
      borderTop:  `1px solid ${DV.border}`,
      background: DV.bgSurface,
    }}>
      <div style={{
        padding:        '10px 16px 6px',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: DV.text }}>
          أسطول السائقين
        </span>
        <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
          {['available', 'delivering', 'offline'].map(s => {
            const cfg   = DRIVER_STATUS[s]
            const count = drivers.filter(d => d.status === s).length
            return (
              <span key={s} style={{ color: cfg.text }}>
                {count} {cfg.label}
              </span>
            )
          })}
        </div>
      </div>

      <div style={{
        display:    'flex',
        gap:        '10px',
        padding:    '8px 16px 14px',
        overflowX:  'auto',
        scrollbarWidth: 'thin',
      }}>
        {drivers.map((driver, i) => (
          <DriverCard
            key={driver.id}
            driver={driver}
            index={i}
            currentOrder={driver.current_order_id ? orderMap.get(driver.current_order_id) : undefined}
            onAssign={() => onAssign()}
            isAr={isAr}
          />
        ))}

        {drivers.length === 0 && (
          <div style={{ padding: '24px 0', color: DV.muted, fontSize: '13px' }}>
            لا يوجد سائقون متاحون
          </div>
        )}
      </div>
    </div>
  )
}
