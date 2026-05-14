'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import MenuBrowser from '@/components/pos/MenuBrowser'
import VariantPicker from '@/components/pos/VariantPicker'
import ModifierPicker from '@/components/pos/ModifierPicker'
import styles from '@/components/pos/POSClient.module.css'
import type {
  CartLine,
  CartModifier,
  POSCategory,
  POSItem,
} from '@/components/pos/types'
import { createWaiterOrder } from '@/app/[locale]/waiter/actions'

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
  const t  = useTranslations('waiter')
  const tP = useTranslations('pos')
  const tC = useTranslations('common')
  const isAr = locale === 'ar'
  const router = useRouter()
  const prefix = locale === 'en' ? '/en' : ''

  const [activeTab, setActiveTab] = useState<'menu' | 'order'>('menu')
  const [cart, setCart] = useState<CartLine[]>([])
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID())
  const [pendingItem, setPendingItem] = useState<POSItem | null>(null)
  const [pendingModifierItem, setPendingModifierItem] = useState<{
    item: POSItem
    size: string | null
    variant: { ar: string; en: string } | null
    unit: number
  } | null>(null)
  const [orderNotes, setOrderNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
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

  const subtotal = useMemo(
    () => Number(cart.reduce((s, l) => s + l.unitPriceBhd * l.quantity, 0).toFixed(3)),
    [cart],
  )

  const itemCount = useMemo(
    () => cart.reduce((s, l) => s + l.quantity, 0),
    [cart],
  )

  const addItem = useCallback((
    item: POSItem,
    size: string | null,
    variant: { ar: string; en: string } | null,
    unit: number,
    modifiers: CartModifier[] = [],
  ) => {
    const modKey = modifiers.map((m) => m.option_id).sort().join(',')
    const key = `${item.id}::${size ?? ''}::${variant?.en ?? ''}::${modKey}`
    setCart((prev) => {
      const existing = prev.find((l) => l.key === key)
      if (existing) {
        return prev.map((l) => l.key === key ? { ...l, quantity: l.quantity + 1 } : l)
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

  const handleAddRequest = useCallback((item: POSItem) => {
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
  }, [addItem])

  const changeQty = useCallback((key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => l.key === key ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l)
        .filter((l) => l.quantity > 0),
    )
  }, [])

  const changeLineNotes = useCallback((key: string, value: string) => {
    setCart((prev) => prev.map((l) => l.key === key ? { ...l, itemNotes: value } : l))
  }, [])

  const removeLine = useCallback((key: string) => {
    setCart((prev) => prev.filter((l) => l.key !== key))
  }, [])

  function submit() {
    setError(null)
    setSuccess(null)
    setWarning(null)
    if (cart.length === 0) {
      setError(t('errorEmpty'))
      return
    }

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
          itemNotes:    l.itemNotes.trim() || null,
          modifiers:    l.modifiers,
        })),
        notes: orderNotes.trim() || null,
      })
      if (result.error) {
        // Keep idempotencyKey so a retry returns the same order_id rather
        // than creating a duplicate.
        setError(result.error)
        return
      }
      if (result.warning) setWarning(result.warning)
      setSuccess(t('orderSent'))
      setCart([])
      setOrderNotes('')
      setActiveTab('menu')
      // New attempt gets a fresh idempotency key — only on success.
      setIdempotencyKey(crypto.randomUUID())
      setTimeout(() => router.push(`${prefix}/waiter`), 800)
    })
  }

  const tableLabel = isAr ? labelAr : labelEn

  return (
    <div className="-mx-4 sm:-mx-6 -my-6" dir={isAr ? 'rtl' : 'ltr'}>
      {!isOnline && (
        <div
          role="status"
          className="flex items-center gap-2 px-4 py-2 text-sm font-satoshi border-b bg-brand-error/10 text-brand-error border-brand-error/30"
        >
          <span className="inline-block w-2 h-2 rounded-full bg-brand-error animate-pulse" />
          <span>{t('offline')} — {t('submitDisabledOffline')}</span>
        </div>
      )}

      {/* Mobile tab switcher — same pattern as POSClient */}
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
            {itemCount > 0 && (
              <span className="absolute top-1 ms-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-gold text-brand-black text-xs font-bold tabular-nums">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        {/* Menu Browser — POS component */}
        <div className={activeTab === 'menu' ? 'block' : 'hidden lg:block'}>
          <MenuBrowser
            categories={categories}
            isAr={isAr}
            onAdd={handleAddRequest}
          />
        </div>

        {/* Waiter sidebar — POS-style basket, no customer/branch/payment fields */}
        <div className={`${styles.sidebar} border-s border-brand-border bg-brand-surface${activeTab !== 'order' ? ' max-lg:hidden' : ''}`}>
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-4 py-4 border-b border-brand-border">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className={`text-lg font-black text-brand-text truncate ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                    {tableLabel}
                  </h2>
                  <p className="text-xs text-brand-muted mt-0.5 uppercase tracking-wider">
                    {branchId} · {isAr ? 'وضع النادل' : 'Waiter mode'}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded bg-brand-gold/10 text-brand-gold border border-brand-gold/30 uppercase tracking-wider">
                  {isAr ? 'صالة' : 'Dine-in'}
                </span>
              </div>
            </div>

            {/* Body — cart lines + order notes */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
              <FieldLabel label={tP('items')} />
              {cart.length === 0 ? (
                <div className="rounded-lg border border-dashed border-brand-border bg-brand-surface-2/50 px-4 py-8 text-center">
                  <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mx-auto mb-2 text-brand-muted/60">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293A1 1 0 005.414 17H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className={`text-sm text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    {tP('addItems')}
                  </p>
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {cart.map((line) => (
                    <li
                      key={line.key}
                      className="flex flex-col gap-2 rounded-lg border border-brand-border bg-brand-surface-2 p-2.5"
                    >
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm text-brand-text leading-snug ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                            {isAr ? line.nameAr : line.nameEn}
                          </p>
                          {(line.size || line.variantAr || line.modifiers.length > 0) && (
                            <p className="text-[11px] text-brand-muted mt-0.5">
                              {[
                                line.size,
                                isAr ? line.variantAr : line.variantEn,
                                ...line.modifiers.map((m) => isAr ? m.option_name_ar : m.option_name_en),
                              ].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          <p className="text-xs text-brand-muted tabular-nums mt-1">
                            {line.unitPriceBhd.toFixed(3)} × {line.quantity} ={' '}
                            <span className="text-brand-gold font-bold">
                              {(line.unitPriceBhd * line.quantity).toFixed(3)}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <QtyBtn ariaLabel="−" onClick={() => changeQty(line.key, -1)}>−</QtyBtn>
                          <span className="font-satoshi text-sm tabular-nums w-6 text-center">
                            {line.quantity}
                          </span>
                          <QtyBtn ariaLabel="+" onClick={() => changeQty(line.key, 1)}>+</QtyBtn>
                          <button
                            type="button"
                            onClick={() => removeLine(line.key)}
                            aria-label={tP('remove')}
                            className="ms-1 inline-flex items-center justify-center w-7 h-7 rounded-lg text-brand-muted hover:text-brand-error hover:bg-brand-error/10 transition-colors"
                          >
                            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={line.itemNotes}
                        onChange={(e) => changeLineNotes(line.key, e.target.value)}
                        placeholder={tP('itemNotesPlaceholder')}
                        maxLength={200}
                        className={`w-full min-h-[36px] rounded-md bg-brand-surface border border-brand-border px-2.5 text-xs text-brand-text placeholder:text-brand-muted focus:outline-none focus:border-brand-gold/40 ${isAr ? 'font-almarai' : 'font-satoshi'}`}
                      />
                    </li>
                  ))}
                </ul>
              )}

              <div>
                <FieldLabel label={tP('notes')} />
                <textarea
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder={tP('notesPlaceholder')}
                  rows={2}
                  maxLength={500}
                  className="w-full rounded-lg bg-brand-surface-2 border border-brand-border px-3 py-2 font-satoshi text-sm text-brand-text placeholder:text-brand-muted focus:outline-none focus:border-brand-gold/40 resize-none"
                />
              </div>
            </div>

            {/* Sticky footer: totals + submit */}
            <div className="border-t border-brand-border bg-brand-surface px-4 py-4 flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <span className={`text-sm text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {t('subtotal')}
                </span>
                <span className="font-satoshi text-sm text-brand-text tabular-nums">
                  {subtotal.toFixed(3)} <span className="text-xs text-brand-muted">{tC('currency')}</span>
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className={`text-base font-bold text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                  {tP('total')}
                </span>
                <span className="font-satoshi text-2xl font-black text-brand-gold tabular-nums">
                  {subtotal.toFixed(3)} <span className="text-sm font-normal text-brand-muted">{tC('currency')}</span>
                </span>
              </div>

              {error && (
                <div className="rounded-lg border border-brand-error/40 bg-brand-error/10 px-3 py-2 text-sm text-brand-error">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-lg border border-brand-success/40 bg-brand-success/10 px-3 py-2 text-sm text-brand-success">
                  {success}
                </div>
              )}
              {warning && (
                <div className="rounded-lg border border-brand-gold/40 bg-brand-gold/10 px-3 py-2 text-sm text-brand-gold" role="alert">
                  <p className="font-bold mb-0.5">
                    {isAr ? 'يلزم تدخّل المدير' : 'Manager resolution required'}
                  </p>
                  <p className="text-xs text-brand-gold/90">{warning}</p>
                </div>
              )}

              <button
                type="button"
                disabled={isPending || cart.length === 0 || !isOnline}
                onClick={submit}
                className="w-full min-h-[52px] rounded-lg bg-brand-gold text-brand-black font-satoshi text-base font-bold hover:bg-brand-gold-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isPending ? t('sending') : t('sendToKitchen')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Variant / size picker */}
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

      {/* Modifier picker */}
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

function FieldLabel({ label }: { label: string }) {
  return (
    <p className="text-[11px] uppercase tracking-wider text-brand-muted font-satoshi font-bold mb-2">
      {label}
    </p>
  )
}

function QtyBtn({
  children, onClick, ariaLabel,
}: {
  children: React.ReactNode
  onClick: () => void
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-brand-surface border border-brand-border text-brand-text font-satoshi font-bold hover:border-brand-gold/40 transition-colors"
    >
      {children}
    </button>
  )
}
