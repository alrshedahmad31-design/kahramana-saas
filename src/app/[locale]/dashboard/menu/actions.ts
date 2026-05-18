'use server'

import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { createServiceClient } from '@/lib/supabase/server'
import { toSafeError } from '@/lib/utils/safe-error'
import {
  getDashboardGuardErrorMessage,
  requireDashboardSection,
} from '@/lib/auth/dashboard-guards'
import { slugify } from '@/lib/menu'
import menuData from '@/data/menu.json'
import { MENU_CATEGORY_IDS, getSlugPrefix } from '@/constants/menu-categories'
import { ALL_STATIONS } from '@/lib/kds/constants'
import { isSafeImageUrl, IMAGE_URL_ERROR } from '@/lib/security/image-url'
import type { StaffRole, KDSStation } from '@/lib/supabase/custom-types'
import type { Json } from '@/lib/supabase/types'

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

// Station list is single-source via STATION_CONFIG (constants/kds.ts).
// zod requires a tuple — assert ALL_STATIONS has at least one element.
const STATIONS = ALL_STATIONS as [KDSStation, ...KDSStation[]]

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
  image_url:      z.string().trim().max(500).optional().default('').refine(isSafeImageUrl, IMAGE_URL_ERROR),
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

// ── RPC envelope mapping ──────────────────────────────────────────────────────

type RpcEnvelope = { ok: true; id?: string; count?: number } | { ok: false; code: string }

function isRpcEnvelope(v: unknown): v is RpcEnvelope {
  return typeof v === 'object' && v !== null && 'ok' in v
}

async function mapMenuRpcError(code: string, fallback: string): Promise<string> {
  const t = await getTranslations('dashboard')
  switch (code) {
    case 'forbidden_role': return 'Forbidden: only owners or general managers can perform this action'
    case 'slug_taken':     return t('slug_taken')
    case 'not_found':      return 'Menu item not found'
    case 'invalid_input':  return 'Invalid payload'
    default:               return fallback
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function bustMenuCaches(slug?: string) {
  // Dashboard
  revalidatePath('/[locale]/dashboard/menu', 'page')
  revalidatePath('/dashboard/menu')
  revalidatePath('/en/dashboard/menu')
  revalidatePath('/ar/dashboard/menu')

  // Customer-facing menu surfaces (both locales)
  for (const locale of ['ar', 'en'] as const) {
    const prefix = locale === 'ar' ? '/ar' : '/en'
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
  try {
    await requireDashboardSection('menu')
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
  const { data: raw, error } = await supabase.rpc('rpc_set_menu_item_available', {
    p_slug:      slug,
    p_available: isAvailable,
  })

  if (error) {
    Sentry.captureException(error, { tags: { area: 'menu', action: 'toggleMenuItemAvailability' } })
    return { success: false, error: toSafeError(error) }
  }
  const rpc = isRpcEnvelope(raw) ? raw : null
  if (!rpc || !rpc.ok) {
    return { success: false, error: await mapMenuRpcError(rpc?.code ?? 'unknown', 'Toggle failed') }
  }

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
      station:        (item.station || 'unassigned'),
    })),
  )

  if (allItems.length === 0) return { success: true, count: 0 }

  const supabase = await createServiceClient()
  const { data: raw, error } = await supabase.rpc('rpc_upsert_menu_items', {
    p_items: allItems as unknown as Json,
  })

  if (error) {
    Sentry.captureException(error, { tags: { area: 'menu', action: 'syncMenuItemsWithDatabase' } })
    return { success: false, error: toSafeError(error) }
  }
  const rpc = isRpcEnvelope(raw) ? raw : null
  if (!rpc || !rpc.ok) {
    return { success: false, error: await mapMenuRpcError(rpc?.code ?? 'unknown', 'Sync failed') }
  }

  bustMenuCaches()
  return { success: true, count: rpc.count ?? allItems.length }
}

// ── Export to JSON ────────────────────────────────────────────────────────────

