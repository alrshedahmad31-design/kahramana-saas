# Kahramana Baghdad — Conversation Master Notes

**Generated:** 2026-05-10 (Session 84)
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
- Waiter App PWA لخدمة الطاولات.
- QR Ordering للزبائن من الطاولة.
- Promotion Engine للعروض والخصومات.
- Payments, Analytics, AI (future phases).

الفروع المعتمدة:

| الفرع | الحالة |
|---|---|
| الرفاع | Active |
| قلالي | Active |
| البديع | Hidden (platform-wide, code-level filter) |

---

## 2. Latest Project Status (Session 82 — 2026-05-10)

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
- ✅ **Security Hardening** — 14 Critical fixes (7 customer + 7 dashboard) + clock_pin hashing
- ✅ **Manual POS** — full system with item notes, branch scope, hydration-safe CSS Module
- ✅ **KDS Multi-Station** — 5 canonical stations (grill/fryer/cold/drinks/desserts) with Realtime + full audit fixes
- ✅ **Menu Management** — full CRUD with AR/EN editor + DB-first architecture
- ✅ **Out of Stock Toggle** — real-time, customer menu filtered
- ✅ **Audit Log Viewer** — owner/GM only, section guard added
- ✅ **End of Shift Closing** — with discrepancy detection + GM branch selector + Zod validation
- ✅ **Mobile Bottom Nav** — floating capsule, customer pages only
- ✅ **Competitive Gaps Closed** — image upload, offline POS queue, menu modifiers, ESC/POS receipt, configurable loyalty
- ✅ **Waiter App PWA** — table-aware ordering, dine_in type, POS-style layout
- ✅ **QR Ordering** — `/table/[branchId]/[tableNumber]`, guest flow, QR PNG generation
- ✅ **Promotion Engine** — 5 types, wired into all 4 order paths
- ✅ **Menu Categories** — Select box + auto slug generation + slugPrefix per category
- ✅ **Stations Single Source** — `STATION_CONFIG` in `constants/kds.ts` only
- ✅ **image_url XSS guard** — https-only validation client + server
- ✅ **GA4 + Clarity** — env-driven, confirmed in production
- ✅ **Production Deployment** — https://kahramanat.com
- ✅ **Badee branch hidden** — `HIDDEN_BRANCHES` constant + `isHiddenBranch()` helper, platform-wide
- ✅ **Waiter role added** — `waiter` enum value in `staff_role`, RBAC updated
- ✅ **i18n/font audit** — Arabic/English separation enforced, font tokens standardized
- ✅ **Dashboard security hardening** — orders, shifts, KDS, driver, promotions, audit page
- ✅ **KDS taxonomy** — canonical 5 stations, unassigned fallback, conflict-aware RPC
- ✅ **Driver hardening** — driver-only mutations, delivery-only filter, GPS validation
- ✅ **POS/Waiter hydration** — lazy `useState(() => resolveMenuItemPrice(item))`, 0 CLS
- ✅ **E2E Playwright** — waiter dine-in spec passing, globalSetup/teardown wired

### Build Statistics (Session 82)

| Metric | Value |
|---|---:|
| Pages | 540 static |
| Build errors | 0 |
| TSC errors | 0 |
| ESLint warnings | ~12 (unused vars, non-blocking) |
| Migrations applied | 088–095 |
| Deployment | https://kahramanat.com |
| Last commit | `0266b62` — fix(driver+kds): driver-only mutations, delivery filters, KDS taxonomy+hardening |

### Pending / In Progress

- ⏳ **Staff accounts seeding** — migration 090 ready, `scripts/seed-staff.ts` ready, waiting on 13 emails from restaurant owner
- ⏳ **Tap payment** — waiting on merchant account (Ahmed)
- ⏳ **WhatsApp Business API** — blocked on Meta verification
- ⏳ **Benefit Pay** — blocked on CBB approval (2–4 months)
- ⏸️ **Phase 7b — Deliverect/POS** — blocked on contract
- 🔒 **Phase 8 — AI Features** — requires 6 months real data

