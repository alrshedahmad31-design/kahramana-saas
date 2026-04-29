'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canManageCoupons } from '@/lib/auth/rbac'
import type { CouponInsert } from '@/lib/supabase/custom-types'

export type ActionResult = { success: true } | { success: false; error: string }

// ── Shared ────────────────────────────────────────────────────────────────────

function revalidateCoupons(locale: string) {
  revalidatePath(`/${locale}/dashboard/coupons`)
  revalidatePath('/dashboard/coupons')
}

// ── createCoupon ──────────────────────────────────────────────────────────────

export type CouponFormData = {
  code:                  string
  type:                  'percentage' | 'fixed_amount'
  value:                 number
  description_ar:       string | null
  description_en:       string | null
  min_order_value_bhd:  number
  max_discount_bhd:     number | null
  usage_limit:          number | null
  per_customer_limit:   number
  valid_from:           string
  valid_until:          string | null
  is_active:            boolean
  locale:               string
  // Enterprise fields
  campaign_name?:        string | null
  discount_type?:        string | null
  max_discount_amount?:  number | null
  min_order_value?:      number | null
  applicable_branches?:  string[] | null
  applicable_items?:     string[] | null
  applicable_categories?: string[] | null
  customer_segment?:     string | null
  days_active?:          number[] | null
  time_start?:           string | null
  time_end?:             string | null
  auto_apply?:           boolean
}

export async function createCoupon(data: CouponFormData): Promise<ActionResult> {
  const caller = await getSession()
  if (!caller) return { success: false, error: 'Unauthorized' }
  if (!canManageCoupons(caller)) return { success: false, error: 'Insufficient permissions' }

  const code = data.code.trim().toUpperCase()
  if (!code) return { success: false, error: 'Coupon code is required' }

  const supabase = await createClient()

  const insert: Omit<CouponInsert, 'id'> = {
    code,
    type:                  data.type,
    value:                 data.value,
    description_ar:        data.description_ar || null,
    description_en:        data.description_en || null,
    min_order_value_bhd:   data.min_order_value_bhd,
    max_discount_bhd:      data.max_discount_bhd,
    usage_limit:           data.usage_limit,
    per_customer_limit:    data.per_customer_limit,
    valid_from:            data.valid_from,
    valid_until:           data.valid_until || null,
    is_active:             data.is_active,
    created_by:            caller.id,
    campaign_name:         data.campaign_name || null,
    discount_type:         data.discount_type || data.type,
    max_discount_amount:   data.max_discount_amount || data.max_discount_bhd || null,
    min_order_value:       data.min_order_value || data.min_order_value_bhd || 0,
    applicable_branches:   data.applicable_branches || null,
    applicable_items:      data.applicable_items || null,
    applicable_categories: data.applicable_categories || null,
    customer_segment:      data.customer_segment || 'all',
    days_active:           data.days_active || null,
    time_start:            data.time_start || null,
    time_end:              data.time_end || null,
    auto_apply:            data.auto_apply || false,
    paused:                false,
    paused_at:             null,
  }

  const { data: created, error } = await supabase
    .from('coupons')
    .insert(insert)
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  await supabase.from('audit_logs').insert({
    table_name: 'coupons',
    action:     'INSERT',
    user_id:    caller.id,
    record_id:  created.id,
    changes:    { code, type: data.type, value: data.value },
    branch_id:  caller.branch_id,
    actor_role: caller.role,
  })

  revalidateCoupons(data.locale)
  return { success: true }
}

// ── updateCoupon ──────────────────────────────────────────────────────────────

export async function updateCoupon(
  id:   string,
  data: CouponFormData,
): Promise<ActionResult> {
  const caller = await getSession()
  if (!caller) return { success: false, error: 'Unauthorized' }
  if (!canManageCoupons(caller)) return { success: false, error: 'Insufficient permissions' }

  const code = data.code.trim().toUpperCase()
  if (!code) return { success: false, error: 'Coupon code is required' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('coupons')
    .update({
      code,
      type:                  data.type,
      value:                 data.value,
      description_ar:        data.description_ar || null,
      description_en:        data.description_en || null,
      min_order_value_bhd:   data.min_order_value_bhd,
      max_discount_bhd:      data.max_discount_bhd,
      usage_limit:           data.usage_limit,
      per_customer_limit:    data.per_customer_limit,
      valid_from:            data.valid_from,
      valid_until:           data.valid_until || null,
      is_active:             data.is_active,
      campaign_name:         data.campaign_name || null,
      discount_type:         data.discount_type || data.type,
      max_discount_amount:   data.max_discount_amount || data.max_discount_bhd || null,
      min_order_value:       data.min_order_value || data.min_order_value_bhd || 0,
      applicable_branches:   data.applicable_branches || null,
      applicable_items:      data.applicable_items || null,
      applicable_categories: data.applicable_categories || null,
      customer_segment:      data.customer_segment || 'all',
      days_active:           data.days_active || null,
      time_start:            data.time_start || null,
      time_end:              data.time_end || null,
      auto_apply:            data.auto_apply || false,
    })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  await supabase.from('audit_logs').insert({
    table_name: 'coupons',
    action:     'UPDATE',
    user_id:    caller.id,
    record_id:  id,
    changes:    { code, type: data.type, value: data.value, is_active: data.is_active },
    branch_id:  caller.branch_id,
    actor_role: caller.role,
  })

  revalidateCoupons(data.locale)
  return { success: true }
}

// ── toggleCouponActive ────────────────────────────────────────────────────────

export async function toggleCouponActive(
  id:        string,
  isActive:  boolean,
  locale:    string,
): Promise<ActionResult> {
  const caller = await getSession()
  if (!caller) return { success: false, error: 'Unauthorized' }
  if (!canManageCoupons(caller)) return { success: false, error: 'Insufficient permissions' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('coupons')
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  await supabase.from('audit_logs').insert({
    table_name: 'coupons',
    action:     'UPDATE',
    user_id:    caller.id,
    record_id:  id,
    changes:    { is_active: isActive },
    branch_id:  caller.branch_id,
    actor_role: caller.role,
  })

  revalidateCoupons(locale)
  return { success: true }
}

// ── toggleCouponPause ─────────────────────────────────────────────────────────

export async function toggleCouponPause(
  id:       string,
  isPaused: boolean,
  locale:   string,
): Promise<ActionResult> {
  const caller = await getSession()
  if (!caller) return { success: false, error: 'Unauthorized' }
  if (!canManageCoupons(caller)) return { success: false, error: 'Insufficient permissions' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('coupons')
    .update({ 
      paused: isPaused,
      paused_at: isPaused ? new Date().toISOString() : null
    })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  await supabase.from('audit_logs').insert({
    table_name: 'coupons',
    action:     'UPDATE',
    user_id:    caller.id,
    record_id:  id,
    changes:    { paused: isPaused },
    branch_id:  caller.branch_id,
    actor_role: caller.role,
  })

  revalidateCoupons(locale)
  return { success: true }
}
