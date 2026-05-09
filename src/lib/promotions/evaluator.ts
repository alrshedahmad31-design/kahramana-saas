// Pure promotion evaluator — no I/O, framework-agnostic, easy to unit-test.
// Used by every order-creation server action (checkout, POS, waiter, QR).
//
// Contract:
//   const promos = <fetched server-side>
//   const best   = selectBestPromotion(promos, cart, now, branchId)
//   if (best) pass best.promotion_id + best.discount_bhd to rpc_create_order

import type {
  PromotionRow,
  EvalCartLine,
  PromotionApplied,
  BogoConfig,
  BundleConfig,
  TimeDiscountConfig,
  ItemDiscountConfig,
  SpendDiscountConfig,
} from './types'

interface EvalOk {
  applies:      true
  discount_bhd: number
}
interface EvalSkip {
  applies: false
}
type EvalResult = EvalOk | EvalSkip

const SKIP: EvalSkip = { applies: false }

function cartSubtotal(cart: EvalCartLine[]): number {
  return cart.reduce((s, l) => s + l.unit_price_bhd * l.quantity, 0)
}

function isWithinWindow(promo: PromotionRow, now: Date): boolean {
  if (promo.starts_at && new Date(promo.starts_at).getTime() > now.getTime()) return false
  if (promo.ends_at   && new Date(promo.ends_at).getTime()   < now.getTime()) return false
  return true
}

function evalBogo(cfg: BogoConfig, cart: EvalCartLine[]): EvalResult {
  if (!cfg.buy_slug || !cfg.get_slug) return SKIP
  const buyLines = cart.filter((l) => l.menu_item_slug === cfg.buy_slug)
  const getLines = cart.filter((l) => l.menu_item_slug === cfg.get_slug)
  if (buyLines.length === 0 || getLines.length === 0) return SKIP
  const buyQty = buyLines.reduce((s, l) => s + l.quantity, 0)
  const getQty = getLines.reduce((s, l) => s + l.quantity, 0)
  // Same-slug BOGO: half the matched lines are free (need ≥2).
  if (cfg.buy_slug === cfg.get_slug) {
    const freeQty = Math.floor(buyQty / 2)
    if (freeQty < 1) return SKIP
    const cheapest = Math.min(...getLines.map((l) => l.unit_price_bhd))
    return { applies: true, discount_bhd: round3(cheapest * freeQty) }
  }
  // Cross-slug BOGO: free quantity = min(buyQty, getQty).
  const freeQty = Math.min(buyQty, getQty)
  if (freeQty < 1) return SKIP
  const cheapest = Math.min(...getLines.map((l) => l.unit_price_bhd))
  return { applies: true, discount_bhd: round3(cheapest * freeQty) }
}

function evalBundle(cfg: BundleConfig, cart: EvalCartLine[]): EvalResult {
  if (!cfg.items || cfg.items.length === 0 || cfg.price_bhd < 0) return SKIP
  // Every item in the bundle must appear ≥1 time in the cart.
  const cheapestUnit = new Map<string, number>()
  for (const slug of cfg.items) {
    const lines = cart.filter((l) => l.menu_item_slug === slug)
    if (lines.length === 0) return SKIP
    cheapestUnit.set(slug, Math.min(...lines.map((l) => l.unit_price_bhd)))
  }
  const sumIfBoughtSeparately = Array.from(cheapestUnit.values()).reduce((s, p) => s + p, 0)
  const discount = sumIfBoughtSeparately - cfg.price_bhd
  if (discount <= 0) return SKIP
  return { applies: true, discount_bhd: round3(discount) }
}

