'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2, LogOut } from 'lucide-react'
import type { CartLine, CartModifier, POSBranch, POSCategory, POSItem } from './types'
import { resolveMenuItemPrice } from './types'
import VariantPicker from './VariantPicker'
import ModifierPicker from './ModifierPicker'
import {
  createServiceOrder,
  type ServiceOrderPayload,
} from '@/app/[locale]/dashboard/pos/service/actions'

interface Props {
  categories:     POSCategory[]
  branches:       POSBranch[]
  lockedBranchId: string | null
  locale:         'ar' | 'en'
}

const TABLE_COUNT = 20

export default function ServiceModeClient({
  categories,
  branches,
  lockedBranchId,
  locale,
}: Props) {
  const t  = useTranslations('pos')
  const tC = useTranslations('common')
  const isAr = locale === 'ar'
  const router = useRouter()
  const prefix = locale === 'en' ? '/en' : ''

  const [branchId, setBranchId] = useState<string>(
    lockedBranchId ?? branches[0]?.id ?? '',
  )
  const [activeCat, setActiveCat] = useState<string>(categories[0]?.id ?? '')
  const [activeTab, setActiveTab] = useState<'menu' | 'order'>('menu')
  const [tableNumber, setTableNumber] = useState<number | null>(null)
  const [carNumber, setCarNumber] = useState<string>('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [pendingItem, setPendingItem] = useState<POSItem | null>(null)
  const [pendingModifierItem, setPendingModifierItem] = useState<{
    item: POSItem
    size: string | null
    variant: { ar: string; en: string } | null
    unit: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ orderId: string; warning?: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const activeCategory = useMemo(
    () => categories.find((c) => c.id === activeCat) ?? categories[0],
    [categories, activeCat],
  )

  const subtotal = useMemo(
    () => Number(cart.reduce((s, l) => s + l.unitPriceBhd * l.quantity, 0).toFixed(3)),
    [cart],
  )

  const itemCount = useMemo(
    () => cart.reduce((s, l) => s + l.quantity, 0),
    [cart],
  )

  function addItem(
    item: POSItem,
    size: string | null,
    variant: { ar: string; en: string } | null,
    unit: number,
    modifiers: CartModifier[] = [],
  ) {
    const modKey = modifiers.map((m) => m.option_id).sort().join(',')
    const key = `${item.id}::${size ?? ''}::${variant?.en ?? ''}::${modKey}`
    setCart((prev) => {
      const existing = prev.find((l) => l.key === key)
      if (existing) {
        return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l))
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
        .map((l) => (l.key === key ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l))
        .filter((l) => l.quantity > 0),
    )
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key))
  }

  function changeLineNotes(key: string, value: string) {
    setCart((prev) =>
      prev.map((l) => (l.key === key ? { ...l, itemNotes: value } : l)),
    )
  }

  function reset() {
    setCart([])
    setTableNumber(null)
    setCarNumber('')
    setError(null)
  }

  function submit() {
    setError(null)
    if (cart.length === 0) {
      setError(t('errorCartEmpty'))
      return
    }
    // Car-side orders identify by plate number instead of table — accept
    // either, but require one. Reject only when both are empty.
    if (tableNumber == null && !carNumber.trim()) {
      setError(t('service.noTableOrCar'))
      return
    }

    const idempotencyKey = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`

    const carNote = carNumber.trim()
    const payload: ServiceOrderPayload = {
      branchId,
      tableNumber,
      carNumber: carNote || undefined,
      notes: carNote ? `سيارة: ${carNote}` : undefined,
      items: cart.map((l) => ({
        menuItemId:   l.itemId,
        quantity:     l.quantity,
        sizeName:     l.size ?? null,
        variantName:  l.variantEn ?? null,
        unitPriceBhd: l.unitPriceBhd,
        itemNotes:    l.itemNotes.trim() || null,
        modifiers:    l.modifiers.length > 0 ? l.modifiers : undefined,
      })),
      idempotencyKey,
    }

    startTransition(async () => {
      try {
        const result = await createServiceOrder(payload)
        if (result.error || !result.orderId) {
          setError(result.error ?? t('errorGeneric'))
          return
        }
        setSuccess({ orderId: result.orderId, warning: result.warning })
        reset()
      } catch (err) {
        console.error('[ServiceModeClient] submit failed:', err)
        setError(err instanceof Error ? err.message : t('errorGeneric'))
      }
    })
  }

  if (success) {
    const shortId = success.orderId.slice(-8).toUpperCase()
    return (
      <div className="w-full h-full flex items-center justify-center px-6" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="max-w-md w-full rounded-xl border border-brand-gold/40 bg-brand-surface p-8 text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full flex items-center justify-center bg-brand-success/10">
            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="text-brand-success">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className={`text-2xl font-black text-brand-gold mb-2 ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
            {t('orderCreated')}
          </h2>
          <p className="font-satoshi text-brand-muted mb-6 tabular-nums">#{shortId}</p>
          {success.warning && (
            <div className={`mb-6 rounded-lg border border-brand-gold/40 bg-brand-gold/10 px-4 py-3 text-start ${isAr ? 'font-almarai' : 'font-satoshi'}`} role="alert">
              <p className="text-xs text-brand-gold/90">{success.warning}</p>
            </div>
          )}
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setSuccess(null)}
              className="w-full min-h-[52px] rounded-lg bg-brand-gold text-brand-black font-satoshi text-base font-bold hover:bg-brand-gold-light transition-colors"
            >
              {t('newOrder')}
            </button>
            <button
              type="button"
              onClick={() => router.push(`${prefix}/dashboard/orders/${success.orderId}`)}
              className="w-full min-h-[44px] rounded-lg border border-brand-border bg-brand-surface-2 text-brand-text font-satoshi font-medium hover:border-brand-gold/40 transition-colors"
            >
              {t('viewOrder')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const branchName = (() => {
    const b = branches.find((x) => x.id === branchId)
    if (!b) return ''
    return isAr ? b.nameAr : b.nameEn
  })()

  return (
    <div className="w-full h-full flex flex-col" dir={isAr ? 'rtl' : 'ltr'}>
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-brand-border bg-brand-surface">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`text-base font-black text-brand-gold whitespace-nowrap ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
            {t('service.title')}
          </span>
          {branches.length > 1 && !lockedBranchId ? (
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="min-h-[40px] rounded-lg bg-brand-surface-2 border border-brand-border px-3 font-satoshi text-sm text-brand-text focus:outline-none focus:border-brand-gold/40"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {isAr ? b.nameAr : b.nameEn}
                </option>
              ))}
            </select>
          ) : (
            <span className={`text-sm text-brand-muted truncate ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {branchName}
            </span>
          )}
        </div>
        <Link
          href={`${prefix}/dashboard/pos`}
          className="inline-flex items-center gap-2 min-h-[44px] rounded-lg border border-brand-border bg-brand-surface-2 px-4 text-sm font-satoshi text-brand-text hover:border-brand-gold/40 transition-colors"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span>{t('service.exitServiceMode')}</span>
        </Link>
      </header>

      {/* Mobile tab switcher — visible below lg */}
      <div className="lg:hidden shrink-0 flex border-b border-brand-border bg-brand-black">
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
          className={`relative flex-1 min-h-[48px] font-satoshi text-sm font-medium transition-colors
            ${activeTab === 'order' ? 'text-brand-gold border-b-2 border-brand-gold' : 'text-brand-muted'}`}
        >
          {isAr ? 'الطلب' : 'Order'}
          {itemCount > 0 && (
            <span className="ms-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 rounded-full bg-brand-gold text-brand-black px-1.5 text-xs font-bold tabular-nums">
              {itemCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Main area: column on mobile, row on lg+ ─────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* LEFT — categories + items */}
        <section className={`flex-1 min-w-0 ${activeTab === 'menu' ? 'flex' : 'hidden lg:flex'}`}>
          {/* Vertical category sidebar */}
          <nav className="shrink-0 w-28 sm:w-40 lg:w-48 border-e border-brand-border bg-brand-surface overflow-y-auto">
            <ul className="flex flex-col py-2">
              {categories.map((c) => {
                const active = c.id === activeCategory?.id
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setActiveCat(c.id)}
                      className={`w-full min-h-[56px] px-3 text-start font-satoshi text-sm font-medium border-s-4 transition-colors
                        ${active
                          ? 'border-brand-gold bg-brand-gold/10 text-brand-gold'
                          : 'border-transparent text-brand-muted hover:text-brand-text hover:bg-brand-surface-2'
                        }`}
                    >
                      <span className={isAr ? 'font-cairo' : 'font-satoshi'}>
                        {isAr ? c.nameAr : c.nameEn}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Items grid (text-first, no images) */}
          <div className="flex-1 min-w-0 overflow-y-auto p-4">
            {activeCategory ? (
              <>
                <h2 className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-3 ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                  {isAr ? activeCategory.nameAr : activeCategory.nameEn}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2">
                  {activeCategory.items.map((item) => (
                    <ServiceItemTile
                      key={item.id}
                      item={item}
                      isAr={isAr}
                      onAdd={() => handleAddRequest(item)}
                      outLabel={t('outOfStock')}
                    />
                  ))}
                </div>
              </>
            ) : (
              <p className="text-center text-brand-muted font-satoshi text-sm py-12">—</p>
            )}
          </div>
        </section>

        {/* RIGHT — table selector + cart + submit
            Mobile: flex-1 + min-h-0 so the inner cart can scroll and the
            sticky bottom bar (totals + Send) stays in view.
            lg+: fixed-width sidebar (lg:flex-none + lg:w-[20rem]). */}
        <aside className={`w-full flex-1 min-h-0 lg:flex-none lg:shrink-0 lg:w-[20rem] xl:w-[22rem] border-t lg:border-t-0 lg:border-s border-brand-border bg-brand-surface flex-col ${activeTab === 'order' ? 'flex' : 'hidden lg:flex'}`}>
          {/* Car number (optional) — appended to order notes as "سيارة: <value>" */}
          <div className="shrink-0 px-4 py-3 border-b border-brand-border">
            <label
              htmlFor="service-car-number"
              className="text-[11px] uppercase tracking-wider text-brand-muted font-satoshi font-bold block mb-2"
            >
              {t('service.carNumber')}
            </label>
            <input
              id="service-car-number"
              type="text"
              value={carNumber}
              onChange={(e) => setCarNumber(e.target.value)}
              maxLength={20}
              dir="ltr"
              className="w-full min-h-[44px] rounded-md bg-brand-surface-2 border border-brand-border px-3 font-satoshi text-sm text-brand-text placeholder:text-brand-muted tabular-nums focus:outline-none focus:border-brand-gold/40"
            />
          </div>

          {/* Table picker */}
          <div className="shrink-0 px-4 py-3 border-b border-brand-border">
            <p className="text-[11px] uppercase tracking-wider text-brand-muted font-satoshi font-bold mb-2">
              {t('service.selectTable')}
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {Array.from({ length: TABLE_COUNT }, (_, i) => i + 1).map((n) => {
                const active = tableNumber === n
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setTableNumber(n)}
                    aria-label={`${t('service.tableNumber')} ${n}`}
                    className={`min-h-[44px] rounded-md font-satoshi text-sm font-bold tabular-nums transition-colors border
                      ${active
                        ? 'bg-brand-gold text-brand-black border-brand-gold'
                        : 'bg-brand-surface-2 text-brand-text border-brand-border hover:border-brand-gold/40'
                      }`}
                  >
                    {n}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Cart */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-brand-muted font-satoshi font-bold mb-2">
              {t('items')}
            </p>
            {cart.length === 0 ? (
              <div className="rounded-lg border border-dashed border-brand-border bg-brand-surface-2/50 px-4 py-8 text-center">
                <p className={`text-sm text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {t('addItems')}
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {cart.map((line) => (
                  <li
                    key={line.key}
                    className="flex flex-col gap-2 rounded-lg border border-brand-border bg-brand-surface-2 p-2"
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm text-brand-text leading-snug ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                          {isAr ? line.nameAr : line.nameEn}
                        </p>
                        {(line.size || line.variantAr) && (
                          <p className="text-[11px] text-brand-muted mt-0.5">
                            {[line.size, isAr ? line.variantAr : line.variantEn]
                              .filter(Boolean).join(' · ')}
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
                        <QtyButton ariaLabel="−" onClick={() => changeQty(line.key, -1)}>−</QtyButton>
                        <span className="font-satoshi text-sm tabular-nums w-6 text-center">
                          {line.quantity}
                        </span>
                        <QtyButton ariaLabel="+" onClick={() => changeQty(line.key, 1)}>+</QtyButton>
                        <button
                          type="button"
                          onClick={() => removeLine(line.key)}
                          aria-label={t('remove')}
                          className="ms-1 inline-flex items-center justify-center w-10 h-10 rounded-md text-brand-muted hover:text-brand-error hover:bg-brand-error/10 transition-colors"
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
                      placeholder={t('itemNotesPlaceholder')}
                      maxLength={200}
                      className={`w-full min-h-[36px] rounded-md bg-brand-surface border border-brand-border px-2.5 text-xs text-brand-text placeholder:text-brand-muted focus:outline-none focus:border-brand-gold/40 ${isAr ? 'font-almarai' : 'font-satoshi'}`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Bottom bar: totals + submit */}
          <div className="shrink-0 border-t border-brand-border bg-brand-surface px-4 py-3 flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className={`text-sm text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                {t('subtotal')}
                <span className="ms-2 text-xs text-brand-muted tabular-nums">({itemCount})</span>
              </span>
              <span className="font-satoshi text-2xl font-black text-brand-gold tabular-nums">
                {subtotal.toFixed(3)}{' '}
                <span className="text-sm font-normal text-brand-muted">{tC('currency')}</span>
              </span>
            </div>

            {error && (
              <div className="rounded-lg border border-brand-error/40 bg-brand-error/10 px-3 py-2 text-sm text-brand-error" role="alert">
                {error}
              </div>
            )}

            <button
              type="button"
              disabled={isPending || cart.length === 0 || (tableNumber == null && !carNumber.trim())}
              onClick={submit}
              className="w-full min-h-[64px] rounded-lg bg-brand-gold text-brand-black font-satoshi text-base font-bold hover:bg-brand-gold-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  {t('creating')}
                </>
              ) : (
                t('service.sendToKitchen')
              )}
            </button>
          </div>
        </aside>
      </div>

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

function ServiceItemTile({
  item, isAr, onAdd, outLabel,
}: {
  item: POSItem
  isAr: boolean
  onAdd: () => void
  outLabel: string
}) {
  const price = resolveMenuItemPrice(item)
  const disabled = !item.available

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onAdd}
      aria-label={isAr
        ? `إضافة ${item.nameAr} - ${price.toFixed(3)} د.ب`
        : `Add ${item.nameEn} - ${price.toFixed(3)} BHD`}
      className={`flex flex-col items-stretch justify-between min-h-[56px] rounded-lg border bg-brand-surface-2 p-2.5 text-start transition-colors
        ${disabled
          ? 'border-brand-border opacity-50 cursor-not-allowed'
          : 'border-brand-border hover:border-brand-gold/50 active:bg-brand-gold/10'
        }`}
    >
      <span className={`text-sm leading-tight line-clamp-2 text-brand-text ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
        {isAr ? item.nameAr : item.nameEn}
      </span>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="font-satoshi font-bold text-brand-gold text-sm tabular-nums">
          {price.toFixed(3)}
        </span>
        {disabled && (
          <span className="text-[10px] font-bold uppercase tracking-wide text-brand-error">
            {outLabel}
          </span>
        )}
      </div>
    </button>
  )
}

function QtyButton({
  onClick, ariaLabel, children,
}: { onClick: () => void; ariaLabel: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="w-10 h-10 rounded-md border border-brand-border bg-brand-surface flex items-center justify-center text-base font-bold text-brand-text hover:border-brand-gold/40 transition-colors"
    >
      {children}
    </button>
  )
}
