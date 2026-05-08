'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { KDSOrder, KDSStation } from '@/lib/supabase/custom-types'
import { STATION_CONFIG } from '@/constants/kds'
import KDSStationOrderCard from './KDSStationOrderCard'
import { fetchStationOrders } from '@/app/[locale]/dashboard/kds/actions'

interface Props {
  initialOrders: KDSOrder[]
  station:       KDSStation
  branchId:      string | null
  locale:        string
}

export default function KDSStationBoard({ initialOrders, station, branchId, locale }: Props) {
  const [orders, setOrders] = useState<KDSOrder[]>(initialOrders)
  const t = useTranslations('kds')
  const isAr = locale === 'ar'
  const stationConfig = STATION_CONFIG[station] || STATION_CONFIG['main']!
  const isFetching = useRef(false)

  const refresh = useCallback(async () => {
    if (isFetching.current) return
    isFetching.current = true
    try {
      const result = await fetchStationOrders(station)
      if ('orders' in result) setOrders(result.orders)
    } finally {
      isFetching.current = false
    }
  }, [station])

  // Realtime subscription — granular updates, no page reload
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`kds-station-${station}`)

    // Listen to item-status changes for this station
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'order_item_station_status', filter: `station=eq.${station}` },
      () => { refresh() }
    )

    // Listen to new orders arriving (branch-scoped if possible)
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
    return [...orders].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
  }, [orders])

  return (
    <div className="flex flex-col h-screen bg-brand-black overflow-hidden">
      {/* Station Header */}
      <header 
        className="shrink-0 h-20 flex items-center justify-between px-6 border-b border-border"
        style={{ borderBottomColor: `${stationConfig.color}40` }}
      >
        <div className="flex items-center gap-4">
          <button 
            onClick={() => window.location.href = `/${locale}/dashboard/kds`}
            className="p-2 hover:bg-surface2 rounded-lg transition-colors"
          >
            <BackIcon className="w-6 h-6 text-muted" />
          </button>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{stationConfig.icon}</span>
            <h1 className="text-2xl font-black font-ar-heading">
              {isAr ? stationConfig.label.ar : stationConfig.label.en}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <div className="text-sm text-muted uppercase tracking-widest">{t('activeOrders')}</div>
            <div className="text-2xl font-black tabular-nums text-gold">{orders.length}</div>
          </div>
          <div className="w-px h-10 bg-border" />
          <Clock />
        </div>
      </header>

      {/* Orders Grid */}
      <main className="flex-1 overflow-x-auto p-6">
        <div className="flex h-full gap-6 items-start">
          <AnimatePresence mode="popLayout">
            {sortedOrders.map((order) => (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="w-80 shrink-0 h-full max-h-full overflow-y-auto"
              >
                <KDSStationOrderCard 
                  order={order} 
                  station={station} 
                  locale={locale} 
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {orders.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center opacity-20">
              <span className="text-8xl mb-4">{stationConfig.icon}</span>
              <p className="text-2xl font-bold">{t('noOrders')}</p>
            </div>
          )}
        </div>
      </main>

      {/* Status footer */}
      <footer className="h-10 bg-brand-surface-2 border-t border-brand-border flex items-center px-6 gap-2 text-xs text-brand-muted font-medium">
        <span className="w-2 h-2 rounded-full bg-brand-success animate-pulse" />
        <span>{isAr ? 'متصل — يتحدث تلقائياً' : 'Live — auto-updating'}</span>
      </footer>
    </div>
  )
}

function Clock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="font-black text-2xl tabular-nums text-white">
      {time.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' })}
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
