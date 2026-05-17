'use server'

import { z } from 'zod'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getLocale } from 'next-intl/server'
import * as Sentry from '@sentry/nextjs'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { fetchCheckoutPriceMap, resolveOrderItemPrice } from '@/lib/checkout-pricing.server'
import { WAITER_PLACEHOLDER_PHONE } from '@/constants/contact'
import { resolveBestPromotion } from '@/lib/promotions/server'

// ── Validation ────────────────────────────────────────────────────────────────
// QR ordering is a guest flow — no auth header. The server action runs with
// the service_role key so rpc_create_order's auth gate is satisfied. Branch
// and table are validated against the DB; cart prices are resolved server-side.

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
  itemNotes:     z.string().max(200).nullable().optional(),
  modifiers:     z.array(modifierSchema).max(20).optional(),
})

const BAHRAIN_PHONE_RE = /^(\+?973)?[36]\d{7}$/

const payloadSchema = z.object({
  branchId:       z.string().min(1).max(50),
  tableNumber:    z.number().int().min(1).max(999),
  items:          z.array(itemSchema).min(1).max(60),
  customerName:   z.string().max(120).optional().nullable(),
  customerPhone:  z.string().max(20).optional().nullable(),
  notes:          z.string().max(500).nullable().optional(),
  // Client-owned for retry-safety against double-submit.
  idempotencyKey: z.string().uuid(),
})

export type QROrderPayload = z.infer<typeof payloadSchema>

export interface CreateQROrderResult {
  orderId?: string
  error?:   string
}

function normalizePhone(raw: string): string {
  const s = raw.replace(/[\s\-().]/g, '')
  if (s.startsWith('00973')) return '+973' + s.slice(5)
  if (s.startsWith('+973'))  return s
  if (s.startsWith('973') && s.length === 11) return '+' + s
  if (/^\d{8}$/.test(s)) return '+973' + s
  return s
}

async function getClientIp(): Promise<string> {
  const h = await headers()
  return (
    h.get('x-real-ip')
    ?? h.get('x-forwarded-for')?.split(',')[0].trim()
    ?? '127.0.0.1'
  )
}

export async function createQROrder(
  payload: QROrderPayload,
): Promise<CreateQROrderResult> {
  const parsed = payloadSchema.safeParse(payload)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first ? `${first.path.join('.')}: ${first.message}` : 'Invalid payload' }
  }
  const data = parsed.data

  // T1-3: rate-limit the QR-order path. Keyed on (ip, branchId, tableNumber)
  // so a single device on a busy branch can't blast in 60 orders/min, but
  // legitimate per-table traffic stays unbounded across the venue. Two
  // windows (burst + sustained) catch both rapid abuse and slow-drip floods.
  // Production fails closed when Upstash isn't configured or the call throws.
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      Sentry.captureMessage('table.createQROrder.rate_limit_unconfigured', { level: 'warning' })
      return { error: 'Rate limit unavailable' }
    }
    try {
      const [{ Ratelimit }, { Redis }] = await Promise.all([
        import('@upstash/ratelimit'),
        import('@upstash/redis'),
      ])
      const redis = Redis.fromEnv()
      const ip    = await getClientIp()
      const key   = `${ip}:${data.branchId}:${data.tableNumber}`

      const burst = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '1 m'),
        prefix:  'qr_order_burst',
      })
      const sustained = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(30, '1 h'),
        prefix:  'qr_order_sustained',
      })

      const [burstRes, sustainedRes] = await Promise.all([
        burst.limit(key),
        sustained.limit(key),
      ])
      if (!burstRes.success || !sustainedRes.success) {
        return { error: 'Too many requests' }
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { stage: 'table.createQROrder.rate_limit' } })
      return { error: 'Rate limit unavailable' }
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return { error: 'Configuration error' }
  const supabase: SupabaseClient = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Validate branch exists + active
  type BranchRow = { id: string; is_active: boolean }
  const { data: branchRows } = await supabase
    .from('branches')
    .select('id, is_active')
    .eq('id', data.branchId)
    .limit(1)
  const branches = (branchRows ?? []) as BranchRow[]
  if (branches.length === 0 || !branches[0].is_active) {
    return { error: 'Branch not available' }
  }

  // Validate table exists + active for this branch
  type TableRow = { id: string; is_active: boolean }
  const { data: tableRows } = await supabase
    .from('restaurant_tables')
    .select('id, is_active')
    .eq('branch_id', data.branchId)
    .eq('table_number', data.tableNumber)
    .limit(1)
  const tables = (tableRows ?? []) as TableRow[]
  if (tables.length === 0 || !tables[0].is_active) {
    return { error: 'Table not available' }
  }

  // Modifier price validation
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

  // Server-side price resolution
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

  // Phone validation only when provided
  let normalizedPhone: string = WAITER_PLACEHOLDER_PHONE
  if (data.customerPhone && data.customerPhone.trim().length > 0) {
    normalizedPhone = normalizePhone(data.customerPhone.trim())
    if (!BAHRAIN_PHONE_RE.test(normalizedPhone.replace(/\s+/g, ''))) {
      return { error: 'Invalid phone number' }
    }
  }

  const customerName = (data.customerName?.trim() || '') || `Table ${data.tableNumber}`
  const combinedNotes = data.notes?.trim()
    ? `[QR] Table ${data.tableNumber} — ${data.notes.trim()}`
    : `[QR] Table ${data.tableNumber}`

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
    p_customer_name:          customerName,
    p_customer_phone:         normalizedPhone,
    p_branch_id:              data.branchId,
    p_order_type:             'dine_in',
    p_items:                  pricedItems,
    p_total_bhd:              subtotal,
    p_notes:                  combinedNotes,
    p_source:                 'qr',
    p_payment_method:         'cash',
    p_table_number:           data.tableNumber,
    p_promotion_id:           promo?.promotion_id ?? null,
    p_promotion_discount_bhd: promo?.discount_bhd ?? 0,
    p_payment_mode:           'cod',
  })

  if (rpcError || !orderId) {
    return { error: rpcError?.message ?? 'Order creation failed' }
  }

  await supabase.from('audit_logs').insert({
    table_name: 'orders',
    action:     'INSERT',
    user_id:    null,
    record_id:  orderId as string,
    actor_role: 'guest',
    branch_id:  data.branchId,
    changes: {
      action:        'qr_order_created',
      table_number:  data.tableNumber,
      total_bhd:     subtotal,
      item_count:    pricedItems.length,
    },
  })

  const locale = await getLocale()
  revalidatePath(`/${locale}/dashboard/kds`)
  revalidatePath(`/${locale}/waiter/orders`)

  return { orderId: orderId as string }
}
