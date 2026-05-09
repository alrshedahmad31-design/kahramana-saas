// Server-side helper for order-creation actions.
// Fetches active promotions for a branch and runs the evaluator. Returns the
// best-discount applicable promotion, or null. Errors are swallowed and
// logged — promotion evaluation is best-effort and must NEVER block an order.

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { selectBestPromotion } from './evaluator'
import type { EvalCartLine, PromotionApplied, PromotionRow } from './types'

export async function resolveBestPromotion(
  branchId: string,
  cart:     EvalCartLine[],
): Promise<PromotionApplied | null> {
  if (cart.length === 0) return null

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null

  const supabase = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Pull active promotions for this branch + global. Window/cap/type checks
  // happen in the evaluator so we don't have to push them into PostgREST.
  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from('promotions')
    .select('id, branch_id, name_ar, name_en, type, config, starts_at, ends_at, is_active, max_uses, use_count, created_at')
    .eq('is_active', true)
    .or(`branch_id.is.null,branch_id.eq.${branchId}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)

  if (error || !data) {
    console.warn('[promotions] resolveBestPromotion fetch failed:', error?.message)
    return null
  }

  const rows = data as PromotionRow[]
  return selectBestPromotion(rows, cart, new Date(), branchId)
}