export async function exportMenuItems(): Promise<{
  success: boolean
  error?: string
  data?: { exported_at: string; count: number; items: unknown[] }
}> {
  let caller
  try {
    caller = await requireDashboardSection('menu')
  } catch (err) {
    return { success: false, error: getDashboardGuardErrorMessage(err) }
  }
  if (!DESTRUCTIVE_ROLES.includes(caller.role as StaffRole)) {
    return { success: false, error: 'Forbidden: only owners or general managers can export menu' }
  }

  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .order('category', { ascending: true })
    .order('id',       { ascending: true })

  if (error) {
    console.error('[menu] exportMenuItems failed:', error)
    return { success: false, error: toSafeError(error) }
  }

  return {
    success: true,
    data: {
      exported_at: new Date().toISOString(),
      count:       data?.length ?? 0,
      items:       data ?? [],
    },
  }
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
    : `${getSlugPrefix(payload.category)}-${slugify(payload.name_en)}`

  if (!SLUG_RE.test(generatedSlug)) {
    return { success: false, error: 'id: invalid slug after auto-generation — check the English name' }
  }

  const supabase = await createServiceClient()
  const { data: raw, error } = await supabase.rpc('rpc_create_menu_item', {
    p_payload: {
      ...payload,
      id:        generatedSlug,
      image_url: payload.image_url || null,
    } as unknown as Json,
  })

  if (error) {
    Sentry.captureException(error, { tags: { area: 'menu', action: 'createMenuItem' } })
    return { success: false, error: toSafeError(error) }
  }
  const rpc = isRpcEnvelope(raw) ? raw : null
  if (!rpc || !rpc.ok) {
    return { success: false, error: await mapMenuRpcError(rpc?.code ?? 'unknown', 'Create failed') }
  }

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
  const { data: raw, error } = await supabase.rpc('rpc_update_menu_item', {
    p_slug:    slug,
    p_payload: { ...editable, image_url: editable.image_url || null } as unknown as Json,
  })

  if (error) {
    Sentry.captureException(error, { tags: { area: 'menu', action: 'updateMenuItem' } })
    return { success: false, error: toSafeError(error) }
  }
  const rpc = isRpcEnvelope(raw) ? raw : null
  if (!rpc || !rpc.ok) {
    return { success: false, error: await mapMenuRpcError(rpc?.code ?? 'unknown', 'Update failed') }
  }

  bustMenuCaches(slug)
  return { success: true }
}

// ── Menu modifiers (option groups + options) ──────────────────────────────────

export interface MenuOptionRow {
  id:              string
  group_id:        string
  name_ar:         string
  name_en:         string
  price_modifier:  number
  is_available:    boolean
  sort_order:      number
}

export interface MenuOptionGroupRow {
  id:              string
  menu_item_slug:  string
  name_ar:         string
  name_en:         string
  required:        boolean
  multi_select:    boolean
  sort_order:      number
  options:         MenuOptionRow[]
}

const groupSchema = z.object({
  id:              z.string().uuid().optional(),
  menu_item_slug:  z.string().min(1).max(120).regex(SLUG_RE, 'invalid slug'),
  name_ar:         z.string().trim().min(1).max(120),
  name_en:         z.string().trim().min(1).max(120),
  required:        z.boolean().optional().default(false),
  multi_select:    z.boolean().optional().default(false),
  sort_order:      z.number().int().min(0).max(999).optional().default(0),
})

const optionSchema = z.object({
  id:              z.string().uuid().optional(),
  group_id:        z.string().uuid(),
  name_ar:         z.string().trim().min(1).max(120),
  name_en:         z.string().trim().min(1).max(120),
  price_modifier:  z.number().min(-1000).max(1000),
  is_available:    z.boolean().optional().default(true),
  sort_order:      z.number().int().min(0).max(999).optional().default(0),
})

