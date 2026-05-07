import 'server-only'
import { createClient } from '@/lib/supabase/server'
import featuredSlugsData from '@/data/featured.json'
import { 
  getSortedRawCategories, 
  slugify, 
  getCategoryPresentation, 
  normalizeMenuItem,
  type CategoryWithItems 
} from './menu'

export async function getFeaturedSlugs(): Promise<string[]> {
  // To swap for Supabase: return (await supabase.from('featured_items').select('id')).data?.map(r => r.id) ?? []
  return featuredSlugsData
}

export async function getMenuData(): Promise<CategoryWithItems[]> {
  const categories = getSortedRawCategories()
  
  // Fetch availability from Supabase
  const supabase = await createClient()
  // menu_items is not in generated types yet (table exists in DB)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: availabilityData } = await (supabase as any)
    .from('menu_items')
    .select('id, is_available')

  const availabilityMap = new Map<string, boolean>(
    (availabilityData as { id: string; is_available: boolean }[] | null)?.map(
      (r: { id: string; is_available: boolean }) => [r.id, r.is_available]
    ) ?? []
  )

  return categories.map((cat) => ({
    id: slugify(cat.category.en),
    nameAR: getCategoryPresentation(cat).name.ar,
    nameEN: getCategoryPresentation(cat).name.en,
    items: cat.items.map((item) => {
      const normalized = normalizeMenuItem(item, cat)
      // Override with DB availability if exists
      if (availabilityMap.has(item.id)) {
        normalized.available = availabilityMap.get(item.id)!
      }
      return normalized
    }),
  }))
}
