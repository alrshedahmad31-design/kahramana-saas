'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getDashboardGuardErrorMessage, requireDashboardRole } from '@/lib/auth/dashboard-guards'
import { revalidatePath } from 'next/cache'

interface RecipeRowInput {
  ingredient_id?: string | null
  prep_item_id?: string | null
  quantity: number
  yield_factor?: number | null
  variant_key?: string | null
  is_optional?: boolean
}

export async function upsertRecipe(
  slug: string,
  rows: RecipeRowInput[]
): Promise<{ error?: string }> {
  let session
  try {
    session = await requireDashboardRole(['owner', 'general_manager'])
  } catch (error) {
    return { error: getDashboardGuardErrorMessage(error) }
  }

  if (rows.some((r) => !r.ingredient_id && !r.prep_item_id)) {
    return { error: 'كل صف يجب أن يحتوي على مكوّن أو prep item' }
  }

  const supabase = createServiceClient()

  // Atomic replace via migration 175 — the prior JS-side delete-then-insert
  // could leave the recipe empty if the insert failed after the delete
  // committed. rpc_replace_recipes runs both in one transaction.
  const { error } = await supabase.rpc('rpc_replace_recipes', {
    p_slug: slug,
    p_rows: rows.map((r) => ({
      ingredient_id: r.ingredient_id ?? null,
      prep_item_id:  r.prep_item_id  ?? null,
      quantity:      r.quantity,
      yield_factor:  r.yield_factor  ?? null,
      variant_key:   r.variant_key   ?? null,
      is_optional:   r.is_optional   ?? false,
    })),
    p_updated_by: session.id,
  })

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/inventory/recipes/${slug}`)
  revalidatePath('/dashboard/inventory/recipes')
  revalidatePath('/en/dashboard/inventory/recipes')
  return {}
}
