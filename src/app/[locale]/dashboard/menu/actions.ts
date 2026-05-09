'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/server'
import {
  getDashboardGuardErrorMessage,
  requireDashboardSection,
} from '@/lib/auth/dashboard-guards'
import { slugify } from '@/lib/menu'
import menuData from '@/data/menu.json'
import { MENU_CATEGORY_IDS } from '@/constants/menu-categories'
import type { StaffRole, KDSStation } from '@/lib/supabase/custom-types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RawMenuCategory {
  category: { ar: string; en: string }
  items: {
    id: string
    name: { ar: string; en: string }
    description: { ar: string; en: string }
    price_bhd?: number | null
    image_url?: string
    station?: string
  }[]
}

const STATIONS = ['main', 'grill', 'shawarma', 'bakery', 'appetizer_drinks'] as const

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const itemPayloadSchema = z.object({
  // id is optional on create — server generates it from category + name_en when missing.
  id:             z.string().min(1).max(120).regex(SLUG_RE, 'invalid slug').optional(),
  name_ar:        z.string().trim().min(1).max(120),
  name_en:        z.string().trim().min(1).max(120),
  description_ar: z.string().trim().max(2000).optional().default(''),
  description_en: z.string().trim().max(2000).optional().default(''),
  price_bhd:      z.number().min(0).max(10_000),
  category:       z.string().trim().min(1).max(80).refine(
    (v) => MENU_CATEGORY_IDS.includes(v),
    { message: 'category must be one of MENU_CATEGORIES' },
  ),
  image_url:      z.string().trim().max(500).optional().default(''),
  station:        z.enum(STATIONS),
  is_available:   z.boolean().optional().default(true),
})

const updatePayloadSchema = itemPayloadSchema.omit({ id: true }).partial({
  is_available: true,
}).extend({
  // is_available is owned by the toggle action; ignore it here.
  is_available: z.boolean().optional(),
})

const DESTRUCTIVE_ROLES: readonly StaffRole[] = ['owner', 'general_manager'] as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function bustMenuCaches(slug?: string) {
  // Dashboard
  revalidatePath('/[locale]/dashboard/menu', 'page')
  revalidatePath('/dashboard/menu')
  revalidatePath('/en/dashboard/menu')
  revalidatePath('/ar/dashboard/menu')

  // Customer-facing menu surfaces (both locales)
  for (const locale of ['ar', 'en'] as const) {
    const prefix = locale === 'ar' ? '' : '/en'
    revalidatePath(`${prefix}/menu`)
    if (slug) {
      revalidatePath(`${prefix}/menu/${slug}`)
      revalidatePath(`${prefix}/menu/item/${slug}`)
    }
  }
  revalidatePath('/[locale]/menu', 'page')
  revalidatePath('/[locale]/menu/[slug]', 'page')
  revalidatePath('/[locale]/menu/item/[slug]', 'page')
}

// ── Toggle availability ───────────────────────────────────────────────────────

export async function toggleMenuItemAvailability(
  slug: string,
  isAvailable: boolean,
): Promise<{ success: boolean; error?: string }> {
  let caller
  try {
    caller = await requireDashboardSection('menu')
  } catch (err) {
    return { success: false, error: getDashboardGuardErrorMessage(err) }
  }

  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) {
    return { success: false, error: 'Invalid slug' }
  }
  if (typeof isAvailable !== 'boolean') {
    return { success: false, error: 'Invalid availability flag' }
  }

  const supabase = await createServiceClient()

  const { error } = await supabase
    .from('menu_items')
    .update({
      is_available: isAvailable,
      updated_at:   new Date().toISOString(),
    })
    .eq('id', slug)

  if (error) {
    console.error('[menu] toggleMenuItemAvailability failed:', error)
    return { success: false, error: error.message }
  }

  await supabase.from('audit_logs').insert({
    table_name: 'menu_items',
    action:     'UPDATE',
    user_id:    caller.id,
    record_id:  slug,
    actor_role: caller.role,
    changes:    { is_available: isAvailable },
  })

  bustMenuCaches(slug)
  return { success: true }
}

// ── Sync from JSON ────────────────────────────────────────────────────────────

