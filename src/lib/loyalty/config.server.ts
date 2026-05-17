import 'server-only'

import { unstable_cache } from 'next/cache'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_LOYALTY_CONFIG,
  type LoyaltyConfig,
} from './types'

interface DbRow {
  points_per_bhd:           number
  max_redemption_ratio:     number
  min_redemption_points:    number
  point_value_bhd:          number
  points_expiry_months:     number
  tier_silver_threshold:    number
  tier_gold_threshold:      number
  tier_platinum_threshold:  number
  birthday_bonus_points:    number
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
      'tier_silver_threshold, tier_gold_threshold, tier_platinum_threshold, ' +
      'birthday_bonus_points',
    )
    .is('branch_id', null)
    .eq('is_active', true)
    .limit(1)
    .returns<DbRow[]>()
    .maybeSingle()

  if (error || !data) {
    if (error) console.warn('[loyalty/config] fetch failed, using defaults:', error)
    return DEFAULT_LOYALTY_CONFIG
  }

  const row = data
  return {
    pointsPerBhd:          Number(row.points_per_bhd),
    maxRedemptionRatio:    Number(row.max_redemption_ratio),
    minRedemptionPoints:   Number(row.min_redemption_points),
    pointValueBhd:         Number(row.point_value_bhd),
    pointsExpiryMonths:    Number(row.points_expiry_months),
    tierSilverThreshold:   Number(row.tier_silver_threshold),
    tierGoldThreshold:     Number(row.tier_gold_threshold),
    tierPlatinumThreshold: Number(row.tier_platinum_threshold),
    birthdayBonusPoints:   Number(row.birthday_bonus_points),
  }
}

export const getLoyaltyConfig = unstable_cache(
  fetchLoyaltyConfig,
  ['loyalty-config-v2'],
  { revalidate: 60, tags: ['loyalty-config'] },
)
