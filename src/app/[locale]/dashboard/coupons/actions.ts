'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canManageCoupons } from '@/lib/auth/rbac'
import { toSafeError } from '@/lib/utils/safe-error'
import type { CouponInsert } from '@/lib/supabase/custom-types'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuthUser } from '@/lib/auth/session'

// 3-decimal money precision (Bahraini Dinar fils).
const bhd3 = z.number()
  .refine((n) => Number.isInteger(Math.round(n * 1000)) && Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6,
    { message: 'value must have at most 3 decimal places' })

const couponSchema = z.object({
  code:                  z.string().trim().min(1).max(40),
  type:                  z.enum(['percentage', 'fixed_amount']),
  value:                 z.number().min(0, 'value must be non-negative').max(10_000),
  description_ar:        z.string().max(500).nullable(),
  description_en:        z.string().max(500).nullable(),
  min_order_value_bhd:   z.number().min(0).max(10_000).pipe(bhd3),
  max_discount_bhd:      z.number().min(0).max(10_000).pipe(bhd3).nullable(),
  usage_limit:           z.number().int('usage_limit must be integer').min(0).nullable(),
  per_customer_limit:    z.number().int('per_customer_limit must be integer').min(0).max(1000),
  valid_from:            z.string().min(1),
  valid_until:           z.string().nullable(),
  is_active:             z.boolean(),
  locale:                z.string().max(8),
  campaign_name:         z.string().max(120).nullable().optional(),
  discount_type:         z.string().max(40).nullable().optional(),
  max_discount_amount:   z.number().min(0).max(10_000).pipe(bhd3).nullable().optional(),
  min_order_value:       z.number().min(0).max(10_000).pipe(bhd3).nullable().optional(),
  applicable_branches:   z.array(z.string().max(50)).nullable().optional(),
  applicable_items:      z.array(z.string().max(120)).nullable().optional(),
  applicable_categories: z.array(z.string().max(120)).nullable().optional(),
  customer_segment:      z.string().max(40).nullable().optional(),
  days_active:           z.array(z.number().int().min(0).max(6)).nullable().optional(),
  time_start:            z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'time_start must be HH:MM').nullable().optional(),
  time_end:              z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'time_end must be HH:MM').nullable().optional(),
  auto_apply:            z.boolean().optional(),
}).refine((d) => {
  if (!d.valid_until) return true
  return new Date(d.valid_until).getTime() >= new Date(d.valid_from).getTime()
}, { message: 'valid_until must be on or after valid_from', path: ['valid_until'] })

function validateCouponPayload(data: CouponFormData): { ok: true } | { ok: false; error: string } {
  const parsed = couponSchema.safeParse(data)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, error: issue ? `${issue.path.join('.')}: ${issue.message}` : 'Invalid coupon payload' }
  }
  return { ok: true }
}

export type ActionResult = { success: true } | { success: false; error: string }

// Branch-scope gate for coupon mutations on an existing row.
// Branch managers and marketing may only touch coupons they created OR
// coupons whose applicable_branches contains their branch. Owner / GM bypass.
// Marketing was previously unscoped — a marketing user could edit / pause /
// flip is_active on any coupon in any branch (P0-7).
async function assertCouponScope(
  supabase: SupabaseClient,
  couponId: string,
  caller:   AuthUser,
): Promise<ActionResult> {
  if (caller.role !== 'branch_manager' && caller.role !== 'marketing') {
    return { success: true }
  }
  const { data: existing, error } = await supabase
    .from('coupons')
    .select('applicable_branches, created_by')
    .eq('id', couponId)
    .single<{ applicable_branches: string[] | null; created_by: string | null }>()
  if (error || !existing) return { success: false, error: 'Coupon not found' }

  const isCreator = existing.created_by === caller.id
  const branches  = existing.applicable_branches ?? []
  const inScope   = caller.branch_id != null && branches.includes(caller.branch_id)
  if (!isCreator && !inScope) {
    return { success: false, error: 'Coupon scope violation' }
  }
  return { success: true }
}

// ── Server-side coupon limits ─────────────────────────────────────────────────
// D-C1: Hard limits enforced for non-admin roles (marketing, branch_manager).
// owner / general_manager bypass these — they create exceptional coupons themselves.
const COUPON_LIMITS = {
  maxPercentageValue: 30,   // %
  maxFixedAmountBhd:  5,    // BD
} as const

type CouponLimitedFields = Pick<
  CouponFormData,
  'type' | 'value' | 'max_discount_bhd' | 'usage_limit'
>

