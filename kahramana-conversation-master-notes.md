# Kahramana Baghdad — Conversation Master Notes

**Generated:** 2026-05-13 (Session 93)
**Language:** Arabic-first
**Purpose:** Consolidated Markdown record of this conversation: decisions, prompts, architecture notes, implementation guidance, risks, integrations, and next steps for the Kahramana Baghdad website/platform project.

> ملاحظة: هذا الملف ليس تفريغًا حرفيًا لكل كلمة في المحادثة، بل نسخة تنفيذية منظمة تجمع ما تم الاتفاق عليه وما تم توليده من برومبتات وقرارات تقنية وتشغيلية.

---

## 1. Project Context

مطعم **كهرمانة بغداد** لديه موقع قائم، وكانت الطلبات تتم أساسًا عبر WhatsApp. الهدف من المشروع هو تحويل الموقع إلى منصة طلبات وتشغيل احترافية تشمل:

- موقع فخم وسريع ومناسب للهواتف.
- منيو منظم وتجربة طلب كاملة.
- Checkout مع WhatsApp fallback في البداية.
- Dashboard للطلبات.
- KDS متعدد المحطات للمطبخ.
- Staff Management وRBAC.
- Driver PWA.
- Loyalty + Coupons.
- Inventory (Phase 3 — complete).
- Manual POS لطلبات الهاتف والـ Walk-in.
- Service Mode POS لطلبات الطاولة على الـ iPad.
- Waiter App PWA لخدمة الطاولات.
- QR Ordering للزبائن من الطاولة.
- Promotion Engine للعروض والخصومات.
- Reservations System (guest + dashboard).
- Payments, Analytics, AI (future phases).

الفروع المعتمدة:

| الفرع | الحالة |
|---|---|
| الرفاع | Active |
| قلالي | Active |
| البديع | Hidden (platform-wide, code-level filter) |

---

## 2. Latest Project Status (Session 93 — 2026-05-13)

### Completed Phases

- ✅ **Phase 0 — Discovery**
- ✅ **Phase 1 — Foundation** — 56 files
- ✅ **Phase 2 — Security + KDS** — 20 files
- ✅ **Phase 3 — Inventory** — complete with full audit fixes
- ✅ **Phase 4 — Driver PWA** — 10 files (real-time GPS + Leaflet maps)
- ✅ **Phase 5 — Loyalty + Coupons** — 28 files (incl. redemption on checkout)
- ✅ **Phase 6 — Payment Infrastructure** — Tap integration scaffolded
- ✅ **Phase 6b — Dashboard Inventory Widgets** — 4 widgets + Realtime alerts
- ✅ **Phase 7 — Analytics & Reporting**
- ✅ **Security Hardening** — 14 Critical fixes + BL-003 + BL-004 (migrations 119–122)
- ✅ **Manual POS** — full system with item notes, branch scope, hydration-safe CSS Module
- ✅ **Service Mode POS** — fullscreen tablet dine-in interface, mobile responsive
- ✅ **KDS Multi-Station** — 5 canonical stations with Realtime + full audit fixes
- ✅ **Menu Management** — full CRUD with AR/EN editor + DB-first architecture
- ✅ **Waiter App PWA** — table-aware ordering, dine_in type, POS-style layout
- ✅ **QR Ordering** — `/table/[branchId]/[tableNumber]`, guest flow, QR PNG generation
- ✅ **Promotion Engine** — 5 types, wired into all 4 order paths
- ✅ **Waitlist Management** — migration 099, real-time, WhatsApp notify, RBAC
- ✅ **Reservations System** — migration 114+117, dashboard UI, guest `/reserve` page
- ✅ **Owner Dashboard** — unified ops/financial/service/branch view at `/dashboard/owner`
- ✅ **Schema Markup** — Restaurant, BreadcrumbList, FAQPage, MenuItem, AggregateRating
- ✅ **Impeccable Design System** — PRODUCT.md + DESIGN.md, P1 fixes (touch targets, glows, tokens)
- ✅ **Sidebar Reorder** — 4 logical groups (Operations, Customers, Finance, Admin)

### Session 90–93 — 2026-05-13

**Total commits this session:** ~50 commits

