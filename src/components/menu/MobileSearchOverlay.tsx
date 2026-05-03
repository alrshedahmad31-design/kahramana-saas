'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Search } from 'lucide-react'
import { useState, useEffect, useRef, useMemo } from 'react'
import type { CategoryWithItems } from '@/lib/menu'
import MenuItemCard from './menu-item-card'
import { EmptyState } from './EmptyState'

interface MobileSearchOverlayProps {
  isOpen: boolean
  onClose: () => void
  categories: CategoryWithItems[]
  locale: string
  initialQuery?: string
}

export function MobileSearchOverlay({
  isOpen,
  onClose,
  categories,
  locale,
  initialQuery = '',
}: MobileSearchOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const isRTL = locale === 'ar'
  const [searchQuery, setSearchQuery] = useState(initialQuery)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      document.body.style.overflow = 'unset'
      if (!initialQuery) setSearchQuery('')
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [isOpen, initialQuery])

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase().trim()
    return categories
      .flatMap(c => c.items)
      .filter(item =>
        item.name.ar.toLowerCase().includes(q) ||
        item.name.en.toLowerCase().includes(q) ||
        item.description?.ar?.toLowerCase().includes(q) ||
        item.description?.en?.toLowerCase().includes(q)
      )
  }, [categories, searchQuery])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed inset-0 z-[100] bg-brand-black/95 backdrop-blur-md flex flex-col"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {/* Close bar + Input */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-brand-surface-2">
            <button
              onClick={onClose}
              className="text-brand-muted hover:text-brand-text transition-colors"
              aria-label={isRTL ? 'إغلاق البحث' : 'Close search'}
            >
              <X size={20} />
            </button>
            <input
              ref={inputRef}
              type="search"
              placeholder={isRTL ? 'ابحث عن طبق...' : 'Search for a dish...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="
                flex-1 bg-transparent
                font-almarai text-brand-text text-base
                placeholder:text-brand-muted
                focus:outline-none
              "
              aria-label={isRTL ? 'بحث في القائمة' : 'Search menu'}
              aria-controls="menu-content"
              dir={isRTL ? 'rtl' : 'ltr'}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-brand-muted hover:text-brand-text transition-colors"
                aria-label={isRTL ? 'مسح البحث' : 'Clear search'}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-7xl mx-auto px-4">
              {searchQuery.trim() ? (
                filteredItems.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 py-8">
                    {filteredItems.map((item, index) => (
                      <MenuItemCard key={item.id} item={item} locale={locale} index={index} />
                    ))}
                  </div>
                ) : (
                  <EmptyState query={searchQuery} locale={locale} />
                )
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                  <Search size={32} className="text-brand-muted mb-4" />
                  <p className="font-almarai text-brand-muted text-sm">
                    {isRTL ? 'اكتب اسم الطبق للبحث' : 'Type a dish name to search'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
