import 'server-only'
import { createClient as createAnonClient } from '@/lib/supabase/server'
import {
  resolveCheckoutMenuItemPrice,
  type CheckoutPriceResult,
  type MenuPriceSelection,
} from '@/lib/menu'

/**
 * Prefetches live DB prices for the given menu_items slugs. Returns a
 * Map<slug, price_bhd>. Items not in the map (missing, unavailable, or
 * DB unreachable) will fall back to JSON pricing via resolveOrderItemPrice.
 *
 * Source of truth: menu_items.price_bhd is what the dashboard edits. menu.json
 * is a deploy-time snapshot and can drift. Reading from DB at order-creation
 * time guarantees price parity between dashboard edits and order totals.
 *
 * menu_items is publicly SELECTable via the public_read_menu_items RLS policy
 * (mig 075), so the anon client is sufficient — no service-role escalation
 * needed for a price read.
 */
export async function fetchCheckoutPriceMap(slugs: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (slugs.length === 0) return map
  try {
    const anon = await createAnonClient()
    const { data, error } = await anon
      .from('menu_items')
      .select('id, price_bhd')
      .in('id', Array.from(new Set(slugs)))
      .eq('is_available', true)
    if (error) {
      console.error('[checkout-pricing] menu_items prefetch failed:', error)
      return map
    }
    for (const row of data ?? []) {
      if (row.price_bhd != null) {
        map.set(row.id, Number(row.price_bhd))
      }
    }
  } catch (err) {
    console.error('[checkout-pricing] menu_items prefetch threw:', err)
  }
  return map
}

/**
 * Resolves a menu item price for order creation, preferring the live DB
 * `menu_items.price_bhd` over the JSON fixture for single-price items.
 *
 * Size/variant items keep JSON pricing — per-size/variant pricing hasn't
 * been migrated to DB yet. Logs a warning so the fallback is observable.
 *
 * dbPriceMap should be prefetched once per order via fetchCheckoutPriceMap —
 * one query per cart, not one per item.
 */
export function resolveOrderItemPrice(
  slug: string,
  selection: MenuPriceSelection,
  dbPriceMap: Map<string, number>,
): CheckoutPriceResult | { error: string } {
  const resolved = resolveCheckoutMenuItemPrice(slug, selection)
  if ('error' in resolved) return resolved

  const hasSizes    = Boolean(resolved.item.sizes && Object.keys(resolved.item.sizes).length > 0)
  const hasVariants = Boolean(resolved.item.variants && resolved.item.variants.length > 0)

  if (!hasSizes && !hasVariants) {
    const dbPrice = dbPriceMap.get(slug)
    if (typeof dbPrice === 'number' && dbPrice > 0) {
      return { ...resolved, unitPriceBhd: dbPrice }
    }
    return resolved
  }

  console.warn('[checkout-pricing] size/variant price from JSON:', slug)
  return resolved
}
