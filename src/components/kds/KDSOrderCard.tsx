'use client'

import { useState, useEffect } from 'react'
import type { KDSOrder } from '@/lib/supabase/custom-types'
import { getAgeStatus, formatElapsed } from '@/lib/kds/priorities'

type ActiveStatus = 'accepted' | 'preparing' | 'ready'

interface Props {
  order:     KDSOrder
  isRTL:     boolean
  onAdvance: (orderId: string, status: ActiveStatus) => Promise<void>
}

const AGE_BORDER: Record<ReturnType<typeof getAgeStatus>, string> = {
  fresh:   'border-brand-success',
  warning: 'border-brand-gold',
  overdue: 'border-brand-error',
}

const AGE_TIMER: Record<ReturnType<typeof getAgeStatus>, string> = {
  fresh:   'text-brand-success',
  warning: 'text-brand-gold',
  overdue: 'text-brand-error',
}

const AGE_HEADER: Record<ReturnType<typeof getAgeStatus>, string> = {
  fresh:   'bg-brand-success/10',
  warning: 'bg-brand-gold/10',
  overdue: 'bg-brand-error/10',
}

const BTN: Record<ActiveStatus, { en: string; ar: string; cls: string }> = {
  accepted:  { en: 'Start Prep', ar: 'ابدأ التحضير', cls: 'bg-brand-gold    text-brand-black hover:bg-brand-gold-light' },
  preparing: { en: 'Mark Ready', ar: 'جاهز',          cls: 'bg-brand-success text-brand-black hover:opacity-90' },
  ready:     { en: 'Complete',   ar: 'تم',             cls: 'bg-brand-surface-2 text-brand-muted border border-brand-border' },
}

export default function KDSOrderCard({ order, isRTL, onAdvance }: Props) {
  const [elapsed,   setElapsed]   = useState(() => formatElapsed(order.created_at))
  const [ageStatus, setAgeStatus] = useState(() => getAgeStatus(order.created_at))
  const [bumping,   setBumping]   = useState(false)

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(formatElapsed(order.created_at))
      setAgeStatus(getAgeStatus(order.created_at))
    }, 1_000)
    return () => clearInterval(id)
  }, [order.created_at])

  async function handleAdvance() {
    if (bumping) return
    setBumping(true)
    await onAdvance(order.id, order.status)
    setBumping(false)
  }

  const btn       = BTN[order.status]
  const isOverdue = ageStatus === 'overdue'
  const shortId   = order.id.slice(-4).toUpperCase()
  const font      = isRTL ? 'font-almarai' : 'font-satoshi'

  return (
    <article
      className={`
        flex flex-col rounded-2xl border-4 bg-brand-surface overflow-hidden
        transition-all duration-300
        ${AGE_BORDER[ageStatus]}
        ${isOverdue ? 'shadow-2xl shadow-brand-error/20' : ''}
      `}
    >
      {/* Urgent pulse strip */}
      {isOverdue && (
        <div className="h-1.5 w-full bg-brand-error animate-pulse shrink-0" />
      )}

      {/* ── Header: timer + order# ─────────────────────────────────────── */}
      <div className={`flex items-start justify-between gap-4 px-5 pt-4 pb-3 ${AGE_HEADER[ageStatus]}`}>
        {/* Timer — 6 rem, readable from 3 m */}
        <div className="flex flex-col">
          <span
            className={`font-satoshi font-black tabular-nums leading-none ${AGE_TIMER[ageStatus]}
              ${isOverdue ? 'animate-pulse' : ''} text-8xl`}
          >
            {elapsed}
          </span>
          {isOverdue && (
            <div className="flex items-center gap-1.5 mt-2">
              <AlertIcon className="w-6 h-6 text-brand-error shrink-0" />
              <span className={`font-black text-brand-error text-xl uppercase tracking-wider ${font}`}>
                {isRTL ? 'عاجل!' : 'URGENT!'}
              </span>
            </div>
          )}
          {ageStatus === 'warning' && (
            <span className={`text-brand-gold text-base font-bold mt-1 ${font}`}>
              {isRTL ? '⚠ تأخر تحذيري' : '⚠ Running late'}
            </span>
          )}
        </div>

        {/* Order number — 3 rem */}
        <div className="text-end shrink-0">
          <div className="font-satoshi font-black text-5xl text-brand-text tabular-nums leading-none">
            #{shortId}
          </div>
          {order.customer_name && (
            <div className={`text-xl text-brand-muted mt-1 truncate max-w-[160px] ${font}`}>
              {order.customer_name}
            </div>
          )}
        </div>
      </div>

      <div className="h-px bg-brand-border/60 mx-5" />

      {/* ── Items — 1.5 rem ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 px-5 py-4">
        {(order.order_items ?? []).map((item, i) => (
          <div key={item.id ?? i} className="flex items-start gap-4 rounded-xl bg-brand-surface-2 border border-brand-border px-4 py-3">
            {/* Quantity badge */}
            <div className="w-16 h-16 rounded-xl bg-brand-gold text-brand-black font-satoshi font-black text-3xl tabular-nums flex items-center justify-center shrink-0">
              ×{item.quantity}
            </div>

            {/* Name + modifiers */}
            <div className="flex-1 min-w-0 pt-1">
              <div className="font-cairo font-black text-2xl text-brand-text leading-tight">
                {item.name_ar}
              </div>
              <div className={`font-satoshi text-lg text-brand-muted mt-0.5 leading-tight`}>
                {item.name_en}
              </div>
              {(item.selected_size || item.selected_variant) && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {item.selected_size && (
                    <span className="bg-brand-gold/20 border border-brand-gold/40 text-brand-gold font-satoshi font-bold text-sm px-3 py-1 rounded-lg">
                      {item.selected_size}
                    </span>
                  )}
                  {item.selected_variant && (
                    <span className={`bg-brand-gold/20 border border-brand-gold/40 text-brand-gold font-bold text-sm px-3 py-1 rounded-lg ${font}`}>
                      {item.selected_variant}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Special request (notes) — red highlighted box ────────────── */}
      {order.notes && (
        <div className="mx-5 mb-4 rounded-xl border-2 border-brand-error bg-brand-error/10 px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <FlameIcon className="w-5 h-5 text-brand-error shrink-0" />
            <span className={`font-black text-brand-error text-sm uppercase tracking-wider ${font}`}>
              {isRTL ? 'ملاحظة خاصة:' : 'Special Request:'}
            </span>
          </div>
          <p className={`text-brand-text text-xl leading-snug ${font}`}>
            {order.notes}
          </p>
        </div>
      )}

      {/* ── Bump button — huge ─────────────────────────────────────────── */}
      <div className="px-5 pb-5 pt-1">
        <button
          type="button"
          onClick={handleAdvance}
          disabled={bumping}
          className={`
            w-full min-h-[80px] rounded-2xl font-black text-4xl
            transition-all duration-150 active:scale-[0.98]
            disabled:opacity-50 disabled:cursor-not-allowed
            ${font} ${btn.cls}
          `}
        >
          {bumping
            ? <span className="w-8 h-8 rounded-full border-4 border-current/30 border-t-current animate-spin inline-block" />
            : (isRTL ? btn.ar : btn.en)}
        </button>
      </div>
    </article>
  )
}

// ── Inline icons ──────────────────────────────────────────────────────────────

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  )
}

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
    </svg>
  )
}
