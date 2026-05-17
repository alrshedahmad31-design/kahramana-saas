# Kahramana Baghdad — Conversation Master Notes

**Generated:** 2026-05-13 (Session 93)
**Last refresh:** 2026-05-17 (covers through Session 135, master `ca61e41`)
**Language:** Arabic-first
**Purpose:** Consolidated Markdown record of this conversation: decisions, prompts, architecture notes, implementation guidance, risks, integrations, and next steps for the Kahramana Baghdad website/platform project.

> ملاحظة: هذا الملف ليس تفريغًا حرفيًا لكل كلمة في المحادثة، بل نسخة تنفيذية منظمة تجمع ما تم الاتفاق عليه وما تم توليده من برومبتات وقرارات تقنية وتشغيلية.

> **Authoritative live state:** `.agent/CURRENT-SESSION.md` (operator + dev priorities) and `.agent/LAST-SESSION.md` (most recent session detail) are the single source of truth between refreshes. Treat this file as a consolidated narrative, not a real-time log.

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

## 2a. Current State Snapshot (Session 129 — 2026-05-16)

### Headline
- **Phase:** `pre_launch_operational` — Launch Risk 8/10 — soft-launch (cash-only) is the next milestone.
- **Numbered roadmap:** Phases 0-7 + 6b all done. Phase 7b (Deliverect/POS) and Phase 8 (AI) locked on external dependencies.
- **Master commit:** `2f5c80d` (2026-05-16, session 129 close-out).
- **Migrations:** Local = Remote = **162 applied**, paired in `supabase migration list --linked`.
- **Production:** https://kahramanat.com — Vercel `sin1` region, Supabase production, Better Stack ✅ Up.
- **Build:** 562/562 pages, 0 tsc errors, 0 ESLint warnings on every commit in sessions 116-129.

### Sessions 94-129 — 2026-05-13 → 2026-05-16 (rollup)
Multi-session lane covering hardening, content fixes, and small UX iterations. Per-session detail lives in `.agent/LAST-SESSION.md` (sessions 127-129 in full, 126 in the rolling archive). Highlights:

- **Sonner toast adoption** (commit 5087b2b) replaced the older notification surface.
- **ConfirmModal primitive** (4dd4a19) — every `window.confirm` replaced; 6 callers wired.
- **Loyalty / checkout iteration** — birthday cron scaffolding, points-cap UX auto-cap (mirrors server 50% rule), `points_over_cap` localization wired through `localizeCheckoutError`.
- **Motion v12** migration; **reorder + history** added to `/account`.
- **البديع branch cleanup** (a2b2009) — 8 files; `BranchId` narrowed to `'riffa' | 'qallali'`; `HIDDEN_BRANCHES` kept as empty typed array to avoid 30-file refactor.
- **Founder card** — copy + BiDi fix (b537d60 / 7c6c332).
- **Catering form hardened** (migration 160 + 2 commits) — Turnstile, Upstash 3/IP/hr, Zod, server-side `catering_inquiries` table with service-role-only RLS.
- **Waiter QR member scanner scaffolded flag-OFF** (3957abe) + migration 162 (`customer_profiles.membership_id` STORED generated column + UNIQUE + waiter/cashier SELECT RLS). Will activate when staff accounts go live.
- **KDS ghost-count root-cause** — migration 161 trigger force-completes `order_item_station_status` rows when orders go to terminal status; defense-in-depth `orders!inner(status)` join on selector count query.
- **Driver UX wins** — repeating bell + browser Notification + pulsing card for unacknowledged ready orders (commit 2079f2c); `customerNavUrl` now prefers DB `delivery_lat/lng` over share-URL DMS strings (20fdf58).
- **Cart drawer** — "إضافة المزيد" no longer navigates to `/menu` when already browsing (22f7071).
- **Supabase client hardening** (efe68b1) — actionable error if `NEXT_PUBLIC_SUPABASE_*` missing (was: `Cannot read properties of undefined`).
- **VULN closures** in sessions 100-101 — VULN-104, VULN-RBAC-01/02/04/05, VULN-AUTH-01/02/04/06, VULN-CRY-01/03, VULN-INJ-01/02, VULN-SEC-01, VULN-1.07, KAH-2026-05-01→07. Migrations 134-138 land the schema half; full audit code lives in commit chain 853ccff → cbd34dc.
- **L1 recovery cookie HMAC** (81eb296) — `signRecoveryCookie` / `verifyRecoveryCookie` using `crypto.timingSafeEqual`. Requires `SESSION_BIND_SECRET` env var in Vercel.

