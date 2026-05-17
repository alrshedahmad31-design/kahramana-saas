'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getLocale, getTranslations } from 'next-intl/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { fetchCheckoutPriceMap, resolveOrderItemPrice } from '@/lib/checkout-pricing.server'
import { WAITER_PLACEHOLDER_PHONE } from '@/constants/contact'
import { resolveBestPromotion } from '@/lib/promotions/server'
import type { LoyaltyTier } from '@/lib/loyalty/calculations'
import type { StaffRole } from '@/lib/supabase/custom-types'

const WAITER_ROLES: readonly StaffRole[] = [
  'owner',
  'general_manager',
  'branch_manager',
  'cashier',
  'waiter',
] as const

const modifierSchema = z.object({
  group_id:       z.string().uuid(),
  group_name_ar:  z.string().max(120),
  group_name_en:  z.string().max(120),
  option_id:      z.string().uuid(),
  option_name_ar: z.string().max(120),
  option_name_en: z.string().max(120),
  price_modifier: z.number().min(-1000).max(1000),
})

const itemSchema = z.object({
  menuItemId:    z.string().min(1).max(120),
  quantity:      z.number().int().min(1).max(50),
  variantName:   z.string().max(80).nullable().optional(),
  sizeName:      z.string().max(40).nullable().optional(),
  unitPriceBhd:  z.number().min(0).max(10_000),
  itemNotes:     z.string().max(200).nullable().optional(),
  modifiers:     z.array(modifierSchema).max(20).optional(),
})

const payloadSchema = z.object({
  branchId:       z.string().min(1).max(50),
  tableNumber:    z.number().int().min(1).max(999),
  items:          z.array(itemSchema).min(1).max(60),
  notes:          z.string().max(500).nullable().optional(),
  // Required: client owns the idempotency key so retries against the same
  // attempt return the same order_id (rpc_create_order does idempotency lookup).
  idempotencyKey: z.string().uuid(),
})

export type WaiterOrderPayload = z.infer<typeof payloadSchema>

export interface CreateWaiterOrderResult {
  orderId?: string
  error?:   string
  /** Order committed but a non-blocking record (payment, audit) failed. */
  warning?: string
}

