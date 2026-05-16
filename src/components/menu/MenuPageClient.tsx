'use client'

import { useState, useMemo, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import type { CategoryWithItems } from '@/lib/menu'
import { useCartStore } from '@/lib/cart'
import {
  getVisibleCategories,
  getCategorySlugsFor,
  MAIN_CATEGORIES,
} from '@/constants/menu-categories'
import MenuHero from './menu-hero'
import MenuCategoryNav from './MenuCategoryNav'
import { MobileSearchOverlay } from './MobileSearchOverlay'
import FeaturedCarousel from './FeaturedCarousel'
import TopOrderHighlights from './TopOrderHighlights'
import MenuSection from './MenuSection'
import { EmptyState } from './EmptyState'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronUp } from 'lucide-react'

interface MenuPageClientProps {
  categories: CategoryWithItems[]
  locale: string
  featuredSlugs: string[]
  initialQuery?: string
}

export default function MenuPageClient({
  categories,
  locale,
  featuredSlugs,
  initialQuery,
}: MenuPageClientProps) {
  const isAr = locale === 'ar'
  const branchId = useCartStore((state) => state.branchId)

  const visibleCategories = useMemo(
    () => getVisibleCategories(branchId ?? null),
    [branchId],
  )

  const [activeCategoryId, setActiveCategoryId] = useState<string>(
    () => (visibleCategories[0] ?? MAIN_CATEGORIES[0]).id,
  )
  const [activeSubcategoryId, setActiveSubcategoryId] = useState<string | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(!!initialQuery)
  const [showScrollTop, setShowScrollTop] = useState(false)

  // If the active main category becomes hidden after a branch change,
  // fall back to the first visible one and reset the subcategory.
  useEffect(() => {
    if (!visibleCategories.some((c) => c.id === activeCategoryId)) {
      setActiveCategoryId(visibleCategories[0]?.id ?? MAIN_CATEGORIES[0].id)
      setActiveSubcategoryId(null)
    }
  }, [visibleCategories, activeCategoryId])

  const featuredItems = useMemo(
    () => categories.flatMap((c) => c.items).filter((i) => featuredSlugs.includes(i.id)),
    [categories, featuredSlugs],
  )

  // Apply main + sub filter to the rendered category sections.
  const filteredCategories = useMemo<CategoryWithItems[]>(() => {
    const allowedSlugs = new Set(
      getCategorySlugsFor(activeCategoryId, activeSubcategoryId, visibleCategories),
    )
    if (allowedSlugs.size === 0) return []
    return categories.filter((cat) => allowedSlugs.has(cat.id))
  }, [categories, activeCategoryId, activeSubcategoryId, visibleCategories])

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.pageYOffset > 500)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  const handleCategoryChange = (categoryId: string) => {
    setActiveCategoryId(categoryId)
    setActiveSubcategoryId(null)
    const el = document.getElementById('menu-content')
    if (el) {
      const offset = 160
      const top = el.getBoundingClientRect().top + window.pageYOffset - offset
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  const t = useTranslations('menu')

  return (
    <main className="bg-brand-black min-h-screen text-brand-text">
      <MenuHero />

      {/* SEO-Rich Intro Section (Phase 6) */}
      <section className="max-w-4xl mx-auto px-6 py-12 text-center">
        <h2 className={`text-2xl md:text-3xl font-black text-brand-text mb-4 ${isAr ? 'font-cairo' : 'font-editorial'}`}>
          {t('categories_intro.title')}
        </h2>
        <p className={`text-brand-muted leading-relaxed ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {t('categories_intro.description')}
        </p>
      </section>

      {featuredItems.length >= 3 && (
        <>
          <FeaturedCarousel items={featuredItems} locale={locale} />
          <TopOrderHighlights items={featuredItems} locale={locale} />
        </>
      )}

      <div id="menu-content">
        <MenuCategoryNav
          visibleCategories={visibleCategories}
          activeCategoryId={activeCategoryId}
          activeSubcategoryId={activeSubcategoryId}
          onCategoryChange={handleCategoryChange}
          onSubcategoryChange={setActiveSubcategoryId}
          onSearchOpen={() => setIsSearchOpen(true)}
          isRTL={isAr}
        />

        <div className="max-w-7xl mx-auto pb-24">
          {filteredCategories.length > 0 ? (
            filteredCategories.map((cat) => (
              <MenuSection
                key={cat.id}
                id={`section-${cat.id}`}
                category={cat}
                locale={locale}
              />
            ))
          ) : (
            <EmptyState locale={locale} />
          )}
        </div>
      </div>

      <MobileSearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        categories={categories}
        locale={locale}
        initialQuery={initialQuery}
      />

      {/* Scroll to Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            onClick={scrollToTop}
            className="fixed bottom-8 end-8 z-50 w-12 h-12 bg-brand-gold text-brand-black rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform duration-300"
            aria-label={isAr ? 'العودة إلى أعلى الصفحة' : 'Scroll to top'}
          >
            <ChevronUp size={24} />
          </motion.button>
        )}
      </AnimatePresence>
    </main>
  )
}
