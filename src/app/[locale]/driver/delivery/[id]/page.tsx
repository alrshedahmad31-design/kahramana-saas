'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { buildCustomerContactLink } from '@/lib/whatsapp'

type DeliveryStatus = 'ready_for_pickup' | 'picked_up' | 'en_route' | 'delivered'

type DeliveryDetail = {
  id:                string
  order_number:      string
  status:            DeliveryStatus
  customer_name:     string
  customer_phone:    string
  customer_address:  string
  customer_location: { lat: number; lng: number } | null
  restaurant_name:   string
  restaurant_address:string
  restaurant_location:{ lat: number; lng: number } | null
  delivery_notes?:   string
  payment_method:    'cash' | 'card'
  total:             number
  items_count:       number
}

const STEPS: { key: DeliveryStatus | 'pickup'; label: string; icon: React.ReactNode }[] = [
  { key: 'pickup',   label: 'الاستلام', icon: <BoxIcon /> },
  { key: 'en_route', label: 'الطريق',   icon: <NavIcon /> },
  { key: 'delivered',label: 'التوصيل',  icon: <CheckIcon /> },
]

const STEP_ORDER: DeliveryStatus[] = ['ready_for_pickup', 'picked_up', 'en_route', 'delivered']

function stepIndex(status: DeliveryStatus): number {
  return STEP_ORDER.indexOf(status)
}

