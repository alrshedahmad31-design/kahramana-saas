'use server'

import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { getLocale, getTranslations } from 'next-intl/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { fetchCheckoutPriceMap, resolveOrderItemPrice } from '@/lib/checkout-pricing.server'
import { isHiddenBranch, BRANCHES, type BranchId } from '@/constants/contact'
import { resolveBestPromotion } from '@/lib/promotions/server'
import type { StaffRole } from '@/lib/supabase/custom-types'

const POS_ROLES: readonly StaffRole[] = [
  'owner',
  'general_manager',
  'branch_manager',
  'cashier',
] as const

const ORDER_TYPES = ['dine_in', 'pickup', 'delivery', 'phone'] as const
const PAYMENT_METHODS = ['cash', 'card', 'tap'] as const

const BAHRAIN_PHONE_RE = /^(\+?973)?[36]\d{7}$/

function normalizePhone(raw: string): string {
  const s = raw.replace(/[\s\-().]/g, '')
  if (s.startsWith('00973')) return '+973' + s.slice(5)
  if (s.startsWith('+973')) return s
  if (s.startsWith('973') && s.length === 11) return '+' + s
  if (/^\d{8}$/.test(s)) return '+973' + s
  return s
}

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

const addressSchema = z.object({
  city:     z.string().max(80).nullable().optional(),
  block:    z.string().max(80).nullable().optional(),
  road:     z.string().max(120).nullable().optional(),
  building: z.string().max(80).nullable().optional(),
  flat:     z.string().max(40).nullable().optional(),
})

const payloadSchema = z.object({
  branchId:        z.string().min(1).max(50),
  orderType:       z.enum(ORDER_TYPES),
  customerName:    z.string().min(1).max(120),
  customerPhone:   z.string().min(6).max(20),
  items:           z.array(itemSchema).min(1).max(60),
  notes:           z.string().max(500).nullable().optional(),
  paymentMethod:   z.enum(PAYMENT_METHODS),
  deliveryAddress: addressSchema.nullable().optional(),
  deliveryLat:     z.number().min(-90).max(90).nullable().optional(),
  deliveryLng:     z.number().min(-180).max(180).nullable().optional(),
  // Optional client-supplied idempotency key: required for offline-queued
  // orders so flush retries return the same order_id instead of duplicating.
  idempotencyKey:  z.string().uuid().optional(),
})

export type ManualOrderPayload = z.infer<typeof payloadSchema>

export interface CreateManualOrderResult {
  orderId?: string
  error?:   string
  /** Order committed but a non-blocking record (payment, audit) failed. */
  warning?: string
}

function isBranchId(value: string): value is BranchId {
  return value in BRANCHES
}