export async function listMenuOptionGroups(slug: string): Promise<{
  success: boolean
  groups?: MenuOptionGroupRow[]
  error?: string
}> {
  try {
    await requireDashboardSection('menu')
  } catch (err) {
    return { success: false, error: getDashboardGuardErrorMessage(err) }
  }

  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) {
    return { success: false, error: 'Invalid slug' }
  }

  const supabase = await createServiceClient()
  const { data: groups, error: groupsError } = await supabase
    .from('menu_option_groups')
    .select('*')
    .eq('menu_item_slug', slug)
    .order('sort_order', { ascending: true })

  if (groupsError) {
    console.error('[menu] listMenuOptionGroups groups failed:', groupsError)
    return { success: false, error: groupsError.message }
  }

  const groupIds = (groups ?? []).map((g) => g.id)
  let opts: MenuOptionRow[] = []
  if (groupIds.length > 0) {
    const { data, error } = await supabase
      .from('menu_options')
      .select('*')
      .in('group_id', groupIds)
      .order('sort_order', { ascending: true })
    if (error) {
      console.error('[menu] listMenuOptionGroups options failed:', error)
      return { success: false, error: toSafeError(error) }
    }
    opts = (data ?? []) as MenuOptionRow[]
  }

  const merged: MenuOptionGroupRow[] = (groups ?? []).map((g) => ({
    ...(g as unknown as Omit<MenuOptionGroupRow, 'options'>),
    options: opts.filter((o) => o.group_id === g.id),
  }))

  return { success: true, groups: merged }
}

export async function upsertMenuOptionGroup(input: unknown): Promise<{
  success: boolean
  id?: string
  error?: string
}> {
  let caller
  try {
    caller = await requireDashboardSection('menu')
  } catch (err) {
    return { success: false, error: getDashboardGuardErrorMessage(err) }
  }
  if (!DESTRUCTIVE_ROLES.includes(caller.role as StaffRole)) {
    return { success: false, error: 'Forbidden' }
  }

  const parsed = groupSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { success: false, error: first ? `${first.path.join('.')}: ${first.message}` : 'Invalid payload' }
  }
  const payload = parsed.data

  const supabase = await createServiceClient()
  const { data: raw, error } = await supabase.rpc('rpc_upsert_menu_option_group', {
    p_payload: payload as unknown as Json,
  })

  if (error) {
    Sentry.captureException(error, { tags: { area: 'menu', action: 'upsertMenuOptionGroup' } })
    return { success: false, error: toSafeError(error) }
  }
  const rpc = isRpcEnvelope(raw) ? raw : null
  if (!rpc || !rpc.ok) {
    return { success: false, error: await mapMenuRpcError(rpc?.code ?? 'unknown', 'Upsert failed') }
  }

  bustMenuCaches(payload.menu_item_slug)
  return { success: true, id: rpc.id }
}

export async function deleteMenuOptionGroup(groupId: string, slug: string): Promise<{
  success: boolean
  error?: string
}> {
  let caller
  try {
    caller = await requireDashboardSection('menu')
  } catch (err) {
    return { success: false, error: getDashboardGuardErrorMessage(err) }
  }
  if (!DESTRUCTIVE_ROLES.includes(caller.role as StaffRole)) {
    return { success: false, error: 'Forbidden' }
  }

  if (!z.string().uuid().safeParse(groupId).success) {
    return { success: false, error: 'Invalid id' }
  }

  const supabase = await createServiceClient()
  const { data: raw, error } = await supabase.rpc('rpc_delete_menu_option_group', { p_id: groupId })

  if (error) {
    Sentry.captureException(error, { tags: { area: 'menu', action: 'deleteMenuOptionGroup' } })
    return { success: false, error: toSafeError(error) }
  }
  const rpc = isRpcEnvelope(raw) ? raw : null
  if (!rpc || !rpc.ok) {
    return { success: false, error: await mapMenuRpcError(rpc?.code ?? 'unknown', 'Delete failed') }
  }

  bustMenuCaches(slug)
  return { success: true }
}

export async function upsertMenuOption(input: unknown): Promise<{
  success: boolean
  id?: string
  error?: string
}> {
  let caller
  try {
    caller = await requireDashboardSection('menu')
  } catch (err) {
    return { success: false, error: getDashboardGuardErrorMessage(err) }
  }
  if (!DESTRUCTIVE_ROLES.includes(caller.role as StaffRole)) {
    return { success: false, error: 'Forbidden' }
  }

  const parsed = optionSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return { success: false, error: first ? `${first.path.join('.')}: ${first.message}` : 'Invalid payload' }
  }
  const payload = parsed.data

  const supabase = await createServiceClient()
  const { data: raw, error } = await supabase.rpc('rpc_upsert_menu_option', {
    p_payload: payload as unknown as Json,
  })

  if (error) {
    Sentry.captureException(error, { tags: { area: 'menu', action: 'upsertMenuOption' } })
    return { success: false, error: toSafeError(error) }
  }
  const rpc = isRpcEnvelope(raw) ? raw : null
  if (!rpc || !rpc.ok) {
    return { success: false, error: await mapMenuRpcError(rpc?.code ?? 'unknown', 'Upsert failed') }
  }

  bustMenuCaches()
  return { success: true, id: rpc.id }
}

