'use client'

import { useTranslations } from 'next-intl'
import type { CategoryWithItems } from '@/lib/menu'
import { SectionDivider } from './SectionDivider'
import MenuGrid from './menu-grid'

interface MenuSectionProps {
  category: CategoryWithItems
  locale: string
  id: string
}

export default function MenuSection({ category, locale, id }: MenuSectionProps) {
  const t = useTranslations('menu')
  if (category.items.length === 0) return null

  return (
    <section 
      id={id} 
      data-category-section 
      data-category-id={category.id}
      className="scroll-mt-[136px] pt-2 pb-8"
    >
      <SectionDivider 
        title={t(`categoryNames.${category.id}` as Parameters<typeof t>[0])} 
        count={category.items.length} 
        locale={locale} 
      />
      <MenuGrid items={category.items} locale={locale} />
    </section>
  )
}
