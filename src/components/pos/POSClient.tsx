'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { CloudOff, Loader2 } from 'lucide-react'
import { createManualOrder, type ManualOrderPayload } from '@/app/[locale]/dashboard/pos/actions'
import {
  enqueuePosOrder,
  getPendingPosOrders,
  deletePendingPosOrder,
  pendingPosOrderCount,
} from '@/lib/utils/offline-db'
import type { CartLine, CartModifier, POSBranch, POSCategory, POSItem } from './types'
import MenuBrowser from './MenuBrowser'
import OrderBuilder from './OrderBuilder'
import styles from './POSClient.module.css'
import VariantPicker from './VariantPicker'
import ModifierPicker from './ModifierPicker'
import PrintReceiptButton from './PrintReceiptButton'
import type { ReceiptOrder } from '@/lib/hardware/receipt-printer'
import { BRANCHES } from '@/constants/contact'

// Leaflet requires browser DOM — SSR must be disabled
const DeliveryMapPicker = dynamic(() => import('./DeliveryMapPicker'), { ssr: false })

interface Props {
  categories:     POSCategory[]
  branches:       POSBranch[]
  lockedBranchId: string | null
  locale:         'ar' | 'en'
}

type OrderType = 'dine_in' | 'pickup' | 'delivery' | 'phone'
type PaymentMethod = 'cash' | 'card' | 'tap'

