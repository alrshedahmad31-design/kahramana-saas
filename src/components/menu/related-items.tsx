import type { NormalizedMenuItem } from '@/lib/menu'
import MenuGrid from '@/components/menu/menu-grid'

interface RelatedItemsProps {
  items: NormalizedMenuItem[]
  title: string
  locale: string
}

export default function RelatedItems({
  items,
  title,
  locale,
}: RelatedItemsProps) {
  if (items.length === 0) return null

  return (
    <section className="mx-auto max-w-7xl px-4 py-16">
      <h2
        className="mb-8 text-2xl font-cairo font-black text-brand-text text-start border-s-4 border-brand-gold ps-4"
      >
        {title}
      </h2>
      <MenuGrid
        items={items}
        locale={locale}
      />
    </section>
  )
}