#### Schema Markup (9c8fbd6 → 388aadf)
- 8 JSON-LD fixes: dedup Organization, BHD currency, FAQ scope, menu truncation, catering URL, contactType
- Per-branch AggregateRating: Riffa 4.5/1600, Qallali 4.4/121, Brand 4.5/1650 (confirmed from Google Business Profile)
- Description strings synced to 4.5/1600
- Orphan `MenuItemSchema.tsx` deleted

#### Impeccable Design System
- Installed `impeccable` skill + `PRODUCT.md` + `DESIGN.md`
- Brand: Heritage. Earned. Generous. / North Star: The Bronze Kitchen at Night
- Anti-references: Generic SaaS, Western fast-casual, Tourist Middle-Eastern cliché, Generic delivery app
- P1 fixes: touch targets 40px→44px, gold glows removed (CinematicButton + PhilosophyManifesto + LoyaltySection), white/black → brand tokens
- Homepage audit 13/20 → expected 16+/20
- P0 fixes: brand-muted contrast #6B6560→#9A938C (WCAG AA 4.52:1), ProtocolStack pinSpacing, heading hierarchy

#### Logo Fix
- SVG `fill="currentColor"` → `fill="#C8922A"` (visible on dark background)
- Replaced portrait SVG with landscape `logo-full.webp` (526×335)
- Height-based sizing `w-10/w-14 h-auto` for correct aspect ratio

#### POS Service Mode (23a9831 → 0cc1923)
- New route: `/dashboard/pos/service` with fullscreen overlay layout
- 2-column landscape: vertical category nav + text-first item tiles
- Table selector 1-20 grid + car number field
- Mobile: tab switcher, horizontal categories
- Per-item notes, `createServiceOrder` server action (skips name/phone for dine-in)
- `p_order_type: 'dine_in'` (not collapsed to pickup — follows waiter pattern)
- `WAITER_PLACEHOLDER_PHONE` for anonymous orders

#### Reservations System
- **Migration 114**: `reservations` table + `rpc_find_available_tables` + `rpc_create_reservation` + RLS
- **Migration 116**: Relax phone constraint to international numbers (7-30 chars)
- **Migration 117**: `seating_type` column (family_section/arabic_seating/outdoor/indoor)
  - Riffa: all 4 options; Qallali: outdoor + indoor only
- **Dashboard**: `/dashboard/reservations` with realtime, card UI, status actions
- **Guest page**: `/reserve` (AR + EN) — cinematic luxury form, rate-limited (prod only), WhatsApp confirm
- **Sidebar nav**: Calendar icon, after waitlist
- **RBAC**: `owner/general_manager/branch_manager/cashier/waiter`

#### Owner Dashboard (a5b3795)
- New route: `/dashboard/owner` (owner + GM only)
- Block 1: Operations Snapshot — orders today, revenue, AOV, late orders, source breakdown, top/slowest items
- Block 2: Financial Snapshot — 3-period table (today/week/month), Food Cost %, Labor Cost %, Est. Net Profit
- Block 3: Service Quality — avg prep time, cancellations, repeat rate
- Block 4: Branch Comparison — Riffa + Qallali cards
- Crown icon in sidebar, first after home

#### Sidebar Reorder (6092311 → d12339f)
- 4 groups with visible labels: التشغيل / العملاء / المالية / الإدارة
- Group dividers `border-brand-border/50` with `text-[10px] uppercase tracking-widest` labels

#### Security — BL-003 + BL-004 (3a72b22 → e615b91)
- **Migration 119**: 4 SECURITY DEFINER views → `security_invoker`
- **Migration 120**: 8 high-severity INSERT/SELECT policies closed (orders, order_items, inventory_lots, supplier_price_history, prep_items)
- **Migration 121**: `customers` anon INSERT shape guard (name 1-120, phone regex)
- **Migration 122**: contact_messages shape guard + ingredient_allergens/restaurant_profile/unit_conversions staff scoping
- `system_settings` public-read confirmed safe (only menu display flags + payment methods)

#### Test Orders Cleanup
- 20 test orders deleted (697.600 BHD total)
- 19 payments deleted (cash/pending_cod only)
- CASCADE: order_items, coupon_redemptions, kds_queue, etc.
- **FK Note**: `payments_order_id_fkey` is ON DELETE RESTRICT — must clear payments before deleting orders

#### Header Redesign
- CTA changed: "اطلب الآن" (WhatsApp) → "احجز طاولة" → `/reserve`
- "فروعنا" → "تواصل معنا"
- Mobile: language toggle moved inside hamburger; bar = hamburger + cart + reserve + account
- Logo: portrait SVG → landscape webp, width-based sizing