export default function POSClient({
  categories,
  branches,
  lockedBranchId,
  locale,
}: Props) {
  const t = useTranslations('pos')
  const isAr = locale === 'ar'
  const router = useRouter()
  const prefix = locale === 'en' ? '/en' : ''

  const [activeTab, setActiveTab] = useState<'menu' | 'order'>('menu')
  const [branchId, setBranchId] = useState<string>(
    lockedBranchId ?? branches[0]?.id ?? '',
  )
  const [orderType, setOrderType] = useState<OrderType>('phone')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [city, setCity] = useState('')
  const [block, setBlock] = useState('')
  const [road, setRoad] = useState('')
  const [building, setBuilding] = useState('')
  const [flat, setFlat] = useState('')
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null)
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null)
  const [showMapPicker, setShowMapPicker] = useState(false)
  const [cart, setCart] = useState<CartLine[]>([])
  const [pendingItem, setPendingItem] = useState<POSItem | null>(null)
  const [pendingModifierItem, setPendingModifierItem] = useState<{
    item: POSItem
    size: string | null
    variant: { ar: string; en: string } | null
    unit: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{
    orderId: string
    queued?: boolean
    warning?: string
    receipt?: ReceiptOrder
  } | null>(null)
  const [isPending, startTransition] = useTransition()

  // ── Online / offline state + queue ──────────────────────────────────────────
  const [isOnline, setIsOnline] = useState<boolean>(true)
  const [pendingCount, setPendingCount] = useState<number>(0)
  const [isFlushing, setIsFlushing] = useState<boolean>(false)
  const flushingRef = useRef(false)

  const refreshPendingCount = useCallback(async () => {
    try {
      const n = await pendingPosOrderCount()
      setPendingCount(n)
    } catch {
      // IndexedDB unavailable — treat as 0
      setPendingCount(0)
    }
  }, [])

  const flushQueue = useCallback(async () => {
    if (flushingRef.current) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    flushingRef.current = true
    setIsFlushing(true)
    try {
      const queued = await getPendingPosOrders()
      for (const entry of queued) {
        const result = await createManualOrder(entry.payload as ManualOrderPayload)
        // On success OR idempotent duplicate (server returns existing order_id), drop the entry.
        // Network errors propagate as a thrown rejection from the fetch layer; we keep the entry.
        if (result.orderId && entry.id != null) {
          await deletePendingPosOrder(entry.id)
        } else if (result.error) {
          // Validation / auth errors are non-recoverable for this entry — drop it
          // so the queue does not block flush of subsequent entries.
          if (entry.id != null) await deletePendingPosOrder(entry.id)
          console.warn('[POSClient] dropped queued order due to error:', result.error)
        }
      }
    } catch (err) {
      console.error('[POSClient] flushQueue failed:', err)
    } finally {
      flushingRef.current = false
      setIsFlushing(false)
      void refreshPendingCount()
    }
  }, [refreshPendingCount])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setIsOnline(navigator.onLine)
    void refreshPendingCount()

    const onOnline = () => {
      setIsOnline(true)
      void flushQueue()
    }
    const onOffline = () => setIsOnline(false)

    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)

    // Best-effort flush on mount in case orders were queued in a previous session
    if (navigator.onLine) void flushQueue()

    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [flushQueue, refreshPendingCount])

  const subtotal = useMemo(
    () => Number(cart.reduce((s, l) => s + l.unitPriceBhd * l.quantity, 0).toFixed(3)),
    [cart],
  )

  function addItem(
    item: POSItem,
    size: string | null,
    variant: { ar: string; en: string } | null,
    unit: number,
    modifiers: CartModifier[] = [],
  ) {
    const modKey = modifiers
      .map((m) => m.option_id)
      .sort()
      .join(',')
    const key = `${item.id}::${size ?? ''}::${variant?.en ?? ''}::${modKey}`
    setCart((prev) => {
      const existing = prev.find((l) => l.key === key)
      if (existing) {
        return prev.map((l) =>
          l.key === key ? { ...l, quantity: l.quantity + 1 } : l,
        )
      }
      const line: CartLine = {
        key,
        itemId:       item.id,
        nameAr:       item.nameAr,
        nameEn:       item.nameEn,
        size,
        variantAr:    variant?.ar ?? null,
        variantEn:    variant?.en ?? null,
        unitPriceBhd: unit,
        quantity:     1,
        itemNotes:    '',
        modifiers,
      }
      return [...prev, line]
    })
  }

  function changeLineNotes(key: string, value: string) {
    setCart((prev) =>
      prev.map((l) => (l.key === key ? { ...l, itemNotes: value } : l)),
    )
  }

  function handleAddRequest(item: POSItem) {
    if (!item.available) return
    const hasSizes     = item.sizes.length > 0
    const hasVariants  = item.variants.length > 0
    const hasModifiers = item.modifierGroups.length > 0
    if (hasSizes || hasVariants) {
      setPendingItem(item)
      return
    }
    if (hasModifiers && typeof item.priceBhd === 'number') {
      setPendingModifierItem({ item, size: null, variant: null, unit: item.priceBhd })
      return
    }
    if (typeof item.priceBhd === 'number') {
      addItem(item, null, null, item.priceBhd)
    }
  }

  function changeQty(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) =>
          l.key === key ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l,
        )
        .filter((l) => l.quantity > 0),
    )
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key))
  }

  function reset() {
    setCart([])
    setCustomerName('')
    setCustomerPhone('')
    setNotes('')
    setCity('')
    setBlock('')
    setRoad('')
    setBuilding('')
    setFlat('')
    setDeliveryLat(null)
    setDeliveryLng(null)
    setOrderType('phone')
    setPaymentMethod('cash')
    setError(null)
  }

  function submit() {
    setError(null)

    if (cart.length === 0) {
      setError(t('errorCartEmpty'))
      return
    }
    if (!customerName.trim()) {
      setError(t('errorNameRequired'))
      return
    }
    if (!customerPhone.trim()) {
      setError(t('errorPhoneRequired'))
      return
    }
    if (orderType === 'delivery' && (!block.trim() || !road.trim() || !building.trim())) {
      setError(t('errorAddressRequired'))
      return
    }

    const idempotencyKey = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`

    // Snapshot for the receipt — captured before reset() wipes the cart.
    const branchKey = (Object.keys(BRANCHES) as Array<keyof typeof BRANCHES>).find(
      (k) => BRANCHES[k].id === branchId,
    )
    const branchInfo = branchKey ? BRANCHES[branchKey] : null
    const buildReceipt = (orderId: string): ReceiptOrder => ({
      restaurantNameAr: 'كهرمانة بغداد',
      branchNameAr:     branchInfo?.nameAr ?? branches.find((b) => b.id === branchId)?.nameAr ?? '',
      branchPhone:      branchInfo?.phone ?? '',
      orderId,
      customerName:     customerName.trim() || undefined,
      customerPhone:    customerPhone.trim() || undefined,
      items: cart.map((l) => ({
        nameAr:       l.nameAr,
        nameEn:       l.nameEn,
        quantity:     l.quantity,
        unitPriceBhd: l.unitPriceBhd,
        size:         l.size,
        variant:      isAr ? l.variantAr : l.variantEn,
        modifiers:    l.modifiers.map((m) => ({
          ar:    m.option_name_ar,
          en:    m.option_name_en,
          price: m.price_modifier,
        })),
        notes: l.itemNotes.trim() || null,
      })),
      subtotalBhd: subtotal,
      totalBhd:    subtotal,
      trackingUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}${prefix}/order/${orderId}`,
      isAr,
    })

    const payload: ManualOrderPayload = {
      branchId,
      orderType,
      customerName:  customerName.trim(),
      customerPhone: customerPhone.trim(),
      items: cart.map((l) => ({
        menuItemId:   l.itemId,
        quantity:     l.quantity,
        sizeName:     l.size ?? null,
        variantName:  l.variantEn ?? null,
        unitPriceBhd: l.unitPriceBhd,
        itemNotes:    l.itemNotes.trim() || null,
        modifiers:    l.modifiers.length > 0 ? l.modifiers : undefined,
      })),
      notes: notes.trim() || null,
      paymentMethod,
      deliveryAddress:
        orderType === 'delivery'
          ? {
              city:     city.trim() || null,
              block:    block.trim() || null,
              road:     road.trim() || null,
              building: building.trim() || null,
              flat:     flat.trim() || null,
            }
          : null,
      deliveryLat:  orderType === 'delivery' ? (deliveryLat ?? undefined) : undefined,
      deliveryLng:  orderType === 'delivery' ? (deliveryLng ?? undefined) : undefined,
      idempotencyKey,
    }

    // Offline path — enqueue and clear cart so the cashier can keep ringing.
    const offline = typeof navigator !== 'undefined' && !navigator.onLine
    if (offline) {
      startTransition(async () => {
        try {
          await enqueuePosOrder({
            idempotencyKey,
            payload: payload as unknown as Record<string, unknown>,
          })
          await refreshPendingCount()
          setSuccess({
            orderId: idempotencyKey,
            queued:  true,
            receipt: buildReceipt(idempotencyKey),
          })
          reset()
        } catch (err) {
          console.error('[POSClient] enqueue failed:', err)
          setError(t('errorGeneric'))
        }
      })
      return
    }

    startTransition(async () => {
      try {
        const result = await createManualOrder(payload)
        if (result.error || !result.orderId) {
          setError(result.error ?? t('errorGeneric'))
          return
        }
        setSuccess({
          orderId: result.orderId,
          warning: result.warning,
          receipt: buildReceipt(result.orderId),
        })
        reset()
      } catch (err) {
        // Only fall back to offline queue on genuine network failures
        // (offline, fetch error). Auth/permission/validation/server bugs are
        // surfaced as real errors so retrying them won't help and will pile
        // up in the queue.
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false
        const networkLike = err instanceof TypeError
          || (err instanceof Error && /network|fetch|failed to fetch|networkerror/i.test(err.message))
        if (!offline && !networkLike) {
          console.error('[POSClient] online submit failed (non-network):', err)
          setError(err instanceof Error ? err.message : t('errorGeneric'))
          return
        }
        console.warn('[POSClient] network failure — queuing locally:', err)
        try {
          await enqueuePosOrder({
            idempotencyKey,
            payload: payload as unknown as Record<string, unknown>,
          })
          await refreshPendingCount()
          setSuccess({
            orderId: idempotencyKey,
            queued:  true,
            receipt: buildReceipt(idempotencyKey),
          })
          reset()
        } catch (queueErr) {
          console.error('[POSClient] enqueue fallback failed:', queueErr)
          setError(t('errorGeneric'))
        }
      }
    })
  }

  if (success) {
    const shortId = success.orderId.slice(-8).toUpperCase()
    const queued  = success.queued === true
    return (
      <div className="min-h-[60vh] flex items-center justify-center" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="max-w-md w-full rounded-xl border border-brand-gold/40 bg-brand-surface p-8 text-center">
          <div className={`mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center ${queued ? 'bg-brand-gold/10' : 'bg-brand-success/10'}`}>
            {queued ? (
              <CloudOff className="h-8 w-8 text-brand-gold" />
            ) : (
              <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="text-brand-success">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <h2 className={`text-2xl font-black text-brand-gold mb-2 ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
            {queued
              ? (isAr ? 'تم حفظ الطلب محلياً' : 'Order queued offline')
              : t('orderCreated')}
          </h2>
          <p className="font-satoshi text-brand-muted mb-2 tabular-nums">#{shortId}</p>
          {queued && (
            <p className="font-satoshi text-xs text-brand-muted mb-6">
              {isAr
                ? 'سيُرسل الطلب تلقائياً عند عودة الاتصال'
                : 'Will sync automatically when the connection returns'}
            </p>
          )}
          {success.warning && (
            <div className={`mb-6 rounded-lg border border-brand-gold/40 bg-brand-gold/10 px-4 py-3 text-start ${isAr ? 'font-almarai' : 'font-satoshi'}`} role="alert">
              <p className="text-sm font-bold text-brand-gold mb-1">
                {isAr ? 'يلزم تدخّل المدير' : 'Manager resolution required'}
              </p>
              <p className="text-xs text-brand-gold/90">
                {success.warning}
              </p>
            </div>
          )}
          <div className="flex flex-col gap-3">
            {success.receipt && (
              <PrintReceiptButton order={success.receipt} isAr={isAr} />
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              {!queued && (
                <button
                  type="button"
                  onClick={() => router.push(`${prefix}/dashboard/orders/${success.orderId}`)}
                  className="flex-1 min-h-[44px] rounded-lg bg-brand-gold text-brand-black font-satoshi font-bold hover:bg-brand-gold-light transition-colors"
                >
                  {t('viewOrder')}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSuccess(null)}
                className="flex-1 min-h-[44px] rounded-lg border border-brand-border bg-brand-surface-2 text-brand-text font-satoshi font-medium hover:border-brand-gold/40 transition-colors"
              >
                {t('newOrder')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const showOfflineBanner = !isOnline || pendingCount > 0

  return (
    <div className="-mx-4 sm:-mx-6 -my-6" dir={isAr ? 'rtl' : 'ltr'}>
      {showOfflineBanner && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 px-4 py-2 text-sm font-satoshi border-b ${
            !isOnline
              ? 'bg-brand-gold/10 text-brand-gold border-brand-gold/30'
              : 'bg-brand-surface-2 text-brand-muted border-brand-border'
          }`}
        >
          <div className="flex items-center gap-2">
            {isFlushing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <CloudOff className="h-4 w-4" aria-hidden="true" />
            )}
            <span>
              {!isOnline
                ? (isAr
                    ? 'وضع عدم الاتصال — الطلبات ستُرسل عند عودة الشبكة'
                    : 'Offline mode — orders will sync when the connection returns')
                : isFlushing
                  ? (isAr ? 'جارٍ مزامنة الطلبات…' : 'Syncing queued orders…')
                  : (isAr ? 'طلبات في انتظار المزامنة' : 'Orders awaiting sync')}
            </span>
          </div>
          {pendingCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[1.5rem] rounded-full bg-brand-gold text-brand-black px-2 py-0.5 text-xs font-bold tabular-nums">
              {pendingCount}
            </span>
          )}
        </div>
      )}

      {/* Mobile tab switcher */}
      <div className="lg:hidden sticky top-0 z-30 bg-brand-black border-b border-brand-border">
        <div className="flex">
          <button
            type="button"
            onClick={() => setActiveTab('menu')}
            className={`flex-1 min-h-[48px] font-satoshi text-sm font-medium transition-colors
              ${activeTab === 'menu' ? 'text-brand-gold border-b-2 border-brand-gold' : 'text-brand-muted'}`}
          >
            {isAr ? 'المنيو' : 'Menu'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('order')}
            className={`flex-1 min-h-[48px] font-satoshi text-sm font-medium transition-colors relative
              ${activeTab === 'order' ? 'text-brand-gold border-b-2 border-brand-gold' : 'text-brand-muted'}`}
          >
            {isAr ? 'الطلب' : 'Order'}
            {cart.length > 0 && (
              <span className="absolute top-1 ms-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-gold text-brand-black text-xs font-bold tabular-nums">
                {cart.reduce((s, l) => s + l.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        {/* Menu Browser — full area */}
        <div className={activeTab === 'menu' ? 'block' : 'hidden lg:block'}>
          <MenuBrowser
            categories={categories}
            isAr={isAr}
            onAdd={handleAddRequest}
          />
        </div>

        {/* Order Builder — sticky side panel */}
        <div className={`${styles.sidebar} border-s border-brand-border bg-brand-surface${activeTab !== 'order' ? ' max-lg:hidden' : ''}`}>
          <OrderBuilder
            isAr={isAr}
            branches={branches}
            branchId={branchId}
            onBranchChange={setBranchId}
            branchLocked={lockedBranchId !== null}
            orderType={orderType}
            onOrderTypeChange={setOrderType}
            customerName={customerName}
            onCustomerNameChange={setCustomerName}
            customerPhone={customerPhone}
            onCustomerPhoneChange={setCustomerPhone}
            cart={cart}
            onChangeQty={changeQty}
            onRemove={removeLine}
            onChangeLineNotes={changeLineNotes}
            notes={notes}
            onNotesChange={setNotes}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            city={city}
            block={block}
            road={road}
            building={building}
            flat={flat}
            onCityChange={setCity}
            onBlockChange={setBlock}
            onRoadChange={setRoad}
            onBuildingChange={setBuilding}
            onFlatChange={setFlat}
            deliveryLat={deliveryLat}
            deliveryLng={deliveryLng}
            onOpenMapPicker={() => setShowMapPicker(true)}
            onClearMapPin={() => { setDeliveryLat(null); setDeliveryLng(null) }}
            subtotal={subtotal}
            error={error}
            isSubmitting={isPending}
            onSubmit={submit}
          />
        </div>
      </div>

      {/* Delivery map picker modal */}
      {showMapPicker && (
        <DeliveryMapPicker
          isAr={isAr}
          initialLat={deliveryLat}
          initialLng={deliveryLng}
          onConfirm={(lat, lng) => {
            setDeliveryLat(lat)
            setDeliveryLng(lng)
            setShowMapPicker(false)
          }}
          onCancel={() => setShowMapPicker(false)}
        />
      )}

      {/* Variant / size picker modal */}
      {pendingItem && (
        <VariantPicker
          item={pendingItem}
          isAr={isAr}
          onCancel={() => setPendingItem(null)}
          onConfirm={(size, variant, unit) => {
            const item = pendingItem
            setPendingItem(null)
            if (item.modifierGroups.length > 0) {
              setPendingModifierItem({ item, size, variant, unit })
            } else {
              addItem(item, size, variant, unit)
            }
          }}
        />
      )}

      {/* Modifier picker modal */}
      {pendingModifierItem && (
        <ModifierPicker
          item={pendingModifierItem.item}
          isAr={isAr}
          baseUnitPriceBhd={pendingModifierItem.unit}
          onCancel={() => setPendingModifierItem(null)}
          onConfirm={(modifiers, adjustedUnit) => {
            const { item, size, variant } = pendingModifierItem
            addItem(item, size, variant, adjustedUnit, modifiers)
            setPendingModifierItem(null)
          }}
        />
      )}
    </div>
  )
}
