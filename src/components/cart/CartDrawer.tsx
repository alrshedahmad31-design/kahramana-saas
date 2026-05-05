'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useTranslations, useLocale } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from '@/i18n/navigation'
import { useCartStore, selectTotalItems, selectSubtotal, type CartItem } from '@/lib/cart'
import { BRANCH_LIST, type BranchId } from '@/constants/contact'
import CinematicButton from '@/components/ui/CinematicButton'
import { X, Trash2, Minus, Plus, ShoppingBag, MapPin } from 'lucide-react'

export default function CartBottomSheet() {
  const locale = useLocale()
  const isRTL  = locale === 'ar'
  const t      = useTranslations('cart')
  const tCommon = useTranslations('common')
  const router = useRouter()

  const items            = useCartStore((s) => s.items)
  const branchId         = useCartStore((s) => s.branchId)
  const isOpen           = useCartStore((s) => s.isOpen)
  const closeCart        = useCartStore((s) => s.closeCart)
  const addItem          = useCartStore((s) => s.addItem)
  const removeItem       = useCartStore((s) => s.removeItem)
  const updateQty        = useCartStore((s) => s.updateQuantity)
  const updateItemNotes  = useCartStore((s) => s.updateItemNotes)
  const clearCart        = useCartStore((s) => s.clearCart)
  const setBranch        = useCartStore((s) => s.setBranch)

  const totalItems = selectTotalItems(items)
  const subtotal   = selectSubtotal(items)

  const [mounted, setMounted] = useState(false)
  const [removedItem, setRemovedItem] = useState<CartItem | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (isOpen && mounted) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [isOpen, mounted])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeCart()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeCart])

  function handleRemoveItem(item: CartItem) {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    removeItem(item.cartKey)
    setRemovedItem(item)
    undoTimerRef.current = setTimeout(() => setRemovedItem(null), 5000)
  }

  function handleUndoRemove() {
    if (!removedItem) return
    const { cartKey: _cartKey, ...restoredItem } = removedItem
    addItem(restoredItem)
    setRemovedItem(null)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
  }

  function handleClearCart() {
    if (window.confirm(t('confirmClear'))) clearCart()
  }

  if (!mounted) return null

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
            className="fixed inset-0 z-[100] bg-brand-black/80 backdrop-blur-md"
          />
        )}
      </AnimatePresence>

      {/* Cart Sheet */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t('title')}
            dir={isRTL ? 'rtl' : 'ltr'}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
            className="fixed bottom-0 z-[101] flex h-[92vh] w-full flex-col overflow-hidden rounded-t-[2.5rem] border-t border-brand-gold/10 bg-brand-black shadow-2xl lg:end-0 lg:h-full lg:w-[480px] lg:rounded-t-none lg:border-s lg:border-t-0"
          >
            {/* Pull Handle (Mobile Only) */}
            <div className="flex shrink-0 items-center justify-center py-4 lg:hidden">
              <div className="h-1.5 w-12 rounded-full bg-brand-surface-2" />
            </div>

            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-brand-border/30 px-6 py-5 lg:pt-8">
              <div className="flex flex-col gap-1">
                <h2 className={`text-2xl font-black text-brand-text ${isRTL ? 'font-cairo' : 'font-editorial'}`}>
                  {t('title')}
                </h2>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-gold/60">
                   {totalItems} {isRTL ? 'منتجات' : 'Items'}
                </p>
              </div>

              <button
                onClick={closeCart}
                aria-label={t('close')}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-surface-2 text-brand-muted transition-all hover:bg-brand-surface hover:text-brand-text active:scale-90"
              >
                <X size={24} />
              </button>
            </div>

            {/* Branch Selection (Contextual) */}
            <div className="shrink-0 bg-brand-surface-2/30 px-6 py-4">
              <div className="flex items-center gap-3">
                 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gold/10 text-brand-gold">
                    <MapPin size={20} />
                 </div>
                 <div className="flex flex-1 flex-col">
                    <label htmlFor="cart-branch-select" className="text-[10px] font-bold uppercase tracking-wider text-brand-muted/60">
                      Ordering From
                    </label>
                    <select
                      id="cart-branch-select"
                      value={branchId || 'riffa'}
                      onChange={(e) => setBranch(e.target.value as BranchId)}
                      className="bg-transparent text-sm font-bold text-brand-text focus:outline-none"
                    >
                      {BRANCH_LIST.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {isRTL ? branch.nameAr : branch.nameEn}
                        </option>
                      ))}
                    </select>
                 </div>
              </div>
            </div>

            {/* Items List */}
            <div className="no-scrollbar flex-1 overflow-y-auto px-6 py-4">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-8 text-center">
                  <div className="relative">
                    <div className="absolute inset-0 animate-ping rounded-full bg-brand-gold/5" />
                    <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-brand-surface-2 text-brand-gold/20">
                      <ShoppingBag size={48} strokeWidth={1} />
                    </div>
                  </div>
                  <div>
                    <h3 className={`text-xl font-black text-brand-text mb-2 ${isRTL ? 'font-cairo' : 'font-satoshi'}`}>
                      {t('empty')}
                    </h3>
                    <p className="max-w-[240px] text-sm leading-relaxed text-brand-muted">
                      {t('emptyHint')}
                    </p>
                  </div>
                  <button
                    onClick={() => { closeCart(); router.push('/menu') }}
                    className="rounded-2xl border border-brand-gold/20 bg-brand-gold/5 px-8 py-4 text-sm font-black text-brand-gold transition-all hover:bg-brand-gold hover:text-brand-black"
                  >
                    {t('browseMenu')}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {items.map((item) => (
                    <CartItemRow
                      key={item.cartKey}
                      item={item}
                      isRTL={isRTL}
                      currency={tCommon('currency')}
                      labels={{
                        remove: t('removeAlt', { name: isRTL ? item.nameAr : item.nameEn }),
                        decrease: t('decrease'),
                        increase: t('increase'),
                      }}
                      onRemove={() => handleRemoveItem(item)}
                      onUpdateQty={(q: number) => updateQty(item.cartKey, q)}
                      onUpdateNotes={(n: string) => updateItemNotes(item.cartKey, n)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer Summary */}
            {items.length > 0 && (
              <div className="border-t border-brand-border/30 bg-brand-black p-6 pb-10 shadow-[0_-20px_40px_rgba(0,0,0,0.5)] lg:pb-8">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-muted/60">{t('subtotal')}</span>
                    <span className="text-[10px] text-brand-muted/40 font-almarai italic">Excluding delivery</span>
                  </div>
                  <div className="flex items-baseline gap-1 font-satoshi text-brand-gold">
                    <span className="text-3xl font-black tabular-nums">{subtotal.toFixed(3)}</span>
                    <span className="text-xs font-bold opacity-60">{tCommon('currency')}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <CinematicButton
                    onClick={() => { closeCart(); router.push('/checkout') }}
                    isRTL={isRTL}
                    className="h-[64px] rounded-2xl text-lg font-black"
                  >
                    {t('checkout')}
                  </CinematicButton>

                  <button
                    onClick={handleClearCart}
                    className="flex items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-muted/40 transition-colors hover:text-brand-error"
                  >
                    <Trash2 size={12} />
                    {t('clearAll')}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {removedItem && (
          <motion.div
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-6 left-1/2 z-[130] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center justify-between gap-4 rounded-2xl border border-brand-border bg-brand-surface px-4 py-3 shadow-2xl"
          >
            <span className={`text-sm text-brand-text ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
              {t('removedToast', { name: isRTL ? removedItem.nameAr : removedItem.nameEn })}
            </span>
            <button
              type="button"
              onClick={handleUndoRemove}
              className="shrink-0 rounded-lg bg-brand-gold px-3 py-2 text-xs font-bold text-brand-black"
            >
              {t('undo')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function CartItemRow({ item, isRTL, currency, labels, onRemove, onUpdateQty, onUpdateNotes }: {
  item: CartItem
  isRTL: boolean
  currency: string
  labels: {
    remove: string
    decrease: string
    increase: string
  }
  onRemove: () => void
  onUpdateQty: (q: number) => void
  onUpdateNotes: (n: string) => void
}) {
  const [notesOpen, setNotesOpen] = useState(false)
  const lineTotal = (item.priceBhd * item.quantity).toFixed(3)
  const name = isRTL ? item.nameAr : item.nameEn

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: isRTL ? 20 : -20 }}
      className="group relative flex flex-col gap-2 rounded-2xl border border-brand-border/30 bg-brand-surface-2/40 p-4 transition-all hover:border-brand-gold/20 hover:bg-brand-surface-2/60"
    >
      <div className="flex gap-4">
        {/* Image with Glow */}
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-brand-border/50 bg-brand-black">
          <Image
            src={item.imageUrl ?? '/assets/hero/hero-menu.webp'}
            alt={name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            sizes="80px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-black/40 to-transparent" />
        </div>

        {/* Item Info */}
        <div className="flex flex-1 flex-col justify-between py-0.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1 text-start">
              <h4 className={`line-clamp-1 text-sm font-black text-brand-text ${isRTL ? 'font-cairo' : 'font-satoshi'}`}>
                {name}
              </h4>
              {(item.selectedSize || item.selectedVariant) && (
                <p className="font-almarai text-[10px] font-bold uppercase tracking-wider text-brand-gold/60">
                  {[item.selectedSize, item.selectedVariant].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <button
              onClick={onRemove}
              aria-label={labels.remove}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-muted/40 transition-colors hover:bg-brand-error/10 hover:text-brand-error"
            >
              <Trash2 size={16} />
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between">
            {/* Enhanced Stepper */}
            <div className="flex items-center gap-1 rounded-lg bg-brand-black/20 p-1">
              <button
                onClick={() => onUpdateQty(Math.max(1, item.quantity - 1))}
                aria-label={labels.decrease}
                className="flex h-7 w-7 items-center justify-center rounded-md text-brand-muted transition-colors hover:bg-brand-surface hover:text-brand-text active:scale-90"
              >
                <Minus size={14} />
              </button>
              <span className="min-w-[24px] text-center font-satoshi text-xs font-black tabular-nums text-brand-text">
                {item.quantity}
              </span>
              <button
                onClick={() => onUpdateQty(item.quantity + 1)}
                aria-label={labels.increase}
                className="flex h-7 w-7 items-center justify-center rounded-md text-brand-muted transition-colors hover:bg-brand-surface hover:text-brand-text active:scale-90"
              >
                <Plus size={14} />
              </button>
            </div>

            <div className="flex items-baseline gap-1 font-satoshi text-brand-gold">
              <span className="text-lg font-black tabular-nums">{lineTotal}</span>
              <span className="text-[10px] font-bold opacity-60">{currency}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Per-item notes */}
      <div>
        {item.notes && !notesOpen ? (
          <button
            onClick={() => setNotesOpen(true)}
            className={`text-[11px] text-brand-gold/70 hover:text-brand-gold transition-colors ${isRTL ? 'font-almarai' : 'font-satoshi'}`}
          >
            ✏️ {item.notes}
          </button>
        ) : notesOpen ? (
          <textarea
            autoFocus
            defaultValue={item.notes ?? ''}
            onBlur={(e) => { onUpdateNotes(e.target.value); setNotesOpen(false) }}
            placeholder={isRTL ? 'مثال: بدون بصل، إضافي حارة...' : 'e.g. no onions, extra spicy...'}
            rows={2}
            dir={isRTL ? 'rtl' : 'ltr'}
            className={`w-full rounded-lg border border-brand-border/50 bg-brand-black/40 px-3 py-2 text-xs text-brand-text placeholder:text-brand-muted/50 focus:border-brand-gold/50 focus:outline-none resize-none ${isRTL ? 'font-almarai' : 'font-satoshi'}`}
          />
        ) : (
          <button
            onClick={() => setNotesOpen(true)}
            className={`text-[11px] text-brand-muted/40 hover:text-brand-muted transition-colors ${isRTL ? 'font-almarai' : 'font-satoshi'}`}
          >
            + {isRTL ? 'ملاحظات خاصة' : 'Special instructions'}
          </button>
        )}
      </div>
    </motion.div>
  )
}
