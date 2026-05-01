'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { driverBumpOrder, postDriverLocation, toggleDriverAvailability } from '@/app/[locale]/driver/actions'
import { useAudioAlert } from '@/hooks/useAudioAlert'
import { playBell } from '@/lib/audio/bells'
import DriverHeader from './DriverHeader'
import DriverOrderCard from './DriverOrderCard'
import DriverPerformanceDashboard from './DriverPerformanceDashboard'
import DriverCashSummary from './DriverCashSummary'
import CashHandoverModal from './CashHandoverModal'
import { resolveExpectedAt, getUrgencyLevel } from '@/lib/utils/delivery'
import type { DriverOrder } from '@/lib/supabase/custom-types'

interface Props {
  initialOrders:          DriverOrder[]
  initialCompletedOrders: DriverOrder[]
  branchId:               string | null
  branchMapsUrl:          string | null
  driverId:               string
  locale:                 string
  completedCount:         number
  initialIsOnline:        boolean
}

function formatClock(): string {
  const d    = new Date()
  const h    = String(d.getHours() % 12 || 12).padStart(2, '0')
  const m    = String(d.getMinutes()).padStart(2, '0')
  const s    = String(d.getSeconds()).padStart(2, '0')
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM'
  return `${h}:${m}:${s} ${ampm}`
}

