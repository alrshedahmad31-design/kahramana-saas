# SKILL: Kahramana Design System
## Description
Load this skill before writing ANY component, page, or UI element for the Kahramana project.
This document is the law. Every component must comply. No exceptions.

---

# KAHRAMANA DESIGN SYSTEM
**Midnight Mesopotamian Luxe | v1.0 | 2026**

> **AGENT RULE**: Read completely before writing any component.
> **AGENT RULE**: All values must be imported from `design-tokens.ts` — zero exceptions.
> **AGENT RULE**: Never use Tailwind color classes (yellow-500, gray-800, etc.) directly in JSX.

---

## 1. Brand DNA

| Field | Value |
|---|---|
| Theme | Midnight Mesopotamian Luxe |
| Direction | RTL Arabic primary — LTR English fallback |
| Framework | Next.js 15 App Router + TypeScript strict |
| i18n | next-intl — AR primary, EN secondary |

**Core brand principles:**
- Iraqi luxury — not generic luxury
- Warm copper gold `#C8922A` — not yellow gold, not cold platinum
- Deep black `#0A0A0A` — like the Mesopotamian night sky, never pure `#000000`
- Typography with personality — never generic AI defaults (no Inter, no Poppins)
- Every design decision serves the ordering experience, not decoration alone

---

## 2. design-tokens.ts — Single Source of Truth

```typescript
// lib/design-tokens.ts
// SINGLE SOURCE OF TRUTH — import from here, never hardcode

export const tokens = {
  color: {
    black:      '#0A0A0A',  // page background ONLY — never for text
    surface:    '#141210',  // card backgrounds — first level
    surface2:   '#1C1A16',  // nested cards / input fields
    gold:       '#C8922A',  // primary accent — CTA, highlights, borders
    goldLight:  '#E8B86D',  // hover states ONLY — never default
    goldDark:   '#A67C00',  // pressed states, decorative borders
    text:       '#F5F5F5',  // primary body text
    muted:      '#6B6560',  // secondary text, placeholders
    error:      '#C0392B',  // errors, out-of-stock, destructive
    success:    '#27AE60',  // confirmations, available status
  },
  font: {
    arHeading: 'Cairo',         // Arabic headings — weight 800 ONLY
    arBody:    'Almarai',       // Arabic body — 400 / 700
    enHeading: 'Editorial New', // English headings — 300 / 700
    enBody:    'Satoshi',       // English body — 400 / 500
    numbers:   'Satoshi',       // prices — tabular-nums always
  },
  fontSize: {
    xs:    '0.75rem',
    sm:    '0.875rem',
    base:  '1rem',
    lg:    '1.125rem',
    xl:    '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    '5xl': '3rem',
    '6xl': '4rem',
  },
  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    // NEVER rounded-full on buttons
  },
  spacing: {
    // RTL-SAFE LOGICAL PROPERTIES ONLY
    // Use: ps pe ms me  —  NEVER pl pr ml mr
    inline: { start: 'ps', end: 'pe' },
    block:  { start: 'pt', end: 'pb' },
  },
  transition: {
    fast:   '150ms ease',
    normal: '250ms ease',
    slow:   '400ms ease',
  },
} as const

export type ColorToken = keyof typeof tokens.color
export type FontToken  = keyof typeof tokens.font
```

---

## 3. Color System

### 3.1 Full Palette

| Token | Hex | Usage Rule |
|---|---|---|
| `color.black` | #0A0A0A | Page background ONLY — never cards, never text |
| `color.surface` | #141210 | Card backgrounds — first level |
| `color.surface2` | #1C1A16 | Nested cards, input fields, dropdowns |
| `color.gold` | #C8922A | Primary accent — CTAs, highlights, active borders |
| `color.goldLight` | #E8B86D | Hover states ONLY — never the default color |
| `color.goldDark` | #A67C00 | Pressed/active states, decorative borders |
| `color.text` | #F5F5F5 | All primary text on dark backgrounds |
| `color.muted` | #6B6560 | Secondary text, placeholders, disabled labels |
| `color.error` | #C0392B | Errors, out-of-stock badges, destructive actions |
| `color.success` | #27AE60 | Confirmations, available status, checkmarks |

