'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getLocale } from 'next-intl/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { requireDashboardSection, assertBranchScope, isDashboardGuardError } from '@/lib/auth/dashboard-guards'
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

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function upsertPromotion(input: PromotionInput): Promise<PromotionMutationResult> {
  let user
  try {
    user = await requireDashboardSection('promotions')
  } catch (e) {
    return { error: isDashboardGuardError(e) ? e.message : 'Forbidden' }
  }

  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first ? `${first.path.join('.')}: ${first.message}` : 'Invalid input' }
  }
  const data = parsed.data

  // branch_manager / marketing can only create/edit promotions for their own
  // branch (and never global promotions).
  const isGlobalAdmin = user.role === 'owner' || user.role === 'general_manager'
  if (!isGlobalAdmin) {
    if (data.branch_id == null) {
      return { error: 'Only owner/general_manager can create global promotions' }
    }
    try {
      assertBranchScope(user, data.branch_id)
    } catch {
      return { error: 'Forbidden: branch scope violation' }
    }
  }

  if (!PROMO_TYPES.includes(data.type)) return { error: 'Invalid promotion type' }
  const cfgError = validateConfigForType(data.type, data.config)
  if (cfgError) return { error: cfgError }

  const supabase = getServiceClient()
  if (!supabase) return { error: 'Configuration error' }

  const row = {
    branch_id: data.branch_id,
    name_ar:   data.name_ar.trim(),
    name_en:   data.name_en.trim(),
    type:      data.type,
    config:    data.config,
    starts_at: data.starts_at,
    ends_at:   data.ends_at,
    is_active: data.is_active,
    max_uses:  data.max_uses,
    created_by: user.id,
  }

  let resultId: string | null = null
  if (data.id) {
    const { error } = await supabase
      .from('promotions')
      .update(row)
      .eq('id', data.id)
    if (error) return { error: error.message }
    resultId = data.id
  } else {
    const { data: inserted, error } = await supabase
      .from('promotions')
      .insert(row)
      .select('id')
      .single()
    if (error || !inserted) return { error: error?.message ?? 'Insert failed' }
    resultId = (inserted as { id: string }).id
  }

  const locale = await getLocale()
  revalidatePath(`/${locale}/dashboard/promotions`)
  return { ok: true, id: resultId }
}

export async function togglePromotion(id: string, isActive: boolean): Promise<PromotionMutationResult> {
  try {
    await requireDashboardSection('promotions')
  } catch (e) {
    return { error: isDashboardGuardError(e) ? e.message : 'Forbidden' }
  }
  const supabase = getServiceClient()
  if (!supabase) return { error: 'Configuration error' }
  const { error } = await supabase
    .from('promotions')
    .update({ is_active: isActive })
    .eq('id', id)
  if (error) return { error: error.message }
  const locale = await getLocale()
  revalidatePath(`/${locale}/dashboard/promotions`)
  return { ok: true, id }
}

export async function deletePromotion(id: string): Promise<PromotionMutationResult> {
  try {
    await requireDashboardSection('promotions')
  } catch (e) {
    return { error: isDashboardGuardError(e) ? e.message : 'Forbidden' }
  }
  const supabase = getServiceClient()
  if (!supabase) return { error: 'Configuration error' }
  const { error } = await supabase.from('promotions').delete().eq('id', id)
  if (error) return { error: error.message }
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
