'use client'

import { motion } from 'framer-motion'
import { Link } from '@/i18n/navigation'
import type { NormalizedMenuItem } from '@/lib/menu'
import MenuItemImage from '@/components/menu/menu-item-image'
import { ArrowRight, ArrowLeft } from 'lucide-react'

interface MenuItemCardProps {
  item: NormalizedMenuItem
  name: string
  description?: string
  categoryName: string
  outOfStockLabel: string
  fromLabel: string
  currency: string
  isRTL: boolean
  index: number
}

export default function MenuItemCard({
  item,
  name,
  description,
  categoryName,
  outOfStockLabel,
  fromLabel,
  currency,
  isRTL,
  index,
}: MenuItemCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
      dir={isRTL ? 'rtl' : 'ltr'}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-brand-gold/5 bg-brand-surface shadow-lg transition-all duration-500 hover:-translate-y-1 hover:border-brand-gold/30 hover:shadow-2xl hover:shadow-brand-gold/10"
    >
      <Link
        href={`/menu/item/${item.slug}`}
        aria-label={name}
        className="absolute inset-0 z-10"
      />

      {/* Image Container */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <MenuItemImage
          src={item.image}
          alt={item.alt ? (isRTL ? item.alt.ar : item.alt.en) : name}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="transition-transform duration-700 group-hover:scale-110"
        />
        
        {/* Availability Badge */}
        {!item.available && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-brand-black/60 backdrop-blur-[2px]">
            <span className="rounded-full border border-brand-error bg-brand-black/80 px-4 py-1.5 text-xs font-bold text-brand-error">
              {outOfStockLabel}
            </span>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-brand-black/80 via-transparent to-transparent opacity-60 transition-opacity duration-500 group-hover:opacity-80" />
      </div>

      <div className="relative z-20 flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-2">
          <p
            className={`text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold/80 text-start ${
              isRTL ? 'font-almarai' : 'font-satoshi'
            }`}
          >
            {categoryName}
          </p>
          
          {item.available && (
             <div className="h-1.5 w-1.5 rounded-full bg-brand-success shadow-[0_0_8px_rgba(39,174,96,0.5)]" />
          )}
        </div>

        <h2
          className={`mt-2 line-clamp-1 text-lg font-black leading-tight text-brand-text text-start transition-colors duration-300 group-hover:text-brand-gold ${
            isRTL ? 'font-cairo' : 'font-editorial'
          }`}
        >
          {name}
        </h2>

        {description && (
          <p
            className={`mt-2 line-clamp-2 min-h-[40px] text-sm leading-relaxed text-brand-muted/80 text-start ${
              isRTL ? 'font-almarai' : 'font-satoshi'
            }`}
          >
            {description}
          </p>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 pt-6">
          <div className="flex flex-col text-start">
            {item.hasMultiplePrices && (
              <span className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-muted/60">{fromLabel}</span>
            )}
            <div className="flex items-baseline gap-1 font-satoshi tabular-nums text-brand-gold">
              <span className="text-2xl font-black">{item.fromPrice.toFixed(3)}</span>
              <span className="text-xs font-bold text-brand-muted/80">{currency}</span>
            </div>
          </div>

          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl border border-brand-gold/20 bg-brand-gold/5 text-brand-gold transition-all duration-300 group-hover:bg-brand-gold group-hover:text-brand-black group-hover:shadow-[0_0_15px_rgba(200,146,42,0.3)]`}
          >
            {isRTL ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
          </div>
        </div>
      </div>
    </motion.article>
  )
}
