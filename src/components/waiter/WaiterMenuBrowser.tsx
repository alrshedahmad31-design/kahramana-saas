'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { MAIN_CATEGORIES } from '@/constants/menu-categories'
import type { POSCategory, POSItem } from '@/components/pos/types'
import { resolveMenuItemPrice } from '@/components/pos/types'

interface BrowserLabels {
  search:        string
  allCategories: string
  outOfStock:    string
}

interface Props {
  categories: POSCategory[]
  isAr:       boolean
  onAdd:      (item: POSItem) => void
  labels:     BrowserLabels
}

/**
 * Compact menu browser for waiter use on phones / tablets.
 * Uses horizontal item rows (80px) instead of an image grid for faster scanning.
 * Category bar shows 8 operational MAIN_CATEGORIES labels instead of 16 literary slugs.
 */
const ALL = '__all__'

export default function WaiterMenuBrowser({ categories, isAr, onAdd, labels }: Props) {
  const [activeMainCat, setActiveMainCat] = useState<string>(ALL)
  const [query, setQuery]                 = useState('')

  const visibleCategories = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filterItem = (item: POSItem) => {
      if (!q) return true
      return (
        item.nameAr.toLowerCase().includes(q) ||
        item.nameEn.toLowerCase().includes(q)
      )
    }

    const slugs =
      activeMainCat === ALL
        ? null
        : (MAIN_CATEGORIES.find((c) => c.id === activeMainCat)
            ?.subcategories.flatMap((s) => s.categorySlugs) ?? null)

    const cats = slugs
      ? categories.filter((c) => slugs.includes(c.id))
      : categories

    return cats
      .map((c) => ({ ...c, items: c.items.filter(filterItem) }))
      .filter((c) => c.items.length > 0)
  }, [categories, activeMainCat, query])

  return (
    <div className="flex flex-col h-full">
      {/* Sticky search + category bar */}
      <div className="sticky top-0 z-20 bg-brand-black border-b border-brand-border px-4 py-3">
        <div className="relative">
          <span className="absolute inset-y-0 start-3 flex items-center text-brand-muted">
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
            </svg>
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={labels.search}
            className="w-full min-h-[44px] rounded-lg bg-brand-surface border border-brand-border ps-9 pe-3 font-satoshi text-sm text-brand-text placeholder:text-brand-muted focus:outline-none focus:border-brand-gold/40"
          />
        </div>
        {/* 8 operational main-category tabs */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <CatButton
            active={activeMainCat === ALL}
            label={labels.allCategories}
            onClick={() => setActiveMainCat(ALL)}
          />
          {MAIN_CATEGORIES.map((main) => (
            <CatButton
              key={main.id}
              active={activeMainCat === main.id}
              label={isAr ? main.nameAr : main.nameEn}
              onClick={() => setActiveMainCat(main.id)}
            />
          ))}
        </div>
      </div>

      {/* Item list — compact horizontal rows */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {visibleCategories.length === 0 ? (
          <p className={`text-center text-brand-muted py-12 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'لا توجد نتائج' : 'No matching items'}
          </p>
        ) : (
          visibleCategories.map((cat) => (
            <section key={cat.id} className="mb-4">
              <h3 className={`text-sm font-bold text-brand-muted uppercase tracking-wide mb-2 ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                {isAr ? cat.nameAr : cat.nameEn}
              </h3>
              <ul className="flex flex-col gap-2">
                {cat.items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    isAr={isAr}
                    outOfStockLabel={labels.outOfStock}
                    onAdd={() => onAdd(item)}
                  />
                ))}
              </ul>
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
      className={`shrink-0 min-h-[36px] px-3 rounded-lg font-satoshi text-xs font-medium whitespace-nowrap transition-colors ${
        active
          ? 'bg-brand-gold/10 text-brand-gold border border-brand-gold/40'
          : 'bg-brand-surface border border-brand-border text-brand-muted hover:text-brand-text hover:border-brand-gold/30'
      }`}
    >
      {label}
    </button>
  )
}

function ItemRow({
  item, isAr, outOfStockLabel, onAdd,
}: { item: POSItem; isAr: boolean; outOfStockLabel: string; onAdd: () => void }) {
  const price    = resolveMenuItemPrice(item)
  const disabled = !item.available

  return (
    <li className={`flex items-center gap-0 h-20 rounded-xl border bg-brand-surface overflow-hidden ${
      disabled ? 'border-brand-border opacity-50' : 'border-brand-border'
    }`}>
      {/* Square image — 80×80 */}
      <div className="relative h-20 w-20 shrink-0 bg-brand-surface-2">
        <Image
          src={item.image}
          alt={isAr ? item.nameAr : item.nameEn}
          fill
          sizes="80px"
          className="object-cover"
        />
        {disabled && (
          <span className="absolute inset-0 flex items-center justify-center bg-brand-black/70 text-[9px] font-bold uppercase tracking-wide text-brand-error text-center px-1">
            {outOfStockLabel}
          </span>
        )}
      </div>

      {/* Name + price */}
      <div className="flex-1 min-w-0 px-3 py-2">
        <p className={`text-sm font-bold leading-snug line-clamp-2 text-brand-text ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {isAr ? item.nameAr : item.nameEn}
        </p>
        <p className="font-satoshi font-bold text-brand-gold text-sm tabular-nums mt-1">
          {price.toFixed(3)}
        </p>
      </div>

      {/* Add button — min 44×44 touch target */}
      <button
        type="button"
        disabled={disabled}
        onClick={onAdd}
        aria-label={isAr ? `إضافة ${item.nameAr}` : `Add ${item.nameEn}`}
        className={`shrink-0 inline-flex items-center justify-center w-11 h-11 me-2 rounded-xl transition-colors ${
          disabled
            ? 'text-brand-muted cursor-not-allowed'
            : 'bg-brand-gold/10 text-brand-gold hover:bg-brand-gold hover:text-brand-black'
        }`}
      >
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
          <path strokeLinecap="round" d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </li>
  )
}
