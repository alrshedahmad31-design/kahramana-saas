'use client'

import type { CategoryWithItems } from '@/lib/menu'
import { SectionDivider } from './SectionDivider'
import MenuGrid from './menu-grid'

interface MenuSectionProps {
  category: CategoryWithItems
  locale: string
  id: string
}

export default function MenuSection({ category, locale, id }: MenuSectionProps) {
  if (category.items.length === 0) return null

  return (
    <section 
      id={id} 
      data-category-section 
      data-category-id={category.id}
      className="scroll-mt-[136px] pt-2 pb-8"
    >
      <SectionDivider 
        title={category.nameAR} 
        count={category.items.length} 
        locale={locale} 
      />
      <MenuGrid items={category.items} locale={locale} />
    </section>
  )
}