export async function createWaiterOrder(
  payload: WaiterOrderPayload,
): Promise<CreateWaiterOrderResult> {
  const caller = await getSession()
  if (!caller || !caller.role || !WAITER_ROLES.includes(caller.role)) {
    return { error: 'Unauthorized' }
  }

  const parsed = payloadSchema.safeParse(payload)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first ? `${first.path.join('.')}: ${first.message}` : 'Invalid payload' }
  }
  const data = parsed.data

  // Fail-closed: a scoped role missing branch_id is REJECTED (not bypassed) —
  // NULL branch_id on a scoped account is a data integrity hole, not a wildcard.
  // Mirrors pos/actions.ts (8f956ed).
  if (
    caller.role === 'branch_manager' || caller.role === 'cashier' || caller.role === 'waiter'
  ) {
    if (!caller.branch_id || caller.branch_id !== data.branchId) {
      return { error: 'Forbidden: branch scope violation' }
    }
  }

  // Single untyped service-role client for the whole transaction.
  // restaurant_tables (085) and rpc_create_order's new params (085+086) aren't
  // in the regenerated Database types yet — POS uses the same pattern for 082.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return { error: 'Configuration error' }
  const supabase: SupabaseClient = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Validate table exists and is active for this branch.
  type TableRow = { id: string; is_active: boolean }
  const { data: tableRows, error: tableError } = await supabase
    .from('restaurant_tables')
    .select('id, is_active')
    .eq('branch_id', data.branchId)
    .eq('table_number', data.tableNumber)
    .limit(1)

  if (tableError) return { error: 'Table validation failed' }
  const rows = (tableRows ?? []) as TableRow[]
  if (rows.length === 0) return { error: 'Table not found' }
  if (!rows[0].is_active) return { error: 'Table is inactive' }

  // Validate modifiers (against menu_options) — same pattern as POS.
  type ModifierSnapshot = z.infer<typeof modifierSchema>
  const allOptionIds = Array.from(new Set(
    data.items.flatMap((i) => (i.modifiers ?? []).map((m) => m.option_id)),
  ))
  const modifierPriceById = new Map<string, number>()
  if (allOptionIds.length > 0) {
    const { data: dbOpts, error } = await supabase
      .from('menu_options')
      .select('id, price_modifier, is_available')
      .in('id', allOptionIds)
    if (error) return { error: 'Failed to validate modifiers' }
    type DbOpt = { id: string; price_modifier: number; is_available: boolean }
    for (const o of (dbOpts ?? []) as DbOpt[]) {
      if (!o.is_available) return { error: 'Selected modifier is unavailable' }
      modifierPriceById.set(o.id, Number(o.price_modifier))
    }
    for (const id of allOptionIds) {
      if (!modifierPriceById.has(id)) return { error: 'Unknown modifier' }
    }
  }

  // Server-side price resolution.
  type PricedItem = {
    menu_item_slug:   string
    name_ar:          string
    name_en:          string
    selected_size:    string | null
    selected_variant: string | null
    quantity:         number
    notes:            string | null
    unit_price_bhd:   number
    item_total_bhd:   number
    modifiers:        ModifierSnapshot[]
  }

  // Prefetch live DB prices once for the whole cart (anon client / RLS 075).
  const dbPriceMap = await fetchCheckoutPriceMap(data.items.map((i) => i.menuItemId))

  const pricedItems: PricedItem[] = []
  for (const item of data.items) {
    const resolved = resolveOrderItemPrice(
      item.menuItemId,
      {
        size:    item.sizeName?.trim() || undefined,
        variant: item.variantName?.trim() || undefined,
      },
      dbPriceMap,
    )
    if ('error' in resolved) return { error: resolved.error }

    const validatedModifiers: ModifierSnapshot[] = (item.modifiers ?? []).map((m) => ({
      ...m,
      price_modifier: modifierPriceById.get(m.option_id) ?? 0,
    }))
    const modifierTotal = validatedModifiers.reduce((s, m) => s + m.price_modifier, 0)
    const base = Number(resolved.unitPriceBhd)
    const unit = Number((base + modifierTotal).toFixed(3))
    pricedItems.push({
      menu_item_slug:   resolved.item.slug,
      name_ar:          resolved.item.name.ar,
      name_en:          resolved.item.name.en,
      selected_size:    item.sizeName?.trim() || null,
      selected_variant: resolved.selectedVariant,
      quantity:         item.quantity,
      notes:            item.itemNotes?.trim() || null,
      unit_price_bhd:   unit,
      item_total_bhd:   Number((unit * item.quantity).toFixed(3)),
      modifiers:        validatedModifiers,
    })
  }

  const subtotal = Number(
    pricedItems.reduce((s, i) => s + i.item_total_bhd, 0).toFixed(3),
  )
  if (subtotal < 0.001) return { error: 'Order subtotal is zero' }

  const combinedNotes = data.notes?.trim()
    ? `[Waiter] Table ${data.tableNumber} — ${data.notes.trim()}`
    : `[Waiter] Table ${data.tableNumber}`

  // Best-effort promotion match — never blocks order creation.
  const promo = await resolveBestPromotion(
    data.branchId,
    pricedItems.map((p) => ({
      menu_item_slug: p.menu_item_slug,
      quantity:       p.quantity,
      unit_price_bhd: p.unit_price_bhd,
    })),
  )

  const { data: orderId, error: rpcError } = await supabase.rpc('rpc_create_order', {
    p_idempotency_key:        data.idempotencyKey,
    p_customer_name:          `Table ${data.tableNumber}`,
    p_customer_phone:         WAITER_PLACEHOLDER_PHONE,
    p_branch_id:              data.branchId,
    p_order_type:             'dine_in',
    p_items:                  pricedItems,
    p_total_bhd:              subtotal,
    p_notes:                  combinedNotes,
    p_source:                 'waiter',
    p_payment_method:         'cash',
    p_table_number:           data.tableNumber,
    p_promotion_id:           promo?.promotion_id ?? null,
    p_promotion_discount_bhd: promo?.discount_bhd ?? 0,
    p_payment_mode:           'cod',
  })

  if (rpcError || !orderId) {
    // Preserve the Postgres detail (sentinel codes, constraint names) in
    // server logs for Sentry / ops; the waiter only needs a localized,
    // generic surface message.
    console.error('[waiter] rpc_create_order failed', rpcError)
    const tErr = await getTranslations('waiter.errors')
    return { error: tErr('orderCreationFailed') }
  }

  const { error: auditError } = await supabase.from('audit_logs').insert({
    table_name: 'orders',
    action:     'INSERT',
    user_id:    caller.id,
    record_id:  orderId as string,
    actor_role: caller.role,
    branch_id:  data.branchId,
    changes: {
      action:        'waiter_order_created',
      table_number:  data.tableNumber,
      total_bhd:     subtotal,
      item_count:    pricedItems.length,
    },
  })
  if (auditError) {
    console.error('[waiter] audit_logs insert failed for order', orderId, auditError)
  }

  const locale = await getLocale()
  revalidatePath(`/${locale}/waiter`)
  revalidatePath(`/${locale}/waiter/table/${data.tableNumber}`)
  revalidatePath(`/${locale}/waiter/orders`)
  revalidatePath(`/${locale}/dashboard/kds`)

  return { orderId: orderId as string }
}

