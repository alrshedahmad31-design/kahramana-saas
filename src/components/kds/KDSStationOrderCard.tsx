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
  now:     number
}

function nextStatusFor(current?: KDSItemStatus): KDSItemStatus {
  if (!current || current === 'pending')  return 'preparing'
  if (current === 'preparing')            return 'ready'
  return 'preparing'
}

// Per-status visual config — labels live in messages/*.json (FIX 5).
function statusButtonStyle(st: KDSItemStatus | undefined) {
  if (st === 'ready' || st === 'completed') {
    return { bg: 'bg-brand-muted/30',  text: 'text-brand-text', border: 'border-brand-muted/40' }
  }
  if (st === 'preparing') {
    return { bg: 'bg-brand-success',   text: 'text-brand-black', border: 'border-brand-success' }
  }
  // pending
  return { bg: 'bg-brand-gold',        text: 'text-brand-black', border: 'border-brand-gold' }
}

function ageBorderClass(age: 'fresh' | 'warning' | 'overdue') {
  if (age === 'overdue') return 'border-brand-error ring-2 ring-brand-error/25'
  if (age === 'warning') return 'border-brand-gold ring-2 ring-brand-gold/25'
  return 'border-brand-border'
}

// Pick the source colour from brand tokens — keeps FIX 10 compliant.
function sourceBadgeStyle(source: string | null) {
  switch (source) {
    case 'qr':     return { color: tokens.color.kdsBlue,    label: 'qr'     }
    case 'waiter': return { color: tokens.color.kdsAmber,   label: 'waiter' }
    case 'manual': return { color: tokens.color.gold,       label: 'manual' }
    case 'online': return { color: tokens.color.success,    label: 'online' }
    case 'kiosk':  return { color: tokens.color.kdsIndigo,  label: 'kiosk'  }
    default:       return null
  }
}

