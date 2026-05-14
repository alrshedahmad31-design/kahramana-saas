// Single source of truth for menu category ids.
// `id` matches `slugify(category.en)` and is what we store in DB / Select values.
// `slugPrefix` is the short token used to prefix item slugs (matches existing
// menu.json conventions, e.g. `grills-kahramana-mix` → prefix 'grills').
// Both fields must stay in sync with src/data/menu.json. Adding a new category
// here is a deliberate product decision — do not invent ids ad-hoc.

export const MENU_CATEGORIES = [
  { id: 'kahramana-signature-selection',  ar: 'مختارات كهرمانة للتوقيع',        en: 'Kahramana Signature Selection',  slugPrefix: 'grills' },
  { id: 'baghdadi-culinary-masterpieces', ar: 'روائع المائدة البغدادية',        en: 'Baghdadi Culinary Masterpieces', slugPrefix: 'mains' },
  { id: 'the-cold-mezza-garden',          ar: 'بستان المقبلات الباردة',         en: 'The Cold Mezza Garden',          slugPrefix: 'cold-apps' },
  { id: 'the-hot-mezza-garden',           ar: 'بستان المقبلات الساخنة',         en: 'The Hot Mezza Garden',           slugPrefix: 'hot-apps' },
  { id: 'garden-fresh-salads',            ar: 'سلطات نضارة البساتين',           en: 'Garden Fresh Salads',            slugPrefix: 'salad' },
  { id: 'warm-and-comforting-soups',      ar: 'شوربات دافئة',                   en: 'Warm & Comforting Soups',        slugPrefix: 'soup' },
  { id: 'the-authentic-stew-house',       ar: 'بيت المرق الأصيل',               en: 'The Authentic Stew House',       slugPrefix: 'stews' },
  { id: 'the-fatteh-collection',          ar: 'مجموعة الفتات الفاخرة',          en: 'The Fatteh Collection',          slugPrefix: 'breakfast-fattat' },
  { id: 'baghdadi-tandoor-selection',     ar: 'مختارات التنور البغدادية',       en: 'Baghdadi Tandoor Selection',     slugPrefix: 'pastry' },
  { id: 'the-shawarma-suite-kaas',        ar: 'أجنحة الشاورما العراقية (الكص)', en: 'The Shawarma Suite (Kaas)',      slugPrefix: 'shawarma' },
  { id: 'artisan-stone-oven-pizza',       ar: 'بيتزا الفرن الحجري',             en: 'Artisan Stone-Oven Pizza',       slugPrefix: 'pizza' },
  { id: 'traditional-sandwiches',         ar: 'سندويشات بغدادية',               en: 'Traditional Sandwiches',         slugPrefix: 'sandwiches' },
  { id: 'the-heritage-breakfast',         ar: 'الفطور البغدادي التراثي',        en: 'The Heritage Breakfast',         slugPrefix: 'breakfast' },
  { id: 'the-sweet-finale',               ar: 'ختامها مسك (الحلويات)',          en: 'The Sweet Finale',               slugPrefix: 'desserts' },
  { id: 'fresh-signature-juices',         ar: 'عصائر كهرمانة الطبيعية',         en: 'Fresh Signature Juices',         slugPrefix: 'juice' },
  { id: 'the-heritage-tea-and-coffee',    ar: 'ركن الشاي والقهوة العريق',       en: 'The Heritage Tea & Coffee',      slugPrefix: 'tea' },
] as const

export type MenuCategoryId = typeof MENU_CATEGORIES[number]['id']

export const MENU_CATEGORY_IDS: readonly string[] = MENU_CATEGORIES.map((c) => c.id)

export function isValidMenuCategoryId(id: string): id is MenuCategoryId {
  return MENU_CATEGORY_IDS.includes(id)
}

export function getMenuCategory(id: string) {
  return MENU_CATEGORIES.find((c) => c.id === id)
}

// Returns the short prefix to use when generating an item slug for this category.
// Falls back to the category id itself if not found (defensive — should never hit
// in practice because submitted categories are validated against MENU_CATEGORY_IDS).
export function getSlugPrefix(categoryId: string): string {
  return MENU_CATEGORIES.find((c) => c.id === categoryId)?.slugPrefix ?? categoryId
}

// ── Two-level customer-facing menu navigation ────────────────────────────────
// MAIN_CATEGORIES groups the 16 atomic MENU_CATEGORIES into 5 customer-facing
// sections shown in MenuCategoryNav. `categorySlugs` lists which atomic
// categories (by their MENU_CATEGORIES.id) belong to each subcategory.
// `branchRestriction` (whitelist) — when set, the main category is only shown
// for those branches. null = available everywhere.

export interface MenuSubcategory {
  id: string
  /** i18n key under `menu.subcategories.*` */
  i18nKey: string
  /** MENU_CATEGORIES.id values whose items belong to this subcategory */
  categorySlugs: string[]
}

