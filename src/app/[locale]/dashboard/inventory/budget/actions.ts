'use server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

const BUDGET_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager'] as const

async function requireBudgetRole() {
  const session = await getSession()
  if (!session) return { session: null, error: 'Unauthorized' } as const
  if (!(BUDGET_ROLES as readonly string[]).includes(session.role ?? '')) {
    return { session: null, error: 'Forbidden' } as const
  }
  return { session, error: null } as const
}

const UpsertBudgetSchema = z.object({
  branch_id:            z.string().min(1),
  year:                 z.number().int().min(2020).max(2100),
  month:                z.number().int().min(1).max(12),
  purchase_budget_bhd:  z.number().min(0),
  food_cost_target_pct: z.number().min(0).max(100),
  waste_budget_bhd:     z.number().min(0),
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

export async function upsertBudget(data: {
  branch_id:            string
  year:                 number
  month:                number
  purchase_budget_bhd:  number
  food_cost_target_pct: number
  waste_budget_bhd:     number
}): Promise<{ error?: string }> {
  const { session, error: authError } = await requireBudgetRole()
  if (authError || !session) return { error: authError ?? 'Unauthorized' }

  const parsed = UpsertBudgetSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'بيانات غير صحيحة' }
  }

  const db: AnySupabase = createServiceClient()
  const { error } = await db
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