export async function createManualOrder(
  payload: ManualOrderPayload,
): Promise<CreateManualOrderResult> {
  const t = await getTranslations('pos.errors')

  const caller = await getSession()
  if (!caller || !caller.role || !POS_ROLES.includes(caller.role)) {
    return { error: t('unauthorized') }
  }

  const parsed = payloadSchema.safeParse(payload)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first ? `${first.path.join('.')}: ${first.message}` : t('invalidPayload') }
  }

  const data = parsed.data
  const normalizedPhone = normalizePhone(data.customerPhone)
  if (!BAHRAIN_PHONE_RE.test(normalizedPhone.replace(/\s+/g, ''))) {
    return { error: t('invalidPhone') }
  }

  if (!isBranchId(data.branchId) || isHiddenBranch(data.branchId)) {
    return { error: t('invalidBranch') }
  }

  // Branch managers and cashiers may only create orders for their own branch.
  // Fail-closed: a caller missing branch_id is REJECTED (not bypassed) — a
  // NULL branch_id on a scoped role is a data integrity hole, not a wildcard.
  if (
    caller.role === 'branch_manager' || caller.role === 'cashier'
  ) {
    if (!caller.branch_id || caller.branch_id !== data.branchId) {
      return { error: t('branchScopeViolation') }
    }
  }

  if (data.orderType === 'delivery') {
    const addr = data.deliveryAddress
    if (
      !addr || !addr.block?.trim() || !addr.road?.trim() || !addr.building?.trim()
    ) {
      return { error: t('deliveryAddressIncomplete') }
    }
  }

  // ── Modifier price validation (against menu_options table) ─────────────────
  type ModifierSnapshot = z.infer<typeof modifierSchema>
  const allOptionIds = Array.from(new Set(
    data.items.flatMap((i) => (i.modifiers ?? []).map((m) => m.option_id)),
  ))
  const modifierPriceById = new Map<string, number>()
  if (allOptionIds.length > 0) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return { error: t('configError') }
    const untyped = createSupabaseClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: dbOpts, error } = await untyped
      .from('menu_options')
      .select('id, price_modifier, is_available')
      .in('id', allOptionIds)
    if (error) {
      Sentry.captureException(error, {
        tags:  { area: 'pos', action: 'createManualOrder.modifierValidate' },
        extra: { branchId: data.branchId, optionCount: allOptionIds.length },
      })
      return { error: t('modifierValidationFailed') }
    }
    type DbOpt = { id: string; price_modifier: number; is_available: boolean }
    for (const o of (dbOpts ?? []) as DbOpt[]) {
      if (!o.is_available) {
        return { error: t('modifierUnavailable') }
      }
      modifierPriceById.set(o.id, Number(o.price_modifier))
    }
    // Reject any submitted option that doesn't exist (orphaned/deleted)
    for (const id of allOptionIds) {
      if (!modifierPriceById.has(id)) {
        return { error: t('modifierUnknown') }
      }
    }
  }

  // ── Server-side price resolution (NEVER trust client-submitted prices) ──
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
  // Dashboard price edits land in menu_items.price_bhd; resolveOrderItemPrice
  // prefers DB over JSON for single-price items so POS stays in sync with edits.
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

    if ('error' in resolved) {
      return { error: resolved.error }
    }

    // Trust DB modifier prices, replace client-submitted values to defeat tampering.
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
  if (subtotal < 0.001) {
    return { error: t('subtotalZero') }
  }

  const supabase = await createServiceClient()

  // Ensure branch row exists (mirrors checkout flow)
  const branch = BRANCHES[data.branchId]
  await supabase
    .from('branches')
    .upsert(
      {
        id:        branch.id,
        name_ar:   branch.nameAr,
        name_en:   branch.nameEn,
        phone:     branch.phone,
        whatsapp:  branch.whatsapp,
        wa_link:   branch.waLink,
        maps_url:  branch.mapsUrl,
        is_active: branch.status === 'active',
      },
      { onConflict: 'id' },
    )

  // Map POS order types to schema-supported values. Migration 087 expanded
  // orders.order_type CHECK to ('delivery','pickup','dine_in'); persisting
  // 'dine_in' explicitly lets KDS, analytics, and waiter views distinguish
  // tablet/dine-in orders from pickups. 'phone' stays mapped to 'pickup'
  // because phone-placed orders are functionally a walk-in pickup.
  const dbOrderType: 'pickup' | 'delivery' | 'dine_in' =
    data.orderType === 'delivery'
      ? 'delivery'
      : data.orderType === 'dine_in'
        ? 'dine_in'
        : 'pickup'

  const orderTypeNote =
    data.orderType === 'dine_in'
      ? '[POS] Dine-in'
      : data.orderType === 'phone'
        ? '[POS] Phone order'
        : data.orderType === 'pickup'
          ? '[POS] Walk-in pickup'
          : '[POS] Manual delivery'

  const combinedNotes = data.notes?.trim()
    ? `${orderTypeNote} — ${data.notes.trim()}`
    : orderTypeNote

  const addr = data.deliveryAddress
  const deliveryAddressLine =
    data.orderType === 'delivery' && addr
      ? [addr.city, addr.block, addr.road, addr.building, addr.flat]
          .map((v) => v?.trim())
          .filter(Boolean)
          .join(', ')
      : null

  const idempotencyKey = data.idempotencyKey ?? randomUUID()

  // RPC supports 'cash' and online methods. Map card/tap appropriately.
  // For card+tap online flows we keep status 'new' (in-store payment), so we
  // pass 'cash' for the RPC's status branching. The actual chosen method is
  // recorded on the payment record.
  const rpcPaymentMethod = 'cash' as const

  // Best-effort promotion match — never blocks POS order creation.
  const promo = await resolveBestPromotion(
    data.branchId,
    pricedItems.map((p) => ({
      menu_item_slug: p.menu_item_slug,
      quantity:       p.quantity,
      unit_price_bhd: p.unit_price_bhd,
    })),
  )

  // ARCH-004 final (migration 164): map POS payment method to
  // rpc_create_order's p_payment_mode. 'cash' → 'cod' (method='cash',
  // status='pending_cod'); 'card'/'tap' → 'tap_card' (method='tap_card',
  // status='pending'). Payment row now commits in the same transaction
  // as the order — no separate INSERT after.
  const paymentMode: 'cod' | 'tap_card' =
    data.paymentMethod === 'cash' ? 'cod' : 'tap_card'

  // Migration 163 accepts delivery_lat / delivery_lng / delivery_flat as RPC
  // params. Passing them inline makes order + coords + flat commit atomically
  // and eliminates the post-RPC .update() calls that previously broke the
  // ARCH-004 invariant (financial writes go through RPC only).
  const pinnedLat = data.orderType === 'delivery' ? data.deliveryLat ?? undefined : undefined
  const pinnedLng = data.orderType === 'delivery' ? data.deliveryLng ?? undefined : undefined
  const flat      = data.orderType === 'delivery' ? addr?.flat?.trim() || undefined : undefined

  const { data: orderId, error: rpcError } = await supabase.rpc('rpc_create_order', {
    p_idempotency_key:        idempotencyKey,
    p_customer_name:          data.customerName.trim(),
    p_customer_phone:         normalizedPhone,
    p_branch_id:              data.branchId,
    p_order_type:             dbOrderType,
    p_items:                  pricedItems,
    p_total_bhd:              subtotal,
    p_notes:                  combinedNotes,
    p_delivery_address:       deliveryAddressLine ?? undefined,
    p_delivery_city:          addr?.city?.trim() || undefined,
    p_delivery_building:      addr?.building?.trim() || undefined,
    p_delivery_street:        addr?.road?.trim() || undefined,
    p_delivery_area:          addr?.block?.trim() || undefined,
    p_delivery_lat:           pinnedLat,
    p_delivery_lng:           pinnedLng,
    p_delivery_flat:          flat,
    p_source:                 'manual',
    p_coupon_discount_bhd:    0,
    p_points_to_redeem:       0,
    p_payment_method:         rpcPaymentMethod,
    // POS orders are confirmed by staff at the counter — skip 'new' and go
    // straight to 'accepted' so the KDS picks them up immediately.
    p_status:                 'accepted',
    p_promotion_id:           promo?.promotion_id ?? undefined,
    p_promotion_discount_bhd: promo?.discount_bhd ?? 0,
    p_payment_mode:           paymentMode,
  })

  if (rpcError || !orderId) {
    if (rpcError) {
      Sentry.captureException(rpcError, {
        tags:  { area: 'pos', action: 'createManualOrder.rpc' },
        extra: { branchId: data.branchId, paymentMode, subtotal },
      })
    }
    return { error: t('creationFailed') }
  }

  // ── Audit trail (migration 164: rpc_pos_finalize_order audit-only) ────
  // The payment row is now written inside rpc_create_order via
  // p_payment_mode, so this RPC has been stripped to a single audit_logs
  // INSERT. Audit failure no longer strands money — orders + payments
  // commit together; only the audit row may be missing, which Sentry
  // catches via the warning below for operator backfill.
  const { data: finalizeData, error: finalizeError } = await supabase.rpc('rpc_pos_finalize_order', {
    p_order_id:        orderId,
    p_audit_changes:   {
      action:         'manual_order_created',
      order_id:       orderId,
      created_by:     caller.id,
      total_bhd:      subtotal,
      pos_order_type: data.orderType,
      payment_method: data.paymentMethod,
      item_count:     pricedItems.length,
    },
    p_actor_id:        caller.id,
    p_actor_role:      caller.role,
    p_actor_branch_id: data.branchId,
  })

  let paymentWarning: string | undefined
  if (finalizeError) {
    Sentry.captureException(finalizeError, {
      tags:  { area: 'pos', action: 'createManualOrder.audit' },
      extra: { orderId, branchId: data.branchId },
    })
    paymentWarning = t('auditFailed')
  } else {
    const result = finalizeData as { success: boolean; code?: string } | null
    if (!result?.success) {
      const code = result?.code ?? 'unknown'
      Sentry.captureException(new Error(`rpc_pos_finalize_order non-success: ${code}`), {
        tags:  { area: 'pos', action: 'createManualOrder.audit' },
        extra: { orderId, branchId: data.branchId, code },
      })
      paymentWarning = t('auditFailedWithCode', { code })
    }
  }

  // ── Nominatim geocoder fallback (background, best-effort) ──
  // Pinned coords were folded into the RPC above. We only kick off the
  // geocode lookup when the cashier did NOT drop a map pin.
  if (data.orderType === 'delivery' && (data.deliveryLat == null || data.deliveryLng == null) && addr) {
    geocodeBahrainAddress(orderId, addr).catch(() => {})
  }

  const locale = await getLocale()
  revalidatePath(`/${locale}/dashboard/orders`)
  revalidatePath(`/${locale}/dashboard/pos`)

  return { orderId, warning: paymentWarning }
}

