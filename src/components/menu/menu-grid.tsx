'use client'

import type { NormalizedMenuItem } from '@/lib/menu'
import MenuItemCard from './menu-item-card'

interface MenuGridProps {
  items: NormalizedMenuItem[]
  locale: string
}

export default function MenuGrid({ items, locale }: MenuGridProps) {
  return (
    <div className="
      grid grid-cols-2 gap-3 
      sm:grid-cols-2 sm:gap-4 
      lg:grid-cols-3 
      xl:grid-cols-4 
      ps-3 pe-3 sm:ps-4 sm:pe-4
    ">
      {items.map((item, index) => (
        <MenuItemCard
          key={item.id}
          item={item}
          locale={locale}
          index={index}
        />
      ))}
    </div>
  )
}
