'use server'

import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import {
  requireDashboardSection,
  isDashboardGuardError,
} from '@/lib/auth/dashboard-guards'
import type { PromotionType } from '@/lib/promotions/types'

const PROMO_TYPES: readonly PromotionType[] = [
  'bogo', 'bundle', 'time_discount', 'item_discount', 'spend_discount',
] as const

const inputSchema = z.object({
  id:        z.string().uuid().optional(),
  branch_id: z.string().min(1).max(50).nullable(),
  name_ar:   z.string().min(1).max(120),
  name_en:   z.string().min(1).max(120),
  type:      z.enum(['bogo', 'bundle', 'time_discount', 'item_discount', 'spend_discount']),
  config:    z.record(z.unknown()),
  starts_at: z.string().nullable(),
  ends_at:   z.string().nullable(),
  is_active: z.boolean(),
  max_uses:  z.number().int().positive().nullable(),
})

export type PromotionInput = z.infer<typeof inputSchema>

export interface PromotionMutationResult {
  ok?:     true
  id?:     string
  error?:  string
}

// Maps the RPC's typed { ok=false, code } payload onto the localized
// promotions.errors.* keys.
function mapRpcCode(t: (key: string) => string, code: string, fallback: string): string {
  switch (code) {
    case 'forbidden_role':    return t('forbiddenRole')
    case 'global_forbidden':  return t('globalForbidden')
    case 'forbidden_branch':  return t('forbiddenBranch')
    case 'invalid_input':     return t('invalidInput')
    case 'not_found':         return t('notFound')
    default:                  return fallback
  }
}

type RpcResult<T extends object = object> = ({ ok: true } & T) | { ok: false; code: string }
function isRpcResult<T extends object>(v: unknown): v is RpcResult<T> {
  return typeof v === 'object' && v !== null && 'ok' in v
}

export async function upsertPromotion(input: PromotionInput): Promise<PromotionMutationResult> {
  const t = await getTranslations('promotions.errors')

  let user
  try {
    user = await requireDashboardSection('promotions')
  } catch (e) {
    return { error: isDashboardGuardError(e) ? e.message : t('forbidden') }
  }

  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first ? `${first.path.join('.')}: ${first.message}` : t('invalidInput') }
  }
  const data = parsed.data

  if (!PROMO_TYPES.includes(data.type)) return { error: t('invalidType') }
  const cfgError = validateConfigForType(data.type, data.config)
  if (cfgError) return { error: cfgError }

  // Atomic: rpc_create_promotion / rpc_update_promotion (migration 171)
  // re-check role + branch under SECURITY DEFINER, perform shape validation,
  // and write audit_logs in the same transaction. JS guards above stay as
  // pre-flight UX only.
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    branch_id: data.branch_id,
    name_ar:   data.name_ar.trim(),
    name_en:   data.name_en.trim(),
    type:      data.type,
    config:    data.config,
    starts_at: data.starts_at,
    ends_at:   data.ends_at,
    is_active: data.is_active,
    max_uses:  data.max_uses,
  }

  const { data: rpcRaw, error } = data.id
    ? await supabase.rpc('rpc_update_promotion', { p_id: data.id, p_payload: payload })
    : await supabase.rpc('rpc_create_promotion', { p_payload: payload })

  if (error) {
    Sentry.captureException(error, {
      tags:  { area: 'promotions', action: data.id ? 'updatePromotion' : 'createPromotion' },
      extra: { id: data.id, branchId: data.branch_id, role: user.role },
    })
    return { error: t('rpcFailed') }
  }

  const rpc = isRpcResult<{ id: string }>(rpcRaw) ? rpcRaw : null
  if (!rpc) {
    Sentry.captureException(new Error('rpc promotion unexpected payload'), {
      tags:  { area: 'promotions', action: data.id ? 'updatePromotion' : 'createPromotion' },
      extra: { payload: rpcRaw },
    })
    return { error: t('rpcFailed') }
  }
  if (!rpc.ok) {
    return { error: mapRpcCode(t, rpc.code, t('rpcFailed')) }
  }

  const locale = await getLocale()
  revalidatePath(`/${locale}/dashboard/promotions`)
  return { ok: true, id: rpc.id ?? data.id }
}

