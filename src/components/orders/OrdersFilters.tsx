'use client'

import { useTranslations } from 'next-intl'
import { BRANCH_LIST } from '@/constants/contact'

export type StatusFilter =
  | 'all'
  | 'new'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
export type DateFilter   = 'all' | 'today' | 'yesterday' | 'last7' | 'last30'

interface Props {
  search:       string
  statusFilter: StatusFilter
  branchFilter: string
  dateFilter:   DateFilter
  totalCount:   number
  filteredTotal: number
  isRTL:        boolean
  onSearch:        (v: string) => void
  onStatusChange:  (v: StatusFilter) => void
  onBranchChange:  (v: string) => void
  onDateChange:    (v: DateFilter) => void
}

const STATUS_OPTIONS: { key: StatusFilter; labelEn: string; labelAr: string }[] = [
  { key: 'all',              labelEn: 'All Status',        labelAr: 'كل الحالات' },
  { key: 'new',              labelEn: 'New',               labelAr: 'جديد' },
  { key: 'accepted',         labelEn: 'Accepted',          labelAr: 'مقبول' },
  { key: 'preparing',        labelEn: 'Preparing',         labelAr: 'قيد التحضير' },
  { key: 'ready',            labelEn: 'Ready',             labelAr: 'جاهز' },
  { key: 'out_for_delivery', labelEn: 'Delivering',        labelAr: 'في الطريق' },
  { key: 'delivered',        labelEn: 'Delivered',         labelAr: 'تم التسليم' },
  { key: 'cancelled',        labelEn: 'Cancelled',         labelAr: 'ملغي' },
]

const DATE_OPTIONS: { key: DateFilter; labelEn: string; labelAr: string }[] = [
  { key: 'all',       labelEn: 'All Time',      labelAr: 'كل الأوقات' },
  { key: 'today',     labelEn: 'Today',         labelAr: 'اليوم' },
  { key: 'yesterday', labelEn: 'Yesterday',     labelAr: 'الأمس' },
  { key: 'last7',     labelEn: 'Last 7 Days',   labelAr: 'آخر 7 أيام' },
  { key: 'last30',    labelEn: 'Last 30 Days',  labelAr: 'آخر 30 يوماً' },
]

export default function OrdersFilters({
  search, statusFilter, branchFilter, dateFilter,
  totalCount, filteredTotal, isRTL,
  onSearch, onStatusChange, onBranchChange, onDateChange,
}: Props) {
  const t = useTranslations('dashboard')
  const tC = useTranslations('common')

  const selectCls = `
    min-h-[40px] rounded-lg border border-brand-border bg-brand-surface
    ps-3 pe-8 font-satoshi text-sm text-brand-text
    focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold
    appearance-none cursor-pointer
  `

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <div className="absolute inset-y-0 start-3 flex items-center pointer-events-none">
          <SearchIcon />
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={isRTL ? 'بحث برقم الطلب، الاسم، أو الهاتف...' : 'Search by order ID, name, or phone...'}
          className={`
            w-full min-h-[44px] rounded-lg border border-brand-border bg-brand-surface
            ps-9 pe-4 font-satoshi text-sm text-brand-text placeholder:text-brand-muted/50
            focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold
          `}
          dir="ltr"
        />
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Status */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value as StatusFilter)}
            className={selectCls}
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {isRTL ? o.labelAr : o.labelEn}
              </option>
            ))}
          </select>
          <ChevronIcon />
        </div>

        {/* Branch */}
        <div className="relative">
          <select
            value={branchFilter}
            onChange={(e) => onBranchChange(e.target.value)}
            className={selectCls}
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <option value="all">{t('allBranches')}</option>
            {BRANCH_LIST.map((b) => (
              <option key={b.id} value={b.id}>
                {isRTL ? b.nameAr : b.nameEn}
              </option>
            ))}
          </select>
          <ChevronIcon />
        </div>

        {/* Date */}
        <div className="relative">
          <select
            value={dateFilter}
            onChange={(e) => onDateChange(e.target.value as DateFilter)}
            className={selectCls}
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {DATE_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {isRTL ? o.labelAr : o.labelEn}
              </option>
            ))}
          </select>
          <ChevronIcon />
        </div>

        {/* Summary stats */}
        <div className="ms-auto flex items-center gap-2 text-sm text-brand-muted font-satoshi">
          <span className="font-medium text-brand-text tabular-nums">{totalCount}</span>
          <span>{isRTL ? 'طلب' : 'orders'}</span>
          {filteredTotal > 0 && (
            <>
              <span className="text-brand-border">·</span>
              <span className="font-medium text-brand-gold tabular-nums">
                {filteredTotal.toFixed(3)}
              </span>
              <span>{tC('currency')}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-brand-muted" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <div className="absolute inset-y-0 end-2.5 flex items-center pointer-events-none">
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="text-brand-muted" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  )
}
