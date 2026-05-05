'use client'

import { motion } from 'framer-motion'
import { SIZE_LABELS, type CartItem } from '@/lib/cart'
import type { MenuSizeMap } from '@/lib/menu'
import { formatPrice } from '@/lib/format'

interface ItemSizeSelectorProps {
  sizes: MenuSizeMap
  selectedSize?: string
  onChange: (size: string) => void
  label: string
  locale: string
  isRTL: boolean
}

export default function ItemSizeSelector({
  sizes,
  selectedSize,
  onChange,
  label,
  locale,
  isRTL,
}: ItemSizeSelectorProps) {
  const sizeKeys = Object.keys(sizes)

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
        {sizeKeys.map((sizeKey) => {
          const typedSize = sizeKey as CartItem['selectedSize']
          const displayLabel = SIZE_LABELS[sizeKey]
          const price = (sizes as Record<string, number | undefined>)[sizeKey] ?? 0
          const active = selectedSize === sizeKey

          return (
            <button
              key={sizeKey}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(sizeKey)}
              className={`relative flex min-h-[52px] min-w-[100px] flex-col items-center justify-center gap-0.5 rounded-xl border transition-all duration-300 active:scale-95 ${
                isRTL ? 'font-almarai' : 'font-satoshi'
              } ${
                active
                  ? 'border-brand-gold bg-brand-gold text-brand-black shadow-[0_4px_15px_rgba(200,146,42,0.25)]'
                  : 'border-brand-border bg-brand-surface-2 text-brand-muted hover:border-brand-gold/30 hover:text-brand-text'
              }`}
            >
              {active && (
                <motion.div
                  layoutId="active-size"
                  className="absolute inset-0 rounded-xl bg-brand-gold"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              
              <span className="relative z-10 text-sm font-black uppercase tracking-tight">
                {isRTL
                  ? displayLabel?.ar ?? typedSize
                  : displayLabel?.en ?? typedSize}
              </span>
              <span className={`relative z-10 text-[10px] font-bold tabular-nums opacity-60 ${active ? 'text-brand-black' : 'text-brand-muted'}`}>
                {formatPrice(price, locale)}
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
