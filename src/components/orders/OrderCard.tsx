'use client'

import { useTranslations } from 'next-intl'
import StatusBadge from '@/components/dashboard/StatusBadge'
import { BRANCHES } from '@/constants/contact'
import type { OrderStatus } from '@/lib/supabase/custom-types'

export interface OrderCardItem {
  name_ar:          string
  name_en:          string
  quantity:         number
  selected_size:    string | null
  selected_variant: string | null
}

export interface OrderCardData {
  id:              string
  customer_name:   string | null
  customer_phone:  string | null
  branch_id:       string
  status:          OrderStatus
  total_bhd:       number
  created_at:      string
  order_items:     OrderCardItem[]
}

interface Props {
  order:         OrderCardData
  isRTL:         boolean
  onViewDetails: (id: string) => void
}

export default function OrderCard({ order, isRTL, onViewDetails }: Props) {
  const t  = useTranslations('dashboard')
  const tS = useTranslations('order.status')
  const tC = useTranslations('common')

  const branch      = BRANCHES[order.branch_id as keyof typeof BRANCHES]
  const shortId     = order.id.slice(-8).toUpperCase()
  const previewItems = order.order_items.slice(0, 2)
  const extraCount  = order.order_items.length - 2

  const formattedDate = new Date(order.created_at).toLocaleString('en-BH', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="flex flex-col rounded-xl border border-brand-border bg-brand-surface overflow-hidden hover:border-brand-gold/40 transition-colors duration-200">

      {/* Header: ID + status */}
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <span className="font-satoshi font-black text-base text-brand-text tabular-nums tracking-tight">
          #{shortId}
        </span>
        <StatusBadge status={order.status} label={tS(order.status)} />
      </div>

      <div className="h-px bg-brand-border" />

      {/* Customer + branch */}
      <div className="px-4 py-3 flex flex-col gap-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <UserIcon />
            <span className={`text-sm font-medium text-brand-text truncate ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
              {order.customer_name ?? t('customerGuest')}
            </span>
          </div>
          {order.customer_phone && (
            <div className="flex items-center gap-1.5 shrink-0">
              <PhoneSmIcon />
              <span className="font-satoshi text-xs text-brand-muted tabular-nums" dir="ltr">
                {order.customer_phone}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <BranchIcon />
            <span className={`text-xs text-brand-muted truncate ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
              {branch ? (isRTL ? branch.nameAr : branch.nameEn) : order.branch_id}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <ClockIcon />
            <span className="font-satoshi text-xs text-brand-muted tabular-nums whitespace-nowrap">
              {formattedDate}
            </span>
          </div>
        </div>
      </div>

      {/* Items preview */}
      {previewItems.length > 0 && (
        <div className="px-4 pb-3 flex flex-col gap-1">
          {previewItems.map((item, i) => {
            const variant = [item.selected_size, item.selected_variant].filter(Boolean).join(', ')
            return (
              <div key={i} className="flex items-baseline gap-2 text-sm">
                <span className="font-satoshi font-black text-brand-gold tabular-nums shrink-0 w-5 text-end leading-none">
                  ×{item.quantity}
                </span>
                <span className={`text-brand-text leading-snug ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                  {isRTL ? item.name_ar : item.name_en}
                  {variant && (
                    <span className="text-brand-muted text-xs ms-1">({variant})</span>
                  )}
                </span>
              </div>
            )
          })}
          {extraCount > 0 && (
            <p className="font-satoshi text-xs text-brand-muted/60 ps-7">
              {isRTL ? `+${extraCount} أصناف أخرى` : `+${extraCount} more items`}
            </p>
          )}
        </div>
      )}

      {/* Total + actions */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-brand-border mt-auto">
        <span className="font-satoshi font-black text-xl text-brand-gold tabular-nums">
          {Number(order.total_bhd).toFixed(3)}{' '}
          <span className="font-normal text-sm text-brand-muted">{tC('currency')}</span>
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onViewDetails(order.id)}
            className="flex items-center gap-1 min-h-[36px] px-2.5 rounded-lg bg-brand-surface-2 border border-brand-border text-brand-muted hover:text-brand-gold hover:border-brand-gold/40 transition-colors duration-150 font-satoshi text-sm"
          >
            <EyeIcon />
            <span className={isRTL ? 'font-almarai' : ''}>{isRTL ? 'عرض' : 'View'}</span>
          </button>
          {order.customer_phone && (
            <a
              href={`tel:${order.customer_phone}`}
              className="flex items-center gap-1 min-h-[36px] px-2.5 rounded-lg bg-brand-surface-2 border border-brand-border text-brand-muted hover:text-brand-success hover:border-brand-success/30 transition-colors duration-150 font-satoshi text-sm"
              aria-label={isRTL ? 'اتصال' : 'Call'}
            >
              <PhoneIcon />
              <span className={isRTL ? 'font-almarai' : ''}>{isRTL ? 'اتصال' : 'Call'}</span>
            </a>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1 min-h-[36px] px-2.5 rounded-lg bg-brand-surface-2 border border-brand-border text-brand-muted hover:text-brand-text hover:border-brand-border transition-colors duration-150 font-satoshi text-sm"
            aria-label={isRTL ? 'طباعة' : 'Print'}
          >
            <PrintIcon />
            <span className={isRTL ? 'font-almarai' : ''}>{isRTL ? 'طباعة' : 'Print'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function UserIcon() {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-brand-muted shrink-0" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  )
}

function PhoneSmIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-brand-muted shrink-0" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
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

function BranchIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-brand-muted shrink-0" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 2.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-brand-muted shrink-0" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function PrintIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.056 48.056 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
    </svg>
  )
}
