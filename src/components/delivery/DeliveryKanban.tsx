'use client'

import { useEffect, useState } from 'react'
import { UserPlus, ExternalLink, Clock, Truck, CheckCircle } from 'lucide-react'
import { DV, DV_STATUS, DRIVER_STATUS }         from '@/lib/delivery/tokens'
import type { DeliveryOrder, Driver }           from '@/lib/delivery/types'

// ── Column config ─────────────────────────────────────────────────────────────

const COLS = [
  {
    id:       'kitchen',
    labelAr:  'قيد التحضير',
    labelEn:  'In Kitchen',
    statuses: ['new', 'accepted', 'preparing'],
    accent:   DV_STATUS.errorBg,
    textColor: DV_STATUS.errorText,
  },
  {
    id:       'ready',
    labelAr:  'جاهز للاستلام',
    labelEn:  'Ready',
    statuses: ['ready'],
    accent:   DV_STATUS.successBg,
    textColor: DV_STATUS.successText,
  },
  {
    id:       'delivering',
    labelAr:  'قيد التوصيل',
    labelEn:  'Delivering',
    statuses: ['out_for_delivery'],
    accent:   DV_STATUS.blueBg,
    textColor: DV_STATUS.blueText,
  },
  {
    id:       'done',
    labelAr:  'مكتمل اليوم',
    labelEn:  'Delivered',
    statuses: ['delivered', 'completed'],
    accent:   'rgba(138,112,85,0.4)',
    textColor: DV.muted,
  },
] as const

// ── Urgency helpers ────────────────────────────────────────────────────────────

type Urgency = 'critical' | 'urgent' | 'normal'

function getUrgency(createdAt: string, expectedAt?: string | null): Urgency {
  if (expectedAt) {
    const minsLeft = (new Date(expectedAt).getTime() - Date.now()) / 60_000
    if (minsLeft <= 0)  return 'critical'
    if (minsLeft <= 12) return 'urgent'
    return 'normal'
  }
  const elapsedMin = (Date.now() - new Date(createdAt).getTime()) / 60_000
  if (elapsedMin > 45) return 'critical'
  if (elapsedMin > 30) return 'urgent'
  return 'normal'
}

function useElapsed(createdAt: string): number {
  const [elapsed, setElapsed] = useState(
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000),
  )
  useEffect(() => {
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000)),
      30_000,
    )
    return () => clearInterval(id)
  }, [createdAt])
  return elapsed
}