### 3.2 Contrast Compliance (WCAG AA)

| Combination | Ratio | Status |
|---|---|---|
| gold #C8922A on black #0A0A0A | 5.2:1 | OK PASS — headings & labels |
| text #F5F5F5 on black #0A0A0A | 16.7:1 | OK PASS — body text |
| text #F5F5F5 on surface #141210 | 14.1:1 | OK PASS — card content |
| muted #6B6560 on black #0A0A0A | 3.8:1 | Warning: PASS AA Large only — min 18px |
| gold #C8922A on surface2 #1C1A16 | 4.6:1 | OK PASS — input labels |

### 3.3 Color Violations — ZERO TOLERANCE

```
NO gold on white background — contrast fails
NO any shade of purple, violet, indigo, or blue-purple
NO yellow-500 / amber-500 as gold substitute — wrong hue entirely
NO pure #000000 or pure #FFFFFF anywhere
NO gradients mixing gold with any other color
```

---

## 4. Typography System

### 4.1 Font Stack

| Role | Font | Weights Allowed |
|---|---|---|
| Arabic Headings | Cairo | 800 (Black) ONLY — no other weights |
| Arabic Body | Almarai | 400 (Regular), 700 (Bold) |
| English Headings | Editorial New | 300 (Light), 700 (Bold) |
| English Body | Satoshi | 400 (Regular), 500 (Medium) |
| Numbers / Prices | Satoshi | 500 + `font-variant-numeric: tabular-nums` always |

### 4.2 Font Loading — Local Files Only

```css
/* globals.css — load from /public/fonts/ NOT Google Fonts CDN in production */
@font-face {
  font-family: 'Editorial New';
  src: url('/fonts/EditorialNew-Light.woff2') format('woff2'); /* file on disk: EditorialNew-Light.woff2 */
  font-weight: 300;
  font-display: swap;
}
@font-face {
  font-family: 'Editorial New';
  src: url('/fonts/EditorialNew-Bold.woff2') format('woff2');
  font-weight: 700;
  font-display: swap;
}
/* TODO: replace with Satoshi-Variable.woff2 (download: fontshare.com/fonts/satoshi)
   for full weight range support. Until then, use static files below. */
@font-face {
  font-family: 'Satoshi';
  src: url('/fonts/Satoshi-Regular.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: 'Satoshi';
  src: url('/fonts/Satoshi-Medium.woff2') format('woff2');
  font-weight: 500;
  font-display: swap;
}
```

```typescript
// Arabic via next/font (uses Google CDN in dev only — acceptable)
import { Cairo, Almarai } from 'next/font/google'
export const cairo   = Cairo({ subsets: ['arabic'], weight: ['800'] })
export const almarai = Almarai({ subsets: ['arabic'], weight: ['400', '700'] })

// Download Editorial New: pangram-pangram.com
// Download Satoshi: fontshare.com
```

### 4.3 Type Scale — Semantic Usage

| Scale | Size | Usage |
|---|---|---|
| Display | 4rem / 64px | Hero — Arabic headline only (Cairo 800) |
| H1 | 3rem / 48px | Page titles — Cairo AR / Editorial New EN |
| H2 | 2.25rem / 36px | Section headings |
| H3 | 1.875rem / 30px | Card titles, subsections |
| H4 | 1.5rem / 24px | Widget titles, modal headings |
| Body LG | 1.125rem / 18px | Lead paragraphs, descriptions |
| Body | 1rem / 16px | Default — Almarai AR / Satoshi EN |
| Body SM | 0.875rem / 14px | Captions, timestamps, meta info |
| Label | 0.75rem / 12px | Badges, tags, table column headers |
| Price | 1.25rem / 20px | All prices — Satoshi + tabular-nums + BD suffix |

### 4.4 Typography Violations

```
NO FORBIDDEN fonts — NEVER: Inter, Poppins, Nunito, Montserrat, Raleway, Roboto, Open Sans
NO NEVER mix AR and EN fonts on the same text node
NO NEVER use font-weight: 600 on Cairo — only 400 or 800
NO NEVER render prices without tabular-nums
NO NEVER use BHD currency suffix — use BD (Bahrain standard)
```

