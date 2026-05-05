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

export interface CheckoutPriceResult {
  item: NormalizedMenuItem
  unitPriceBhd: number
  selectedVariant: string | null
}

const FALLBACK_MENU_IMAGE = '/assets/hero/hero-menu.webp'

const CATEGORY_PRESENTATION: Record<
  string,
  {
    order: number
    name: {
      ar: string
      en: string
    }
  }
> = {
  'kahramana-signature-selection': {
    order: 10,
    name: {
      ar: 'مختارات كهرمانة',
      en: 'Kahramana Selections',
    },
  },
  'the-heritage-breakfast': {
    order: 20,
    name: {
      ar: 'الفطور البغدادي',
      en: 'Baghdadi Breakfast',
    },
  },
  'the-cold-mezza-garden': {
    order: 30,
    name: {
      ar: 'المقبلات الباردة',
      en: 'Cold Mezza',
    },
  },
  'the-hot-mezza-garden': {
    order: 40,
    name: {
      ar: 'المقبلات الساخنة',
      en: 'Hot Mezza',
    },
  },
  'garden-fresh-salads': {
    order: 50,
    name: {
      ar: 'السلطات',
      en: 'Salads',
    },
  },
  'warm-and-comforting-soups': {
    order: 60,
    name: {
      ar: 'الشوربات',
      en: 'Soups',
    },
  },
  'baghdadi-culinary-masterpieces': {
    order: 70,
    name: {
      ar: 'الأطباق الرئيسية',
      en: 'Main Courses',
    },
  },
  'the-authentic-stew-house': {
    order: 80,
    name: {
      ar: 'المرق العراقي',
      en: 'Iraqi Stews',
    },
  },
  'the-fatteh-collection': {
    order: 90,
    name: {
      ar: 'الفتّة',
      en: 'Fatteh',
    },
  },
  'baghdadi-tandoor-selection': {
    order: 100,
    name: {
      ar: 'المشويات والتنور',
      en: 'Grills & Tandoor',
    },
  },
  'the-shawarma-suite-kaas': {
    order: 110,
    name: {
      ar: 'الشاورما العراقية',
      en: 'Iraqi Shawarma',
    },
  },
  'artisan-stone-oven-pizza': {
    order: 120,
    name: {
      ar: 'بيتزا كهرمانة',
      en: 'Kahramana Pizza',
    },
  },
  'traditional-sandwiches': {
    order: 130,
    name: {
      ar: 'السندويتشات',
      en: 'Sandwiches',
    },
  },
  'the-sweet-finale': {
    order: 140,
    name: {
      ar: 'الحلويات',
      en: 'Desserts',
    },
  },
  'fresh-signature-juices': {
    order: 150,
    name: {
      ar: 'العصائر الطازجة',
      en: 'Fresh Juices',
    },
  },
  'the-heritage-tea-and-coffee': {
    order: 160,
    name: {
      ar: 'الشاي والقهوة',
      en: 'Tea & Coffee',
    },
  },
}

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

function getCategoryPresentation(category: MenuCategory) {
  const slug = slugify(category.category.en)
  return CATEGORY_PRESENTATION[slug] ?? {
    order: Number.MAX_SAFE_INTEGER,
    name: {
      ar: category.category.ar,
      en: category.category.en,
    },
  }
}

function getSortedRawCategories(): MenuCategory[] {
  return [...getRawCategories()].sort(
    (first, second) =>
      getCategoryPresentation(first).order - getCategoryPresentation(second).order,
  )
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

export function resolveCheckoutMenuItemPrice(
  slug: string,
  selection: MenuPriceSelection = {},
): CheckoutPriceResult | { error: string } {
  const item = getMenuItemBySlug(slug)
  if (!item) return { error: 'Menu item not found' }
  if (!item.available) return { error: `${item.name.en} is unavailable` }

  const hasSizes = Boolean(item.sizes && Object.keys(item.sizes).length > 0)
  const hasVariants = Boolean(item.variants && item.variants.length > 0)

  if (hasSizes) {
    if (!selection.size) return { error: `Missing size for ${item.name.en}` }
    const sizePrice = (item.sizes as Record<string, number | undefined>)[selection.size]
    if (typeof sizePrice !== 'number') {
      return { error: `Invalid size for ${item.name.en}` }
    }
  }

  let selectedVariant: string | null = null
  if (hasVariants) {
    if (!selection.variant) return { error: `Missing variant for ${item.name.en}` }
    const variant = item.variants?.find(
      (option) =>
        option.label.en === selection.variant ||
        option.label.ar === selection.variant,
    )
    if (!variant) return { error: `Invalid variant for ${item.name.en}` }
    selectedVariant = variant.label.ar
  }

  const unitPriceBhd = resolveMenuItemPrice(item, selection)
  if (unitPriceBhd <= 0) return { error: `Invalid price for ${item.name.en}` }

  return { item, unitPriceBhd, selectedVariant }
}

export function normalizeMenuItem(
  item: MenuItem,
  category: MenuCategory,
): NormalizedMenuItem {
  const categorySlug = slugify(category.category.en)
  const categoryPresentation = getCategoryPresentation(category)
  const priceValues = getPriceValues(item)
  const hasSizes = Boolean(item.sizes && Object.keys(item.sizes).length > 0)
  const hasVariants = Boolean(item.variants && item.variants.length > 0)

  return {
    ...item,
    slug: item.id,
    categorySlug,
    categoryName: categoryPresentation.name,
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
  return getSortedRawCategories().map((category) => {
    const categoryPresentation = getCategoryPresentation(category)

    return {
      slug: slugify(category.category.en),
      name: categoryPresentation.name,
      description: category.category.description,
      itemCount: category.items.length,
    }
  })
}

export function getAllMenuItems(): NormalizedMenuItem[] {
  return getSortedRawCategories().flatMap((category) =>
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
  const categories = getSortedRawCategories()
  return categories.map((cat) => ({
    id: slugify(cat.category.en),
    nameAR: getCategoryPresentation(cat).name.ar,
    nameEN: getCategoryPresentation(cat).name.en,
    items: cat.items.map((item) => normalizeMenuItem(item, cat)),
  }))
}
