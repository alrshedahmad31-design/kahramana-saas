# DATA MAP — Kahramana Baghdad
> Phase 0 Audit | Generated: 2026-04-27 | Agent: Claude

---

## 1. Public Assets Summary

| Category | Count | Format | Status |
|---|---|---|---|
| Dish gallery images | 183 | .webp | OK Ready |
| Menu category covers | 5 | .webp | OK Ready |
| Featured dish | 1 | .webp | OK Ready |
| Chef-made photos (originals) | 14 | .webp | OK Ready |
| Chef-made thumbnails (_th) | 14 | .webp | OK Ready |
| Interior photos (originals) | 12 | .webp | OK Ready |
| Interior thumbnails (_th) | 12 | .webp | OK Ready |
| Hero images | 4 | .webp | OK Ready |
| Hero video | 1 | .mp4 | OK Ready |
| Catering images | 3 | .webp | OK Ready |
| Recipe images | 3 | .webp | OK Ready |
| Recipe videos | 3 | .mp4 | OK Ready |
| Branch photos | 2 | .webp | OK Ready |
| Founder photos | 2 | .webp | OK Ready |
| Brand logo | 1 | .webp + .svg | OK SVG added → `public/brand/logo.svg` |
| OG image | 1 | .webp | OK Ready |
| Menu featured (masgouf, quzi) | 2 | .webp | OK Converted from PNG |
| Favicon set | 7 | .png/.ico/.svg | OK Ready |
| PWA manifest | 1 | .webmanifest | OK Fixed |
| **TOTAL** | **284 files** | — | — |

---

## 2. Fonts Inventory

| Font | Files | Weight | Status |
|---|---|---|---|
| Editorial New | EditorialNew-Bold.woff2 | 700 | OK |
| Editorial New | EditorialNew-Light.woff2 | 300 | Warning: Filename mismatch — design-system.md expects `EditorialNew-Regular.woff2` for weight 300 |
| Satoshi | Satoshi-Regular.woff2 | 400 | Warning: design-system.md expects `Satoshi-Variable.woff2` (variable font) |
| Satoshi | Satoshi-Medium.woff2 | 500 | OK |
| Cairo | — | 800 | NO Missing — must load via next/font/google |
| Almarai | — | 400, 700 | NO Missing — must load via next/font/google |

**Notes:**
- Cairo and Almarai will be loaded via `next/font/google` in Phase 1 (acceptable per design-system.md).
- `EditorialNew-Light.woff2` should be registered as `font-weight: 300` in `@font-face` — the filename is non-standard but the file is functional.
- Consider replacing with `Satoshi-Variable.woff2` in Phase 1 for optimal range support.

---

## 3. Dish Image Coverage

**Expected total:** ~194 dishes across all categories  
**Found in gallery/:** 183 images  
**Gap:** ~11 dishes unaccounted for

### Menu Category Covers (5 of ~14 categories covered)

| File | Category |
|---|---|
| charcoal-grills.webp | مشاويات على الفحم |
| main-courses.webp | أطباق رئيسية |
| pizza.webp | بيتزا |
| shawarma.webp | شاورما |
| soups.webp | حساء |

**Missing category covers (~9):** Breakfast, Sandwiches, Salads, Sides, Beverages/Juices, Mezze, Iraqi Specialties, Pastries/Pies, Desserts — to be confirmed with full menu data.

---

## 4. Video Assets

| File | Purpose | Status |
|---|---|---|
| `hero/hero-menu.mp4` | Homepage hero background video | OK |
| `recipes/baqala-bil-dihin.mp4` | Recipe video content | OK |
| `recipes/makhlama-iraqi.mp4` | Recipe video content | OK |
| `recipes/tabsi-iraqi.mp4` | Recipe video content | OK |

---

## 5. Branch Photos

| File | Branch |
|---|---|
| `muharraq-galali-branch.webp` | القلالي (Qallali/Muharraq) |
| `riffa-hajiyat-branch.webp` | الرفاع (Riffa) |

Both active branches are covered. Al-Badi' branch is planned — no photo expected yet.

---

## 6. Catering Images

| File | Service |
|---|---|
| `corporate.webp` | Corporate catering |
| `live-grill.webp` | Live grill stations |
| `wedding.webp` | Wedding catering |

---

## 7. PWA / Favicon Status

| Item | Before | After |
|---|---|---|
| Favicon duplication | `/public/favicon/` + `/public/assets/favicon/` | OK Merged — `/public/assets/favicon/` only |
| manifest theme_color | `#ffffff` | OK Fixed → `#0A0A0A` |
| manifest background_color | `#000000` | OK Fixed → `#0A0A0A` |
| manifest icon paths | `/web-app-manifest-*.png` (broken) | OK Fixed → `/assets/favicon/web-app-manifest-*.png` |
| manifest name | `kahramanat` | OK Updated → `كهرمانة بغداد` |
| manifest lang/dir | missing | OK Added → `lang: ar, dir: rtl` |

---

## 8. Total Public Folder Size

**64 MB** — acceptable for production. No optimization required at Phase 0.

---

## 9. Menu JSON Audit — `src/data/menu.json`

> Received: 2026-04-27 | File size: 142 KB

### 9.1 — Coverage Summary

| Metric | Value | Target | Gap |
|---|---|---|---|
| Total items | 179 | ~194 | NO 15 items missing |
| Categories | 16 | 14 (prev estimate) | ℹ️ 2 new categories confirmed |
| Items without `image_url` | 0 | 0 | OK |
| Items without `name.ar` | 0 | 0 | OK |
| Items without `name.en` | 0 | 0 | OK |
| Items with pricing (any structure) | **179/179** | 179 | OK all priced |
| Unavailable items | 0 | — | OK all active |

