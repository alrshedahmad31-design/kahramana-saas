'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const menuItemsTable = (sb: any) => sb.from('menu_items')

export async function toggleMenuItemAvailability(slug: string, isAvailable: boolean) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await menuItemsTable(supabase).upsert({
    id: slug,
    is_available: isAvailable,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })

  if (error) {
    console.error('Error updating menu availability:', error)
    return { success: false, error: error.message }
  }

  await supabase.from('audit_logs').insert({
    table_name: 'menu_items',
    action:     'UPDATE',
    user_id:    user.id,
    record_id:  slug,
    changes:    { is_available: isAvailable },
  })

  revalidatePath('/dashboard/menu')
  revalidatePath('/en/dashboard/menu')
  return { success: true }
}

export async function syncMenuItemsWithDatabase(
  items?: { id: string; name_ar: string; name_en: string; price_bhd: number }[],
) {
  if (!items || items.length === 0) return { success: true }

  const supabase = await createClient()

  const { error } = await menuItemsTable(supabase).upsert(
    items.map((item) => ({
      id:        item.id,
      name_ar:   item.name_ar,
      name_en:   item.name_en,
      price_bhd: item.price_bhd,
    })),
    { onConflict: 'id' },
  )

  if (error) {
    console.error('Error syncing menu items:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/menu')
  revalidatePath('/en/dashboard/menu')
  return { success: true }
}
