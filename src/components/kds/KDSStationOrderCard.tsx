'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { tokens } from '@/lib/design-tokens'
import type { KDSOrder, KDSStation, KDSItemStatus } from '@/lib/supabase/custom-types'
import { SIZE_LABELS } from '@/lib/cart'
import { getAgeStatus, formatElapsed } from '@/lib/kds/priorities'
import { updateItemStatus } from '@/app/[locale]/dashboard/kds/actions'
import { getStationConfig } from '@/constants/kds'

interface Props {
  order:   KDSOrder
  station: KDSStation
  locale:  string
  onBump:  (orderId: string) => void
}

function nextStatusFor(current?: KDSItemStatus): KDSItemStatus {
  if (!current || current === 'pending')  return 'preparing'
  if (current === 'preparing')            return 'ready'
  return 'preparing'
}

function ageBorderClass(age: 'fresh' | 'warning' | 'overdue') {
  if (age === 'overdue') return 'border-error ring-2 ring-error/25'
  if (age === 'warning') return 'border-amber-500 ring-2 ring-amber-500/25'
  return 'border-border'
}

export default function KDSStationOrderCard({ order, station, locale, onBump }: Props) {
  const isRTL = locale === 'ar'
  const t     = useTranslations('kds')
  const stationConfig = getStationConfig(station)
  const font = isRTL ? 'font-almarai' : 'font-satoshi'

  const [elapsed,    setElapsed]    = useState(() => formatElapsed(order.created_at))
  const [ageStatus,  setAgeStatus]  = useState(() => getAgeStatus(order.created_at))
  const [optimistic, setOptimistic] = useState<Record<string, KDSItemStatus>>({})
  const [updating,   setUpdating]   = useState<string | null>(null)
  const [pendingUndo, setPendingUndo] = useState<string | null>(null)
  const [bumping,    setBumping]    = useState(false)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(formatElapsed(order.created_at))
      setAgeStatus(getAgeStatus(order.created_at))
    }, 1000)
    return () => clearInterval(id)
  }, [order.created_at])

  useEffect(() => () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current) }, [])

  const effectiveStatus = useCallback(
    (item: KDSOrder['order_items'][0]): KDSItemStatus | undefined =>
      optimistic[item.id] ?? item.station_status,
    [optimistic]
  )

  const items = order.order_items ?? []

  const progressValue = items.reduce((acc, item) => {
    const st = effectiveStatus(item)
    if (st === 'ready' || st === 'completed') return acc + 1
    if (st === 'preparing')                   return acc + 0.5
    return acc
  }, 0)
  const progress  = items.length > 0 ? (progressValue / items.length) * 100 : 0
  const allReady  = progress === 100 && items.length > 0

  async function handleItemToggle(itemId: string, currentStatus?: KDSItemStatus) {
    if (updating) return

    if (currentStatus === 'ready' || currentStatus === 'completed') {
      if (pendingUndo === itemId) {
        clearTimeout(undoTimerRef.current!)
        undoTimerRef.current = null
        setPendingUndo(null)
      } else {
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
        setPendingUndo(itemId)
        undoTimerRef.current = setTimeout(() => setPendingUndo(null), 2000)
        return
      }
    }

    const next = nextStatusFor(currentStatus)
    setOptimistic(prev => ({ ...prev, [itemId]: next }))
    setUpdating(itemId)

    try {
      const result = await updateItemStatus(order.id, itemId, station, next)
      if (!result.success) {
        setOptimistic(prev => { const { [itemId]: _, ...rest } = prev; return rest })
        console.error('[KDS] update failed:', result.error)
      }
    } catch (err) {
      setOptimistic(prev => { const { [itemId]: _, ...rest } = prev; return rest })
      console.error('[KDS] update error:', err)
    } finally {
      setUpdating(null)
    }
  }

  async function handleBump() {
    if (bumping) return
    setBumping(true)
    try { await onBump(order.id) }
    finally { setBumping(false) }
  }

  const shortId = order.id.slice(-4).toUpperCase()

  return (
    <article
      className={[
        'flex flex-col rounded-2xl border-2 bg-surface overflow-hidden',
        'transition-colors duration-300 shadow-xl',
        ageBorderClass(ageStatus),
      ].join(' ')}
    >
      {/* Progress bar */}
      <div className="h-2 w-full bg-surface2 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', damping: 20 }}
          className="h-full"
          style={{ backgroundColor: allReady ? tokens.color.success : stationConfig.color }}
        />
      </div>

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className={[
              'text-4xl font-black tabular-nums leading-none',
              ageStatus === 'overdue' ? 'text-error' :
              ageStatus === 'warning' ? 'text-amber-400' : 'text-white',
            ].join(' ')}>
              {elapsed}
            </div>
            <div className={`text-xs text-muted mt-1 ${font}`}>
              {order.order_type === 'delivery' ? t('delivery') : t('dineIn')}
            </div>
          </div>
          <div className="text-end">
            <div className="text-3xl font-black tabular-nums" style={{ color: stationConfig.color }}>
              #{shortId}
            </div>
            <div className={`text-xs text-muted truncate max-w-[110px] mt-0.5 ${font}`}>
              {order.customer_name || t('guest')}
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="flex flex-col gap-2">
          {items.map((item) => {
            const st          = effectiveStatus(item)
            const isPreparing = st === 'preparing'
            const isReady     = st === 'ready' || st === 'completed'
            const isUpdating  = updating === item.id
            const awaitUndo   = pendingUndo === item.id

            return (
              <button
                key={item.id}
                onClick={() => handleItemToggle(item.id, st)}
                disabled={!!updating && !isUpdating}
                className={[
                  'relative flex items-center gap-3 p-3 rounded-xl border',
                  'transition-all duration-200 text-start w-full active:scale-[0.98]',
                  isReady     ? 'bg-success/10 border-success/30' :
                  isPreparing ? 'bg-gold/10 border-gold/40' :
                                'bg-surface2 border-border hover:border-gold/40',
                  isUpdating ? 'opacity-60' : '',
                ].join(' ')}
              >
                {/* Qty badge */}
                <div className={[
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  'font-black text-lg tabular-nums shrink-0 transition-colors',
                  isReady     ? 'bg-success text-black' :
                  isPreparing ? 'bg-gold text-black' :
                                'bg-surface text-muted border border-border',
                ].join(' ')}>
                  {item.quantity}
                </div>

                {/* Name + extras */}
                <div className="flex-1 min-w-0">
                  <div className={[
                    'text-base font-bold leading-tight',
                    isReady ? 'line-through text-muted' : 'text-white',
                  ].join(' ')}>
                    {isRTL ? item.name_ar : item.name_en}
                  </div>
                  {(item.selected_size || item.selected_variant) && (
                    <div className="text-xs text-muted mt-0.5">
                      {item.selected_size && (SIZE_LABELS[item.selected_size]?.[isRTL ? 'ar' : 'en'] ?? item.selected_size)}
                      {item.selected_size && item.selected_variant && ' · '}
                      {item.selected_variant}
                    </div>
                  )}
                  {item.notes && (
                    <div className={`text-xs text-error mt-1 font-semibold ${font}`}>
                      {t('note')}: {item.notes}
                    </div>
                  )}
                </div>

                {/* Status icon */}
                <div className="shrink-0 w-6 h-6 flex items-center justify-center">
                  {isUpdating ? (
                    <SpinnerIcon className="w-5 h-5 text-gold animate-spin" />
                  ) : isReady ? (
                    <CheckIcon className="w-5 h-5 text-success" />
                  ) : isPreparing ? (
                    <SpinnerIcon className="w-5 h-5 text-gold" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-border" />
                  )}
                </div>

                {/* Undo confirmation overlay */}
                <AnimatePresence>
                  {awaitUndo && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 rounded-xl bg-surface/85 flex items-center justify-center"
                    >
                      <span className={`text-xs font-bold text-amber-400 ${font}`}>
                        {t('tapAgainToUndo')}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            )
          })}
        </div>

        {/* Order note */}
        {order.notes && (
          <div className="mt-3 p-3 rounded-xl bg-error/10 border border-error/30">
            <p className={`text-error text-xs font-bold ${font}`}>
              {t('orderNote')}: {order.notes}
            </p>
          </div>
        )}

        {/* Bump button */}
        <AnimatePresence>
          {allReady && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              onClick={handleBump}
              disabled={bumping}
              className={[
                'mt-4 w-full py-3 rounded-xl font-black text-base',
                'flex items-center justify-center gap-2 transition-all active:scale-[0.97]',
                bumping
                  ? 'bg-success/40 text-black/40 cursor-not-allowed'
                  : 'bg-success text-black hover:bg-success/90 shadow-lg shadow-success/20',
              ].join(' ')}
            >
              {bumping ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : <CheckAllIcon className="w-5 h-5" />}
              {t('bumpOrder')}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </article>
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