### Pre-Launch Checklist Status

| Item | Status |
|---|---|
| QA checklist doc (150 items) | ✅ Created `docs/qa/pre-launch-checklist.md` |
| Waiter E2E QA (steps 6–8) | ✅ PASS (migration 091 verified) |
| Staff accounts (13) | ⏳ Awaiting emails |
| Legal pages | ⏳ Pending |
| Missing images (~11) | ⏳ Content |
| PDF staff guides | ⏳ Handover |
| Delete `kds_queue` legacy table | 🟢 Low priority |

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
| 084 | structured checkout address (Bahrain) | ✅ |
| 085 | rpc_create_order table_number + waiter/qr | ✅ |
| 086 | rpc_create_order promotion_id | ✅ |
| 087 | promotion engine | ✅ |
| 088 | menu_option_groups FK fix | ✅ |
| 089 | KDS RLS hardening + branch_id denorm + UNIQUE(item_id) | ✅ |
| 090 | waiter role enum (staff_role) | ⏳ On disk — apply immediately before running seed-staff.ts |
| 091 | rpc_create_order PRICE_MISMATCH bypass for size/variant | ✅ |
| 092 | shift_closing RLS branch scope | ✅ |
| 093 | KDS station taxonomy enum values | ✅ |
| 094 | KDS hardening + taxonomy trigger rewrite | ✅ |
| 095 | orders UPDATE RLS tighten (remove cashier/kitchen) | ✅ |

---

## 4. Sessions 79–82 — Major Deliverables

### Session 79 — KDS Hardening Sprint
- Migration 089: branch RLS, UNIQUE(item_id), branch_id denorm, SLA timer baseline
- KDS UI: modifier pills, table number, source badges, Arabic status labels, SLA timer, design token cleanup

### Session 80 — Cleanup + QA Bootstrap
- types.ts regenerated clean (post-migration-089)
- CoWork dirty tree committed: additive size+variant pricing in VariantPicker + resolveMenuItemPrice
- Migration 088 applied + registered in schema_migrations
- QA checklist created: 150 items, 9 sections, `docs/qa/pre-launch-checklist.md`

### Session 81 — PRICE_MISMATCH + Waiter RBAC + POS Hydration
- Migration 091: `rpc_create_order` bypass for `selected_size`/`selected_variant` — production verified
- Waiter E2E retest: steps 6–8 PASS
- POS + Waiter hydration fix: lazy `useState(() => resolveMenuItemPrice(item))` — 0 CLS
- Waiter role: `waiter` added to `staff_role` enum + RBAC + `scripts/seed-staff.ts` ready
- Payment warning banner surfaced in POS + Waiter success screen

### Session 82 — Security Hardening + i18n + KDS Taxonomy + Driver
- **i18n/font audit**: prep items, par levels, delivery dashboard, sidebar — all AR/EN clean
- **Badee branch hidden**: `isHiddenBranch()` helper, 12 `as any` casts replaced
- **Google reviews updated**: 4.5→4.6, 1531→1685
- **Orders security**: section guard, transition validation, concurrency, payment awareness, search escape
- **Shifts hardening**: Zod schema, branch scope, RLS WITH CHECK (migration 092)
- **KDS taxonomy**: canonical 5 stations (grill/fryer/cold/drinks/desserts), unassigned fallback, conflict-aware RPC, role whitelist (migrations 093+094)
- **Driver hardening**: driver-only mutations, `order_type='delivery'` everywhere, GPS validation, cash amount validation (migration 095)
- **Promotions**: branch ownership check in togglePromotion/deletePromotion
- **Audit page**: `requireDashboardSection('audit')` guard
- **POS offline queue**: only queue on network failure, not auth/permission errors
- Build: ✅ 540 pages, 0 TSC errors

---

## 5. Architecture Decisions

