'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import type { CategoryWithItems } from '@/lib/menu'
import MenuHero from './menu-hero'
import StickyFilterBar from './StickyFilterBar'
import { MobileSearchOverlay } from './MobileSearchOverlay'
import FeaturedCarousel from './FeaturedCarousel'
import TopOrderHighlights from './TopOrderHighlights'
import MenuSection from './MenuSection'
import { EmptyState } from './EmptyState'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronUp } from 'lucide-react'

interface MenuPageClientProps {
  categories: CategoryWithItems[]
  locale: string
  featuredSlugs: string[]
}

export default function MenuPageClient({ categories, locale, featuredSlugs }: MenuPageClientProps) {
  const isAr = locale === 'ar'
  const [activeCategory, setActiveCategory] = useState('all')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const featuredItems = useMemo(
    () => categories.flatMap(c => c.items).filter(i => featuredSlugs.includes(i.id)),
    [categories, featuredSlugs]
  )

  // ── SCROLL TRACKING ──
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.pageYOffset > 500)
    }

    window.addEventListener('scroll', handleScroll)
    
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const categoryId = entry.target.getAttribute('data-category-id')
            if (categoryId) setActiveCategory(categoryId)
          }
        })
      },
      { root: null, rootMargin: '-160px 0px -60% 0px', threshold: 0 }
    )

    const sections = document.querySelectorAll('[data-category-section]')
    sections.forEach((section) => observerRef.current?.observe(section))

    return () => {
      observerRef.current?.disconnect()
      window.removeEventListener('scroll', handleScroll)
    }
  }, [categories])


  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
        <StickyFilterBar
          categories={categories}
          activeCategory={activeCategory}
          onSearchOpen={() => setIsSearchOpen(true)}
          locale={locale}
        />

        <div className="max-w-7xl mx-auto pb-24">
          {categories.length > 0 ? (
            categories.map((cat) => (
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
      />

      {/* Scroll to Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            onClick={scrollToTop}
            className="fixed bottom-8 right-8 z-50 w-12 h-12 bg-brand-gold text-brand-black rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform duration-300"
            aria-label="Scroll to top"
          >
            <ChevronUp size={24} />
          </motion.button>
        )}
      </AnimatePresence>
    </main>
  )
}

