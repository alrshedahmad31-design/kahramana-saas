'use server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import {
  assertInventoryWriteAccess,
  getDashboardGuardErrorMessage,
  requireDashboardSession,
} from '@/lib/auth/dashboard-guards'
import { revalidatePath } from 'next/cache'

const UpsertBudgetSchema = z.object({
  branch_id:            z.string().min(1),
  year:                 z.number().int().min(2020).max(2100),
  month:                z.number().int().min(1).max(12),
  purchase_budget_bhd:  z.number().min(0),
  food_cost_target_pct: z.number().min(0).max(100),
  waste_budget_bhd:     z.number().min(0),
})

export async function upsertBudget(data: {
  branch_id:            string
  year:                 number
  month:                number
  purchase_budget_bhd:  number
  food_cost_target_pct: number
  waste_budget_bhd:     number
}): Promise<{ error?: string }> {
  const parsed = UpsertBudgetSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'بيانات غير صحيحة' }
  }

  let session
  try {
    session = await requireDashboardSession()
    assertInventoryWriteAccess(session, parsed.data.branch_id)
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('inventory_budgets')
    .upsert(
      { ...parsed.data, created_by: session.id, updated_at: new Date().toISOString() },
      { onConflict: 'branch_id,year,month' },
    )

  if (error) return { error: error.message }

  revalidatePath('/ar/dashboard/inventory/budget')
  revalidatePath('/en/dashboard/inventory/budget')
  return {}
}
