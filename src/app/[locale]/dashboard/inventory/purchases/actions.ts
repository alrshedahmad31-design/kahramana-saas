'use server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

export async function createPurchaseOrder(
  formData: FormData,
): Promise<{ error?: string; id?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  const allowed = ['owner', 'general_manager', 'branch_manager', 'inventory_manager']
  if (!allowed.includes(session.role ?? '')) return { error: 'Forbidden' }

  const supabase = createServiceClient()

  const supplier_id = formData.get('supplier_id') as string
  const branch_id   = formData.get('branch_id') as string
  const expected_at = formData.get('expected_at') as string | null
  const notes       = formData.get('notes') as string | null

  if (!supplier_id || !branch_id) return { error: 'الفرع والمورد مطلوبان' }

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
  status: string,
): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  const allowed = ['owner', 'general_manager', 'branch_manager', 'inventory_manager']
  if (!allowed.includes(session.role ?? '')) return { error: 'Forbidden' }

  const supabase = createServiceClient()
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
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!['owner', 'general_manager'].includes(session.role ?? '')) return { error: 'Forbidden' }

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
