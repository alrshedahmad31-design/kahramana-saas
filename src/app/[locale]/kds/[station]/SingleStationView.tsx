'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion } from 'motion/react'
import { createClient } from '@/lib/supabase/client'
import { tokens } from '@/lib/design-tokens'
import { getStationConfig } from '@/constants/kds'
import { Icon } from '@/components/ui/Icon'
import { SIZE_LABELS } from '@/lib/cart'
import { getAgeStatus, formatElapsed } from '@/lib/kds/priorities'
import {
  fetchStationOrders,
  bumpStationOrder,
  updateItemStatus,
} from '@/app/[locale]/dashboard/kds/actions'
import { playBumpTone, playTripleBeep } from '@/lib/kds/audio'
import type { KDSOrder, KDSStation, KDSItemStatus } from '@/lib/supabase/custom-types'

interface Props {
  initialOrders: KDSOrder[]
  station:       KDSStation
  branchId:      string | null
  locale:        string
  initialNow:    number
  loadError?:    string
}

function ageRing(age: 'fresh' | 'warning' | 'overdue') {
  if (age === 'overdue') return 'border-brand-error ring-2 ring-brand-error/25'
  if (age === 'warning') return 'border-brand-gold ring-2 ring-brand-gold/25'
  return 'border-brand-border'
}

function nextStatusFor(current?: KDSItemStatus): KDSItemStatus {
  if (!current || current === 'pending') return 'preparing'
  if (current === 'preparing')           return 'ready'
  return 'preparing'
}

