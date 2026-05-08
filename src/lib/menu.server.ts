import 'server-only'
import { createClient } from '@/lib/supabase/server'
import featuredSlugsData from '@/data/featured.json'
import {
  getSortedRawCategories,
  slugify,
  getCategoryPresentation,
  normalizeMenuItem,
  type CategoryWithItems,
} from './menu'

export async function getFeaturedSlugs(): Promise<string[]> {
  return featuredSlugsData
}

export async function getMenuAvailabilityMap(): Promise<Map<string, boolean>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('menu_items')
      .select('id, is_available')
    if (error || !data) return new Map()
    const map = new Map<string, boolean>()
    for (const row of data) {
      if (typeof row.id === 'string' && typeof row.is_available === 'boolean') {
        map.set(row.id, row.is_available)
      }
    }
    return map
  } catch (err) {
    console.error('[menu] getMenuAvailabilityMap failed:', err)
    return new Map()
  }
}

export async function getMenuData(): Promise<CategoryWithItems[]> {
  const rawCategories = getSortedRawCategories()
  const jsonCategories: CategoryWithItems[] = rawCategories.map((cat) => ({
    id:     slugify(cat.category.en),
    nameAR: getCategoryPresentation(cat).name.ar,
    nameEN: getCategoryPresentation(cat).name.en,
    items:  cat.items.map((item) => normalizeMenuItem(item, cat)),
  }))

  const availabilityMap = await getMenuAvailabilityMap()
  if (availabilityMap.size === 0) return jsonCategories

  return jsonCategories.map((cat) => ({
    ...cat,
    items: cat.items.map((item) => ({
      ...item,
      available: availabilityMap.has(item.slug)
        ? availabilityMap.get(item.slug)!
        : item.available,
    })),
  }))
}