### Working tree change (session 127)
- Old `kahramana-platform\kahramana-Saas\` tree lost its `.git` directory (probably an accidental unzip-over-tree). User created a fresh clone at `kahramana-platform\kahramana-Saas-fresh\`. **All future work happens in the `-fresh` tree.**
- `.env.local` had to be copied by hand (gitignored — doesn't ride along with `git clone`). Memory `project_working_directory_moved.md` documents the lesson.
- Migration `015_production_admin.sql` was also gitignored — copied over from old tree to satisfy Supabase CLI's `--include-all` check before pushing 162.

### Build Statistics (Session 129)
| Metric | Value |
|---|---:|
| Pages | 562 static |
| Build errors | 0 |
| TSC errors | 0 |
| ESLint warnings | 0 |
| Migrations applied | 020–162 (paired) |
| Master commit | `2f5c80d` |
| Deployment | https://kahramanat.com |
| Better Stack | ✅ Up |
| Sentry release tagging | ⚠️ 401 since `cef2850` — token regression |

### Operator Actions Pending (Ahmed)
- ⏳ **`SESSION_BIND_SECRET`** env var on Vercel prod + preview (`openssl rand -hex 32`). Without it, `/auth/callback` recovery flow throws at runtime.
- ⏳ **`SENTRY_AUTH_TOKEN`** re-rotation. Regressed from 2026-05-15. Symptom: Sentry CLI 401 on `releases new` + `sourcemaps upload`. Build succeeds; only release tagging + sourcemap upload fail → prod stack traces stay minified until fixed.
- ⏳ **Supabase Free → Pro + Singapore migration.**
- ⏳ **TAP keys** (merchant approval pending).
- ⏳ **`NEXT_PUBLIC_ENABLE_QR_LOYALTY_SCAN`** flip — waiting on staff (waiter/cashier) account activation. Pre-flip checklist in `.env.example`.
- ⏳ **Chef Excel recipes import** — recipes table empty (0/168 menu items mapped); pending since session 38. Alert flood suppressed via 24h dedup gate (migration 153) but inventory deduction is no-op for live orders.
- ⏳ **Birthday gift cron** + idempotency table + `loyalty_config.birthday_bonus_points`.
- ⏳ **`SetPasswordClient.tsx`** dead-code cleanup (orphaned since session 101).

### Recently Resolved (operator side)
- ✅ Supabase new signups disabled (2026-05-15)
- ✅ `order_item_station_status` added to Realtime publication (8→9 tables)
- ✅ Turnstile keys live in Vercel (2026-05-15)
- ✅ DNS kahramanat.com → Vercel
- ✅ `.env.local` copied into fresh tree (session 129)
- ✅ `CRON_SECRET` set in Vercel (Production + Preview) + redeploy triggered (session 133, 2026-05-17) — birthday cron now wired end-to-end

### Known Ceilings (do not attempt to "fix")
- Lighthouse ~49 on mobile = GSAP/Framer Motion floor — intentional brand decision.
- TBT ~1600ms on Slow 4G = animation cost.
- Recipes empty until chef Excel lands — suppressed but unaddressed.

---

## 2. Project Status Snapshot — Session 93 baseline (2026-05-13)

> The remainder of this section is the **frozen Session 93 snapshot** kept for historical reference. For current state see §2a above.

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
| 123 | rpc_record_opening_balance (atomic movement + stock upsert) | ✅ |
| 124 | rpc_create_purchase_order (atomic PO + items) | ✅ |
| 125 | security_rpc_grants | ✅ |
| 126 | rpc_update_staff | ✅ |
| 127 | grant_audit | ✅ |
| 128 | security_advisor_fixes | ✅ |
| 129 | function_search_paths (lock search_path on SECURITY DEFINER fns) | ✅ |
| 130 | customer_registration_trigger | ✅ |
| 131 | revoke_public_execute (carry from cowork branch placeholder) | ✅ |
| 132 | revoke_anon_kds_and_po_rpcs | ✅ |
| 133 | strip_tap_payload_to_gateway_response (PII reduction) | ✅ |
| 134 | rpc_create_order payment_method priority (VULN-104 — CASE inversion) | ✅ |
| 135 | drop legacy rpc_create_order 25-arg overload | ✅ |
| 136 | app_config table (VULN-SEC-01 Path B — runtime flags, staff-only RLS) | ✅ |
| 137 | harden bump/recall_station_order text overloads (VULN-RBAC-05) | ✅ |
| 138 | atomic audit events (rpc_refund_payment / rpc_close_shift / rpc_pos_finalize_order) | ✅ |
| 139 | verify_tap_amount | ✅ |
| 140 | refund_gateway_id | ✅ |
| 141 | restore_loyalty_on_reversal | ✅ |
| 142 | tap_amount_scale_guard | ✅ |
| 143 | move samoon-meat to pastries category | ✅ |
| 144 | seed egg sandwiches | ✅ |
| 145 | fix customer_registration phone conflict | ✅ |
| 147 | customer_profile default address | ✅ |
| 148 | staff basic grants hardening | ✅ |
| 149 | revoke anon execute on audit fns | ✅ |
| 150 | stuck_order_alerts | ✅ |
| 151 | grant SELECT/EXECUTE on analytics matviews + RPCs (AUD-V3-012 close) | ✅ |
| 152 | customer_profiles.birthday DATE column | ✅ |
| 153 | dedup_unmapped_item_alerts (24h gate on fn_inventory_reserve INSERT) | ✅ |
| 154 | orders.delivery_flat | ✅ |
| 155 | coupon_usages atomic inside rpc_create_order | ✅ |
| 156 | staff_photos private bucket | ✅ |
| 157 | unique active driver delivery | ✅ |
| 158 | birthday_points cron | ✅ |
| 159 | grant update on customer_profiles.birthday | ✅ |
| 160 | catering_inquiries table + service-role-only RLS | ✅ |
| 161 | sync_kds_on_order_terminal_status trigger (ghost-count fix) | ✅ |
| 162 | customer_profiles.membership_id STORED + UNIQUE + waiter/cashier RLS | ✅ |

> Migration 146 was skipped (gap, not a deletion). 015 lives only on disk (gitignored). 131 was originally a cowork-branch placeholder; the body was applied to remote by the parallel agent and the file later committed here.

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

### Session 100-101 Hardening Sweep (commit chain 853ccff → cbd34dc)
All closed and applied to remote DB:

- **VULN-104** — `rpc_create_order` CASE inversion so `payment_method='tap'` resolves to `pending_payment` even when `source='manual'`. Closes CHAIN-001 cash-skim where manual+tap orders skipped 30min `expires_at`. Migrations 134 + 135.
- **VULN-RBAC-01/02/04/05** — role allowlists + branch checks on KDS bump/recall, text-overload sibling closed (was unreachable kds_station overload that had been hardened — text overload was the live JS path). Migration 137.
- **VULN-AUTH-01/02/04/06** — auth hardening trio (commits c6c1b6a + cef-era follow-ups).
- **VULN-CRY-01** — race-window short-circuit: 400 with audit when payment reference present but gateway_id binding absent (commit bef64f1).
- **VULN-CRY-03** — closed in same chain.
- **VULN-INJ-01/02** — input handling hardening.
- **VULN-SEC-01 Path A** returned 42501 in CLI + Studio (Supabase managed strips superuser everywhere). **Path B** implemented via migration 136: `app_config` table with RLS-gated staff-only SELECT; only table owner + service_role write.
- **VULN-1.07** — health endpoint hardening (commit 9331158).
- **KAH-2026-05-12 null-branch bypass** — fixed on 3 service-role-reading dashboard pages (orders/[id], catering/[id], catering/packages/[id]) plus `shifts/actions.ts:91`.
- **KAH-2026-05-06 / AUD-V3-014** — atomic refund/closeShift/POS-finalize RPCs (migration 138). `closeShift` previously had no audit at all.
- **AUD-V3-008** — 20 analytics-error swallow sites swapped to `AnalyticsResult<T>` pattern (session 116).
- **AUD-V3-012** — analytics least-privilege closed (migration 151 + 6 query.ts callers swapped to `createClient()`). 16/16 analytics queries now follow least-privilege.
- **AUD-V3-016** — types regen done; all `as never` casts stripped (session 98).
- **L1 recovery cookie HMAC binding** (commit 81eb296) — closes the cross-user recovery-cookie hijack window. Requires `SESSION_BIND_SECRET` env var.

### Pending Verification
- F-01: Confirm GA/Clarity don't fire before cookie consent (test in Incognito).

### Known Accepted
- Sentry sourcemap warnings (~50 chunks) — Next.js internal chunks, no impact on site.
- F-08: Route structure in Sentry transaction — low risk, deferred.
- Sentry release tagging 401 since `cef2850` — token regression, fix is operator-side rotation.
- ~~AUD-V3-007, AUD-V3-011 (~15 `as any` cleanup sites)~~ — **CLOSED**: AUD-V3-011 in `f921e66` (all `as any` casts removed), AUD-V3-007 in `0f95f5a` (next-intl v3→v4 bump). `src/` confirmed clean (zero `as any` matches).
- KAH-2026-05-05 / -07 — deferred.

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
| `SENTRY_AUTH_TOKEN` | ⚠️ Regressed | 401 since `cef2850` — re-rotate at https://sentry.io/settings/account/api/auth-tokens/ (scopes: project:releases, org:read, project:read), then set in Vercel Production + Preview |
| `UPSTASH_REDIS_REST_URL` | ✅ Set | Rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ Set | Rate limiting |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | ✅ Set | Cloudflare Turnstile (live 2026-05-15) |
| `TURNSTILE_SECRET_KEY` | ✅ Set | Cloudflare Turnstile (live 2026-05-15) |
| `SESSION_BIND_SECRET` | ⏳ Pending | Required by `/auth/callback` HMAC binding (L1 commit 81eb296). Generate with `openssl rand -hex 32`, then set in Vercel Production + Preview |
| `NEXT_PUBLIC_ENABLE_QR_LOYALTY_SCAN` | ⏳ `false` (intentional) | Waiter QR member scanner — flip to `true` only after waiter/cashier staff accounts are activated. Pre-flip checklist in `.env.example` |
| `TAP_SECRET_KEY` | ⏳ Pending | Tap Payments (merchant approval) |
| `NEXT_PUBLIC_TAP_PUBLIC_KEY` | ⏳ Pending | Tap Payments (merchant approval) |
| `PAYMENT_WEBHOOK_SECRET` | ⏳ Pending | Tied to Tap merchant approval |
| `NEXT_PUBLIC_GA_ID` | ✅ Set | `G-521712793` |
| `NEXT_PUBLIC_CLARITY_ID` | ✅ Set | `vzlrozut31` |
| `RESEND_API_KEY` | ✅ Set | |
| `EMAIL_FROM` | ✅ Set | `noreply@kahramanat.com` |

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
| 94–126 | 2026-05-13 → 2026-05-16 | Multi-session lane (sonner toasts, reorder/history, motion v12, birthday cron, ConfirmModal primitive, loyalty i18n fix, البديع branch cleanup, founder card BiDi, catering form hardening with Turnstile+Upstash+DB, migration 160) — see per-session sections in `.agent/LAST-SESSION.md` archive |
| 127 | 2026-05-16 | KDS ghost-count root-cause (migration 161 + selector tightening), driver `customerNavUrl` DMS bug, working tree migrated to `kahramana-Saas-fresh\` after `.git` loss |
| 128 | 2026-05-16 | Waiter QR member scanner scaffold (flag OFF), migration 162 `customer_profiles.membership_id` STORED column + RLS, inventory alert duplicate-key fix, checkout `points_over_cap` localization |
| 129 | 2026-05-16 | Points redemption auto-cap UX (UI now mirrors server 50% cap), cart drawer "إضافة المزيد" stops navigating to /menu, driver dashboard repeating sound + browser Notification + pulsing card for unacknowledged ready orders, hardened `supabase/client.ts` env-var failure mode, `.env.local` copied into fresh tree |
| 130 | 2026-05-17 | P2-1 chef Excel recipes import (`/dashboard/inventory/recipes/import`, service-role insert + audit log), P2-2 mapped-recipes banner actionable (DISTINCT slug count, owner/GM/inventory_manager gate), B-001 Riffa closes 01:00→02:00 across all surfaces, P3-1 BirthdayGiftCard reads `loyalty_config.birthday_bonus_points` (migration 158 was already complete; UI wired via `getLoyaltyConfig` v1→v2 cache bump), P3-2 QR loyalty scan flag audit (off-path verified clean, activation comment added — flag stays OFF), BUG-001 Riffa opens 19:00→07:00 (operator source-of-truth BRANCH_CONTACTS.md had been correct all along; `isOpen()` logic verified sound). Operator cleared `SESSION_BIND_SECRET` + rotated `SENTRY_AUTH_TOKEN` + redeployed. Master `2f5c80d` → `e7ab0cb`. No migrations. |
| 131 | 2026-05-17 | P4-1 dead-code cleanup — `src/app/[locale]/forgot-password/ForgotPasswordClient.tsx` removed (144 LOC). `page.tsx` mounts `ForgotPasswordForm` from `@/components/auth/`; the `Client` sibling had zero references in `src/` / `app/`. The carry-forward note named `SetPasswordClient.tsx` as the orphan — Glob confirmed that file was already removed in an earlier pass. Verified via grep before delete to avoid silently removing the wrong file. Master `e7ab0cb` → `c4fe9a8`. No migrations. No i18n changes. `tsc --noEmit` clean. |
| 132 | 2026-05-17 | Five-commit launch-prep sweep. **P4-2 (9a93fe1)** — localize 7 raw-English checkout errors. Server emits lowercase codes (`min_redemption:<n>`, `insufficient_points`, `coupon_invalid`, `price_mismatch`, `auth_required`, `order_creation_failed`); `localizeCheckoutError` maps to `checkout.errors.*`. `fetchAndComputeCouponDiscount`'s 10 inner validation strings collapsed to single `coupon_invalid`. **F-01 (92c6fba)** — gate GA4 + Clarity preconnect tags behind cookie consent. `<Analytics>` already gated the script injection; the leak was two `<link rel="preconnect">` in layout `<head>` rendered server-side for every visitor, leaking DNS/TLS to `googletagmanager.com` + `clarity.ms` pre-consent. Fix moves both into `<Analytics>` next to the Script tags. **/dashboard/catering (1d67b4a)** — owner+GM-only inquiries listing page reading migration 160's `catering_inquiries` via `createServiceClient()`. Bilingual cards, NEW badge for <24h, WhatsApp CTA via `buildCustomerContactLink`. New `catering` section in rbac-ui.ts (distinct from existing `inventory_catering`). **Birthday notification scaffold (29ac5f2)** — `/api/cron/birthday-notify` route with `Authorization: Bearer <CRON_SECRET>` (503s when secret unset), 2h `created_at` lookback on `birthday_point_credits`. `vercel.json` crons entry at 06:00 UTC (1h after pg_cron's 05:00 UTC credit run). `.env.example` adds CRON_SECRET. **Birthday notification content (d24e5e3)** — `emails/templates/BirthdayBonus.tsx` bilingual AR+EN with two CTAs (Visit Account + Continue on WhatsApp). `sendBirthdayBonus` added to send.ts. Route loop fetches `customer_profiles`, builds AR+EN copy via `getTranslations({ locale })`, sends Resend email with embedded wa.me link (Riffa branch + bilingual greeting). Per-row Sentry catch. New top-level `email.birthday` i18n namespace. Master `c4fe9a8` → `d24e5e3`. No migrations. Parity 2,394 → 2,433. New operator action: `CRON_SECRET` env var on Vercel. |
| 133 | 2026-05-17 | Cleanup-only session — two commits, no migrations, no i18n, no env vars. **Docs fix (f6e403e)** — investigation of the "~15 remaining `as any` casts" carry-forward showed `src/` was already clean (zero matches). Git history confirmed both audit tickets shipped earlier (`f921e66` AUD-V3-011 all `as any` removed, `0f95f5a` AUD-V3-007 next-intl v3→v4 bump). Strike-through + commit hashes added to the three stale `LAST-SESSION.md` lines and the one stale master-notes line so the next agent doesn't chase the same ghost. **Refactor (57ac6a9)** — removed 30 dead `HIDDEN_BRANCHES.length > 0` guard branches across 15 files (analytics queries, dashboard stats, reports validator, owner/payments/delivery/kds/orders/reports pages, inventory page + widgets + catering + food-cost, OrdersClient, OrderStatsBar). Guards have been unreachable since `a2b2009` (session 126 البديع cleanup) when `HIDDEN_BRANCHES` was narrowed to `BranchId[] = []`. Net −123 / +18 LOC. The const itself stays in `contact.ts:18` plus `isHiddenBranch()` + `BRANCH_LIST.filter` — type-safe no-ops kept in case a branch is hidden again. `payments/page.tsx`'s `excludedOrderIds` accumulator removed entirely (declared, populated only inside dead branch, gated downstream). `OrdersClient.tsx` collapsed `{ BRANCHES, HIDDEN_BRANCHES }` → `{ BRANCHES }`; `owner/page.tsx` collapsed `{ HIDDEN_BRANCHES, isHiddenBranch }` → `{ isHiddenBranch }`. `tsc --noEmit` exit 0; `NEXT_BUILD_WORKERS=1 npm run build` clean (566/566 pages). Operator cleared `CRON_SECRET` (Vercel prod + preview) and triggered redeploy — birthday cron now wired end-to-end; Resend domain verification is the last piece before actual sends. Master `d24e5e3` → `57ac6a9`. |
| 134 | 2026-05-17 | Three commits, one migration (163), i18n 2,433 → 2,436. **ARCH-004 atomic checkout RPC (`be15f22` + `80f737e`)** — `rpc_create_order` now folds `delivery_flat` UPDATE and the initial `payments` row INSERT into the same transaction as order/items/loyalty/coupon. Three new opt-in params (`p_delivery_flat`, `p_payment_mode`, `p_payment_expires_at`) with NULL defaults so the four legacy callers (table, waiter, POS, POS service) keep their JS payment inserts unchanged — only `checkout/actions.ts` opts in. Legacy 28-arg overload DROPped; new 31-arg version is sole resident. Closes the long-standing orphan-order risk where the post-RPC JS payment insert could fail and idempotency-key retries would short-circuit on the early-return path. **Catering form findings #6 + #8 (`22ee548`)** — popup-block fallback ("Copy WhatsApp link" button on success card with `navigator.clipboard.writeText` + sonner toast); `noValidate` on the form so browser native validation balloons no longer leak non-localized text. Master `57ac6a9` → `22ee548`. |
| 135 | 2026-05-17 | Four commits, no schema migrations, i18n 2,436 → 2,445. Repo-hygiene + security carry-forwards. **Catering occasion/service enum normalization (`aa2bffa`)** — form `<option value>` now binds the enum key (`familyFeast`, `pickup`…) instead of the locale-rendered translation; Zod validates via `z.enum(CATERING_OCCASION_TYPES / SERVICE_TYPES)`; dashboard translates the stored key back via `dashboard.catering.{occasionTypes,serviceTypes}.x` with a typeguard fallback for legacy locale-string rows. wa.me message body still localized — form passes an enum→label map in `whatsappCopy`. Fixes the cross-locale dashboard filtering bug where the same occasion persisted as two distinct values. Single source of truth: `CATERING_OCCASION_TYPES` / `CATERING_SERVICE_TYPES` from `src/lib/whatsapp-catering-message.ts`. **Migration 015 unblocked from gitignore (`27e1a98`)** — credential replaced with a `current_setting('app.admin_password', true)` placeholder + length-checked RAISE so the file is now tracked without leaking the production password; the INSERT branch is unreachable in prod (admin already exists) and RAISEs on a fresh DB unless the operator sets the runtime password >=12 chars. **Waiter `Order creation failed` localized (`f9bb840`)** — `getTranslations('waiter.errors').orderCreationFailed` replaces the raw English literal / leaked Postgres sentinel codes; `rpcError` still logged for Sentry. **Migration 131 cowork backfill (`ca61e41`)** — replaced the 1-line placeholder (`-- applied via cowork branch (commit 26c059e)`) with the real DDL it was supposed to contain. DO block loops over `pg_proc` by name so signature drift since 131 is handled (rpc_create_order has 4+ versions) and functions created in later migrations (rpc_close_shift / rpc_pos_finalize_order / rpc_refund_payment in 138, rpc_restore_redeemed_loyalty_points in 141) are silently skipped on fresh apply. Verified live against `wwmzuofstyzworukfxkt`: 0/30 `public.rpc_*` have PUBLIC EXECUTE, executing the new DO block was a no-op. Master `22ee548` → `ca61e41`. |

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

## 13. Immediate Next Steps (refreshed Session 129)

### Ahmed (Restaurant Owner)
1. ✅ DNS: kahramanat.com → Vercel (confirmed)
2. ✅ Cloudflare Turnstile env vars in Vercel (live 2026-05-15)
3. ✅ Supabase new signups disabled (2026-05-15)
4. ✅ `order_item_station_status` added to Realtime publication
5. **Set `SESSION_BIND_SECRET`** in Vercel Production + Preview — `openssl rand -hex 32`. Without this, `/auth/callback` recovery throws at runtime.
6. **Re-rotate `SENTRY_AUTH_TOKEN`** — current token returns 401 on release tagging + sourcemap upload since `cef2850`. Build itself succeeds; only observability is degraded.
7. Upgrade Supabase Free → Pro + migrate to Singapore region.
8. Send 13 staff emails → run staff seed (migration 090).
9. **Send chef recipe Excel** for inventory import. Recipes table is empty (0/168 mapped); alert flood now suppressed (migration 153) but inventory deduction is no-op for live orders until this lands. Pending since session 38.
10. Provide Tap payment merchant keys (`TAP_SECRET_KEY`, `NEXT_PUBLIC_TAP_PUBLIC_KEY`, `PAYMENT_WEBHOOK_SECRET`).
11. After staff (waiter/cashier) accounts activate: flip `NEXT_PUBLIC_ENABLE_QR_LOYALTY_SCAN=true` per pre-flip checklist in `.env.example` + end-to-end QR scan re-test on a real device camera.
12. Verify F-01: Open Chrome Incognito (no extensions) → DevTools Network → Hard reload → confirm GA/Clarity don't fire before cookie consent.

### Agent (Next Session — candidate lanes, none are launch blockers)
1. **Birthday gift cron** — cron job + idempotency table + `loyalty_config.birthday_bonus_points` + WhatsApp/email notification surface. Schema groundwork landed sessions 125 + 128 + 158.
2. **Inventory page banner** — "0/168 recipes mapped — chef Excel import pending" so operator can see why deductions are no-op.
3. **Extend `localizeCheckoutError`** to the remaining raw-English server errors in `src/app/[locale]/checkout/actions.ts` (Minimum redemption, Insufficient points balance, Coupon invalid, PRICE_MISMATCH, AUTH_REQUIRED, Customer session required, Order creation failed). Same pattern as session 128 `points_over_cap` work.
4. **`SetPasswordClient.tsx` dead-code cleanup** — orphaned since session 101 (page mounts `SetPasswordForm`; `SetPasswordClient` is unused).
5. ~~**`HIDDEN_BRANCHES` cleanup follow-up**~~ — **DONE session 133 (`57ac6a9`)**. 30 dead `.length > 0` guards across 15 files removed; const + helpers retained.
6. **Catering audit findings #6 (no email fallback) + #8 (HTML5 validation balloon doesn't follow next-intl locale)** — deferred from session 126.
7. **Catering `occasion_type` / `service_type` normalization** — currently stored as the user's locale-rendered string; normalize to enum keys if dashboard filtering is needed.
8. **`/dashboard/catering`** route — migration 160 + server action are in; no UI yet. Reads only via Supabase Studio for now.
9. Once Tap keys arrive: implement Refund Modal — `refundPayment` action currently flips DB state only; does NOT call Tap to push money back to customer's card.
10. Once chef recipes arrive: test inventory deduction flow end-to-end.