export async function deleteMenuOption(optionId: string): Promise<{
  success: boolean
  error?: string
}> {
  let caller
  try {
    caller = await requireDashboardSection('menu')
  } catch (err) {
    return { success: false, error: getDashboardGuardErrorMessage(err) }
  }
  if (!DESTRUCTIVE_ROLES.includes(caller.role as StaffRole)) {
    return { success: false, error: 'Forbidden' }
  }

  if (!z.string().uuid().safeParse(optionId).success) {
    return { success: false, error: 'Invalid id' }
  }

  const supabase = await createServiceClient()
  const { data: raw, error } = await supabase.rpc('rpc_delete_menu_option', { p_id: optionId })

  if (error) {
    Sentry.captureException(error, { tags: { area: 'menu', action: 'deleteMenuOption' } })
    return { success: false, error: toSafeError(error) }
  }
  const rpc = isRpcEnvelope(raw) ? raw : null
  if (!rpc || !rpc.ok) {
    return { success: false, error: await mapMenuRpcError(rpc?.code ?? 'unknown', 'Delete failed') }
  }

  bustMenuCaches()
  return { success: true }
}

// ── Upload image to Supabase Storage ──────────────────────────────────────────

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/webp', 'image/jpeg', 'image/png'])

export async function uploadMenuImage(
  formData: FormData,
): Promise<
  | { success: true; url: string }
  | { success: false; error: string }
> {
  let caller
  try {
    caller = await requireDashboardSection('menu')
  } catch (err) {
    return { success: false, error: getDashboardGuardErrorMessage(err) }
  }
  if (!DESTRUCTIVE_ROLES.includes(caller.role as StaffRole)) {
    return { success: false, error: 'Forbidden: only owners or general managers can upload images' }
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return { success: false, error: 'Missing file' }
  }
  if (file.size === 0) {
    return { success: false, error: 'Empty file' }
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const t = await getTranslations('dashboard')
    return { success: false, error: t('file_too_large') }
  }
  if (!ALLOWED_MIME.has(file.type)) {
    const t = await getTranslations('dashboard')
    return { success: false, error: t('file_format_unsupported') }
  }

  const ext =
    file.type === 'image/webp' ? 'webp' :
    file.type === 'image/png'  ? 'png'  : 'jpg'
  const objectName = `menu/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`

  const supabase = await createServiceClient()
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('menu-images')
    .upload(objectName, buffer, {
      contentType: file.type,
      cacheControl: '31536000, immutable',
      upsert: false,
    })

  if (uploadError) {
    console.error('[menu] uploadMenuImage failed:', uploadError)
    return { success: false, error: uploadError.message }
  }

  const { data } = supabase.storage.from('menu-images').getPublicUrl(objectName)

  await supabase.from('audit_logs').insert({
    table_name: 'storage.objects',
    action:     'INSERT',
    user_id:    caller.id,
    record_id:  objectName,
    actor_role: caller.role,
    changes:    { action: 'menu_image_uploaded', size: file.size, mime: file.type },
  })

  return { success: true, url: data.publicUrl }
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
  const { data: raw, error } = await supabase.rpc('rpc_delete_menu_item', { p_slug: slug })

  if (error) {
    Sentry.captureException(error, { tags: { area: 'menu', action: 'deleteMenuItem' } })
    return { success: false, error: toSafeError(error) }
  }
  const rpc = isRpcEnvelope(raw) ? raw : null
  if (!rpc || !rpc.ok) {
    return { success: false, error: await mapMenuRpcError(rpc?.code ?? 'unknown', 'Delete failed') }
  }

  bustMenuCaches(slug)
  return { success: true }
}
