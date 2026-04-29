'use client'

import { useTranslations } from 'next-intl'
import { BRANCH_LIST, type BranchId } from '@/constants/contact'
import { useCartStore } from '@/lib/cart'
import type { NormalizedMenuCategory } from '@/lib/menu'
import CategoryRail from '@/components/menu/category-rail'
import MenuFilters from '@/components/menu/menu-filters'
import MenuSearch from '@/components/menu/menu-search'
import { MapPin } from 'lucide-react'

interface MenuToolbarProps {
  categories: NormalizedMenuCategory[]
  activeCategory: string
  allCategoryValue: string
  search: string
  availableOnly: boolean
  onCategoryChange: (category: string) => void
  onSearchChange: (value: string) => void
  onAvailableOnlyChange: (value: boolean) => void
  isRTL: boolean
}

export default function MenuToolbar({
  categories,
  activeCategory,
  allCategoryValue,
  search,
  availableOnly,
  onCategoryChange,
  onSearchChange,
  onAvailableOnlyChange,
  isRTL,
}: MenuToolbarProps) {
  const t = useTranslations('menu')
  const branchId = useCartStore((state) => state.branchId)
  const setBranch = useCartStore((state) => state.setBranch)
  
  const currentBranch = BRANCH_LIST.find((b) => b.id === branchId)
  const branchName = currentBranch
    ? (isRTL ? currentBranch.nameAr : currentBranch.nameEn)
    : branchId

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="sticky top-[64px] z-30 border-b border-brand-gold/10 bg-brand-black/80 ps-4 pe-4 pt-4 pb-4 backdrop-blur-xl sm:ps-6 sm:pe-6"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        {/* Top Row: Search + Branch + Filter */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex-1">
            <MenuSearch
              value={search}
              onChange={onSearchChange}
              placeholder={t('search')}
              clearLabel={t('clearSearch')}
              isRTL={isRTL}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Branch Selector */}
            <div className="relative min-w-[160px] flex-1 lg:flex-none">
              <MapPin className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gold" aria-hidden="true" />
              <select
                value={branchId}
                onChange={(event) => setBranch(event.target.value as BranchId)}
                dir={isRTL ? 'rtl' : 'ltr'}
                aria-label={t('branchLabel', { branch: branchName })}
                className={`min-h-[52px] w-full rounded-xl border border-brand-border bg-brand-surface-2 ps-9 pe-9 text-sm font-bold text-brand-text focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold/20 transition-all duration-300 appearance-none cursor-pointer ${
                  isRTL ? 'font-almarai' : 'font-satoshi'
                }`}
              >
                {BRANCH_LIST.filter((branch) => branch.status === 'active').map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {isRTL ? branch.nameAr : branch.nameEn}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-brand-muted">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>

            {/* Filter Toggle */}
            <MenuFilters
              availableOnly={availableOnly}
              onAvailableOnlyChange={onAvailableOnlyChange}
              label={t('availableOnly')}
              isRTL={isRTL}
            />
          </div>
        </div>

        {/* Bottom Row: Categories */}
        <div className="border-t border-brand-border/30 pt-1">
          <CategoryRail
            categories={categories}
            activeCategory={activeCategory}
            allValue={allCategoryValue}
            allLabel={t('allCategories')}
            onChange={onCategoryChange}
            isRTL={isRTL}
          />
        </div>
      </div>
    </div>
  )
}
