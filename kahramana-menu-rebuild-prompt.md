# 🏛️ KAHRAMANA BAGHDAD — MENU PAGE REBUILD PROMPT
**Agent: Antigravity | Quality Gate: Claude | Version: 1.0 | Priority: PRODUCTION-CRITICAL**

---

## 0. MANDATORY PRE-FLIGHT — READ BEFORE WRITING ONE LINE

```
STACK LOCK:
  Framework   → Next.js 15 App Router + TypeScript strict
  Styling     → Tailwind CSS v3 + Design Tokens (lib/design-tokens.ts)
  i18n        → next-intl — AR primary (RTL), EN secondary (LTR)
  Images      → next/image ONLY — never <img>
  Animation   → Framer Motion — no GSAP, no CSS-only for complex sequences
  Icons       → lucide-react ONLY — no heroicons, no fontawesome
  Cart System → ALREADY BUILT — DO NOT TOUCH — only import & use
  WhatsApp    → ALREADY BUILT — DO NOT TOUCH — only import & use

DESIGN SYSTEM LOCK (design-tokens.ts — SINGLE SOURCE OF TRUTH):
  black:      #0A0A0A   ← page background ONLY
  surface:    #141210   ← card backgrounds
  surface2:   #1C1A16   ← inputs, dropdowns, nested
  gold:       #C8922A   ← CTAs, active states, accents
  goldLight:  #E8B86D   ← hover states ONLY
  goldDark:   #A67C00   ← pressed states
  text:       #F5F5F5   ← primary text
  muted:      #6B6560   ← secondary text, captions
  error:      #C0392B   ← out-of-stock, errors
  success:    #27AE60   ← available, confirmations

FONT LOCK:
  Arabic headings → Cairo 800 ONLY
  Arabic body     → Almarai 400/700
  English heads   → Editorial New 300/700
  English body    → Satoshi 400/500
  Prices          → Satoshi 500 + tabular-nums + "BD" suffix (NEVER BHD)

RTL IRON LAW (zero exceptions, CI enforced):
  NEVER: pl- pr- ml- mr- padding-left padding-right margin-left margin-right
  ALWAYS: ps- pe- ms- me- padding-inline-start padding-inline-end
  NEVER: text-left text-right left-0 right-0 border-l border-r rounded-l rounded-r
  ALWAYS: text-start text-end start-0 end-0 border-s border-e rounded-s rounded-e

ZERO TOLERANCE:
  ✗ rounded-full on buttons
  ✗ purple / violet / indigo anywhere
  ✗ yellow-500 / amber-500 as gold substitute
  ✗ Inter / Poppins / Nunito / Roboto / Open Sans
  ✗ pure #000000 or pure #FFFFFF
  ✗ BHD currency (use BD)
  ✗ !important declarations
  ✗ Hardcoded hex values in components (import from design-tokens.ts)
  ✗ style= for colors or fonts (use Tailwind classes)
```

---

## 1. MISSION BRIEF

Rebuild `app/[locale]/menu/page.tsx` and all child components to compete visually with **Nobu, Zuma, and Nusr-Et** — restaurants that trust their food and provide the path, not the spectacle. The current page looks like a food delivery app. The new page must feel like entering Baghdad's finest dining room.

**90% of visitors are mobile users.** Every decision is mobile-first. Desktop is an enhancement.

**The ordering funnel:**
```
Menu Page → Item Detail Page (/menu/item/[slug]) → Add to Cart → WhatsApp → Control Panel
```
The cart and WhatsApp systems are production-ready. This rebuild touches ONLY the menu page and its display components. Cart behavior is untouched.

---

## 2. PAGE ARCHITECTURE — COMPONENT TREE

