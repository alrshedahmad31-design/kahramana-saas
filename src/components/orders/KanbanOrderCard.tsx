'use client'

import { useState, useEffect, useTransition } from 'react'
import { useLocale } from 'next-intl'
import { formatDistanceToNow } from 'date-fns'
import { ar as arLocale } from 'date-fns/locale'
import { updateOrderStatus } from '@/app/[locale]/dashboard/orders/actions'
import { buildCustomerContactLink } from '@/lib/whatsapp'
import { ALLOWED_TRANSITIONS } from '@/lib/auth/permissions'
import { BRANCHES } from '@/constants/contact'
import type { OrderCardData } from './OrderCard'
import type { OrderStatus, StaffRole } from '@/lib/supabase/custom-types'

// Simplified advance map for kanban one-click actions
const KANBAN_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  new:              'accepted',
  under_review:     'accepted',
  accepted:         'preparing',
  preparing:        'ready',
  ready:            'out_for_delivery',
  out_for_delivery: 'delivered',
}

const ADVANCE_AR: Partial<Record<OrderStatus, string>> = {
  new:              'قبول الطلب',
  under_review:     'قبول الطلب',
  accepted:         'بدء التحضير',
  preparing:        'جاهز للتسليم',
  ready:            'خرج للتسليم',
  out_for_delivery: 'تم التسليم',
}

const ADVANCE_EN: Partial<Record<OrderStatus, string>> = {
  new:              'Accept',
  under_review:     'Accept',
  accepted:         'Start Prep',
  preparing:        'Mark Ready',
  ready:            'Out for Delivery',
  out_for_delivery: 'Mark Delivered',
}

const BORDER_CLS: Partial<Record<OrderStatus, string>> = {
  new:              'border-brand-error',
  under_review:     'border-brand-error',
  accepted:         'border-brand-gold',
  preparing:        'border-brand-gold',
  ready:            'border-brand-success',
  out_for_delivery: 'border-brand-success',
  delivered:        'border-brand-border',
  completed:        'border-brand-border',
  cancelled:        'border-brand-border',
  payment_failed:   'border-brand-error',
}

interface Props {
  order:          OrderCardData
  userRole:       StaffRole | null
  onStatusChange: (orderId: string, next: OrderStatus) => void
  onViewDetails:  (id: string) => void
}

