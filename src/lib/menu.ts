import menuData from '@/data/menu.json'
import featuredSlugsData from '@/data/featured.json'

export type LocaleCode = 'ar' | 'en'

export interface MenuSizeMap {
  S?: number
  M?: number
  L?: number
  XL?: number
  Glass?: number
  '0.5L'?: number
  '1L'?: number
  '1.5L'?: number
  '1KG'?: number
  'HALF KG'?: number
}

export interface MenuVariantOption {
  label: {
    ar: string
    en: string
  }
  price_bhd?: number
}

export interface MenuItem {
  id: string
  name: {
    ar: string
    en: string
  }
  description?: {
    ar: string
    en: string
  }
  alt?: {
    ar: string
    en: string
  }
  image_url?: string
  available: boolean
  price_bhd?: number | null
  sizes?: MenuSizeMap
  variants?: MenuVariantOption[]
  tags?: string[]
}

export interface MenuCategory {
  category: {
    ar: string
    en: string
    description?: {
      ar: string
      en: string
    }
  }
  items: MenuItem[]
}

export interface NormalizedMenuCategory {
  slug: string
  name: {
    ar: string
    en: string
  }
  description?: {
    ar: string
    en: string
  }
  itemCount: number
}

export interface NormalizedMenuItem extends MenuItem {
  slug: string
  categorySlug: string
  categoryName: {
    ar: string
    en: string
  }
  fromPrice: number
  hasMultiplePrices: boolean
  pricingKind: 'single' | 'sizes' | 'variants' | 'sizes_variants' | 'unpriced'
  image: string
}

export interface CategoryWithItems {
  id: string
  nameAR: string
  nameEN?: string
  items: NormalizedMenuItem[]
}

export interface MenuPriceSelection {
  size?: string
  variant?: string
}

const FALLBACK_MENU_IMAGE = '/assets/hero/hero-menu.webp'

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// const EXCLUDED_CATEGORY_SLUGS: string[] = []

function getRawCategories(): MenuCategory[] {
  return menuData as MenuCategory[]
}

function getPriceValues(item: MenuItem): number[] {
  if (typeof item.price_bhd === 'number') return [item.price_bhd]

  if (item.sizes) {
    return Object.values(item.sizes).filter(
      (price): price is number => typeof price === 'number',
    )
  }

  if (item.variants) {
    return item.variants
      .map((variant) => variant.price_bhd)
      .filter((price): price is number => typeof price === 'number')
  }

  return []
}

export function getItemImageOrFallback(item: Pick<MenuItem, 'image_url'>): string {
  return item.image_url?.trim() || FALLBACK_MENU_IMAGE
}

export function resolveMenuItemPrice(
  item: MenuItem,
  selection: MenuPriceSelection = {},
): number {
  if (typeof item.price_bhd === 'number') return item.price_bhd

  if (item.sizes) {
    const selectedSizePrice = selection.size
      ? (item.sizes as Record<string, number | undefined>)[selection.size]
      : undefined

    if (typeof selectedSizePrice === 'number') return selectedSizePrice

    const sizePrices = Object.values(item.sizes).filter(
      (price): price is number => typeof price === 'number',
    )
    return sizePrices.length > 0 ? Math.min(...sizePrices) : 0
  }

  if (item.variants) {
    const selectedVariant = selection.variant
      ? item.variants.find(
          (variant) =>
            variant.label.en === selection.variant ||
            variant.label.ar === selection.variant,
        )
      : undefined

    if (typeof selectedVariant?.price_bhd === 'number') {
      return selectedVariant.price_bhd
    }

    const variantPrices = item.variants
      .map((variant) => variant.price_bhd)
      .filter((price): price is number => typeof price === 'number')
    return variantPrices.length > 0 ? Math.min(...variantPrices) : 0
  }

  return 0
}