```
app/[locale]/menu/page.tsx          ← Server Component — data fetch + layout shell
│
├── MenuHero                         ← Client Component — atmospheric header
├── StickyFilterBar                  ← Client Component — category navigation
├── MenuPageClient                   ← Client Component — state management hub
│   ├── FeaturedCarousel             ← Horizontal scroll showcase
│   ├── MenuSection[]                ← One per category (anchor-linked)
│   │   ├── SectionDivider           ← Category title + item count
│   │   └── MenuGrid                 ← Responsive card grid
│   │       └── MenuItemCard[]       ← Individual dish cards
│   └── EmptyState                   ← When search = 0 results
│
└── MobileSearchOverlay              ← Full-screen search on mobile
```

---

## 3. SECTION-BY-SECTION SPECIFICATIONS

---

### 3.1 MenuHero — Compact Atmospheric Header

**Purpose:** Create atmosphere. Not sell. Not explain. Just set the stage and get out.

```
Height:     55vh mobile / 60vh tablet / 65vh desktop — NEVER full viewport
Structure:  Background image (parallax on desktop) + dark overlay + centered content + scroll cue
```

**Visual anatomy (RTL, Arabic primary):**
```
┌─────────────────────────────────────────┐  55vh
│                                         │
│  [atmospheric food photography]         │  ← next/image, object-cover, fill
│  [overlay: gradient #0A0A0A 20%→60%]    │  ← from bottom, not top
│                                         │
│         اكتشف نكهات بغداد              │  ← Almarai, muted, 12px, tracking-widest
│                                         │
│         قائمة كهرمانة                  │  ← Cairo 800, #F5F5F5, clamp(2.5rem,6vw,4rem)
│                                         │
│   أطباق عراقية أصيلة بحرص لتقديم      │  ← Almarai 400, muted, 16px, max 2 lines
│         تجربة لا تُنسى                 │
│                                         │
│         ╿  [chevron-down gold]          │  ← Animated bounce, links to #menu-content
│                                         │
└─────────────────────────────────────────┘
```

**Implementation rules:**
- `position: relative` container, `next/image fill` with `object-cover object-[center_30%]`
- Overlay: `absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/60 to-transparent`
- Arabic subtitle above title: `font-['Almarai'] text-[#6B6560] text-xs tracking-[0.2em] uppercase mb-3`
- Main title: `font-['Cairo'] font-black text-[#F5F5F5]` with `clamp(2.5rem, 6vw, 4rem)`
- Description: `font-['Almarai'] text-[#6B6560] text-base max-w-xs mx-auto text-center mt-3`
- Scroll cue: `ChevronDown` from lucide, `text-[#C8922A]`, Framer Motion `animate={{ y: [0, 8, 0] }}` infinite 1.5s
- Framer Motion: `initial={{ opacity: 0, y: 20 }}` → `animate={{ opacity: 1, y: 0 }}` staggered 0.15s per element
- Stats row (168 صنف | 16 تصنيف): `font-['Satoshi'] tabular-nums text-[#C8922A]` separated by `·` in `text-[#6B6560]`

---

### 3.2 StickyFilterBar — Category Navigation

**Purpose:** Let users teleport between categories. Must be INSTANT and frictionless on mobile.

```
Position:  sticky top-0 z-40
Height:    56px — fixed, no collapse, no expand
Mobile:    horizontal scroll, scrollbar-none, 44px minimum tap targets
Desktop:   centered, wraps if needed
```

**Visual anatomy:**
```
┌──────────────────────────────────────────────────────┐  56px
│ bg-[#0A0A0A]/95 backdrop-blur-md border-b-[#1C1A16] │
│                                                      │
│  [الكل ✓]  [مشاوي]  [روائع المطبخ]  [المرق]  ...  │
│                                                      │
│  ←─────────── gold underline indicator ──────────→   │
└──────────────────────────────────────────────────────┘
```

**Pill states:**
```tsx
// ACTIVE pill
className="shrink-0 bg-[#C8922A] text-[#0A0A0A] font-['Almarai'] font-bold
           text-sm px-4 py-2.5 rounded-lg transition-colors duration-[150ms]"

// INACTIVE pill
className="shrink-0 bg-transparent text-[#6B6560] font-['Almarai']
           text-sm px-4 py-2.5 rounded-lg hover:text-[#F5F5F5]
           transition-colors duration-[150ms]"
```

