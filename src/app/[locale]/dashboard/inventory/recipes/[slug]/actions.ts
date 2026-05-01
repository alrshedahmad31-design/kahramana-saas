'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

interface RecipeRowInput {
  ingredient_id?: string | null
  prep_item_id?: string | null
  quantity: number
  yield_factor?: number | null
  variant_key?: string | null
  is_optional?: boolean
}

const ALLOWED_WRITE_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager', 'kitchen'] as const

export async function upsertRecipe(
  slug: string,
  rows: RecipeRowInput[]
): Promise<{ error?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }
  if (!ALLOWED_WRITE_ROLES.includes(session.role as typeof ALLOWED_WRITE_ROLES[number])) {
    return { error: 'Forbidden' }
  }

  if (rows.some((r) => !r.ingredient_id && !r.prep_item_id)) {
    return { error: 'كل صف يجب أن يحتوي على مكوّن أو prep item' }
  }

  const supabase = createServiceClient()

  // Delete existing recipe rows for this slug
  const { error: delError } = await supabase
    .from('recipes')
    .delete()
    .eq('menu_item_slug', slug)

  if (delError) return { error: delError.message }

  // Insert new rows
  if (rows.length > 0) {
    const { error: insError } = await supabase.from('recipes').insert(
      rows.map((r) => ({
        menu_item_slug: slug,
        ingredient_id: r.ingredient_id ?? null,
        prep_item_id: r.prep_item_id ?? null,
        quantity: r.quantity,
        yield_factor: r.yield_factor ?? null,
        variant_key: r.variant_key ?? null,
        is_optional: r.is_optional ?? false,
        updated_by: session.id,
        updated_at: new Date().toISOString(),
      }))
    )
    if (insError) return { error: insError.message }
  }

  revalidatePath(`/dashboard/inventory/recipes/${slug}`)
  revalidatePath('/dashboard/inventory/recipes')
  return {}
}
