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

/** Legacy alias — used by account/page.tsx tier display */
export const TIER_THRESHOLDS_LEGACY = {
  bronze:   { minOrders: 0,  minSpent: 0   },
  silver:   { minOrders: 5,  minSpent: 50  },
  gold:     { minOrders: 15, minSpent: 200 },
  platinum: { minOrders: 30, minSpent: 500 },
} as const

/** @deprecated use TIER_THRESHOLDS_LEGACY for display, or lifetime points directly */
export const TIER_THRESHOLDS = TIER_THRESHOLDS_LEGACY

export type LoyaltyTier = keyof typeof TIER_THRESHOLDS_LEGACY

// ── Backward-compat exports (used by account/page.tsx) ───────────────────────

export function formatPoints(points: number): string {
  return points.toLocaleString('en-US')
}

export function getNextTier(tier: LoyaltyTier): LoyaltyTier | null {
  const order: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum']
  const idx = order.indexOf(tier)
  return idx < order.length - 1 ? order[idx + 1] : null
}

export function tierProgressToNext(
  totalOrders: number,
  totalSpentBHD: number,
  currentTier: LoyaltyTier,
): { byOrders: number; bySpend: number } | null {
  const next = getNextTier(currentTier)
  if (!next) return null
  const t = TIER_THRESHOLDS_LEGACY[next]
  return {
    byOrders: t.minOrders > 0 ? Math.min(totalOrders / t.minOrders, 1) : 1,
    bySpend:  t.minSpent  > 0 ? Math.min(totalSpentBHD / t.minSpent, 1) : 1,
  }
}

export const TIER_BENEFITS: Record<LoyaltyTier, { ar: string[]; en: string[] }> = {
  bronze: {
    en: ['10 points per 1 BD spent', 'Points valid for 12 months', 'Exclusive member discounts'],
    ar: ['10 نقاط لكل دينار', 'صالحة 12 شهراً', 'خصومات حصرية للأعضاء'],
  },
  silver: {
    en: ['10 points per 1 BD spent', 'Priority WhatsApp support', 'Birthday bonus: 50 points', 'Early access to seasonal specials'],
    ar: ['10 نقاط لكل دينار', 'دعم واتساب أولوية', 'هدية عيد ميلاد: 50 نقطة', 'وصول مبكر للعروض الموسمية'],
  },
  gold: {
    en: ['10 points per 1 BD spent', 'Priority support', 'Birthday bonus: 100 points', 'Exclusive gold member offers', 'Free upgrade on special occasions'],
    ar: ['10 نقاط لكل دينار', 'دعم أولوية', 'هدية عيد ميلاد: 100 نقطة', 'عروض حصرية للذهبيين', 'ترقية مجانية في المناسبات'],
  },
  platinum: {
    en: ['10 points per 1 BD spent', 'Dedicated account support', 'Birthday bonus: 200 points', 'Exclusive platinum offers', 'Early access to new menu items', 'Surprise gifts from the chef'],
    ar: ['10 نقاط لكل دينار', 'دعم شخصي مخصص', 'هدية عيد ميلاد: 200 نقطة', 'عروض حصرية للبلاتينيين', 'وصول مبكر للأصناف الجديدة', 'مفاجآت من الشيف'],
  },
}
