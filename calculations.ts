// src/lib/loyalty/calculations.ts

export const POINTS_PER_BHD       = 10    // synced with DB trigger award_loyalty_points_on_completion
export const POINT_VALUE_BHD      = 0.005 // 1 point = 0.005 BHD = 5 fils  →  10 pts/BHD = 5% yield
export const MIN_REDEMPTION       = 200   // minimum points to redeem (= 1.000 BHD)
export const MAX_REDEMPTION_RATIO = 0.5   // cap: points discount ≤ 50% of order subtotal
export const POINTS_EXPIRY_MONTHS = 12

/** Points balance → BHD credit (3 decimal places) */
export function pointsToCredit(points: number): number {
  return parseFloat((points * POINT_VALUE_BHD).toFixed(3))
}

/** BHD amount → equivalent points */
export function bhdToPoints(bhd: number): number {
  return Math.floor(bhd / POINT_VALUE_BHD)
}

/** How many points a completed order earns (mirrors DB trigger logic) */
export function calcPointsEarned(totalBhd: number): number {
  return Math.floor(totalBhd * POINTS_PER_BHD)
}

/**
 * Maximum redeemable points for a given order subtotal.
 * Capped at 50% of order value to ensure partial payment.
 */
export function maxRedeemablePoints(balance: number, subtotalBhd: number): number {
  const cap = bhdToPoints(subtotalBhd * MAX_REDEMPTION_RATIO)
  return Math.min(balance, cap)
}

/** Tier thresholds (lifetime points) */
export const TIER_THRESHOLDS = {
  bronze:   0,
  silver:   500,
  gold:     2_000,
  platinum: 10_000,
} as const

export type LoyaltyTier = keyof typeof TIER_THRESHOLDS
