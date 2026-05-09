'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Loader2, ShoppingCart, X } from 'lucide-react'
import WaiterMenuBrowser from '@/components/waiter/WaiterMenuBrowser'
import VariantPicker from '@/components/pos/VariantPicker'
import ModifierPicker from '@/components/pos/ModifierPicker'
import type {
  CartLine,
  CartModifier,
  POSCategory,
  POSItem,
} from '@/components/pos/types'
import { createQROrder } from '@/app/[locale]/table/actions'

interface Props {
  categories:    POSCategory[]
  branchId:      string
  branchNameAr:  string
  branchNameEn:  string
  tableNumber:   number
  tableLabelAr:  string
  tableLabelEn:  string
  locale:        'ar' | 'en'
}

export default function QRTableClient({
  categories, branchId, branchNameAr, branchNameEn,
  tableNumber, tableLabelAr, tableLabelEn, locale,
}: Props) {
  const t  = useTranslations('qrOrder')
  const tw = useTranslations('waiter')
  const isAr   = locale === 'ar'
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
  const [customerName, setCustomerName]   = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [orderNotes, setOrderNotes]       = useState('')
  const [error, setError]     = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

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
    if (cart.length === 0) {
      setError(t('errorEmpty'))
      return
    }

    startTransition(async () => {
      const result = await createQROrder({
        branchId,
        tableNumber,
        idempotencyKey,
        customerName:  customerName.trim() || null,
        customerPhone: customerPhone.trim() || null,
        items: cart.map((l) => ({
          menuItemId:   l.itemId,
          quantity:     l.quantity,
          variantName:  l.variantEn ?? null,
          sizeName:     l.size ?? null,
          itemNotes:    l.itemNotes || null,
          modifiers:    l.modifiers,
        })),
        notes: orderNotes.trim() || null,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.orderId) {
        setOrderId(result.orderId)
        setIdempotencyKey(crypto.randomUUID())
        setDrawerOpen(false)
      }
    })
  }

  // ── Success view ──────────────────────────────────────────────────────────
  if (orderId) {
    return (
      <div
        data-staff-shell
        dir={isAr ? 'rtl' : 'ltr'}
        className="min-h-[100dvh] bg-brand-black flex items-center justify-center px-6"
      >
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-brand-success/15 text-brand-success mb-6">
            <CheckCircle2 size={48} strokeWidth={2} />
          </div>
          <h1 className={`text-2xl font-black text-brand-text mb-3 ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
            {t('successTitle')}
          </h1>
          <p className={`text-brand-muted mb-6 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {t('successHint')}
          </p>
          <Link
            href={`${prefix}/order/${orderId}`}
            className={`inline-flex items-center justify-center min-h-[48px] px-6 rounded-lg bg-brand-gold text-brand-black font-black hover:bg-brand-gold/90 transition-colors ${isAr ? 'font-cairo' : 'font-satoshi'}`}
          >
            {t('trackOrder')}
          </Link>
        </div>
      </div>
    )
  }

  // ── Order builder view ────────────────────────────────────────────────────
  const branchName = isAr ? branchNameAr : branchNameEn
  const tableLabel = isAr ? tableLabelAr : tableLabelEn

  return (
    <div
      data-staff-shell
      dir={isAr ? 'rtl' : 'ltr'}
      className="flex flex-col min-h-[100dvh] bg-brand-black"
    >
      {/* Branch + table banner */}
      <header className="shrink-0 px-4 py-3 border-b border-brand-border bg-brand-surface text-center">
        <p className={`text-xs uppercase tracking-wide text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {branchName}
        </p>
        <h1 className={`text-lg font-black text-brand-gold mt-0.5 ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
          {tableLabel}
        </h1>
      </header>

      {/* Error banner */}
      {error && (
        <div className="shrink-0 bg-brand-error/15 border-b border-brand-error/40 px-4 py-2 flex items-center justify-between gap-2">
          <span className={`text-sm text-brand-error ${isAr ? 'font-almarai' : 'font-satoshi'}`}>{error}</span>
          <button onClick={() => setError(null)} aria-label="dismiss" className="text-brand-error">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Menu */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <WaiterMenuBrowser categories={categories} isAr={isAr} onAdd={handleAdd} />
      </div>

      {/* Sticky cart bar */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className={`shrink-0 flex items-center justify-between gap-3 border-t-2 border-brand-gold/60 px-4 py-3 transition-colors ${
          cart.length === 0
            ? 'bg-brand-surface text-brand-muted hover:bg-brand-surface'
            : 'bg-brand-gold text-brand-black hover:bg-brand-gold/90'
        }`}
      >
        <span className="flex items-center gap-2">
          <ShoppingCart size={20} strokeWidth={2.25} />
          <span className={`font-black text-sm ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
            {itemCount} {tw('items')}
          </span>
        </span>
        <span className={`font-black text-sm ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
          {t('checkout')}
        </span>
        <span className="font-satoshi font-black tabular-nums text-base">
          {subtotal.toFixed(3)} {isAr ? 'د.ب' : 'BHD'}
        </span>
      </button>

      {/* Cart drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="bg-brand-surface w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl border-t sm:border border-brand-border max-h-[90dvh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            dir={isAr ? 'rtl' : 'ltr'}
          >
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-brand-border">
              <h2 className={`text-lg font-black text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                {t('cart')}
              </h2>
              <button onClick={() => setDrawerOpen(false)} aria-label="close" className="text-brand-muted hover:text-brand-text">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {cart.length === 0 ? (
                <p className={`text-center text-brand-muted py-8 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {t('errorEmpty')}
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
                    >
                      {tw('removeItem')}
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
                    placeholder={tw('itemNotes')}
                    className="mt-2 w-full bg-brand-surface border border-brand-border rounded-md px-2 py-1.5 text-xs text-brand-text placeholder:text-brand-muted focus:outline-none focus:border-brand-gold/40 font-satoshi"
                    maxLength={200}
                  />
                </div>
              ))}

              {cart.length > 0 && (
                <div className="space-y-2 pt-2">
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder={t('customerName')}
                    maxLength={120}
                    className="w-full bg-brand-black/40 border border-brand-border rounded-md px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted focus:outline-none focus:border-brand-gold/40 font-satoshi"
                  />
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder={t('customerPhone')}
                    maxLength={20}
                    inputMode="tel"
                    className="w-full bg-brand-black/40 border border-brand-border rounded-md px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted focus:outline-none focus:border-brand-gold/40 font-satoshi"
                  />
                  <textarea
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder={isAr ? 'ملاحظات الطلب' : 'Order notes'}
                    className="w-full bg-brand-black/40 border border-brand-border rounded-md px-3 py-2 text-sm text-brand-text placeholder:text-brand-muted focus:outline-none focus:border-brand-gold/40 font-satoshi resize-none"
                  />
                  <p className={`text-xs text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    {t('paymentCash')}
                  </p>
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
                disabled={cart.length === 0 || isPending}
                className={`w-full min-h-[48px] rounded-lg font-black text-base flex items-center justify-center gap-2 transition-colors ${
                  cart.length === 0 || isPending
                    ? 'bg-brand-surface text-brand-muted cursor-not-allowed'
                    : 'bg-brand-gold text-brand-black hover:bg-brand-gold/90'
                } ${isAr ? 'font-cairo' : 'font-satoshi'}`}
              >
                {isPending ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    {t('submitting')}
                  </>
                ) : (
                  t('submit')
                )}
              </button>
            </div>
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
