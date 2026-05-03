'use server'
import { createServiceClient } from '@/lib/supabase/server'
import { assertInventoryWriteAccess, getDashboardGuardErrorMessage, requireDashboardRole, requireDashboardSession } from '@/lib/auth/dashboard-guards'
import { revalidatePath } from 'next/cache'

const PO_STATUSES = ['draft', 'ordered', 'partial', 'received', 'cancelled'] as const
type POStatus = typeof PO_STATUSES[number]

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

  const supabase = createServiceClient()
  const { data: po, error: poErr } = await supabase
    .from('purchase_orders')
    .insert({
      supplier_id,
      branch_id,
      expected_at:  expected_at || null,
      notes:        notes || null,
      created_by:   session.id,
      status:       'draft',
    })
    .select('id')
    .single()

  if (poErr || !po) return { error: poErr?.message ?? 'Failed to create PO' }

  const itemsJson = formData.get('items') as string
  if (itemsJson) {
    const items = JSON.parse(itemsJson) as Array<{
      ingredient_id:    string
      quantity_ordered: number
      unit_cost:        number
      lot_number?:      string
      expiry_date?:     string
    }>

    if (items.length > 0) {
      const { error: itemsErr } = await supabase
        .from('purchase_order_items')
        .insert(
          items.map((item) => ({
            purchase_order_id: po.id,
            ingredient_id:     item.ingredient_id,
            quantity_ordered:  item.quantity_ordered,
            unit_cost:         item.unit_cost,
            lot_number:        item.lot_number || null,
            expiry_date:       item.expiry_date || null,
            quantity_received: 0,
          })),
        )
      if (itemsErr) return { error: itemsErr.message }
    }
  }

  revalidatePath('/dashboard/inventory/purchases')
  return { id: po.id }
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
    .select('branch_id')
    .eq('id', id)
    .single()

  if (fetchError || !po) return { error: 'Purchase order not found' }

  try {
    assertInventoryWriteAccess(session, po.branch_id)
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }

  const { error } = await supabase
    .from('purchase_orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/inventory/purchases')
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
  const payload = {
    name_ar:        formData.get('name_ar') as string,
    name_en:        (formData.get('name_en') as string) || null,
    phone:          (formData.get('phone') as string) || null,
    email:          (formData.get('email') as string) || null,
    lead_time_days: Number(formData.get('lead_time_days') || 1),
    payment_terms:  (formData.get('payment_terms') as string) || null,
    is_active:      formData.get('is_active') !== 'false',
    notes:          (formData.get('notes') as string) || null,
  }

  if (!payload.name_ar) return { error: 'اسم المورد مطلوب' }

  if (id) {
    const { error } = await supabase.from('suppliers').update(payload).eq('id', id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('suppliers').insert(payload)
    if (error) return { error: error.message }
  }

  revalidatePath('/dashboard/inventory/purchases/suppliers')
  return {}
}
