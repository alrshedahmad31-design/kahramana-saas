'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { driverBumpOrder, markDriverArrived, postDriverLocation, toggleDriverAvailability } from '@/app/[locale]/driver/actions'
import { savePendingAction, getPendingActions, deletePendingAction } from '@/lib/utils/offline-db'
import { useAudioAlert } from '@/hooks/useAudioAlert'
import { playBell } from '@/lib/audio/bells'
import DriverHeader from './DriverHeader'
import DriverOrderCard from './DriverOrderCard'
import DriverPerformanceDashboard from './DriverPerformanceDashboard'
import DriverCashSummary from './DriverCashSummary'
import CashHandoverModal from './CashHandoverModal'
import CashHandoverReminderBanner from './CashHandoverReminderBanner'
import { resolveExpectedAt, getUrgencyLevel } from '@/lib/utils/delivery'
import { toast } from '@/lib/toast'
import type { DriverOrder } from '@/lib/supabase/custom-types'
import { Icon } from '@/components/ui/Icon'

interface Props {
  initialOrders:          DriverOrder[]
  initialCompletedOrders: DriverOrder[]
  branchId:               string | null
  branchMapsUrl:          string | null
  driverId:               string
  locale:                 string
  completedCount:         number
  initialIsOnline:        boolean
  initialHoursToday:      number
}

