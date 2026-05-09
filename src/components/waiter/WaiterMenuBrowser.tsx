'use client'

import Image from 'next/image'
import { useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'
import type { POSCategory, POSItem } from '@/components/pos/types'

interface Props {
  categories: POSCategory[]
  isAr:       boolean
  onAdd:      (item: POSItem) => void
}

const ALL = '__all__'

/**
 * Compact menu browser tuned for waiter use on phones / 1080p tablets.
 * Differences vs the POS MenuBrowser:
 *   - Horizontal item rows (h-24 image, single-line name+price, inline + button)
 *   - Sticky category bar pinned to top, tap → smooth-scroll to category section
 *   - Denser grid → ~4 items per category visible without scrolling on 1080p.
 */
export default function WaiterMenuBrowser({ categories, isAr, onAdd }: Props) {
  const t = useTranslations('waiter')
  const [activeCat, setActiveCat] = useState<string>(ALL)
  const [query, setQuery]         = useState('')
  const sectionRefs = useRef<Map<string, HTMLElement | null>>(new Map())

  const visibleCategories = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filterItem = (item: POSItem) => {
      if (!q) return true
      return (
        item.nameAr.toLowerCase().includes(q) ||
        item.nameEn.toLowerCase().includes(q)
      )
    }
    const cats = activeCat === ALL ? categories : categories.filter((c) => c.id === activeCat)
    return cats
      .map((c) => ({ ...c, items: c.items.filter(filterItem) }))
      .filter((c) => c.items.length > 0)
  }, [categories, activeCat, query])

  function selectCat(catId: string) {
    setActiveCat(catId)
    if (catId === ALL) return
    // Defer to next frame so layout reflects new filter, then smooth-scroll
    requestAnimationFrame(() => {
      const el = sectionRefs.current.get(catId)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sticky search + category bar */}
      <div className="sticky top-0 z-20 bg-brand-black border-b border-brand-border px-3 py-2">
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
            placeholder={t('search')}
            className="w-full min-h-[40px] rounded-lg bg-brand-surface border border-brand-border ps-9 pe-3 font-satoshi text-sm text-brand-text placeholder:text-brand-muted focus:outline-none focus:border-brand-gold/40"
          />
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <CatButton
            active={activeCat === ALL}
            label={t('allCategories')}
            onClick={() => selectCat(ALL)}
          />
          {categories.map((c) => (
            <CatButton
              key={c.id}
              active={activeCat === c.id}
              label={isAr ? c.nameAr : c.nameEn}
              onClick={() => selectCat(c.id)}
            />
          ))}
        </div>
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {visibleCategories.length === 0 ? (
          <p className={`text-center text-brand-muted py-12 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'لا توجد نتائج' : 'No matching items'}
          </p>
        ) : (
          visibleCategories.map((cat) => (
            <section
              key={cat.id}
              ref={(el) => { sectionRefs.current.set(cat.id, el) }}
              className="mb-4 scroll-mt-[120px]"
            >
              <h3 className={`text-xs font-bold text-brand-muted uppercase tracking-wide mb-2 ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
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

function ItemCard({
  item, isAr, onAdd,
}: { item: POSItem; isAr: boolean; onAdd: () => void }) {
  const t = useTranslations('waiter')
  // Server-precomputed (page.tsx maps from NormalizedMenuItem.fromPrice).
  // Re-deriving on the client risked SSR/CSR drift on items where
  // `priceBhd` came back from PostgREST as a string — see commit log.
  const fromPrice = item.fromPriceBhd

  const disabled = !item.available

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onAdd}
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
      <div className="p-3 flex flex-col flex-1 w-full">
        <h4 className={`text-sm font-bold text-brand-text line-clamp-2 leading-snug mb-1
          ${isAr ? 'font-cairo' : 'font-satoshi'}`}
        >
          {isAr ? item.nameAr : item.nameEn}
        </h4>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <span className="font-satoshi font-black text-brand-gold tabular-nums text-sm">
            {fromPrice.toFixed(3)}
          </span>
          <span className="shrink-0 w-6 h-6 rounded bg-brand-surface-2 text-brand-muted flex items-center justify-center group-hover:bg-brand-gold group-hover:text-brand-black transition-colors">
            <Plus size={14} strokeWidth={3} />
          </span>
        </div>
      </div>
    </button>
  )
}
