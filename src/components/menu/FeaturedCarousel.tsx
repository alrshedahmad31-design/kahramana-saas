'use client'

import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { Flame, ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import type { NormalizedMenuItem } from '@/lib/menu'
import { useRef, useState, useEffect } from 'react'

interface FeaturedCarouselProps {
  items: NormalizedMenuItem[]
  locale: string
}

export default function FeaturedCarousel({ items, locale }: FeaturedCarouselProps) {
  const isRTL = locale === 'ar'
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const checkScroll = () => {
    if (!scrollRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    const absScrollLeft = Math.abs(scrollLeft)
    
    if (isRTL) {
      setCanScrollLeft(absScrollLeft < scrollWidth - clientWidth - 10)
      setCanScrollRight(absScrollLeft > 10)
    } else {
      setCanScrollLeft(absScrollLeft > 10)
      setCanScrollRight(absScrollLeft < scrollWidth - clientWidth - 10)
    }
  }

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    el?.addEventListener('scroll', checkScroll)
    window.addEventListener('resize', checkScroll)
    return () => {
      el?.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [items])

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    const scrollAmount = 300
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    })
  }

  return (
    <section className="relative py-12 bg-gradient-to-b from-brand-black via-brand-surface to-brand-black overflow-hidden">
      {/* Cinematic Background Decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-brand-gold/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
      
      {/* Section Header */}
      <div className="px-6 mb-8 relative z-10" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-between">
          <div>
            <div className="w-12 h-[3px] bg-brand-gold mb-4 rounded-full" />
            <h2 className="font-cairo font-black text-brand-text text-3xl md:text-4xl flex items-center gap-3 tracking-tight">
              <Flame size={28} className="text-brand-gold animate-pulse" />
              {isRTL ? 'توصيات الشيف' : "Chef's Recommendations"}
            </h2>
            <p className="font-almarai text-brand-muted text-base mt-2 max-w-md">
              {isRTL 
                ? 'أطباقنا الأكثر تميزاً وشعبية المختارة بعناية لضيوفنا' 
                : "Our most distinguished and popular dishes, handpicked for our guests"}
            </p>
          </div>

          {/* Desktop Nav Arrows */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => scroll(isRTL ? 'right' : 'left')}
              disabled={isRTL ? !canScrollRight : !canScrollLeft}
              className="w-12 h-12 rounded-full border border-brand-border flex items-center justify-center
                         text-brand-text hover:bg-brand-gold hover:text-brand-black hover:border-brand-gold
                         disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-300"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={() => scroll(isRTL ? 'left' : 'right')}
              disabled={isRTL ? !canScrollLeft : !canScrollRight}
              className="w-12 h-12 rounded-full border border-brand-border flex items-center justify-center
                         text-brand-text hover:bg-brand-gold hover:text-brand-black hover:border-brand-gold
                         disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-300"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
      </div>

      {/* Carousel Container */}
      <div
        ref={scrollRef}
        className="flex gap-6 overflow-x-auto scrollbar-none px-6 pb-8 snap-x snap-mandatory relative z-10"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {items.map((item, index) => (
          <Link
            key={item.id}
            href={`/menu/item/${item.slug}`}
            className="shrink-0 w-[80vw] min-w-[300px] max-w-[400px] snap-start"
          >
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group relative bg-brand-surface/40 backdrop-blur-sm border border-brand-border/50 rounded-2xl overflow-hidden hover:border-brand-gold/50 transition-all duration-500 shadow-xl"
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              {/* Image Section */}
              <div className="relative aspect-[16/10] overflow-hidden">
                <Image
                  src={item.image ?? '/images/placeholder/dish.jpg'}
                  alt={isRTL ? item.name.ar : item.name.en}
                  fill
                  priority={index < 2}
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                  sizes="(max-width: 640px) 80vw, 400px"
                />
                
                {/* Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-brand-black/20 to-transparent opacity-80" />
                
                {/* Popular badge — top-start */}
                <div className="absolute top-4 start-4">
                  <span className="flex items-center gap-1.5 bg-brand-gold/90 backdrop-blur-md text-brand-black font-almarai font-bold text-xs px-3 py-1.5 rounded-full shadow-lg">
                    <Flame size={12} />
                    {isRTL ? 'الأكثر طلباً' : 'Bestseller'}
                  </span>
                </div>

                {/* Category — bottom-start */}
                <div className="absolute bottom-4 start-4">
                  <span className="font-almarai text-brand-gold text-xs font-bold uppercase tracking-widest bg-brand-black/50 backdrop-blur-md px-2 py-1 rounded">
                    {isRTL ? item.categoryName.ar : item.categoryName.en}
                  </span>
                </div>
              </div>

              {/* Content Section */}
              <div className="p-6">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <h3 className="font-cairo font-black text-brand-text text-xl md:text-2xl leading-tight group-hover:text-brand-gold transition-colors duration-300">
                      {isRTL ? item.name.ar : item.name.en}
                    </h3>
                    {isRTL && item.name.en && (
                      <p className="font-satoshi text-brand-muted text-sm mt-1 opacity-60">
                        {item.name.en}
                      </p>
                    )}
                  </div>
                  <div className="text-end">
                    <span className="block font-satoshi font-bold text-brand-gold text-2xl tracking-tighter">
                      {item.fromPrice.toFixed(3)}
                    </span>
                    <span className="block font-almarai text-brand-muted text-[10px] uppercase font-bold tracking-wider">
                      BHD
                    </span>
                  </div>
                </div>
                
                {/* View Details Hint */}
                <div className="mt-6 flex items-center gap-2 text-brand-muted group-hover:text-brand-gold transition-colors duration-300">
                  <div className="h-[1px] flex-1 bg-brand-border/50 group-hover:bg-brand-gold/30 transition-colors" />
                  <span className="font-almarai text-xs font-bold">
                    {isRTL ? 'التفاصيل' : 'Details'}
                  </span>
                  <ChevronRight size={14} className={isRTL ? 'rotate-180' : ''} />
                </div>
              </div>
            </motion.article>
          </Link>
        ))}
      </div>
    </section>
  )
}