export async function togglePromotion(id: string, isActive: boolean): Promise<PromotionMutationResult> {
  const t = await getTranslations('promotions.errors')

  let user
  try {
    user = await requireDashboardSection('promotions')
  } catch (e) {
    return { error: isDashboardGuardError(e) ? e.message : t('forbidden') }
  }

  // Use the existing rpc_update_promotion: read the row first to preserve
  // all fields, flip is_active, send through. The RPC enforces branch scope
  // server-side so a non-admin can't escalate.
  const supabase = await createClient()
  const { data: existing, error: fetchErr } = await supabase
    .from('promotions')
    .select('branch_id, name_ar, name_en, type, config, starts_at, ends_at, max_uses')
    .eq('id', id)
    .single()

  if (fetchErr || !existing) {
    if (fetchErr) Sentry.captureException(fetchErr, { tags: { area: 'promotions', action: 'togglePromotion.fetch' } })
    return { error: t('notFound') }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    ...existing,
    is_active: isActive,
  }

  const { data: rpcRaw, error } = await supabase.rpc('rpc_update_promotion', {
    p_id:      id,
    p_payload: payload,
  })

  if (error) {
    Sentry.captureException(error, {
      tags:  { area: 'promotions', action: 'togglePromotion' },
      extra: { id, isActive, role: user.role },
    })
    return { error: t('rpcFailed') }
  }

  const rpc = isRpcResult<{ id: string }>(rpcRaw) ? rpcRaw : null
  if (!rpc) return { error: t('rpcFailed') }
  if (!rpc.ok) return { error: mapRpcCode(t, rpc.code, t('rpcFailed')) }

  const locale = await getLocale()
  revalidatePath(`/${locale}/dashboard/promotions`)
  return { ok: true, id }
}

export async function deletePromotion(id: string): Promise<PromotionMutationResult> {
  const t = await getTranslations('promotions.errors')

  let user
  try {
    user = await requireDashboardSection('promotions')
  } catch (e) {
    return { error: isDashboardGuardError(e) ? e.message : t('forbidden') }
  }

  const supabase = await createClient()
  const { data: rpcRaw, error } = await supabase.rpc('rpc_delete_promotion', { p_id: id })

  if (error) {
    Sentry.captureException(error, {
      tags:  { area: 'promotions', action: 'deletePromotion' },
      extra: { id, role: user.role },
    })
    return { error: t('rpcFailed') }
  }

  const rpc = isRpcResult(rpcRaw) ? rpcRaw : null
  if (!rpc) return { error: t('rpcFailed') }
  if (!rpc.ok) return { error: mapRpcCode(t, rpc.code, t('rpcFailed')) }

  const locale = await getLocale()
  revalidatePath(`/${locale}/dashboard/promotions`)
  return { ok: true, id }
}

// ── Per-type config validation ────────────────────────────────────────────────

function validateConfigForType(
  type:   PromotionType,
  config: Record<string, unknown>,
): string | null {
  switch (type) {
    case 'bogo': {
      if (typeof config.buy_slug !== 'string' || !config.buy_slug) return 'config.buy_slug required'
      if (typeof config.get_slug !== 'string' || !config.get_slug) return 'config.get_slug required'
      return null
    }
    case 'bundle': {
      if (!Array.isArray(config.items) || config.items.length < 2) return 'config.items: at least 2 slugs required'
      if (typeof config.price_bhd !== 'number' || config.price_bhd < 0) return 'config.price_bhd must be ≥ 0'
      return null
    }
    case 'time_discount': {
      if (typeof config.discount_pct !== 'number' || config.discount_pct <= 0 || config.discount_pct > 100) {
        return 'config.discount_pct must be between 0 and 100'
      }
      return null
    }
    case 'item_discount': {
      if (typeof config.slug !== 'string' || !config.slug) return 'config.slug required'
      if (typeof config.discount_pct !== 'number' || config.discount_pct <= 0 || config.discount_pct > 100) {
        return 'config.discount_pct must be between 0 and 100'
      }
      return null
    }
    case 'spend_discount': {
      if (typeof config.min_spend_bhd !== 'number' || config.min_spend_bhd < 0) return 'config.min_spend_bhd must be ≥ 0'
      if (typeof config.discount_pct !== 'number' || config.discount_pct <= 0 || config.discount_pct > 100) {
        return 'config.discount_pct must be between 0 and 100'
      }
      return null
    }
    default:
      return 'Unknown promotion type'
  }
}
