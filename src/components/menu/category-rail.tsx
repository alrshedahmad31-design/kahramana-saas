'use client'

import { motion } from 'framer-motion'
import type { NormalizedMenuCategory } from '@/lib/menu'

interface CategoryRailProps {
  categories: NormalizedMenuCategory[]
  activeCategory: string
  allValue: string
  allLabel: string
  onChange: (category: string) => void
  isRTL: boolean
}

export default function CategoryRail({
  categories,
  activeCategory,
  allValue,
  allLabel,
  onChange,
  isRTL,
}: CategoryRailProps) {
  return (
    <div
      className="no-scrollbar overflow-x-auto overscroll-x-contain scroll-smooth py-2"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="flex min-w-max items-center gap-3">
        <CategoryItem
          label={allLabel}
          active={activeCategory === allValue}
          onClick={() => onChange(allValue)}
          isRTL={isRTL}
        />
        
        {categories.map((category) => (
          <CategoryItem
            key={category.slug}
            label={isRTL ? category.name.ar : category.name.en}
            count={category.itemCount}
            active={activeCategory === category.slug}
            onClick={() => onChange(category.slug)}
            isRTL={isRTL}
          />
        ))}
      </div>
    </div>
  )
}

function CategoryItem({
  label,
  count,
  active,
  onClick,
  isRTL,
}: {
  label: string
  count?: number
  active: boolean
  onClick: () => void
  isRTL: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`relative flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition-all duration-300 active:scale-95 ${
        isRTL ? 'font-almarai' : 'font-satoshi'
      } ${
        active
          ? 'text-brand-black'
          : 'text-brand-muted hover:text-brand-text'
      }`}
    >
      {active && (
        <motion.div
          layoutId="active-category"
          className="absolute inset-0 rounded-xl bg-brand-gold shadow-[0_4px_20px_rgba(200,146,42,0.3)]"
          transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
        />
      )}
      
      <span className="relative z-10">{label}</span>
      
      {count !== undefined && (
        <span className={`relative z-10 text-[10px] uppercase tracking-wider opacity-60 tabular-nums ${active ? 'text-brand-black' : 'text-brand-muted'}`}>
          {count}
        </span>
      )}
    </button>
  )
}
