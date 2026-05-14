'use client'

import { useRef, useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import { useCartStore } from '@/lib/cart'
import {
  getVisibleMainCategories,
  getMainCategoryForSubcategory,
} from '@/constants/menu-categories'
import type { CategoryWithItems } from '@/lib/menu'

interface MenuCategoryNavProps {
  categories: CategoryWithItems[]
  activeCategory: string
  onSearchOpen: () => void
  locale: string
}

export default function MenuCategoryNav({
  categories,
  activeCategory,
  onSearchOpen,
  locale,
}: MenuCategoryNavProps) {
  const isRTL = locale === 'ar'
  const t = useTranslations('menu')
  const navRef = useRef<HTMLElement>(null)
  const l1ScrollRef = useRef<HTMLDivElement>(null)
  const [showL1StartFade, setShowL1StartFade] = useState(false)
  const [showL1EndFade, setShowL1EndFade] = useState(true)

  const branchId = useCartStore((s) => s.branchId)
  const visibleMain = getVisibleMainCategories(branchId)

  // Sync active main tab with scroll-driven activeCategory from parent
  const [activeMainId, setActiveMainId] = useState<string | null>(() =>
    activeCategory !== 'all' ? getMainCategoryForSubcategory(activeCategory) : null,
  )

  useEffect(() => {
    if (activeCategory === 'all') return
    const mainId = getMainCategoryForSubcategory(activeCategory)
    if (mainId) setActiveMainId(mainId)
  }, [activeCategory])

  // Subcategories for the currently selected L1 tab
  const activeMain = visibleMain.find((m) => m.id === activeMainId)
  const subcategories = activeMain
    ? categories.filter((c) => activeMain.subcategories.includes(c.id))
    : []

  const scrollToSection = (id: string) => {
    const el = document.getElementById(`section-${id}`)
    if (!el) return
    const navHeight = navRef.current?.offsetHeight ?? 64
    const headerHeight = 80
    const offset = headerHeight + navHeight + 8
    const top = el.getBoundingClientRect().top + window.pageYOffset - offset
    window.scrollTo({ top, behavior: 'smooth' })
  }

  const handleMainClick = (mainId: string) => {
    if (activeMainId === mainId) {
      setActiveMainId(null)
      return
    }
    setActiveMainId(mainId)
    const main = visibleMain.find((m) => m.id === mainId)
    const firstSub = main?.subcategories[0]
    if (firstSub) scrollToSection(firstSub)
  }

  const handleSubClick = (subId: string) => {
    scrollToSection(subId)
  }

  const handleL1Scroll = () => {
    const el = l1ScrollRef.current
    if (!el) return
    const abs = Math.abs(el.scrollLeft)
    setShowL1StartFade(abs > 10)
    setShowL1EndFade(abs < el.scrollWidth - el.clientWidth - 10)
  }

  useEffect(() => {
    const el = l1ScrollRef.current
    if (!el) return
    el.addEventListener('scroll', handleL1Scroll)
    handleL1Scroll()
    return () => el.removeEventListener('scroll', handleL1Scroll)
  }, [])

  return (
    <nav
      ref={navRef}
      role="navigation"
      aria-label={t('filter.ariaLabel')}
      className="sticky top-20 md:top-24 z-40 bg-brand-black/90 backdrop-blur-xl border-b border-brand-surface2/50"
    >
      {/* ── L1: Main categories ── */}
      <div className="relative h-[56px] flex items-center">
        {/* Start fade */}
        <AnimatePresence>
          {showL1StartFade && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`absolute top-0 bottom-0 z-10 w-12 pointer-events-none
                ${isRTL ? 'start-0 bg-gradient-to-l' : 'start-0 bg-gradient-to-r'}
                from-brand-black to-transparent`}
            />
          )}
        </AnimatePresence>

        <div
          ref={l1ScrollRef}
          className="flex items-center gap-1 overflow-x-auto scrollbar-none px-4 h-full scroll-smooth"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {visibleMain.map((main) => {
            const isActive = activeMainId === main.id
            return (
              <button
                key={main.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => handleMainClick(main.id)}
                className={`relative shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full
                  font-almarai text-sm transition-all duration-[250ms]
                  ${isActive ? 'text-brand-gold font-bold' : 'text-brand-muted hover:text-brand-text'}`}
              >
                <span aria-hidden="true">{main.icon}</span>
                <span>{isRTL ? main.label.ar : main.label.en}</span>
                {isActive && (
                  <motion.div
                    layoutId="active-main-tab"
                    className="absolute -bottom-[2px] inset-x-4 h-[2px] bg-brand-gold rounded-full shadow-[0_0_8px_rgba(200,146,42,0.4)]"
                  />
                )}
              </button>
            )
          })}
        </div>

        {/* End fade */}
        <AnimatePresence>
          {showL1EndFade && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`absolute top-0 bottom-0 z-10 w-12 pointer-events-none
                ${isRTL ? 'end-0 bg-gradient-to-r' : 'end-0 bg-gradient-to-l'}
                from-brand-black to-transparent`}
            />
          )}
        </AnimatePresence>

        {/* Search button */}
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
      </div>

      {/* ── L2: Subcategory pills ── */}
      <AnimatePresence>
        {subcategories.length > 0 && (
          <motion.div
            key={activeMainId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden border-t border-brand-surface2/30"
          >
            <div
              className="flex items-center gap-2 px-4 py-2 overflow-x-auto scrollbar-none"
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              {subcategories.map((sub) => {
                const isActive = activeCategory === sub.id
                return (
                  <button
                    key={sub.id}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => handleSubClick(sub.id)}
                    className={`shrink-0 px-3 py-1 rounded-full text-xs font-almarai
                      transition-all duration-[200ms] whitespace-nowrap
                      ${isActive
                        ? 'bg-brand-gold/20 text-brand-gold border border-brand-gold/40'
                        : 'bg-brand-surface2/50 text-brand-muted hover:text-brand-text hover:bg-brand-surface2'
                      }`}
                  >
                    {t(`categoryNames.${sub.id}` as Parameters<typeof t>[0])}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
