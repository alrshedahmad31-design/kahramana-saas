'use client'

import { useMemo, useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { createManualOrder, type ManualOrderPayload } from '@/app/[locale]/dashboard/pos/actions'
import type { CartLine, POSBranch, POSCategory, POSItem } from './types'
import MenuBrowser from './MenuBrowser'
import OrderBuilder from './OrderBuilder'
import styles from './POSClient.module.css'
import VariantPicker from './VariantPicker'

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
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ orderId: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const subtotal = useMemo(
    () => Number(cart.reduce((s, l) => s + l.unitPriceBhd * l.quantity, 0).toFixed(3)),
    [cart],
  )

  function addItem(item: POSItem, size: string | null, variant: { ar: string; en: string } | null, unit: number) {
    const key = `${item.id}::${size ?? ''}::${variant?.en ?? ''}`
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
    const hasSizes = item.sizes.length > 0
    const hasVariants = item.variants.length > 0
    if (hasSizes || hasVariants) {
      setPendingItem(item)
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
    }

    startTransition(async () => {
      const result = await createManualOrder(payload)
      if (result.error || !result.orderId) {
        setError(result.error ?? t('errorGeneric'))
        return
      }
      setSuccess({ orderId: result.orderId })
      reset()
    })
  }

  if (success) {
    const shortId = success.orderId.slice(-8).toUpperCase()
    return (
      <div className="min-h-[60vh] flex items-center justify-center" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="max-w-md w-full rounded-xl border border-brand-gold/40 bg-brand-surface p-8 text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-brand-success/10 flex items-center justify-center">
            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="text-brand-success">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className={`text-2xl font-black text-brand-gold mb-2 ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
            {t('orderCreated')}
          </h2>
          <p className="font-satoshi text-brand-muted mb-6 tabular-nums">#{shortId}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => router.push(`${prefix}/dashboard/orders/${success.orderId}`)}
              className="flex-1 min-h-[44px] rounded-lg bg-brand-gold text-brand-black font-satoshi font-bold hover:bg-brand-gold-light transition-colors"
            >
              {t('viewOrder')}
            </button>
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
    )
  }

  return (
    <div className="-mx-4 sm:-mx-6 -my-6" dir={isAr ? 'rtl' : 'ltr'}>
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
            addItem(pendingItem, size, variant, unit)
            setPendingItem(null)
          }}
        />
      )}
    </div>
  )
}
