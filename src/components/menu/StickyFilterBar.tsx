'use client'

import { Search } from 'lucide-react'
import { useRef, useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import type { CategoryWithItems } from '@/lib/menu'
import { motion, AnimatePresence } from 'framer-motion'

interface StickyFilterBarProps {
  categories: CategoryWithItems[]
  activeCategory: string
  onSearchOpen: () => void
  locale: string
}

export default function StickyFilterBar({
  categories,
  activeCategory,
  onSearchOpen,
  locale,
}: StickyFilterBarProps) {
  const isRTL = locale === 'ar'
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showStartFade, setShowStartFade] = useState(false)
  const [showEndFade, setShowEndFade] = useState(true)

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    
    // In RTL, scrollLeft is negative or starts at 0 and goes negative
    const absScrollLeft = Math.abs(scrollLeft)
    setShowStartFade(absScrollLeft > 10)
    setShowEndFade(absScrollLeft < scrollWidth - clientWidth - 10)
  }

  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.addEventListener('scroll', handleScroll)
      handleScroll() // Initial check
    }
    return () => el?.removeEventListener('scroll', handleScroll)
  }, [])

  const handleCategoryClick = (id: string) => {
    if (id === 'all') {
      const el = document.getElementById('menu-content')
      if (el) {
        const offset = 160
        const top = el.getBoundingClientRect().top + window.pageYOffset - offset
        window.scrollTo({ top, behavior: 'smooth' })
      }
    } else {
      const element = document.getElementById(`section-${id}`)
      if (element) {
        const offset = 140 // Adjusted for header + filter bar height
        const elementPosition = element.getBoundingClientRect().top + window.pageYOffset
        window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' })
      }
    }
  }

  const t = useTranslations('menu')

  return (
    <nav
      role="tablist"
      aria-label={t('filter.ariaLabel')}
      className="sticky top-20 md:top-24 z-40 h-[64px] flex items-center
                 bg-brand-black/90 backdrop-blur-xl border-b border-brand-surface2/50"
    >
      {/* Scroll container wrapper */}
      <div className="relative flex-1 h-full min-w-0">
        {/* Left Fade Overlay */}
        <AnimatePresence>
          {showStartFade && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`absolute top-0 bottom-0 z-10 w-12 pointer-events-none 
                         ${isRTL ? 'right-0 bg-gradient-to-l' : 'left-0 bg-gradient-to-r'} 
                         from-brand-black to-transparent`} 
            />
          )}
        </AnimatePresence>

        <div
          ref={scrollRef}
          className="flex items-center gap-1 overflow-x-auto scrollbar-none
                     px-4 h-full scroll-smooth"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <button
            role="tab"
            aria-selected={activeCategory === 'all'}
            onClick={() => handleCategoryClick('all')}
            className={`relative shrink-0 px-5 py-2 rounded-full font-almarai text-sm transition-all duration-[250ms] group ${
              activeCategory === 'all'
                ? 'text-brand-gold font-bold'
                : 'text-brand-muted hover:text-brand-text'
            }`}
          >
            {t('allCategories')}
            {activeCategory === 'all' && (
              <motion.div 
                layoutId="active-tab"
                className="absolute -bottom-[2px] inset-x-4 h-[2px] bg-brand-gold rounded-full shadow-[0_0_8px_rgba(200,146,42,0.4)]" 
              />
            )}
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              role="tab"
              aria-selected={activeCategory === cat.id}
              onClick={() => handleCategoryClick(cat.id)}
              className={`relative shrink-0 px-5 py-2 rounded-full font-almarai text-sm transition-all duration-[250ms] group ${
                activeCategory === cat.id
                  ? 'text-brand-gold font-bold'
                  : 'text-brand-muted hover:text-brand-text'
              }`}
            >
              {t(`categoryNames.${cat.id}` as Parameters<typeof t>[0])}
              {activeCategory === cat.id && (
                <motion.div 
                  layoutId="active-tab"
                  className="absolute -bottom-[2px] inset-x-4 h-[2px] bg-brand-gold rounded-full shadow-[0_0_8px_rgba(200,146,42,0.4)]" 
                />
              )}
            </button>
          ))}
        </div>

        {/* Right Fade Overlay */}
        <AnimatePresence>
          {showEndFade && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`absolute top-0 bottom-0 z-10 w-12 pointer-events-none 
                         ${isRTL ? 'left-0 bg-gradient-to-r' : 'right-0 bg-gradient-to-l'} 
                         from-brand-black to-transparent`} 
            />
          )}
        </AnimatePresence>
      </div>

      {/* Search toggle */}
      <div className="shrink-0 pe-4 border-s border-brand-surface2/50 h-8 flex items-center ms-2">
        <button
          onClick={onSearchOpen}
          className="w-10 h-10 flex items-center justify-center
                     text-brand-muted hover:text-brand-gold
                     transition-all duration-[250ms] rounded-full hover:bg-brand-surface2"
          aria-label={t('filter.search')}
        >
          <Search size={20} />
        </button>
      </div>
    </nav>
  )
}

