import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { POSModifierGroup, POSModifierOption } from '@/components/pos/types'

interface RawGroup {
  id:             string
  menu_item_slug: string
  name_ar:        string
  name_en:        string
  required:       boolean
  multi_select:   boolean
  sort_order:     number
}

interface RawOption {
  id:             string
  group_id:       string
  name_ar:        string
  name_en:        string
  price_modifier: number
  is_available:   boolean
  sort_order:     number
}

/**
 * Loads modifier groups (and their available options) for every menu item,
 * keyed by menu_item_slug. Used by POS, Service Mode, Waiter, and QR-table
 * surfaces so a client cannot supply a modifier the server can't validate.
 *
 * Fails CLOSED: on any DB error returns an empty Map so the order RPC's
 * modifier validation rejects client-supplied modifiers rather than silently
 * accepting a "no modifiers" UI state. Never throws — ordering must remain
 * possible even if the modifier table is unreachable.
 */
export async function loadModifierGroupsBySlug(): Promise<Map<string, POSModifierGroup[]>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const map = new Map<string, POSModifierGroup[]>()
  if (!url || !key) return map

  // Untyped client until `Database` types are regenerated for migration 082.
  const supabase = createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: groups, error: groupsError } = await supabase
    .from('menu_option_groups')
    .select('*')
    .order('sort_order', { ascending: true })

  if (groupsError) {
    console.error('[modifiers] menu_option_groups query failed:', groupsError)
    return map
  }
  if (!groups || groups.length === 0) return map

  const groupRows = groups as RawGroup[]
  const groupIds  = groupRows.map((g) => g.id)

  const { data: options, error: optionsError } = await supabase
    .from('menu_options')
    .select('*')
    .in('group_id', groupIds)
    .eq('is_available', true)
    .order('sort_order', { ascending: true })

  if (optionsError) {
    console.error('[modifiers] menu_options query failed:', optionsError)
    return map
  }

  const optionRows = (options ?? []) as RawOption[]
  const optionsByGroup = new Map<string, POSModifierOption[]>()
  for (const o of optionRows) {
    const arr = optionsByGroup.get(o.group_id) ?? []
    arr.push({
      id:            o.id,
      nameAr:        o.name_ar,
      nameEn:        o.name_en,
      priceModifier: Number(o.price_modifier),
      isAvailable:   o.is_available,
    })
    optionsByGroup.set(o.group_id, arr)
  }

  for (const g of groupRows) {
    const groupOptions = optionsByGroup.get(g.id) ?? []
    if (groupOptions.length === 0) continue
    const list = map.get(g.menu_item_slug) ?? []
    list.push({
      id:           g.id,
      nameAr:       g.name_ar,
      nameEn:       g.name_en,
      required:     g.required,
      multiSelect:  g.multi_select,
      options:      groupOptions,
    })
    map.set(g.menu_item_slug, list)
  }

  return map
}
