'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'
import type { ParDayType } from '@/lib/supabase/custom-types'

const ALLOWED_WRITE_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager'] as const

export async function upsertParLevel(
  branchId: string,
  ingredientId: string,
  dayType: ParDayType,
  parQty: number,
  reorderQty: number
): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!ALLOWED_WRITE_ROLES.includes(session.role as typeof ALLOWED_WRITE_ROLES[number])) {
    return { error: 'Forbidden' }
  }

  if (parQty < 0 || reorderQty < 0) {
    return { error: 'القيم يجب أن تكون أكبر من أو تساوي صفر' }
  }

  const supabase = createServiceClient()

  const { error } = await supabase
    .from('par_levels')
    .upsert(
      {
        branch_id: branchId,
        ingredient_id: ingredientId,
        day_type: dayType,
        par_qty: parQty,
        reorder_qty: reorderQty,
      },
      { onConflict: 'branch_id,ingredient_id,day_type' }
    )

  if (error) return { error: error.message }

  revalidatePath('/dashboard/inventory/par-levels')
  return {}
}
