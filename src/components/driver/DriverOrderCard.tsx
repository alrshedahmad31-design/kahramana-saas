'use client'

import { useState, useEffect }                                from 'react'
import { BRANCHES }                                           from '@/constants/contact'
import {
  calculateDistance, calculateETA, getUrgencyLevel,
  resolveExpectedAt, fmtDistance, fmtETA, mapsNavUrl,
}                                                             from '@/lib/utils/delivery'
import { mapsDirectionsUrl }                                  from '@/lib/utils/distance'
import { buildCustomerContactLink }                           from '@/lib/whatsapp'
import type { DriverOrder }                                   from '@/lib/supabase/custom-types'
import type { BranchId }                                      from '@/constants/contact'

type DriverActiveStatus = 'ready' | 'out_for_delivery'
type Urgency            = 'critical' | 'urgent' | 'normal'

interface Props {
  order:         DriverOrder
  isRTL:         boolean
  branchMapsUrl: string | null
  variant?:      'active' | 'completed'
  onAction?:     (id: string, status: DriverActiveStatus) => Promise<string | null>
  onArrive?:     (id: string) => Promise<string | null>
}

// ── Urgency config ─────────────────────────────────────────────────────────────

const URGENCY_CFG: Record<Urgency, {
  bannerCls:  string
  cardBorder: string
  labelAr:    string
  labelEn:    string
  pulse:      boolean
}> = {
  critical: {
    bannerCls:  'bg-red-500/15 border-b border-red-500/30 text-red-500',
    cardBorder: 'border-red-500/60 shadow-[0_0_24px_rgba(239,68,68,0.10)]',
    labelAr:    'عاجل جداً',
    labelEn:    'CRITICAL',
    pulse:      true,
  },
  urgent: {
    bannerCls:  'bg-orange-400/15 border-b border-orange-400/30 text-orange-400',
    cardBorder: 'border-orange-400/50',
    labelAr:    'عاجل',
    labelEn:    'URGENT',
    pulse:      false,
  },
  normal: {
    bannerCls:  '',
    cardBorder: 'border-brand-gold/35',
    labelAr:    '',
    labelEn:    '',
    pulse:      false,
  },
}

