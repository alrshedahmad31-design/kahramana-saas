'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { KDSOrder, KDSStation, KDSItemStatus } from '@/lib/supabase/custom-types'
import { getStationConfig } from '@/constants/kds'
import KDSStationOrderCard from './KDSStationOrderCard'
import KDSDialog from './KDSDialog'
import {
  fetchStationOrders,
  updateItemStatus,
  bumpStationOrder,
  recallStationOrder,
  getStationDailyCount,
} from '@/app/[locale]/dashboard/kds/actions'

interface Props {
  initialActive: KDSOrder[]
  initialStalled: KDSOrder[]
  station:        KDSStation
  branchId:       string | null
  locale:         string
  loadError?:     string
  initialNow:     number
}

function playTripleBeep() {
  try {
    const ctx = new AudioContext()
    ;[0, 0.18, 0.36].forEach((delay) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      osc.type = 'sine'
      gain.gain.setValueAtTime(0, ctx.currentTime + delay)
      gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + delay + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.28)
      osc.start(ctx.currentTime + delay)
      osc.stop(ctx.currentTime + delay + 0.3)
    })
  } catch { /* AudioContext blocked — silent fail */ }
}

function playBumpTone() {
  try {
    const ctx  = new AudioContext()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 523
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    osc.start()
    osc.stop(ctx.currentTime + 0.5)
  } catch {}
}