function fmtElapsed(min: number, isAr: boolean): string {
  if (min < 60) return isAr ? `${min}د` : `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return isAr ? `${h}س ${m}د` : `${h}h ${m}m`
}

// ── Card ───────────────────────────────────────────────────────────────────────

function KanbanCard({
  order,
  driver,
  isAr,
  userRole,
  onSelect,
  onDispatch,
  onSelfAssign,
}: {
  order:         DeliveryOrder
  driver:        Driver | undefined
  isAr:          boolean
  userRole?:     string
  onSelect:      () => void
  onDispatch:    () => void
  onSelfAssign?: (orderId: string) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const elapsed  = useElapsed(order.created_at)
  const urgency: Urgency = order.status === 'delivered' || order.status === 'completed'
    ? 'normal'
    : getUrgency(order.created_at, order.expected_delivery_time)

  const borderInlineStart =
    urgency === 'critical' ? `3px solid ${DV_STATUS.errorBg}`  :
    urgency === 'urgent'   ? `3px solid ${DV.amber}` :
    `3px solid ${DRIVER_STATUS[driver?.status ?? 'offline']?.bg ?? DV.border}`

  const driverStatus = driver ? DRIVER_STATUS[driver.status] ?? DRIVER_STATUS.offline : null
  const isDone       = order.status === 'delivered' || order.status === 'completed'

  return (
    <div
      style={{
        background:         DV.bgCard,
        border:             `1px solid ${urgency === 'critical' ? 'rgba(139,32,32,0.45)' : DV.border}`,
        borderInlineStart,
        borderRadius:       '10px',
        overflow:           'hidden',
        transition:         'border-color 0.2s',
      }}
    >
      {/* Urgency banner */}
      {urgency !== 'normal' && !isDone && (
        <div style={{
          display:         'flex',
          alignItems:      'center',
          gap:             '6px',
          padding:         '5px 12px',
          background:      urgency === 'critical'
            ? 'rgba(139,32,32,0.25)'
            : 'rgba(196,147,58,0.12)',
          borderBottom: `1px solid ${urgency === 'critical' ? 'rgba(139,32,32,0.35)' : 'rgba(196,147,58,0.2)'}`,
          animation:       urgency === 'critical' ? 'pulse 1.2s ease-in-out infinite' : 'none',
        }}>
          <Clock size={12} color={urgency === 'critical' ? DV_STATUS.errorText : DV.amberLight} />
          <span style={{
            fontSize:   '11px',
            fontWeight: 700,
            color:      urgency === 'critical' ? DV_STATUS.errorText : DV.amberLight,
            letterSpacing: '0.04em',
          }}>
            {urgency === 'critical'
              ? (isAr ? 'متأخر!' : 'LATE!')
              : (isAr ? 'تنبيه' : 'URGENT')
            }
            {' — '}
            {fmtElapsed(elapsed, isAr)}
          </span>
        </div>
      )}

      <div style={{ padding: '11px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

        {/* Header row: order # + elapsed */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span style={{
            fontSize:   '16px',
            fontWeight: 800,
            color:      DV.amber,
            letterSpacing: '-0.01em',
            fontFamily: 'IBM Plex Sans Arabic, sans-serif',
          }}>
            #{(order.order_number ?? order.id.slice(0, 8)).toUpperCase()}
          </span>

          {urgency === 'normal' && !isDone && (
            <span style={{ fontSize: '11px', color: DV.muted }}>
              {fmtElapsed(elapsed, isAr)}
            </span>
          )}

          {isDone && (
            <span style={{
              fontSize:     '10px',
              fontWeight:   600,
              color:        DV_STATUS.successText,
              background:   `${DV_STATUS.successBg}20`,
              padding:      '2px 7px',
              borderRadius: '4px',
            }}>
              ✓ {isAr ? 'مكتمل' : 'Done'}
            </span>
          )}
        </div>

        {/* Customer */}
        {order.customer_name && (
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: DV.text, lineHeight: 1.3 }}>
              {order.customer_name}
            </p>
            {order.customer_address && (
              <p style={{
                fontSize:   '11px',
                color:      DV.muted,
                marginTop:  '2px',
                overflow:   'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                maxWidth:   '100%',
              }}>
                📍 {order.customer_address}
              </p>
            )}
          </div>
        )}

        {/* Items + total */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', color: DV.muted }}>
            {order.items_count} {isAr ? 'صنف' : order.items_count === 1 ? 'item' : 'items'}
          </span>
          <span style={{
            fontSize:   '14px',
            fontWeight: 700,
            color:      DV.amberLight,
            fontFamily: 'IBM Plex Sans Arabic, sans-serif',
          }}>
            {Number(order.total_bhd).toFixed(3)}
            <span style={{ fontSize: '11px', color: DV.muted, marginInlineStart: '3px' }}>BD</span>
          </span>
        </div>

        {/* Driver row */}
        {driver && driverStatus && (
          <div style={{
            display:      'flex',
            alignItems:   'center',
            gap:          '6px',
            padding:      '5px 8px',
            background:   DV.bgSurface,
            borderRadius: '6px',
            border:       `1px solid ${DV.border}`,
          }}>
            <Truck size={12} color={driverStatus.text} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: driverStatus.text, flex: 1 }}>
              {driver.name}
            </span>
            <span style={{
              fontSize:     '10px',
              fontWeight:   600,
              color:        driverStatus.text,
              background:   driverStatus.bg,
              padding:      '1px 6px',
              borderRadius: '4px',
            }}>
              {driverStatus.label}
            </span>
          </div>
        )}

        {/* Action row */}
        {!isDone && (
          <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
            {/* Driver: self-assign on ready unassigned orders */}
            {userRole === 'driver' && !order.driver_id && order.status === 'ready' && (
              <button
                type="button"
                disabled={busy}
                onClick={async (e) => {
                  e.stopPropagation()
                  setBusy(true)
                  await onSelfAssign?.(order.id)
                  setBusy(false)
                }}
                style={{
                  flex:           1,
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  gap:            '4px',
                  padding:        '8px 0',
                  background:     busy ? DV.bgSurface : DV_STATUS.successBg,
                  color:          busy ? DV.muted : DV_STATUS.successText,
                  border:         'none',
                  borderRadius:   '7px',
                  fontSize:       '12px',
                  fontWeight:     700,
                  cursor:         busy ? 'not-allowed' : 'pointer',
                  opacity:        busy ? 0.7 : 1,
                  fontFamily:     'IBM Plex Sans Arabic, sans-serif',
                  transition:     'background 0.15s',
                }}
              >
                <CheckCircle size={12} />
                {busy ? '…' : (isAr ? 'استلم هذا الطلب' : 'Take Order')}
              </button>
            )}

            {/* Manager: dispatch button on unassigned orders */}
            {userRole !== 'driver' && !order.driver_id && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDispatch() }}
                style={{
                  flex:           1,
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  gap:            '4px',
                  padding:        '6px 0',
                  background:     DV.amber,
                  color:          DV.bgPage,
                  border:         'none',
                  borderRadius:   '7px',
                  fontSize:       '12px',
                  fontWeight:     700,
                  cursor:         'pointer',
                  fontFamily:     'IBM Plex Sans Arabic, sans-serif',
                  transition:     'background 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = DV.amberLight }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = DV.amber }}
              >
                <UserPlus size={12} />
                {isAr ? 'تعيين' : 'Assign'}
              </button>
            )}

            {/* Details button — managers only */}
            {userRole !== 'driver' && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSelect() }}
                style={{
                  flex:           order.driver_id ? 1 : 0,
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  gap:            '4px',
                  padding:        '6px 10px',
                  background:     'transparent',
                  color:          DV.muted,
                  border:         `1px solid ${DV.border}`,
                  borderRadius:   '7px',
                  fontSize:       '12px',
                  fontWeight:     600,
                  cursor:         'pointer',
                  fontFamily:     'IBM Plex Sans Arabic, sans-serif',
                  transition:     'all 0.15s',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.color = DV.text
                  el.style.borderColor = DV.amber
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.color = DV.muted
                  el.style.borderColor = DV.border
                }}
              >
                <ExternalLink size={11} />
                {isAr ? 'تفاصيل' : 'Details'}
              </button>
            )}
          </div>
        )}

        {/* Completed: details only */}
        {isDone && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onSelect() }}
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            '4px',
              padding:        '5px 0',
              background:     'transparent',
              color:          DV.muted,
              border:         `1px solid ${DV.border}`,
              borderRadius:   '7px',
              fontSize:       '11px',
              fontWeight:     500,
              cursor:         'pointer',
              fontFamily:     'IBM Plex Sans Arabic, sans-serif',
              width:          '100%',
            }}
          >
            <ExternalLink size={10} />
            {isAr ? 'عرض' : 'View'}
          </button>
        )}

      </div>
    </div>
  )
}

// ── Column ─────────────────────────────────────────────────────────────────────

function KanbanColumn({
  col,
  orders,
  drivers,
  isAr,
  userRole,
  onSelect,
  onDispatch,
  onSelfAssign,
}: {
  col:          typeof COLS[number]
  orders:       DeliveryOrder[]
  drivers:      Driver[]
  isAr:         boolean
  userRole?:    string
  onSelect:     (id: string) => void
  onDispatch:   (order: DeliveryOrder) => void
  onSelfAssign?: (orderId: string) => Promise<void>
}) {
  const urgentCount   = orders.filter(o =>
    getUrgency(o.created_at, o.expected_delivery_time) !== 'normal',
  ).length

  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      background:     DV.bgSurface,
      borderRadius:   '12px',
      border:         `1px solid ${DV.border}`,
      minHeight:      '200px',
      maxHeight:      'calc(100vh - 220px)',
      overflow:       'hidden',
    }}>
      {/* Column header */}
      <div style={{
        padding:      '10px 14px',
        borderBottom: `1px solid ${DV.border}`,
        borderTop:    `3px solid ${col.accent}`,
        borderRadius: '12px 12px 0 0',
        display:      'flex',
        alignItems:   'center',
        gap:          '8px',
        flexShrink:   0,
      }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: DV.text, flex: 1 }}>
          {isAr ? col.labelAr : col.labelEn}
        </span>
        <span style={{
          fontSize:     '12px',
          fontWeight:   700,
          color:        orders.length > 0 ? col.textColor : DV.muted,
          background:   orders.length > 0 ? `${col.accent}25` : 'transparent',
          padding:      '1px 8px',
          borderRadius: '20px',
          minWidth:     '24px',
          textAlign:    'center',
        }}>
          {orders.length}
        </span>
        {urgentCount > 0 && col.id !== 'done' && (
          <span style={{
            fontSize:     '10px',
            fontWeight:   700,
            color:        DV_STATUS.errorText,
            background:   `${DV_STATUS.errorBg}25`,
            padding:      '1px 6px',
            borderRadius: '4px',
            animation:    'pulse 1.2s ease-in-out infinite',
          }}>
            ⚡ {urgentCount}
          </span>
        )}
      </div>

      {/* Cards */}
      <div style={{
        flex:       1,
        overflowY:  'auto',
        padding:    '10px',
        display:    'flex',
        flexDirection: 'column',
        gap:        '8px',
      }}>
        {orders.length === 0 ? (
          <div style={{
            flex:           1,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            padding:        '32px 0',
            color:          DV.muted,
            fontSize:       '12px',
          }}>
            {isAr ? 'لا توجد طلبات' : 'No orders'}
          </div>
        ) : (
          orders.map(order => (
            <KanbanCard
              key={order.id}
              order={order}
              driver={drivers.find(d => d.id === order.driver_id)}
              isAr={isAr}
              userRole={userRole}
              onSelect={() => onSelect(order.id)}
              onDispatch={() => onDispatch(order)}
              onSelfAssign={onSelfAssign}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

interface Props {
  orders:        DeliveryOrder[]
  drivers:       Driver[]
  isAr:          boolean
  userRole?:     string
  onSelect:      (id: string) => void
  onDispatch:    (order: DeliveryOrder) => void
  onSelfAssign?: (orderId: string) => Promise<void>
}

export default function DeliveryKanban({ orders, drivers, isAr, userRole, onSelect, onDispatch, onSelfAssign }: Props) {
  return (
    <div style={{
      flex:       1,
      overflowX:  'auto',
      overflowY:  'hidden',
      padding:    '16px 20px',
      display:    'grid',
      gridTemplateColumns: 'repeat(4, minmax(270px, 1fr))',
      gap:        '12px',
      alignItems: 'start',
    }}>
      {COLS.map(col => (
        <KanbanColumn
          key={col.id}
          col={col}
          orders={orders.filter(o => (col.statuses as readonly string[]).includes(o.status))}
          drivers={drivers}
          isAr={isAr}
          userRole={userRole}
          onSelect={onSelect}
          onDispatch={onDispatch}
          onSelfAssign={onSelfAssign}
        />
      ))}
    </div>
  )
}
