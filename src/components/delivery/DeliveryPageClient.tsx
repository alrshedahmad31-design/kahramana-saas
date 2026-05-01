'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient }    from '@/lib/supabase/client'
import { CSS_VARS }        from '@/lib/delivery/tokens'
import type { DeliveryOrder, Driver, DeliveryMetrics, ViewMode } from '@/lib/delivery/types'
import DeliveryHeader      from './DeliveryHeader'
import MetricsStrip        from './MetricsStrip'
import MapView             from './MapView'
import OrderListPanel      from './OrderListPanel'
import DriverFleetPanel    from './DriverFleetPanel'
import OrderDetailDrawer   from './OrderDetailDrawer'
import DispatchModal       from './DispatchModal'

interface Props {
  initialOrders:  DeliveryOrder[]
  initialDrivers: Driver[]
  initialMetrics: DeliveryMetrics
  locale:         string
  branchId:       string | null
}

const ACTIVE_STATUSES = ['accepted', 'preparing', 'ready', 'out_for_delivery']

export default function DeliveryPageClient({
  initialOrders, initialDrivers, initialMetrics, locale, branchId: _branchId,
}: Props) {
  const supabase = useMemo(() => createClient(), [])
  const isAr     = locale === 'ar'

  const [orders,       setOrders]       = useState<DeliveryOrder[]>(initialOrders)
  const [drivers,      setDrivers]      = useState<Driver[]>(initialDrivers)
  const [metrics,      setMetrics]      = useState<DeliveryMetrics>(initialMetrics)
  const [view,         setView]         = useState<ViewMode>('map')
  const [selectedId,   setSelectedId]   = useState<string | null>(null)
  const [showDrawer,   setShowDrawer]   = useState(false)
  const [showDispatch, setShowDispatch] = useState(false)
  const [dispatchOrder,setDispatchOrder]= useState<DeliveryOrder | null>(null)
  const [hoveredId,    setHoveredId]    = useState<string | null>(null)
  const prevCountRef   = useRef(initialOrders.length)

  const selectedOrder = useMemo(
    () => orders.find(o => o.id === selectedId) ?? null,
    [orders, selectedId],
  )

  // ── Realtime: orders ────────────────────────────────────────────────────────
  const refreshOrders = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await supabase
      .from('orders')
      .select(`
        id, status, customer_name, customer_phone,
        branch_id, notes, source, total_bhd, created_at, updated_at,
        assigned_driver_id, order_items(id)
      `)
      .in('status', ACTIVE_STATUSES as never[])
      .order('created_at', { ascending: true })

    if (!data) return
    const nowMs = Date.now()
    setOrders(data.map((o) => ({
      id:               o.id,
      order_number:     undefined,
      status:           o.status as DeliveryOrder['status'],
      customer_name:    o.customer_name,
      customer_phone:   o.customer_phone,
      customer_address: null,
      customer_location:null,
      branch_id:        o.branch_id,
      driver_id:        o.assigned_driver_id,
      driver_name:      null,
      driver_phone:     null,
      items_count:      Array.isArray(o.order_items) ? o.order_items.length : 0,
      total_bhd:        o.total_bhd,
      notes:            o.notes,
      source:           o.source,
      created_at:       o.created_at,
      updated_at:       o.updated_at,
      eta_minutes:      null,
    })))

    // Toast on new order
    if (data.length > prevCountRef.current) {
      try {
        const ctx = new AudioContext()
        const osc = ctx.createOscillator(); const g = ctx.createGain()
        osc.connect(g); g.connect(ctx.destination)
        osc.type = 'sine'; osc.frequency.value = 880
        g.gain.setValueAtTime(0.4, ctx.currentTime)
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
        osc.start(); osc.stop(ctx.currentTime + 0.6)
      } catch { /* silent */ }
    }
    prevCountRef.current = data.length

    const inTransit  = data.filter((o) => o.status === 'out_for_delivery').length
    const lateCount  = data.filter((o) =>
      (nowMs - new Date(o.created_at).getTime()) / 60_000 > 45
    ).length
    setMetrics(prev => ({ ...prev, orders_total: data.length, in_transit: inTransit, late_count: lateCount }))
  }, [supabase])

  useEffect(() => {
    const ch = supabase.channel('delivery-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refreshOrders)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [supabase, refreshOrders])

  // ── Realtime: driver locations ─────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel('delivery-locations')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'driver_locations' },
        (payload) => {
          const { driver_id, lat, lng } = payload.new as { driver_id: string; lat: number; lng: number }
          setDrivers(prev => prev.map(d =>
            d.id === driver_id ? { ...d, location: { lat, lng } } : d,
          ))
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [supabase])

  function openOrder(id: string) {
    setSelectedId(id)
    setShowDrawer(true)
  }

  function openDispatch(order?: DeliveryOrder) {
    setDispatchOrder(order ?? null)
    setShowDispatch(true)
  }

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      style={{
        ...(CSS_VARS as Record<string, string>),
        background:  'var(--dv-bg)',
        color:       'var(--dv-text)',
        fontFamily:  'IBM Plex Sans Arabic, sans-serif',
        margin:      '-1.5rem -1.5rem -1.5rem',
        minHeight:   'calc(100vh - 64px)',
        display:     'flex',
        flexDirection:'column',
      }}
    >
      <DeliveryHeader
        view={view}
        onViewChange={setView}
        onAssign={() => openDispatch()}
        isAr={isAr}
      />

      <MetricsStrip metrics={metrics} isAr={isAr} />

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {view === 'map' && (
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            {/* Map (60%) */}
            <div style={{ flex: '0 0 60%', minWidth: 0, position: 'relative' }}>
              <MapView
                orders={orders}
                drivers={drivers}
                hoveredOrderId={hoveredId}
                onOrderClick={openOrder}
                isAr={isAr}
              />
            </div>
            {/* Order list (40%) */}
            <div style={{
              flex: '0 0 40%',
              minWidth: 0,
              borderLeft: isAr ? 'none' : `1px solid var(--dv-border)`,
              borderRight: isAr ? `1px solid var(--dv-border)` : 'none',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}>
              <OrderListPanel
                orders={orders}
                drivers={drivers}
                onSelect={openOrder}
                onHover={setHoveredId}
                isAr={isAr}
              />
            </div>
          </div>
        )}

        {view === 'list' && (
          <div style={{ flex: 1, overflow: 'auto', padding: '1rem 1.5rem' }}>
            <OrderListPanel
              orders={orders}
              drivers={drivers}
              onSelect={openOrder}
              onHover={setHoveredId}
              isAr={isAr}
              fullWidth
            />
          </div>
        )}

        {view === 'kanban' && (
          <KanbanView orders={orders} onSelect={openOrder} isAr={isAr} />
        )}
      </div>

      {/* Driver fleet panel */}
      <DriverFleetPanel
        drivers={drivers}
        orders={orders}
        onAssign={openDispatch}
        isAr={isAr}
      />

      {/* Drawer */}
      <OrderDetailDrawer
        order={selectedOrder}
        drivers={drivers}
        open={showDrawer}
        onClose={() => setShowDrawer(false)}
        onDispatch={() => selectedOrder && openDispatch(selectedOrder)}
        isAr={isAr}
      />

      {/* Dispatch modal */}
      {showDispatch && (
        <DispatchModal
          order={dispatchOrder}
          drivers={drivers}
          orders={orders}
          onClose={() => setShowDispatch(false)}
          isAr={isAr}
        />
      )}
    </div>
  )
}

// ── Inline Kanban (5 columns) ─────────────────────────────────────────────────

import { DV, STATUS_BORDER } from '@/lib/delivery/tokens'

const KANBAN_COLS: { status: string; label: string }[] = [
  { status: 'accepted',         label: 'جديد'          },
  { status: 'preparing',        label: 'قيد التحضير'   },
  { status: 'ready',            label: 'جاهز'          },
  { status: 'out_for_delivery', label: 'يُوصَّل'        },
  { status: 'delivered',        label: 'مكتمل'         },
]

function KanbanView({ orders, onSelect, isAr }: {
  orders: DeliveryOrder[]; onSelect: (id: string) => void; isAr: boolean
}) {
  return (
    <div style={{
      flex: 1, display: 'flex', gap: '1px',
      background: DV.border, overflow: 'auto', padding: '1rem 1.5rem',
    }}>
      {KANBAN_COLS.map(col => {
        const colOrders = orders.filter(o => o.status === col.status)
        return (
          <div key={col.status} style={{
            flex: '0 0 220px', background: DV.bgSurface,
            borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: 0,
          }}>
            <div style={{
              padding: '10px 12px', borderBottom: `1px solid ${DV.border}`,
              borderTop: `3px solid ${STATUS_BORDER[col.status] ?? DV.amber}`,
              borderRadius: '8px 8px 0 0',
            }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: DV.text }}>
                {col.label}
              </span>
              <span style={{
                marginInlineStart: '8px', fontSize: '11px', fontWeight: 600,
                color: DV.muted,
              }}>
                ({colOrders.length})
              </span>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {colOrders.map(o => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => onSelect(o.id)}
                  style={{
                    background: DV.bgCard, border: `1px solid ${DV.border}`,
                    borderRight: `3px solid ${STATUS_BORDER[o.status] ?? DV.amber}`,
                    borderRadius: '8px', padding: '10px', textAlign: isAr ? 'right' : 'left',
                    cursor: 'pointer', transition: 'border-color 0.2s', width: '100%',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 700, color: DV.amber }}>
                    #{o.order_number}
                  </div>
                  <div style={{ fontSize: '12px', color: DV.muted, marginTop: '2px' }}>
                    {o.customer_name ?? '—'}
                  </div>
                  {o.driver_name && (
                    <div style={{ fontSize: '11px', color: DV.text, marginTop: '4px', opacity: 0.7 }}>
                      {o.driver_name}
                    </div>
                  )}
                </button>
              ))}
              {colOrders.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: DV.muted, fontSize: '12px' }}>
                  لا يوجد
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