export default function KDSStationBoard({
  initialActive,
  initialStalled,
  station,
  branchId,
  locale,
  loadError,
  initialNow,
}: Props) {
  const [activeOrders, setActiveOrders]   = useState<KDSOrder[]>(initialActive)
  const [stalledOrders, setStalledOrders] = useState<KDSOrder[]>(initialStalled)
  const [refreshError, setRefreshError] = useState<string | null>(loadError ?? null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [dailyCount, setDailyCount]     = useState(0)
  const [recentBump, setRecentBump]     = useState<{ id: string; timestamp: number } | null>(null)
  const [isRecalling, setIsRecalling]   = useState(false)
  const [now, setNow]                   = useState(initialNow)
  const [isSyncing, setIsSyncing]       = useState(false)
  const [isConnected, setIsConnected]   = useState(true)
  const [dialogConfig, setDialogConfig] = useState<{
    title: string;
    message: string;
  } | null>(null)

  const t             = useTranslations('kds')
  const router        = useRouter()
  const isAr          = locale === 'ar'
  const stationConfig = getStationConfig(station)
  const isFetching    = useRef(false)
  const soundRef      = useRef(soundEnabled)
  useEffect(() => { soundRef.current = soundEnabled }, [soundEnabled])

  const refresh = useCallback(async () => {
    setIsSyncing(true)
    try {
      const result = await fetchStationOrders(station)
      if ('active' in result) {
        setActiveOrders(result.active)
        setStalledOrders(result.stalled)
        setRefreshError(null)
      } else {
        setRefreshError(result.error)
      }
    } catch {
      setRefreshError('Network error')
    } finally {
      setIsSyncing(false)
      isFetching.current = false
    }
  }, [station])

  const handleStatusChange = useCallback(async (
    orderId: string, itemId: string, station: KDSStation, status: KDSItemStatus, expected?: KDSItemStatus
  ) => {
    console.log(`[KDS] Changing status: order=${orderId} item=${itemId} to ${status}`);
    const result = await updateItemStatus(orderId, itemId, station, status, expected)
    if (!result.success) {
      console.error('[KDS] Status update failed:', result.error);
      setDialogConfig({
        title: 'تعذّر تحديث الحالة',
        message: result.error || 'حدث خطأ غير متوقع أثناء تحديث حالة الصنف.'
      });
    }
  }, [station])

  const handleBump = useCallback(async (orderId: string) => {
    console.log(`[KDS] Bumping order: ${orderId} at station: ${station}`);
    const result = await bumpStationOrder(orderId, station)
    if (result.success) {
      console.log(`[KDS] Bump successful for order: ${orderId}`);
      setActiveOrders(prev => prev.filter(o => o.id !== orderId))
      setStalledOrders(prev => prev.filter(o => o.id !== orderId))
      setRecentBump({ id: orderId, timestamp: Date.now() })
      setDailyCount(prev => prev + 1)
      if (soundRef.current) playBumpTone()
    } else {
      console.error('[KDS] Bump failed:', result.error);
      setDialogConfig({
        title: 'تعذّر إنهاء الطلب',
        message: result.error || 'حدث خطأ أثناء محاولة إنهاء الطلب.'
      });
    }
  }, [station])

  const handleRecall = useCallback(async () => {
    if (!recentBump || isRecalling) return
    setIsRecalling(true)
    try {
      const result = await recallStationOrder(recentBump.id, station)
      if (result.success) {
        setRecentBump(null)
        setDailyCount(prev => Math.max(0, prev - 1))
        await refresh()
      }
    } finally {
      setIsRecalling(false)
    }
  }, [recentBump, station, refresh, isRecalling])

  // Initial fetch for daily count
  useEffect(() => {
    if (!branchId) return
    getStationDailyCount(station, branchId).then(res => {
      if ('count' in res) setDailyCount(res.count)
    })
  }, [station, branchId])

  // Clear recall toast after 60s
  useEffect(() => {
    if (!recentBump) return
    const id = setTimeout(() => setRecentBump(null), 60000)
    return () => clearTimeout(id)
  }, [recentBump])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const channel  = supabase.channel(`kds-board-${station}-${branchId ?? 'all'}`)

    // FIX 4: scope realtime to this branch when the viewer is branch-bound.
    // Supabase realtime filters use comma-separated `column=eq.value` clauses
    // and only support direct columns — branch_id is denormalised onto
    // order_item_station_status by migration 089 to make this possible.
    const oissFilter = branchId
      ? `station=eq.${station},branch_id=eq.${branchId}`
      : `station=eq.${station}`

    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'order_item_station_status', filter: oissFilter },
      (payload) => {
        const row = payload.new as { item_id: string; status: KDSItemStatus } | null
        if (!row?.item_id) return
        if (row.status === 'completed') {
          const remover = (prev: KDSOrder[]) => prev
            .map(order => ({
              ...order,
              order_items: order.order_items.filter(item => item.id !== row.item_id),
            }))
            .filter(order => order.order_items.length > 0)
          
          setActiveOrders(remover)
          setStalledOrders(remover)
        } else {
          const updater = (prev: KDSOrder[]) => prev.map(order => ({
            ...order,
            order_items: order.order_items.map(item =>
              item.id === row.item_id ? { ...item, station_status: row.status } : item
            ),
          }))
          setActiveOrders(updater)
          setStalledOrders(updater)
        }
      }
    )

    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'order_item_station_status', filter: oissFilter },
      () => {
        if (soundRef.current) playTripleBeep()
        refresh()
      }
    )

    channel.on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'order_item_station_status', filter: oissFilter },
      (payload) => {
        const old = payload.old as { item_id?: string } | null
        if (!old?.item_id) { refresh(); return }
        const itemId = old.item_id
        const remover = (prev: KDSOrder[]) => prev
          .map(order => ({
            ...order,
            order_items: order.order_items.filter(item => item.id !== itemId),
          }))
          .filter(order => order.order_items.length > 0)
        
        setActiveOrders(remover)
        setStalledOrders(remover)
      }
    )

    const ordersFilter = branchId ? `branch_id=eq.${branchId}` : undefined
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', ...(ordersFilter ? { filter: ordersFilter } : {}) },
      () => { refresh() }
    )

    channel.subscribe((status) => {
      setIsConnected(status === 'SUBSCRIBED')
    })
    return () => { supabase.removeChannel(channel) }
  }, [station, branchId, refresh])

  // FIX 8: while realtime is disconnected, fall back to polling so the board
  // does not silently freeze. 15s matches the longest gap a kitchen will
  // tolerate before a missing ticket becomes a problem.
  useEffect(() => {
    if (isConnected) return
    const interval = setInterval(() => { refresh() }, 15000)
    return () => clearInterval(interval)
  }, [isConnected, refresh])

  const sortedActive = useMemo(() => {
    return [...activeOrders].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
  }, [activeOrders])

  const sortedStalled = useMemo(() => {
    return [...stalledOrders].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
  }, [stalledOrders])

  return (
    <div className="flex flex-col h-screen bg-brand-black overflow-hidden" dir={isAr ? 'rtl' : 'ltr'}>
      <header
        className="shrink-0 h-20 flex items-center justify-between px-6 border-b border-border"
        style={{ borderBottomColor: `${stationConfig.color}50` }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`/${locale}/dashboard/kds`)}
            className="p-2 hover:bg-surface2 rounded-lg transition-colors"
            aria-label={isAr ? 'رجوع' : 'Back'}
          >
            <BackIcon className={`w-6 h-6 text-muted ${isAr ? 'rotate-180' : ''}`} />
          </button>
          <div className="flex items-center gap-3">
            <span className="text-3xl leading-none">{stationConfig.icon}</span>
            <h1 className="text-2xl font-black font-ar-heading tracking-tight">
              {isAr ? stationConfig.label.ar : stationConfig.label.en}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface2 border border-border">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success' : 'bg-error animate-pulse'}`} />
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
              {isConnected ? (isAr ? 'متصل' : 'LIVE') : (isAr ? 'منقطع' : 'OFFLINE')}
            </span>
          </div>

          <button
            onClick={() => refresh()}
            disabled={isSyncing}
            className={`p-2 hover:bg-surface2 rounded-lg transition-all ${isSyncing ? 'animate-spin text-gold' : 'text-muted hover:text-gold'}`}
            title={isAr ? 'تحديث' : 'Sync'}
          >
            <RefreshIcon className="w-5 h-5" />
          </button>
          {dailyCount > 0 && (
            <div className="flex flex-col items-center min-w-[48px]">
              <div className="text-[10px] text-muted uppercase tracking-widest leading-none mb-1">
                {t('allDayLabel')}
              </div>
              <div className="text-xl font-black tabular-nums text-success">{dailyCount}</div>
            </div>
          )}

          <button
            onClick={() => setSoundEnabled(v => !v)}
            className="p-2 hover:bg-surface2 rounded-lg transition-colors"
            aria-label={soundEnabled ? t('soundOn') : t('soundOff')}
          >
            {soundEnabled
              ? <SoundOnIcon className="w-5 h-5 text-muted" />
              : <SoundOffIcon className="w-5 h-5 text-error" />}
          </button>

          <div className="w-px h-10 bg-border" />

          <div className="flex flex-col items-center min-w-[48px]">
            <div className="text-[10px] text-muted uppercase tracking-widest leading-none mb-1">
              {t('activeOrders')}
            </div>
            <div className="text-2xl font-black tabular-nums" style={{ color: stationConfig.color }}>
              {activeOrders.length}
            </div>
          </div>

          <div className="w-px h-10 bg-border" />
          <Clock locale={locale} now={now} />
        </div>
      </header>

      <AnimatePresence>
        {refreshError && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="shrink-0 overflow-hidden"
          >
            <div className="bg-error/10 border-b border-error/30 px-6 py-2 flex items-center gap-3 text-error text-sm">
              <WarningIcon className="w-4 h-4 shrink-0" />
              <span>{t('refreshError')}</span>
              <button
                onClick={refresh}
                className="ms-auto text-xs underline underline-offset-2 hover:no-underline"
              >
                {t('retry')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        <div className="flex h-full gap-4 items-start">
          <AnimatePresence mode="popLayout">
            {sortedActive.map((order) => (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, x: isAr ? -60 : 60 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="w-72 shrink-0 max-h-full overflow-y-auto"
                style={{ scrollbarWidth: 'thin' } as React.CSSProperties}
              >
                <KDSStationOrderCard
                  order={order}
                  station={station}
                  locale={locale}
                  onBump={handleBump}
                  now={now}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {sortedStalled.length > 0 && (
            <div className="flex gap-4 items-start">
              <div className="w-px self-stretch bg-border mx-2" />
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 px-3 py-1 bg-surface2 rounded text-xs font-bold text-muted uppercase tracking-widest">
                  <WarningIcon className="w-3 h-3" />
                  {isAr ? 'طلبات متوقفة (>3 ساعات)' : 'Stalled Orders (>3h)'}
                </div>
                <div className="flex gap-4">
                  {sortedStalled.map((order) => (
                    <div key={order.id} className="w-72 shrink-0 max-h-full overflow-y-auto opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all">
                      <KDSStationOrderCard
                        order={order}
                        station={station}
                        locale={locale}
                        onBump={handleBump}
                        now={now}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeOrders.length === 0 && stalledOrders.length === 0 && !refreshError && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-20 select-none">
              <span className="text-8xl leading-none">{stationConfig.icon}</span>
              <p className="text-2xl font-bold">{t('noOrders')}</p>
            </div>
          )}
        </div>
      </main>

      <footer className="shrink-0 h-10 bg-surface2 border-t border-border flex items-center px-6 gap-2 text-xs text-muted font-medium">
        <span className={`w-2 h-2 rounded-full shrink-0 ${refreshError ? 'bg-error' : 'bg-success animate-pulse'}`} />
        <span>
          {refreshError
            ? (isAr ? 'غير متصل' : 'Disconnected')
            : (isAr ? 'متصل — يتحدث تلقائياً' : 'Live — auto-updating')}
        </span>
        {dailyCount > 0 && (
          <span className="ms-auto">
            {isAr ? `أُنجز اليوم: ${dailyCount}` : `Bumped today: ${dailyCount}`}
          </span>
        )}
      </footer>

      {/* Feature 1: Recall Toast */}
      <AnimatePresence>
        {recentBump && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-brand-gold text-brand-black px-6 py-4 rounded-2xl shadow-2xl"
          >
            <div className="flex flex-col">
              <span className="font-black text-sm uppercase tracking-tight">
                {isAr ? 'تم إنهاء الطلب' : 'Order Bumped'}
              </span>
              <span className="text-xs opacity-80 font-bold">#{recentBump.id.slice(-4).toUpperCase()}</span>
            </div>
            
            <button
              onClick={handleRecall}
              disabled={isRecalling}
              className="flex items-center gap-2 bg-brand-black/10 hover:bg-brand-black/20 px-4 py-2 rounded-xl border border-brand-black/20 font-black transition-all active:scale-95 disabled:opacity-50"
            >
              <RecallIcon className="w-5 h-5" />
              {isAr ? 'استعادة' : 'RECALL'}
            </button>

            {/* Countdown progress ring/bar would go here, using a simpler timed line for now */}
            <div className="absolute bottom-0 left-0 h-1 bg-brand-black/30 rounded-full overflow-hidden" style={{ width: '100%' }}>
               <motion.div 
                 initial={{ width: '100%' }}
                 animate={{ width: '0%' }}
                 transition={{ duration: 60, ease: 'linear' }}
                 className="h-full bg-brand-black"
               />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Branded Dialogs */}
      <KDSDialog
        isOpen={!!dialogConfig}
        title={dialogConfig?.title || ''}
        message={dialogConfig?.message || ''}
        onConfirm={() => setDialogConfig(null)}
      />
    </div>
  )
}

function Clock({ locale, now }: { locale: string; now: number }) {
  const time = new Date(now)
  return (
    <div 
      className="font-black text-2xl tabular-nums text-white min-w-[90px] text-center"
      suppressHydrationWarning
    >
      {time.toLocaleTimeString(locale === 'ar' ? 'ar-BH' : 'en-US', {
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
      })}
    </div>
  )
}

function BackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  )
}

function RecallIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
    </svg>
  )
}

function SoundOnIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5L6 9H2v6h4l5 4V5z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072" />
    </svg>
  )
}

function SoundOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
    </svg>
  )
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  )
}
function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}
