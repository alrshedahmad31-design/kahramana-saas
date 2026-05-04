'use client'

import { useEffect } from 'react'
import { Link } from '@/i18n/navigation'
import type { NormalizedMenuItem } from '@/lib/menu'
import MenuItemImage from '@/components/menu/menu-item-image'
import StickyAddToCart from '@/components/menu/sticky-add-to-cart'
import { ItemSelectionProvider, useItemSelection } from '@/components/menu/item-selection-provider'
import ItemPriceSelector from '@/components/menu/item-price-selector'
import { motion } from 'framer-motion'
import { Home, ChevronRight, ChevronLeft } from 'lucide-react'
import { gtag } from '@/lib/gtag'

interface ItemDetailHeroProps {
  item: NormalizedMenuItem
  backLabel: string
  homeLabel: string
  menuLabel: string
  outOfStockLabel: string
  unavailableLabel: string
  fromLabel: string
  currency: string
  isRTL: boolean
}

export default function ItemDetailHero(props: ItemDetailHeroProps) {
  return (
    <ItemSelectionProvider item={props.item}>
      <ItemDetailHeroContent {...props} />
    </ItemSelectionProvider>
  )
}

function ItemDetailHeroContent({
  item,
  backLabel,
  homeLabel,
  menuLabel,
  outOfStockLabel,
  unavailableLabel,
  fromLabel,
  currency,
  isRTL,
}: ItemDetailHeroProps) {
  const { computedPrice } = useItemSelection()
  const name = isRTL ? item.name.ar : item.name.en

  useEffect(() => {
    gtag.viewItem({ id: item.id, name: item.name.en, category: item.categorySlug, price: item.fromPrice ?? 0 })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])
  const description = item.description
    ? isRTL
      ? item.description.ar
      : item.description.en
    : undefined

  const Chevron = isRTL ? ChevronLeft : ChevronRight

  return (
    <section
      dir={isRTL ? 'rtl' : 'ltr'}
      className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-16"
    >
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-start lg:gap-16">
        {/* Left Column: Content */}
        <div className="order-2 flex flex-col lg:order-1">
          {/* Sophisticated Breadcrumbs */}
          <nav aria-label={backLabel} className="mb-8 flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-2 text-[10px] font-bold uppercase tracking-widest text-brand-muted/60 no-scrollbar">
            <Link href="/" className="flex items-center gap-1.5 transition-colors hover:text-brand-gold">
              <Home size={12} />
              <span>{homeLabel}</span>
            </Link>
            <Chevron size={12} className="opacity-30" />
            <Link href="/menu" className="transition-colors hover:text-brand-gold">
              {menuLabel}
            </Link>
            <Chevron size={12} className="opacity-30" />
            <Link href={`/menu/${item.categorySlug}`} className="transition-colors hover:text-brand-gold">
              {isRTL ? item.categoryName.ar : item.categoryName.en}
            </Link>
          </nav>

          {/* Item Category & Availability */}
          <div className="mb-6 flex items-center justify-between">
            <motion.p
              initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`text-xs font-bold uppercase tracking-[0.3em] text-brand-gold ${isRTL ? 'font-almarai' : 'font-satoshi'}`}
            >
              {isRTL ? item.categoryName.ar : item.categoryName.en}
            </motion.p>
            
            {item.available && (
              <div className="flex items-center gap-2 rounded-full border border-brand-success/20 bg-brand-success/5 px-3 py-1">
                <div className="h-1.5 w-1.5 rounded-full bg-brand-success animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-success">Available Now</span>
              </div>
            )}
          </div>

          {/* Title & Description */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h1 className={`text-start text-5xl font-black leading-[1.1] text-brand-text sm:text-7xl ${isRTL ? 'font-cairo' : 'font-editorial'}`}>
              {name}
            </h1>
            {isRTL && item.name.en && (
              <p className="mt-4 font-satoshi text-lg italic text-brand-muted/40">{item.name.en}</p>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8"
          >
            {description && (
              <p className={`text-start text-lg leading-relaxed text-brand-muted sm:text-xl ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                {description}
              </p>
            )}
          </motion.div>

          {/* Pricing Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-10 rounded-2xl border border-brand-gold/10 bg-brand-surface-2/50 p-6 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between">
               <span className="text-xs font-bold uppercase tracking-widest text-brand-muted/60">Selected Price</span>
               <ItemPriceSelector
                item={item}
                price={computedPrice}
                currency={currency}
                fromLabel={fromLabel}
              />
            </div>
          </motion.div>

          {/* Selection & Action */}
          <div className="mt-8">
            {item.available ? (
              <StickyAddToCart isRTL={isRTL} />
            ) : (
              <div className="rounded-2xl border border-brand-error/20 bg-brand-error/5 p-6 text-center">
                <p className={`text-sm font-bold text-brand-error ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                  {unavailableLabel}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Immersive Image */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="order-1 lg:order-2"
        >
          <div className="relative aspect-square overflow-hidden rounded-[2rem] border border-brand-gold/10 bg-brand-surface-2 shadow-2xl">
            <MenuItemImage
              src={item.image}
              alt={isRTL
                ? `${item.name.ar}  كهرمانة بغداد | مطعم عراقي البحرين`
                : `${item.name.en}  Kahramana Baghdad | Iraqi Restaurant Bahrain`
              }
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="transition-transform duration-1000 hover:scale-105"
            />
            
            {/* Ambient Glow */}
            <div className="absolute -inset-10 -z-10 bg-brand-gold/5 blur-[100px]" />
            
            {!item.available && (
              <div className="absolute inset-0 flex items-center justify-center bg-brand-black/60 backdrop-blur-md">
                <span className="rounded-full border border-brand-error bg-brand-black/80 px-8 py-3 font-almarai text-lg font-bold text-brand-error shadow-2xl">
                  {outOfStockLabel}
                </span>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