export function normalizeMenuItem(
  item: MenuItem,
  category: MenuCategory,
): NormalizedMenuItem {
  const categorySlug = slugify(category.category.en)
  const priceValues = getPriceValues(item)
  const hasSizes = Boolean(item.sizes && Object.keys(item.sizes).length > 0)
  const hasVariants = Boolean(item.variants && item.variants.length > 0)

  return {
    ...item,
    slug: item.id,
    categorySlug,
    categoryName: {
      ar: category.category.ar,
      en: category.category.en,
    },
    fromPrice: priceValues.length > 0 ? Math.min(...priceValues) : 0,
    hasMultiplePrices:
      priceValues.length > 1 && new Set(priceValues.map((price) => price.toFixed(3))).size > 1,
    pricingKind:
      hasSizes && hasVariants
        ? 'sizes_variants'
        : hasSizes
          ? 'sizes'
          : hasVariants
            ? 'variants'
            : typeof item.price_bhd === 'number'
              ? 'single'
              : 'unpriced',
    image: getItemImageOrFallback(item),
  }
}

export function getMenuCategories(): NormalizedMenuCategory[] {
  return getRawCategories().map((category) => ({
    slug: slugify(category.category.en),
    name: {
      ar: category.category.ar,
      en: category.category.en,
    },
    description: category.category.description,
    itemCount: category.items.length,
  }))
}

export function getAllMenuItems(): NormalizedMenuItem[] {
  return getRawCategories().flatMap((category) =>
    category.items.map((item) => normalizeMenuItem(item, category)),
  )
}

export function getItemsByCategory(categorySlug: string): NormalizedMenuItem[] {
  return getAllMenuItems().filter((item) => item.categorySlug === categorySlug)
}

export function getMenuCategoryBySlug(
  categorySlug: string,
): NormalizedMenuCategory | null {
  return getMenuCategories().find((category) => category.slug === categorySlug) ?? null
}

export function getMenuItemBySlug(slug: string): NormalizedMenuItem | null {
  return getAllMenuItems().find((item) => item.slug === slug) ?? null
}

export function searchMenuItems(query: string): NormalizedMenuItem[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return getAllMenuItems()

  return getAllMenuItems().filter((item) => {
    const searchableText = [
      item.name.ar,
      item.name.en,
      item.description?.ar,
      item.description?.en,
      item.categoryName.ar,
      item.categoryName.en,
    ]
      .filter((value): value is string => Boolean(value))
      .join(' ')
      .toLowerCase()

    return searchableText.includes(normalizedQuery)
  })
}

export function getRelatedItems(
  itemSlug: string,
  limit = 4,
): NormalizedMenuItem[] {
  const item = getMenuItemBySlug(itemSlug)
  if (!item) return []

  return getItemsByCategory(item.categorySlug)
    .filter((candidate) => candidate.slug !== item.slug && candidate.available)
    .slice(0, limit)
}

export function getMenuItemsByIds(ids: readonly string[]): MenuItem[] {
  const wanted = new Set(ids)
  return getAllMenuItems()
    .filter((item) => wanted.has(item.id))
    .sort((first, second) => ids.indexOf(first.id) - ids.indexOf(second.id))
}

export function getCategorySlugs(): string[] {
  return getMenuCategories().map((category) => category.slug)
}

export function getItemSlugs(): string[] {
  return getAllMenuItems().map((item) => item.slug)
}

export async function getFeaturedSlugs(): Promise<string[]> {
  // To swap for Supabase: return (await supabase.from('featured_items').select('id')).data?.map(r => r.id) ?? []
  return featuredSlugsData
}

export async function getMenuData(): Promise<CategoryWithItems[]> {
  const categories = getRawCategories()
  return categories.map((cat) => ({
    id: slugify(cat.category.en),
    nameAR: cat.category.ar,
    nameEN: cat.category.en,
    items: cat.items.map((item) => normalizeMenuItem(item, cat)),
  }))
}