export default function KDSStationOrderCard({ order, station, locale, onBump, now }: Props) {
  const isRTL = locale === 'ar'
  const t     = useTranslations('kds')
  const stationConfig = getStationConfig(station)
  const font = isRTL ? 'font-almarai' : 'font-satoshi'
  const shortId = order.id.slice(-4).toUpperCase()

  // FIX 7: SLA timer baseline = earliest station_assigned_at across this card's
  // items. Falls back to order.created_at for legacy rows where the column was
  // not yet populated (pre-089). Kitchen timer must reflect when the work
  // *arrived at this station*, not when the customer placed the order.
  const items = order.order_items ?? []
  const stationStart = items.reduce<string>((earliest, item) => {
    const ts = item.station_assigned_at
    if (!ts) return earliest
    return !earliest || new Date(ts).getTime() < new Date(earliest).getTime() ? ts : earliest
  }, '') || order.created_at

  const elapsed   = formatElapsed(stationStart, now)
  const ageStatus = getAgeStatus(stationStart, now)

  const [optimistic, setOptimistic] = useState<Record<string, KDSItemStatus>>({})
  const [updating,   setUpdating]   = useState<string | null>(null)
  const [pendingUndo, setPendingUndo] = useState<string | null>(null)
  const [bumping,    setBumping]    = useState(false)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current) }, [])

  const effectiveStatus = useCallback(
    (item: KDSOrder['order_items'][0]): KDSItemStatus | undefined =>
      optimistic[item.id] ?? item.station_status,
    [optimistic]
  )

  // FIX 6: progress bar pending=0%, preparing=50%, ready=100%.
  const progress = items.length > 0
    ? items.reduce((sum, item) => {
        const st = effectiveStatus(item)
        if (st === 'ready' || st === 'completed') return sum + 100
        if (st === 'preparing')                   return sum + 50
        return sum
      }, 0) / items.length
    : 0
  const allReady = progress === 100 && items.length > 0

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
      // Pass currentStatus as expectedStatus so the RPC can detect concurrent
      // changes (CONFLICT) and the action can short-circuit illegal jumps.
      const result = await updateItemStatus(order.id, itemId, station, next, currentStatus)
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

  const isDineIn  = order.order_type === 'dine_in' || (!!order.table_number)
  const sourceCfg = sourceBadgeStyle(order.source)
  const tableLabel = isDineIn && order.table_number != null
    ? t('tableLabel', { n: order.table_number })
    : null

  return (
    <article
      className={[
        'flex flex-col rounded-2xl border-2 bg-brand-surface overflow-hidden',
        'transition-colors duration-300 shadow-xl',
        ageBorderClass(ageStatus),
      ].join(' ')}
    >
      {/* Progress bar */}
      <div className="h-2 w-full bg-brand-surface-2 overflow-hidden">
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
            <div
              className="text-4xl font-black tabular-nums leading-none"
              style={{
                color:
                  ageStatus === 'overdue' ? tokens.color.error :
                  ageStatus === 'warning' ? tokens.color.gold :
                  tokens.color.text,
              }}
            >
              {elapsed}
            </div>
            <div className={`flex flex-wrap items-center gap-1.5 mt-1 ${font}`}>
              {/* dine-in / delivery label */}
              <span className="text-xs text-brand-muted">
                {isDineIn
                  ? (tableLabel ?? t('dineIn'))
                  : (order.order_type === 'delivery' ? t('delivery') : t('dineIn'))}
              </span>

              {/* FIX 3: source badge */}
              {sourceCfg && (
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: `${sourceCfg.color}20`,
                    color:           sourceCfg.color,
                    border:          `1px solid ${sourceCfg.color}55`,
                  }}
                >
                  {t(`source.${sourceCfg.label}` as 'source.qr')}
                </span>
              )}
            </div>
          </div>
          <div className="text-end">
            <div className="text-3xl font-black tabular-nums" style={{ color: stationConfig.color }}>
              #{shortId}
            </div>
            <div className={`text-xs text-brand-muted truncate max-w-[110px] mt-0.5 ${font}`}>
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
            const btn         = statusButtonStyle(st)
            const buttonLabel =
              isReady     ? t('btnDelivered')      :
              isPreparing ? t('btnReadyToServe')   :
                            t('btnStartPrep')

            return (
              <button
                key={item.id}
                onClick={() => handleItemToggle(item.id, st)}
                disabled={!!updating && !isUpdating}
                className={[
                  'relative flex items-stretch gap-3 p-3 rounded-xl border',
                  'transition-all duration-200 text-start w-full active:scale-[0.98]',
                  isReady     ? 'bg-brand-success/10 border-brand-success/30' :
                  isPreparing ? 'bg-brand-gold/10 border-brand-gold/40' :
                                'bg-brand-surface-2 border-brand-border hover:border-brand-gold/40',
                  isUpdating ? 'opacity-60' : '',
                ].join(' ')}
              >
                {/* Qty badge */}
                <div className={[
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  'font-black text-lg tabular-nums shrink-0 transition-colors self-start',
                  isReady     ? 'bg-brand-success text-brand-black' :
                  isPreparing ? 'bg-brand-gold text-brand-black' :
                                'bg-brand-surface text-brand-muted border border-brand-border',
                ].join(' ')}>
                  {item.quantity}
                </div>

                {/* Name + extras */}
                <div className="flex-1 min-w-0">
                  <div
                    className={[
                      'text-lg font-black leading-tight tracking-tight',
                      isReady ? 'line-through text-brand-muted' : 'text-brand-text',
                    ].join(' ')}
                  >
                    {isRTL ? item.name_ar : item.name_en}
                  </div>
                  {(item.selected_size || item.selected_variant) && (
                    <div className="text-xs text-brand-muted mt-0.5">
                      {item.selected_size && (SIZE_LABELS[item.selected_size]?.[isRTL ? 'ar' : 'en'] ?? item.selected_size)}
                      {item.selected_variant !== item.name_ar && 
                       item.selected_variant !== item.name_en && 
                       item.selected_variant}
                    </div>
                  )}

                  {/* FIX 3: modifier pills */}
                  {item.modifiers && item.modifiers.length > 0 && (
                    <div className={`flex flex-wrap gap-1 mt-1.5 ${font}`}>
                      {item.modifiers.map((mod, idx) => {
                        const label = (isRTL ? mod.option_name_ar : mod.option_name_en)
                          ?? mod.option_name_en ?? mod.option_name_ar ?? ''
                        if (!label) return null
                        return (
                          <span
                            key={`${item.id}-mod-${idx}`}
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-brand-surface text-brand-muted border border-brand-border"
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

                  {/* FIX 5: Arabic status button label inline (badge under content) */}
                  <div className="mt-2">
                    <span
                      className={[
                        'inline-flex items-center text-[11px] font-bold uppercase tracking-wider',
                        'px-2 py-0.5 rounded border',
                        btn.bg, btn.text, btn.border,
                      ].join(' ')}
                    >
                      {buttonLabel}
                    </span>
                  </div>
                </div>

                {/* Status icon / Checkmark */}
                <div className="shrink-0 w-10 h-10 self-center flex items-center justify-center">
                  {isUpdating ? (
                    <SpinnerIcon className="w-6 h-6 text-brand-gold animate-spin" />
                  ) : isReady ? (
                    <div className="w-8 h-8 rounded-full bg-brand-success flex items-center justify-center shadow-lg shadow-brand-success/20">
                      <CheckIcon className="w-5 h-5 text-brand-black" />
                    </div>
                  ) : isPreparing ? (
                    <div className="w-8 h-8 rounded-full bg-brand-gold/20 flex items-center justify-center border border-brand-gold animate-pulse">
                      <SpinnerIcon className="w-5 h-5 text-brand-gold" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full border-2 border-brand-border hover:border-brand-gold transition-colors" />
                  )}
                </div>

                {/* Undo confirmation overlay */}
                <AnimatePresence>
                  {awaitUndo && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 rounded-xl bg-brand-surface/85 flex items-center justify-center"
                    >
                      <span className={`text-xs font-bold text-brand-gold ${font}`}>
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
          <div className="mt-3 p-3 rounded-xl bg-brand-error/10 border border-brand-error/30">
            <p className={`text-brand-error text-xs font-bold ${font}`}>
              {t('orderNote')}: {order.notes}
            </p>
          </div>
        )}

        {/* Bump button — always visible but disabled if not all items are ready */}
        <button
          onClick={handleBump}
          disabled={!allReady || bumping}
          className={[
            'mt-4 w-full py-4 rounded-xl font-black text-lg uppercase tracking-tight',
            'flex items-center justify-center gap-2 transition-all active:scale-[0.97]',
            !allReady || bumping
              ? 'bg-surface2 text-muted opacity-50 cursor-not-allowed'
              : 'bg-brand-success text-brand-black hover:bg-brand-success/90 shadow-lg shadow-brand-success/20',
          ].join(' ')}
        >
          {bumping ? (
            <SpinnerIcon className="w-6 h-6 animate-spin" />
          ) : (
            <>
              <CheckAllIcon className="w-6 h-6" />
              {t('bumpOrder')}
            </>
          )}
        </button>
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