const PAYMENT_LABEL: Record<string, { en: string; ar: string; icon: string }> = {
  cash:       { en: 'Cash',       ar: 'كاش',   icon: '💵' },
  benefit_qr: { en: 'BenefitPay', ar: 'بنفت',  icon: '📱' },
  tap_card:   { en: 'Card',       ar: 'بطاقة',  icon: '💳' },
  tap_knet:   { en: 'KNET',       ar: 'كي-نت',  icon: '💳' },
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatElapsed(createdAt: string): string {
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function formatTime(iso: string): string {
  const d    = new Date(iso)
  const h    = String(d.getHours() % 12 || 12).padStart(2, '0')
  const m    = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m} ${d.getHours() >= 12 ? 'PM' : 'AM'}`
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DriverOrderCard({ order, isRTL, branchMapsUrl, variant = 'active', onAction, onArrive }: Props) {
  const [elapsed,       setElapsed]       = useState(() => formatElapsed(order.created_at))
  const [busy,          setBusy]          = useState(false)
  const [actionError,   setActionError]   = useState<string | null>(null)
  const [itemsExpanded, setItemsExpanded] = useState(() => order.status === 'ready')

  const isCompleted = variant === 'completed'
  const isReady     = order.status === 'ready'
  const isOnRoad    = order.status === 'out_for_delivery'

  useEffect(() => {
    if (isCompleted) return
    const id = setInterval(() => setElapsed(formatElapsed(order.created_at)), 1_000)
    return () => clearInterval(id)
  }, [order.created_at, isCompleted])

  // Branch
  const branch     = BRANCHES[order.branch_id as BranchId] ?? null
  const branchName = branch ? (isRTL ? branch.nameAr : branch.nameEn) : order.branch_id
  const branchAddr = branch ? (isRTL ? branch.addressAr : branch.addressEn) : null

  // Payment
  const paymentEntry = order.payments?.[0]
  const paymentInfo  = paymentEntry ? PAYMENT_LABEL[paymentEntry.method] : null

  // Address & notes
  const rawAddr = order.delivery_address
  const deliveryAddrText: string | null = (() => {
    if (!rawAddr) return order.notes ?? null
    // GPS mode stores a Google Maps URL — skip it; navigation button handles it
    if (rawAddr.startsWith('http')) return null
    // Expand Bahrain abbreviation format: م = block/building, ش = road
    if (/[مش]\d/.test(rawAddr)) {
      let blockSeen = false
      return rawAddr
        .split(/،\s*/)
        .filter(Boolean)
        .map((p) => {
          if (/^م\d/.test(p)) {
            const n = p.replace(/^م/, '')
            if (!blockSeen) { blockSeen = true; return isRTL ? `بلوك ${n}` : `Block ${n}` }
            return isRTL ? `مبنى ${n}` : `Building ${n}`
          }
          if (/^ش\d/.test(p)) return isRTL ? `طريق ${p.replace(/^ش/, '')}` : `Road ${p.replace(/^ش/, '')}`
          if (/^\d+$/.test(p)) return isRTL ? `شقة ${p}` : `Flat ${p}`
          return p
        })
        .join(isRTL ? '، ' : ', ')
    }
    return rawAddr
  })()
  const customerNotes    = order.customer_notes ?? order.delivery_instructions ?? null

  // Urgency
  const expectedAt    = resolveExpectedAt(order.created_at, order.expected_delivery_time)
  const urgency: Urgency = isCompleted ? 'normal' : getUrgencyLevel(expectedAt)
  const minsRemaining = Math.round((expectedAt.getTime() - Date.now()) / 60_000)
  const uc            = URGENCY_CFG[urgency]

  // Navigation URLs (always travelmode=driving)
  const branchNavUrl = branch?.latitude != null && branch?.longitude != null
    ? mapsNavUrl(branch.latitude, branch.longitude)
    : branchMapsUrl

  const customerNavUrl = order.delivery_lat != null && order.delivery_lng != null
    ? mapsNavUrl(order.delivery_lat, order.delivery_lng)
    : deliveryAddrText
      ? mapsDirectionsUrl(deliveryAddrText)
      : null

  // Distance + ETA (branch → customer)
  const deliveryDist =
    branch?.latitude != null && branch?.longitude != null &&
    order.delivery_lat  != null && order.delivery_lng  != null
      ? calculateDistance(
          { lat: branch.latitude,    lng: branch.longitude },
          { lat: order.delivery_lat, lng: order.delivery_lng },
        )
      : null

  const etaMins = deliveryDist != null ? calculateETA(deliveryDist) : null

  async function handleAction() {
    if (busy || (!isReady && !isOnRoad) || !onAction) return
    setBusy(true)
    setActionError(null)
    const error = await onAction(order.id, order.status as DriverActiveStatus)
    if (error) setActionError(error)
    setBusy(false)
  }

  async function handleArrive() {
    if (busy || !onArrive) return
    setBusy(true)
    setActionError(null)
    const error = await onArrive(order.id)
    if (error) setActionError(error)
    setBusy(false)
  }

  return (
    <div className={`
      flex flex-col rounded-2xl border-2 bg-brand-surface overflow-hidden
      transition-all duration-300
      ${isCompleted ? 'border-brand-border opacity-70' : uc.cardBorder}
    `}>

      {/* ── Urgency banner ──────────────────────────────────────────────────── */}
      {!isCompleted && urgency !== 'normal' && (
        <div className={`flex items-center justify-between px-4 py-2 ${uc.bannerCls} ${uc.pulse ? 'animate-pulse' : ''}`}>
          <div className="flex items-center gap-2">
            <AlarmIcon />
            <span className={`font-black text-xs uppercase tracking-widest ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
              {isRTL ? uc.labelAr : uc.labelEn}
            </span>
          </div>
          <span className="font-satoshi font-black text-xs tabular-nums">
            {minsRemaining > 0
              ? (isRTL ? `${minsRemaining} د متبقي` : `${minsRemaining} min left`)
              : (isRTL ? 'تأخر!' : 'LATE!')}
          </span>
        </div>
      )}

      {/* ── Card header ─────────────────────────────────────────────────────── */}
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
              : (isOnRoad ? 'On Route' : 'Ready')
            }
          </span>
        )}
      </div>

      <div className="px-4 py-3 flex flex-col gap-3">

        {/* ── Payment method badge ─────────────────────────────────────────────── */}
        {!isCompleted && paymentInfo && (
          paymentInfo.en === 'Cash' ? (
            <div className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 border bg-red-500/15 border-red-500/40 ${uc.pulse ? 'animate-pulse' : ''}`}>
              <span className="text-base leading-none">💵</span>
              <span className={`font-black text-sm text-red-400 ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                {isRTL ? `نقداً — اجمع ${Number(order.total_bhd).toFixed(3)} BD` : `CASH — Collect ${Number(order.total_bhd).toFixed(3)} BD`}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-xl px-3 py-2 border bg-brand-success/10 border-brand-success/25">
              <span className="text-sm leading-none">{paymentInfo.icon}</span>
              <span className={`font-bold text-xs text-brand-success ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                {isRTL ? `مدفوع — ${paymentInfo.ar}` : `PAID — ${paymentInfo.en}`}
              </span>
            </div>
          )
        )}

        {/* ── Customer row ────────────────────────────────────────────────────── */}
        {(order.customer_name || order.customer_phone) && (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-brand-surface-2 border border-brand-border px-3 py-2.5">
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
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={`tel:${order.customer_phone}`}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-2 bg-brand-gold/10 border border-brand-gold/30 text-brand-gold hover:bg-brand-gold/20 transition-colors duration-150 min-h-[40px]"
                  aria-label={isRTL ? 'اتصل بالعميل' : 'Call customer'}
                >
                  <PhoneIcon />
                  <span className={`font-bold text-xs ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                    {isRTL ? 'اتصال' : 'Call'}
                  </span>
                </a>
                <a
                  href={buildCustomerContactLink(order.customer_phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-xl px-3 py-2 bg-green-500/10 border border-green-500/30 text-green-500 hover:bg-green-500/20 transition-colors duration-150 min-h-[40px]"
                  aria-label={isRTL ? 'واتساب العميل' : 'WhatsApp customer'}
                >
                  <WhatsAppSmallIcon />
                  <span className={`font-bold text-xs ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                    {isRTL ? 'واتساب' : 'WA'}
                  </span>
                </a>
              </div>
            )}
          </div>
        )}

        {/* ── Connected route (active orders only) ────────────────────────────── */}
        {!isCompleted && (
          <div className="rounded-xl border border-brand-border bg-brand-surface-2 overflow-hidden">
            {/* Pickup row */}
            <div className="flex items-start gap-3 px-3 pt-3">
              <div className="flex flex-col items-center shrink-0 mt-0.5">
                <div className="w-3 h-3 rounded-full bg-brand-gold ring-2 ring-brand-gold/25 shrink-0" />
                {(deliveryAddrText != null) && (
                  <div className="w-px bg-brand-border/50 flex-1 min-h-[28px] mt-1" />
                )}
              </div>
              <div className="flex-1 min-w-0 pb-2">
                <p className={`font-bold text-xs text-brand-muted uppercase tracking-wider mb-0.5 ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                  {isRTL ? 'الاستلام' : 'Pickup'}
                </p>
                <p className={`font-bold text-sm text-brand-text ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>{branchName}</p>
                {branchAddr && (
                  <p className="font-satoshi text-xs text-brand-muted/70 mt-0.5">{branchAddr}</p>
                )}
              </div>
              {branchNavUrl && (
                <a
                  href={branchNavUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 self-center flex items-center gap-1.5 rounded-lg px-3 py-2 min-h-[36px] border border-brand-gold/30 bg-brand-gold/10 text-brand-gold hover:bg-brand-gold/20 transition-colors duration-150"
                >
                  <MapIcon />
                  <span className={`font-bold text-xs ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                    {isRTL ? 'ابحث' : 'Go'}
                  </span>
                </a>
              )}
            </div>

            {/* Distance + ETA pills */}
            {deliveryDist != null && (
              <div className="flex items-center gap-2 ps-8 pb-2">
                <span className="flex items-center gap-1 rounded-md border border-brand-border bg-brand-black/30 px-2 py-0.5">
                  <RouteIcon />
                  <span className="font-satoshi text-xs text-brand-muted tabular-nums">
                    {fmtDistance(deliveryDist, isRTL)}
                  </span>
                </span>
                {etaMins != null && (
                  <span className="flex items-center gap-1 rounded-md border border-brand-border bg-brand-black/30 px-2 py-0.5">
                    <ClockTinyIcon />
                    <span className={`text-xs text-brand-muted tabular-nums ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                      {fmtETA(etaMins, isRTL)}
                    </span>
                  </span>
                )}
              </div>
            )}

            {/* Delivery row */}
            {deliveryAddrText && (
              <div className="flex items-start gap-3 px-3 pb-3">
                <div className="shrink-0 mt-0.5">
                  <div className="w-3 h-3 rounded-full bg-brand-success ring-2 ring-brand-success/25" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-xs text-brand-muted uppercase tracking-wider mb-0.5 ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                    {isRTL ? 'التوصيل' : 'Delivery'}
                  </p>
                  <p className={`text-sm text-brand-text leading-snug ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                    {deliveryAddrText}
                  </p>
                </div>
                {customerNavUrl && (
                  <a
                    href={customerNavUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 self-center flex items-center gap-1.5 rounded-lg px-3 py-2 min-h-[36px] border border-brand-success/30 bg-brand-success/10 text-brand-success hover:bg-brand-success/20 transition-colors duration-150"
                  >
                    <MapIcon />
                    <span className={`font-bold text-xs ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                      {isRTL ? 'ابحث' : 'Go'}
                    </span>
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Completed address summary ────────────────────────────────────────── */}
        {isCompleted && deliveryAddrText && (
          <div className="rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-2.5">
            <div className="flex items-center gap-2 mb-1">
              <PinIcon className="text-brand-muted" />
              <p className={`font-bold text-xs text-brand-muted uppercase tracking-wider ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                {isRTL ? 'العنوان' : 'Delivered to'}
              </p>
            </div>
            <p className={`text-sm text-brand-text/80 ps-5 ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
              {deliveryAddrText}
            </p>
          </div>
        )}

        {/* ── Customer instructions ────────────────────────────────────────────── */}
        {!isCompleted && customerNotes && (
          <div className="rounded-xl border border-brand-gold/20 bg-brand-gold/5 px-3 py-2.5">
            <div className="flex items-start gap-2">
              <SpeechIcon />
              <p className={`text-sm text-brand-text/90 leading-relaxed ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                &ldquo;{customerNotes}&rdquo;
              </p>
            </div>
          </div>
        )}

        {/* ── Items — collapsible ──────────────────────────────────────────────── */}
        {order.order_items.length > 0 && (
          <div className="rounded-xl border border-brand-border bg-brand-surface-2 overflow-hidden">
            <button
              type="button"
              onClick={() => setItemsExpanded(v => !v)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-start"
            >
              <div className="flex items-center gap-2">
                <BoxIcon />
                <span className={`font-bold text-sm text-brand-text ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                  {isRTL ? 'الأصناف' : 'Items'}
                </span>
                <span className="min-w-[22px] h-[22px] rounded-full bg-brand-gold/20 border border-brand-gold/30 text-brand-gold font-satoshi font-black text-xs flex items-center justify-center tabular-nums">
                  {order.order_items.reduce((s, i) => s + i.quantity, 0)}
                </span>
              </div>
              <ChevronIcon expanded={itemsExpanded} />
            </button>

            {itemsExpanded && (
              <div className="border-t border-brand-border/60 px-3 pb-3 pt-2 flex flex-col gap-2">
                {order.order_items.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg bg-brand-black/20 px-3 py-2">
                    <span className="font-satoshi font-black text-base text-brand-gold tabular-nums leading-none shrink-0 pt-0.5">
                      ×{item.quantity}
                    </span>
                    <div className="min-w-0">
                      <p className={`font-bold text-sm text-brand-text leading-snug ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
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
          </div>
        )}

        {/* ── Total + Payment ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-surface-2 border border-brand-border px-3 py-2.5">
          <span className="font-satoshi font-black text-2xl text-brand-gold tabular-nums">
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

        {/* ── Action button ────────────────────────────────────────────────────── */}
        {!isCompleted && (
          <>
            {/* Step 1: ready → picked up */}
            {isReady && (
              <button
                type="button"
                onClick={handleAction}
                disabled={busy}
                className={`
                  w-full min-h-[64px] rounded-2xl font-satoshi font-black text-xl
                  transition-all duration-150 active:scale-[0.98]
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${busy ? 'bg-brand-surface-2 text-brand-muted' : 'bg-brand-gold text-brand-black'}
                `}
              >
                {busy ? '…' : (isRTL ? 'استلمت الطلب ✓' : 'PICKED UP ✓')}
              </button>
            )}

            {/* Step 2: on road, not arrived yet → arrived at customer */}
            {isOnRoad && !order.arrived_at && onArrive && (
              <button
                type="button"
                onClick={handleArrive}
                disabled={busy}
                className={`
                  w-full min-h-[56px] rounded-2xl font-satoshi font-black text-lg
                  transition-all duration-150 active:scale-[0.98]
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${busy ? 'bg-brand-surface-2 text-brand-muted' : 'bg-blue-500/20 border-2 border-blue-500/60 text-blue-400'}
                `}
              >
                {busy ? '…' : (isRTL ? 'وصلت للزبون 📍' : 'ARRIVED 📍')}
              </button>
            )}

            {/* Step 3: arrived → delivered */}
            {isOnRoad && (order.arrived_at || !onArrive) && (
              <button
                type="button"
                onClick={handleAction}
                disabled={busy}
                className={`
                  w-full min-h-[64px] rounded-2xl font-satoshi font-black text-xl
                  transition-all duration-150 active:scale-[0.98]
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${busy ? 'bg-brand-surface-2 text-brand-muted' : 'bg-brand-success text-brand-black'}
                `}
              >
                {busy ? '…' : (isRTL ? 'تم التسليم ✓' : 'DELIVERED ✓')}
              </button>
            )}

            {actionError && (
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 bg-red-500/15 border border-red-500/30">
                <span className="text-red-400 text-base leading-none shrink-0">⚠️</span>
                <span className={`text-sm text-red-400 font-bold ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                  {actionError === 'Unexpected order state'
                    ? (isRTL ? 'استُلم هذا الطلب من قِبل سائق آخر' : 'Another driver already took this order')
                    : (isRTL ? 'فشل تحديث الطلب — حاول مجدداً' : 'Failed to update order — try again')
                  }
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function AlarmIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  )
}

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

function WhatsAppSmallIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
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

function MapIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  )
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
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

function BoxIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-brand-muted shrink-0" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  )
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
      className={`text-brand-muted/60 transition-transform duration-200 shrink-0 ${expanded ? 'rotate-180' : ''}`}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function RouteIcon() {
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
