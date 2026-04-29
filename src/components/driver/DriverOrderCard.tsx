'use client'

import { useState, useEffect }         from 'react'
import { BRANCHES }                    from '@/constants/contact'
import { haversine, estimateETA, formatDistance, mapsDirectionsUrl } from '@/lib/utils/distance'
import type { DriverOrder }            from '@/lib/supabase/types'
import type { BranchId }               from '@/constants/contact'

type DriverActiveStatus = 'ready' | 'out_for_delivery'

interface Props {
  order:         DriverOrder
  isRTL:         boolean
  branchMapsUrl: string | null
  variant?:      'active' | 'completed'
  onAction?:     (id: string, status: DriverActiveStatus) => Promise<void>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatElapsed(createdAt: string): string {
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function formatTime(iso: string): string {
  const d    = new Date(iso)
  const h    = String(d.getHours() % 12 || 12).padStart(2, '0')
  const m    = String(d.getMinutes()).padStart(2, '0')
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM'
  return `${h}:${m} ${ampm}`
}

const PAYMENT_LABEL: Record<string, { en: string; ar: string; icon: string }> = {
  cash:       { en: 'Cash on delivery', ar: 'كاش عند التسليم', icon: '💵' },
  benefit_qr: { en: 'BenefitPay',       ar: 'بنفت باي',        icon: '📱' },
  tap_card:   { en: 'Card',             ar: 'بطاقة',            icon: '💳' },
  tap_knet:   { en: 'KNET',             ar: 'كي-نت',            icon: '💳' },
}

// ── Distance badge ────────────────────────────────────────────────────────────

function DistanceBadge({ distanceKm, isRTL }: { distanceKm: number; isRTL: boolean }) {
  const eta = estimateETA(distanceKm)
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <span className="flex items-center gap-1 rounded-md bg-brand-black/50 border border-brand-border px-2 py-0.5">
        <RulerIcon />
        <span className="font-satoshi text-xs text-brand-muted tabular-nums">{formatDistance(distanceKm)}</span>
      </span>
      <span className="flex items-center gap-1 rounded-md bg-brand-black/50 border border-brand-border px-2 py-0.5">
        <ClockTinyIcon />
        <span className={`text-xs text-brand-muted tabular-nums ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
          {isRTL ? `${eta} د` : `${eta} min`}
        </span>
      </span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DriverOrderCard({ order, isRTL, branchMapsUrl, variant = 'active', onAction }: Props) {
  const [elapsed, setElapsed] = useState(() => formatElapsed(order.created_at))
  const [busy,    setBusy]    = useState(false)

  const isCompleted = variant === 'completed'
  const isReady     = order.status === 'ready'
  const isOnRoad    = order.status === 'out_for_delivery'

  useEffect(() => {
    if (isCompleted) return
    const id = setInterval(() => setElapsed(formatElapsed(order.created_at)), 1_000)
    return () => clearInterval(id)
  }, [order.created_at, isCompleted])

  async function handleAction() {
    if (busy || (!isReady && !isOnRoad) || !onAction) return
    setBusy(true)
    await onAction(order.id, order.status as DriverActiveStatus)
    setBusy(false)
  }

  const branch       = BRANCHES[order.branch_id as BranchId] ?? null
  const branchName   = branch ? (isRTL ? branch.nameAr : branch.nameEn) : order.branch_id
  const branchAddr   = branch ? (isRTL ? branch.addressAr : branch.addressEn) : null
  const paymentEntry = order.payments?.[0]
  const paymentInfo  = paymentEntry ? PAYMENT_LABEL[paymentEntry.method] : null

  // Delivery address: prefer explicit field, fall back to notes
  const deliveryAddrText  = order.delivery_address ?? order.notes ?? null
  const deliveryInstructions = order.delivery_instructions ?? null

  // Navigation URLs
  const branchNavUrl   = branch?.latitude != null && branch?.longitude != null
    ? mapsDirectionsUrl(`${branch.latitude},${branch.longitude}`)
    : branchMapsUrl
  const customerNavUrl = order.delivery_lat != null && order.delivery_lng != null
    ? mapsDirectionsUrl(`${order.delivery_lat},${order.delivery_lng}`)
    : deliveryAddrText
      ? mapsDirectionsUrl(deliveryAddrText)
      : null

  // Delivery leg distance (branch → customer) — shows on both ready and on-road cards
  const deliveryDistance = (
    branch?.latitude != null && branch?.longitude != null &&
    order.delivery_lat != null && order.delivery_lng != null
  )
    ? haversine(branch.latitude, branch.longitude, order.delivery_lat, order.delivery_lng)
    : null

  return (
    <div className={`
      flex flex-col rounded-xl border-2 bg-brand-surface
      transition-all duration-300
      ${isCompleted
        ? 'border-brand-border opacity-70'
        : isOnRoad
          ? 'border-brand-success/60 shadow-[0_0_24px_rgba(39,174,96,0.10)]'
          : 'border-brand-gold/40'
      }
    `}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 border-b border-brand-border/60">
        <div className="flex items-center gap-2.5">
          <span className="font-satoshi font-black text-2xl text-brand-text tabular-nums leading-none">
            #{order.id.slice(-4).toUpperCase()}
          </span>
          <span className="font-satoshi text-sm text-brand-muted tabular-nums">
            {isCompleted ? formatTime(order.updated_at) : elapsed}
          </span>
        </div>

        {isCompleted ? (
          <span className="flex items-center gap-1.5 text-xs font-satoshi font-black rounded-lg px-3 py-1.5 bg-brand-surface-2 text-brand-muted border border-brand-border">
            <CheckIcon />
            {isRTL ? 'تم التسليم' : 'Delivered'}
          </span>
        ) : (
          <span className={`
            text-xs font-satoshi font-black rounded-lg px-3 py-1.5
            ${isOnRoad
              ? 'bg-brand-success/20 text-brand-success border border-brand-success/30'
              : 'bg-brand-gold/20 text-brand-gold border border-brand-gold/30'
            }
          `}>
            {isRTL
              ? (isOnRoad ? 'قيد التوصيل' : 'جاهز للاستلام')
              : (isOnRoad ? 'Out for delivery' : 'Ready for pickup')
            }
          </span>
        )}
      </div>

      <div className="flex flex-col gap-0 px-4 py-3">

        {/* ── Customer ─────────────────────────────────────────────────────── */}
        {(order.customer_name || order.customer_phone) && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-brand-surface-2 border border-brand-border px-3 py-2.5 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <PersonIcon />
              <div className="min-w-0">
                {order.customer_name && (
                  <p className={`font-bold text-sm text-brand-text truncate ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                    {order.customer_name}
                  </p>
                )}
                {order.customer_phone && (
                  <p className="font-satoshi text-xs text-brand-muted tabular-nums" dir="ltr">
                    {order.customer_phone}
                  </p>
                )}
              </div>
            </div>
            {order.customer_phone && (
              <a
                href={`tel:${order.customer_phone}`}
                className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 bg-brand-gold/10 border border-brand-gold/30 text-brand-gold hover:bg-brand-gold/20 transition-colors duration-150 min-h-[40px]"
                aria-label={isRTL ? 'اتصل بالعميل' : 'Call customer'}
              >
                <PhoneIcon />
                <span className={`font-bold text-xs ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                  {isRTL ? 'اتصال' : 'Call'}
                </span>
              </a>
            )}
          </div>
        )}

        {/* ── Pickup navigation ────────────────────────────────────────────── */}
        {!isCompleted && (
          <div className="rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2.5 mb-3">
            <div className="flex items-start gap-2 mb-2">
              <PinIcon className="text-brand-gold mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className={`font-bold text-xs text-brand-muted uppercase tracking-wider mb-0.5 ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                  {isRTL ? 'نقطة الاستلام' : 'Pickup'}
                </p>
                <p className={`font-bold text-sm text-brand-text ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                  {branchName}
                </p>
                {branchAddr && (
                  <p className="font-satoshi text-xs text-brand-muted/70 mt-0.5">{branchAddr}</p>
                )}
              </div>
            </div>
            {branchNavUrl && (
              <a
                href={branchNavUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full min-h-[40px] rounded-lg border border-brand-gold/30 bg-brand-gold/10 text-brand-gold hover:bg-brand-gold/20 transition-colors duration-150"
              >
                <MapIcon />
                <span className={`font-bold text-sm ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                  {isRTL ? 'انتقل للفرع' : 'Navigate to Branch'}
                </span>
              </a>
            )}
          </div>
        )}

        {/* ── Delivery navigation ──────────────────────────────────────────── */}
        {!isCompleted && deliveryAddrText && (
          <div className="rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-2.5 mb-3">
            <div className="flex items-start gap-2 mb-2">
              <PinIcon className="text-brand-success mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className={`font-bold text-xs text-brand-muted uppercase tracking-wider mb-0.5 ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                  {isRTL ? 'عنوان التوصيل' : 'Delivery Address'}
                </p>
                <p className={`text-sm text-brand-text leading-snug ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                  {deliveryAddrText}
                </p>
                {deliveryDistance != null && (
                  <DistanceBadge distanceKm={deliveryDistance} isRTL={isRTL} />
                )}
              </div>
            </div>
            {customerNavUrl && (
              <a
                href={customerNavUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full min-h-[40px] rounded-lg border border-brand-success/30 bg-brand-success/10 text-brand-success hover:bg-brand-success/20 transition-colors duration-150"
              >
                <MapIcon />
                <span className={`font-bold text-sm ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                  {isRTL ? 'انتقل للعميل' : 'Navigate to Customer'}
                </span>
              </a>
            )}
          </div>
        )}

