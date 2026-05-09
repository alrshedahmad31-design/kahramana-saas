/**
 * Server-side loyalty config fetcher. Reads the active row from
 * `loyalty_config` (migration 084) with a 60-second cache so checkout flows
 * don't hammer the DB. Falls back to hardcoded defaults if the table is
 * empty or the read fails — keeps the redemption flow operational under
 * config-store outages.
 *
 * Client components should NOT call this directly; either receive the
 * config as a prop from a server component, or invoke a server action.
 */

import { unstable_cache } from 'next/cache'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export interface LoyaltyConfig {
  pointsPerBhd:           number
  maxRedemptionRatio:     number
  minRedemptionPoints:    number
  pointValueBhd:          number
  pointsExpiryMonths:     number
  tierSilverThreshold:    number
  tierGoldThreshold:      number
  tierPlatinumThreshold:  number
}

export const DEFAULT_LOYALTY_CONFIG: LoyaltyConfig = {
  pointsPerBhd:          10,
  maxRedemptionRatio:    0.5,
  minRedemptionPoints:   200,
  pointValueBhd:         0.005,
  pointsExpiryMonths:    12,
  tierSilverThreshold:   500,
  tierGoldThreshold:     1500,
  tierPlatinumThreshold: 5000,
}

interface DbRow {
  points_per_bhd:           number
  max_redemption_ratio:     number
  min_redemption_points:    number
  point_value_bhd:          number
  points_expiry_months:     number
  tier_silver_threshold:    number
  tier_gold_threshold:      number
  tier_platinum_threshold:  number
}

async function fetchLoyaltyConfig(): Promise<LoyaltyConfig> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return DEFAULT_LOYALTY_CONFIG

  const supabase = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase
    .from('loyalty_config')
    .select(
      'points_per_bhd, max_redemption_ratio, min_redemption_points, ' +
      'point_value_bhd, points_expiry_months, ' +
      'tier_silver_threshold, tier_gold_threshold, tier_platinum_threshold',
    )
    .is('branch_id', null)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    if (error) console.warn('[loyalty/config] fetch failed, using defaults:', error)
    return DEFAULT_LOYALTY_CONFIG
  }

  const row = data as unknown as DbRow
  return {
    pointsPerBhd:          Number(row.points_per_bhd),
    maxRedemptionRatio:    Number(row.max_redemption_ratio),
    minRedemptionPoints:   Number(row.min_redemption_points),
    pointValueBhd:         Number(row.point_value_bhd),
    pointsExpiryMonths:    Number(row.points_expiry_months),
    tierSilverThreshold:   Number(row.tier_silver_threshold),
    tierGoldThreshold:     Number(row.tier_gold_threshold),
    tierPlatinumThreshold: Number(row.tier_platinum_threshold),
  }
}

export const getLoyaltyConfig = unstable_cache(
  fetchLoyaltyConfig,
  ['loyalty-config-v1'],
  { revalidate: 60, tags: ['loyalty-config'] },
)

// ── Pure helpers parameterised by config (server or client) ──────────────────

export function pointsToCredit(points: number, cfg: LoyaltyConfig): number {
  return parseFloat((points * cfg.pointValueBhd).toFixed(3))
}

export function bhdToPointsFromCfg(bhd: number, cfg: LoyaltyConfig): number {
  return Math.floor(bhd / cfg.pointValueBhd)
}

export function calcPointsEarnedFromCfg(totalBhd: number, cfg: LoyaltyConfig): number {
  return Math.floor(totalBhd * cfg.pointsPerBhd)
}

export function maxRedeemablePointsFromCfg(
  balance: number,
  subtotalBhd: number,
  cfg: LoyaltyConfig,
): number {
  const cap = bhdToPointsFromCfg(subtotalBhd * cfg.maxRedemptionRatio, cfg)
  return Math.min(balance, cap)
}