function assertCouponWithinLimits(data: CouponLimitedFields): void {
  if (data.type === 'percentage') {
    if (data.value > COUPON_LIMITS.maxPercentageValue) {
      throw new Error('COUPON_VALUE_EXCEEDS_LIMIT')
    }
    if (!data.max_discount_bhd || data.max_discount_bhd <= 0) {
      throw new Error('COUPON_REQUIRES_CAP')
    }
  }
  if (data.type === 'fixed_amount' && data.value > COUPON_LIMITS.maxFixedAmountBhd) {
    throw new Error('COUPON_VALUE_EXCEEDS_LIMIT')
  }
  if (!data.usage_limit || data.usage_limit <= 0) {
    throw new Error('COUPON_REQUIRES_USAGE_LIMIT')
  }
}

function revalidateCoupons(_locale: string) {
  revalidatePath('/dashboard/coupons')
  revalidatePath('/en/dashboard/coupons')
}

export type CouponFormData = {
  code:                  string
  type:                  'percentage' | 'fixed_amount'
  value:                 number
  description_ar:        string | null
  description_en:        string | null
  min_order_value_bhd:   number
  max_discount_bhd:      number | null
  usage_limit:           number | null
  per_customer_limit:    number
  valid_from:            string
  valid_until:           string | null
  is_active:             boolean
  locale:                string
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

  // Data-integrity validation runs for ALL roles. Admin bypass below only
  // applies to business caps (assertCouponWithinLimits), not shape/precision.
  const shape = validateCouponPayload(data)
  if (!shape.ok) return { success: false, error: shape.error }

  const code = data.code.trim().toUpperCase()
  if (!code) return { success: false, error: 'Coupon code is required' }

  const isAdmin = caller.role === 'owner' || caller.role === 'general_manager'
  if (!isAdmin) {
    try {
      assertCouponWithinLimits(data)
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'COUPON_INVALID' }
    }
  }

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

  if (error || !created) return { success: false, error: toSafeError(error ?? 'Failed to create coupon') }

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

export async function updateCoupon(
  id:   string,
  data: CouponFormData,
): Promise<ActionResult> {
  const caller = await getSession()
  if (!caller) return { success: false, error: 'Unauthorized' }
  if (!canManageCoupons(caller)) return { success: false, error: 'Insufficient permissions' }

  const shape = validateCouponPayload(data)
  if (!shape.ok) return { success: false, error: shape.error }

  const code = data.code.trim().toUpperCase()
  if (!code) return { success: false, error: 'Coupon code is required' }

  const isAdmin = caller.role === 'owner' || caller.role === 'general_manager'
  if (!isAdmin) {
    try {
      assertCouponWithinLimits(data)
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'COUPON_INVALID' }
    }
  }

  const supabase = await createClient()

  const scope = await assertCouponScope(supabase, id, caller)
  if (!scope.success) return scope

  const { data: updated, error } = await supabase
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
    .select('id')
    .single()

  if (error) return { success: false, error: toSafeError(error) }
  if (!updated) return { success: false, error: 'Coupon not found' }

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

export async function toggleCouponActive(
  id:        string,
  isActive:  boolean,
  locale:    string,
): Promise<ActionResult> {
  const caller = await getSession()
  if (!caller) return { success: false, error: 'Unauthorized' }
  if (!canManageCoupons(caller)) return { success: false, error: 'Insufficient permissions' }

  const supabase = await createClient()

  const scope = await assertCouponScope(supabase, id, caller)
  if (!scope.success) return scope

  const { data: updated, error } = await supabase
    .from('coupons')
    .update({ is_active: isActive })
    .eq('id', id)
    .select('id')
    .single()

  if (error) return { success: false, error: toSafeError(error) }
  if (!updated) return { success: false, error: 'Coupon not found' }

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

export async function toggleCouponPause(
  id:       string,
  isPaused: boolean,
  locale:   string,
): Promise<ActionResult> {
  const caller = await getSession()
  if (!caller) return { success: false, error: 'Unauthorized' }
  if (!canManageCoupons(caller)) return { success: false, error: 'Insufficient permissions' }

  const supabase = await createClient()

  const scope = await assertCouponScope(supabase, id, caller)
  if (!scope.success) return scope

  const { data: updated, error } = await supabase
    .from('coupons')
    .update({
      paused: isPaused,
      paused_at: isPaused ? new Date().toISOString() : null
    })
    .eq('id', id)
    .select('id')
    .single()

  if (error) return { success: false, error: toSafeError(error) }
  if (!updated) return { success: false, error: 'Coupon not found' }

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
