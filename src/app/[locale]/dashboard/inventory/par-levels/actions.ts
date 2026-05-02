'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { assertInventoryWriteAccess, getDashboardGuardErrorMessage, requireDashboardSession } from '@/lib/auth/dashboard-guards'
import { revalidatePath } from 'next/cache'
import type { ParDayType } from '@/lib/supabase/custom-types'

export async function upsertParLevel(
  branchId: string,
  ingredientId: string,
  dayType: ParDayType,
  parQty: number,
  reorderQty: number
): Promise<{ error?: string }> {
  let session
  try {
    session = await requireDashboardSession()
    assertInventoryWriteAccess(session, branchId)
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
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
