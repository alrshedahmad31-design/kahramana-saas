'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2, ShoppingCart, X } from 'lucide-react'
import WaiterMenuBrowser from '@/components/waiter/WaiterMenuBrowser'
import VariantPicker from '@/components/pos/VariantPicker'
import ModifierPicker from '@/components/pos/ModifierPicker'
import type {
  CartLine,
  CartModifier,
  POSCategory,
  POSItem,
} from '@/components/pos/types'
import { createWaiterOrder } from '@/app/[locale]/waiter/actions'
import styles from '@/components/pos/POSClient.module.css'
interface Props {
  categories:  POSCategory[]
  branchId:    string
  tableNumber: number
  labelAr:     string
  labelEn:     string
  locale:      'ar' | 'en'
}

export default function WaiterOrderClient({
  categories, branchId, tableNumber, labelAr, labelEn, locale,
}: Props) {
  const t = useTranslations('waiter')
  const isAr = locale === 'ar'
  const router = useRouter()
  const prefix = locale === 'en' ? '/en' : ''

  const [cart, setCart] = useState<CartLine[]>([])
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID())
  const [pendingItem, setPendingItem] = useState<POSItem | null>(null)
  const [pendingModifierItem, setPendingModifierItem] = useState<{
    item: POSItem
    size: string | null
    variant: { ar: string; en: string } | null
    unit: number
  } | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [orderNotes, setOrderNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const on  = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const subtotal = useMemo(() =>
    Number(cart.reduce((s, l) => s + l.unitPriceBhd * l.quantity, 0).toFixed(3)),
  [cart])

  const itemCount = useMemo(() =>
    cart.reduce((s, l) => s + l.quantity, 0),
  [cart])

  const addToCart = useCallback((
    item: POSItem,
    size: string | null,
    variant: { ar: string; en: string } | null,
    unit: number,
    modifiers: CartModifier[],
  ) => {
    const key = `${item.id}|${size ?? ''}|${variant?.en ?? ''}|${
      modifiers.map((m) => m.option_id).sort().join(',')
    }`
    setCart((prev) => {
      const existing = prev.find((l) => l.key === key)
      if (existing) {
        return prev.map((l) => l === existing ? { ...l, quantity: l.quantity + 1 } : l)
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
  }, [])

  const handleAdd = useCallback((item: POSItem) => {
    if (!item.available) return
    const hasVariantOrSize = item.sizes.length > 0 || item.variants.length > 0
    const hasModifiers = item.modifierGroups.length > 0
    if (hasVariantOrSize) {
      setPendingItem(item)
      return
    }
    const baseUnit = item.priceBhd ?? 0
    if (hasModifiers) {
      setPendingModifierItem({ item, size: null, variant: null, unit: baseUnit })
      return
    }
    addToCart(item, null, null, baseUnit, [])
  }, [addToCart])

  function changeQty(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => l.key === key ? { ...l, quantity: l.quantity + delta } : l)
        .filter((l) => l.quantity > 0),
    )
  }

  function setLineNotes(key: string, notes: string) {
    setCart((prev) =>
      prev.map((l) => l.key === key ? { ...l, itemNotes: notes } : l),
    )
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key))
  }

  function submit() {
    setError(null)
    setSuccess(null)
    if (cart.length === 0) {
      setError(t('errorEmpty'))
      return
    }
    // Offline path is unreachable — submit button is disabled when !isOnline
    // and the offline banner already explains why. No duplicate message here.

    startTransition(async () => {
      const result = await createWaiterOrder({
        branchId,
        tableNumber,
        idempotencyKey,
        items: cart.map((l) => ({
          menuItemId:   l.itemId,
          quantity:     l.quantity,
          variantName:  l.variantEn ?? null,
          sizeName:     l.size ?? null,
          unitPriceBhd: l.unitPriceBhd,
          itemNotes:    l.itemNotes || null,
          modifiers:    l.modifiers,
        })),
        notes: orderNotes.trim() || null,
      })
      if (result.error) {
        // Keep idempotencyKey so a retry of the same attempt returns the same
        // order_id rather than creating a duplicate.
        setError(result.error)
        return
      }
      setSuccess(t('orderSent'))
      setCart([])
      setOrderNotes('')
      setDrawerOpen(false)
      // New attempt gets a fresh idempotency key — only on success.
      setIdempotencyKey(crypto.randomUUID())
      setTimeout(() => router.push(`${prefix}/waiter`), 600)
    })
  }

  const tableLabel = isAr ? labelAr : labelEn

  const cartLinesContent = (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {cart.length === 0 ? (
          <p className={`text-center text-brand-muted text-sm py-8 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'السلة فارغة' : 'Cart is empty'}
          </p>
        ) : cart.map((line) => (
          <div key={line.key} className="bg-brand-black/40 border border-brand-border rounded-lg p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className={`font-bold text-brand-text text-sm ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {isAr ? line.nameAr : line.nameEn}
                </p>
                {(line.size || line.variantAr || line.modifiers.length > 0) && (
                  <p className={`text-xs text-brand-muted mt-0.5 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    {[
                      line.size,
                      isAr ? line.variantAr : line.variantEn,
                      ...line.modifiers.map((m) => isAr ? m.option_name_ar : m.option_name_en),
                    ].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <button
                onClick={() => removeLine(line.key)}
                className="text-brand-error/70 hover:text-brand-error text-xs"
                aria-label={t('removeItem')}
              >
                {t('removeItem')}
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => changeQty(line.key, -1)}
                  className="w-7 h-7 rounded bg-brand-surface border border-brand-border text-brand-text font-bold"
                  aria-label="decrement"
                >−</button>
                <span className="min-w-[32px] text-center font-satoshi font-bold tabular-nums">
                  {line.quantity}
                </span>
                <button
                  onClick={() => changeQty(line.key, 1)}
                  className="w-7 h-7 rounded bg-brand-surface border border-brand-border text-brand-text font-bold"
                  aria-label="increment"
                >+</button>
              </div>
              <span className="font-satoshi font-black text-brand-gold text-sm tabular-nums">
                {(line.unitPriceBhd * line.quantity).toFixed(3)}
              </span>
            </div>
            <input
              type="text"
              value={line.itemNotes}
              onChange={(e) => setLineNotes(line.key, e.target.value)}
              placeholder={t('itemNotes')}
              className="mt-2 w-full bg-brand-surface border border-brand-border rounded-md px-2 py-1.5 text-xs text-brand-text placeholder:text-brand-muted focus:outline-none focus:border-brand-gold/40 font-satoshi"
              maxLength={200}
            />
          </div>
        ))}

        {cart.length > 0 && (
          <div>
            <label className={`block text-xs text-brand-muted mb-1 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {isAr ? 'ملاحظات الطلب' : 'Order notes'}
            </label>
            <textarea
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              rows={2}
              maxLength={500}
              className="w-full bg-brand-black/40 border border-brand-border rounded-md px-2 py-1.5 text-sm text-brand-text placeholder:text-brand-muted focus:outline-none focus:border-brand-gold/40 font-satoshi resize-none"
            />
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-brand-border px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className={`text-sm text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {t('subtotal')}
          </span>
          <span className="font-satoshi font-black text-brand-gold text-lg tabular-nums">
            {subtotal.toFixed(3)} {isAr ? 'د.ب' : 'BHD'}
          </span>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={cart.length === 0 || isPending || !isOnline}
          className={`w-full min-h-[48px] rounded-lg font-black text-base transition-colors flex items-center justify-center gap-2 ${
            cart.length === 0 || isPending || !isOnline
              ? 'bg-brand-surface text-brand-muted cursor-not-allowed'
              : 'bg-brand-gold text-brand-black hover:bg-brand-gold/90'
          } ${isAr ? 'font-cairo' : 'font-satoshi'}`}
        >
          {isPending ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              {t('sending')}
            </>
          ) : (
            t('sendToKitchen')
          )}
        </button>
      </div>
    </>
  )

  return (
    <div className="flex flex-col h-[calc(100dvh-60px)] lg:h-auto lg:block lg:-mx-6 lg:-my-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Mobile Header */}
      <div className="lg:hidden shrink-0 px-4 py-3 border-b border-brand-border bg-brand-surface flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push(`${prefix}/waiter`)}
          className={`text-sm font-bold text-brand-muted hover:text-brand-gold ${isAr ? 'font-almarai' : 'font-satoshi'}`}
        >
          {isAr ? '→ الطاولات' : '← Tables'}
        </button>
        <h1 className={`text-lg font-black text-brand-gold ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
          {tableLabel}
        </h1>
        <div className="w-16" />
      </div>

      {/* Status banners */}
      <div className="lg:mb-0 shrink-0">
        {error && (
          <div className="bg-brand-error/15 border-b border-brand-error/40 px-4 py-2 flex items-center justify-between gap-2">
            <span className={`text-sm text-brand-error ${isAr ? 'font-almarai' : 'font-satoshi'}`}>{error}</span>
            <button onClick={() => setError(null)} aria-label="dismiss" className="text-brand-error">
              <X size={16} />
            </button>
          </div>
        )}
        {success && (
          <div className="bg-brand-success/15 border-b border-brand-success/40 px-4 py-2 text-center">
            <span className={`text-sm font-bold text-brand-success ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {success}
            </span>
          </div>
        )}
        {!isOnline && (
          <div className="bg-brand-error/90 px-4 py-2">
            <span className={`text-sm font-bold text-white ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {t('offline')} — {t('submitDisabledOffline')}
            </span>
          </div>
        )}
      </div>

      <div className={`flex-1 flex flex-col min-h-0 lg:block ${styles.grid}`}>
        {/* Right Panel: Menu Browser */}
        <div className="flex-1 min-h-0 overflow-hidden lg:overflow-visible">
          <WaiterMenuBrowser categories={categories} isAr={isAr} onAdd={handleAdd} />
        </div>

        {/* Left Panel: Desktop Cart Sidebar */}
        <div className={`
          hidden lg:flex lg:flex-col
          ${styles.sidebar}
          border-s border-brand-border bg-brand-surface
        `}>
          <div className="shrink-0 flex items-center justify-between px-4 py-4 border-b border-brand-border">
            <h2 className={`text-xl font-black text-brand-gold ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
              {tableLabel}
            </h2>
            <span className={`text-xs font-bold px-2 py-1 rounded bg-brand-surface-2 text-brand-text ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {isAr ? 'طلب طاولة' : 'Dine in'}
            </span>
          </div>
          {cartLinesContent}
        </div>
      </div>

      {/* Sticky cart bar (Mobile) — always visible, opens drawer */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className={`lg:hidden shrink-0 flex items-center justify-between gap-3 border-t-2 border-brand-gold/60 px-4 py-3 transition-colors ${
          cart.length === 0
            ? 'bg-brand-surface text-brand-muted hover:bg-brand-surface'
            : 'bg-brand-gold text-brand-black hover:bg-brand-gold/90'
        }`}
      >
        <span className="flex items-center gap-2">
          <ShoppingCart size={20} strokeWidth={2.25} />
          <span className={`font-black text-sm ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
            {itemCount} {t('items')}
          </span>
        </span>
        <span className={`font-black text-sm ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
          {t('viewOrder')}
        </span>
        <span className="font-satoshi font-black tabular-nums text-base">
          {subtotal.toFixed(3)} {isAr ? 'د.ب' : 'BHD'}
        </span>
      </button>

      {/* Cart drawer (Mobile) */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="bg-brand-surface w-full rounded-t-2xl border-t border-brand-border max-h-[90dvh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-brand-border">
              <h2 className={`text-lg font-black text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                {tableLabel}
              </h2>
              <button onClick={() => setDrawerOpen(false)} aria-label="close" className="text-brand-muted hover:text-brand-text">
                <X size={20} />
              </button>
            </div>
            {cartLinesContent}
          </div>
        </div>
      )}

      {/* Variant picker */}
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
              addToCart(item, size, variant, unit, [])
            }
          }}
        />
      )}

      {/* Modifier picker */}
      {pendingModifierItem && (
        <ModifierPicker
          item={pendingModifierItem.item}
          isAr={isAr}
          baseUnitPriceBhd={pendingModifierItem.unit}
          onCancel={() => setPendingModifierItem(null)}
          onConfirm={(modifiers, unit) => {
            const { item, size, variant } = pendingModifierItem
            setPendingModifierItem(null)
            addToCart(item, size, variant, unit, modifiers)
          }}
        />
      )}
    </div>
  )
}
