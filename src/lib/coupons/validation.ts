'use server'

import { createClient } from '@/lib/supabase/server'
import { calculateDiscount } from './calculations'
import type { CouponRow } from '@/lib/supabase/custom-types'

export interface CouponValidationResult {
  valid:       boolean
  couponId?:   string
  couponCode?: string
  discount?:   number
  coupon?:     Pick<CouponRow, 'id' | 'code' | 'type' | 'value' | 'max_discount_bhd' | 'description_ar' | 'description_en'>
  error?:      string
}

export async function validateCoupon(
  code:        string,
  customerId:  string | null,
  orderTotal:  number,
): Promise<CouponValidationResult> {
  if (!code.trim()) return { valid: false, error: 'Enter a coupon code' }

  const upper = code.trim().toUpperCase()
  const supabase = await createClient()

  const { data: coupon, error: fetchErr } = await supabase
    .from('coupons')
    .select('id, code, type, value, description_ar, description_en, min_order_value_bhd, max_discount_bhd, usage_limit, usage_count, per_customer_limit, valid_from, valid_until, is_active')
    .eq('code', upper)
    .single()

  if (fetchErr || !coupon) return { valid: false, error: 'Invalid coupon code' }

  const now = new Date()

  if (!coupon.is_active) return { valid: false, error: 'This coupon is no longer active' }

  if (new Date(coupon.valid_from) > now) {
    return { valid: false, error: 'This coupon is not valid yet' }
  }
  if (coupon.valid_until && new Date(coupon.valid_until) < now) {
    return { valid: false, error: 'This coupon has expired' }
  }
  if (orderTotal < coupon.min_order_value_bhd) {
    return {
      valid: false,
      error: `Minimum order value is ${Number(coupon.min_order_value_bhd).toFixed(3)} BD`,
    }
  }
  if (coupon.usage_limit != null && coupon.usage_count >= coupon.usage_limit) {
    return { valid: false, error: 'This coupon has reached its usage limit' }
  }

  if (customerId && coupon.per_customer_limit > 0) {
    const { count } = await supabase
      .from('coupon_usages')
      .select('id', { count: 'exact', head: true })
      .eq('coupon_id', coupon.id)
      .eq('customer_id', customerId)

    if ((count ?? 0) >= coupon.per_customer_limit) {
      return { valid: false, error: 'You have already used this coupon' }
    }
  }

  const discount = calculateDiscount(coupon, orderTotal)

  return {
    valid:      true,
    couponId:   coupon.id,
    couponCode: coupon.code,
    discount,
    coupon: {
      id:              coupon.id,
      code:            coupon.code,
      type:            coupon.type,
      value:           coupon.value,
      max_discount_bhd: coupon.max_discount_bhd,
      description_ar:  coupon.description_ar,
      description_en:  coupon.description_en,
    },
  }
}
