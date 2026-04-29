'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { validateCoupon } from '@/lib/coupons/validation'
import CouponBadge from '@/components/coupons/CouponBadge'
import type { CouponRow } from '@/lib/supabase/types'

export interface AppliedCoupon {
  id:       string
  code:     string
  type:     CouponRow['type']
  value:    number
  max_discount_bhd:  number | null
  description_ar:    string | null
  description_en:    string | null
  discount: number
}

interface Props {
  customerId:    string | null
  orderTotal:    number
  appliedCoupon: AppliedCoupon | null
  onApply:       (coupon: AppliedCoupon) => void
  onRemove:      () => void
}

export default function CouponInput({
  customerId,
  orderTotal,
  appliedCoupon,
  onApply,
  onRemove,
}: Props) {
  const locale = useLocale()
  const isAr   = locale === 'ar'

  const [code,    setCode]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleApply() {
    if (!code.trim()) return
    setError(null)
    setLoading(true)

    const result = await validateCoupon(code, customerId, orderTotal)
    setLoading(false)

    if (!result.valid || !result.coupon || result.discount == null) {
      setError(result.error ?? 'Invalid coupon')
      return
    }

    onApply({
      id:              result.coupon.id,
      code:            result.coupon.code,
      type:            result.coupon.type,
      value:           result.coupon.value,
      max_discount_bhd: result.coupon.max_discount_bhd,
      description_ar:  result.coupon.description_ar,
      description_en:  result.coupon.description_en,
      discount:        result.discount,
    })
    setCode('')
  }

  function handleRemove() {
    onRemove()
    setError(null)
    setCode('')
  }

  if (appliedCoupon) {
    return (
      <div className="mb-6">
        <p className={`text-xs font-bold text-brand-muted uppercase tracking-wide mb-2
          ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {isAr ? 'كوبون مطبق' : 'Applied Coupon'}
        </p>
        <CouponBadge coupon={appliedCoupon} discount={appliedCoupon.discount} onRemove={handleRemove} />
      </div>
    )
  }

  return (
    <div className="mb-6">
      <p className={`text-xs font-bold text-brand-muted uppercase tracking-wide mb-2
        ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
        {isAr ? 'كود الخصم' : 'Coupon Code'}
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleApply() } }}
          placeholder={isAr ? 'أدخل كود الخصم' : 'Enter coupon code'}
          dir="ltr"
          className={`flex-1 bg-brand-surface-2 border rounded-lg ps-3 pe-3 py-2.5 text-sm
                      font-satoshi text-brand-text placeholder:text-brand-muted
                      focus:border-brand-gold focus:outline-none transition-colors uppercase
                      ${error ? 'border-brand-error' : 'border-brand-border'}`}
        />
        <button
          type="button"
          onClick={handleApply}
          disabled={loading || !code.trim()}
          className="px-4 py-2.5 bg-brand-surface border border-brand-border rounded-lg
                     text-sm font-bold font-satoshi text-brand-text
                     hover:border-brand-gold/50 transition-colors
                     disabled:opacity-50 shrink-0"
        >
          {loading ? '...' : isAr ? 'تطبيق' : 'Apply'}
        </button>
      </div>
      {error && (
        <p className={`mt-1.5 text-xs text-brand-error ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {error}
        </p>
      )}
    </div>
  )
}
