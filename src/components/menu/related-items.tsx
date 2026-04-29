import type { NormalizedMenuItem } from '@/lib/menu'
import MenuGrid from '@/components/menu/menu-grid'

interface RelatedItemsProps {
  items: NormalizedMenuItem[]
  title: string
  emptyTitle: string
  emptyHint: string
  outOfStockLabel: string
  fromLabel: string
  currency: string
  isRTL: boolean
}

export default function RelatedItems({
  items,
  title,
  emptyTitle,
  emptyHint,
  outOfStockLabel,
  fromLabel,
  currency,
  isRTL,
}: RelatedItemsProps) {
  if (items.length === 0) return null

  return (
    <section className="mx-auto max-w-7xl ps-4 pe-4 pt-0 pb-20 sm:ps-6 sm:pe-6">
      <h2
        className={`mb-5 text-2xl font-black text-brand-text text-start ${
          isRTL ? 'font-cairo' : 'font-editorial'
        }`}
      >
        {title}
      </h2>
      <MenuGrid
        items={items}
        emptyTitle={emptyTitle}
        emptyHint={emptyHint}
        outOfStockLabel={outOfStockLabel}
        fromLabel={fromLabel}
        currency={currency}
        isRTL={isRTL}
      />
    </section>
  )
}
