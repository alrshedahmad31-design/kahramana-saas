'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { assertInventoryWriteAccess, getDashboardGuardErrorMessage, requireDashboardSession } from '@/lib/auth/dashboard-guards'
import { revalidatePath } from 'next/cache'

export async function recordOpeningBalance(
  branchId: string,
  ingredientId: string,
  quantity: number
): Promise<{ error?: string }> {
  let session
  try {
    session = await requireDashboardSession()
    assertInventoryWriteAccess(session, branchId)
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }

  if (quantity < 0) return { error: 'الكمية يجب أن تكون أكبر من أو تساوي صفر' }

  const supabase = createServiceClient()

  // C3 FIX: read current on_hand so the movement records the actual signed
  // delta. Without this: on_hand=100, new=30 → movement says +30 but stock
  // actually dropped 70. Delta = new − old (negative = reduction).
  const { data: existing } = await supabase
    .from('inventory_stock')
    .select('on_hand')
    .eq('branch_id', branchId)
    .eq('ingredient_id', ingredientId)
    .maybeSingle()

  const previousOnHand = existing?.on_hand ?? 0
  const delta = quantity - previousOnHand

  if (delta === 0) {
    revalidatePath(`/dashboard/inventory/stock/${branchId}`)
    return {}
  }

  const { error: mvError } = await supabase.from('inventory_movements').insert({
    branch_id:     branchId,
    ingredient_id: ingredientId,
    movement_type: 'opening_balance',
    quantity:      delta,
    performed_by:  session.id,
    performed_at:  new Date().toISOString(),
    notes:         `Opening balance: ${previousOnHand} → ${quantity}`,
  })

  if (mvError) return { error: mvError.message }

  const { error: stockError } = await supabase
    .from('inventory_stock')
    .upsert(
      {
        branch_id:         branchId,
        ingredient_id:     ingredientId,
        on_hand:           quantity,
        reserved:          0,
        catering_reserved: 0,
        last_movement_at:  new Date().toISOString(),
      },
      { onConflict: 'branch_id,ingredient_id' }
    )

  if (stockError) return { error: stockError.message }

  revalidatePath(`/dashboard/inventory/stock/${branchId}`)
  return {}
}