**Pricing structures — 4 types:**

| Structure | Count | Example |
|---|---|---|
| `price_bhd` direct (number) | 127 | `{ price_bhd: 1.6 }` |
| `sizes` object (key → price) | 40 | `{ sizes: { S: 1.5, L: 2.5 } }` |
| `variants` array with `price_bhd` | 10 | `[{ label:{ar,en}, price_bhd: 1.8 }]` |
| `sizes` + `variants` (free choice) | 2 | quzi: price from `sizes`, stew choice from `variants` (no extra cost) |

### 9.2 — Category Breakdown

| # | Arabic Name | English Name | Items | Price Status |
|---|---|---|---|---|
| 1 | الفطور البغدادي | Baghdadi Breakfast | 23 | OK all priced |
| 2 | معجنات | Pastries | 25 | OK all priced (mix of direct + variants) |
| 3 | فتات | Fatteh | 3 | OK all priced |
| 4 | الشوربات | Soups | 4 | OK all priced |
| 5 | السلطات | Salads | 6 | OK all priced |
| 6 | المقبلات الباردة | Cold Appetizers | 8 | OK all priced (some via sizes) |
| 7 | المقبلات الحارة | Hot Appetizers | 8 | OK all priced (some via sizes) |
| 8 | الأطباق الرئيسية | Main Courses | 25 | Warning: 2 missing: quzi lamb/chicken (variant labels, no price) |
| 9 | المرق | Stews | 3 | OK all priced (via variants) |
| 10 | مشاوي كهرمانة | Signature Grills | 14 | OK all priced (mix of direct + sizes) |
| 11 | شاورما | Shawarma | 12 | OK all priced |
| 12 | بيتزا | Pizza | 9 | OK all priced |
| 13 | السندويشات | Sandwiches | 13 | OK all priced (some via variants) |
| 14 | عصائر كهرمانة المنعشة | Signature Fresh Juices | 20 | OK all priced (some via sizes: Glass/0.5L/1L) |
| 15 | ركن الشاي والقهوة الأصيلة | Traditional Tea & Coffee | 4 | OK all priced (via variants) |
| 16 | الحلويات | Desserts | 2 | OK all priced |
| **Total** | — | — | **179** | **177 OK / 2 Warning:** |

### 9.3 — Schema vs Phase 1 Spec

The received JSON uses different field names from the Phase 1 TypeScript spec. A normalization layer is required in the data-access layer (Phase 1).

| Field (received JSON) | Phase 1 Spec field | Notes |
|---|---|---|
| `category.ar` | `category.nameAR` | Rename needed |
| `category.en` | `category.nameEN` | Rename needed |
| NO missing | `category.id` | No slug/id on category — derive from item IDs |
| `item.name.ar` | `item.nameAR` | Nested → flat |
| `item.name.en` | `item.nameEN` | Nested → flat |
| `item.price_bhd` | `item.price` | Rename + unit clarification |
| `item.image_url` | `item.image` | Rename needed |
| NO missing | `item.categoryId` | Not set — must be injected at read time |
| `item.available` | — | OK Present (all `true`) |
| `item.description.ar/en` | — | OK Bilingual descriptions present |
| `item.ingredients` | — | OK Present (empty arrays — to be filled Phase 3) |

**Resolution**: In Phase 1, `src/lib/menu.ts` will normalize on read — no changes to the raw JSON source.

### 9.4 — Normalization Cases for `src/lib/menu.ts`

```typescript
// Case 1: price_bhd direct → single price (127 items)
// { price_bhd: 1.6 }
// → displayPrice: "1.600 BD", hasOptions: false

// Case 2: sizes object → "from X BD" + size selector (40 items)
// { sizes: { S: 1.5, L: 2.5 } }
// → displayPrice: "from 1.500 BD", hasOptions: true, optionType: "size"
// Note: size keys are raw strings (S, L, M, XL, Glass, 0.5L, 1L, 1.5L, 1KG, HALF KG)
// No bilingual labels in JSON — label mapping needed in UI layer

// Case 3: variants array with prices → "from X BD" + variant selector (10 items)
// { variants: [{ label: { ar, en }, price_bhd: 1.8 }, ...] }
// → displayPrice: "from 1.800 BD", hasOptions: true, optionType: "variant"

// Case 4: sizes + variants without price_bhd (2 items — quzi)
// price comes from sizes, variants are free customization (which stew)
// { sizes: { S: 4, M: 8, L: 12, XL: 16 }, variants: [{ label:{ar,en} }] }
// → displayPrice: "from 4.000 BD", hasOptions: true
// → optionType: "size+variant", variantPrice: 0 (free add-on)
```

---

## 10. Actions Taken This Session

| Action | File | Result |
|---|---|---|
| Deleted duplicate favicon folder | `/public/favicon/` | OK Done |
| Fixed PWA manifest | `/public/assets/favicon/site.webmanifest` | OK Done |
| Converted PNG → WebP | `public/assets/menu/masgouf.png` | OK Done |
| Converted PNG → WebP | `public/assets/menu/quzi.png` | OK Done |
| Added logo SVG | `public/brand/logo.svg` | OK Done |
| Added branch contacts doc | `docs/branches.md` | OK Done |
| Added contact constants | `src/constants/contact.ts` | OK Done |
| Added Maps URLs | `src/constants/contact.ts` | OK Done |
| Added menu data | `src/data/menu.json` | OK Done (177/179 priced, 2 quzi items pending) |
