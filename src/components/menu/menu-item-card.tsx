'use client'

import { motion } from 'framer-motion'
import { Link } from '@/i18n/navigation'
import Image from 'next/image'
import type { NormalizedMenuItem } from '@/lib/menu'
import { FilterTag, type TagType } from './FilterTag'
import AddToCartButton from '@/components/cart/AddToCartButton'

interface MenuItemCardProps {
  item: NormalizedMenuItem
  locale: string
  index: number
}

export default function MenuItemCard({
  item,
  locale,
  index,
}: MenuItemCardProps) {
  const isRTL = locale === 'ar'
  
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.3) }}
      className="
        bg-brand-surface border border-brand-border rounded-lg
        overflow-hidden group
        hover:border-brand-gold
        transition-colors duration-[250ms]
        flex flex-col h-full
      "
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* ── IMAGE ZONE ── */}
      <Link href={`/menu/item/${item.slug}`}>
        <div className="relative aspect-[4/3] overflow-hidden">
          <Image
            src={item.image ?? '/images/placeholder/dish.jpg'}
            alt={isRTL 
              ? `${item.name.ar} — مطعم كهرمانة بغداد العراقي في البحرين` 
              : `${item.name.en} — Kahramana Baghdad Iraqi Restaurant in Bahrain`
            }
            fill
            priority={index < 8}
            className="
              object-cover
              transition-transform duration-[400ms]
              group-hover:scale-105
            "
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />

          {/* Out-of-stock overlay */}
          {!item.available && (
            <div className="absolute inset-0 bg-brand-black/75 flex items-center justify-center z-10">
              <span className="
                font-almarai font-bold text-brand-error text-xs
                border border-brand-error rounded px-2 py-1
              ">
                {isRTL ? 'غير متوفر' : 'Out of stock'}
              </span>
            </div>
          )}

          {/* Tags — top-start */}
          {item.tags && item.tags.length > 0 && (
            <div className="absolute top-2 start-2 flex flex-col gap-1 z-20">
              {item.tags.slice(0, 2).map(tag => (
                <FilterTag key={tag} tag={tag as TagType} locale={locale} />
              ))}
            </div>
          )}
          
          {/* Gradient Overlay for subtle premium look */}
          <div className="absolute inset-0 bg-gradient-to-t from-brand-surface/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>
      </Link>

      {/* ── CONTENT ZONE ── */}
      <div className="p-3 sm:p-4 flex flex-col flex-1">

        {/* Category label */}
        <p className="font-almarai text-brand-muted text-[10px] mb-1 line-clamp-1 uppercase tracking-wider">
          {isRTL ? item.categoryName.ar : item.categoryName.en}
        </p>

        {/* Arabic name — primary */}
        <Link href={`/menu/item/${item.slug}`}>
          <h3 className="
            font-cairo font-black text-brand-text
            text-sm sm:text-base leading-snug
            hover:text-brand-gold-light transition-colors duration-[150ms]
            line-clamp-2
          ">
            {isRTL ? item.name.ar : item.name.en}
          </h3>
        </Link>

        {/* English name — secondary */}
        {isRTL && item.name.en && (
          <p className="
            hidden sm:block
            font-satoshi text-brand-muted text-xs mt-0.5 line-clamp-1
          ">
            {item.name.en}
          </p>
        )}
        {!isRTL && item.name.ar && (
          <p className="
            hidden sm:block
            font-cairo text-brand-muted text-xs mt-0.5 line-clamp-1
          ">
            {item.name.ar}
          </p>
        )}

        {/* Description — 2 lines max */}
        <p className="
          hidden sm:block
          font-almarai text-brand-muted text-xs mt-1.5 line-clamp-2 flex-1
        ">
          {isRTL ? item.description?.ar : item.description?.en}
        </p>

        {/* ── PRICE + ACTION ROW ── */}
        <div className="flex items-center justify-between mt-auto pt-3">

          {/* Price block */}
          <div>
            {item.hasMultiplePrices && (
              <p className="font-almarai text-brand-muted text-[9px] mb-0.5">
                {isRTL ? 'من' : 'From'}
              </p>
            )}
            <span className="
              font-satoshi font-medium text-brand-gold tabular-nums
              text-sm sm:text-base
            ">
              {item.fromPrice.toFixed(3)} <span className="text-[10px] font-bold opacity-80 uppercase">BD</span>
            </span>
          </div>

          {/* Add to cart */}
          <AddToCartButton
            item={item}
            isRTL={isRTL}
            disabled={!item.available}
            size="sm"
          />

        </div>
      </div>
    </motion.article>
  )
}