**Search toggle (mobile only — icon button at end of bar):**
```tsx
// Magnifying glass icon — opens MobileSearchOverlay
<button
  className="shrink-0 w-10 h-10 flex items-center justify-center
             text-[#6B6560] hover:text-[#C8922A] transition-colors duration-[150ms]"
  aria-label="بحث في القائمة"
>
  <Search size={18} />
</button>
```

**Behavior:**
- Clicking a pill: smooth scroll to `#section-{categoryId}` via `element.scrollIntoView({ behavior: 'smooth' })`
- Active state updates via IntersectionObserver watching each `#section-{categoryId}` — NOT via click state
- `الكل` pill = scroll to top of `#menu-content`

---

### 3.3 FeaturedCarousel — الأكثر طلباً

**Purpose:** The first thing eyes land on below the hero. Must stop the scroll. Premium horizontal cinema.

```
Trigger:    items where item.popular === true OR item.tags includes 'popular'
Minimum:    3 items to render — if fewer, skip section entirely
Layout:     Horizontal scroll, no scrollbar, peek of next card = 2.5 cards visible on mobile
```

**Visual anatomy — section header:**
```
                    ┌────────────────────────────────────┐
                    │  ━━━━ [gold line]                  │
                    │                                    │
    [flame icon]    │  الأكثر طلباً                     │  ← Cairo 800, #F5F5F5, 1.875rem
                    │  اختيارات ضيوفنا المفضّلة          │  ← Almarai 400, muted, 14px
                    │                                    │
                    └────────────────────────────────────┘
```

**Featured Card — تفاصيل التصميم:**
```
Width:      70vw mobile / 320px tablet / 360px desktop
Ratio:      4:3 (aspect-[4/3])
Min-width:  280px — never smaller
```

```tsx
// Featured card anatomy
<article
  className="
    relative shrink-0 w-[70vw] min-w-[280px] max-w-[360px]
    bg-[#141210] border border-[#2A2A2A] rounded-xl overflow-hidden
    hover:border-[#C8922A] transition-colors duration-[250ms] group
    cursor-pointer
  "
  dir="rtl"
>
  {/* Image — 4:3 ratio */}
  <div className="relative aspect-[4/3] overflow-hidden">
    <Image
      src={item.image ?? '/images/placeholder/dish.jpg'}
      alt={item.nameAR}
      fill
      className="object-cover transition-transform duration-[400ms] group-hover:scale-105"
      sizes="(max-width: 640px) 70vw, 360px"
    />
    {/* Gradient for legibility */}
    <div className="absolute inset-0 bg-gradient-to-t from-[#141210]/80 via-transparent to-transparent" />

    {/* Popular badge — top-start */}
    <div className="absolute top-3 start-3">
      <span className="
        flex items-center gap-1
        bg-[#C8922A] text-[#0A0A0A]
        font-['Almarai'] font-bold text-[10px]
        px-2 py-1 rounded
      ">
        <Flame size={10} />
        الأكثر طلباً
      </span>
    </div>

    {/* Price — bottom-start over image */}
    <div className="absolute bottom-3 start-3">
      <span className="font-['Satoshi'] font-medium text-[#C8922A] text-xl tabular-nums">
        {item.price.toFixed(3)} BD
      </span>
    </div>
  </div>

  {/* Content */}
  <div className="p-4">
    <p className="font-['Almarai'] text-[#6B6560] text-xs mb-1">
      {item.categoryNameAR}
    </p>
    <h3 className="font-['Cairo'] font-black text-[#F5F5F5] text-lg leading-snug">
      {item.nameAR}
    </h3>
    {item.nameEN && (
      <p className="font-['Satoshi'] text-[#6B6560] text-xs mt-0.5">
        {item.nameEN}
      </p>
    )}
    {item.description && (
      <p className="font-['Almarai'] text-[#6B6560] text-sm mt-2 line-clamp-2">
        {item.description}
      </p>
    )}
  </div>
</article>
```

