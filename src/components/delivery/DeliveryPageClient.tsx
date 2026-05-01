'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient }    from '@/lib/supabase/client'
import { CSS_VARS }        from '@/lib/delivery/tokens'
import { useAudioAlert }   from '@/hooks/useAudioAlert'
import { playBell }        from '@/lib/audio/bells'
import type { DeliveryOrder, Driver, DeliveryMetrics, ViewMode } from '@/lib/delivery/types'
import DeliveryHeader      from './DeliveryHeader'
import MetricsStrip        from './MetricsStrip'
import DeliveryKanban      from './DeliveryKanban'
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

  const { isMuted, toggleMute, mutedRef } = useAudioAlert()

  const [orders,       setOrders]       = useState<DeliveryOrder[]>(initialOrders)
  const [drivers,      setDrivers]      = useState<Driver[]>(initialDrivers)
  const [metrics,      setMetrics]      = useState<DeliveryMetrics>(initialMetrics)
  const [view,         setView]         = useState<ViewMode>('kanban')
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
    const { data } = await supabase
      .from('orders')
      .select(`
        id, status, customer_name, customer_phone,
        branch_id, notes, source, total_bhd, created_at, updated_at,
        assigned_driver_id, delivery_address, expected_delivery_time,
        delivery_lat, delivery_lng, order_items(id)
      `)
      .in('status', ACTIVE_STATUSES as never[])
      .order('created_at', { ascending: true })

    if (!data) return
    const nowMs = Date.now()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setOrders(data.map((o: any) => ({
      id:                     o.id,
      order_number:           undefined,
      status:                 o.status as DeliveryOrder['status'],
      customer_name:          o.customer_name,
      customer_phone:         o.customer_phone,
      customer_address:       o.delivery_address ?? null,
      customer_location:      o.delivery_lat != null && o.delivery_lng != null
                                ? { lat: o.delivery_lat, lng: o.delivery_lng }
                                : null,
      branch_id:              o.branch_id,
      driver_id:              o.assigned_driver_id,
      driver_name:            null,
      driver_phone:           null,
      items_count:            Array.isArray(o.order_items) ? o.order_items.length : 0,
      total_bhd:              o.total_bhd,
      notes:                  o.notes,
      source:                 o.source,
      created_at:             o.created_at,
      updated_at:             o.updated_at,
      expected_delivery_time: o.expected_delivery_time ?? null,
      eta_minutes:            null,
    })))

    // Bell on new order
    if (data.length > prevCountRef.current && !mutedRef.current) {
      playBell('new')
    }
    prevCountRef.current = data.length

    const inTransit  = data.filter((o) => o.status === 'out_for_delivery').length
    const lateCount  = data.filter((o) =>
      (nowMs - new Date(o.created_at).getTime()) / 60_000 > 45
    ).length
    setMetrics(prev => ({
      ...prev,
      orders_total: data.length,
      in_transit:   inTransit,
      late_count:   lateCount,
      // drivers_available / drivers_total / on_time_rate stay from server render
    }))
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

  // ── Realtime: driver availability (staff_basic online/offline toggle) ───────
  useEffect(() => {
    const ch = supabase.channel('delivery-driver-status')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'staff_basic' },
        (payload) => {
          const updated = payload.new as {
            id: string
            role: string
            availability_status: string | null
          }
          if (updated.role !== 'driver') return
          const avail = updated.availability_status ?? 'offline'
          setDrivers(prev => prev.map(d => {
            if (d.id !== updated.id) return d
            const status: Driver['status'] =
              avail === 'offline'       ? 'offline'    :
              d.current_order_id != null ? 'delivering' :
              'available'
            return { ...d, status }
          }))
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [supabase])

  // ── Keep metrics.drivers_available in sync with live driver state ───────────
  useEffect(() => {
    setMetrics(prev => ({
      ...prev,
      drivers_available: drivers.filter(d => d.status === 'available').length,
      drivers_total:     drivers.length,
    }))
  }, [drivers])

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
        isMuted={isMuted}
        onToggleMute={toggleMute}
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
          <DeliveryKanban
            orders={orders}
            drivers={drivers}
            isAr={isAr}
            onSelect={openOrder}
            onDispatch={openDispatch}
          />
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

