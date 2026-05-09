// Promotion config schemas and runtime types.
// Mirrors the `promotion_type` ENUM in supabase/migrations/086_promotions.sql.

export type PromotionType =
  | 'bogo'
  | 'bundle'
  | 'time_discount'
  | 'item_discount'
  | 'spend_discount'

export interface BogoConfig {
  buy_slug: string
  get_slug: string
}

export interface BundleConfig {
  items:     string[]
  price_bhd: number
}

export interface TimeDiscountConfig {
  discount_pct: number
  /** 0=Sunday … 6=Saturday. Empty array = all days. */
  days?:        number[]
  /** "HH:MM" in branch local time. */
  start_time?:  string
  end_time?:    string
}

export interface ItemDiscountConfig {
  slug:         string
  discount_pct: number
}

export interface SpendDiscountConfig {
  min_spend_bhd: number
  discount_pct:  number
}

export type PromotionConfig =
  | { type: 'bogo';           config: BogoConfig }
  | { type: 'bundle';         config: BundleConfig }
  | { type: 'time_discount';  config: TimeDiscountConfig }
  | { type: 'item_discount';  config: ItemDiscountConfig }
  | { type: 'spend_discount'; config: SpendDiscountConfig }

/** Row shape used by the evaluator and the admin list. */
export interface PromotionRow {
  id:         string
  branch_id:  string | null
  name_ar:    string
  name_en:    string
  type:       PromotionType
  config:     Record<string, unknown>
  starts_at:  string | null
  ends_at:    string | null
  is_active:  boolean
  max_uses:   number | null
  use_count:  number
  created_at: string
}

/** Minimal cart line shape the evaluator consumes. */
export interface EvalCartLine {
  menu_item_slug: string
  quantity:       number
  unit_price_bhd: number
}

export interface PromotionApplied {
  promotion_id: string
  discount_bhd: number
  name_ar:      string
  name_en:      string
  type:         PromotionType
}

/** Status bucket used by the dashboard tabs. */
export type PromotionStatus = 'active' | 'scheduled' | 'expired' | 'inactive'

export function classifyPromotion(p: PromotionRow, now: Date): PromotionStatus {
  if (!p.is_active) return 'inactive'
  if (p.starts_at && new Date(p.starts_at) > now) return 'scheduled'
  if (p.ends_at   && new Date(p.ends_at)   < now) return 'expired'
  return 'active'
}