**Scroll container:**
```tsx
<div
  className="
    flex gap-4
    overflow-x-auto scrollbar-none
    ps-4 pe-4 pb-4
    snap-x snap-mandatory
  "
  dir="rtl"
>
  {featuredItems.map(item => (
    <Link
      key={item.id}
      href={`/${locale}/menu/item/${item.slug}`}
      className="snap-start"
    >
      <FeaturedCard item={item} />
    </Link>
  ))}
</div>
```

**Framer Motion entrance:**
```tsx
// Cards slide in from the end (RTL = start from right)
<motion.div
  initial={{ opacity: 0, x: 40 }}
  whileInView={{ opacity: 1, x: 0 }}
  viewport={{ once: true, margin: "-50px" }}
  transition={{ duration: 0.4, delay: index * 0.08 }}
>
```

---

### 3.4 MenuSection — Per-Category Sections

**Purpose:** Each category becomes a named section with an anchor. Smooth scroll from filter bar lands here.

```
ID:         id={`section-${category.id}`}
Spacing:    pt-10 pb-4 — generous breathing room between categories
```

**SectionDivider anatomy:**
```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  ▌ مشاوي كهرمانة الفاخرة          14 صنف            │
│  [gold 2px border-s] [Cairo 800]   [Almarai muted]   │
│                                                      │
│  ──────────────────────── [#2A2A2A full width line]  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

```tsx
<div className="ps-4 pe-4 pt-10 pb-4" dir="rtl">
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-3">
      {/* Gold accent bar */}
      <div className="w-0.5 h-7 bg-[#C8922A] rounded-full" />
      <h2 className="font-['Cairo'] font-black text-[#F5F5F5] text-2xl">
        {category.nameAR}
      </h2>
    </div>
    <span className="font-['Satoshi'] text-[#6B6560] text-sm tabular-nums">
      {category.items.length} صنف
    </span>
  </div>
  {/* Full-width divider */}
  <div className="border-b border-[#1C1A16]" />