type DriverRealtimePayload = {
  new: Partial<Pick<DriverOrder, 'order_type'>>
  old: Partial<Pick<DriverOrder, 'order_type'>>
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
  initialOrders, initialCompletedOrders, branchId, branchMapsUrl, driverId, locale, completedCount: _completedCount, initialIsOnline, initialHoursToday,
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
  const [clock,              setClock]              = useState(formatClock)
  const [showHandover,       setShowHandover]       = useState(false)
  const [reminderDismissed,  setReminderDismissed]  = useState(false)
  
  // Screen Wake Lock control: keep screen on if there is any active delivery
  const hasActiveOrder = useMemo(() =>
    orders.some(o => o.status === 'out_for_delivery' || o.status === 'arrived'),
    [orders]
  )
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('driver:wake-lock', { 
        detail: { active: hasActiveOrder } 
      }))
    }
  }, [hasActiveOrder])

  const [userLocation,    setUserLocation]    = useState<{ lat: number, lng: number } | null>(null)
  const [gpsStatus,       setGpsStatus]       = useState<'idle' | 'tracking' | 'error' | 'denied'>('idle')
  const [gpsError,        setGpsError]        = useState<string | null>(null)
  const [pendingSync,     setPendingSync]     = useState<number>(0)
  const lastGpsUpdateRef = useRef<number>(0)
  const lastStateUpdateRef = useRef<number>(0)

  const supabase = useMemo(() => createClient(), [])

  const fetchOrders = useCallback(async () => {
    let q = supabase
      .from('orders')
      .select(`
        id, customer_name, customer_phone, branch_id, status, order_type,
        notes, delivery_address, delivery_lat, delivery_lng, delivery_instructions,
        delivery_building, delivery_street, delivery_area,
        expected_delivery_time, customer_notes, driver_notes,
        picked_up_at, arrived_at, delivered_at,
        total_bhd, assigned_driver_id, created_at, updated_at,
        source, whatsapp_sent_at,
        order_items(name_ar, name_en, quantity, selected_size, selected_variant, notes),
        payments(method)
      `)
      .eq('order_type', 'delivery')
      .in('status', ['ready', 'out_for_delivery', 'arrived'])
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
  }, [supabase, branchId, mutedRef])

  const fetchCompleted = useCallback(async () => {
    if (!driverId) return
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data } = await supabase
      .from('orders')
      .select(`
        id, customer_name, customer_phone, branch_id, status, order_type,
        notes, delivery_address, delivery_lat, delivery_lng, delivery_instructions,
        delivery_building, delivery_street, delivery_area,
        expected_delivery_time, customer_notes, driver_notes,
        picked_up_at, arrived_at, delivered_at,
        total_bhd, assigned_driver_id, created_at, updated_at,
        source, whatsapp_sent_at,
        cash_settled_at, cash_settlement_id, tip_bhd,
        order_items(name_ar, name_en, quantity, selected_size, selected_variant),
        payments(method)
      `)
      .eq('order_type', 'delivery')
      .eq('status', 'delivered')
      .eq('assigned_driver_id', driverId)
      .gte('updated_at', todayStart.toISOString())
      .order('updated_at', { ascending: false })

    if (data) setCompletedOrders(data as unknown as DriverOrder[])
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
      // PII guard — do not read customer fields from realtime payload. Handler refetches via server.
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: branchId ? `branch_id=eq.${branchId}` : undefined
      }, (payload: DriverRealtimePayload) => {
        // Audit fix: Ignore realtime events for non-delivery orders (dine-in, pickup)
        // For DELETE events, payload.new may be empty and payload.old may lack order_type
        // depending on Replica Identity settings — only skip if we positively know it's NOT delivery.
        const record = payload.new && Object.keys(payload.new).length > 0 ? payload.new : payload.old
        if (record?.order_type && record.order_type !== 'delivery') return
        
        fetchOrders()
        fetchCompleted()
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [supabase, branchId, fetchOrders, fetchCompleted])

  // GPS — track while the driver has an active delivery in transit OR at the
  // customer. Pre-119 this gate only matched 'out_for_delivery', which cut off
  // location sharing the moment markDriverArrived flipped status — leaving the
  // delivery dashboard map blank during the final-handoff window.
  useEffect(() => {
    if (!isOnline || !('geolocation' in navigator)) {
      setGpsStatus('idle')
      return
    }

    const activeOrder = orders.find(
      (o) => o.status === 'out_for_delivery' || o.status === 'arrived',
    )
    if (!activeOrder) {
      setGpsStatus('idle')
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        const now = Date.now()

        // Audit fix: Throttle state updates (re-renders) to every 5 seconds
        if (now - lastStateUpdateRef.current >= 5_000) {
          lastStateUpdateRef.current = now
          setUserLocation({ lat: latitude, lng: longitude })
          setGpsStatus('tracking')
          setGpsError(null)
        }

        if (now - lastGpsUpdateRef.current >= 15_000) {
          lastGpsUpdateRef.current = now
          // Log failures so we can see when the push silently rejects (auth,
          // status mismatch, branch mismatch). Was previously fire-and-forget
          // with no visibility — a key reason the empty driver_locations table
          // went undiagnosed.
          postDriverLocation({
            driver_id:  driverId,
            order_id:   activeOrder.id,
            lat:        latitude,
            lng:        longitude,
            accuracy_m: pos.coords.accuracy ?? null,
          }).then((res) => {
            if (!res.success) {
              console.warn('[driver-gps] postDriverLocation rejected:', res.error)
            }
          }).catch((err: unknown) => {
            console.warn('[driver-gps] postDriverLocation threw:', err)
          })
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsStatus('denied')
          setGpsError(isAr ? 'تم رفض الوصول للموقع. يرجى تفعيل الـ GPS لتتمكن من مشاركة موقعك.' : 'Location access denied. Please enable GPS to share your position.')
        } else {
          setGpsStatus('error')
          setGpsError(err.message)
          console.warn('GPS error:', err.message)
        }
      },
      { enableHighAccuracy: true, maximumAge: 30_000 },
    )
    return () => {
      navigator.geolocation.clearWatch(watchId)
      setGpsStatus('idle')
    }
  }, [isOnline, driverId, orders, isAr])

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setClock(formatClock()), 1_000)
    return () => clearInterval(id)
  }, [])

  // Offline Sync Logic
  const syncPendingActions = useCallback(async () => {
    try {
      const actions = await getPendingActions()
      if (actions.length === 0) {
        setPendingSync(0)
        return
      }

      setPendingSync(actions.length)

      for (const action of actions) {
        try {
          const metadata = action.metadata as { tipBhd?: number, actualCollected?: number } | null
          const cs = action.currentStatus
          if (cs !== 'ready' && cs !== 'out_for_delivery' && cs !== 'arrived') {
            // Unknown queued status — discard so it doesn't retry forever
            if (action.id) await deletePendingAction(action.id)
            continue
          }
          const res = await driverBumpOrder(action.orderId, cs, metadata?.tipBhd, metadata?.actualCollected)
          if (res.success) {
            if (action.id) await deletePendingAction(action.id)
          }
        } catch {
          // Still offline or transient error, keep it for next try
        }
      }

      // Refresh counts
      const remaining = await getPendingActions()
      setPendingSync(remaining.length)
      
      if (remaining.length < actions.length) {
        fetchOrders()
        fetchCompleted()
      }
    } catch (e) {
      console.error('Sync error:', e)
    }
  }, [fetchOrders, fetchCompleted])

  useEffect(() => {
    window.addEventListener('online', syncPendingActions)
    // Initial check
    syncPendingActions()
    return () => window.removeEventListener('online', syncPendingActions)
  }, [syncPendingActions])

  async function handleAvailabilityToggle() {
    setIsOnline((v) => !v) // optimistic
    const result = await toggleDriverAvailability()
    if (!result.success) setIsOnline((v) => !v) // revert on DB error
  }

  async function handleAction(orderId: string, currentStatus: 'ready' | 'out_for_delivery' | 'arrived', metadata?: { tipBhd?: number, actualCollected?: number }): Promise<string | null> {
    const nextStatus = currentStatus === 'ready' ? 'out_for_delivery' : 'delivered'
    const now = new Date().toISOString()

    // Server-first: call before any local state mutation so failures stay
    // visible. Optimistic delete used to unmount the DriverOrderCard before
    // setActionError fired, swallowing the server's reason silently.
    let result
    try {
      result = await driverBumpOrder(orderId, currentStatus, metadata?.tipBhd, metadata?.actualCollected)
    } catch (_err) {
      // Network failure → queue for offline sync. UI stays unchanged so the
      // order is still visible and the driver can retry once online.
      try {
        await savePendingAction({ orderId, currentStatus, metadata: metadata as Record<string, unknown> | null })
        const remaining = await getPendingActions()
        setPendingSync(remaining.length)
      } catch (dbErr) {
        console.error('Failed to save to IndexedDB:', dbErr)
      }
      const offlineMsg = isAr
        ? 'أنت غير متصل بالإنترنت. سيتم مزامنة العملية تلقائياً عند عودة الاتصال.'
        : 'You are offline. Action will sync automatically when connection returns.'
      toast.error(offlineMsg)
      return offlineMsg
    }

    if (!result.success) {
      // Server rejected the transition (status race, missing arrival, branch
      // mismatch, etc.). Show a toast since the calling card may unmount on
      // refetch and would otherwise drop setActionError silently.
      const errMsg = result.error ?? (isAr ? 'تعذّر تنفيذ العملية' : 'Action failed')
      toast.error(errMsg)
      fetchOrders()
      fetchCompleted()
      return errMsg
    }

    // Only after the server confirms — move the order out of the active list
    // and into completed. Picked-up transitions just flip the status in place.
    if (nextStatus === 'delivered') {
      const movedOrder = orders.find((o) => o.id === orderId)
      setOrders((prev) => prev.filter((o) => o.id !== orderId))
      if (movedOrder) {
        setCompletedOrders((prev) => [
          { ...movedOrder, status: 'delivered', delivered_at: now, updated_at: now },
          ...prev,
        ])
      }
    } else {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, status: nextStatus, assigned_driver_id: driverId, picked_up_at: now, updated_at: now }
            : o,
        ),
      )
    }

    return null
  }

  async function handleArrive(orderId: string): Promise<string | null> {
    setOrders((prev) => prev.map((o) =>
      o.id === orderId ? { ...o, arrived_at: new Date().toISOString() } : o
    ))
    const result = await markDriverArrived(orderId)
    if (!result.success) {
      fetchOrders()
      return result.error
    }
    return null
  }

  const activeOrders    = orders.filter((o) => o.status === 'out_for_delivery' || o.status === 'arrived')
  const availableOrders = orders.filter((o) => o.status === 'ready')
  const totalRevenue    = completedOrders.reduce((s, o) => s + Number(o.total_bhd), 0)

  // Cash orders that haven't been included in any handover yet (uses migration 037 column)
  const unsettledCashOrders = completedOrders.filter(
    o => o.payments?.method === 'cash' && !o.cash_settled_at,
  )
  // True when at least one cash order is already settled (partial scenario)
  const hasSettledCash = completedOrders.some(
    o => o.payments?.method === 'cash' && o.cash_settled_at,
  )
  const unsettledTotal       = unsettledCashOrders.reduce((s, o) => s + Number(o.total_bhd), 0)
  const shouldRemindHandover = !reminderDismissed && (
    unsettledCashOrders.length >= 4 ||
    (!isOnline && unsettledCashOrders.length > 0)
  )

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
        hoursToday={initialHoursToday}
        isRTL={isAr}
        clock={clock}
      />

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 pb-10 flex flex-col gap-6">

          {/* Cash handover reminder banner */}
          {shouldRemindHandover && (
            <CashHandoverReminderBanner
              unsettledCount={unsettledCashOrders.length}
              unsettledTotal={unsettledTotal}
              onOpenHandover={() => setShowHandover(true)}
              onDismiss={() => setReminderDismissed(true)}
              isRTL={isAr}
            />
          )}
          
          {/* Offline Sync Banner */}
          {pendingSync > 0 && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-brand-gold/10 border border-brand-gold/30 animate-pulse">
              <div className="flex items-center gap-3">
                <Icon name="refresh" size={20} className="text-brand-gold" />
                <div>
                  <p className={`font-bold text-sm text-brand-gold ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    {isAr ? `جاري مزامنة ${pendingSync} عمليات...` : `Syncing ${pendingSync} actions...`}
                  </p>
                  <p className="text-[10px] text-brand-gold/70">
                    {isAr ? 'سيتم الحفظ تلقائياً عند استقرار الإنترنت' : 'Saving automatically when internet returns'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* GPS Tracking Indicator */}
          {gpsStatus !== 'idle' && (
            <div className={`flex items-center justify-between p-3 rounded-xl border transition-colors duration-300 ${
              gpsStatus === 'tracking' 
                ? 'bg-brand-success/10 border-brand-success/30' 
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${
                  gpsStatus === 'tracking' ? 'bg-brand-success animate-pulse' : 'bg-red-500'
                }`} />
                <div>
                  <p className={`font-bold text-sm ${
                    gpsStatus === 'tracking' ? 'text-brand-success' : 'text-red-400'
                  } ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    {gpsStatus === 'tracking' 
                      ? (isAr ? 'موقعك يُشارك' : 'Sharing location')
                      : (isAr ? 'الموقع متوقف' : 'Location sharing stopped')
                    }
                  </p>
                  {gpsError && (
                    <p className="text-[10px] text-red-400/80 mt-0.5">
                      {gpsError}
                    </p>
                  )}
                </div>
              </div>
              {gpsStatus === 'tracking' && (
                <span className="text-xs font-medium text-brand-success/50 tabular-nums">
                  {isAr ? 'كل ١٥ ثانية' : 'Every 15s'}
                </span>
              )}
            </div>
          )}

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
                    onArrive={handleArrive}
                    driverLocation={userLocation}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Available for pickup */}
          <section>
            <SectionLabel
              title={isAr ? 'طلبات متاحة للاستلام' : 'Orders Available for Pickup'}
              count={availableOrders.length}
              color="text-brand-gold"
              dotColor="bg-brand-gold"
              pulse={availableOrders.length > 0}
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
                    driverLocation={userLocation}
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
              {unsettledCashOrders.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHandover(true)}
                  className="shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-1.5 bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 transition-colors duration-150"
                >
                  <Icon name="cash" size={14} />
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
          cashOrders={unsettledCashOrders}
          isPartial={hasSettledCash}
          isRTL={isAr}
          onClose={() => setShowHandover(false)}
          onConfirmed={() => { setShowHandover(false); fetchCompleted() }}
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