---

## 5. Spacing & RTL Rules

> **ABSOLUTE RULE**: NEVER use `pl-` / `pr-` / `ml-` / `mr-` in any className or CSS.
> These break RTL layout **silently** — no error thrown, wrong visual output.

### 5.1 RTL Conversion Table

| NO WRONG — breaks RTL | OK CORRECT — RTL-safe |
|---|---|
| `pl-4 pr-4` | `ps-4 pe-4` |
| `ml-4 mr-4` | `ms-4 me-4` |
| `ml-auto` | `ms-auto` |
| `mr-auto` | `me-auto` |
| `padding-left: 16px` | `padding-inline-start: 16px` |
| `text-left` | `text-start` |
| `text-right` | `text-end` |
| `left-0` | `start-0` |
| `right-0` | `end-0` |
| `border-l-2` | `border-s-2` |
| `border-r-2` | `border-e-2` |
| `rounded-l-md` | `rounded-s-md` |
| `rounded-r-md` | `rounded-e-md` |
| `flex-row-reverse` | `dir=rtl` on parent (never reverse) |

---

## 6. Component Patterns

### 6.1 Button — Primary CTA

```tsx
// OK CORRECT
<button
  className="bg-[#C8922A] text-[#0A0A0A] font-medium
             font-['Satoshi']
             ps-6 pe-6 pt-3 pb-3 rounded-lg
             hover:bg-[#E8B86D] active:bg-[#A67C00]
             transition-colors duration-[150ms]"
>
  اطلب الآن
</button>

// NO WRONG — AI will generate this — REJECT IMMEDIATELY
<button className="bg-yellow-500 text-white pl-6 pr-6 rounded-full font-sans">
// Problems: yellow-500 wrong hue | pl/pr breaks RTL | rounded-full generic | font-sans = Inter

// NO WRONG — inline style for font (violates rule 8.5)
<button style={{ fontFamily: tokens.font.enBody }}>
// Use font-['Satoshi'] className instead — never style= for fonts

// NO WRONG — purple gradient (AI signature pattern — instant rejection)
<button className="bg-gradient-to-r from-purple-600 to-indigo-600 ...">
```

### 6.2 Menu Item Card

```tsx
// OK CORRECT
<div
  className="bg-[#141210] border border-[#2A2A2A] rounded-lg
             hover:border-[#C8922A] transition-colors duration-[250ms]"
  dir="rtl"
>
  <Image
    src={dish.image}
    alt={dish.nameAR}
    width={400}
    height={400}
    className="w-full aspect-square object-cover rounded-t-lg"
  />
  <div className="p-4">
    <h3 className="font-['Cairo'] font-black text-[#F5F5F5] text-xl">
      {dish.nameAR}
    </h3>
    <p className="font-['Satoshi'] text-[#6B6560] text-sm mt-1">
      {dish.nameEN}
    </p>
    <div className="flex items-center justify-between mt-3">
      <span className="font-['Satoshi'] font-medium text-[#C8922A] text-lg tabular-nums">
        {dish.price.toFixed(3)} BD
      </span>
      <AddToCartButton dish={dish} />
    </div>
  </div>
</div>
```

### 6.3 Order Status Badges

```typescript
// OK CORRECT — all status colors from this config
const STATUS_CONFIG = {
  new:          { text: '#C8922A', border: '#C8922A', labelAR: 'جديد' },
  under_review: { text: '#E8B86D', border: '#E8B86D', labelAR: 'قيد المراجعة' },
  preparing:    { text: '#E8B86D', border: '#E8B86D', labelAR: 'يُحضَّر' },
  ready:        { text: '#27AE60', border: '#27AE60', labelAR: 'جاهز' },
  out_delivery: { text: '#F5F5F5', border: '#6B6560', labelAR: 'في الطريق' },
  delivered:    { text: '#27AE60', border: '#27AE60', labelAR: 'تم التوصيل' },
  cancelled:    { text: '#C0392B', border: '#C0392B', labelAR: 'ملغي' },
} as const

// All badges: bg-[#141210] + border-[config.border] + text-[config.text]
// Font: Almarai for AR label + font-medium
```