function evalTimeDiscount(cfg: TimeDiscountConfig, cart: EvalCartLine[], now: Date): EvalResult {
  if (cfg.discount_pct <= 0 || cfg.discount_pct > 100) return SKIP
  const days = cfg.days
  if (Array.isArray(days) && days.length > 0 && !days.includes(now.getDay())) return SKIP
  if (cfg.start_time || cfg.end_time) {
    const minutesNow = now.getHours() * 60 + now.getMinutes()
    const start = cfg.start_time ? toMinutes(cfg.start_time) : 0
    const end   = cfg.end_time   ? toMinutes(cfg.end_time)   : 24 * 60
    // Overnight window allowed (e.g. 22:00–02:00) → start>end inverts logic.
    const inWindow = start <= end
      ? (minutesNow >= start && minutesNow <= end)
      : (minutesNow >= start || minutesNow <= end)
    if (!inWindow) return SKIP
  }
  const subtotal = cartSubtotal(cart)
  const discount = subtotal * (cfg.discount_pct / 100)
  if (discount <= 0) return SKIP
  return { applies: true, discount_bhd: round3(discount) }
}

function evalItemDiscount(cfg: ItemDiscountConfig, cart: EvalCartLine[]): EvalResult {
  if (!cfg.slug || cfg.discount_pct <= 0 || cfg.discount_pct > 100) return SKIP
  const matched = cart.filter((l) => l.menu_item_slug === cfg.slug)
  if (matched.length === 0) return SKIP
  const matchedTotal = matched.reduce((s, l) => s + l.unit_price_bhd * l.quantity, 0)
  const discount = matchedTotal * (cfg.discount_pct / 100)
  if (discount <= 0) return SKIP
  return { applies: true, discount_bhd: round3(discount) }
}

function evalSpendDiscount(cfg: SpendDiscountConfig, cart: EvalCartLine[]): EvalResult {
  if (cfg.discount_pct <= 0 || cfg.discount_pct > 100) return SKIP
  if (cfg.min_spend_bhd < 0) return SKIP
  const subtotal = cartSubtotal(cart)
  if (subtotal < cfg.min_spend_bhd) return SKIP
  const discount = subtotal * (cfg.discount_pct / 100)
  if (discount <= 0) return SKIP
  return { applies: true, discount_bhd: round3(discount) }
}

export function evaluatePromotion(
  promo: PromotionRow,
  cart:  EvalCartLine[],
  now:   Date,
): EvalResult {
  if (!promo.is_active) return SKIP
  if (promo.max_uses != null && promo.use_count >= promo.max_uses) return SKIP
  if (!isWithinWindow(promo, now)) return SKIP
  if (cart.length === 0) return SKIP

  const cfg = promo.config as Record<string, unknown>
  switch (promo.type) {
    case 'bogo':           return evalBogo(cfg as unknown as BogoConfig, cart)
    case 'bundle':         return evalBundle(cfg as unknown as BundleConfig, cart)
    case 'time_discount':  return evalTimeDiscount(cfg as unknown as TimeDiscountConfig, cart, now)
    case 'item_discount':  return evalItemDiscount(cfg as unknown as ItemDiscountConfig, cart)
    case 'spend_discount': return evalSpendDiscount(cfg as unknown as SpendDiscountConfig, cart)
    default:               return SKIP
  }
}

/**
 * Pick the single best-discount promotion that applies to this cart.
 * Branch filter: NULL branch_id means global; otherwise must equal `branchId`.
 * Stacking with coupons + loyalty is handled at the RPC level (each subtracts
 * independently from the subtotal, capped server-side).
 */
export function selectBestPromotion(
  promos:    PromotionRow[],
  cart:      EvalCartLine[],
  now:       Date,
  branchId:  string,
): PromotionApplied | null {
  let best: { promo: PromotionRow; discount: number } | null = null
  for (const p of promos) {
    if (p.branch_id != null && p.branch_id !== branchId) continue
    const r = evaluatePromotion(p, cart, now)
    if (!r.applies) continue
    if (!best || r.discount_bhd > best.discount) {
      best = { promo: p, discount: r.discount_bhd }
    }
  }
  if (!best) return null
  return {
    promotion_id: best.promo.id,
    discount_bhd: best.discount,
    name_ar:      best.promo.name_ar,
    name_en:      best.promo.name_en,
    type:         best.promo.type,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((s) => parseInt(s, 10))
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

function round3(n: number): number {
  return Number(n.toFixed(3))
}
