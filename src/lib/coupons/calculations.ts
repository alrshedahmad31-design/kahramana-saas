import type { CouponRow } from '@/lib/supabase/custom-types'

export function calculateDiscount(
  coupon: Pick<CouponRow, 'type' | 'value' | 'max_discount_bhd'>,
  orderTotal: number,
): number {
  if (coupon.type === 'fixed_amount') {
    return parseFloat(Math.min(coupon.value, orderTotal).toFixed(3))
  }
  const raw = (orderTotal * coupon.value) / 100
  const capped = coupon.max_discount_bhd != null
    ? Math.min(raw, coupon.max_discount_bhd)
    : raw
  return parseFloat(capped.toFixed(3))
}
