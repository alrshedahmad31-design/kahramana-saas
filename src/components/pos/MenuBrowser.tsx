'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { POSCategory, POSItem } from './types'
import { resolveMenuItemPrice } from './types'

interface Props {
  categories: POSCategory[]
  isAr:       boolean
  onAdd:      (item: POSItem) => void
}

const ALL = '__all__'

export default function MenuBrowser({ categories, isAr, onAdd }: Props) {
  const t = useTranslations('pos')
  const [activeCat, setActiveCat] = useState<string>(ALL)
  const [query, setQuery] = useState('')

  const visibleCategories = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filterItem = (item: POSItem) => {
      if (!q) return true
      return (
        item.nameAr.toLowerCase().includes(q) ||
        item.nameEn.toLowerCase().includes(q)
      )
    }
    const cats =
      activeCat === ALL
        ? categories
        : categories.filter((c) => c.id === activeCat)
    return cats
      .map((c) => ({ ...c, items: c.items.filter(filterItem) }))
      .filter((c) => c.items.length > 0)
  }, [categories, activeCat, query])

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="sticky top-0 lg:top-0 z-20 bg-brand-black border-b border-brand-border px-4 py-3">
        <div className="relative">
          <span className="absolute inset-y-0 start-3 flex items-center text-brand-muted">
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
            </svg>
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search')}
            className="w-full min-h-[44px] rounded-lg bg-brand-surface border border-brand-border ps-9 pe-3 font-satoshi text-sm text-brand-text placeholder:text-brand-muted focus:outline-none focus:border-brand-gold/40"
          />
        </div>

        {/* Category tabs */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <CatButton
            active={activeCat === ALL}
            label={t('allCategories')}
            onClick={() => setActiveCat(ALL)}
          />
          {categories.map((c) => (
            <CatButton
              key={c.id}
              active={activeCat === c.id}
              label={isAr ? c.nameAr : c.nameEn}
              onClick={() => setActiveCat(c.id)}
            />
          ))}
        </div>
      </div>

      {/* Items grid */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {visibleCategories.length === 0 ? (
          <p className="text-center text-brand-muted font-satoshi text-sm py-12">
            {isAr ? 'لا توجد نتائج' : 'No matching items'}
          </p>
        ) : (
          visibleCategories.map((cat) => (
            <section key={cat.id} className="mb-6">
              <h3 className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-3 ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                {isAr ? cat.nameAr : cat.nameEn}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {cat.items.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    isAr={isAr}
                    onAdd={() => onAdd(item)}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  )
}

function CatButton({
  active, label, onClick,
}: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 min-h-[36px] px-3 rounded-lg font-satoshi text-xs font-medium whitespace-nowrap transition-colors
        ${active
          ? 'bg-brand-gold/10 text-brand-gold border border-brand-gold/40'
          : 'bg-brand-surface border border-brand-border text-brand-muted hover:text-brand-text hover:border-brand-gold/30'
        }`}
    >
      {label}
    </button>
  )
}

function ItemCard({
  item, isAr, onAdd,
}: { item: POSItem; isAr: boolean; onAdd: () => void }) {
  const t = useTranslations('pos')
  const [price] = useState(() => resolveMenuItemPrice(item))

  const fromPrice = item.fromPriceBhd

  const disabled = !item.available

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onAdd}
      aria-label={isAr
        ? `إضافة ${item.nameAr} - ${price.toFixed(3)} د.ب`
        : `Add ${item.nameEn} - ${price.toFixed(3)} BHD`}
      className={`group flex flex-col rounded-xl border bg-brand-surface text-start overflow-hidden transition-colors
        ${disabled
          ? 'border-brand-border opacity-50 cursor-not-allowed'
          : 'border-brand-border hover:border-brand-gold/50'
        }`}
    >
      <div className="relative w-full aspect-square bg-brand-surface-2">
        <Image
          src={item.image}
          alt={isAr ? item.nameAr : item.nameEn}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 200px"
          className="object-cover"
        />
        {disabled && (
          <span className="absolute top-2 start-2 text-[10px] font-bold uppercase tracking-wide rounded bg-brand-error/90 text-brand-black px-2 py-0.5">
            {t('outOfStock')}
          </span>
        )}
      </div>
      <div className="p-2.5 flex flex-col gap-1.5 flex-1">
        <span className={`text-sm leading-tight line-clamp-2 text-brand-text ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {isAr ? item.nameAr : item.nameEn}
        </span>
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="font-satoshi font-bold text-brand-gold text-sm tabular-nums">
            {price.toFixed(3)}
          </span>
          {!disabled && (
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-gold/10 text-brand-gold group-hover:bg-brand-gold group-hover:text-brand-black transition-colors">
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" d="M12 5v14M5 12h14" />
              </svg>
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