// ── QR member lookup (feature-flagged via NEXT_PUBLIC_ENABLE_QR_LOYALTY_SCAN) ──
//
// Waiter scans the customer's membership QR (generated by MembershipCard.tsx as
// `KAHRAMANA:KAH-XXXXXX` where XXXXXX = first 6 hex chars of the user UUID,
// upper-cased). Migration 162 added `customer_profiles.membership_id` as a
// STORED generated column with the same formula plus a UNIQUE index, so the
// lookup is now an equality match — no prefix scan, no collision risk.
//
// Migration 162 also added a SELECT-only RLS policy
// (`waiter_cashier_read_customer_profiles`) that lets waiter/cashier read
// customer_profiles, so this action uses the RLS-aware `createClient()` and
// relies on the policy + the WAITER_ROLES app-layer check together. The
// existing `staff_read_customer_profiles` policy (FOR ALL, owner/GM/BM/
// marketing only — migration 008) still gates write paths.

const QR_LOOKUP_ROLES: readonly StaffRole[] = [
  'owner',
  'general_manager',
  'branch_manager',
  'cashier',
  'waiter',
] as const

const QR_LOOKUP_PAYLOAD_MAX_LEN = 64
const QR_LOOKUP_PATTERN = /^(?:KAHRAMANA:)?KAH-([0-9A-Fa-f]{6})$/

let qrLookupRatelimit: Ratelimit | null = null
function getQrLookupRatelimit(): Ratelimit | null {
  if (qrLookupRatelimit) return qrLookupRatelimit
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  qrLookupRatelimit = new Ratelimit({
    redis:   Redis.fromEnv(),
    limiter: Ratelimit.fixedWindow(30, '60 s'),
    prefix:  'waiter_qr_lookup',
  })
  return qrLookupRatelimit
}

export interface MemberLookupRow {
  customer_id:    string
  name:           string | null
  tier:           LoyaltyTier
  points_balance: number
}

export type MemberLookupResult =
  | { ok: true;  member: MemberLookupRow }
  | { ok: false; code: 'unauthorized' | 'rate_limited' | 'invalid_format' | 'not_found' | 'lookup_failed' }

export async function lookupMemberByQR(membershipId: string): Promise<MemberLookupResult> {
  const caller = await getSession()
  if (!caller || !caller.role || !QR_LOOKUP_ROLES.includes(caller.role)) {
    return { ok: false, code: 'unauthorized' }
  }

  // Bound input length before regex to keep ReDoS surface trivial.
  if (typeof membershipId !== 'string' || membershipId.length > QR_LOOKUP_PAYLOAD_MAX_LEN) {
    return { ok: false, code: 'invalid_format' }
  }
  const match = membershipId.trim().match(QR_LOOKUP_PATTERN)
  if (!match) return { ok: false, code: 'invalid_format' }
  // Generated column stores upper-cased form: 'KAH-' || UPPER(substring(id::text, 1, 6)).
  const target = `KAH-${match[1].toUpperCase()}`

  // 30 lookups/min per staff caller — Upstash Redis (production only; dev
  // shares 127.0.0.1 and the budget collapses across reloaders).
  if (process.env.NODE_ENV === 'production') {
    const rl = getQrLookupRatelimit()
    if (rl) {
      const { success } = await rl.limit(caller.id)
      if (!success) return { ok: false, code: 'rate_limited' }
    }
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('customer_profiles')
    .select('id, name, loyalty_tier, points_balance')
    .eq('membership_id', target)
    .maybeSingle()

  if (error) {
    console.error('[waiter] lookupMemberByQR failed:', error)
    return { ok: false, code: 'lookup_failed' }
  }
  if (!data) return { ok: false, code: 'not_found' }

  return {
    ok: true,
    member: {
      customer_id:    data.id,
      name:           data.name,
      tier:           data.loyalty_tier,
      // points_balance is NUMERIC → PostgREST returns string; coerce defensively.
      points_balance: Number(data.points_balance),
    },
  }
}