### 6.4 Price Display

```tsx
// OK CORRECT — always Satoshi + tabular-nums + BD suffix
<span className="font-['Satoshi'] font-medium text-[#C8922A] tabular-nums text-lg">
  {price.toFixed(3)} BD
</span>

// NO ALL THREE ARE VIOLATIONS:
// <span className="text-yellow-400">{price} BHD</span>   — wrong color + wrong currency
// <span style={{color:'gold'}}>{price}</span>             — inline style + invalid color
// <span className="font-mono">{price} BD</span>           — wrong font
```

---

## 7. FORBIDDEN LIST — Zero Tolerance

### 7.1 CI Grep Commands (all must return 0 results before merge)

```bash
# 1. RTL violations
grep -rn 'pl-\|pr-\|ml-\|mr-\|padding-left\|padding-right\|margin-left\|margin-right' src/

# 2. Forbidden fonts
grep -rn 'Inter\|Poppins\|Nunito\|Montserrat\|Raleway\|Roboto\|Open Sans' src/

# 3. Forbidden colors
grep -rn 'purple\|violet\|indigo\|#6366f1\|#8b5cf6\|#a855f7' src/
grep -rn 'yellow-[0-9]\|amber-[0-9]' src/

# 4. Hardcoded pure black/white
grep -rn '#000000\|#ffffff\|#FFFFFF\|#000"' src/

# 5. Forbidden UI patterns
grep -rn 'rounded-full' src/components/
grep -rn 'from-purple\|to-indigo\|from-violet\|to-purple' src/

# 6. Currency violation
grep -rn 'BHD' src/

# 7. Hardcoded hex in components (must import from design-tokens.ts)
grep -rEn "'#[0-9A-Fa-f]{6}'" src/components/
```

### 7.2 Forbidden Patterns Reference

| Pattern | Why Forbidden |
|---|---|
| `rounded-full` on buttons | Generic AI pattern — not Kahramana brand |
| `purple` / `violet` / `indigo` | Default AI aesthetic — zero brand relevance |
| `Inter` or `Poppins` or `Nunito` | AI default fonts — destroys brand voice |
| `yellow-500` as gold | Wrong hue — cool yellow ≠ warm Mesopotamian gold |
| pure `#000000` background | Too harsh — use `#0A0A0A` |
| pure `#FFFFFF` text | Too cold — use `#F5F5F5` |
| `pl-` / `pr-` / `ml-` / `mr-` | Breaks RTL layout silently |
| Hardcoded hex in components | Bypasses design system — propagation fails |
| `text-left` / `text-right` | Use `text-start` / `text-end` for RTL safety |
| `BHD` currency suffix | Bahrain standard is BD not BHD |
| `font-weight: 600` on Cairo | Cairo has no 600 — use 400 or 800 only |
| Google Fonts CDN in production | Performance risk — serve from `/public/fonts/` |
| `!important` declarations | Overrides design system — forbidden always |
| `style=` for colors/fonts | Bypasses token system — use Tailwind classes |

---

## 8. Acceptance Criteria — Component Checklist

> A component is **NOT done** until ALL items below pass.

### 8.1 Colors
- [ ] Zero hardcoded hex values — all imported from `design-tokens.ts`
- [ ] No Tailwind color classes (`yellow-*`, `amber-*`, `purple-*`) used directly
- [ ] All text meets 4.5:1 contrast ratio minimum (WCAG AA)
- [ ] Gold used is `#C8922A` exactly — not `#D4AF37` / `#FFD700` / `yellow-*`

### 8.2 Typography
- [ ] Arabic headings use Cairo weight 800 — never Inter / Poppins
- [ ] Arabic body uses Almarai — never Inter / Poppins
- [ ] English headings use Editorial New — never Inter / Poppins
- [ ] English body uses Satoshi — never Inter / Poppins
- [ ] Prices use `tabular-nums` + Satoshi + `BD` suffix
- [ ] Fonts served from `/public/fonts/` — not Google Fonts CDN