export default function SingleStationView({
  initialOrders,
  station,
  branchId,
  locale,
  initialNow,
  loadError,
}: Props) {
  const t      = useTranslations('kds')
  const isAr   = locale === 'ar'
  const prefix = locale === 'en' ? '/en' : ''
  const font   = isAr ? 'font-almarai' : 'font-satoshi'
  const cfg    = getStationConfig(station)

  const [orders, setOrders]           = useState<KDSOrder[]>(initialOrders)
  const [now, setNow]                 = useState(initialNow)
  const [refreshError, setRefreshError] = useState<string | null>(loadError ?? null)
  const [isSyncing, setIsSyncing]     = useState(false)
  const [isConnected, setIsConnected] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [updating, setUpdating]       = useState<string | null>(null)
  const [optimistic, setOptimistic]   = useState<Record<string, KDSItemStatus>>({})
  const [bumping, setBumping]         = useState<string | null>(null)
  const soundRef = useRef(soundEnabled)
  const isFetching = useRef(false)
  useEffect(() => { soundRef.current = soundEnabled }, [soundEnabled])

  const refresh = useCallback(async () => {
    if (isFetching.current) return
    isFetching.current = true
    setIsSyncing(true)
    try {
      const res = await fetchStationOrders(station)
      if ('active' in res) {
        // Mobile lane shows active + stalled together — kitchen staff working
        // a single station want one ordered list, not two columns.
        setOrders([...res.stalled, ...res.active])
        setRefreshError(null)
      } else {
        setRefreshError(res.error)
      }
    } catch {
      setRefreshError('Network error')
    } finally {
      setIsSyncing(false)
      isFetching.current = false
    }
  }, [station])

  // 1-second clock for elapsed timers + age-status colour transitions
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Realtime subscription — mirrors KDSStationBoard so this view stays in
  // sync with the tablet board and any other cooks working the same station.
  useEffect(() => {
    const supabase = createClient()
    const channel  = supabase.channel(`kds-mobile-${station}-${branchId ?? 'all'}`)

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
          setOrders(prev => prev
            .map(o => ({ ...o, order_items: o.order_items.filter(it => it.id !== row.item_id) }))
            .filter(o => o.order_items.length > 0))
        } else {
          setOrders(prev => prev.map(o => ({
            ...o,
            order_items: o.order_items.map(it =>
              it.id === row.item_id ? { ...it, station_status: row.status } : it,
            ),
          })))
        }
      },
    )
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'order_item_station_status', filter: oissFilter },
      () => {
        if (soundRef.current) playTripleBeep()
        void refresh()
      },
    )
    channel.on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'order_item_station_status', filter: oissFilter },
      (payload) => {
        const old = payload.old as { item_id?: string } | null
        if (!old?.item_id) { void refresh(); return }
        const itemId = old.item_id
        setOrders(prev => prev
          .map(o => ({ ...o, order_items: o.order_items.filter(it => it.id !== itemId) }))
          .filter(o => o.order_items.length > 0))
      },
    )

    const ordersFilter = branchId ? `branch_id=eq.${branchId}` : undefined
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', ...(ordersFilter ? { filter: ordersFilter } : {}) },
      () => { void refresh() },
    )

    channel.subscribe((status) => setIsConnected(status === 'SUBSCRIBED'))
    return () => { supabase.removeChannel(channel) }
  }, [station, branchId, refresh])

  // Polling fallback while realtime is disconnected (15s = max gap a kitchen
  // will tolerate before a missed ticket becomes a problem).
  useEffect(() => {
    if (isConnected) return
    const id = setInterval(() => { void refresh() }, 15_000)
    return () => clearInterval(id)
  }, [isConnected, refresh])

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [orders],
  )

  const effectiveStatus = useCallback(
    (item: KDSOrder['order_items'][0]): KDSItemStatus | undefined =>
      optimistic[item.id] ?? item.station_status,
    [optimistic],
  )

  async function advanceItem(
    orderId: string,
    itemId:  string,
    currentStatus: KDSItemStatus | undefined,
  ) {
    if (updating) return
    const next = nextStatusFor(currentStatus)
    setOptimistic(prev => ({ ...prev, [itemId]: next }))
    setUpdating(itemId)
    try {
      const result = await updateItemStatus(orderId, itemId, station, next, currentStatus)
      if (!result.success) {
        setOptimistic(prev => { const { [itemId]: _, ...rest } = prev; return rest })
      }
    } catch {
      setOptimistic(prev => { const { [itemId]: _, ...rest } = prev; return rest })
    } finally {
      setUpdating(null)
    }
  }

  async function handleBump(orderId: string) {
    if (bumping) return
    setBumping(orderId)
    try {
      const result = await bumpStationOrder(orderId, station)
      if (result.success) {
        setOrders(prev => prev.filter(o => o.id !== orderId))
        if (soundRef.current) playBumpTone()
      } else {
        setRefreshError(result.error || t('dialog.bumpFailedMessage'))
      }
    } finally {
      setBumping(null)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-brand-black" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Sticky header */}
      <header
        className="sticky top-0 z-30 bg-brand-black/95 backdrop-blur-sm border-b"
        style={{ borderBottomColor: `${cfg.color}55` }}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 min-h-[56px]">
          <Link
            href={`${prefix}/kds`}
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg hover:bg-brand-surface-2 active:bg-brand-surface text-brand-muted"
            aria-label={t('singleStation.back')}
          >
            <BackIcon className={`w-6 h-6 ${isAr ? 'rotate-180' : ''}`} />
          </Link>
          <Icon name={cfg.icon} size={26} />
          <h1 className={`flex-1 truncate text-lg font-black tracking-tight ${isAr ? 'font-cairo' : 'font-editorial'}`}>
            {isAr ? cfg.label.ar : cfg.label.en}
          </h1>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-brand-surface-2 border border-brand-border">
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-brand-success' : 'bg-brand-error animate-pulse'}`} />
            <span className="text-[9px] font-bold uppercase tracking-wider text-brand-muted">
              {isConnected ? t('liveLabel') : t('offlineLabel')}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSoundEnabled(v => !v)}
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg hover:bg-brand-surface-2 active:bg-brand-surface"
            aria-label={soundEnabled ? t('soundOn') : t('soundOff')}
          >
            {soundEnabled
              ? <SoundOnIcon className="w-5 h-5 text-brand-muted" />
              : <SoundOffIcon className="w-5 h-5 text-brand-error" />}
          </button>
        </div>

        <div className="flex items-center justify-between px-4 pb-2 text-xs">
          <span className={`${font} text-brand-muted`}>
            {t('singleStation.activeCount', { count: orders.length })}
          </span>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={isSyncing}
            className={`inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-md text-[11px] font-bold uppercase tracking-wider ${isSyncing ? 'text-brand-gold' : 'text-brand-muted hover:text-brand-gold'}`}
          >
            <RefreshIcon className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {t('refreshLabel')}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {refreshError && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-brand-error/10 border-b border-brand-error/30 px-4 py-2 flex items-center gap-3 text-brand-error text-xs">
              <span className="flex-1 truncate">{refreshError}</span>
              <button
                onClick={() => { setRefreshError(null); void refresh() }}
                className="min-h-[36px] px-2 text-[11px] font-bold uppercase tracking-wider underline underline-offset-2"
              >
                {t('retry')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 px-3 py-3 pb-8 flex flex-col gap-3">
        {sortedOrders.length === 0 && !refreshError && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 opacity-30 py-20 select-none">
            <Icon name={cfg.icon} size={72} />
            <p className={`text-base font-bold ${font}`}>{t('singleStation.noOrders')}</p>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {sortedOrders.map((order) => {
            const items = order.order_items ?? []
            const stationStart = items.reduce<string>((earliest, item) => {
              const ts = item.station_assigned_at
              if (!ts) return earliest
              return !earliest || new Date(ts).getTime() < new Date(earliest).getTime() ? ts : earliest
            }, '') || order.created_at
            const elapsed   = formatElapsed(stationStart, now)
            const ageStatus = getAgeStatus(stationStart, now)
            const allReady  = items.length > 0 && items.every(it => {
              const st = effectiveStatus(it)
              return st === 'ready' || st === 'completed'
            })
            const shortId = order.id.slice(-4).toUpperCase()
            const isDineIn = order.order_type === 'dine_in' || order.table_number != null
            const tableLabel = isDineIn && order.table_number != null
              ? t('tableLabel', { n: order.table_number })
              : (order.order_type === 'delivery' ? t('delivery') : t('dineIn'))

            return (
              <motion.article
                key={order.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.18 } }}
                transition={{ type: 'spring', damping: 26, stiffness: 320 }}
                className={`flex flex-col rounded-2xl border-2 bg-brand-surface overflow-hidden transition-colors duration-300 ${ageRing(ageStatus)}`}
              >
                <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
                  <div className="min-w-0">
                    <div
                      className="text-5xl font-black tabular-nums leading-none tracking-tight"
                      suppressHydrationWarning
                      style={{
                        color:
                          ageStatus === 'overdue' ? tokens.color.error :
                          ageStatus === 'warning' ? tokens.color.gold :
                          tokens.color.text,
                      }}
                    >
                      {elapsed}
                    </div>
                    <div className={`mt-1.5 text-xs text-brand-muted ${font}`}>
                      {tableLabel}
                    </div>
                  </div>
                  <div className="text-end shrink-0">
                    <div className="text-sm font-bold tabular-nums" style={{ color: `${cfg.color}cc` }}>
                      #{shortId}
                    </div>
                    <div className={`text-[11px] text-brand-muted truncate max-w-[120px] mt-0.5 ${font}`}>
                      {order.customer_name || t('guest')}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 px-3 pb-3">
                  {items.map((item) => {
                    const st          = effectiveStatus(item)
                    const isReady     = st === 'ready' || st === 'completed'
                    const isPreparing = st === 'preparing'
                    const isUpdating  = updating === item.id
                    const itemLabel   = isAr ? item.name_ar : item.name_en
                    const variantBits = [
                      item.selected_size ? (SIZE_LABELS[item.selected_size]?.[isAr ? 'ar' : 'en'] ?? item.selected_size) : null,
                      item.selected_variant && item.selected_variant !== item.name_ar && item.selected_variant !== item.name_en
                        ? item.selected_variant
                        : null,
                    ].filter(Boolean)

                    return (
                      <div
                        key={item.id}
                        className={[
                          'flex items-stretch gap-3 p-3 rounded-xl border transition-colors duration-200',
                          isReady     ? 'bg-brand-success/10 border-brand-success/30' :
                          isPreparing ? 'bg-brand-gold/10 border-brand-gold/40' :
                                        'bg-brand-surface-2 border-brand-border',
                          isUpdating ? 'opacity-60' : '',
                        ].join(' ')}
                      >
                        <div className={[
                          'shrink-0 w-11 h-11 self-start rounded-lg flex items-center justify-center',
                          'font-black text-lg tabular-nums transition-colors',
                          isReady     ? 'bg-brand-success text-brand-black' :
                          isPreparing ? 'bg-brand-gold text-brand-black' :
                                        'bg-brand-surface text-brand-muted border border-brand-border',
                        ].join(' ')}>
                          {item.quantity}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className={`text-base font-bold leading-snug tracking-tight ${isReady ? 'line-through text-brand-muted' : 'text-brand-text'}`}>
                            {itemLabel}
                          </div>
                          {variantBits.length > 0 && (
                            <div className={`text-xs text-brand-muted mt-0.5 ${font}`}>
                              {variantBits.join(' — ')}
                            </div>
                          )}
                          {item.modifiers && item.modifiers.length > 0 && (
                            <div className={`flex flex-wrap gap-1 mt-1.5 ${font}`}>
                              {item.modifiers.map((mod, i) => {
                                const label = (isAr ? mod.option_name_ar : mod.option_name_en)
                                  ?? mod.option_name_en ?? mod.option_name_ar ?? ''
                                if (!label) return null
                                return (
                                  <span
                                    key={`${item.id}-mod-${i}`}
                                    className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-brand-gold/15 text-brand-gold border border-brand-gold/40"
                                  >
                                    {label}
                                  </span>
                                )
                              })}
                            </div>
                          )}
                          {item.notes && (
                            <div className={`text-xs text-brand-error mt-1 font-semibold ${font}`}>
                              {t('note')}: {item.notes}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => void advanceItem(order.id, item.id, st)}
                          disabled={!!updating && !isUpdating}
                          aria-label={
                            isReady     ? t('btnDelivered')      :
                            isPreparing ? t('btnReadyToServe')   :
                                          t('btnStartPrep')
                          }
                          className={[
                            'shrink-0 min-w-[44px] min-h-[44px] self-center flex items-center justify-center rounded-full',
                            'transition-transform active:scale-90',
                            !!updating && !isUpdating ? 'opacity-40 cursor-not-allowed' : '',
                          ].join(' ')}
                        >
                          {isUpdating ? (
                            <SpinnerIcon className="w-7 h-7 text-brand-gold animate-spin" />
                          ) : isReady ? (
                            <div className="w-10 h-10 rounded-full bg-brand-success flex items-center justify-center">
                              <CheckIcon className="w-6 h-6 text-brand-black" />
                            </div>
                          ) : isPreparing ? (
                            <div className="w-10 h-10 rounded-full bg-brand-gold/20 border-2 border-brand-gold flex items-center justify-center">
                              <SpinnerIcon className="w-6 h-6 text-brand-gold" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-full border-2 border-brand-border" />
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>

                {order.notes && (
                  <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-brand-error/10 border border-brand-error/30">
                    <p className={`text-brand-error text-xs font-bold ${font}`}>
                      {t('orderNote')}: {order.notes}
                    </p>
                  </div>
                )}

                {allReady && (
                  <button
                    type="button"
                    onClick={() => void handleBump(order.id)}
                    disabled={bumping === order.id}
                    className="m-4 mt-2 w-[calc(100%-2rem)] min-h-[56px] py-3 rounded-xl font-black text-lg uppercase tracking-tight bg-brand-success text-brand-black active:brightness-95 transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {bumping === order.id ? (
                      <SpinnerIcon className="w-6 h-6 animate-spin" />
                    ) : (
                      <>
                        <CheckAllIcon className="w-6 h-6" />
                        {t('bumpOrder')}
                      </>
                    )}
                  </button>
                )}
              </motion.article>
            )
          })}
        </AnimatePresence>
      </main>
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
function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}
function CheckAllIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 12l5 5L18 6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12l5 5L24 6" />
    </svg>
  )
}
function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}
