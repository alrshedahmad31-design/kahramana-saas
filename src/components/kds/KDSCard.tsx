'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import type { KDSQueueItem, KDSStatus } from '@/lib/supabase/custom-types'
import { getAgeStatus, formatElapsed } from '@/lib/kds/priorities'
import LuxuryIcon from '@/components/icons/LuxuryIcon'

interface Props {
  item:   KDSQueueItem
  onBump: (id: string, status: KDSStatus) => Promise<void>
}

const AGE_RING = {
  fresh:   'border-brand-success',
  warning: 'border-brand-gold',
  overdue: 'border-brand-error',
} as const

const AGE_TIMER = {
  fresh:   'text-brand-success',
  warning: 'text-brand-gold',
  overdue: 'text-brand-error',
} as const

const AGE_BG = {
  fresh:   '',
  warning: '',
  overdue: 'animate-pulse',
} as const

export default function KDSCard({ item, onBump }: Props) {
  const t = useTranslations('kds')

  const [elapsed,    setElapsed]    = useState(() => formatElapsed(item.created_at))
  const [ageStatus,  setAgeStatus]  = useState(() => getAgeStatus(item.created_at))
  const [bumping,    setBumping]    = useState(false)

  // Live timer — updates every second
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(formatElapsed(item.created_at))
      setAgeStatus(getAgeStatus(item.created_at))
    }, 1000)
    return () => clearInterval(id)
  }, [item.created_at])

  const isFinished = item.status === 'ready' || item.status === 'delivered'

  async function handleBump() {
    if (bumping || isFinished) return
    setBumping(true)
    await onBump(item.id, item.status as KDSStatus)
    setBumping(false)
  }

  const oi = item.order_items
  const o  = item.orders

  return (
    <div
      className={`relative flex flex-col gap-4 rounded-xl border-2 p-5
                  bg-brand-surface
                  ${AGE_RING[ageStatus]}
                  ${AGE_BG[ageStatus]}
                  transition-all duration-500`}
    >
      {/* ── Top row: order # + elapsed timer ─────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="font-satoshi font-black text-xl text-brand-text tabular-nums">
            #{item.order_id.slice(0, 6).toUpperCase()}
          </span>
          {o.customer_name && (
            <p className="font-almarai text-sm text-brand-muted mt-0.5 truncate max-w-[140px]">
              {o.customer_name}
            </p>
          )}
        </div>
        <span
          className={`font-satoshi font-black text-2xl tabular-nums
                      ${AGE_TIMER[ageStatus]}`}
        >
          {elapsed}
        </span>
      </div>

      {/* ── Item name ─────────────────────────────────────────────────────── */}
      <div>
        <p className="font-cairo font-black text-2xl text-brand-text leading-tight">
          {oi.name_ar}
        </p>
        <p className="font-satoshi text-sm text-brand-muted mt-0.5">
          {oi.name_en}
        </p>
      </div>

      {/* ── Quantity + size / variant ──────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <span className="font-satoshi font-black text-4xl text-brand-gold tabular-nums">
          ×{oi.quantity}
        </span>
        <div className="flex flex-col gap-0.5">
          {oi.selected_size && (
            <span className="font-satoshi text-sm text-brand-muted">
              {oi.selected_size}
            </span>
          )}
          {oi.selected_variant && (
            <span className="font-almarai text-sm text-brand-muted">
              {oi.selected_variant}
            </span>
          )}
        </div>
      </div>

      {/* ── Order notes ───────────────────────────────────────────────────── */}
      {o.notes && (
        <div className="rounded-lg bg-brand-surface-2 px-4 py-3">
          <p className="font-almarai text-base text-brand-text leading-snug">
            {o.notes}
          </p>
        </div>
      )}

      {/* ── Status + Bump button ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-1">
        {/* Status pill */}
        <span
          className={`shrink-0 font-satoshi text-sm font-medium rounded-lg px-3 py-1.5
                      ${item.status === 'pending'
                        ? 'bg-brand-surface-2 text-brand-muted'
                        : item.status === 'preparing'
                          ? 'bg-brand-gold/20 text-brand-gold'
                          : 'bg-brand-success/20 text-brand-success'
                      }`}
        >
          {item.status === 'pending'
            ? t('statusPending')
            : item.status === 'preparing'
              ? t('statusPreparing')
              : t('statusReady')
          }
        </span>

        {/* Bump button */}
        {!isFinished && (
          <button
            type="button"
            onClick={handleBump}
            disabled={bumping}
            className={`flex-1 font-satoshi font-black text-xl min-h-[56px] rounded-xl
                        transition-all duration-150 active:scale-95
                        disabled:opacity-40 disabled:cursor-not-allowed
                        ${bumping
                          ? 'bg-brand-surface-2 text-brand-muted'
                          : item.status === 'pending'
                            ? 'bg-brand-gold text-brand-black hover:bg-brand-gold-light'
                            : 'bg-brand-success text-brand-black hover:opacity-90'
                        }`}
          >
            {bumping
              ? '...'
              : item.status === 'pending'
                ? t('bumpStart')
                : t('bump')
            }
          </button>
        )}

        {isFinished && (
          <div className="flex-1 flex items-center justify-center min-h-[56px] rounded-xl
                          bg-brand-success/15 font-satoshi font-bold text-brand-success text-xl gap-2">
            <LuxuryIcon name="check" size={20} />
            {t('statusReady')}
          </div>
        )}
      </div>
    </div>
  )
}
