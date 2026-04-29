'use client'

import { useLocale } from 'next-intl'
import type { CouponRow } from '@/lib/supabase/custom-types'

interface Props {
  coupon:   Pick<CouponRow, 'code' | 'type' | 'value' | 'description_ar' | 'description_en'>
  discount: number
  onRemove: () => void
}

export default function CouponBadge({ coupon, discount, onRemove }: Props) {
  const locale = useLocale()
  const isAr   = locale === 'ar'

  const label = isAr
    ? (coupon.description_ar ?? coupon.code)
    : (coupon.description_en ?? coupon.code)

  return (
    <div className="flex items-center gap-2 bg-brand-gold/10 border border-brand-gold/40
                    rounded-xl px-3 py-2">
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth={2.5} strokeLinecap="round" className="text-brand-gold shrink-0">
        <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-brand-gold font-satoshi tracking-wider truncate">
          {coupon.code}
        </p>
        {label !== coupon.code && (
          <p className={`text-xs text-brand-muted truncate ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {label}
          </p>
        )}
      </div>
      <span className="text-xs font-bold text-brand-gold font-satoshi tabular-nums shrink-0">
        -{discount.toFixed(3)} BD
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove coupon"
        className="text-brand-muted hover:text-brand-error transition-colors ms-1"
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth={2.5} strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
