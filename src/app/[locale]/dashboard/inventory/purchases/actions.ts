'use server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { assertInventoryWriteAccess, getDashboardGuardErrorMessage, requireDashboardRole, requireDashboardSession } from '@/lib/auth/dashboard-guards'
import { revalidatePath } from 'next/cache'

const PO_STATUSES = ['draft', 'ordered', 'partial', 'received', 'cancelled'] as const
type POStatus = typeof PO_STATUSES[number]

// 3-decimal money precision (Bahraini Dinar fils).
const bhd3 = z.number()
  .refine((n) => Number.isInteger(Math.round(n * 1000)) && Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6,
    { message: 'value must have at most 3 decimal places' })

const purchaseItemSchema = z.object({
  ingredient_id:    z.string().uuid('ingredient_id must be a UUID'),
  quantity_ordered: z.number().gt(0, 'quantity_ordered must be > 0').max(1_000_000).pipe(bhd3),
  unit_cost:        z.number().min(0, 'unit_cost must be >= 0').max(1_000_000).pipe(bhd3),
  lot_number:       z.string().max(50).optional(),
  expiry_date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expiry_date must be YYYY-MM-DD').optional(),
})

const purchaseItemsSchema = z.array(purchaseItemSchema).min(0).max(200)

const supplierSchema = z.object({
  name_ar:        z.string().trim().min(1, 'اسم المورد مطلوب').max(120),
  name_en:        z.string().trim().max(120).optional().nullable(),
  phone:          z.string().trim().max(30).optional().nullable(),
  email:          z.string().trim().email('email format invalid').max(120).optional().nullable().or(z.literal('').transform(() => null)),
  lead_time_days: z.number().int('lead_time_days must be integer').min(0).max(365),
  payment_terms:  z.string().trim().max(120).optional().nullable(),
  is_active:      z.boolean(),
  notes:          z.string().trim().max(2000).optional().nullable(),
})

// Server-enforced PO lifecycle. Workflow is forward-only except cancellation,
// which is allowed up to (but not from) received.
const ALLOWED_PO_TRANSITIONS: Record<POStatus, readonly POStatus[]> = {
  draft:     ['ordered', 'cancelled'],
  ordered:   ['partial', 'received', 'cancelled'],
  partial:   ['received', 'cancelled'],
  received:  [],
  cancelled: [],
}

export async function createPurchaseOrder(
  formData: FormData,
): Promise<{ error?: string; id?: string }> {
  const supplier_id = formData.get('supplier_id') as string
  const branch_id   = formData.get('branch_id') as string
  const expected_at = formData.get('expected_at') as string | null
  const notes       = formData.get('notes') as string | null

  if (!supplier_id || !branch_id) return { error: 'الفرع والمورد مطلوبان' }

  let session
  try {
    session = await requireDashboardSession()
    assertInventoryWriteAccess(session, branch_id)
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }

  // Parse items BEFORE the PO insert so a bad payload cannot leave an
  // orphan PO behind. The RPC then writes the PO + items in a single
  // transaction (migration 124).
  const itemsJson = formData.get('items') as string | null
  let items: Array<{
    ingredient_id:    string
    quantity_ordered: number
    unit_cost:        number
    lot_number?:      string
    expiry_date?:     string
  }> = []
  if (itemsJson) {
    let rawItems: unknown
    try {
      rawItems = JSON.parse(itemsJson)
    } catch {
      return { error: 'Items payload is not valid JSON' }
    }
    const parsedItems = purchaseItemsSchema.safeParse(rawItems)
    if (!parsedItems.success) {
      const issue = parsedItems.error.issues[0]
      return { error: issue ? `items[${issue.path.join('.')}]: ${issue.message}` : 'Invalid items payload' }
    }
    items = parsedItems.data
  }

  const supabase = createServiceClient()
  const { data: poId, error: rpcErr } = await supabase.rpc(
    'rpc_create_purchase_order',
    {
      p_supplier_id: supplier_id,
      p_branch_id:   branch_id,
      p_created_by:  session.id,
      p_items:       items,
      p_expected_at: expected_at || undefined,
      p_notes:       notes || undefined,
    },
  )

  if (rpcErr || !poId) return { error: rpcErr?.message ?? 'Failed to create PO' }

  revalidatePath('/dashboard/inventory/purchases')
  revalidatePath('/en/dashboard/inventory/purchases')
  return { id: poId }
}

export async function updatePOStatus(
  id: string,
  status: POStatus,
): Promise<{ error?: string }> {
  if (!PO_STATUSES.includes(status)) {
    return { error: `Invalid status: ${status}` }
  }

  let session
  try {
    session = await requireDashboardSession()
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }
  const supabase = createServiceClient()
  const { data: po, error: fetchError } = await supabase
    .from('purchase_orders')
    .select('branch_id, status')
    .eq('id', id)
    .single()

  if (fetchError || !po) return { error: 'Purchase order not found' }

  try {
    assertInventoryWriteAccess(session, po.branch_id)
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }

  const currentStatus = po.status as POStatus
  if (currentStatus !== status) {
    const allowed = ALLOWED_PO_TRANSITIONS[currentStatus] ?? []
    if (!allowed.includes(status)) {
      return { error: `Invalid PO transition: ${currentStatus} → ${status}` }
    }
  }

  // CAS on status: two users pressing different state buttons on the same PO
  // both pass the transition-matrix check above (read). Pin the update to the
  // status snapshot we fetched so only one transition lands.
  const { data: updated, error } = await supabase
    .from('purchase_orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', currentStatus)
    .select('id')
    .single()

  if (error) return { error: error.message }
  if (!updated) return { error: 'Purchase order status changed concurrently; refresh and try again' }
  revalidatePath('/dashboard/inventory/purchases')
  revalidatePath('/en/dashboard/inventory/purchases')
  return {}
}

export async function upsertSupplier(
  formData: FormData,
): Promise<{ error?: string }> {
  try {
    await requireDashboardRole(['owner', 'general_manager'])
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }

  const supabase = createServiceClient()
  const id = formData.get('id') as string | null
  const rawPayload = {
    name_ar:        formData.get('name_ar') as string,
    name_en:        (formData.get('name_en') as string) || null,
    phone:          (formData.get('phone') as string) || null,
    email:          (formData.get('email') as string) || null,
    lead_time_days: Number(formData.get('lead_time_days') ?? 1),
    payment_terms:  (formData.get('payment_terms') as string) || null,
    is_active:      formData.get('is_active') !== 'false',
    notes:          (formData.get('notes') as string) || null,
  }

  const parsed = supplierSchema.safeParse(rawPayload)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { error: issue ? `${issue.path.join('.')}: ${issue.message}` : 'Invalid supplier payload' }
  }
  const payload = parsed.data

  if (id) {
    const { error } = await supabase.from('suppliers').update(payload).eq('id', id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('suppliers').insert(payload)
    if (error) return { error: error.message }
  }

  revalidatePath('/dashboard/inventory/purchases/suppliers')
  revalidatePath('/en/dashboard/inventory/purchases/suppliers')
  return {}
}
