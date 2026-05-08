'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { KDSOrder, KDSStation, KDSItemStatus } from '@/lib/supabase/custom-types'
import { SIZE_LABELS } from '@/lib/cart'
import { getAgeStatus, formatElapsed } from '@/lib/kds/priorities'
import { updateItemStatus } from '@/app/[locale]/dashboard/kds/actions'
import { STATION_CONFIG } from '@/constants/kds'

interface Props {
  order: KDSOrder
  station: KDSStation
  locale: string
}

export default function KDSStationOrderCard({ order, station, locale }: Props) {
  const isRTL = locale === 'ar'
  const [elapsed, setElapsed] = useState(() => formatElapsed(order.created_at))
  const [ageStatus, setAgeStatus] = useState(() => getAgeStatus(order.created_at))
  const [updating, setUpdating] = useState<string | null>(null)

  const stationConfig = STATION_CONFIG[station] || STATION_CONFIG['main']!
  const font = isRTL ? 'font-almarai' : 'font-satoshi'

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(formatElapsed(order.created_at))
      setAgeStatus(getAgeStatus(order.created_at))
    }, 1_000)
    return () => clearInterval(id)
  }, [order.created_at])

  const items = order.order_items || []

  // Progress: preparing = 0.5, ready/completed = 1.0
  const progressValue = items.reduce((acc, item) => {
    if (item.station_status === 'ready' || item.station_status === 'completed') return acc + 1
    if (item.station_status === 'preparing') return acc + 0.5
    return acc
  }, 0)
  const progress = items.length > 0 ? (progressValue / items.length) * 100 : 0

  // Three-state cycle: pending → preparing → ready
  function nextStatusFor(current?: KDSItemStatus): KDSItemStatus {
    if (current === 'pending' || !current) return 'preparing'
    if (current === 'preparing')           return 'ready'
    return 'preparing' // ready → tap again → back to preparing (undo)
  }

  async function handleItemToggle(itemId: string, currentStatus?: KDSItemStatus) {
    if (updating) return
    setUpdating(itemId)
    try {
      const result = await updateItemStatus(order.id, itemId, station, nextStatusFor(currentStatus))
      if (!result.success) console.error('Failed to update item status:', result.error)
    } catch (err) {
      console.error('Error updating item:', err)
    } finally {
      setUpdating(null)
    }
  }

  const shortId = order.id.slice(-4).toUpperCase()

  return (
    <article
      className={`
        flex flex-col rounded-2xl border-2 bg-surface overflow-hidden
        transition-all duration-300 shadow-lg
        ${ageStatus === 'overdue' ? 'border-error ring-2 ring-error/20' : 'border-border'}
      `}
    >
      {/* Station Progress Bar */}
      <div className="h-2 w-full bg-surface2 overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="h-full transition-all"
          style={{ backgroundColor: stationConfig.color }}
        />
      </div>

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className={`text-4xl font-black tabular-nums ${ageStatus === 'overdue' ? 'text-brand-error' : 'text-brand-text'}`}>
              {elapsed}
            </div>
            <div className={`text-sm text-muted mt-1 ${font}`}>
              {order.order_type === 'delivery' ? (isRTL ? 'توصيل' : 'Delivery') : (isRTL ? 'محلي' : 'Dine-in')}
            </div>
          </div>
          <div className="text-end">
            <div className="text-3xl font-black text-gold">#{shortId}</div>
            <div className={`text-sm text-muted truncate max-w-[120px] ${font}`}>
              {order.customer_name || (isRTL ? 'عميل' : 'Guest')}
            </div>
          </div>
        </div>

        {/* Items List */}
        <div className="flex flex-col gap-2">
          {items.map((item) => {
            const st = item.station_status
            const isPreparing = st === 'preparing'
            const isReady     = st === 'ready' || st === 'completed'
            const isUpdating  = updating === item.id

            return (
              <button
                key={item.id}
                onClick={() => handleItemToggle(item.id, st)}
                disabled={!!updating}
                className={`
                  flex items-center gap-4 p-3 rounded-xl border transition-all text-start
                  ${isReady
                    ? 'bg-brand-success/10 border-brand-success/30 opacity-60'
                    : isPreparing
                    ? 'bg-brand-gold/10 border-brand-gold/40'
                    : 'bg-brand-surface-2 border-brand-border hover:border-brand-gold/50'}
                  ${isUpdating ? 'animate-pulse' : ''}
                `}
              >
                {/* Quantity badge — W6 fix: 44px */}
                <div className={`
                  w-11 h-11 rounded-lg flex items-center justify-center font-black text-lg tabular-nums shrink-0
                  ${isReady ? 'bg-brand-success text-black' : isPreparing ? 'bg-brand-gold text-black' : 'bg-brand-gold text-black'}
                `}>
                  {item.quantity}
                </div>

                <div className="flex-1 min-w-0">
                  <div className={`text-lg font-bold leading-tight truncate ${isReady ? 'line-through text-brand-muted' : 'text-brand-text'}`}>
                    {isRTL ? item.name_ar : item.name_en}
                  </div>
                  {(item.selected_size || item.selected_variant) && (
                    <div className="text-xs text-brand-muted mt-0.5">
                      {item.selected_size && (SIZE_LABELS[item.selected_size]?.[isRTL ? 'ar' : 'en'] ?? item.selected_size)}
                      {item.selected_size && item.selected_variant && ' • '}
                      {item.selected_variant}
                    </div>
                  )}
                  {item.notes && (
                    <div className={`text-xs text-brand-error mt-1 font-bold ${font}`}>
                      {isRTL ? 'ملاحظة: ' : 'Note: '}{item.notes}
                    </div>
                  )}
                </div>

                <div className="shrink-0">
                  {isReady ? (
                    <CheckIcon className="w-6 h-6 text-brand-success" />
                  ) : isPreparing ? (
                    <SpinnerIcon className="w-6 h-6 text-brand-gold animate-spin" />
                  ) : (
                    <div className="w-6 h-6 rounded-full border-2 border-brand-border" />
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="mt-4 p-3 rounded-xl bg-error/10 border border-error/30">
            <p className={`text-error text-sm font-bold ${font}`}>
              {isRTL ? 'ملاحظة:' : 'Note:'} {order.notes}
            </p>
          </div>
        )}
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

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}
