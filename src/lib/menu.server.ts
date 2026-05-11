import 'server-only'
import { createClient } from '@/lib/supabase/server'
import featuredSlugsData from '@/data/featured.json'
import {
  getRawCategories,
  getSortedRawCategories,
  slugify,
  getCategoryPresentation,
  getCategoryPresentationBySlug,
  normalizeMenuItem,
  type CategoryWithItems,
  type NormalizedMenuItem,
  type MenuItem,
  type MenuCategory,
} from './menu'

// ── Types ─────────────────────────────────────────────────────────────────────

type DbMenuItem = {
  id:             string
  name_ar:        string
  name_en:        string
  description_ar: string | null
  description_en: string | null
  price_bhd:      number
  category:       string
  image_url:      string | null
  station:        string | null
  is_available:   boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const FALLBACK_IMAGE = '/assets/hero/hero-menu.webp'

/** Build a map from item id to raw JSON data (sizes, variants, ingredients…) */
function buildJsonLookup(): Map<string, { item: MenuItem; category: MenuCategory }> {
  const map = new Map<string, { item: MenuItem; category: MenuCategory }>()
  for (const cat of getRawCategories()) {
    for (const item of cat.items) {
      map.set(item.id, { item, category: cat })
    }
  }
  return map
}

function getPriceValues(item: Pick<MenuItem, 'price_bhd' | 'sizes' | 'variants'>): number[] {
  const prices: number[] = []
  if (typeof item.price_bhd === 'number' && item.price_bhd > 0) {
    prices.push(item.price_bhd)
  }
  if (item.sizes) {
    prices.push(...Object.values(item.sizes).filter((p): p is number => typeof p === 'number' && p > 0))
  }
  if (item.variants) {
    prices.push(...item.variants.map((v) => v.price_bhd).filter((p): p is number => typeof p === 'number' && p > 0))
  }
  return prices
}

/**
 * Merge a DB row with its optional JSON counterpart into a NormalizedMenuItem.
 * DB is authoritative for: name, description, price, image, station, is_available.
 * JSON provides: sizes, variants, ingredients, tags, alt (not stored in DB).
 */
function dbRowToNormalized(
  row: DbMenuItem,
  jsonEntry: { item: MenuItem; category: MenuCategory } | null,
): NormalizedMenuItem {
  const categoryPresentation = getCategoryPresentationBySlug(row.category)

  // PostgREST returns NUMERIC columns as JS strings — coerce once here so
  // every downstream `typeof === 'number'` check and Math.min comparison
  // sees a real number. NaN guarded back to null so unpriced items stay so.
  const rawPrice = row.price_bhd as unknown
  const numPrice = rawPrice == null ? null : Number(rawPrice)
  const safePrice = numPrice != null && Number.isFinite(numPrice) ? numPrice : null

  const merged: MenuItem = {
    id:          row.id,
    name:        { ar: row.name_ar, en: row.name_en },
    description: row.description_ar || row.description_en
      ? { ar: row.description_ar ?? '', en: row.description_en ?? '' }
      : jsonEntry?.item.description,
    price_bhd:   safePrice,
    image_url:   row.image_url ?? undefined,
    available:   row.is_available,
    station:     (row.station ?? 'unassigned') as MenuItem['station'],
    // JSON-only fields preserved as-is
    sizes:       jsonEntry?.item.sizes,
    variants:    jsonEntry?.item.variants,
    ingredients: jsonEntry?.item.ingredients,
    tags:        jsonEntry?.item.tags,
    alt:         jsonEntry?.item.alt,
  }

  const priceValues = getPriceValues(merged)
  const hasSizes    = Boolean(merged.sizes    && Object.keys(merged.sizes).length   > 0)
  const hasVariants = Boolean(merged.variants && merged.variants.length              > 0)

  return {
    ...merged,
    slug:              row.id,
    categorySlug:      row.category,
    categoryName:      categoryPresentation.name,
    fromPrice:         priceValues.length > 0 ? Math.min(...priceValues) : (safePrice ?? 0),
    hasMultiplePrices: priceValues.length > 1 && new Set(priceValues.map((p) => p.toFixed(3))).size > 1,
    pricingKind:
      hasSizes && hasVariants ? 'sizes_variants'
      : hasSizes              ? 'sizes'
      : hasVariants           ? 'variants'
      : typeof safePrice === 'number' ? 'single'
      : 'unpriced',
    image:       row.image_url?.trim() || FALLBACK_IMAGE,
    ingredients: jsonEntry?.item.ingredients ?? [],
  }
}

// ── Pure-JSON fallback (used when DB is empty or unreachable) ─────────────────

function getFallbackMenuData(): CategoryWithItems[] {
  return getSortedRawCategories().map((cat) => ({
    id:     slugify(cat.category.en),
    nameAR: getCategoryPresentation(cat).name.ar,
    nameEN: getCategoryPresentation(cat).name.en,
    items:  cat.items.map((item) => normalizeMenuItem(item, cat)),
  }))
}

// ── Exports ───────────────────────────────────────────────────────────────────

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

/**
 * Hybrid DB-first menu loader.
 *
 * 1. Reads ALL items from menu_items (DB is the single source of truth).
 * 2. Enriches each row with sizes/variants/ingredients from the JSON fixture
 *    for items that originated from JSON.
 * 3. Groups by category slug, sorted by CATEGORY_PRESENTATION order.
 * 4. Falls back to pure-JSON rendering if the DB is empty or unreachable.
 *
 * Dashboard-created items (not in JSON) become immediately visible to customers.
 */
export async function getMenuData(): Promise<CategoryWithItems[]> {
  try {
    const supabase = await createClient()
    const { data: dbItems, error } = await supabase
      .from('menu_items')
      .select('id, name_ar, name_en, description_ar, description_en, price_bhd, category, image_url, station, is_available')

    if (error) {
      console.error('[menu] getMenuData DB fetch failed:', error)
      return getFallbackMenuData()
    }

    if (!dbItems || dbItems.length === 0) {
      return getFallbackMenuData()
    }

    const jsonLookup = buildJsonLookup()
    const normalized = (dbItems as DbMenuItem[]).map((row) =>
      dbRowToNormalized(row, jsonLookup.get(row.id) ?? null),
    )

    // Group by category
    const catMap = new Map<string, NormalizedMenuItem[]>()
    for (const item of normalized) {
      const arr = catMap.get(item.categorySlug) ?? []
      arr.push(item)
      catMap.set(item.categorySlug, arr)
    }

    // Sort categories by CATEGORY_PRESENTATION order
    return [...catMap.entries()]
      .sort(([a], [b]) => getCategoryPresentationBySlug(a).order - getCategoryPresentationBySlug(b).order)
      .map(([catSlug, items]) => {
        const pres = getCategoryPresentationBySlug(catSlug)
        return {
          id:     catSlug,
          nameAR: pres.name.ar,
          nameEN: pres.name.en,
          items,
        }
      })
  } catch (err) {
    console.error('[menu] getMenuData failed:', err)
    return getFallbackMenuData()
  }
}
