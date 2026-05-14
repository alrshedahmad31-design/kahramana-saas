'use client'

import { useTranslations } from 'next-intl'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { Search } from 'lucide-react'
import type { MenuMainCategory } from '@/constants/menu-categories'
import { Icon } from '@/components/ui/Icon'

interface MenuCategoryNavProps {
  visibleCategories: MenuMainCategory[]
  activeCategoryId: string
  activeSubcategoryId: string | null
  onCategoryChange: (categoryId: string) => void
  onSubcategoryChange: (subcategoryId: string | null) => void
  onSearchOpen: () => void
  isRTL: boolean
}

export default function MenuCategoryNav({
  visibleCategories,
  activeCategoryId,
  activeSubcategoryId,
  onCategoryChange,
  onSubcategoryChange,
  onSearchOpen,
  isRTL,
}: MenuCategoryNavProps) {
  const t = useTranslations('menu')
  const activeMain = visibleCategories.find((c) => c.id === activeCategoryId) ?? null
  const hasSubs = (activeMain?.subcategories.length ?? 0) > 0

  return (
    <nav
      role="navigation"
      aria-label={t('filter.ariaLabel')}
      className="sticky top-20 md:top-24 z-40 bg-brand-black/90 backdrop-blur-xl border-b border-brand-surface2/50"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <LayoutGroup>
        {/* ── Level 1: main categories ────────────────────────────────── */}
        <div className="flex items-stretch h-[64px]">
          <div
            className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto scrollbar-none px-4 scroll-smooth"
            role="tablist"
            aria-label={t('mainCategories.ariaLabel')}
          >
            {visibleCategories.map((cat) => {
              const isActive = cat.id === activeCategoryId
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onCategoryChange(cat.id)}
                  className={`relative shrink-0 inline-flex items-center gap-2 px-4 py-2 h-full font-almarai text-sm transition-colors duration-[250ms] ${
                    isActive
                      ? 'text-brand-gold font-bold'
                      : 'text-brand-muted hover:text-brand-text'
                  }`}
                >
                  <Icon name={cat.icon} size={18} className="shrink-0" />
                  <span className="whitespace-nowrap">
                    {t(`mainCategories.${cat.i18nKey}` as Parameters<typeof t>[0])}
                  </span>
                  {isActive && (
                    <motion.span
                      layoutId="main-cat-underline"
                      className="absolute bottom-0 inset-x-3 h-[2px] bg-brand-gold rounded-full shadow-[0_0_8px_rgba(200,146,42,0.45)]"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    />
                  )}
                </button>
              )
            })}
          </div>

          {/* Search trigger preserved from previous filter bar */}
          <div className="shrink-0 flex items-center pe-3 ps-2 border-s border-brand-surface2/50">
            <button
              type="button"
              onClick={onSearchOpen}
              aria-label={t('filter.search')}
              className="w-10 h-10 flex items-center justify-center rounded-full text-brand-muted hover:text-brand-gold hover:bg-brand-surface2 transition-all duration-[250ms]"
            >
              <Search size={20} />
            </button>
          </div>
        </div>

        {/* ── Level 2: subcategories (animated reveal) ────────────────── */}
        <AnimatePresence initial={false}>
          {hasSubs && activeMain && (
            <motion.div
              key={activeMain.id}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="overflow-hidden border-t border-brand-surface2/40"
            >
              <div
                className="flex items-center gap-2 overflow-x-auto scrollbar-none px-4 py-2"
                role="tablist"
                aria-label={t('subcategories.ariaLabel')}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeSubcategoryId === null}
                  onClick={() => onSubcategoryChange(null)}
                  className={`shrink-0 px-3 py-1.5 rounded-full font-almarai text-xs transition-all duration-[250ms] ${
                    activeSubcategoryId === null
                      ? 'bg-brand-gold text-brand-black font-bold'
                      : 'bg-brand-surface2 text-brand-muted hover:text-brand-text'
                  }`}
                >
                  {t('subcategories.all')}
                </button>

                {activeMain.subcategories.map((sub) => {
                  const isActive = sub.id === activeSubcategoryId
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => onSubcategoryChange(sub.id)}
                      className={`shrink-0 px-3 py-1.5 rounded-full font-almarai text-xs transition-all duration-[250ms] whitespace-nowrap ${
                        isActive
                          ? 'bg-brand-gold text-brand-black font-bold'
                          : 'bg-brand-surface2 text-brand-muted hover:text-brand-text'
                      }`}
                    >
                      {t(`subcategories.${sub.i18nKey}` as Parameters<typeof t>[0])}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </LayoutGroup>
    </nav>
  )
}
