'use server'

import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import {
  getDashboardGuardErrorMessage,
  requireDashboardSection,
} from '@/lib/auth/dashboard-guards'
import type { StaffRole } from '@/lib/supabase/custom-types'
import {
  getLoyaltyConfig,
  type LoyaltyConfig,
} from '@/lib/loyalty/config'

const ALLOWED_ROLES: readonly StaffRole[] = ['owner', 'general_manager']

const inputSchema = z.object({
  pointsPerBhd:           z.number().int().min(1).max(1000),
  maxRedemptionRatio:     z.number().min(0).max(1),
  minRedemptionPoints:    z.number().int().min(0).max(100_000),
  pointValueBhd:          z.number().min(0.0001).max(10),
  pointsExpiryMonths:     z.number().int().min(1).max(120),
  tierSilverThreshold:    z.number().int().min(0).max(1_000_000),
  tierGoldThreshold:      z.number().int().min(0).max(1_000_000),
  tierPlatinumThreshold:  z.number().int().min(0).max(1_000_000),
})

export async function getLoyaltyConfigForEditor(): Promise<LoyaltyConfig> {
  return getLoyaltyConfig()
}

export async function updateLoyaltyConfig(
  input: unknown,
): Promise<{ success: boolean; error?: string }> {
  let caller
  try {
    caller = await requireDashboardSection('settings')
  } catch (err) {
    return { success: false, error: getDashboardGuardErrorMessage(err) }
  }
  if (!ALLOWED_ROLES.includes(caller.role as StaffRole)) {
    return { success: false, error: 'Forbidden: only owners or general managers can edit loyalty config' }
  }

  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { success: false, error: first ? `${first.path.join('.')}: ${first.message}` : 'Invalid input' }
  }

  // Tier thresholds must be strictly increasing for the UI tiering to make sense.
  const t = await getTranslations('loyalty.errors')
  if (parsed.data.tierSilverThreshold >= parsed.data.tierGoldThreshold) {
    return { success: false, error: t('goldMustExceedSilver') }
  }
  if (parsed.data.tierGoldThreshold >= parsed.data.tierPlatinumThreshold) {
    return { success: false, error: t('platinumMustExceedGold') }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return { success: false, error: 'Configuration error' }

  const supabase = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const row = {
    points_per_bhd:          parsed.data.pointsPerBhd,
    max_redemption_ratio:    parsed.data.maxRedemptionRatio,
    min_redemption_points:   parsed.data.minRedemptionPoints,
    point_value_bhd:         parsed.data.pointValueBhd,
    points_expiry_months:    parsed.data.pointsExpiryMonths,
    tier_silver_threshold:   parsed.data.tierSilverThreshold,
    tier_gold_threshold:     parsed.data.tierGoldThreshold,
    tier_platinum_threshold: parsed.data.tierPlatinumThreshold,
    is_active:               true,
    updated_at:              new Date().toISOString(),
  }

  // Upsert the global active config row (branch_id IS NULL). We capture the
  // pre-image first so the audit_logs row carries before/after — owners
  // change point ratios and redemption caps here, and silent regressions
  // (e.g. minRedemptionPoints drop) need to be traceable to a user (P0-9).
  const { data: existing } = await supabase
    .from('loyalty_config')
    .select('*')
    .is('branch_id', null)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  const previous = existing as Record<string, unknown> | null
  const existingId = (previous?.id as string | undefined) ?? null
  const result = existingId
    ? await supabase.from('loyalty_config').update(row).eq('id', existingId)
    : await supabase.from('loyalty_config').insert({ ...row, branch_id: null })

  if (result.error) {
    console.error('[loyalty/config] update failed:', result.error)
    return { success: false, error: result.error.message }
  }

  // Audit trail — service-role client bypasses RLS but audit_logs has a CHECK
  // on action; user_id captures the caller from the section guard above.
  await supabase.from('audit_logs').insert({
    table_name: 'loyalty_config',
    action:     existingId ? 'UPDATE' : 'INSERT',
    user_id:    caller.id,
    record_id:  existingId,
    changes: {
      previous: previous
        ? {
            points_per_bhd:          previous.points_per_bhd,
            max_redemption_ratio:    previous.max_redemption_ratio,
            min_redemption_points:   previous.min_redemption_points,
            point_value_bhd:         previous.point_value_bhd,
            points_expiry_months:    previous.points_expiry_months,
            tier_silver_threshold:   previous.tier_silver_threshold,
            tier_gold_threshold:     previous.tier_gold_threshold,
            tier_platinum_threshold: previous.tier_platinum_threshold,
          }
        : null,
      next: row,
    },
    branch_id:  caller.branch_id,
    actor_role: caller.role,
  })

  // Invalidate the unstable_cache wrapping getLoyaltyConfig.
  revalidateTag('loyalty-config')

  return { success: true }
}
