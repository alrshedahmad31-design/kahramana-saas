'use server'

import { z } from 'zod'
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { getLocale } from 'next-intl/server'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/auth/session'
import { resolveCheckoutMenuItemPrice } from '@/lib/menu'
import {
  BRANCHES,
  isHiddenBranch,
  WAITER_PLACEHOLDER_PHONE,
  type BranchId,
} from '@/constants/contact'
import { resolveBestPromotion } from '@/lib/promotions/server'
import type { StaffRole } from '@/lib/supabase/custom-types'

const SERVICE_ROLES: readonly StaffRole[] = [
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
  menuItemId:   z.string().min(1).max(120),
  quantity:     z.number().int().min(1).max(50),
  variantName:  z.string().max(80).nullable().optional(),
  sizeName:     z.string().max(40).nullable().optional(),
  unitPriceBhd: z.number().min(0).max(10_000),
  itemNotes:    z.string().max(200).nullable().optional(),
  modifiers:    z.array(modifierSchema).max(20).optional(),
})

const payloadSchema = z.object({
  branchId:      z.string().min(1).max(50),
  tableNumber:   z.number().int().min(1).max(200),
  items:         z.array(itemSchema).min(1).max(60),
  notes:         z.string().max(500).nullable().optional(),
  customerName:  z.string().max(120).optional(),
  customerPhone: z.string().max(20).optional(),
  idempotencyKey: z.string().uuid().optional(),
})

export type ServiceOrderPayload = z.infer<typeof payloadSchema>

export interface CreateServiceOrderResult {
  orderId?: string
  error?:   string
  warning?: string
}

function isBranchId(value: string): value is BranchId {
  return value in BRANCHES
}

export async function createServiceOrder(
  payload: ServiceOrderPayload,
): Promise<CreateServiceOrderResult> {
  const caller = await getSession()
  if (!caller || !caller.role || !SERVICE_ROLES.includes(caller.role)) {
    return { error: 'Unauthorized' }
  }

  const parsed = payloadSchema.safeParse(payload)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { error: first ? `${first.path.join('.')}: ${first.message}` : 'Invalid payload' }
  }
  const data = parsed.data

  if (!isBranchId(data.branchId) || isHiddenBranch(data.branchId)) {
    return { error: 'Invalid branch' }
  }

  // Fail-closed branch scope for scoped roles. NULL branch_id is REJECTED
  // (not treated as wildcard) — see pos/actions.ts for the same pattern.
  if (
    caller.role === 'branch_manager' || caller.role === 'cashier' || caller.role === 'waiter'
  ) {
    if (!caller.branch_id || caller.branch_id !== data.branchId) {
      return { error: 'Forbidden: branch scope violation' }
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return { error: 'Configuration error' }
  const supabase: SupabaseClient = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

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

  const pricedItems: PricedItem[] = []
  for (const item of data.items) {
    const resolved = resolveCheckoutMenuItemPrice(item.menuItemId, {
      size:    item.sizeName?.trim() || undefined,
      variant: item.variantName?.trim() || undefined,
    })
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

  const customerName  = data.customerName?.trim() || 'دائن'
  const customerPhone = data.customerPhone?.trim() || WAITER_PLACEHOLDER_PHONE

  const baseNote = `[Service] Table ${data.tableNumber}`
  const combinedNotes = data.notes?.trim()
    ? `${baseNote} — ${data.notes.trim()}`
    : baseNote

  const idempotencyKey = data.idempotencyKey ?? randomUUID()

  const promo = await resolveBestPromotion(
    data.branchId,
    pricedItems.map((p) => ({
      menu_item_slug: p.menu_item_slug,
      quantity:       p.quantity,
      unit_price_bhd: p.unit_price_bhd,
    })),
  )

  const { data: orderId, error: rpcError } = await supabase.rpc('rpc_create_order', {
    p_idempotency_key:        idempotencyKey,
    p_customer_name:          customerName,
    p_customer_phone:         customerPhone,
    p_branch_id:              data.branchId,
    p_order_type:             'dine_in',
    p_items:                  pricedItems,
    p_total_bhd:              subtotal,
    p_notes:                  combinedNotes,
    p_source:                 'waiter',
    p_payment_method:         'cash',
    p_status:                 'accepted',
    p_table_number:           data.tableNumber,
    p_promotion_id:           promo?.promotion_id ?? null,
    p_promotion_discount_bhd: promo?.discount_bhd ?? 0,
  })

  if (rpcError || !orderId) {
    return { error: rpcError?.message ?? 'Order creation failed' }
  }

  const { error: paymentError } = await supabase.from('payments').insert({
    order_id:   orderId as string,
    amount_bhd: subtotal,
    method:     'cash',
    status:     'pending_cod',
  })

  let paymentWarning: string | undefined
  if (paymentError) {
    console.error('[pos:service] payment insert failed for order', orderId, paymentError)
    paymentWarning = `Order created but payment record failed: ${paymentError.message}. Manager resolution required.`
  }

  const { error: auditError } = await supabase.from('audit_logs').insert({
    table_name: 'orders',
    action:     'INSERT',
    user_id:    caller.id,
    record_id:  orderId as string,
    actor_role: caller.role,
    branch_id:  data.branchId,
    changes: {
      action:        'service_order_created',
      table_number:  data.tableNumber,
      total_bhd:     subtotal,
      item_count:    pricedItems.length,
    },
  })
  if (auditError) {
    console.error('[pos:service] audit_logs insert failed for order', orderId, auditError)
  }

  const locale = await getLocale()
  revalidatePath(`/${locale}/dashboard/pos/service`)
  revalidatePath(`/${locale}/dashboard/orders`)
  revalidatePath(`/${locale}/dashboard/kds`)

  return { orderId: orderId as string, warning: paymentWarning }
}
