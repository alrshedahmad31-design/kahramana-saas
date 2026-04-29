'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import type { BranchRow } from '@/lib/supabase/types'

export type CouponStatus     = 'all' | 'active' | 'paused' | 'expired' | 'scheduled'
export type CouponTypeFilter = 'all' | 'percentage' | 'fixed' | 'free_delivery' | 'bogo' | 'free_item'
export type CouponSort       = 'newest' | 'most_used' | 'highest_impact' | 'ending_soon'

interface Props {
  branches:       BranchRow[]
  onFilterChange: (filters: FilterState) => void
}

export interface FilterState {
  search:   string
  status:   CouponStatus
  type:     CouponTypeFilter
  branchId: string
  sort:     CouponSort
}

export default function CouponFilters({ branches, onFilterChange }: Props) {
  const isAr = useLocale() === 'ar'

  const [filters, setFilters] = useState<FilterState>({
    search:   '',
    status:   'all',
    type:     'all',
    branchId: 'all',
    sort:     'newest',
  })

  const update = (patch: Partial<FilterState>) => {
    const next = { ...filters, ...patch }
    setFilters(next)
    onFilterChange(next)
  }

  const selectCls = `
    bg-brand-surface border border-brand-border rounded-xl px-3 py-2 text-xs font-bold
    text-brand-text focus:border-brand-gold focus:outline-none transition-colors
    appearance-none cursor-pointer hover:bg-brand-surface-2
    ${isAr ? 'font-almarai' : 'font-satoshi'}
  `

  return (
    <div className="flex flex-col gap-4 bg-brand-surface-2 border border-brand-border rounded-2xl p-4">
      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder={isAr ? 'البحث بالكود أو اسم الحملة...' : 'Search by code or campaign name...'}
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          className={`w-full bg-brand-surface border border-brand-border rounded-xl ps-10 pe-4 py-2.5
                     text-sm text-brand-text placeholder:text-brand-muted
                     focus:border-brand-gold focus:outline-none transition-colors ${isAr ? 'font-almarai' : 'font-satoshi'}`}
        />
        <svg className="absolute start-3 top-1/2 -translate-y-1/2 text-brand-muted" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status */}
        <div className="flex flex-col gap-1 min-w-[120px]">
          <label className={`text-[10px] font-black uppercase tracking-widest text-brand-muted ms-1 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'الحالة' : 'Status'}
          </label>
          <select value={filters.status} onChange={(e) => update({ status: e.target.value as CouponStatus })} className={selectCls}>
            <option value="all">{isAr ? 'جميع الحالات' : 'All Statuses'}</option>
            <option value="active">{isAr ? 'نشطة الآن' : 'Active Now'}</option>
            <option value="paused">{isAr ? 'موقوفة' : 'Paused'}</option>
            <option value="expired">{isAr ? 'منتهية' : 'Expired'}</option>
            <option value="scheduled">{isAr ? 'مجدولة' : 'Scheduled'}</option>
          </select>
        </div>

        {/* Type */}
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className={`text-[10px] font-black uppercase tracking-widest text-brand-muted ms-1 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'نوع الخصم' : 'Discount Type'}
          </label>
          <select value={filters.type} onChange={(e) => update({ type: e.target.value as CouponTypeFilter })} className={selectCls}>
            <option value="all">{isAr ? 'جميع الأنواع' : 'All Types'}</option>
            <option value="percentage">{isAr ? 'خصم نسبي' : 'Percentage Off'}</option>
            <option value="fixed">{isAr ? 'مبلغ ثابت' : 'Fixed Amount'}</option>
            <option value="free_delivery">{isAr ? 'توصيل مجاني' : 'Free Delivery'}</option>
            <option value="bogo">{isAr ? 'اشتري وخذ مجاناً' : 'BOGO Deals'}</option>
            <option value="free_item">{isAr ? 'منتج مجاني' : 'Free Item'}</option>
          </select>
        </div>

        {/* Branch */}
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className={`text-[10px] font-black uppercase tracking-widest text-brand-muted ms-1 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'الفرع' : 'Branch'}
          </label>
          <select value={filters.branchId} onChange={(e) => update({ branchId: e.target.value })} className={selectCls}>
            <option value="all">{isAr ? 'جميع الفروع' : 'All Branches'}</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{isAr ? b.name_ar : b.name_en}</option>
            ))}
          </select>
        </div>

        {/* Sort */}
        <div className="flex flex-col gap-1 min-w-[140px] ms-auto">
          <label className={`text-[10px] font-black uppercase tracking-widest text-brand-muted ms-1 text-end ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'الترتيب' : 'Sort By'}
          </label>
          <select value={filters.sort} onChange={(e) => update({ sort: e.target.value as CouponSort })} className={selectCls}>
            <option value="newest">{isAr ? 'الأحدث أولاً' : 'Newest First'}</option>
            <option value="most_used">{isAr ? 'الأكثر استخداماً' : 'Most Popular'}</option>
            <option value="highest_impact">{isAr ? 'الأعلى تأثيراً' : 'Highest Revenue'}</option>
            <option value="ending_soon">{isAr ? 'ينتهي قريباً' : 'Ending Soon'}</option>
          </select>
        </div>
      </div>
    </div>
  )
}
