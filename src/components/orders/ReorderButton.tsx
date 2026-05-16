'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useCartStore } from '@/lib/cart'
import { getMenuItemBySlug } from '@/lib/menu'
import { toast } from '@/lib/toast'
import ConfirmModal from '@/components/ui/ConfirmModal'

// Only the order_items fields we read — keeps the prop surface free from any
// Supabase Row type churn (NUMERIC string ↔ number, etc.) and lets the server
// page pass a hand-picked subset.
export interface ReorderItem {
  menu_item_slug: string
  name_ar: string
  name_en: string
  quantity: number
  selected_size: string | null
  selected_variant: string | null
  notes: string | null
  unit_price_bhd: number | string
}

interface Props {
  items: ReorderItem[]
  isRTL: boolean
}

export default function ReorderButton({ items, isRTL }: Props) {
  const t          = useTranslations('order')
  const cartItems  = useCartStore((s) => s.items)
  const clearCart  = useCartStore((s) => s.clearCart)
  const addItem    = useCartStore((s) => s.addItem)
  const openCart   = useCartStore((s) => s.openCart)

  const [confirmOpen, setConfirmOpen] = useState(false)

  const performReorder = () => {
    // Resolve every line against the current menu BEFORE mutating the cart so
    // a partial failure leaves the existing cart untouched.
    type Resolved = { menuItem: ReturnType<typeof getMenuItemBySlug>; src: ReorderItem }
    const resolved: Resolved[] = items.map((it) => ({
      menuItem: getMenuItemBySlug(it.menu_item_slug),
      src:      it,
    }))

    const surviving = resolved.filter((r): r is Resolved & { menuItem: NonNullable<Resolved['menuItem']> } => r.menuItem !== null)
    const missing   = resolved.length - surviving.length

    if (surviving.length === 0) {
      // Nothing left to add — abort without touching the existing cart.
      toast.warning(t('reorderAllMissing'))
      return
    }

    if (cartItems.length > 0) clearCart()

    for (const { menuItem, src } of surviving) {
      // Historical unit price — PostgREST returns NUMERIC as string per the
      // postgrest_numeric memory; coerce defensively even though the inserted
      // value reaches the cart as priceBhd which gets re-encoded to fils.
      const priceBhd = Number(src.unit_price_bhd)
      addItem({
        itemId:          menuItem.slug,
        nameAr:          menuItem.name.ar,
        nameEn:          menuItem.name.en,
        imageUrl:        menuItem.image,
        priceBhd:        Number.isFinite(priceBhd) ? priceBhd : 0,
        quantity:        src.quantity,
        selectedSize:    src.selected_size ?? undefined,
        selectedVariant: src.selected_variant ?? undefined,
        notes:           src.notes ?? undefined,
      })
    }

    if (missing > 0) {
      toast.warning(t('reorderMissingItems'))
    }

    // No /cart route exists; cart is a drawer. addItem already toggles isOpen,
    // but call openCart explicitly so the intent is obvious if that internal
    // behavior is ever changed.
    openCart()
  }

  const handleClick = () => {
    if (cartItems.length > 0) {
      setConfirmOpen(true)
      return
    }
    performReorder()
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={t('reorder')}
        className={`flex items-center justify-center gap-2 w-full
                    bg-brand-surface-2 border border-brand-gold/40 text-brand-gold
                    font-satoshi font-bold text-base
                    py-4 rounded-lg mb-3
                    hover:bg-brand-gold/10 active:bg-brand-gold/20
                    transition-colors duration-150
                    ${isRTL ? 'font-almarai' : 'font-satoshi'}`}
      >
        {t('reorder')}
      </button>

      <ConfirmModal
        isOpen={confirmOpen}
        message={t('reorderConfirm')}
        onConfirm={() => {
          setConfirmOpen(false)
          performReorder()
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