export interface MenuMainCategory {
  id: string
  /** i18n key under `menu.mainCategories.*` */
  i18nKey: string
  /** Icon name from src/components/ui/Icon.tsx */
  icon: 'breakfast' | 'appetizers' | 'grills' | 'sandwiches' | 'desserts' | 'dish' | 'pizza'
  /** Whitelist of BranchId values; null means all branches */
  branchRestriction: string[] | null
  subcategories: MenuSubcategory[]
}

export const MAIN_CATEGORIES: MenuMainCategory[] = [
  {
    id: 'breakfast',
    i18nKey: 'breakfast',
    icon: 'breakfast',
    branchRestriction: ['riffa'],
    subcategories: [
      { id: 'baghdad-breakfast', i18nKey: 'baghdadBreakfast', categorySlugs: ['the-heritage-breakfast'] },
      { id: 'fatta',             i18nKey: 'fatta',            categorySlugs: ['the-fatteh-collection'] },
    ],
  },
  {
    id: 'appetizers',
    i18nKey: 'appetizers',
    icon: 'appetizers',
    branchRestriction: null,
    subcategories: [
      { id: 'cold-apps', i18nKey: 'coldAppetizers', categorySlugs: ['the-cold-mezza-garden'] },
      { id: 'hot-apps',  i18nKey: 'hotAppetizers',  categorySlugs: ['the-hot-mezza-garden'] },
      { id: 'salads',    i18nKey: 'salads',         categorySlugs: ['garden-fresh-salads'] },
      { id: 'soups',     i18nKey: 'soups',          categorySlugs: ['warm-and-comforting-soups'] },
    ],
  },
  {
    id: 'main-dishes',
    i18nKey: 'mainDishes',
    icon: 'dish',
    branchRestriction: null,
    subcategories: [
      { id: 'main-dishes', i18nKey: 'mainDishes', categorySlugs: ['baghdadi-culinary-masterpieces'] },
      { id: 'iraqi-stews', i18nKey: 'iraqiStews', categorySlugs: ['the-authentic-stew-house'] },
    ],
  },
  {
    id: 'grills',
    i18nKey: 'grills',
    icon: 'grills',
    branchRestriction: null,
    subcategories: [
      { id: 'kahramana-selections', i18nKey: 'kahramanaSelections', categorySlugs: ['kahramana-signature-selection'] },
      { id: 'iraqi-shawarma',       i18nKey: 'iraqiShawarma',       categorySlugs: ['the-shawarma-suite-kaas'] },
    ],
  },
  {
    id: 'pizza-pastries',
    i18nKey: 'pizzaPastries',
    icon: 'pizza',
    branchRestriction: null,
    subcategories: [
      { id: 'kahramana-pizza',   i18nKey: 'kahramanaPizza',   categorySlugs: ['artisan-stone-oven-pizza'] },
      { id: 'tandoor-pastries',  i18nKey: 'tandoorPastries',  categorySlugs: ['baghdadi-tandoor-selection'] },
    ],
  },
  {
    id: 'sandwiches',
    i18nKey: 'sandwiches',
    icon: 'sandwiches',
    branchRestriction: null,
    subcategories: [
      { id: 'sandwiches', i18nKey: 'sandwiches', categorySlugs: ['traditional-sandwiches'] },
    ],
  },
  {
    id: 'desserts-drinks',
    i18nKey: 'dessertsDrinks',
    icon: 'desserts',
    branchRestriction: null,
    subcategories: [
      { id: 'desserts',     i18nKey: 'desserts',     categorySlugs: ['the-sweet-finale'] },
      { id: 'fresh-juices', i18nKey: 'freshJuices',  categorySlugs: ['fresh-signature-juices'] },
      { id: 'tea-coffee',   i18nKey: 'teaCoffee',    categorySlugs: ['the-heritage-tea-and-coffee'] },
    ],
  },
]

/**
 * Filter MAIN_CATEGORIES by branch restriction.
 * `branchId == null` means no branch chosen yet — show everything.
 */
export function getVisibleCategories(branchId: string | null): MenuMainCategory[] {
  return MAIN_CATEGORIES.filter((cat) => {
    if (!cat.branchRestriction) return true
    if (!branchId) return true
    return cat.branchRestriction.includes(branchId)
  })
}

/**
 * Returns the set of categorySlug values that belong to a main category, or to
 * a specific subcategory inside it. Used by the menu page to filter the rendered
 * sections based on the active nav selection.
 */
export function getCategorySlugsFor(
  mainCategoryId: string,
  subcategoryId: string | null,
  visibleCategories: MenuMainCategory[] = MAIN_CATEGORIES,
): string[] {
  const main = visibleCategories.find((c) => c.id === mainCategoryId)
  if (!main) return []
  if (subcategoryId) {
    return main.subcategories.find((s) => s.id === subcategoryId)?.categorySlugs ?? []
  }
  return main.subcategories.flatMap((s) => s.categorySlugs)
}