export default function DriverDashboard({
  initialOrders, initialCompletedOrders, branchId, branchMapsUrl, driverId, locale, completedCount: _completedCount, initialIsOnline,
}: Props) {
  const isAr = locale === 'ar'

  const [orders,          setOrders]          = useState<DriverOrder[]>(initialOrders)
  const [completedOrders, setCompletedOrders] = useState<DriverOrder[]>(initialCompletedOrders)
  const [isOnline,        setIsOnline]        = useState(initialIsOnline)

  const { isMuted, toggleMute, mutedRef } = useAudioAlert()
  // Track online state in a ref so fetchOrders callback (useCallback) can read it
  const isOnlineRef = useRef(initialIsOnline)
  useEffect(() => { isOnlineRef.current = isOnline }, [isOnline])
  // Track known ready-order IDs to detect new pickups
  const prevReadyIdsRef = useRef(new Set(initialOrders.filter(o => o.status === 'ready').map(o => o.id)))
  const [clock,           setClock]           = useState(formatClock)
  const [showHandover,    setShowHandover]    = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = useMemo(() => createClient(), [])

  const fetchOrders = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = supabase
      .from('orders')
      .select(`
        id, customer_name, customer_phone, branch_id, status,
        notes, delivery_address, delivery_lat, delivery_lng, delivery_instructions,
        delivery_building, delivery_street, delivery_area,
        expected_delivery_time, customer_notes, driver_notes,
        picked_up_at, arrived_at, delivered_at,
        total_bhd, assigned_driver_id, created_at, updated_at,
        source, whatsapp_sent_at, coupon_id, coupon_discount_bhd,
        order_items(name_ar, name_en, quantity, selected_size, selected_variant),
        payments(method)
      `)
      .in('status', ['ready', 'out_for_delivery'])
      .order('created_at', { ascending: true })

    if (branchId) q = q.eq('branch_id', branchId)

    const { data } = await q
    if (!data) return

    // Alert when new 'ready' orders appear and driver is online + not muted
    if (isOnlineRef.current && !mutedRef.current) {
      const newReady = data.filter(
        (o) => o.status === 'ready' && !prevReadyIdsRef.current.has(o.id),
      )
      if (newReady.length > 0) playBell('ready')
    }
    prevReadyIdsRef.current = new Set(
      data.filter((o) => o.status === 'ready').map((o) => o.id),
    )

    setOrders(data as DriverOrder[])
  }, [supabase, branchId])

  const fetchCompleted = useCallback(async () => {
    if (!driverId) return
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await supabase
      .from('orders')
      .select(`
        id, customer_name, customer_phone, branch_id, status,
        notes, delivery_address, delivery_lat, delivery_lng, delivery_instructions,
        delivery_building, delivery_street, delivery_area,
        expected_delivery_time, customer_notes, driver_notes,
        picked_up_at, arrived_at, delivered_at,
        total_bhd, assigned_driver_id, created_at, updated_at,
        source, whatsapp_sent_at, coupon_id, coupon_discount_bhd,
        order_items(name_ar, name_en, quantity, selected_size, selected_variant),
        payments(method)
      `)
      .eq('status', 'delivered')
      .eq('assigned_driver_id', driverId)
      .gte('updated_at', todayStart.toISOString())
      .order('updated_at', { ascending: false })

    if (data) setCompletedOrders(data as DriverOrder[])
  }, [supabase, driverId])

  useEffect(() => { fetchOrders(); fetchCompleted() }, [fetchOrders, fetchCompleted])

  // Auto-refresh every 15 s
  useEffect(() => {
    const id = setInterval(() => { fetchOrders(); fetchCompleted() }, 15_000)
    return () => clearInterval(id)
  }, [fetchOrders, fetchCompleted])

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('driver-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders()
        fetchCompleted()
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [supabase, fetchOrders, fetchCompleted])

  // GPS — auto-starts when online
  useEffect(() => {
    if (!isOnline || !('geolocation' in navigator)) return

    const activeOrder = orders.find((o) => o.status === 'out_for_delivery')
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        postDriverLocation({
          driver_id:  driverId,
          order_id:   activeOrder?.id ?? null,
          lat:        pos.coords.latitude,
          lng:        pos.coords.longitude,
          accuracy_m: pos.coords.accuracy ?? null,
        })
      },
      () => { /* silent — no GPS error banner needed */ },
      { enableHighAccuracy: true, maximumAge: 30_000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [isOnline, driverId, orders])

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setClock(formatClock()), 1_000)
    return () => clearInterval(id)
  }, [])

  async function handleAvailabilityToggle() {
    setIsOnline((v) => !v) // optimistic
    const result = await toggleDriverAvailability()
    if (!result.success) setIsOnline((v) => !v) // revert on DB error
  }

  async function handleAction(orderId: string, currentStatus: 'ready' | 'out_for_delivery') {
    setOrders((prev) => prev.filter((o) => o.id !== orderId))
    const result = await driverBumpOrder(orderId, currentStatus)
    if (!result.success) fetchOrders()
  }

  const activeOrders    = orders.filter((o) => o.status === 'out_for_delivery')
  const availableOrders = orders.filter((o) => o.status === 'ready')
  const totalRevenue    = completedOrders.reduce((s, o) => s + Number(o.total_bhd), 0)

  const avgDeliveryMins = completedOrders.length > 0
    ? Math.round(
        completedOrders.reduce((sum, o) => {
          const mins = (new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()) / 60_000
          return sum + Math.max(0, mins)
        }, 0) / completedOrders.length
      )
    : 0

  const onTimeRate = completedOrders.length > 0
    ? Math.round(
        completedOrders.filter((o) => {
          const ms = new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()
          return ms <= 45 * 60_000
        }).length / completedOrders.length * 100
      )
    : 0

  return (
    <div className="flex flex-col h-full bg-brand-black" dir={isAr ? 'rtl' : 'ltr'}>
      <DriverHeader
        isOnline={isOnline}
        onToggle={handleAvailabilityToggle}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        completedToday={completedOrders.length}
        totalRevenue={totalRevenue}
        avgDeliveryMins={avgDeliveryMins}
        isRTL={isAr}
        clock={clock}
      />

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 pb-10 flex flex-col gap-6">

          {/* Performance stats — only when deliveries exist */}
          <DriverPerformanceDashboard
            completedToday={completedOrders.length}
            totalRevenueBD={totalRevenue}
            avgDeliveryMins={avgDeliveryMins}
            onTimeRate={onTimeRate}
            isRTL={isAr}
          />

          {/* Cash collection summary */}
          <DriverCashSummary orders={orders} isRTL={isAr} />

          {/* Active deliveries */}
          {activeOrders.length > 0 && (
            <section>
              <SectionLabel
                title={isAr ? 'جاري التوصيل' : 'Active Deliveries'}
                count={activeOrders.length}
                color="text-brand-success"
                dotColor="bg-brand-success"
                pulse
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mt-3">
                {sortByUrgency(activeOrders).map((order) => (
                  <DriverOrderCard
                    key={order.id}
                    order={order}
                    isRTL={isAr}
                    branchMapsUrl={branchMapsUrl}
                    onAction={handleAction}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Available for pickup */}
          <section>
            <SectionLabel
              title={isAr ? 'جاهزة للاستلام' : 'Ready for Pickup'}
              count={availableOrders.length}
              color="text-brand-gold"
              dotColor="bg-brand-gold"
              pulse={false}
            />
            {availableOrders.length === 0 ? (
              <div className="mt-3 flex items-center justify-center py-10 rounded-xl border border-brand-border bg-brand-surface">
                <p className="font-satoshi text-sm text-brand-muted/40">
                  {isAr ? 'لا توجد طلبات جاهزة' : 'No orders ready for pickup'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mt-3">
                {sortByUrgency(availableOrders).map((order) => (
                  <DriverOrderCard
                    key={order.id}
                    order={order}
                    isRTL={isAr}
                    branchMapsUrl={branchMapsUrl}
                    onAction={handleAction}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Completed today */}
          <section>
            <div className="flex items-center justify-between gap-3">
              <SectionLabel
                title={isAr ? 'مُسلَّمة اليوم' : 'Completed Today'}
                count={completedOrders.length}
                color="text-brand-muted"
                dotColor="bg-brand-muted"
                pulse={false}
              />
              {completedOrders.some(o => o.payments?.[0]?.method === 'cash') && (
                <button
                  type="button"
                  onClick={() => setShowHandover(true)}
                  className="shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-1.5 bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 transition-colors duration-150"
                >
                  <span className="text-sm leading-none">💵</span>
                  <span className={`font-bold text-xs ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    {isAr ? 'تسليم النقد' : 'Cash Handover'}
                  </span>
                </button>
              )}
            </div>
            {completedOrders.length === 0 ? (
              <div className="mt-3 flex items-center justify-center py-8 rounded-xl border border-brand-border bg-brand-surface">
                <p className="font-satoshi text-sm text-brand-muted/40">
                  {isAr ? 'لم يتم تسليم أي طلبات بعد اليوم' : 'No deliveries completed yet today'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mt-3">
                {completedOrders.map((order) => (
                  <DriverOrderCard
                    key={order.id}
                    order={order}
                    isRTL={isAr}
                    branchMapsUrl={null}
                    variant="completed"
                  />
                ))}
              </div>
            )}
          </section>

          {/* Full empty state */}
          {orders.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
              <div className="w-16 h-16 rounded-xl bg-brand-surface-2 border border-brand-border flex items-center justify-center">
                <TruckIcon />
              </div>
              <p className="font-satoshi font-bold text-xl text-brand-muted">
                {isAr ? 'لا توجد طلبات نشطة' : 'All clear'}
              </p>
              <p className="font-satoshi text-sm text-brand-muted/50 text-center max-w-xs">
                {isAr ? 'الطلبات الجاهزة ستظهر هنا تلقائياً' : 'Ready orders will appear here automatically'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Cash handover modal */}
      {showHandover && (
        <CashHandoverModal
          deliveredOrders={completedOrders}
          isRTL={isAr}
          onClose={() => setShowHandover(false)}
          onConfirmed={() => setShowHandover(false)}
        />
      )}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const URGENCY_RANK: Record<string, number> = { critical: 0, urgent: 1, normal: 2 }

function sortByUrgency(orders: DriverOrder[]): DriverOrder[] {
  return [...orders].sort((a, b) => {
    const ra = URGENCY_RANK[getUrgencyLevel(resolveExpectedAt(a.created_at, a.expected_delivery_time))]
    const rb = URGENCY_RANK[getUrgencyLevel(resolveExpectedAt(b.created_at, b.expected_delivery_time))]
    if (ra !== rb) return ra - rb
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ title, count, color, dotColor, pulse }: {
  title: string; count: number; color: string; dotColor: string; pulse: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor} ${pulse && count > 0 ? 'animate-pulse' : ''}`} />
      <h2 className={`font-satoshi font-black text-xs uppercase tracking-wider ${color}`}>{title}</h2>
      {count > 0 && (
        <span className={`ms-auto font-satoshi font-black text-xs tabular-nums rounded-full w-6 h-6 flex items-center justify-center ${color} border border-current/30`}>
          {count}
        </span>
      )}
    </div>
  )
}

function TruckIcon() {
  return (
    <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-brand-muted" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
  )
}
