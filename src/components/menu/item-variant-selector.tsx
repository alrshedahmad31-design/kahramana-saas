'use client'

import { motion } from 'framer-motion'
import type { MenuVariantOption } from '@/lib/menu'

interface ItemVariantSelectorProps {
  variants: MenuVariantOption[]
  selectedVariant?: string
  onChange: (variant: string) => void
  label: string
  currency: string
  isRTL: boolean
  showPrices: boolean
}

export default function ItemVariantSelector({
  variants,
  selectedVariant,
  onChange,
  label,
  currency,
  isRTL,
  showPrices,
}: ItemVariantSelectorProps) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend
        className={`text-[10px] font-bold uppercase tracking-[0.2em] text-brand-muted/60 text-start ${
          isRTL ? 'font-almarai' : 'font-satoshi'
        }`}
      >
        {label}
      </legend>
      <div className="flex flex-wrap gap-3">
        {variants.map((variant) => {
          const active = selectedVariant === variant.label.en

          return (
            <button
              key={variant.label.en}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(variant.label.en)}
              className={`relative flex min-h-[52px] items-center justify-center gap-2 rounded-xl border px-6 text-sm font-bold transition-all duration-300 active:scale-95 ${
                isRTL ? 'font-almarai' : 'font-satoshi'
              } ${
                active
                  ? 'border-brand-gold bg-brand-gold text-brand-black shadow-[0_4px_15px_rgba(200,146,42,0.25)]'
                  : 'border-brand-border bg-brand-surface-2 text-brand-muted hover:border-brand-gold/30 hover:text-brand-text'
              }`}
            >
              {active && (
                <motion.div
                  layoutId="active-variant"
                  className="absolute inset-0 rounded-xl bg-brand-gold"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              
              <span className="relative z-10">
                {isRTL ? variant.label.ar : variant.label.en}
              </span>
              
              {showPrices && typeof variant.price_bhd === 'number' && (
                <span className={`relative z-10 text-[10px] font-bold tabular-nums opacity-60 ${active ? 'text-brand-black' : 'text-brand-muted'}`}>
                  {variant.price_bhd.toFixed(3)} {currency}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
