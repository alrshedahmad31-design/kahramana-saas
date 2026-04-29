# SKILL: Kahramana Baghdad Project Context

## When to use this skill
Load this skill when working on any feature to understand project constraints and design decisions.

## Business Context
- Restaurant with 2 active branches (Riffa + Qallali) + 1 planned (Al-Badi')
- Current ordering: random WhatsApp messages → must move to structured dashboard
- Target: full operations platform (orders, KDS, inventory, loyalty, drivers, analytics)
- Client: non-technical restaurant owner — UI must be simple and in Arabic

## Design System
- Name: "Midnight Mesopotamian Luxe"
- Background: `#0c0a08` (deep black)
- Accent: `#d0a24a` (warm gold), `#f3d690` (gold light)
- Font Arabic: Cairo | Font EN/numbers: Inter
- Direction: RTL primary (Arabic), LTR fallback (English)

## Architecture Decisions
- Phase 1 ordering uses `wa.me` links (NOT WhatsApp API) — zero extra cost at start
- Phase 6 upgrades to Wati.io WhatsApp Business API
- Guest checkout: phone optional → linkable to account in Phase 5
- Sanity CMS owns ALL menu content — nothing menu-related is hardcoded
- Supabase owns orders, users, branches, inventory, loyalty
- Al-Badi' branch is `planned` — all branch logic must support future branches without rebuild

## Bilingual Rules
- `html lang="ar" dir="rtl"` always
- `next-intl` for all strings — no exceptions
- File: `messages/ar.json` (primary) + `messages/en.json`
- All schema fields that show to users: `{ ar: string, en: string }`

## CSS Rules (CRITICAL)
```
OK ALLOWED: ps-4, pe-4, ms-auto, me-4, ps-[20px]
NO FORBIDDEN: pl-4, pr-4, ml-auto, mr-4, padding-left, padding-right
```
Logical properties ensure RTL/LTR layout works without duplication.

## Supabase Tables (will grow by phase)
Phase 1 minimum: `orders`, `order_items`, `branches`, `menu_items`, `menu_categories`
Phase 2 adds: `order_status_log`, `kds_settings`
Phase 3 adds: `inventory`, `ingredients`, `recipes`, `recipe_ingredients`, `waste_log`
Phase 5 adds: `customers`, `loyalty_points`, `loyalty_tiers`, `coupons`

## Branch WhatsApp Routing
```typescript
// Orders go to branch-specific wa.me — NOT a single number
const BRANCH_WHATSAPP = {
  riffa: process.env.NEXT_PUBLIC_WA_RIFFA,
  qallali: process.env.NEXT_PUBLIC_WA_QALLALI,
} as const
```