### 8.3 RTL / Layout
- [ ] Zero `pl-` / `pr-` / `ml-` / `mr-` in component classNames
- [ ] `ps-` / `pe-` / `ms-` / `me-` used for all inline spacing
- [ ] `text-start` / `text-end` used instead of `text-left` / `text-right`
- [ ] Component renders correctly in `dir=rtl` AND `dir=ltr`
- [ ] `start-0` / `end-0` used instead of `left-0` / `right-0`

### 8.4 Patterns
- [ ] No `rounded-full` on any button — `rounded-lg` maximum
- [ ] No `purple` / `violet` / `indigo` anywhere in component
- [ ] Hover state uses `#E8B86D` (goldLight) — not a darkened gold
- [ ] All interactive elements have `aria-label` in Arabic
- [ ] No `!important` declarations anywhere

### 8.5 Performance
- [ ] No unused icon imports or heavy library imports
- [ ] Images use `next/image` with proper `width` + `height` props
- [ ] No `style=` attributes for colors or fonts — Tailwind classes only
- [ ] No data fetching without caching (`React.cache()` or SWR)

---

## 9. Menu Page — Component Architecture

> أكثر صفحة تعقيداً في المشروع. اقرأ هذا القسم قبل بناء أي جزء من صفحة المنيو.

### 9.1 Layout Structure

```
MenuPage
├── CategoryFilterBar     ← sticky top, horizontal scroll
├── SearchInput           ← optional, below filter bar
└── MenuGrid
    ├── MenuItemCard[]    ← repeating
    └── EmptyState        ← when filter returns 0 results
```

### 9.2 Grid Layout

```tsx
// OK CORRECT — responsive grid
<div className="
  grid
  grid-cols-1
  sm:grid-cols-2
  lg:grid-cols-3
  xl:grid-cols-4
  gap-4
  ps-4 pe-4
  pt-4 pb-8
">
  {items.map(item => <MenuItemCard key={item.id} item={item} />)}
</div>
```

### 9.3 Category Filter Bar

```tsx
// OK CORRECT — sticky, horizontal scroll, RTL-safe
<div
  className="
    sticky top-0 z-10
    bg-[#0A0A0A]/95 backdrop-blur-sm
    border-b border-[#2A2A2A]
    overflow-x-auto scrollbar-none
    flex gap-2
    ps-4 pe-4 pt-3 pb-3
  "
  dir="rtl"
>
  {categories.map(cat => (
    <button
      key={cat.id}
      className={`
        shrink-0 rounded-lg px-4 py-2 text-sm font-['Almarai'] font-bold
        transition-colors duration-[150ms]
        ${active === cat.id
          ? 'bg-[#C8922A] text-[#0A0A0A]'
          : 'bg-[#141210] text-[#6B6560] hover:text-[#F5F5F5]'
        }
      `}
      onClick={() => setActive(cat.id)}
    >
      {cat.nameAR}
    </button>
  ))}
</div>

// Rules:
// - px-4 py-2 allowed (symmetric — no directional issue)
// - shrink-0 prevents pills from compressing
// - scrollbar-none hides scrollbar visually (still scrollable)
// - backdrop-blur so content under looks clean
```

### 9.4 Menu Item Card — Full Spec

```tsx
// Image ratio: 1:1 (square) — aspect-square
// Hover: border → gold, image → subtle scale

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
  {/* Image — 1:1 ratio always */}
  <div className="relative aspect-square overflow-hidden">
    <Image
      src={item.image ?? '/images/placeholder/dish.jpg'}
      alt={item.nameAR}
      fill
      className="object-cover transition-transform duration-[400ms] group-hover:scale-105"
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
    />
    {/* Out of stock overlay */}
    {!item.available && (
      <div className="absolute inset-0 bg-[#0A0A0A]/70 flex items-center justify-center">
        <span className="font-['Almarai'] font-bold text-[#C0392B] text-sm">
          {t('menu.outOfStock')}
        </span>
      </div>
    )}
    {/* Filter tags — top-start corner */}
    {item.tags?.length > 0 && (
      <div className="absolute top-2 start-2 flex flex-col gap-1">
        {item.tags.map(tag => <FilterTag key={tag} tag={tag} />)}
      </div>
    )}
  </div>

  {/* Content */}
  <div className="p-4 flex flex-col flex-1">
    <h3 className="font-['Cairo'] font-black text-[#F5F5F5] text-lg leading-snug">
      {item.nameAR}
    </h3>
    {item.nameEN && (
      <p className="font-['Satoshi'] text-[#6B6560] text-sm mt-0.5">
        {item.nameEN}
      </p>
    )}
    {item.description && (
      <p className="font-['Almarai'] text-[#6B6560] text-sm mt-2 line-clamp-2 flex-1">
        {item.description}
      </p>
    )}
    <div className="flex items-center justify-between mt-3">
      <span className="font-['Satoshi'] font-medium text-[#C8922A] text-lg tabular-nums">
        {item.price.toFixed(3)} {t('currency')}
      </span>
      <AddToCartButton item={item} disabled={!item.available} />
    </div>
  </div>
</article>
```