#### Build & Performance
- Removed orphaned recipe videos: 3 × .mp4 (35.6 MB) + 3 × .webp posters
- Fixed 9 `no-explicit-any` ESLint errors blocking Vercel deploy
- Added `export const dynamic = 'force-dynamic'` to dashboard/menu to silence DYNAMIC_SERVER_USAGE
- Node engines pinned to `"node": "20.x"`
- `productionBrowserSourceMaps: true` + Sentry config fixes
- 0 ESLint warnings, 548/548 pages

#### Playwright Tests
- Fixed 3 stale tests (Branches→Contact nav, WhatsApp→phone text assertion)
- Mobile overflow fixed (language toggle moved to hamburger)

#### Security Audit Findings (ESPRESSO AUDITOR v6.1.1)
| ID | Severity | Status | Fix |
|---|---|---|---|
| F-01 | 🟠 HIGH | ⏳ Verify in Incognito | Cookie consent / PDPL — confirm GA/Clarity gated |
| F-02 | 🟠 HIGH | ✅ Fixed (a867977) | Sentry org_id — tracePropagationTargets: [/^\/api\//] |
| F-03 | 🟠 HIGH | ✅ CSP confirmed | CSP present in response headers |
| F-04 | 🟡 MEDIUM | ✅ Present | Rate limiting on reserve + contact (prod only, NODE_ENV gate) |
| F-05 | 🟡 MEDIUM | ✅ Fixed (ef9fe86) | Privacy policy — PDPL elements added |
| F-06 | 🟡 MEDIUM | ✅ Fixed (a5f13a5) | Sentry release: full SHA → `kahramana-{branch}-{short-sha}` |
| F-07 | 🔵 LOW | ✅ Fixed (724f115) | `/privacy` → `/privacy-policy` in CheckoutForm |
| F-08 | 🔵 LOW | Deferred | Route structure in Sentry transaction (low risk) |

#### Sentry Sourcemap Warnings
- Ongoing: Sentry plugin emits "could not auto-detect referenced sourcemap" for ~50 chunks
- Root cause: UUID-named Next.js internal chunks lack `//# sourceMappingURL=` comment — Sentry plugin limitation, not a code bug
- Impact: Sentry stack traces show minified code for those specific chunks; does not affect site functionality
- Status: Accepted as known limitation of `@sentry/nextjs` v10 with Next.js 15 Turbopack

### Build Statistics (Session 93)

| Metric | Value |
|---|---:|
| Pages | 548 static |
| Build errors | 0 |
| TSC errors | 0 |
| ESLint warnings | 0 |
| Migrations applied | 085–122 |
| Deployment | https://kahramanat.com (DNS confirmed ✅) |
| Better Stack | ✅ Up |

### Pending / Blocked

- ⏳ **Staff accounts seeding** — migration 090 ready, waiting on 13 emails from restaurant owner
- ⏳ **Tap payment** — waiting on merchant account
- ⏳ **WhatsApp Business API** — blocked on Meta verification
- ⏳ **Benefit Pay** — blocked on CBB approval (2–4 months)
- ⏳ **Chef recipes import** — blocked on chef Excel data
- ⏸️ **Phase 7b — Deliverect/POS** — blocked on contract + Bahrain availability
- 🔒 **Phase 8 — AI Features** — requires 6 months real data
- 🟡 **Cloudflare Turnstile env vars** — `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` لم تُضف لـ Vercel بعد
- 🟡 **Refund Modal** — blocked on Tap payment keys
- 🟡 **F-01 Verify** — open DevTools Incognito → confirm GA/Clarity don't load before cookie consent

---

## 3. Applied Migrations Reference

| Migration | Name | Applied |
|---|---|---|
| 061 | loyalty_points_redeemed + loyalty_discount_bhd | ✅ |
| 062 | rpc_create_order atomic | ✅ |
| 063 | customer security + RLS | ✅ |
| 064 | dashboard security hardening | ✅ |
| 065 | dashboard security hardening 2 | ✅ |
| 066 | rpc_create_order p_branch_id TEXT | ✅ |
| 067 | loyalty trigger fix | ✅ |
| 068 | drop jetski_test | ✅ |
| 069 | hash clock_pin | ✅ |
| 070 | menu availability | ✅ |
| 071 | shift closing | ✅ |
| 072 | KDS multi-station | ✅ |
| 073 | POS RPC fix | ✅ |
| 074 | menu items enhanced | ✅ |
| 075 | menu items RLS CRUD | ✅ |
| 076 | menu sync | ✅ |
| 077 | KDS trigger slug fix | ✅ |
| 078 | KDS station mapping | ✅ |
| 079 | KDS station config | ✅ |
| 080 | seed menu_items_sync (168 items) | ✅ |
| 081 | KDS audit P0+P1 | ✅ |
| 082 | KDS realtime payload | ✅ |
| 083 | rpc_create_order modifiers JSONB | ✅ |
| 084 | loyalty_config | ✅ |
| 085 | rpc_create_order table_number + waiter/qr | ✅ |
| 086 | rpc_create_order promotion_id | ✅ |
| 087 | promotion engine | ✅ |
| 088 | menu_option_groups FK fix | ✅ |
| 089 | KDS RLS hardening + branch_id denorm + UNIQUE(item_id) | ✅ |
| 090 | waiter role enum (staff_role) | ✅ |
| 091 | rpc_create_order PRICE_MISMATCH bypass for size/variant | ✅ |
| 092 | shift_closing RLS branch scope | ✅ |
| 093 | orders UPDATE RLS hardening | ✅ |
| 094 | KDS RLS hardening | ✅ |
| 095 | orders UPDATE RLS tighten | ✅ |
| 096 | driver hardening | ✅ |
| 097 | labor_cost_metrics RPC + menu_engineering_matrix | ✅ |
| 098 | promotions RLS | ✅ |
| 099 | waitlist_entries | ✅ |
| 100 | KDS enhancements (Recall + All-Day + Checkmarks) | ✅ |
| 101 | KDS shawarma routing | ✅ |
| 102 | KDS shawarma routing v2 | ✅ |
| 103 | KDS station routing v2 | ✅ |
| 104 | bump_station_order overload fix | ✅ |
| 105 | KDS conflict-aware RPC | ✅ |
| 106–113 | Various driver/delivery/analytics fixes | ✅ |
| 114 | reservations table + RPC + RLS | ✅ |
| 115 | Proof of Delivery | ✅ |
| 116 | reservations phone → international (7-30 chars) | ✅ |
| 117 | reservations seating_type column | ✅ |
| 118 | orders.arrived status + ready_at | ✅ |
| 119 | SECURITY DEFINER views → security_invoker (BL-003) | ✅ |
| 120 | RLS BL-004 high-severity (orders/order_items/inventory/supplier) | ✅ |
| 121 | customers anon INSERT shape guard | ✅ |
| 122 | BL-004 P2 — contact/allergens/restaurant_profile/unit_conversions | ✅ |

---

## 4. Key Architectural Decisions

### Stack
- **Framework**: Next.js 15 App Router + Turbopack
- **DB**: Supabase (PostgreSQL + RLS + RPC + Realtime)
- **Hosting**: Vercel (kahramanat.com confirmed ✅)
- **Styling**: Tailwind CSS + CSS Modules (POS only)
- **i18n**: next-intl, `[locale]` route prefix, AR primary + EN secondary
- **Fonts**: Cairo/Almarai (AR) + Editorial New/Satoshi (EN)
- **Monitoring**: Sentry (errors) + GA4 + Clarity (analytics, consent-gated) + Better Stack (uptime)
- **Security**: Cloudflare Turnstile (contact form, pending env vars)

### Design System
- **Brand**: Heritage. Earned. Generous.
- **North Star**: The Bronze Kitchen at Night
- **Colors**: brand-black #0A0A0A + brand-gold #C8922A
- **Rules**: no glows, no shadows on surfaces, flat-by-default, generous-and-tactile components
- **Tokens**: `design-tokens.ts` + `tailwind.config.ts` — never raw hex in components
- **RTL**: logical properties only (ps/pe/ms/me, never pl/pr/ml/mr)
- **PRODUCT.md + DESIGN.md**: committed to repo for Impeccable skill

### RLS Pattern (post-migration 046+)
- `auth_user_role()` + `auth_user_branch_id()` helpers for all policies
- service_role bypasses RLS (used by all server actions via `createServiceClient()`)
- Never call `requireDashboardSection` from public routes — use separate public server actions

### Order Flow
- `rpc_create_order` (service_role) → triggers `trg_inventory_reserve` + `trg_inventory_finalize`
- Inventory deduction: automatic via triggers — no explicit RPC calls needed
- Inventory + Sales link: COMPLETE — awaiting chef recipe data to activate

### Rate Limiting Pattern
- Upstash Redis sliding window
- `NODE_ENV === 'production'` gate — dev passes through
- Keys: `reserve:${ip}`, `contact:${ip}`
- Rates: reserve 3/IP/hour, contact 5/IP/hour

---

## 5. Security Posture

### Confirmed Safe
- HTTPS enforced ✅
- No `.env`/`.git` exposure ✅
- CSP active (nonce-based in production) ✅
- `frame-ancestors 'none'` ✅
- Staff/customer auth separated ✅
- BL-003 (SECURITY DEFINER views) ✅ closed migration 119
- BL-004 (open INSERT/SELECT policies) ✅ closed migrations 120–122
- Sentry org_id removed from HTML baggage ✅

### Pending Verification
- F-01: Confirm GA/Clarity don't fire before cookie consent (test in Incognito)

### Known Accepted
- Sentry sourcemap warnings (~50 chunks) — Next.js internal chunks, no impact on site
- F-08: Route structure in Sentry transaction — low risk, deferred

---

## 6. RBAC Roles

| Role | Access |
|---|---|
| owner | All sections + all branches |
| general_manager | All sections + all branches |
| branch_manager | Dashboard sections scoped to own branch |
| cashier | POS, orders, waitlist, reservations |
| waiter | Waiter app, POS service mode, waitlist, reservations |
| kitchen | KDS only |
| driver | Driver PWA only |
| inventory_manager | Inventory sections |

DashboardSection union (rbac-ui.ts): home, owner, orders, pos, kds, tables, waiter, driver, delivery, waitlist, reservations, coupons, promotions, payments, shifts, analytics, reports, audit, staff, menu, schedule, inventory, settings

---

## 7. Known Patterns & Gotchas

### CLS Prevention
- **NEVER touch image, layout, animation, or CSS code when targeting SEO/metadata changes**
- Two past regressions caused by layout changes; `git reset` + `git revert` used

### Supabase Type Regeneration
```bash
npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts
# Then strip the <claude-code-hint> XML tag at the end
```

### Order Deletion
- `payments_order_id_fkey` is ON DELETE RESTRICT
- `driver_earnings_order_id_fkey` + `inventory_movements_order_id_fkey` are no-action
- Must delete payments first before deleting orders

### Turbopack Cache Issue (Windows)
```powershell
Stop-Process -Name node -Force
Remove-Item -Recurse -Force .next
npm run dev
# Then Ctrl+Shift+R in browser
```

### Parallel Agent (Gemini)
- Gemini operates in parallel on the same repo
- Commits may bundle unrelated files
- Always run `git log --oneline -3` before committing to avoid conflicts
- Migration number collisions: check supabase/migrations/ before creating new ones

### Sentry Release Name
- Production: `kahramana-{VERCEL_GIT_COMMIT_REF}-{short-sha}` (e.g. `kahramana-master-a5f13a5`)
- Local dev: `undefined`

---

## 8. Environment Variables

### Required for Full Functionality
| Variable | Status | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Set | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Set | |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Set | Server only |
| `NEXT_PUBLIC_SENTRY_DSN` | ✅ Set | |
| `SENTRY_AUTH_TOKEN` | ✅ Set | Vercel production |
| `UPSTASH_REDIS_REST_URL` | ✅ Set | Rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ Set | Rate limiting |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | ⏳ Pending | Cloudflare Turnstile |
| `TURNSTILE_SECRET_KEY` | ⏳ Pending | Cloudflare Turnstile |
| `TAP_SECRET_KEY` | ⏳ Pending | Tap Payments |
| `NEXT_PUBLIC_TAP_PUBLIC_KEY` | ⏳ Pending | Tap Payments |

---

## 9. Routes Reference

| Route | Description |
|---|---|
| `/[locale]` | Homepage |
| `/[locale]/menu` | Menu listing |
| `/[locale]/menu/[slug]` | Category page |
| `/[locale]/menu/item/[slug]` | Item detail |
| `/[locale]/branches` | Branch listing |
| `/[locale]/branches/[branchId]` | Branch detail |
| `/[locale]/reserve` | Guest reservation form (NEW) |
| `/[locale]/checkout` | Checkout with loyalty + promotion |
| `/[locale]/order/[id]` | Order tracking (Realtime) |
| `/[locale]/payment/[orderId]` | Tap payment page |
| `/[locale]/account` | Loyalty points + history |
| `/[locale]/account/login` | Login |
| `/[locale]/account/register` | Register |
| `/[locale]/catering` | Catering page |
| `/[locale]/about` | About page |
| `/[locale]/contact` | Contact page |
| `/[locale]/privacy-policy` | Privacy policy (PDPL compliant) |
| `/[locale]/table/[branchId]/[tableNumber]` | QR Ordering |
| `/[locale]/waiter` | Waiter App — table grid |
| `/[locale]/waiter/table/[tableNumber]` | Waiter App — order builder |
| `/[locale]/driver` | Driver PWA |
| `/dashboard` | Dashboard home |
| `/dashboard/owner` | Owner unified view (NEW) |
| `/dashboard/orders` | Orders management |
| `/dashboard/pos` | Manual POS |
| `/dashboard/pos/service` | Service Mode POS — tablet (NEW) |
| `/dashboard/kds` | Kitchen Display System |
| `/dashboard/tables` | Table management |
| `/dashboard/waitlist` | Walk-in waitlist |
| `/dashboard/reservations` | Reservations dashboard (NEW) |
| `/dashboard/analytics` | Analytics |
| `/dashboard/inventory` | Inventory management |
| `/api/health` | Health check — DB reachability |

---

## 10. Production Smoke Test Checklist

- `/ar` and `/en` work ✅
- `/ar/menu` — out-of-stock items hidden
- `/reserve` — guest can create reservation, WhatsApp confirm link generated
- `/dashboard/reservations` — staff see reservations, can confirm/seat/cancel
- `/dashboard/pos/service` — fullscreen tablet mode, table selector, car number field
- `/dashboard/owner` — visible to owner/GM only, all 4 blocks populated
- Sidebar groups visible: التشغيل / العملاء / المالية / الإدارة
- Header CTA: "احجز طاولة" → `/reserve`
- Logo visible in header (gold, correct size)
- Cookie consent banner shown → analytics fire after accept only
- `/api/health` → 200, db.ok=true ✅
- KDS stations: mains/grill/shawarma/pizza/cold — no cross-station leakage
- Waitlist: add guest → notify (WhatsApp opens) → mark seated
- Realtime order tracking updates without refresh
- Loyalty points awarded on order `delivered` or `completed`
- Badee branch not visible anywhere in platform
- No horizontal scroll on mobile
- Touch targets ≥44px on all interactive elements

---

## 11. Session History Summary

| Session | Date | Focus |
|---|---|---|
| 1–50 | 2026-04-27 → 05-01 | Foundation, phases 1–7, inventory, KDS, driver, loyalty, coupons |
| 54 | 2026-05-04 | Inventory audit, dashboard UI fixes, SEO, ESLint |
| 55–56 | 2026-05-04 | LCP deep-dive — 6 Lighthouse runs, root cause found |
| 57 | 2026-05-06 | Performance fixes, security hardening, realtime tracking, loyalty, driver GPS |
| 58 | 2026-05-06 | Loyalty redemption, ARCH-004, 14 security fixes, POS, KDS stations, menu editor |
| 59–63 | 2026-05-07 | Migration 067–073: loyalty trigger, menu availability, shift closing, KDS, POS |
| 64 | 2026-05-07 | Menu items enhanced (074) + RLS CRUD (075) |
| 65 | 2026-05-08 | Menu Management CRUD: full CRUD + RLS, station mapping, JSON sync fallback |
| 66 | 2026-05-08 | Null byte + EOF truncation cleanup (79 files) → TSC 0 errors |
| 67 | 2026-05-08 | Security: hash clock_pin, auth template, subtotal fix, Upstash hardening |
| 68 | 2026-05-08 | Merge duplicate i18n blocks; POS layout via CSS Module |
| 69 | 2026-05-08 | POS hydration fix; KDS trigger slug fix; KDS station mapping; GM branch selector |
| 70 | 2026-05-09 | KDS audit P0+P1 fixes; seed menu_items_sync (168 items) |
| 71 | 2026-05-09 | KDS station mapping root cause fixed; seed script; migration 080 |
| 72 | 2026-05-09 | Secure migrate-077 route, KDS realtime payload, i18n, GA4/Clarity |
| 73 | 2026-05-09 | Category Select box + auto slug + slugPrefix |
| 74 | 2026-05-09 | Stations single source, image_url XSS guard, GA4/Clarity confirmed |
| 75 | 2026-05-09 | KDS audit prompt + P0+P1 fixes |
| 76 | 2026-05-09 | 5 competitive gaps: image upload, offline POS, modifiers, ESC/POS, loyalty config |
| 77 | 2026-05-09 | Waiter App PWA (085) + QR Ordering + Promotion Engine (086/087) — 540 pages |
| 78 | 2026-05-09 | DB-first menu architecture, modifier FK fix (088), waiter UI audit fixes |
| 79 | 2026-05-09 | KDS hardening sprint: branch RLS, modifiers, table number, realtime filter, SLA timer (089) |
| 80 | 2026-05-10 | types.ts regen, additive pricing fix (VariantPicker), migration 088 applied, QA checklist |
| 81 | 2026-05-10 | PRICE_MISMATCH fix (091), waiter E2E PASS, POS hydration, waiter role (090) |
| 82 | 2026-05-10 | i18n audit, Badee hidden, orders/shifts/KDS/driver security hardening (092–095) |
| 87 | 2026-05-10 | Labor Cost Widget + Menu Engineering Matrix (097), migration registry cleanup |
| 88 | 2026-05-11 | Waitlist (099), SEC-08 fix, routes fix, i18n parity, QA gates, mobile UX, KDS (100–103) |
| 89 | 2026-05-12 | Sentry + Better Stack + /api/health + Loyalty UI + Security audit + Driver fixes + Menu improvements |
| 90–93 | 2026-05-13 | Schema Markup, Impeccable design, Logo fix, Service Mode POS, Reservations system, Owner Dashboard, Sidebar reorder, BL-003/BL-004, Test cleanup, Security audit, Build fixes, Header redesign |

---

## 12. Competitive Roadmap

| Priority | Feature | Status |
|---|---|---|
| 🔴 1 | Waiter App PWA | ✅ Shipped |
| 🔴 2 | QR Ordering | ✅ Shipped |
| 🔴 3 | Promotion Engine | ✅ Shipped |
| 🔴 4 | Labor Cost Tracking | ✅ Shipped |
| 🔴 5 | Menu Engineering Matrix | ✅ Shipped |
| 🔴 6 | Waitlist Management | ✅ Shipped |
| 🔴 7 | KDS Recall + Counter + Checkmarks | ✅ Shipped |
| 🔴 8 | Table Reservation (advance booking) | ✅ Shipped |
| 🔴 9 | Service Mode POS (tablet) | ✅ Shipped |
| 🔴 10 | Owner Unified Dashboard | ✅ Shipped |
| 🟠 11 | Inventory linked to sales (COGS) | Awaiting chef recipes |
| 🟠 12 | Delivery Aggregator (Talabat/Careem) | Phase 7B |
| 🟠 13 | Tap Payment integration | Awaiting merchant keys |
| 🟡 14 | Customer PWA (loyalty + order history) | /account exists, incomplete |
| 🟡 15 | AI Assistant (عربي) | Phase 8 |
| 🟡 16 | Demand Forecasting | Phase 8 |
| 🟢 17 | Franchise Management | Future |
| 🟢 18 | Gift Cards | Future |
| 🟢 19 | Self-ordering Kiosk | Future |

---

## 13. Immediate Next Steps

### Ahmed (Restaurant Owner)
1. ✅ DNS: kahramanat.com → Vercel (confirmed working)
2. Add Cloudflare Turnstile env vars in Vercel: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`
3. Send 13 staff emails → run staff seed (migration 090)
4. Send chef recipe data (Excel) for inventory import
5. Provide Tap payment merchant keys
6. Verify F-01: Open Chrome Incognito (no extensions) → DevTools Network → Hard reload → confirm GA/Clarity don't fire before cookie consent

### Agent (Next Session)
1. Verify Playwright CI green on `4547db6`
2. Monitor Vercel build for Sentry sourcemap warnings improvement
3. BL-004 remaining low-severity (system_settings audit done — safe, customers INSERT rate-limited)
4. Once Turnstile env vars added: test contact form bot protection
5. Once staff emails arrive: run migration 090 seeder
6. Once Tap keys arrive: implement Refund Modal
7. Once chef recipes arrive: test inventory deduction flow