export default function DeliveryDetailPage() {
  const params   = useParams()
  const router   = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // Narrow ParamValue → string
  const rawId  = params?.id
  const orderId = Array.isArray(rawId) ? rawId[0] : (rawId ?? '')
  const locale  = Array.isArray(params?.locale) ? params.locale[0] : (params?.locale ?? 'ar')

  const [delivery, setDelivery] = useState<DeliveryDetail | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (!orderId) return
    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single()
      setDelivery(data as DeliveryDetail | null)
      setLoading(false)
    }
    load()
  }, [orderId, supabase])

  async function updateStatus(status: DeliveryStatus) {
    if (!orderId || updating) return
    setUpdating(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase
      .from('orders')
      .update({ status: status as never })
      .eq('id', orderId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()
    setDelivery(data as DeliveryDetail | null)
    setUpdating(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-black flex items-center justify-center">
        <span className="w-10 h-10 rounded-full border-4 border-brand-gold/30 border-t-brand-gold animate-spin" />
      </div>
    )
  }
  if (!delivery) {
    return (
      <div className="min-h-screen bg-brand-black flex items-center justify-center">
        <p className="font-almarai text-brand-error text-lg">الطلب غير موجود</p>
      </div>
    )
  }

  const si     = stepIndex(delivery.status)
  const waLink = delivery.customer_phone
    ? buildCustomerContactLink(delivery.customer_phone)
    : null

  const destHref = (() => {
    const loc = delivery.status === 'ready_for_pickup'
      ? delivery.restaurant_location
      : delivery.customer_location
    if (!loc) return null
    return `https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`
  })()

  return (
    <div className="min-h-screen bg-brand-black text-brand-text pb-40" dir="rtl">

      {/* ── Header ── */}
      <header className="sticky top-0 z-10 flex items-center gap-4 px-4 py-3.5 bg-brand-surface border-b border-brand-border">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-brand-surface-2 transition-colors text-brand-muted hover:text-brand-text"
        >
          <ChevronIcon className="w-6 h-6" />
        </button>
        <h1 className="font-cairo font-bold text-xl text-brand-text">
          طلب #{delivery.order_number}
        </h1>
      </header>

      <div className="p-4 flex flex-col gap-5">

        {/* ── Status stepper ── */}
        <div className="bg-brand-surface rounded-2xl border border-brand-border p-5">
          <div className="flex items-center justify-between">
            {STEPS.map((step, i) => {
              const done    = si >= i + 1
              const current = (i === 0 && si <= 1) || (i === 1 && si === 2) || (i === 2 && si === 3)
              return (
                <div key={step.key} className="flex-1 flex flex-col items-center gap-2">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors
                    ${done ? 'bg-brand-success text-brand-black' : current ? 'bg-brand-gold text-brand-black animate-pulse' : 'bg-brand-surface-2 text-brand-muted'}`}>
                    {step.icon}
                  </div>
                  <span className="font-almarai text-xs text-brand-muted">{step.label}</span>
                  {i < STEPS.length - 1 && (
                    <div className="absolute" style={{ display: 'none' }} />
                  )}
                </div>
              )
            })}
          </div>
          {/* Progress bar */}
          <div className="mt-4 h-1.5 bg-brand-border rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-success transition-all duration-500 rounded-full"
              style={{ width: `${Math.min(100, (si / (STEP_ORDER.length - 1)) * 100)}%` }}
            />
          </div>
        </div>

        {/* ── Route card ── */}
        <div className="bg-brand-surface rounded-2xl border border-brand-border p-5 relative">
          <div className="absolute start-8 top-12 bottom-12 w-0.5 bg-brand-border" />

          <div className="flex gap-4 relative mb-7">
            <div className="w-6 h-6 rounded-full bg-brand-gold flex items-center justify-center shrink-0 mt-1">
              <div className="w-2.5 h-2.5 rounded-full bg-brand-black" />
            </div>
            <div>
              <p className="font-almarai font-black text-brand-muted text-xs mb-0.5">من: المطعم</p>
              <p className="font-almarai font-bold text-brand-text">{delivery.restaurant_name}</p>
              <p className="font-almarai text-brand-muted text-sm">{delivery.restaurant_address}</p>
            </div>
          </div>

          <div className="flex gap-4 relative">
            <div className="w-6 h-6 rounded-full bg-brand-success flex items-center justify-center shrink-0 mt-1">
              <LocationDotIcon className="w-3.5 h-3.5 text-brand-black" />
            </div>
            <div>
              <p className="font-almarai font-black text-brand-muted text-xs mb-0.5">إلى: العميل</p>
              <p className="font-almarai font-bold text-brand-text">{delivery.customer_name}</p>
              <p className="font-almarai text-brand-muted text-sm">{delivery.customer_address}</p>
              {delivery.delivery_notes && (
                <div className="mt-2 p-3 rounded-xl border-2 border-brand-error bg-brand-error/10 flex items-start gap-2">
                  <AlertIcon className="w-4 h-4 text-brand-error shrink-0 mt-0.5" />
                  <p className="font-almarai text-brand-text text-sm">{delivery.delivery_notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Order summary ── */}
        <div className="bg-brand-surface rounded-2xl border border-brand-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-brand-surface-2 border-b border-brand-border">
            <span className="font-almarai font-bold text-brand-text">ملخص الطلب</span>
            <span className="bg-brand-gold text-brand-black font-satoshi font-black text-xs px-2.5 py-1 rounded-lg">
              {delivery.items_count} أصناف
            </span>
          </div>
          <div className="px-5 py-4 flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-almarai text-brand-muted">طريقة الدفع</span>
              <span className={`font-almarai font-bold ${delivery.payment_method === 'cash' ? 'text-brand-success' : 'text-brand-gold'}`}>
                {delivery.payment_method === 'cash' ? '💵 نقداً' : '💳 بطاقة'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-almarai text-brand-muted text-sm">المبلغ المطلوب</span>
              <span className="font-satoshi font-black text-2xl text-brand-gold tabular-nums">
                {Number(delivery.total).toFixed(3)}
                <span className="font-almarai text-brand-muted text-sm font-normal ms-1">د.ب</span>
              </span>
            </div>
          </div>
        </div>

        {/* ── Contact actions ── */}
        <div className="grid grid-cols-2 gap-3">
          <a
            href={`tel:${delivery.customer_phone}`}
            className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl bg-brand-surface border border-brand-border hover:border-brand-success/40 hover:bg-brand-success/5 transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-brand-success/10 flex items-center justify-center">
              <PhoneIcon className="w-6 h-6 text-brand-success" />
            </div>
            <span className="font-almarai text-sm font-bold text-brand-muted">اتصال بالعميل</span>
          </a>
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center gap-2 py-5 rounded-2xl bg-brand-surface border border-brand-border hover:border-brand-success/40 hover:bg-brand-success/5 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-brand-success/10 flex items-center justify-center">
                <WhatsAppIcon className="w-6 h-6 text-brand-success" />
              </div>
              <span className="font-almarai text-sm font-bold text-brand-muted">واتساب العميل</span>
            </a>
          )}
        </div>
      </div>

      {/* ── Persistent action footer ── */}
      <footer className="fixed bottom-0 inset-x-0 p-4 bg-brand-surface/95 backdrop-blur-md border-t border-brand-border z-20">
        <div className="max-w-lg mx-auto flex flex-col gap-2">
          {delivery.status === 'ready_for_pickup' && (
            <button
              type="button"
              disabled={updating}
              onClick={() => updateStatus('picked_up')}
              className="w-full py-4 rounded-2xl bg-brand-gold hover:bg-brand-gold-light text-brand-black font-cairo font-black text-xl transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {updating ? '…' : 'استلمت الطلب من المطعم'}
            </button>
          )}
          {delivery.status === 'picked_up' && (
            <button
              type="button"
              disabled={updating}
              onClick={() => updateStatus('en_route')}
              className="w-full py-4 rounded-2xl bg-brand-gold hover:bg-brand-gold-light text-brand-black font-cairo font-black text-xl transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {updating ? '…' : 'أنا في الطريق للعميل'}
            </button>
          )}
          {delivery.status === 'en_route' && (
            <button
              type="button"
              disabled={updating}
              onClick={() => updateStatus('delivered')}
              className="w-full py-4 rounded-2xl bg-brand-success hover:opacity-90 text-brand-black font-cairo font-black text-xl transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {updating ? '…' : 'تم تسليم الطلب للعميل ✓'}
            </button>
          )}
          {delivery.status === 'delivered' && (
            <button
              type="button"
              onClick={() => router.push(`/${locale}/driver`)}
              className="w-full py-4 rounded-2xl bg-brand-surface-2 border border-brand-border text-brand-muted font-cairo font-bold text-lg"
            >
              العودة للرئيسية
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            {destHref && (
              <a
                href={destHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-surface-2 border border-brand-border text-brand-muted hover:text-brand-gold hover:border-brand-gold/40 font-almarai text-sm transition-colors"
              >
                <NavIcon />
                فتح الخريطة
              </a>
            )}
            <button
              type="button"
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-surface-2 border border-brand-border text-brand-error hover:border-brand-error/40 font-almarai text-sm transition-colors"
            >
              <AlertIcon className="w-4 h-4" />
              تبليغ عن مشكلة
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function BoxIcon() {
  return <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
}
function NavIcon() {
  return <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" /></svg>
}
function CheckIcon() {
  return <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
}
function ChevronIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
}
function LocationDotIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
}
function AlertIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
}
function PhoneIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
}
function WhatsAppIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
}
