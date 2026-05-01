'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

const ALLOWED_WRITE_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager'] as const

export async function recordOpeningBalance(
  branchId: string,
  ingredientId: string,
  quantity: number
): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!ALLOWED_WRITE_ROLES.includes(session.role as typeof ALLOWED_WRITE_ROLES[number])) {
    return { error: 'Forbidden' }
  }

  if (quantity < 0) return { error: 'الكمية يجب أن تكون أكبر من أو تساوي صفر' }

  const supabase = createServiceClient()

  const { error: mvError } = await supabase.from('inventory_movements').insert({
    branch_id: branchId,
    ingredient_id: ingredientId,
    movement_type: 'opening_balance',
    quantity,
    performed_by: session.id,
    performed_at: new Date().toISOString(),
    notes: 'Opening balance via dashboard',
  })

  if (mvError) return { error: mvError.message }

  // Update or insert stock row
  const { error: stockError } = await supabase
    .from('inventory_stock')
    .upsert(
      {
        branch_id: branchId,
        ingredient_id: ingredientId,
        on_hand: quantity,
        reserved: 0,
        catering_reserved: 0,
        last_movement_at: new Date().toISOString(),
      },
      { onConflict: 'branch_id,ingredient_id' }
    )

  if (stockError) return { error: stockError.message }

  revalidatePath(`/dashboard/inventory/stock/${branchId}`)
  return {}
}