</div>
```

---

### 3.5 MenuGrid + MenuItemCard

**THE MOST IMPORTANT COMPONENT. 90% of user time is spent here.**

**Grid layout — MOBILE FIRST:**
```
Mobile (< 640px):   2 columns — grid-cols-2
Tablet (640–1023):  2 columns — sm:grid-cols-2
Desktop (1024–1279): 3 columns — lg:grid-cols-3
Wide (≥ 1280px):    4 columns — xl:grid-cols-4
Gap: gap-3 mobile / gap-4 desktop
Padding: ps-3 pe-3 sm:ps-4 sm:pe-4
```

**MenuItemCard — full specification:**

Image ratio: **4:3** — `aspect-[4/3]` — MANDATORY — no exceptions.

```tsx
<article
  className="
    bg-[#141210] border border-[#2A2A2A] rounded-lg
    overflow-hidden group
    hover:border-[#C8922A]
    transition-colors duration-[250ms]
    flex flex-col
  "
  dir="rtl"
>
  {/* ── IMAGE ZONE ── */}
  <Link href={`/${locale}/menu/item/${item.slug}`}>
    <div className="relative aspect-[4/3] overflow-hidden">
      <Image
        src={item.image ?? '/images/placeholder/dish.jpg'}
        alt={item.nameAR}
        fill
        className="
          object-cover
          transition-transform duration-[400ms]
          group-hover:scale-105
        "
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
      />

      {/* Out-of-stock overlay */}
      {!item.available && (
        <div className="absolute inset-0 bg-[#0A0A0A]/75 flex items-center justify-center">
          <span className="
            font-['Almarai'] font-bold text-[#C0392B] text-xs
            border border-[#C0392B] rounded px-2 py-1
          ">
            غير متوفر
          </span>
        </div>
      )}

      {/* Tags — top-start */}
      {item.tags?.length > 0 && (
        <div className="absolute top-2 start-2 flex flex-col gap-1">
          {item.tags.slice(0, 2).map(tag => (
            <FilterTag key={tag} tag={tag} />
          ))}
        </div>
      )}
    </div>
  </Link>

  {/* ── CONTENT ZONE ── */}
  <div className="p-3 sm:p-4 flex flex-col flex-1">

    {/* Category label */}
    <p className="font-['Almarai'] text-[#6B6560] text-[10px] mb-1 line-clamp-1">
      {item.categoryNameAR}
    </p>

    {/* Arabic name — primary */}
    <Link href={`/${locale}/menu/item/${item.slug}`}>
      <h3 className="
        font-['Cairo'] font-black text-[#F5F5F5]
        text-sm sm:text-base leading-snug
        hover:text-[#E8B86D] transition-colors duration-[150ms]
        line-clamp-2
      ">
        {item.nameAR}
      </h3>
    </Link>

    {/* English name — secondary, desktop only */}
    {item.nameEN && (
      <p className="
        hidden sm:block
        font-['Satoshi'] text-[#6B6560] text-xs mt-0.5 line-clamp-1
      ">
        {item.nameEN}
      </p>
    )}

    {/* Description — desktop only, 2 lines max */}
    {item.description && (
      <p className="
        hidden sm:block
        font-['Almarai'] text-[#6B6560] text-xs mt-1.5 line-clamp-2 flex-1
      ">
        {item.description}
      </p>
    )}

    {/* ── PRICE + ACTION ROW ── */}
    <div className="flex items-center justify-between mt-auto pt-3">

      {/* Price block */}
      <div>
        {item.hasVariants && (
          <p className="font-['Almarai'] text-[#6B6560] text-[9px] mb-0.5">
            من
          </p>
        )}
        <span className="
          font-['Satoshi'] font-medium text-[#C8922A] tabular-nums
          text-sm sm:text-base
        ">
          {item.price.toFixed(3)} <span className="text-xs">BD</span>
        </span>
      </div>

      {/* Add to cart — import existing AddToCartButton */}
      <AddToCartButton
        item={item}
        disabled={!item.available}
        size="sm"  {/* compact variant for grid cards */}
      />

    </div>
  </div>
</article>
```

**Framer Motion entrance — staggered grid:**
```tsx
<motion.div
  initial={{ opacity: 0, y: 16 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: "-30px" }}
  transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.3) }}
  // Cap delay at 0.3s — don't punish items at the bottom of a long list
>
  <MenuItemCard item={item} />
</motion.div>
```

---

### 3.6 MobileSearchOverlay

**Trigger:** Tap search icon in StickyFilterBar (mobile only — `sm:hidden`)
**Behavior:** Full-screen overlay, slides up from bottom, auto-focuses input

```tsx
<AnimatePresence>
  {searchOpen && (
    <motion.div
      className="
        fixed inset-0 z-50 bg-[#0A0A0A]/95 backdrop-blur-md
        flex flex-col pt-safe-top
        sm:hidden
      "
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      dir="rtl"
    >
      {/* Close bar */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[#1C1A16]">
        <button
          onClick={() => setSearchOpen(false)}
          className="text-[#6B6560] hover:text-[#F5F5F5] transition-colors"
          aria-label="إغلاق البحث"
        >
          <X size={20} />
        </button>
        <input
          ref={searchInputRef}
          type="search"
          placeholder="ابحث عن طبق..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="
            flex-1 bg-transparent
            font-['Almarai'] text-[#F5F5F5] text-base
            placeholder:text-[#6B6560]
            focus:outline-none
          "
          autoFocus
          dir="rtl"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-[#6B6560]"
            aria-label="مسح البحث"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Results — same grid, filtered */}
      <div className="flex-1 overflow-y-auto">
        {filteredItems.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 ps-3 pe-3 pt-4 pb-8">
            {filteredItems.map(item => (
              <MenuItemCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <EmptyState query={searchQuery} />
        )}
      </div>
    </motion.div>
  )}
</AnimatePresence>
```

---

### 3.7 EmptyState

```tsx
<div className="flex flex-col items-center justify-center py-20 text-center px-6" dir="rtl">
  <div className="w-16 h-16 rounded-full bg-[#141210] flex items-center justify-center mb-4">
    <Search size={24} className="text-[#6B6560]" />
  </div>
  <p className="font-['Cairo'] font-black text-[#F5F5F5] text-lg mb-2">
    لا توجد نتائج
  </p>
  <p className="font-['Almarai'] text-[#6B6560] text-sm">
    {query
      ? `لا يوجد طبق يطابق "${query}"`
      : 'جرّب تصنيفاً آخر'
    }
  </p>
</div>
```

---

## 4. STATE MANAGEMENT — MenuPageClient

All interactive state lives in ONE parent client component.

```tsx
'use client'

export function MenuPageClient({ categories, locale }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)

  // IntersectionObserver — updates activeCategory as user scrolls
  useEffect(() => {
    const sections = document.querySelectorAll('[data-category-section]')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setActiveCategory(entry.target.getAttribute('data-category-id') ?? 'all')
          }
        })
      },
      {
        rootMargin: '-56px 0px -60% 0px', // account for sticky bar height
        threshold: 0,
      }
    )
    sections.forEach(s => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  // Filter logic — search applies across ALL categories
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories
    const q = searchQuery.toLowerCase()
    return categories
      .map(cat => ({
        ...cat,
        items: cat.items.filter(item =>
          item.nameAR.includes(q) ||
          item.nameEN?.toLowerCase().includes(q) ||
          item.description?.includes(q)
        )
      }))
      .filter(cat => cat.items.length > 0)
  }, [categories, searchQuery])

  const featuredItems = useMemo(
    () => categories.flatMap(c => c.items).filter(i => i.popular || i.tags?.includes('popular')),
    [categories]
  )

  return (
    <>
      <StickyFilterBar
        categories={categories}
        activeCategory={activeCategory}
        onCategoryClick={setActiveCategory}
        onSearchOpen={() => setSearchOpen(true)}
      />

      <div id="menu-content">

        {/* Featured Carousel */}
        {featuredItems.length >= 3 && !searchQuery && (
          <FeaturedCarousel items={featuredItems} locale={locale} />
        )}

        {/* Category Sections */}
        {filteredCategories.length > 0 ? (
          filteredCategories.map(category => (
            <MenuSection
              key={category.id}
              category={category}
              locale={locale}
              id={`section-${category.id}`}
            />
          ))
        ) : (
          <EmptyState query={searchQuery} />
        )}

      </div>

      {/* Mobile Search Overlay */}
      <MobileSearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        categories={categories}
        locale={locale}
      />
    </>
  )
}
```

---

## 5. DATA CONTRACT — Server Component

```tsx
// app/[locale]/menu/page.tsx — Server Component

import { getMenuData } from '@/lib/menu'  // ← existing data layer, DO NOT MODIFY

export default async function MenuPage({ params }: { params: { locale: string } }) {
  const { locale } = params
  const categories = await getMenuData(locale)  // returns CategoryWithItems[]

  return (
    <main className="bg-[#0A0A0A] min-h-screen" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <MenuHero locale={locale} />
      <MenuPageClient categories={categories} locale={locale} />
    </main>
  )
}

// Type contract — confirm these match your Prisma schema
type MenuItem = {
  id: string
  slug: string
  nameAR: string
  nameEN?: string
  description?: string
  price: number
  image?: string
  available: boolean
  popular: boolean
  tags: string[]  // 'vegetarian' | 'spicy' | 'new' | 'popular'
  hasVariants: boolean
  categoryNameAR: string
}

type CategoryWithItems = {
  id: string
  nameAR: string
  nameEN?: string
  items: MenuItem[]
}
```

---

## 6. FILTER TAGS — FilterTag Component

```tsx
// Centralized tag config — import anywhere
const TAG_CONFIG = {
  vegetarian: { labelAR: 'نباتي',        bg: '#27AE60', text: '#0A0A0A' },
  spicy:      { labelAR: 'حار',          bg: '#C0392B', text: '#F5F5F5' },
  new:        { labelAR: 'جديد',         bg: '#C8922A', text: '#0A0A0A' },
  popular:    { labelAR: 'الأكثر طلباً', bg: '#1C1A16', text: '#E8B86D' },
} as const

export function FilterTag({ tag }: { tag: keyof typeof TAG_CONFIG }) {
  const config = TAG_CONFIG[tag]
  if (!config) return null
  return (
    <span
      className="text-[10px] font-['Almarai'] font-bold rounded px-1.5 py-0.5 leading-none"
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      {config.labelAR}
    </span>
  )
}
```

---

## 7. PERFORMANCE REQUIREMENTS

```
Core Web Vitals targets:
  LCP  < 2.5s    ← Hero image must use priority={true} + fetchpriority="high"
  CLS  < 0.1     ← All images must have explicit aspect-ratio set
  INP  < 200ms   ← Filter bar clicks must be instant (no loading state)

Image optimization:
  - Hero: priority={true}, fetchpriority="high"
  - Featured carousel: first 3 items priority={true}, rest lazy
  - Grid cards: lazy by default, loading="lazy"
  - Placeholder: /images/placeholder/dish.jpg (already exists)

Data fetching:
  - Server Component fetches ALL menu data once
  - No client-side fetch on initial load
  - Search/filter = pure JS filter on already-loaded data (instant)
  - SWR or React.cache() if data refresh needed
```

---

## 8. ACCESSIBILITY REQUIREMENTS

```
Minimum tap targets: 44×44px — enforce on all interactive elements
Focus visible: focus:ring-2 focus:ring-[#C8922A] focus:outline-none on all focusable elements
Screen reader:
  - FilterBar: role="tablist", each pill role="tab" aria-selected
  - MenuGrid: role="list", each card role="listitem" aria-label={item.nameAR}
  - Search input: aria-label="بحث في القائمة" aria-controls="menu-content"
  - Out-of-stock: aria-disabled="true" aria-label="{item.nameAR} — غير متوفر"
Color contrast:
  - All text meets WCAG AA (see design-tokens contrast table)
  - gold on black = 5.2:1 ✓
  - muted text minimum 18px when used (applies to descriptions)
```

---

## 9. FILE STRUCTURE — DELIVERABLES

```
app/[locale]/menu/
├── page.tsx                          ← REBUILD FULLY (Server Component)
│
components/menu/
├── MenuHero.tsx                      ← NEW
├── StickyFilterBar.tsx               ← REBUILD (remove category grid logic)
├── MenuPageClient.tsx                ← NEW (state hub)
├── FeaturedCarousel.tsx              ← NEW
├── MenuSection.tsx                   ← NEW (replaces raw section rendering)
├── SectionDivider.tsx                ← NEW
├── MenuGrid.tsx                      ← REBUILD
├── MenuItemCard.tsx                  ← REBUILD (4:3, new layout)
├── FilterTag.tsx                     ← KEEP/UPDATE
├── EmptyState.tsx                    ← KEEP/UPDATE
└── MobileSearchOverlay.tsx           ← NEW
```

**DO NOT TOUCH:**
```
components/cart/           ← Cart system — production-ready
components/whatsapp/       ← WhatsApp integration — production-ready
lib/menu.ts                ← Data layer (only adapt types if needed)
app/[locale]/menu/item/    ← Item detail pages — production-ready
```

---

## 10. EXECUTION ORDER — MANDATORY SEQUENCE

```
Phase 1 — Types & Data Contract
  1.1  Confirm CategoryWithItems + MenuItem types match Prisma schema
  1.2  Confirm getMenuData() function signature
  1.3  Confirm AddToCartButton props API (especially size="sm" support)

Phase 2 — Atomic Components (no state, pure display)
  2.1  FilterTag.tsx
  2.2  SectionDivider.tsx
  2.3  EmptyState.tsx

Phase 3 — MenuItemCard (most critical component)
  3.1  Build with 4:3 ratio, RTL-safe, all states (available/unavailable)
  3.2  Test in isolation at 2-column mobile grid width
  3.3  Verify: price format, tags, link to /menu/item/[slug]

Phase 4 — Grid & Sections
  4.1  MenuGrid.tsx with responsive columns
  4.2  MenuSection.tsx with anchor IDs + SectionDivider

Phase 5 — Navigation
  5.1  StickyFilterBar with IntersectionObserver awareness
  5.2  MobileSearchOverlay

Phase 6 — Featured Carousel
  6.1  FeaturedCard (large, 4:3, badges)
  6.2  FeaturedCarousel with horizontal scroll + Framer Motion

Phase 7 — Hero
  7.1  MenuHero — atmospheric, 55-65vh, compact

Phase 8 — Assembly
  8.1  MenuPageClient (state management, wires all pieces)
  8.2  page.tsx (Server Component shell)

Phase 9 — QA Checklist
  9.1  Run CI grep commands from Section 7.1 of design-tokens.ts — must return 0
  9.2  Test on 390px width (iPhone 14) — primary target
  9.3  Test RTL + LTR rendering
  9.4  Test all filter/search states
  9.5  Verify AddToCartButton still works as before
```

---

## 11. PRE-DELIVERY QA CHECKLIST

Before sending any file, verify ALL of these pass:

```
COLORS
[ ] Zero hardcoded hex — all from design-tokens.ts
[ ] No yellow-* amber-* purple-* violet-* indigo-*
[ ] Gold is exactly #C8922A (not #D4AF37 not #FFD700)
[ ] No pure #000000 or #FFFFFF
[ ] No !important

RTL
[ ] Zero pl- pr- ml- mr- in any className
[ ] Zero text-left text-right left-0 right-0
[ ] All border-s border-e start-0 end-0

TYPOGRAPHY
[ ] Cairo 800 for Arabic headings
[ ] Almarai for Arabic body
[ ] Satoshi for prices + tabular-nums
[ ] No Inter Poppins Nunito Roboto
[ ] All prices end with "BD" not "BHD"

IMAGES
[ ] All cards: aspect-[4/3]
[ ] All images: next/image with fill or explicit width/height
[ ] sizes prop set on every Image
[ ] Placeholder: /images/placeholder/dish.jpg

FUNCTIONALITY
[ ] AddToCartButton works identically to before
[ ] Link to /menu/item/[slug] works on card click
[ ] Filter bar updates activeCategory via IntersectionObserver
[ ] Search returns results or EmptyState
[ ] Out-of-stock items visible with overlay (never hidden)

MOBILE
[ ] 2-column grid at 390px
[ ] 44px minimum tap targets
[ ] Filter bar scrolls horizontally without visual scrollbar
[ ] Featured carousel shows 2.5 cards (peek of third)
[ ] Search opens as full-screen overlay on mobile
[ ] Hero is 55vh on mobile (not full viewport)

ACCESSIBILITY
[ ] role="tablist" on filter bar
[ ] aria-selected on active pill
[ ] aria-label on all icon-only buttons
[ ] focus:ring-2 focus:ring-[#C8922A] on all focusable elements
```

---

*Prompt version: 1.0 | Project: Kahramana Baghdad | Author: Espresso Agency*
*Quality Gate: Claude reviews before any GO signal*