### 5.1 Atomic Checkout RPC
- `rpc_create_order` — single PostgreSQL function, `SECURITY DEFINER`
- Handles: idempotency → coupon lock → loyalty deduction → order INSERT → items loop → points_transaction
- Extended across 6 migrations (062, 066, 083, 085, 086, 091)
- Migration 091: PRICE_MISMATCH check skips items with `selected_size` or `selected_variant`

### 5.2 KDS Station Architecture
- **Canonical stations**: `grill`, `fryer`, `cold`, `drinks`, `desserts`, `unassigned`
- **Single source of truth**: `src/constants/kds.ts → STATION_CONFIG`
- **DB**: trigger `on_order_item_created` routes by slug pattern → station
- **Unknown slugs**: fall to `unassigned` (not `main`) — fail closed
- **UNIQUE(item_id)**: one item → one station only
- **`branch_id` denormalized** on `order_item_station_status` for realtime filtering
- **Conflict-aware RPC**: `p_expected_status` + transition validation + row count check

### 5.3 Branch Isolation
- `HIDDEN_BRANCHES = ['badee']` constant in `src/constants/contact.ts`
- `isHiddenBranch(id)` helper — used in 20+ files
- DB data untouched — code-level only

### 5.4 RBAC Model
| Role | Rank | Key Access |
|---|---|---|
| owner | 10 | Everything |
| general_manager | 9 | Everything except owner actions |
| branch_manager | 7 | Branch-scoped |
| cashier | 5 | Orders, POS, shifts |
| kitchen | 4 | KDS only |
| waiter | 3 | Waiter app, dine-in orders |
| inventory_manager | 4 | Full inventory |
| inventory | 2 | Limited inventory |
| driver | 3 | Driver PWA only |
| marketing | 3 | Promotions, coupons |
| support | 2 | Limited |

### 5.5 Driver Security Model
- Driver mutations (`driverBumpOrder`, `markDriverArrived`, `reportDeliveryFailure`): `driver` role only
- `postDriverLocation`: verifies `assigned_driver_id = user.id`, `status = 'out_for_delivery'`, branch match
- All driver/delivery queries: `.eq('order_type', 'delivery')` enforced
- Cash amounts: `Number.isFinite` + `>= 0` + round to 3 decimal places

---

## 6. Security Hardening Log

### Customer Journey (Migration 064)
| Fix | Description |
|---|---|
| C-1 | Phone spoofing for loyalty — RPC uses `auth.uid()` |
| C-2 | Customer UPDATE on points_balance locked |
| C-3 | Registration moved to `rpc_create_customer_profile` SECURITY DEFINER |
| C-4 | 50% cap on points redemption enforced in RPC |
| C-5 | RPC REVOKE anon, status forced from payment method |
| C-6 | Driver location IDOR → `rpc_get_driver_location` |
| C-7 | Rate limiting on login (Upstash Redis, 5/15min/IP) |

### Dashboard (Migration 065 + Sessions 67–82)
| Fix | Description |
|---|---|
| D-C1 | marketing coupon cap: 30% / 5 BHD |
| D-C2 | coupon_usages INSERT → SECURITY DEFINER RPC only |
| D-C3 | Driver NULL branch_id guard |
| D-C4 | reassignDriver: role/branch/active validation |
| D-C5 | Waste report self-approval blocked |
| D-C6 | confirmCashHandover: owner/GM only |
| D-C7 | KDS select('*') → explicit safe columns |
| Session 82 | Orders: requireDashboardSection + branch scope + transition validation + concurrency |
| Session 82 | Shifts: Zod schema + branch assertion + RLS WITH CHECK (092) |
| Session 82 | Promotions: branch ownership check in toggle/delete |
| Session 82 | Audit page: requireDashboardSection('audit') guard |
| Session 82 | KDS RLS: role whitelist (kitchen/manager/GM/owner only) |
| Session 82 | Driver: driver-only mutations, GPS ownership validation |
| Session 82 | Orders RLS: cashier/kitchen removed from direct UPDATE (095) |

---

## 7. Staff Seeding — Pending

