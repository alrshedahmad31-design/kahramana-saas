'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { NormalizedMenuCategory, NormalizedMenuItem } from '@/lib/menu'
import CategoryCard from '@/components/menu/category-card'
import MenuGrid from '@/components/menu/menu-grid'
import MenuToolbar from '@/components/menu/menu-toolbar'

const ALL_CATEGORIES = '__all__'

interface MenuExperienceProps {
  categories: NormalizedMenuCategory[]
  items: NormalizedMenuItem[]
  initialCategory?: string
  isRTL: boolean
}

export default function MenuExperience({
  categories,
  items,
  initialCategory = ALL_CATEGORIES,
  isRTL,
}: MenuExperienceProps) {
  const t = useTranslations('menu')
  const tCommon = useTranslations('common')

  const [activeCategory, setActiveCategory] = useState(initialCategory)
  const [search, setSearch] = useState('')
  const [availableOnly, setAvailableOnly] = useState(false)

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return items.filter((item) => {
      const matchesCategory =
        activeCategory === ALL_CATEGORIES || item.categorySlug === activeCategory
      const matchesAvailability = !availableOnly || item.available
      const matchesSearch =
        normalizedSearch.length === 0 ||
        [
          item.name.ar,
          item.name.en,
          item.description?.ar,
          item.description?.en,
          item.categoryName.ar,
          item.categoryName.en,
        ]
          .filter((value): value is string => Boolean(value))
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch)

      return matchesCategory && matchesAvailability && matchesSearch
    })
  }, [activeCategory, availableOnly, items, search])

  return (
    <section className="bg-brand-black pb-20">
      <MenuToolbar
        categories={categories}
        activeCategory={activeCategory}
        allCategoryValue={ALL_CATEGORIES}
        search={search}
        availableOnly={availableOnly}
        onCategoryChange={setActiveCategory}
        onSearchChange={setSearch}
        onAvailableOnlyChange={setAvailableOnly}
        isRTL={isRTL}
      />

      <div className="mx-auto max-w-7xl ps-4 pe-4 pt-8 sm:ps-6 sm:pe-6">
        {activeCategory === ALL_CATEGORIES && search.trim().length === 0 && (
          <div className="mb-8">
            <h2
              className={`mb-4 text-2xl font-black text-brand-text text-start ${
                isRTL ? 'font-cairo' : 'font-editorial'
              }`}
            >
              {t('sectionTitle')}
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {categories.slice(0, 8).map((category) => (
                <CategoryCard
                  key={category.slug}
                  category={category}
                  itemCountLabel={t('categoryItemCount', {
                    count: category.itemCount,
                  })}
                  isRTL={isRTL}
                />
              ))}
            </div>
          </div>
        )}

        <div
          className={`mb-5 flex items-end justify-between gap-3 text-start`}
        >
          <div>
            <p
              className={`text-xs font-bold uppercase tracking-wide text-brand-gold ${
                isRTL ? 'font-almarai' : 'font-satoshi'
              }`}
            >
              {t('resultsLabel', { count: filteredItems.length, total: items.length })}
            </p>
            <h2
              className={`mt-1 text-2xl font-black text-brand-text ${
                isRTL ? 'font-cairo' : 'font-editorial'
              }`}
            >
              {t('resultsCount', { count: filteredItems.length })}
            </h2>
          </div>
        </div>

        <MenuGrid
          items={filteredItems}
          emptyTitle={t('searchNoResults')}
          emptyHint={t('searchNoResultsHint')}
          outOfStockLabel={t('outOfStock')}
          fromLabel={t('priceFrom')}
          currency={tCommon('currency')}
          isRTL={isRTL}
        />
      </div>
    </section>
  )
}
