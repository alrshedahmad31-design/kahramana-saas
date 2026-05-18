'use server'

import * as Sentry from '@sentry/nextjs'
import { revalidatePath } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { canManageCoupons } from '@/lib/auth/rbac'

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

// Maps the RPC's typed { ok=false, code } payload onto the localized
// dashboard.coupons.errors.* keys.
function mapRpcCode(t: (key: string) => string, code: string, fallback: string): string {
  switch (code) {
    case 'forbidden_role':                  return t('forbiddenRole')
    case 'forbidden_branch':                return t('forbiddenBranch')
    case 'coupon_branch_required':          return t('branchRequired')
    case 'coupon_branch_scope_required':    return t('branchScopeRequired')
    case 'coupon_branch_scope_violation':   return t('branchScopeViolation')
    case 'coupon_value_exceeds_limit':      return t('valueExceedsLimit')
    case 'coupon_requires_cap':             return t('requiresCap')
    case 'coupon_requires_usage_limit':     return t('requiresUsageLimit')
    case 'invalid_input':                   return t('invalidInput')
    case 'not_found':                       return t('notFound')
    case 'in_use':                          return t('inUse')
    default:                                return fallback
  }
}

type RpcResult<T extends object = object> = ({ ok: true } & T) | { ok: false; code: string }
function isRpcResult<T extends object>(v: unknown): v is RpcResult<T> {
  return typeof v === 'object' && v !== null && 'ok' in v
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

// Builds the JSONB payload the RPCs expect. Pure transform, no I/O.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildCouponPayload(data: CouponFormData, code: string): any {
  return {
    code,
    type:                  data.type,
    value:                 data.value,
    description_ar:        data.description_ar ?? null,
    description_en:        data.description_en ?? null,
    min_order_value_bhd:   data.min_order_value_bhd,
    max_discount_bhd:      data.max_discount_bhd,
    usage_limit:           data.usage_limit,
    per_customer_limit:    data.per_customer_limit,
    valid_from:            data.valid_from,
    valid_until:           data.valid_until ?? null,
    is_active:             data.is_active,
    campaign_name:         data.campaign_name ?? null,
    discount_type:         data.discount_type ?? data.type,
    max_discount_amount:   data.max_discount_amount ?? data.max_discount_bhd ?? null,
    min_order_value:       data.min_order_value ?? data.min_order_value_bhd ?? 0,
    applicable_branches:   data.applicable_branches ?? [],
    applicable_items:      data.applicable_items ?? null,
    applicable_categories: data.applicable_categories ?? null,
    customer_segment:      data.customer_segment ?? 'all',
    days_active:           data.days_active ?? null,
    time_start:            data.time_start ?? null,
    time_end:              data.time_end ?? null,
    auto_apply:            data.auto_apply ?? false,
  }
}

export async function createCoupon(data: CouponFormData): Promise<ActionResult> {
  const t = await getTranslations('dashboard.coupons.errors')

  const caller = await getSession()
  if (!caller) return { success: false, error: t('unauthorized') }
  if (!canManageCoupons(caller)) return { success: false, error: t('forbiddenRole') }

  // Shape validation runs for ALL roles. Business caps + branch clamp are
  // re-enforced inside rpc_create_coupon (migration 170) under SECURITY
  // DEFINER — JS guards stay as pre-flight UX.
  const shape = validateCouponPayload(data)
  if (!shape.ok) return { success: false, error: shape.error }

  const code = data.code.trim().toUpperCase()
  if (!code) return { success: false, error: t('invalidCode') }

  const supabase = await createClient()
  const { data: rpcRaw, error } = await supabase.rpc('rpc_create_coupon', {
    p_payload: buildCouponPayload(data, code),
  })

  if (error) {
    Sentry.captureException(error, { tags: { area: 'coupons', action: 'createCoupon' } })
    return { success: false, error: t('rpcFailed') }
  }

  const rpc = isRpcResult<{ id: string }>(rpcRaw) ? rpcRaw : null
  if (!rpc) {
    Sentry.captureException(new Error('rpc_create_coupon unexpected payload'), {
      tags:  { area: 'coupons', action: 'createCoupon' },
      extra: { payload: rpcRaw },
    })
    return { success: false, error: t('rpcFailed') }
  }
  if (!rpc.ok) {
    return { success: false, error: mapRpcCode(t, rpc.code, t('rpcFailed')) }
  }

  revalidateCoupons(data.locale)
  return { success: true }
}