Migration 090 + `scripts/seed-staff.ts` ready. Waiting for 13 emails.

Run order (once emails received):
1. Apply migration 090 via SQL Editor
2. `npx supabase gen types typescript --linked --schema public > src/lib/supabase/types.ts`
3. `npx tsc --noEmit`
4. Plug emails into `scripts/seed-staff.ts:54-79`
5. `npm run seed:staff:dry` → review
6. `npm run seed:staff` → invites sent

| # | Role | Branch |
|---|---|---|
| 1 | branch_manager | riffa |
| 2 | branch_manager | qallali |
| 3 | cashier | riffa |
| 4 | cashier | qallali |
| 5 | kitchen | riffa |
| 6 | kitchen | qallali |
| 7 | driver | riffa |
| 8 | driver | qallali |
| 9 | waiter | riffa |
| 10 | waiter | qallali |
| 11 | inventory_manager | riffa |
| 12 | inventory_manager | qallali |
| 13 | marketing | — |

---

## 8. Key Engineering Rules

1. Apply migrations one at a time via SQL Editor — never `db push --include-all` on production
2. Always `npm run build` before `git push origin master`
3. Always use `git add <specific paths>` not `git add .` to avoid CoWork file contamination
4. Keep Phase 8 (AI) locked until real production data exists (6+ months)
5. **Never touch image, layout, animation, or CSS when goal is SEO/metadata only** — CLS risk
6. Always strip `<claude-code-hint>` after `supabase gen types`
7. Restart dev server (`Ctrl+C` + `npm run dev`) to fix Turbopack HMR hydration mismatches
8. `staff_basic.id` (not `user_id`) for RLS references
9. Promotion `use_count` has no decrement — refunds don't restore quota
10. `HIDDEN_BRANCHES` is code-level only — never delete DB data for Badee
11. POS/Waiter price initialization: `useState(() => resolveMenuItemPrice(item))` — lazy initializer, no mounted guards
12. Deployment order for enum migrations: ADD VALUE migration first (alone), then dependent migration
13. PostgREST direct UPDATE from cashier/kitchen now blocked by RLS (migration 095) — all mutations go through RPCs or server actions

---

## 9. Dashboard Sections Reference

| Route | Roles | Description |
|---|---|---|
| `/dashboard` | all staff | Overview + quick actions |
| `/dashboard/orders` | cashier+ | Orders list + kanban |
| `/dashboard/orders/[id]` | cashier+ | Order detail (section guard enforced) |
| `/dashboard/kds` | kitchen+ | Kitchen Display System (5 stations) |
| `/dashboard/pos` | cashier+ | Manual POS |
| `/dashboard/delivery` | branch_manager+ | Delivery dispatch board |
| `/dashboard/waiter` | waiter, cashier+ | Waiter app |
| `/dashboard/tables` | cashier+ | Table management + QR |
| `/dashboard/staff` | GM, owner | Staff management |
| `/dashboard/loyalty` | cashier+ | Loyalty program |
| `/dashboard/promotions` | marketing+ | Promotion Engine (5 types) |
| `/dashboard/inventory/*` | inventory_manager+ | Full inventory system |
| `/dashboard/coupons` | marketing+ | Coupon management |
| `/dashboard/analytics/*` | GM, owner | Analytics (5 sub-pages) |
| `/dashboard/reports` | GM, owner | Financial reports |
| `/dashboard/payments` | manager, owner | Payments + cash handovers |
| `/dashboard/shifts` | cashier+ | End of shift closing |
| `/dashboard/audit` | GM, owner | Audit log (section guard enforced) |
| `/dashboard/schedule` | manager | Staff scheduling |
| `/dashboard/settings` | GM, owner | Branch settings + Loyalty config |

---

## 10. Customer & Staff Pages Reference