### 9.5 Out-of-Stock States

| State | Visual Treatment |
|---|---|
| Available | Normal card — gold border on hover |
| Out of stock | Semi-transparent overlay `bg-[#0A0A0A]/70` + red label |
| Out of stock | Add to cart button: `disabled` + `opacity-40 cursor-not-allowed` |
| Out of stock | Card still visible — never hidden from grid |

### 9.6 Filter Tags

```tsx
const TAG_CONFIG = {
  vegetarian: { labelAR: 'نباتي',        bg: '#27AE60', text: '#0A0A0A' },
  spicy:      { labelAR: 'حار',          bg: '#C0392B', text: '#F5F5F5' },
  new:        { labelAR: 'جديد',         bg: '#C8922A', text: '#0A0A0A' },
  popular:    { labelAR: 'الأكثر طلباً', bg: '#1C1A16', text: '#E8B86D' },
} as const

// style= allowed here — dynamic values from config object, not hardcoded in JSX
<span
  className="text-[10px] font-['Almarai'] font-bold rounded px-1.5 py-0.5"
  style={{ backgroundColor: TAG_CONFIG[tag].bg, color: TAG_CONFIG[tag].text }}
>
  {TAG_CONFIG[tag].labelAR}
</span>
```

### 9.7 Search Input

```tsx
// Only render if menu has > 30 items
<div className="relative ps-4 pe-4 pt-3 pb-2">
  <input
    type="search"
    placeholder={t('menu.search')}
    className="
      w-full bg-[#141210] border border-[#2A2A2A] rounded-lg
      ps-4 pe-10 pt-3 pb-3
      font-['Almarai'] text-[#F5F5F5] text-sm
      placeholder:text-[#6B6560]
      focus:border-[#C8922A] focus:outline-none
      transition-colors duration-[150ms]
    "
    dir="rtl"
  />
  <SearchIcon className="absolute end-8 top-1/2 -translate-y-1/2 text-[#6B6560] w-4 h-4" />
</div>
```

### 9.8 Empty State

```tsx
<div className="flex flex-col items-center justify-center py-20 text-center">
  <p className="font-['Cairo'] font-black text-[#F5F5F5] text-xl mb-2">
    لا توجد نتائج
  </p>
  <p className="font-['Almarai'] text-[#6B6560] text-sm">
    جرّب تصنيفاً آخر أو غيّر كلمة البحث
  </p>
</div>
```

### 9.9 Menu Page Acceptance Criteria

- [ ] Grid: 1 col mobile → 2 tablet → 3 desktop → 4 wide
- [ ] Category filter is sticky and horizontally scrollable on mobile
- [ ] Active category: `bg-[#C8922A]` + `text-[#0A0A0A]`
- [ ] All images are 1:1 `aspect-square` with `object-cover`
- [ ] Out-of-stock items show overlay — never hidden from grid
- [ ] Search uses `ps-` / `pe-` — never `pl-` / `pr-`
- [ ] Filter tags use `start-2` — never `left-2`
- [ ] Empty state shown when filter/search = 0 results
- [ ] `sizes` prop set on all `<Image>` for responsive loading
- [ ] `group` + `group-hover:scale-105` on image for hover effect
