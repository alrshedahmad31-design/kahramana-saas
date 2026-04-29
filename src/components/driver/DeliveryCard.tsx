'use client'

import Link from 'next/link'
import { buildCustomerContactLink } from '@/lib/whatsapp'

interface DeliveryCardProps {
  delivery: {
    id:                string
    order_number:      string
    status:            'ready_for_pickup' | 'picked_up' | 'en_route' | 'delivered'
    customer_name:     string
    customer_phone:    string
    customer_address:  string
    customer_location: { lat: number; lng: number } | null
    restaurant_name:   string
    restaurant_address:string
    items_count:       number
    total:             number
    payment_method:    'cash' | 'card'
    delivery_fee:      number | null
    delivery_notes?:   string
    created_at:        string
  }
  isActive:       boolean
  sequenceNumber: number
  onSelect:       () => void
}

const STATUS_CFG = {
  ready_for_pickup: {
    label:    'جاهز للاستلام',
    borderCls: 'border-brand-gold',
    bgCls:    'bg-brand-gold/20',
    textCls:  'text-brand-gold',
    icon:     '📦',
    action:   'استلم الطلب',
  },
  picked_up: {
    label:    'تم الاستلام',
    borderCls: 'border-brand-gold',
    bgCls:    'bg-brand-gold/10',
    textCls:  'text-brand-gold',
    icon:     '🚗',
    action:   'أنا في الطريق',
  },
  en_route: {
    label:    'في الطريق',
    borderCls: 'border-brand-success',
    bgCls:    'bg-brand-success/20',
    textCls:  'text-brand-success',
    icon:     '🏃',
    action:   'وصلت للعميل',
  },
  delivered: {
    label:    'تم التوصيل',
    borderCls: 'border-brand-success',
    bgCls:    'bg-brand-success/10',
    textCls:  'text-brand-success',
    icon:     '✅',
    action:   'تم',
  },
} as const

export function DeliveryCard({ delivery, isActive, sequenceNumber, onSelect }: DeliveryCardProps) {
  const cfg = STATUS_CFG[delivery.status] ?? STATUS_CFG.en_route
  const waLink = delivery.customer_phone
    ? buildCustomerContactLink(delivery.customer_phone)
    : null

  const mapsHref = delivery.customer_location
    ? `https://www.google.com/maps/dir/?api=1&destination=${delivery.customer_location.lat},${delivery.customer_location.lng}`
    : null

  return (
    <article
      onClick={onSelect}
      className={`
        bg-brand-surface border-2 rounded-2xl p-4
        transition-all duration-300 cursor-pointer
        ${isActive ? cfg.borderCls : 'border-brand-border'}
        ${isActive ? 'shadow-lg shadow-brand-gold/20' : ''}
      `}
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-brand-border">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-brand-gold text-brand-black font-cairo font-black text-2xl flex items-center justify-center shrink-0">
            {sequenceNumber}
          </div>
          <div>
            <div className="font-cairo font-black text-brand-text text-xl">
              #{delivery.order_number}
            </div>
            <div className={`inline-flex items-center gap-1 mt-1 px-2 py-1 rounded-lg text-xs font-almarai font-bold ${cfg.bgCls} ${cfg.textCls}`}>
              <span>{cfg.icon}</span>
              <span>{cfg.label}</span>
            </div>
          </div>
        </div>

        <div className="text-end">
          <div className="font-satoshi font-black text-brand-gold text-lg tabular-nums">
            {Number(delivery.delivery_fee ?? 0).toFixed(3)}
          </div>
          <div className="font-almarai text-brand-muted text-xs">رسوم التوصيل</div>
        </div>
      </div>

      {/* Restaurant pickup info */}
      {delivery.status === 'ready_for_pickup' && (
        <div className="mb-4 p-3 bg-brand-surface-2 rounded-xl">
          <div className="flex items-start gap-2">
            <LocationIcon className="w-5 h-5 text-brand-gold mt-0.5 shrink-0" />
            <div>
              <div className="font-almarai font-bold text-brand-text text-sm mb-0.5">
                استلام من: {delivery.restaurant_name}
              </div>
              <div className="font-almarai text-brand-muted text-xs">{delivery.restaurant_address}</div>
            </div>
          </div>
        </div>
      )}

      {/* Customer info */}
      <div className="flex flex-col gap-2 mb-4">
        <div className="font-almarai font-bold text-brand-text">{delivery.customer_name}</div>
        <div className="flex items-start gap-2">
          <LocationIcon className="w-4 h-4 text-brand-muted mt-0.5 shrink-0" />
          <span className="font-almarai text-brand-muted text-sm">{delivery.customer_address}</span>
        </div>
        {delivery.delivery_notes && (
          <div className="p-3 rounded-xl border-2 border-brand-error bg-brand-error/10">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertIcon className="w-4 h-4 text-brand-error shrink-0" />
              <span className="font-almarai font-black text-brand-error text-xs uppercase tracking-wide">ملاحظات:</span>
            </div>
            <p className="font-almarai text-brand-text text-sm">{delivery.delivery_notes}</p>
          </div>
        )}
      </div>

      {/* Summary row */}
      <div className="flex items-center justify-between mb-4 px-3 py-2.5 bg-brand-surface-2 rounded-xl">
        <span className="font-almarai text-brand-muted text-sm">{delivery.items_count} صنف</span>
        <span className="font-satoshi font-black text-brand-text tabular-nums">
          {Number(delivery.total).toFixed(3)}{' '}
          <span className="font-almarai text-brand-muted text-xs font-normal">د.ب</span>
        </span>
        <span className={`font-almarai font-bold text-sm px-2 py-1 rounded-lg
          ${delivery.payment_method === 'cash'
            ? 'bg-brand-success/20 text-brand-success'
            : 'bg-brand-gold/20 text-brand-gold'}`}>
          {delivery.payment_method === 'cash' ? '💵 نقداً' : '💳 بطاقة'}
        </span>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <a
          href={`tel:${delivery.customer_phone}`}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-brand-success/10 border border-brand-success/30 text-brand-success font-almarai font-bold text-sm transition-colors hover:bg-brand-success/20"
        >
          <PhoneIcon className="w-4 h-4" />
          اتصال
        </a>

        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-brand-success/10 border border-brand-success/30 text-brand-success font-almarai font-bold text-sm transition-colors hover:bg-brand-success/20"
          >
            <WhatsAppIcon className="w-4 h-4" />
            واتساب
          </a>
        )}

        {mapsHref && (
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-brand-gold/10 border border-brand-gold/30 text-brand-gold font-almarai font-bold text-sm transition-colors hover:bg-brand-gold/20"
          >
            <NavIcon className="w-4 h-4" />
            خريطة
          </a>
        )}
      </div>

      {/* Primary action link */}
      <Link
        href={`/driver/delivery/${delivery.id}`}
        onClick={(e) => e.stopPropagation()}
        className={`block w-full py-4 rounded-xl text-center font-cairo font-black text-xl text-brand-black
          transition-all duration-150 active:scale-[0.98]
          ${isActive ? 'bg-brand-gold hover:bg-brand-gold-light' : 'bg-brand-gold/70 hover:bg-brand-gold'}`}
      >
        {cfg.action}
      </Link>
    </article>
  )
}

// ── Inline icons ──────────────────────────────────────────────────────────────

function LocationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  )
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  )
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  )
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function NavIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
    </svg>
  )
}