| Route | Description |
|---|---|
| `/[locale]` | Homepage |
| `/[locale]/menu` | Menu listing (DB-backed availability) |
| `/[locale]/menu/[slug]` | Category page |
| `/[locale]/menu/item/[slug]` | Item detail |
| `/[locale]/branches` | Branch listing |
| `/[locale]/branches/[branchId]` | Branch detail |
| `/[locale]/checkout` | Checkout with loyalty + promotion redemption |
| `/[locale]/order/[id]` | Order tracking (Realtime) |
| `/[locale]/payment/[orderId]` | Tap payment page |
| `/[locale]/account` | Loyalty points + history |
| `/[locale]/account/login` | Login |
| `/[locale]/account/register` | Register |
| `/[locale]/catering` | Catering page |
| `/[locale]/table/[branchId]/[tableNumber]` | QR Ordering (guest, no auth) |
| `/[locale]/waiter` | Waiter App — table grid |
| `/[locale]/waiter/table/[tableNumber]` | Waiter App — order builder |
| `/[locale]/waiter/orders` | Waiter App — active orders |
| `/[locale]/driver` | Driver PWA |

---

## 11. Production Smoke Test Checklist

- `/ar` and `/en` work
- `/ar/menu` and `/en/menu` work — out-of-stock items hidden
- Checkout works — COD orders appear as 'new' in dashboard
- Manual POS order appears in KDS immediately as 'accepted'
- POS layout renders without hydration error — prices show immediately (0 CLS)
- Realtime order tracking updates without refresh
- Loyalty points awarded on order `delivered` or `completed`
- Driver location visible to manager + customer when `out_for_delivery`
- Dashboard login works (PIN hashed in DB)
- KDS stations work: grill/fryer/cold/drinks/desserts — no cross-station leakage
- Waiter App: table grid → order builder → send → KDS receives as dine_in
- QR: scan → menu → order → KDS receives as dine_in
- Promotions: create bogo → place order → `promotion_discount_bhd` populated
- `/dashboard/tables` QR download works
- Cash handover confirm restricted to owner/GM
- End of shift closing works (GMs see branch selector)
- Audit log visible to owner/GM only
- Badee branch not visible anywhere in platform
- No horizontal scroll on mobile
- Mobile bottom nav visible on customer pages, hidden on dashboard/waiter/table
- Waiter orders with size+variant: price = size + variant (additive)
- Driver can only claim `order_type='delivery'` orders

---

## 12. Session History Summary