        {/* ── Customer instructions (speech bubble) ───────────────────────── */}
        {!isCompleted && deliveryInstructions && (
          <div className="rounded-lg border border-brand-gold/20 bg-brand-gold/5 px-3 py-2.5 mb-3">
            <div className="flex items-start gap-2">
              <SpeechIcon />
              <p className={`text-sm text-brand-text/90 leading-relaxed ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                &ldquo;{deliveryInstructions}&rdquo;
              </p>
            </div>
          </div>
        )}

        {/* ── Items ────────────────────────────────────────────────────────── */}
        {order.order_items.length > 0 && (
          <div className="flex flex-col gap-1.5 mb-3">
            <p className={`font-bold text-xs text-brand-muted uppercase tracking-wider mb-1 ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
              {isRTL ? 'الأصناف' : 'Items'}
            </p>
            {order.order_items.map((item, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg bg-brand-surface-2 px-3 py-2">
                <span className="font-satoshi font-black text-base text-brand-gold tabular-nums leading-none shrink-0 pt-0.5">
                  ×{item.quantity}
                </span>
                <div className="min-w-0">
                  <p className={`font-bold text-sm text-brand-text leading-snug ${isRTL ? 'font-almarai font-cairo' : 'font-satoshi'}`}>
                    {isRTL ? item.name_ar : item.name_en}
                  </p>
                  {(item.selected_size || item.selected_variant) && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {item.selected_size && (
                        <span className="font-satoshi text-xs text-brand-muted bg-brand-black/40 rounded px-1.5 py-0.5">
                          {item.selected_size}
                        </span>
                      )}
                      {item.selected_variant && (
                        <span className="font-satoshi text-xs text-brand-muted bg-brand-black/40 rounded px-1.5 py-0.5">
                          {item.selected_variant}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Total + Payment ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 rounded-lg bg-brand-surface-2 border border-brand-border px-3 py-2.5 mb-3">
          <span className="font-satoshi font-black text-xl text-brand-gold tabular-nums">
            {Number(order.total_bhd).toFixed(3)}
            <span className="text-sm font-medium text-brand-muted ms-1">BD</span>
          </span>
          {paymentInfo && (
            <span className="flex items-center gap-1.5 font-satoshi text-sm text-brand-muted">
              <span>{paymentInfo.icon}</span>
              <span className={isRTL ? 'font-almarai' : ''}>
                {isRTL ? paymentInfo.ar : paymentInfo.en}
              </span>
            </span>
          )}
        </div>

        {/* ── Notes (completed variant) ─────────────────────────────────────── */}
        {isCompleted && (order.notes ?? order.delivery_address) && (
          <div className="rounded-lg border border-brand-gold/20 bg-brand-gold/5 px-3 py-2.5 mb-3">
            <p className={`text-xs text-brand-muted uppercase tracking-wider mb-1 font-bold ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
              {isRTL ? 'العنوان' : 'Address'}
            </p>
            <p className={`text-sm text-brand-text leading-relaxed ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
              {order.delivery_address ?? order.notes}
            </p>
          </div>
        )}

        {/* ── Action button ────────────────────────────────────────────────── */}
        {!isCompleted && (
          <button
            type="button"
            onClick={handleAction}
            disabled={busy}
            className={`
              w-full min-h-[60px] rounded-xl font-satoshi font-black text-xl
              transition-all duration-150 active:scale-[0.98]
              disabled:opacity-50 disabled:cursor-not-allowed
              ${busy
                ? 'bg-brand-surface-2 text-brand-muted'
                : isReady
                  ? 'bg-brand-gold text-brand-black'
                  : 'bg-brand-success text-brand-black'
              }
            `}
          >
            {busy
              ? '…'
              : isRTL
                ? (isReady ? 'استلمت الطلب ✓' : 'تم التسليم ✓')
                : (isReady ? 'PICKED UP ✓' : 'DELIVERED ✓')
            }
          </button>
        )}
      </div>
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  )
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function MapIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-brand-muted shrink-0" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}

function SpeechIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-brand-gold mt-0.5 shrink-0" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}

function RulerIcon() {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-brand-muted" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10l4-4m0 0l4 4M7 6v12M21 14l-4 4m0 0l-4-4m4 4V6" />
    </svg>
  )
}

function ClockTinyIcon() {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-brand-muted" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
    </svg>
  )
}