// ── Nominatim geocoder for Bahrain numbered addresses ─────────────────────────
// Runs after order creation — does not block the response.
async function geocodeBahrainAddress(
  orderId: string,
  addr: { city?: string | null; block?: string | null; road?: string | null; building?: string | null },
) {
  const parts: string[] = []
  if (addr.building) parts.push(`Building ${addr.building}`)
  if (addr.road)     parts.push(`Road ${addr.road}`)
  if (addr.block)    parts.push(`Block ${addr.block}`)
  if (addr.city)     parts.push(addr.city)
  parts.push('Bahrain')

  const query = parts.join(', ')
  const url   = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=bh&limit=1&q=${encodeURIComponent(query)}`

  const res = await fetch(url, {
    headers: { 'User-Agent': 'KahramanaBaghdad-POS/1.0 (contact@kahramana.bh)' },
    signal:  AbortSignal.timeout(5000),
  })

  if (!res.ok) return

  const results = await res.json() as Array<{ lat: string; lon: string }>
  if (!results.length) return

  const { lat, lon } = results[0]
  const supabase = await createServiceClient()
  // Non-financial geographic enrichment. Runs OUT-OF-BAND after the order
  // RPC commits — pinning lat/lng inside rpc_create_order is the atomic
  // path (see pinnedLat/pinnedLng above). This fallback only fires when the
  // cashier did not drop a pin, and the Nominatim round-trip would block
  // the response if held inside the RPC. Failures are silently swallowed.
  await supabase
    .from('orders')
    .update({ delivery_lat: parseFloat(lat), delivery_lng: parseFloat(lon) })
    .eq('id', orderId)
}