| Session | Date | Focus |
|---|---|---|
| 1–50 | 2026-04-27 → 05-01 | Foundation, phases 1–7, inventory, KDS, driver, loyalty, coupons |
| 54 | 2026-05-04 | Inventory audit, dashboard UI fixes, SEO, ESLint |
| 55–56 | 2026-05-04 | LCP deep-dive — 6 Lighthouse runs, root cause found |
| 57 | 2026-05-06 | Performance fixes, security hardening, realtime tracking, loyalty, driver GPS |
| 58 | 2026-05-06 | Loyalty redemption, ARCH-004, 14 security fixes, POS, KDS stations, menu editor |
| 59–63 | 2026-05-07 | Migration 067 loyalty trigger, menu availability (070), shift closing (071), KDS multi-station (072), POS RPC fix (073) |
| 64 | 2026-05-07 | Menu items enhanced (074) + RLS CRUD (075) |
| 65 | 2026-05-08 | Menu Management CRUD: full CRUD + RLS, station mapping, JSON sync fallback |
| 66 | 2026-05-08 | Null byte + EOF truncation cleanup (79 files) → TSC 0 errors |
| 67 | 2026-05-08 | Security: hash clock_pin (069), auth template route, subtotal fix, Upstash hardening |
| 68 | 2026-05-08 | Merge duplicate i18n blocks; POS layout via CSS Module |
| 69 | 2026-05-08 | POS hydration fix; KDS trigger slug fix (077); KDS station mapping (078); GM branch selector |
| 70 | 2026-05-09 | KDS audit → all P0+P1 fixes; seed menu_items_sync (168 items); station routing verified |
| 71 | 2026-05-09 | KDS station mapping root cause fixed; seed script; migration 080; build 533 pages |
| 72 | 2026-05-09 | Secure migrate-077 route, KDS realtime payload update, i18n labels, PII guard, GA4/Clarity |
| 73 | 2026-05-09 | Category Select box + auto slug + slugPrefix per category |
| 74 | 2026-05-09 | Stations single source, image_url XSS guard, Vercel env GA4/Clarity confirmed |
| 75 | 2026-05-09 | KDS audit prompt + all P0+P1 fixes applied |
| 76 | 2026-05-09 | 5 competitive gaps: image upload, offline POS, modifiers, ESC/POS receipt, loyalty config |
| 77 | 2026-05-09 | Waiter App PWA (085) + QR Ordering + Promotion Engine (086/087) — 540 pages |
| 78 | 2026-05-09 | DB-first menu architecture, modifier FK fix (088), waiter UI audit fixes |
| 79 | 2026-05-09 | KDS hardening sprint shipped (commit 215d9f1) — 10 files, +671/-110 |
| 80 | 2026-05-10 | KDS hardening sprint: branch RLS, modifiers, table number, realtime filter, SLA timer (migration 089) |
| 81 | 2026-05-10 | PRICE_MISMATCH fix (091), waiter E2E PASS, POS hydration, waiter role (090), payment warning UI |
| 82 | 2026-05-10 | types.ts regen, additive pricing fix (VariantPicker), migration 088 applied, QA checklist (150 items) |
| 83 | 2026-05-10 | PRICE_MISMATCH fix (091) verified, waiter E2E PASS, payment warning UI |
| 84 | 2026-05-10 | i18n audit, Badee hidden, reviews updated, orders/shifts/KDS/driver security hardening (092–095) |

---

## 13. Competitive Roadmap

| Priority | Feature | Status |
|---|---|---|
| 🔴 1 | Waiter App PWA | ✅ Shipped |
| 🔴 2 | QR Ordering | ✅ Shipped |
| 🔴 3 | Promotion Engine | ✅ Shipped |
| 🟡 4 | Self-ordering Kiosk | Pending |
| 🟡 5 | AI Assistant (عربي) | Pending |
| 🟡 6 | Customer Display Screen | Pending |
| 🟡 7 | Dark Kitchen Module | Pending |
| 🟢 8 | Delivery Channel Manager | Pending |
| 🟢 9 | Mall GTO Reporting | Pending |
| 🟢 10 | Franchise/App Marketplace | Future |

---

## 14. SaaS Competitive Analysis

| Feature | Kahramana | Toast | Square | Foodics | Sapaad |
|---|---|---|---|---|---|
| Arabic RTL native | ✅ | ❌ | ❌ | ✅ | ✅ |
| Bahrain payments | ✅ | ❌ | ❌ | ✅ | ✅ |
| Driver PWA built-in | ✅ | ❌ ($add-on) | ❌ | ❌ | ✅ |
| KDS multi-station | ✅ | ✅ ($add-on) | ⚠️ | ✅ | ✅ |
| Inventory depth | ✅ | ✅ ($add-on) | ❌ | ✅ | ✅ |
| Waiter App | ✅ | ✅ | ❌ | ✅ | ✅ |
| QR ordering | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| Promotion Engine | ✅ | ✅ ($add-on) | ⚠️ | ✅ | ✅ |
| Monthly cost | ~$45-90 | $200-2000+ | $60-165+ | $100-300+ | $80-200+ |
| Offline POS | ⚠️ (queue) | ✅ | ✅ | ✅ | ✅ |
| Available in Bahrain | ✅ | ❌ | ❌ | ✅ | ✅ |

---

## 15. Immediate Next Steps (Session 82)

1. **13 emails** from restaurant owner → run staff seed
2. **QA live run** — use real role-based logins once staff seeded
3. **Legal pages** — Privacy, Terms, Cancellation
4. **Missing images** (~11 items)
5. **Tap payment** — unblock once merchant account ready