export default function KanbanOrderCard({ order, userRole: _userRole, onStatusChange, onViewDetails }: Props) {
  const locale   = useLocale()
  const isAr     = locale === 'ar'
  const [pending, startTransition] = useTransition()
  const [timeAgo,  setTimeAgo]  = useState('')
  const [elapsed,  setElapsed]  = useState(0) // minutes since order placed
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    const update = () => {
      const mins = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60_000)
      setElapsed(mins)
      setTimeAgo(
        formatDistanceToNow(new Date(order.created_at), {
          addSuffix: true,
          locale: isAr ? arLocale : undefined,
        })
      )
    }
    update()
    const id = setInterval(update, 30_000)
    return () => clearInterval(id)
  }, [order.created_at, isAr])

  const nextStatus = KANBAN_NEXT[order.status]
  const canAdvance = !!nextStatus && (ALLOWED_TRANSITIONS[order.status] ?? []).includes(nextStatus)

  const handleAdvance = () => {
    if (!nextStatus || !canAdvance) return
    setError(null)
    startTransition(async () => {
      const result = await updateOrderStatus(order.id, nextStatus)
      if (result.success) {
        onStatusChange(order.id, nextStatus)
      } else {
        setError(result.error)
      }
    })
  }

  const isUrgent   = elapsed >= 20 && ['new', 'under_review', 'accepted', 'preparing'].includes(order.status)
  const borderCls  = BORDER_CLS[order.status] ?? 'border-brand-border'
  const shortId    = order.id.slice(-6).toUpperCase()
  const branch     = BRANCHES[order.branch_id as keyof typeof BRANCHES]
  const previewItems = order.order_items.slice(0, 3)
  const extraCount = order.order_items.length - 3
  const waLink     = order.customer_phone ? buildCustomerContactLink(order.customer_phone) : null
  const font       = isAr ? 'font-almarai' : 'font-satoshi'
  const address    = formatOrderAddress(order)
  const customerNote = order.customer_notes ?? order.notes ?? null

  return (
    <article
      className={`bg-brand-surface border-2 ${borderCls} rounded-xl flex flex-col overflow-hidden
        transition-all duration-300 hover:shadow-md hover:shadow-brand-gold/10
        ${isUrgent ? 'shadow-lg shadow-brand-error/20' : ''}`}
    >
      {/* Urgent pulse strip */}
      {isUrgent && <div className="h-0.5 bg-brand-error animate-pulse w-full" />}

      {/* Header row */}
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2">
        <span className="font-satoshi font-black text-base text-brand-text tabular-nums tracking-tight">
          #{shortId}
        </span>
        <span className={`text-[10px] tabular-nums ${elapsed >= 20 ? 'text-brand-error font-black' : 'text-brand-muted'} ${font}`}>
          ⏱ {timeAgo}
        </span>
      </div>

      <div className="h-px bg-brand-border/60 mx-4" />

      {/* Customer block */}
      <div className="px-4 py-3 flex flex-col gap-1">
        <p className={`font-bold text-brand-text text-sm leading-snug ${font}`}>
          {order.customer_name ?? (isAr ? 'عميل' : 'Guest')}
        </p>
        {order.customer_phone && (
          <p className="font-satoshi text-xs text-brand-muted tabular-nums" dir="ltr">
            {order.customer_phone}
          </p>
        )}
        {branch && (
          <p className={`text-[10px] text-brand-muted/60 ${font}`}>
            {isAr ? branch.nameAr : branch.nameEn}
          </p>
        )}
        {address && (
          <p className={`text-[11px] text-brand-muted leading-relaxed line-clamp-2 ${font}`}>
            {address}
          </p>
        )}
        {customerNote && (
          <p className={`rounded-md border border-brand-gold/20 bg-brand-gold/5 px-2 py-1 text-[11px] text-brand-text leading-relaxed line-clamp-2 ${font}`}>
            {customerNote}
          </p>
        )}
      </div>

      {/* Items */}
      {previewItems.length > 0 && (
        <div className="px-4 pb-3 pt-2 border-t border-brand-border/40 flex flex-col gap-1">
          {previewItems.map((item, i) => (
            <div key={i} className="flex items-baseline gap-1.5 text-xs">
              <span className="font-satoshi font-black text-brand-gold tabular-nums shrink-0">×{item.quantity}</span>
              <span className={`text-brand-text leading-snug ${font}`}>
                {isAr ? item.name_ar : item.name_en}
              </span>
            </div>
          ))}
          {extraCount > 0 && (
            <p className={`text-[10px] text-brand-muted/60 ${font}`}>
              +{extraCount} {isAr ? 'أصناف أخرى' : 'more items'}
            </p>
          )}
        </div>
      )}

      {/* Total row */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 mt-auto border-t border-brand-border/40">
        <span className={`text-[10px] text-brand-muted ${font}`}>
          {isAr ? 'المجموع' : 'Total'}
        </span>
        <span className="font-satoshi font-black text-xl text-brand-gold tabular-nums">
          {Number(order.total_bhd).toFixed(3)}{' '}
          <span className={`text-xs font-normal text-brand-muted ${font}`}>{isAr ? 'د.ب' : 'BD'}</span>
        </span>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 pt-2 flex flex-col gap-2">
        {canAdvance && nextStatus && (
          <button
            type="button"
            disabled={pending}
            onClick={handleAdvance}
            className={`w-full py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-all duration-150 active:scale-95
              disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2
              ${isUrgent
                ? 'bg-brand-error text-brand-text hover:opacity-90'
                : 'bg-brand-gold text-brand-black hover:bg-brand-gold-light'}
              ${font}`}
          >
            {pending
              ? <span className="w-4 h-4 rounded border-2 border-current/30 border-t-current animate-spin" />
              : (isAr ? ADVANCE_AR[order.status] : ADVANCE_EN[order.status])}
          </button>
        )}
        {error && (
          <p className={`text-xs text-brand-error ${font}`}>{error}</p>
        )}

        {/* Secondary: View / Call / WhatsApp */}
        <div className={`grid gap-1.5 ${[waLink, order.customer_phone].filter(Boolean).length === 2 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <button
            type="button"
            onClick={() => onViewDetails(order.id)}
            className={`flex items-center justify-center gap-1 py-2 rounded-lg bg-brand-surface-2 border border-brand-border
              text-brand-muted hover:text-brand-gold hover:border-brand-gold/40 transition-colors duration-150 text-xs ${font}`}
          >
            <EyeIcon />
            <span>{isAr ? 'عرض' : 'View'}</span>
          </button>
          {order.customer_phone && (
            <a
              href={`tel:${order.customer_phone}`}
              className={`flex items-center justify-center gap-1 py-2 rounded-lg bg-brand-surface-2 border border-brand-border
                text-brand-muted hover:text-brand-success hover:border-brand-success/30 transition-colors duration-150 text-xs ${font}`}
            >
              <PhoneIcon />
              <span>{isAr ? 'اتصال' : 'Call'}</span>
            </a>
          )}
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center justify-center gap-1 py-2 rounded-lg bg-brand-surface-2 border border-brand-border
                text-brand-muted hover:text-brand-success hover:border-brand-success/30 transition-colors duration-150 text-xs ${font}`}
            >
              <WhatsAppIcon />
              <span>WA</span>
            </a>
          )}
        </div>
      </div>
    </article>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function formatOrderAddress(order: OrderCardData): string | null {
  if (order.delivery_address) return order.delivery_address
  const parts = [order.delivery_building, order.delivery_street].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
}

function EyeIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}
