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
