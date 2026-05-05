'use client'

import { useMemo, useContext } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ShoppingBag, Minus, Plus } from 'lucide-react'
import { useCartStore } from '@/lib/cart'
import type { MenuVariantOption, NormalizedMenuItem } from '@/lib/menu'
import { resolveMenuItemPrice } from '@/lib/menu'
import { ItemSelectionContext } from '@/components/menu/item-selection-provider'
import ItemSizeSelector from '@/components/menu/item-size-selector'
import ItemVariantSelector from '@/components/menu/item-variant-selector'
import { motion, AnimatePresence } from 'framer-motion'
import { gtag } from '@/lib/gtag'
import { bhdToFils, formatPrice } from '@/lib/format'

interface Props {
  isRTL: boolean
  item?: NormalizedMenuItem
  size?: 'sm' | 'lg'
  disabled?: boolean
}

export default function AddToCartButton({ isRTL, item: propItem, size = 'lg', disabled }: Props) {
  const t = useTranslations('menu')
  const tCart = useTranslations('cart')
  const locale = useLocale()
  const addItem = useCartStore((state) => state.addItem)
  
  // Try to get from context, fallback to prop
  const context = useContext(ItemSelectionContext)
  const item = propItem || context?.item
  
  const {
    selectedSize,
    selectedVariant,
    quantity,
    computedPrice,
    lineTotal,
    setSelectedSize,
    setSelectedVariant,
    setQuantity
  } = context || {
    selectedSize: undefined,
    selectedVariant: undefined,
    quantity: 1,
    computedPrice: propItem ? resolveMenuItemPrice(propItem) : 0,
    lineTotal: propItem ? resolveMenuItemPrice(propItem) : 0,
    setSelectedSize: () => {},
    setSelectedVariant: () => {},
    setQuantity: () => {}
  }

  const variantAr = useMemo(() => {
    if (!item?.variants || !selectedVariant) return undefined
    return item.variants.find((v: MenuVariantOption) => v.label.en === selectedVariant)?.label.ar ?? selectedVariant
  }, [item?.variants, selectedVariant])

  if (!item) return null

  function handleAdd() {
    if (!item) return

    addItem({
      itemId: item.id,
      nameAr: item.name.ar,
      nameEn: item.name.en,
      imageUrl: item.image,
      priceFils: bhdToFils(computedPrice),
      selectedSize,
      selectedVariant: variantAr,
      quantity,
    })

    gtag.addToCart({ id: item.id, name: item.name.en, price: computedPrice, quantity })
  }

  // Compact variant for grid cards
  if (size === 'sm') {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          handleAdd()
        }}
        disabled={disabled}
        className="
          flex h-10 w-10 items-center justify-center rounded-xl
          border border-brand-gold/20 bg-brand-gold/5 text-brand-gold
          transition-all duration-300 hover:bg-brand-gold hover:text-brand-black
          hover:shadow-[0_0_15px_rgba(200,146,42,0.3)] disabled:opacity-50
          disabled:cursor-not-allowed active:scale-95
        "
        aria-label={t('addToCart')}
      >
        <Plus size={20} />
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-8" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Selectors Row */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {item.sizes && Object.keys(item.sizes).length > 0 && (
          <ItemSizeSelector
            sizes={item.sizes}
            selectedSize={selectedSize}
            onChange={setSelectedSize}
            label={t('size')}
            locale={locale}
            isRTL={isRTL}
          />
        )}

        {item.variants && item.variants.length > 0 && (
          <ItemVariantSelector
            variants={item.variants}
            selectedVariant={selectedVariant}
            onChange={setSelectedVariant}
            label={t('variant')}
            locale={locale}
            isRTL={isRTL}
            showPrices={!item.sizes}
          />
        )}
      </div>

      {/* Action Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Modern Quantity Stepper */}
        <div className="flex min-h-[56px] items-center gap-1 rounded-2xl border border-brand-border bg-brand-surface-2 p-1.5 shadow-inner">
          <button
            type="button"
            onClick={() => setQuantity(q => Math.max(1, q - 1))}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-brand-muted transition-all hover:bg-brand-surface hover:text-brand-text active:scale-90"
            aria-label={tCart('decrease')}
          >
            <Minus size={18} />
          </button>
          
          <div className="flex min-w-[40px] items-center justify-center">
             <AnimatePresence mode="wait">
               <motion.span
                 key={quantity}
                 initial={{ y: 10, opacity: 0 }}
                 animate={{ y: 0, opacity: 1 }}
                 exit={{ y: -10, opacity: 0 }}
                 className="text-lg font-black tabular-nums text-brand-text"
               >
                 {quantity}
               </motion.span>
             </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={() => setQuantity(q => q + 1)}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-brand-muted transition-all hover:bg-brand-surface hover:text-brand-text active:scale-90"
            aria-label={tCart('increase')}
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Premium Add Button */}
        <button
          type="button"
          onClick={handleAdd}
          disabled={disabled}
          className={`group relative flex min-h-[56px] flex-1 items-center justify-center gap-3 overflow-hidden rounded-2xl bg-brand-gold px-8 text-lg font-black text-brand-black transition-all duration-300 hover:shadow-[0_8px_25px_rgba(200,146,42,0.4)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
            isRTL ? 'font-almarai' : 'font-satoshi'
          }`}
        >
          <ShoppingBag className="h-5 w-5 transition-transform group-hover:-translate-y-1 group-hover:scale-110" aria-hidden="true" />
          <span>{t('addToCart')}</span>
          <div className="ms-auto flex items-baseline gap-1 rounded-lg bg-brand-black/10 px-3 py-1 tabular-nums">
            <span className="text-xl">{formatPrice(lineTotal, locale)}</span>
          </div>
        </button>
      </div>
    </div>
  )
}
