import type { LoyaltyTier } from '@/lib/supabase/custom-types'

export const POINTS_PER_BHD     = 5
export const POINT_VALUE_BHD    = 0.005   // 1 point = 0.005 BHD
export const MIN_REDEMPTION     = 200     // minimum points to redeem (= 1 BHD)
export const POINTS_EXPIRY_MONTHS = 12   // points expire after 12 months inactivity

export const TIER_THRESHOLDS = {
  bronze:   { minOrders: 0,  minSpent: 0   },
  silver:   { minOrders: 10, minSpent: 100 },
  gold:     { minOrders: 25, minSpent: 300 },
  platinum: { minOrders: 50, minSpent: 600 },
} as const satisfies Record<LoyaltyTier, { minOrders: number; minSpent: number }>

export function calculatePointsForOrder(totalBHD: number): number {
  return Math.floor(totalBHD * POINTS_PER_BHD)
}

export function calculateTier(totalOrders: number, totalSpentBHD: number): LoyaltyTier {
  if (totalOrders >= 50 || totalSpentBHD >= 600) return 'platinum'
  if (totalOrders >= 25 || totalSpentBHD >= 300) return 'gold'
  if (totalOrders >= 10 || totalSpentBHD >= 100) return 'silver'
  return 'bronze'
}

export function pointsToCredit(points: number): number {
  return parseFloat((points * POINT_VALUE_BHD).toFixed(3))
}

export function bhdToPoints(bhd: number): number {
  return Math.floor(bhd / POINT_VALUE_BHD)
}

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
  const t = TIER_THRESHOLDS[next]
  return {
    byOrders: t.minOrders > 0 ? Math.min(totalOrders / t.minOrders, 1) : 1,
    bySpend:  t.minSpent  > 0 ? Math.min(totalSpentBHD / t.minSpent, 1) : 1,
  }
}

export const TIER_BENEFITS: Record<LoyaltyTier, { ar: string[]; en: string[] }> = {
  bronze: {
    en: ['5 points per 1 BD spent', 'Points valid for 12 months', 'Exclusive member discounts'],
    ar: ['5 نقاط لكل دينار', 'صالحة 12 شهراً', 'خصومات حصرية للأعضاء'],
  },
  silver: {
    en: ['5 points per 1 BD spent', 'Priority WhatsApp support', 'Birthday bonus: 50 points', 'Early access to seasonal specials'],
    ar: ['5 نقاط لكل دينار', 'دعم واتساب أولوية', 'هدية عيد ميلاد: 50 نقطة', 'وصول مبكر للعروض الموسمية'],
  },
  gold: {
    en: ['5 points per 1 BD spent', 'Priority support', 'Birthday bonus: 100 points', 'Exclusive gold member offers', 'Free upgrade on special occasions'],
    ar: ['5 نقاط لكل دينار', 'دعم أولوية', 'هدية عيد ميلاد: 100 نقطة', 'عروض حصرية للذهبيين', 'ترقية مجانية في المناسبات'],
  },
  platinum: {
    en: ['5 points per 1 BD spent', 'Dedicated account support', 'Birthday bonus: 200 points', 'Exclusive platinum offers', 'Early access to new menu items', 'Surprise gifts from the chef'],
    ar: ['5 نقاط لكل دينار', 'دعم شخصي مخصص', 'هدية عيد ميلاد: 200 نقطة', 'عروض حصرية للبلاتينيين', 'وصول مبكر للأصناف الجديدة', 'مفاجآت من الشيف'],
  },
}
