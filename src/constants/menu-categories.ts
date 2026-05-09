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
  { id: 'fresh-signature-juices',         ar: 'عصائر كهرمانة الطبيعية',         en: 'Fresh Signature Juices',         slugPrefix: 'drinks' },
  { id: 'the-heritage-tea-and-coffee',    ar: 'ركن الشاي والقهوة العريق',       en: 'The Heritage Tea & Coffee',      slugPrefix: 'drinks' },
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