export async function syncMenuItemsWithDatabase(): Promise<{
  success: boolean
  error?: string
  count?: number
}> {
  let caller
  try {
    caller = await requireDashboardSection('menu')
  } catch (err) {
    return { success: false, error: getDashboardGuardErrorMessage(err) }
  }
  // Sync rewrites prices and structure — restrict to owner/general_manager
  if (!DESTRUCTIVE_ROLES.includes(caller.role as StaffRole)) {
    return { success: false, error: 'Forbidden: only owners or general managers can sync menu' }
  }

  const allItems = (menuData as RawMenuCategory[]).flatMap((cat) =>
    cat.items.map((item) => ({
      id:             item.id,
      name_ar:        item.name.ar,
      name_en:        item.name.en,
      description_ar: item.description?.ar ?? null,
      description_en: item.description?.en ?? null,
      price_bhd:      item.price_bhd ?? 0,
      category:       slugify(cat.category.en),
      image_url:      item.image_url || null,
      station:        ((item.station || 'main') as KDSStation),
      updated_at:     new Date().toISOString(),
    })),
  )

  if (allItems.length === 0) return { success: true, count: 0 }

  const supabase = await createServiceClient()
  const { error } = await supabase.from('menu_items').upsert(allItems, {
    onConflict: 'id',
  })

  if (error) {
    console.error('[menu] sync failed:', error)
    return { success: false, error: error.message }
  }

  bustMenuCaches()
  return { success: true, count: allItems.length }
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createMenuItem(
  data: unknown,
): Promise<{ success: boolean; error?: string }> {
  let caller
  try {
    caller = await requireDashboardSection('menu')
  } catch (err) {
    return { success: false, error: getDashboardGuardErrorMessage(err) }
  }
  if (!DESTRUCTIVE_ROLES.includes(caller.role as StaffRole)) {
    return { success: false, error: 'Forbidden: only owners or general managers can create items' }
  }

  const parsed = itemPayloadSchema.safeParse(data)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { success: false, error: first ? `${first.path.join('.')}: ${first.message}` : 'Invalid payload' }
  }
  const payload = parsed.data

  // Generate slug server-side when client did not supply one.
  const generatedSlug = payload.id?.trim()
    ? payload.id.trim()
    : `${payload.category}-${slugify(payload.name_en)}`

  if (!SLUG_RE.test(generatedSlug)) {
    return { success: false, error: 'id: invalid slug after auto-generation — check the English name' }
  }

  const supabase = await createServiceClient()

  // Uniqueness check against menu_items_sync (canonical slug registry).
  const { data: existing, error: lookupError } = await supabase
    .from('menu_items_sync')
    .select('slug')
    .eq('slug', generatedSlug)
    .maybeSingle()

  if (lookupError) {
    console.error('[menu] createMenuItem uniqueness check failed:', lookupError)
    return { success: false, error: lookupError.message }
  }
  if (existing) {
    return { success: false, error: 'هذا المعرف مستخدم، عدّل الاسم الإنجليزي' }
  }

  const { error } = await supabase.from('menu_items').insert({
    ...payload,
    id:         generatedSlug,
    image_url:  payload.image_url || null,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    console.error('[menu] createMenuItem failed:', error)
    return { success: false, error: error.message }
  }

  await supabase.from('audit_logs').insert({
    table_name: 'menu_items',
    action:     'INSERT',
    user_id:    caller.id,
    record_id:  generatedSlug,
    actor_role: caller.role,
    changes:    { action: 'menu_item_created', ...payload, id: generatedSlug },
  })

  bustMenuCaches(generatedSlug)
  return { success: true }
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateMenuItem(
  slug: string,
  data: unknown,
): Promise<{ success: boolean; error?: string }> {
  let caller
  try {
    caller = await requireDashboardSection('menu')
  } catch (err) {
    return { success: false, error: getDashboardGuardErrorMessage(err) }
  }
  // Editing core fields (name/price/description/image/station) is restricted
  // to owner / general_manager. Branch managers + inventory managers can only
  // toggle availability (separate action above).
  if (!DESTRUCTIVE_ROLES.includes(caller.role as StaffRole)) {
    return { success: false, error: 'Forbidden: only owners or general managers can edit items' }
  }

  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) {
    return { success: false, error: 'Invalid slug' }
  }

  const parsed = updatePayloadSchema.safeParse(data)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { success: false, error: first ? `${first.path.join('.')}: ${first.message}` : 'Invalid payload' }
  }
  const payload = parsed.data

  // is_available is intentionally not written here — use toggleMenuItemAvailability.
  const { is_available: _ignored, ...editable } = payload
  void _ignored

  const supabase = await createServiceClient()

  const { error } = await supabase
    .from('menu_items')
    .update({
      ...editable,
      image_url:  editable.image_url || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', slug)

  if (error) {
    console.error('[menu] updateMenuItem failed:', error)
    return { success: false, error: error.message }
  }

  await supabase.from('audit_logs').insert({
    table_name: 'menu_items',
    action:     'UPDATE',
    user_id:    caller.id,
    record_id:  slug,
    actor_role: caller.role,
    changes:    { action: 'menu_item_updated', slug, ...editable },
  })

  bustMenuCaches(slug)
  return { success: true }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteMenuItem(
  slug: string,
): Promise<{ success: boolean; error?: string }> {
  let caller
  try {
    caller = await requireDashboardSection('menu')
  } catch (err) {
    return { success: false, error: getDashboardGuardErrorMessage(err) }
  }
  if (!DESTRUCTIVE_ROLES.includes(caller.role as StaffRole)) {
    return { success: false, error: 'Forbidden: only owners or general managers can delete items' }
  }

  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) {
    return { success: false, error: 'Invalid slug' }
  }

  const supabase = await createServiceClient()

  const { error } = await supabase.from('menu_items').delete().eq('id', slug)
  if (error) {
    console.error('[menu] deleteMenuItem failed:', error)
    return { success: false, error: error.message }
  }

  await supabase.from('audit_logs').insert({
    table_name: 'menu_items',
    action:     'DELETE',
    user_id:    caller.id,
    record_id:  slug,
    actor_role: caller.role,
    changes:    { action: 'menu_item_deleted', slug },
  })

  bustMenuCaches(slug)
  return { success: true }
}
