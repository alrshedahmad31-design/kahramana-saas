import type { NormalizedMenuItem } from '@/lib/menu'
import MenuItemCard from '@/components/menu/menu-item-card'
import { motion } from 'framer-motion'

interface MenuGridProps {
  items: NormalizedMenuItem[]
  emptyTitle: string
  emptyHint: string
  outOfStockLabel: string
  fromLabel: string
  currency: string
  isRTL: boolean
}

export default function MenuGrid({
  items,
  emptyTitle,
  emptyHint,
  outOfStockLabel,
  fromLabel,
  currency,
  isRTL,
}: MenuGridProps) {
  if (items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-brand-gold/10 bg-brand-surface/50 ps-6 pe-6 pt-10 pb-10 text-center backdrop-blur-sm"
      >
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-brand-gold/5 text-brand-gold/30">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
        </div>
        <p
          className={`text-2xl font-black text-brand-text ${
            isRTL ? 'font-cairo' : 'font-editorial'
          }`}
        >
          {emptyTitle}
        </p>
        <p className={`mt-3 max-w-sm leading-7 text-brand-muted/80 ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
          {emptyHint}
        </p>
      </motion.div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, index) => (
        <MenuItemCard
          key={item.slug}
          item={item}
          index={index}
          name={isRTL ? item.name.ar : item.name.en}
          description={
            item.description ? (isRTL ? item.description.ar : item.description.en) : undefined
          }
          categoryName={isRTL ? item.categoryName.ar : item.categoryName.en}
          outOfStockLabel={outOfStockLabel}
          fromLabel={fromLabel}
          currency={currency}
          isRTL={isRTL}
        />
      ))}
    </div>
  )
}
