'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient }    from '@/lib/supabase/client'
import { CSS_VARS }        from '@/lib/delivery/tokens'
import { useAudioAlert }   from '@/hooks/useAudioAlert'
import { playBell }        from '@/lib/audio/bells'
import { assignSelfAsDriver } from '@/app/[locale]/dashboard/delivery/actions'
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
  userRole:       string
  userId:         string
}

const ACTIVE_STATUSES = ['accepted', 'preparing', 'ready', 'out_for_delivery']

type DeliveryOrderRow = {
  id: string
  status: string
  customer_name: string | null
  customer_phone: string | null
  branch_id: string
  notes: string | null
  customer_notes: string | null
  source: string
  total_bhd: number
  created_at: string
  updated_at: string
  assigned_driver_id: string | null
  delivery_address: string | null
  expected_delivery_time: string | null
  delivery_lat: number | null
  delivery_lng: number | null
  order_items: { id: string }[] | null
}

type StaffDriverRow = {
  id: string
  name: string
  phone: string | null
  branch_id: string | null
  availability_status: string | null
}

type DriverLocationRow = {
  driver_id: string
  lat: number
  lng: number
}

type ActiveDriverOrderRow = {
  id: string
  assigned_driver_id: string | null
}

export default function DeliveryPageClient({
  initialOrders, initialDrivers, initialMetrics, locale, branchId, userRole, userId: _userId,
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
    let query = supabase
      .from('orders')
      .select(`
        id, status, customer_name, customer_phone,
        branch_id, notes, customer_notes, source, total_bhd, created_at, updated_at,
        assigned_driver_id, delivery_address, expected_delivery_time,
        delivery_lat, delivery_lng, order_items(id)
      `)
      .in('status', ACTIVE_STATUSES as never[])
      .order('created_at', { ascending: true })

    if (branchId) query = query.eq('branch_id', branchId)
    const { data } = await query

    if (!data) return
    const nowMs = Date.now()
    const rows = data as DeliveryOrderRow[]
    setOrders(rows.map((o) => ({
      id:                     o.id,
      order_number:           o.id.slice(0, 8).toUpperCase(),
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
      notes:                  o.customer_notes ?? o.notes,
      source:                 o.source,
      created_at:             o.created_at,
      updated_at:             o.updated_at,
      expected_delivery_time: o.expected_delivery_time ?? null,
      eta_minutes:            null,
    })))

    // Bell on new order
    if (rows.length > prevCountRef.current && !mutedRef.current) {
      playBell('new')
    }
    prevCountRef.current = rows.length

    const inTransit  = rows.filter((o) => o.status === 'out_for_delivery').length
    const lateCount  = rows.filter((o) =>
      (nowMs - new Date(o.created_at).getTime()) / 60_000 > 45
    ).length
    setMetrics(prev => ({
      ...prev,
      orders_total: rows.length,
      in_transit:   inTransit,
      late_count:   lateCount,
      // drivers_available / drivers_total / on_time_rate stay from server render
    }))
  }, [supabase, branchId, mutedRef])

  const refreshDrivers = useCallback(async () => {
    let driversQuery = supabase
      .from('staff_basic')
      .select('id, name, phone, branch_id, availability_status')
      .eq('role', 'driver')
      .eq('is_active', true)

    if (branchId) driversQuery = driversQuery.eq('branch_id', branchId)

    const [{ data: driversData }, { data: locationsData }, { data: activeOrdersData }] = await Promise.all([
      driversQuery,
      supabase
        .from('driver_locations')
        .select('driver_id, lat, lng, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('orders')
        .select('id, assigned_driver_id, status')
        .eq('status', 'out_for_delivery'),
    ])

    const locationMap = new Map<string, { lat: number; lng: number }>()
    for (const loc of (locationsData ?? []) as DriverLocationRow[]) {
      if (!locationMap.has(loc.driver_id)) {
        locationMap.set(loc.driver_id, { lat: loc.lat, lng: loc.lng })
      }
    }

    const driverOrderMap = new Map<string, string>()
    for (const order of (activeOrdersData ?? []) as ActiveDriverOrderRow[]) {
      if (order.assigned_driver_id) {
        driverOrderMap.set(order.assigned_driver_id, order.id)
      }
    }

    setDrivers(((driversData ?? []) as StaffDriverRow[]).map((driver) => {
      const availability = driver.availability_status ?? 'offline'
      const status: Driver['status'] =
        availability === 'offline'          ? 'offline' :
        availability === 'busy'             ? 'busy' :
        driverOrderMap.has(driver.id)       ? 'delivering' :
        'available'

      return {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        status,
        location: locationMap.get(driver.id) ?? null,
        current_order_id: driverOrderMap.get(driver.id) ?? null,
        completed_today: 0,
        branch_id: driver.branch_id,
      }
    }))
  }, [supabase, branchId])

  useEffect(() => {
    const ch = supabase.channel('delivery-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async (payload) => {
        console.info('Delivery order realtime event:', payload)
        await refreshOrders()
        await refreshDrivers()
      })
      .subscribe((status) => {
        console.info('Delivery orders realtime subscription:', status)
      })
    return () => { supabase.removeChannel(ch) }
  }, [supabase, refreshOrders, refreshDrivers])

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
        { event: '*', schema: 'public', table: 'staff_basic' },
        async (payload) => {
          console.info('Driver realtime event:', payload)
          await refreshDrivers()
        },
      )
      .subscribe((status) => {
        console.info('Driver realtime subscription:', status)
      })
    return () => { supabase.removeChannel(ch) }
  }, [supabase, refreshDrivers])

  // ── Keep metrics.drivers_available in sync with live driver state ───────────
  useEffect(() => {
    setMetrics(prev => ({
      ...prev,
      drivers_available: drivers.filter(d => d.status === 'available').length,
      drivers_total:     drivers.length,
    }))
  }, [drivers])

  async function handleSelfAssign(orderId: string) {
    const result = await assignSelfAsDriver(orderId)
    if (!result.success) console.error('Self-assign failed:', result.error)
    await refreshOrders()
    await refreshDrivers()
  }

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
            userRole={userRole}
            onSelfAssign={userRole === 'driver' ? handleSelfAssign : undefined}
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