export async function updateCoupon(
  id:   string,
  data: CouponFormData,
): Promise<ActionResult> {
  const t = await getTranslations('dashboard.coupons.errors')

  const caller = await getSession()
  if (!caller) return { success: false, error: t('unauthorized') }
  if (!canManageCoupons(caller)) return { success: false, error: t('forbiddenRole') }

  const shape = validateCouponPayload(data)
  if (!shape.ok) return { success: false, error: shape.error }

  const code = data.code.trim().toUpperCase()
  if (!code) return { success: false, error: t('invalidCode') }

  const supabase = await createClient()
  const { data: rpcRaw, error } = await supabase.rpc('rpc_update_coupon', {
    p_id:      id,
    p_payload: buildCouponPayload(data, code),
  })

  if (error) {
    Sentry.captureException(error, { tags: { area: 'coupons', action: 'updateCoupon' } })
    return { success: false, error: t('rpcFailed') }
  }

  const rpc = isRpcResult<{ id: string }>(rpcRaw) ? rpcRaw : null
  if (!rpc) {
    Sentry.captureException(new Error('rpc_update_coupon unexpected payload'), {
      tags:  { area: 'coupons', action: 'updateCoupon' },
      extra: { payload: rpcRaw },
    })
    return { success: false, error: t('rpcFailed') }
  }
  if (!rpc.ok) {
    return { success: false, error: mapRpcCode(t, rpc.code, t('rpcFailed')) }
  }

  revalidateCoupons(data.locale)
  return { success: true }
}

export async function toggleCouponActive(
  id:        string,
  isActive:  boolean,
  locale:    string,
): Promise<ActionResult> {
  const t = await getTranslations('dashboard.coupons.errors')

  const caller = await getSession()
  if (!caller) return { success: false, error: t('unauthorized') }
  if (!canManageCoupons(caller)) return { success: false, error: t('forbiddenRole') }

  const supabase = await createClient()
  const { data: rpcRaw, error } = await supabase.rpc('rpc_set_coupon_active', {
    p_id:        id,
    p_is_active: isActive,
  })

  if (error) {
    Sentry.captureException(error, { tags: { area: 'coupons', action: 'toggleCouponActive' } })
    return { success: false, error: t('rpcFailed') }
  }

  const rpc = isRpcResult<object>(rpcRaw) ? rpcRaw : null
  if (!rpc) {
    Sentry.captureException(new Error('rpc_set_coupon_active unexpected payload'), {
      tags: { area: 'coupons', action: 'toggleCouponActive' }, extra: { payload: rpcRaw },
    })
    return { success: false, error: t('rpcFailed') }
  }
  if (!rpc.ok) return { success: false, error: mapRpcCode(t, rpc.code, t('rpcFailed')) }

  revalidateCoupons(locale)
  return { success: true }
}

export async function toggleCouponPause(
  id:       string,
  isPaused: boolean,
  locale:   string,
): Promise<ActionResult> {
  const t = await getTranslations('dashboard.coupons.errors')

  const caller = await getSession()
  if (!caller) return { success: false, error: t('unauthorized') }
  if (!canManageCoupons(caller)) return { success: false, error: t('forbiddenRole') }

  const supabase = await createClient()
  const { data: rpcRaw, error } = await supabase.rpc('rpc_set_coupon_paused', {
    p_id:        id,
    p_is_paused: isPaused,
  })

  if (error) {
    Sentry.captureException(error, { tags: { area: 'coupons', action: 'toggleCouponPause' } })
    return { success: false, error: t('rpcFailed') }
  }

  const rpc = isRpcResult<object>(rpcRaw) ? rpcRaw : null
  if (!rpc) {
    Sentry.captureException(new Error('rpc_set_coupon_paused unexpected payload'), {
      tags: { area: 'coupons', action: 'toggleCouponPause' }, extra: { payload: rpcRaw },
    })
    return { success: false, error: t('rpcFailed') }
  }
  if (!rpc.ok) return { success: false, error: mapRpcCode(t, rpc.code, t('rpcFailed')) }

  revalidateCoupons(locale)
  return { success: true }
}
