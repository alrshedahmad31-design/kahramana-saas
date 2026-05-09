'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { KDSOrder, KDSStation, KDSItemStatus } from '@/lib/supabase/custom-types'
import { getStationConfig } from '@/constants/kds'
import KDSStationOrderCard from './KDSStationOrderCard'
import {
  fetchStationOrders,
  bumpStationOrder,
  recallStationOrder,
} from '@/app/[locale]/dashboard/kds/actions'

interface Props {
  initialOrders: KDSOrder[]
  station:       KDSStation
  branchId:      string | null
  locale:        string
  loadError?:    string
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
  initialOrders,
  station,
  branchId,
  locale,
  loadError,
}: Props) {
  const [orders, setOrders]             = useState<KDSOrder[]>(initialOrders)
  const [refreshError, setRefreshError] = useState<string | null>(loadError ?? null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [bumpedToday, setBumpedToday]   = useState(0)
  const [bumpedStack, setBumpedStack]   = useState<string[]>([])
  const [isRecalling, setIsRecalling]   = useState(false)

  const t             = useTranslations('kds')
  const router        = useRouter()
  const isAr          = locale === 'ar'
  const stationConfig = getStationConfig(station)
  const isFetching    = useRef(false)
  const soundRef      = useRef(soundEnabled)
  useEffect(() => { soundRef.current = soundEnabled }, [soundEnabled])

  const refresh = useCallback(async () => {
    if (isFetching.current) return
    isFetching.current = true
    try {
      const result = await fetchStationOrders(station)
      if ('orders' in result) {
        setOrders(result.orders)
        setRefreshError(null)
      } else {
        setRefreshError(result.error)
      }
    } catch {
      setRefreshError('Network error')
    } finally {
      isFetching.current = false
    }
  }, [station])

  const handleBump = useCallback(async (orderId: string) => {
    const result = await bumpStationOrder(orderId, station)
    if (result.success) {
      setOrders(prev => prev.filter(o => o.id !== orderId))
      setBumpedStack(prev => [orderId, ...prev].slice(0, 20))
      setBumpedToday(prev => prev + 1)
      if (soundRef.current) playBumpTone()
    }
  }, [station])

  const handleRecall = useCallback(async () => {
    if (bumpedStack.length === 0 || isRecalling) return
    const orderId = bumpedStack[0]
    setIsRecalling(true)
    try {
      const result = await recallStationOrder(orderId, station)
      if (result.success) {
        setBumpedStack(prev => prev.slice(1))
        setBumpedToday(prev => Math.max(0, prev - 1))
        await refresh()
      }
    } finally {
      setIsRecalling(false)
    }
  }, [bumpedStack, station, refresh, isRecalling])

  useEffect(() => {
    const supabase = createClient()
    const channel  = supabase.channel(`kds-board-${station}`)

    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'order_item_station_status', filter: `station=eq.${station}` },
      (payload) => {
        const row = payload.new as { item_id: string; status: KDSItemStatus } | null
        if (!row?.item_id) return
        if (row.status === 'completed') {
          setOrders(prev => prev
            .map(order => ({
              ...order,
              order_items: order.order_items.filter(item => item.id !== row.item_id),
            }))
            .filter(order => order.order_items.length > 0)
          )
        } else {
          setOrders(prev => prev.map(order => ({
            ...order,
            order_items: order.order_items.map(item =>
              item.id === row.item_id ? { ...item, station_status: row.status } : item
            ),
          })))
        }
      }
    )

    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'order_item_station_status', filter: `station=eq.${station}` },
      () => {
        if (soundRef.current) playTripleBeep()
        refresh()
      }
    )

    channel.on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'order_item_station_status', filter: `station=eq.${station}` },
      (payload) => {
        const old = payload.old as { item_id?: string } | null
        if (!old?.item_id) { refresh(); return }
        const itemId = old.item_id
        setOrders(prev => prev
          .map(order => ({
            ...order,
            order_items: order.order_items.filter(item => item.id !== itemId),
          }))
          .filter(order => order.order_items.length > 0)
        )
      }
    )

    const ordersFilter = branchId ? `branch_id=eq.${branchId}` : undefined
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', ...(ordersFilter ? { filter: ordersFilter } : {}) },
      () => { refresh() }
    )

    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [station, branchId, refresh])

  const sortedOrders = useMemo(() => {
    return [...orders].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
  }, [orders])

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

        <div className="flex items-center gap-4">
          {bumpedToday > 0 && (
            <div className="flex flex-col items-center min-w-[48px]">
              <div className="text-[10px] text-muted uppercase tracking-widest leading-none mb-1">
                {t('allDayLabel')}
              </div>
              <div className="text-xl font-black tabular-nums text-success">{bumpedToday}</div>
            </div>
          )}

          <AnimatePresence>
            {bumpedStack.length > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={handleRecall}
                disabled={isRecalling}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gold/40 text-gold text-sm font-bold hover:bg-gold/10 active:scale-95 transition-all disabled:opacity-40"
              >
                <RecallIcon className="w-4 h-4" />
                {t('recallOrder')}
                <span className="text-xs bg-gold/20 rounded px-1">{bumpedStack.length}</span>
              </motion.button>
            )}
          </AnimatePresence>

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
              {orders.length}
            </div>
          </div>

          <div className="w-px h-10 bg-border" />
          <Clock locale={locale} />
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
            {sortedOrders.map((order) => (
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
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {orders.length === 0 && !refreshError && (
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
        {bumpedToday > 0 && (
          <span className="ms-auto">
            {isAr ? `أُنجز اليوم: ${bumpedToday}` : `Bumped today: ${bumpedToday}`}
          </span>
        )}
      </footer>
    </div>
  )
}

function Clock({ locale }: { locale: string }) {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="font-black text-2xl tabular-nums text-white min-w-[90px] text-center">
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
