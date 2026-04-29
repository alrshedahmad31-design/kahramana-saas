# KAHRAMANA BAGHDAD — MASTER EXECUTION PLAN
> Single source of truth. All agents (Antigravity / Claude Code / Codex) read this file.
> Version: 2.1 | Updated: 2026-04-27 | Project: kahramanat.com full rebuild

## CHANGELOG

| Version | Date | Changes |
|---|---|---|
| 2.0 | 2026-04-27 | Sprint Breakdown, Staff Auth MVP, full Order Status enum, self-hosted fonts, SOW, CR Policy, QA/Launch Checklists, Payment Milestones, Training Plan |
| 2.1 | 2026-04-27 | Fixed `payment_failed` enum contradiction. Added Phase 1 Payment Mode. Added `order_status_events` table. Added `assigned_driver_id` to orders. Added `.agent/RULES.md` reference. Added Assumptions Needing Client Confirmation. Fixed audit log wording (تقليل فرص التلاعب). Revalidated Phase 0 files on disk (all 5 present OK). |
| 2.2 | 2026-04-28 | Phase 1 + Phase 2 marked done. i18n: 373 keys (ar+en in full parity) covering home/story/kds/branches/seo/errors/contact. Supabase anon key configured. Owner auth account seeded. Fixed 6 truncated source files + 2 corrupted JSON files post-agent-session. |

---

---

## PROJECT IDENTITY

| Field | Value |
|---|---|
| Client | كهرمانة بغداد — Kahramana Baghdad Restaurant |
| Live URL | https://kahramanat.com |
| Branches | Riffa (الرفاع) + Qallali (قلالي) + Al-Badi' (البديع — Planned) |
| Agency | Wujood Digital Agency — Ahmed Algburi |
| Goal | Full rebuild from static site → multi-branch ordering & operations platform |
| Duration | 14–20 months (full platform) |
| Start cost | ~$45/mo (Vercel + Supabase) → ~$90–120/mo at production scale |

---

## TECH STACK

| Layer | Technology |
|---|---|
| Framework | Next.js 15 App Router |
| Language | TypeScript (strict mode — no `any`, no `as unknown`) |
| Styling | Tailwind CSS v4 + CSS Logical Properties ONLY (`ps/pe/ms/me` — NEVER `pl/pr/ml/mr`) |
| Database | Supabase (PostgreSQL + RLS + Auth) |
| CMS | Sanity CMS (menu, images, pricing) |
| Hosting | Vercel Pro |
| CDN/Security | Cloudflare (Free → Pro) |
| Background Jobs | Railway + BullMQ |
| Cache/Queue | Upstash Redis |
| i18n | next-intl (AR primary, EN secondary) |
| Animations | GSAP 3 (hero parallax, menu reveals, cart drawer) + Framer Motion (page transitions) |
| Analytics | GA4 + Microsoft Clarity |
| Monitoring | Sentry |
| Email | Resend (transactional — password reset, order confirmations, reports) |

---

## REFERENCE FILES

> Every agent MUST read these files at session start before touching any code.

| File | Purpose |
|---|---|
| `.agent/PLAN.md` | This file — master execution plan |
| `.agent/phase-state.json` | Live phase status — source of truth for what is done / in progress / locked |
| `.agent/RULES.md` | Phase Gate 10 checks, coding rules, RTL rules, mobile-first rules, DB migration rules |
| `AGENTS.md` | Cross-tool shared rules (RTL, TypeScript, Supabase, fonts, phone numbers, menu pricing) |
| `CLAUDE.md` | Claude Code specific rules + session start template + phase completion commands |

---

## DESIGN SYSTEM

- **Theme**: "Midnight Mesopotamian Luxe"
- **Colors**: Black `#0A0A0A` (brand.black) + Gold `#C8922A` (brand.gold) — defined ONLY in `lib/design-tokens.ts`
- **Direction**: RTL Arabic primary (`dir="rtl" lang="ar"`), LTR English fallback
- **Mobile-first** — 375px (iPhone SE) is the primary design target

### Fonts (self-hosted ONLY)

| Role | Font | Weight | Source |
|---|---|---|---|
| Arabic headings | Cairo | 800 | `public/fonts/Cairo-ExtraBold.woff2` |
| Arabic body | Almarai | 400, 700 | `public/fonts/Almarai-*.woff2` |
| English headings | Editorial New | 300, 700 | `public/fonts/EditorialNew-*.woff2` |
| English body + numbers | Satoshi | 400, 500 | `public/fonts/Satoshi-*.woff2` |

**Rules**:
- ALL fonts MUST be self-hosted in `/public/fonts/` — zero Google Fonts CDN calls in production
- `Inter` is **FORBIDDEN** — it is not the brand identity
- Fonts load via `next/font/local` — never via `<link>` tag
- `lib/design-tokens.ts` defines `fontFamily` tokens; components import tokens, not raw strings
- Violation grep: `grep -rn "Inter\|Poppins\|Nunito\|Montserrat\|Raleway\|Roboto" app/ components/ --include="*.tsx"`

**Design Tokens rule**: Raw hex values are FORBIDDEN in components. All colors go through `lib/design-tokens.ts`.

```typescript
// OK Correct
import { colors } from '@/lib/design-tokens'
className={`text-[${colors.brand.gold}]`}   // via CSS variable preferred

// NO Never
className="text-[#C8922A]"
style={{ color: '#0A0A0A' }}
```

---

## ORDER STATUS — UNIFIED ENUM (defined Phase 1, used all phases)

The `orders.status` column in Supabase uses this enum **from Phase 1**. The UI in Phase 1 shows a subset of states. Do NOT redefine this enum in Phase 2.

```sql
CREATE TYPE order_status AS ENUM (
  'new',              -- Phase 1: order created, awaiting staff review
  'under_review',     -- Phase 1: staff opened the order
  'accepted',         -- Phase 1: staff confirmed
  'preparing',        -- Phase 2: kitchen started
  'ready',            -- Phase 2: ready for pickup/delivery
  'out_for_delivery', -- Phase 2+: assigned to driver
  'delivered',        -- Phase 2+: driver confirmed delivery
  'completed',        -- Phase 2+: final state, triggers loyalty points
  'cancelled',        -- Any phase: requires cancellation reason
  'payment_failed'    -- Defined Phase 1, only used in Phase 6 when payment integration goes live
);
```

**Phase 1 UI** shows: `new → under_review → accepted → cancelled`
**Phase 2 UI** adds: `preparing → ready → out_for_delivery → delivered → completed`
**Phase 6 activates**: `payment_failed` — value already in enum from Phase 1; no schema change needed in Phase 6

---

## PHASE REGISTRY

> State is tracked in `phase-state.json`. A phase CANNOT be marked `done` without real deliverables on disk and all 10 Phase Gate checks passing.

---

### PHASE 0 — Discovery & Operational Audit
**Duration**: 1–2 weeks | **Status**: `done` OK | **Completed**: 2026-04-27

**Deliverables** (all verified on disk):
- [x] `docs/audit/site-audit.md`
- [x] `docs/audit/seo-migration-plan.md`
- [x] `docs/audit/data-map.md`
- [x] `docs/audit/whatsapp-flow.md`
- [x] `docs/audit/blockers.md`

**Summary**: 16 menu categories confirmed. 183/194 dish photos present (~11 missing). WhatsApp numbers verified. 95/107 menu images had broken relative paths. Logo SVG added. Manifest fixed.

---

### PHASE 1 — Redesign & Smart Dashboard
**Duration**: 6–8 weeks | **Status**: `done` ✅ | **Prerequisite**: Phase 0 = done OK
**Started**: 2026-04-27 | **Completed**: 2026-04-28

**Goal**: New site live. Orders move from random WhatsApp → structured Dashboard.

---

#### Phase 1 — App Router Structure (next-intl)

The project uses `next-intl` with locale-based routing. All locale-dependent routes live under `src/app/[locale]/`. Route groups nest inside `[locale]`.

```
src/app/
  [locale]/
    (marketing)/       ← homepage, menu, about, contact
    (ordering)/        ← cart, checkout, order confirmation
    (dashboard)/       ← staff admin panel, RBAC UI
    (tracking)/        ← public order tracking
    (auth)/            ← staff login
    layout.tsx         ← locale-aware root layout
    not-found.tsx
    error.tsx
    loading.tsx
  sitemap.ts           ← at app root, NOT in [locale]
  robots.ts            ← at app root, NOT in [locale]
```

AR default (no prefix): `kahramanat.com/menu`
EN prefixed: `kahramanat.com/en/menu`

---

#### Phase 1 — Sprint Breakdown

> Agents MUST follow sprint order. Do NOT start Sprint 1B before 1A is verified complete.

**Sprint 1A — Foundation (Week 1)** OK Mostly complete
- `src/lib/design-tokens.ts` OK — colors, fonts, status colors, spacing tokens
- `next.config.ts` OK — CSP, HSTS, X-Frame-Options, 301 redirects, AVIF/WebP
- `src/middleware.ts` OK — locale detection + dashboard auth guard + security headers
- `src/app/[locale]/layout.tsx` OK — locale-aware root layout
- `messages/ar.json` + `messages/en.json` OK — all namespaces
- `src/constants/contact.ts` OK — branch phones, wa.me links, maps URLs
- `src/i18n/routing.ts` + `request.ts` + `navigation.ts` OK — next-intl config
- `src/lib/cart.ts` OK — cart logic
- `src/lib/whatsapp.ts` OK — wa.me message builder
- `src/components/layout/Header.tsx` + `Footer.tsx` OK
- `public/fonts/` — self-hosted Cairo, Almarai, Editorial New, Satoshi Pending
- `src/lib/menu.ts` — normalization layer for 4 pricing structures Pending (DO NOT read menu.json directly in components)

**Sprint 1B — Menu + SEO (Week 2)**
- `sanity/` — schema for menu items, categories, branches, gallery
- `app/(marketing)/page.tsx` — homepage with hero, featured items, branch cards
- `app/(marketing)/menu/page.tsx` + `[category]/page.tsx` — menu listing (ISR + Sanity revalidation)
- `components/menu/` — MenuGrid, ItemCard, CategoryFilter (horizontal scroll + snap), MenuSearch (client-side, AR+EN)
- `app/sitemap.ts` — auto-generated sitemap for all menu pages
- `app/robots.ts` — robots.txt
- `app/not-found.tsx`, `app/error.tsx`, `app/loading.tsx`
- OG images per category (`app/(marketing)/menu/opengraph-image.tsx`)

**Sprint 1C — Cart + Checkout + Order (Week 3)**
- `components/cart/` — Cart bottom sheet (mobile full-screen), cart item, quantity control
- `components/checkout/` — Checkout form (name, phone optional, branch selector, notes)
- `app/(ordering)/checkout/page.tsx` — Checkout page
- `app/(ordering)/order/[id]/page.tsx` — Order confirmation page
- `app/(tracking)/[orderId]/page.tsx` — Public tracking page (status only, no GPS — Phase 4 adds GPS)
- WhatsApp message build function (`lib/whatsapp-message.ts`) — generates order summary for wa.me link

**Sprint 1D — Supabase + Dashboard MVP (Week 4)**
- `lib/supabase/migrations/20260427_initial_schema.sql` — all tables (see schema below)
- `lib/supabase/` — typed client, server client, middleware client
- `app/(dashboard)/page.tsx` — Orders list with live status badges
- `app/(dashboard)/orders/[id]/page.tsx` — Order detail + status update
- `components/dashboard/` — OrderCard, StatusBadge, BranchSelector
- Rate limiting: Upstash Ratelimit on `/api/orders` (10 req/min per IP, sliding window)

**Sprint 1E — Staff Auth + RBAC + RLS (Week 5)**
- `lib/rbac/` — 9-role schema, permission matrix, RLS policy generator
- Supabase Auth configured: Magic Link + optional Google OAuth for staff
- RLS policies applied to all tables (see schema section)
- 2FA enforced for Owner + General Manager (Supabase MFA)
- `app/(dashboard)/settings/roles/` — Role management UI
- `app/(dashboard)/settings/staff/` — Staff account creation (Owner only)
- Audit log: every status change, login, and role assignment logged to `audit_logs` table

**Sprint 1F — QA + Soft Launch (Week 6–8)**
- Cross-browser testing: iPhone Safari, Android Chrome, Desktop (AR + EN)
- Lighthouse: Performance ≥ 85, Accessibility ≥ 90 (mobile)
- All 10 Phase Gate checks must pass (see `.agent/RULES.md`)
- Staff training: 2–3 hour session per role
- Soft launch: Week 1 internal → Week 2 parallel with old WhatsApp → Week 3 full cutover
- Old site kept at subdomain for 30 days as rollback

---

#### Phase 1 — Deliverables (full list)

**Foundation**
- [x] `src/lib/design-tokens.ts` OK — colors, fonts, status badge colors, tag colors
- [x] `next.config.ts` OK — CSP, HSTS, X-Frame-Options, Referrer-Policy, 301 redirects, AVIF/WebP
- [x] `src/middleware.ts` OK — locale detection + dashboard auth guard + security headers
- [x] `src/constants/contact.ts` OK — branch phones + wa.me + maps (single source of truth)
- [x] `src/lib/cart.ts` OK — cart state logic
- [x] `src/lib/whatsapp.ts` OK — wa.me message builder
- [x] `src/i18n/routing.ts` + `request.ts` + `navigation.ts` OK — next-intl config
- [x] `messages/ar.json` + `messages/en.json` OK — all UI namespaces
- [x] `src/components/layout/Header.tsx` + `Footer.tsx` OK
- [ ] `src/lib/menu.ts` — normalization layer (4 pricing structures) Pending
- [ ] `public/fonts/` — self-hosted Cairo, Almarai, Editorial New, Satoshi Pending

**App Structure** (all routes under `src/app/[locale]/` — see routing note above)
- [x] `src/app/[locale]/layout.tsx` OK — locale-aware root layout
- [ ] `src/app/sitemap.ts` — dynamic sitemap (at app root, not in [locale])
- [ ] `src/app/robots.ts` — (at app root)
- [ ] `src/app/[locale]/not-found.tsx`, `error.tsx`, `loading.tsx`
- [ ] `src/app/[locale]/(marketing)/` — Homepage, About, Contact
- [x] `src/app/[locale]/(marketing)/menu/page.tsx` OK — Menu page (stub, needs ISR)
- [ ] `src/app/[locale]/(ordering)/` — Cart, Checkout, Confirmation
- [ ] `src/app/[locale]/(tracking)/[orderId]/page.tsx` — Order tracking (status only)
- [ ] `src/app/[locale]/(dashboard)/` — Admin panel
- [ ] `src/app/[locale]/(dashboard)/settings/roles/` — Role management UI
- [ ] `src/app/[locale]/(dashboard)/settings/staff/` — Staff accounts UI
- [ ] `src/app/[locale]/(auth)/login/page.tsx` — Staff login

**Components**
- [ ] `components/menu/` — MenuGrid, ItemCard, CategoryFilter, MenuSearch
- [ ] `components/cart/` — CartSheet (bottom sheet mobile), CartItem, CartSummary
- [ ] `components/checkout/` — CheckoutForm, BranchSelector
- [ ] `components/dashboard/` — OrderCard, StatusBadge, BranchSelector

**Data + Backend**
- [ ] `lib/supabase/migrations/20260427_initial_schema.sql`
- [ ] `lib/supabase/` — typed clients (server, client, middleware)
- [ ] `lib/rbac/` — roles schema + permission matrix
- [ ] `lib/whatsapp-message.ts` — wa.me order summary builder
- [ ] `sanity/` — schema for menu, categories, branches

**Legal + Docs**
- [ ] `docs/legal/privacy-policy.md` — AR + EN
- [ ] `docs/legal/terms-of-service.md` — AR + EN
- [ ] `docs/legal/cancellation-policy.md` — AR + EN

**End of Phase**
- [ ] `.agent/ARCHITECTURE.md` — written AFTER scaffold, documents actual folder structure and data flow

---

#### Phase 1 — Staff Auth MVP

> Replace the old contradictory note "Dashboard is internal (no public auth in Phase 1, basic Supabase RLS)" with this:

**Phase 1 includes a full Staff Auth MVP**:
- Supabase Auth for all staff login (Magic Link + optional Google OAuth)
- RBAC database structure (9 roles defined in `staff_roles` + `staff_members` tables)
- RLS policies enforced on all tables from Day 1
- 2FA (Supabase MFA) required for Owner and General Manager roles
- Basic Role Management UI (Owner can assign/revoke roles)
- Staff Account Creation UI (Owner only — no self-registration)
- Audit Log: every action logged (status changes, logins, role assignments, price views)

**Customers remain Guest Only in Phase 1** — no customer registration, no customer login. `customer_phone` is optional. Phase 5 adds customer accounts with retroactive linking by phone.

---

#### Phase 1 — Payment Mode

> Phase 1 has NO automated payment gateway. All payment is manual. This is by design.

- **Cash on delivery** — customer pays the driver upon delivery
- **Pay at branch** — customer pays at counter for pickup orders
- **Static Benefit QR** (optional) — if restaurant provides a printed QR code, it can be displayed on the order confirmation page as a static image. Payment confirmation remains manual.
- **Payment confirmation is manual** — Cashier / Orders Staff marks the order as paid in the dashboard
- **No automated payment webhook until Phase 6**
- **No card payment, no online payment in Phase 1** — unless explicitly requested and approved as a Change Request

> If the restaurant requests online card payment before Phase 6 (Benefit Pay merchant approval), it must be raised as a Change Request. It will be scoped, priced, and scheduled separately — it does NOT fit inside Phase 1 scope.

---

#### Phase 1 — Supabase Schema

```sql
-- ============================================================
-- Migration: 20260427_initial_schema.sql
-- ============================================================

-- BRANCHES
CREATE TABLE branches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar     TEXT NOT NULL,
  name_en     TEXT NOT NULL,
  phone       TEXT NOT NULL,  -- always fetched from here at runtime
  maps_url    TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'planned', 'closed')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
-- Seed:
-- INSERT INTO branches (name_ar, name_en, phone, status) VALUES
--   ('الرفاع', 'Riffa', '+97317131413', 'active'),
--   ('قلالي', 'Qallali', '+97317131213', 'active'),
--   ('البديع', 'Al-Badi''', '', 'planned');

-- ORDERS (order_status enum defined separately — see ORDER STATUS section)
CREATE TABLE orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id        UUID NOT NULL REFERENCES branches(id),
  customer_name    TEXT NULL,           -- optional in Phase 1
  customer_phone   TEXT NULL,           -- optional; used for Phase 5 account linking
  notes            TEXT,
  status           order_status NOT NULL DEFAULT 'new',
  subtotal_bhd        NUMERIC(10,3) NOT NULL,
  wa_message_sent     BOOLEAN DEFAULT false,
  assigned_driver_id  UUID NULL REFERENCES staff_members(id),  -- NULL until Phase 4; present from Phase 1 to avoid migration
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_orders_customer_phone ON orders(customer_phone) WHERE customer_phone IS NOT NULL;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- ORDER ITEMS (price snapshot — NEVER recalculate from Sanity for historical orders)
CREATE TABLE order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sanity_item_id  TEXT NOT NULL,
  name_ar         TEXT NOT NULL,
  name_en         TEXT NOT NULL,
  size            TEXT,               -- 'S', 'L', 'Glass', etc.
  variant         TEXT,               -- 'مع مرق', 'بدون مرق', etc.
  qty             INTEGER NOT NULL DEFAULT 1,
  unit_price_bhd  NUMERIC(10,3) NOT NULL,  -- SNAPSHOT at order time — immutable
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- STAFF ROLES
CREATE TABLE staff_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,  -- 'owner', 'general_manager', 'branch_manager', etc.
  permissions JSONB NOT NULL DEFAULT '{}'
);
ALTER TABLE staff_roles ENABLE ROW LEVEL SECURITY;

-- STAFF MEMBERS
CREATE TABLE staff_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id   UUID REFERENCES branches(id),  -- NULL = all branches (Owner, GM)
  role_id     UUID NOT NULL REFERENCES staff_roles(id),
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;

-- AUDIT LOGS (general staff actions — logins, role changes, price views, etc.)
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id),
  action      TEXT NOT NULL,          -- 'order_status_changed', 'role_assigned', 'login', etc.
  entity_type TEXT,                   -- 'orders', 'staff_members', etc.
  entity_id   UUID,
  old_value   JSONB,
  new_value   JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ORDER STATUS EVENTS (dedicated order lifecycle tracking — separate from audit_logs)
-- Purpose:
--   - Record every order status transition with exact timestamp
--   - Store cancellation reason
--   - Measure time per phase (e.g. under_review → accepted duration)
--   - Used in Phase 2 KDS timers and Phase 2 analytics (avg prep time per branch)
--   - Do NOT rely on audit_logs alone for order flow analysis
CREATE TABLE order_status_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status  order_status,           -- NULL for first event (new order)
  to_status    order_status NOT NULL,
  reason       TEXT,                   -- required when to_status = 'cancelled'; optional otherwise
  changed_by   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_order_status_events_order ON order_status_events(order_id);
ALTER TABLE order_status_events ENABLE ROW LEVEL SECURITY;
```

---

#### Phase 1 — WhatsApp Message Format

```
Receipt: طلب جديد #{{orderId_short}}
━━━━━━━━━━━━━━━━━━━━━━━━
Customer: الاسم: {{customer_name || 'زائر'}}
Phone: الهاتف: {{customer_phone || '—'}}
Branch: الفرع: {{branch_name_ar}}

Order: الطلب:
{{#each items}}
• {{qty}}× {{name_ar}}{{#if size}} ({{size}}){{/if}}{{#if variant}} — {{variant}}{{/if}} — {{unit_price_bhd}} د.ب
{{/each}}
━━━━━━━━━━━━━━━━━━━━━━━━
Total: الإجمالي: {{subtotal_bhd}} د.ب
Notes: ملاحظات: {{notes || '—'}}
Link: تتبع الطلب: https://kahramanat.com/tracking/{{orderId}}
```

---

#### Phase 1 — Acceptance Criteria

- Site loads < 3s LCP on mobile 4G
- Menu renders all items (Sanity CMS → ISR)
- Client-side search works in AR and EN across all 179+ items
- Order creates a record in Supabase `orders` table with price snapshot
- WhatsApp link opens with correct formatted message to correct branch
- Admin dashboard shows orders, can update status
- Bilingual toggle works (AR ↔ EN), hreflang tags on all pages
- Owner sees all branches — Branch Manager sees own branch only (enforced via RLS)
- Kitchen role: sees order items, no prices visible
- Driver role: sees assigned orders only
- All 2FA rules enforced (Owner, General Manager)
- CSP headers in response (verify with browser DevTools → Network → Response Headers)
- **Mobile-first** (from RULES.md — all are mandatory):
  - Lighthouse mobile Performance ≥ 85, Accessibility ≥ 90
  - Zero horizontal scroll at 375px on any page
  - All buttons/links/cards ≥ 44×44px touch target
  - All `<input>` / `<textarea>` / `<select>` → `font-size: 16px` minimum
  - Cart renders as full-screen bottom sheet on mobile (< 1024px)
  - Menu category filter: horizontal scroll with CSS scroll-snap + touch momentum

---

### PHASE 2 — KDS & Live Orders
**Duration**: 6–8 weeks | **Status**: `done` ✅ | **Prerequisite**: Phase 1 = done
**Started**: 2026-04-28 | **Completed**: 2026-04-28

**Goal**: Kitchen knows what to cook. Time is measured. No order gets lost.

> **Note**: The `orders.status` enum is already fully defined in Phase 1. Phase 2 only activates the UI for additional states. No schema changes needed for status.

**Deliverables**:
- [ ] `app/(dashboard)/kds/` — Kitchen Display System screen
- [ ] `app/(dashboard)/orders/[id]/` — Order detail + full status timeline
- [ ] `app/(dashboard)/analytics/` — Daily/weekly/monthly revenue, orders per branch, avg prep time
- [ ] `app/(dashboard)/audit/` — Audit log viewer (تقليل فرص التلاعب وكشف مؤشرات الاستخدام غير المبرر — shows all staff actions with timestamp, user, IP)
- [ ] `lib/realtime/` — Supabase Realtime subscriptions for live order updates
- [ ] `lib/workers/daily-report.ts` — End-of-day summary email (via Railway + BullMQ + Resend)
- [ ] `components/kds/` — Order cards with timers, status badges

**Order Status Flow (Phase 2 activates full UI)**:
```
new → under_review → accepted → preparing → ready → out_for_delivery → delivered → completed
                                                                                   ↘ cancelled
```

**Acceptance Criteria**:
- KDS updates in real-time (no page refresh)
- Timer starts when order moves to `accepted`
- SLA alert fires if order in `preparing` > configurable threshold
- Every status change logged in `audit_logs` (who, when, what)
- `cancelled` requires a reason (logged for pattern analysis)
- Branch comparison: revenue, order count, avg prep time per branch
- End-of-day report sent automatically to Owner + GM email
- Audit log viewer shows: user, action, entity, timestamp, IP address
- Staff training: 2–3 hour onboarding per role before go-live

---

### PHASE 3 — Inventory & Waste / COGS
**Duration**: 3–5 months | **Status**: `locked` | **Prerequisite**: Phase 2 = done + chef recipes ready

**Goal**: Know what is consumed, wasted, and what food costs per dish.

**Critical Blocker**: Chef recipes with exact quantities for ALL ~194 dishes MUST be provided before development begins.

**Deliverables**:
- [ ] `app/(dashboard)/inventory/` — Stock management UI
- [ ] `app/(dashboard)/recipes/` — Recipe management (link ingredients → dishes)
- [ ] `app/(dashboard)/waste/` — Waste logging, variance reports
- [ ] `lib/inventory/` — Auto-deduct on order completion, inter-branch transfers
- [ ] `lib/cogs/` — Cost of Goods Sold calculation per dish / per order

**Acceptance Criteria**:
- Completing an order auto-deducts ingredients from stock
- Low-stock alert fires when ingredient below threshold
- COGS report shows profit margin per dish
- Inter-branch stock transfer logged in audit_logs

---

### PHASE 4 — Driver PWA & Delivery Tracking
**Duration**: 4–6 weeks | **Status**: `locked` | **Prerequisite**: Phase 2 = done

**Goal**: Driver knows their orders. Customer gets a live tracking link.

> **Note**: `app/(tracking)/[orderId]/page.tsx` is built in Phase 1 (status only). Phase 4 upgrades it with live GPS.

**Deliverables**:
- [ ] `app/(driver)/` — Driver PWA (separate route, minimal UI, offline-capable)
- [ ] Upgrade `app/(tracking)/[orderId]/page.tsx` — add live GPS map
- [ ] `lib/delivery/` — Assign driver, GPS update endpoint, delivery confirmation
- [ ] Maps integration — Google Maps or Mapbox

**Known iOS Limitation**: iOS PWA cannot track GPS in background. Android Chrome only. iOS drivers use manual status update. This is by design.

**Acceptance Criteria**:
- Driver sees assigned orders, can update status
- Customer tracking link shows live driver location (Android) or last-known status (iOS)
- Delivery time logged and shown in analytics

---

### PHASE 5 — Loyalty & Coupons
**Duration**: 4–6 weeks | **Status**: `locked` | **Prerequisite**: Phase 1 + Phase 2 = done

**Goal**: Reward repeat customers. Reduce dependence on third-party platforms.

**Deliverables**:
- [ ] `app/(customer)/account/` — Customer profile, points balance, order history
- [ ] `app/(dashboard)/loyalty/` — Loyalty program management
- [ ] `app/(dashboard)/coupons/` — Coupon creation and analytics
- [ ] `lib/loyalty/` — Points engine, tier logic, redemption rules
- [ ] `docs/legal/loyalty-terms.md` — Required before launch

**Loyalty Tiers**:

| Tier | Orders | OR Spending |
|---|---|---|
| Bronze | 0–9 | — |
| Silver | 10–29 | OR 50+ BD |
| Gold | 30–59 | OR 150+ BD |
| Platinum | 60+ | OR 300+ BD |

**Points Rules**: 5 pts/BD spent. 1 pt = 5 fils. Max 20% redemption per order. Points valid 12 months. Cancelled orders earn zero. Paying with points earns no new points.

**Acceptance Criteria**:
- Guest orders from Phase 1 linkable to new account by phone number
- Points accumulate on every `completed` order
- Tier upgrades trigger notification
- Redemption enforces 20% cap

---

### PHASE 6 — Payment & WhatsApp API
**Duration**: Depends on approvals (2–4 months for Benefit Pay) | **Status**: `locked`
**Prerequisite**: Phase 1 live + payment merchant approved

**Goal**: Real online payment. Automated WhatsApp notifications.

> **Schema note**: `payment_failed` is already in the `order_status` enum since Phase 1. No schema migration needed — only the application logic that handles this status needs to be activated.

**Deliverables**:
- [ ] `lib/payments/` — Benefit Pay / Tap / CrediMax integration + webhooks
- [ ] `lib/whatsapp/` — Wati.io API (replaces wa.me links)
- [ ] `app/(dashboard)/payments/` — Payment status, refunds UI

**Critical**: Start Benefit Pay + Meta Business Verification paperwork at Phase 1 launch. These approvals take 2–4 months and CANNOT be accelerated by code.

> **Phase 6 note for contact.ts**: When WhatsApp API goes live, phone numbers migrate from `src/constants/contact.ts` to environment variables + Supabase `branches` table for runtime updates without redeploy.

**Acceptance Criteria**:
- Payment webhook updates order status automatically
- Failed payment → `payment_failed` status, customer notified
- WhatsApp notification sent at key status changes
- Refund flow end-to-end

---

### PHASE 7 — Deliverect & POS Integration
**Duration**: Depends on contracts | **Status**: `locked`
**Prerequisite**: Phase 2 = done + Deliverect contract signed

**Deliverables**:
- [ ] `lib/deliverect/` — Webhook handler, order normalization (Talabat, Keeta → Kahramana format)
- [ ] `lib/pos/` — POS sync adapter (depends on restaurant's POS system)

**Blockers**: Deliverect contract not signed. Bahrain availability unconfirmed. POS API docs not provided.

---

### PHASE 8 — AI & Advanced Analytics
**Duration**: Future | **Status**: `locked`
**Prerequisite**: Phase 3 = done + 6+ months of real data

**Goal**: Predictive inventory, AI ordering assistant, advanced BI.

**Deliverables**:
- [ ] `app/(dashboard)/analytics/ai/` — AI-powered insights panel
- [ ] `lib/ai/` — Order prediction, waste forecasting, promotional recommendations

**Activation condition**: Minimum 6 months of real production data. Do NOT scaffold until Phase 3 is stable.

---

## SUPABASE SCHEMA — PRICE SNAPSHOT RULE

```typescript
// OK Correct — price captured at order creation time
order_items.unit_price_bhd = menuItem.resolvedPrice  // from src/lib/menu.ts at request time

// NO Never — joining back to Sanity to get price after order creation
order_items.sanity_item_id = id  // and fetching price on render
```

**Why**: Sanity prices can change at any time. A price change MUST NOT retroactively alter existing orders or receipts. The snapshot is the legal and financial record.

**Enforcement**: Never query Sanity for prices when displaying historical orders. Always use `order_items.unit_price_bhd`.

---

## EXTERNAL DEPENDENCIES TRACKER

| Dependency | Required For | Status | Notes |
|---|---|---|---|
| Restaurant logo (SVG) | Phase 1 | OK Done | WebP exists + SVG added |
| Dish photos (194 items) | Phase 1 | Warning: Partial | 183/194 — ~11 missing |
| Menu data (179+ items) | Phase 1 | OK Done | 4 pricing structures, 16 categories |
| ~15 missing menu items | Phase 1 | Warning: Pending | Can launch with 179 |
| Chef recipes (exact qty) | Phase 3 | NO Pending | Critical blocker for Phase 3 |
| Staff data + roles | Phase 1 | NO Pending | For RBAC setup |
| Cancellation & refund policy | Phase 1 | NO Pending | Legal — required before go-live |
| Google Business Profile access | Phase 1 | NO Pending | For schema.org + SEO |
| Internal project contact | Phase 1 | NO Pending | One person from restaurant |
| Branch WhatsApp numbers | Phase 1 | OK Confirmed | Riffa +97317131413 / Qallali +97317131213 |
| Benefit Pay merchant application | Phase 6 | NO Not started | Start at Phase 1 launch |
| Meta Business Verification | Phase 6 | NO Not started | |
| Deliverect contract | Phase 7 | NO Not started | Check Bahrain availability |
| POS API documentation | Phase 7 | NO Not started | |

---

## SERVICES ACTIVATION TIMELINE

| Service | Phase | Monthly Cost |
|---|---|---|
| Cloudflare Free | Phase 0 | $0 |
| Google Analytics 4 | Phase 0 | $0 |
| Google Search Console | Phase 0 | $0 |
| Microsoft Clarity | Phase 0 | $0 |
| UptimeRobot | Phase 1 | $0 (free tier) |
| Vercel Pro | Phase 1 | $20 + Build usage |
| Supabase Pro | Phase 1 | $25 base + compute |
| Sanity CMS | Phase 1 | Free → $15/user |
| Sentry | Phase 1 | Free → $26 |
| Resend | Phase 1 | Free → usage-based |
| Google Workspace | Phase 1 | ~$18 (3 users) |
| Upstash Redis | Phase 2 | Free → usage |
| Railway (Workers) | Phase 2 | $20 (production) |
| Google Maps / Mapbox | Phase 4 | Usage-based (~$100+/mo at scale) |
| WhatsApp API (Wati.io) | Phase 6 | TBD |
| Benefit / Tap / CrediMax | Phase 6 | % per transaction |
| Deliverect | Phase 7 | Contract |

> **Vercel Build Cost Warning**: Turbo Build Machines consume minutes at 2–4×. Set Preview branch to Standard in Vercel project settings to avoid unexpected charges.

---

## SOFT LAUNCH PLAN (Phase 1)

| Week | Action |
|---|---|
| Week 0 | Internal testing — staff only. No public access. Fix critical bugs. |
| Week 1 | Parallel operation — new site live + old WhatsApp orders still accepted. Staff use both. |
| Week 2 | Soft cutover — new orders go through site. Old WhatsApp monitored but not actively promoted. |
| Week 3+ | Full cutover — old WhatsApp number updated with "اطلب الآن من الموقع" message. |

**Rollback**: Old site kept on `legacy.kahramanat.com` for 30 days. DNS can revert in < 5 minutes.

---

## DATABASE MIGRATION STRATEGY

```
lib/supabase/migrations/
  YYYYMMDD_short_description.sql   ← one file per change
```

Rules:
1. One change per file — never combine unrelated changes
2. Always reversible — include `-- ROLLBACK:` comment with inverse SQL
3. New columns must have DEFAULT or be nullable — never break existing rows
4. Never change a column type directly — add new column → migrate data → drop old column
5. Test on staging (Supabase branch) before applying to production
6. Verify after apply — run row count SELECT before deploying app

---

## SOW — CONTRACTUAL SCOPE

> This section defines what is and is not included in the Phase 0 + Phase 1 contract.

### In Scope (Phase 0 + Phase 1)

- Full site rebuild: homepage, menu, about, contact (AR + EN)
- Online ordering via WhatsApp link (wa.me fallback — no payment gateway)
- Orders dashboard: create, list, update status, filter by branch
- Staff authentication: login, RBAC (9 roles), RLS policies, 2FA for Owner/GM
- Role management UI (Owner assigns/revokes roles)
- Audit log: every staff action recorded
- Order tracking page (status only, no GPS)
- Supabase database: orders, items, branches, staff, audit logs
- Sanity CMS: menu items, categories, branches
- Bilingual support: Arabic (RTL primary) + English toggle
- SEO: sitemap, robots.txt, Schema.org, hreflang, 301 redirects
- Security headers: CSP, X-Frame-Options, Referrer-Policy
- PWA: manifest + service worker (app shell + fonts + menu images)
- Rate limiting on order API
- Legal pages: Privacy Policy, Terms of Service, Cancellation Policy
- Performance: LCP < 3s mobile, Lighthouse Performance ≥ 85
- Soft launch support: 2–3 weeks parallel operation + rollback plan

### Out of Scope (requires separate contract / Change Request)

- Online payment integration (Phase 6 — pending bank approval)
- WhatsApp Business API (Phase 6 — pending Meta verification)
- Kitchen Display System / real-time KDS (Phase 2)
- Driver app + live GPS tracking (Phase 4)
- Customer loyalty program + coupon system (Phase 5)
- Inventory management + COGS (Phase 3)
- Deliverect / third-party delivery aggregators (Phase 7)
- AI features or advanced analytics (Phase 8)
- Custom mobile app (iOS/Android native)
- Multi-language beyond Arabic + English
- Any feature not listed under Phase 0 or Phase 1 deliverables above

### Future Roadmap (Phases 2–8)

Each phase is a separate contract with its own scope, timeline, and cost. Phases 2–8 are planned but not committed until signed separately.

---

## CHANGE REQUEST POLICY

Any request that falls outside the deliverables listed in the active phase's SOW is a **Change Request (CR)**.

Process:
1. Client submits CR (verbally or in writing)
2. Agency provides: scope description, estimated hours, cost, timeline impact — within 3 business days
3. Client approves CR in writing (email or signed document)
4. Work begins only after written approval
5. No CR is assumed approved based on conversation alone

**Rule**: Development STOPS on the current phase if a CR conflicts with active sprint work. The CR is scoped and scheduled for the next sprint or separate phase.

Typical CR examples:
- "Add a loyalty system" → Phase 5 scope (separate contract)
- "Integrate Talabat orders" → Phase 7 scope (separate contract)
- "Change the checkout flow mid-sprint" → CR — requires scope + approval before touching code

---

## ASSUMPTIONS NEEDING CLIENT CONFIRMATION

> Items below are assumptions made during planning. Each must be confirmed in writing by the restaurant before the related phase begins. Unconfirmed assumptions are a project risk.

| # | Assumption | Required By | Status |
|---|---|---|---|
| 1 | Payment in Phase 1 = Cash on delivery + Pay at branch + optional static Benefit QR. No card/online payment. | Phase 1 launch | NO Pending confirmation |
| 2 | All menu prices in `src/data/menu.json` are currently approved by the restaurant and ready for public display | Phase 1 Sprint 1B | NO Pending confirmation |
| 3 | Al-Badi' branch (البديع) will appear as "Coming Soon" only — no ordering functionality until branch opens | Phase 1 Sprint 1B | NO Pending confirmation |
| 4 | The restaurant does NOT currently use a POS system (or if it does, its name and whether API access is available) | Phase 7 scoping | NO Pending confirmation |
| 5 | One named person from the restaurant is the final decision-maker for approvals (designs, copy, go-live) | Phase 1 kickoff | NO Pending confirmation |
| 6 | Staff will use their own smartphones for the dashboard — no dedicated tablets or terminals will be provided by the agency | Phase 1 Sprint 1E | NO Pending confirmation |
| 7 | The ~11 missing dish photos will be provided before launch. If not, Placeholder images will be used temporarily — agency is NOT responsible for photographing dishes | Phase 1 Sprint 1B | NO Pending confirmation |
| 8 | Post-launch support beyond 30 days will be billed at an agreed hourly rate (to be specified in contract) | Contract | NO Pending confirmation |
| 9 | Google Business Profile access will be granted to the agency to verify schema.org and add the website | Phase 1 Sprint 1F | NO Pending confirmation |
| 10 | The restaurant has (or will write) a cancellation and refund policy before go-live — agency can draft a template but final approval is the restaurant's responsibility | Phase 1 Sprint 1F | NO Pending confirmation |

> **Rule**: Do not block development on unconfirmed assumptions. Build with sensible defaults. Document the assumption here. Flag the client when the item becomes a blocker for that sprint.

---

## PAYMENT MILESTONES

> Two options for client agreement. Use whichever matches the signed contract.

**Option A — 4-Stage (Recommended)**

| Milestone | % | Trigger |
|---|---|---|
| Contract signature | 30% | Signed agreement received |
| Design approval | 30% | Client approves homepage + menu UI in staging |
| Orders live | 30% | Orders flowing through dashboard + wa.me confirmed working |
| Final delivery | 10% | All Phase 1 acceptance criteria pass + staff trained |

**Option B — 3-Stage**

| Milestone | % | Trigger |
|---|---|---|
| Project start | 50% | Contract signed + Phase 1 kickoff |
| Beta delivery | 30% | Staging site complete, all features working |
| Go-live | 20% | Live site launched + staff onboarded |

**Note**: Phases 2–8 are billed separately at the start of each phase contract.

---

## QA CHECKLIST

> Run before every phase gate sign-off. All items must pass.

### Device Testing
- [ ] iPhone Safari (latest iOS) — Arabic RTL
- [ ] iPhone Safari (latest iOS) — English LTR
- [ ] Android Chrome (latest) — Arabic RTL
- [ ] Android Chrome (latest) — English LTR
- [ ] Desktop Chrome — Arabic RTL
- [ ] Desktop Chrome — English LTR
- [ ] Desktop Firefox — Arabic RTL
- [ ] Desktop Safari (Mac) — Arabic RTL

### Functional
- [ ] Menu loads all items from Sanity CMS
- [ ] Category filter scrolls horizontally (touch + mouse)
- [ ] Search returns results in Arabic and English
- [ ] Add to cart — quantity updates correctly
- [ ] Cart bottom sheet opens / closes on mobile
- [ ] Checkout form validates (required fields, phone format)
- [ ] Order created in Supabase with correct price snapshot
- [ ] WhatsApp link opens with correct formatted message + correct branch number
- [ ] Order tracking page shows correct status
- [ ] Language toggle switches AR ↔ EN (layout, direction, fonts)
- [ ] Staff login works (Magic Link)
- [ ] Dashboard shows orders, can update status
- [ ] Branch Manager cannot see other branches' orders (RLS verified)
- [ ] Kitchen role cannot see prices
- [ ] Driver sees only assigned orders
- [ ] Audit log records every status change

### Visual / RTL
- [ ] Zero directional CSS violations (`pl/pr/ml/mr`) — grep must return nothing
- [ ] Arabic text renders with Cairo/Almarai fonts
- [ ] English text renders with Editorial New/Satoshi fonts
- [ ] No raw hex colors in components — grep must return nothing
- [ ] Gold + black brand colors consistent throughout

### Performance
- [ ] Lighthouse Performance ≥ 85 (mobile)
- [ ] Lighthouse Accessibility ≥ 90 (mobile)
- [ ] LCP < 3s on mobile 4G simulation
- [ ] No horizontal scroll at 375px
- [ ] All touch targets ≥ 44×44px
- [ ] All inputs font-size ≥ 16px (no iOS auto-zoom)

### SEO
- [ ] `<title>` and `<meta description>` present on all pages (AR + EN)
- [ ] hreflang tags present on all pages
- [ ] sitemap.xml generated and accessible
- [ ] robots.txt correct
- [ ] Schema.org JSON-LD on homepage
- [ ] 301 redirects from old URLs working
- [ ] No broken images (all `<Image>` have valid src)

### Security
- [ ] CSP header present (verify in Network tab)
- [ ] X-Frame-Options: DENY present
- [ ] No secrets in client-side code (grep for API keys)
- [ ] Supabase RLS enabled on all tables
- [ ] Rate limiting active on `/api/orders`
- [ ] `tsc --noEmit` passes — zero TypeScript errors

---

## LAUNCH CHECKLIST

> Final go/no-go list before switching DNS to production.

### Infrastructure
- [ ] Domain DNS configured (Cloudflare)
- [ ] SSL certificate active (auto via Cloudflare/Vercel)
- [ ] Vercel project: Production branch = `main`, Preview = Standard machines
- [ ] Supabase project: production instance, NOT free tier for production
- [ ] Supabase RLS verified on production
- [ ] Sanity project: production dataset populated (all 179+ items with verified pricing)
- [ ] Environment variables set in Vercel (Supabase URL/keys, Sanity token, Sentry DSN)
- [ ] Cloudflare: caching rules configured, DDoS protection on

### Monitoring
- [ ] GA4 tracking verified (test order → event fires)
- [ ] Microsoft Clarity session recording active
- [ ] Sentry error reporting: test error captured
- [ ] UptimeRobot monitoring: homepage + /api/health endpoint

### Content
- [ ] All menu items reviewed by restaurant management
- [ ] All prices verified (BHD amounts correct)
- [ ] Branch WhatsApp numbers tested (messages arrive)
- [ ] Branch Maps URLs verified
- [ ] Legal pages published (Privacy Policy, Terms, Cancellation Policy)
- [ ] Logo, OG images, favicon all correct
- [ ] No placeholder text ("Lorem ipsum", "Coming soon", test data) in production

### Staff
- [ ] All staff accounts created with correct roles
- [ ] Owner 2FA enabled and tested
- [ ] General Manager 2FA enabled and tested
- [ ] Dashboard walkthrough completed with Branch Managers
- [ ] Kitchen staff briefed on order flow

### Client Sign-off
- [ ] Restaurant management has reviewed the live staging site
- [ ] All acceptance criteria from Phase 1 confirmed passed
- [ ] Client has given written go-live approval

---

## TRAINING & HANDOVER PLAN

> Training is included in Phase 1 deliverables. Budget 2–3 hours per role group.

### Owner / General Manager (2 hours)
- Full dashboard overview: orders, branch comparison, analytics
- Role management: creating staff accounts, assigning/revoking roles
- Audit log: how to detect unauthorized actions, filter by user/date
- 2FA setup and backup codes
- How to update menu prices via Sanity CMS
- Escalation: how to contact Wujood Digital for urgent issues

### Branch Manager (1.5 hours)
- Branch-specific orders dashboard
- Status update flow: new → under_review → accepted
- Exporting daily order summaries
- Escalation path for issues

### Cashier / Order Staff (1 hour)
- Receiving and processing orders
- Status update workflow
- Customer call-back process when phone provided
- WhatsApp message verification

### Kitchen Staff (45 minutes)
- Order card display (name, items, quantity, notes)
- Status update: accepted → preparing → ready
- Urgency alerts (SLA timers — Phase 2)

### Inventory Officer (Phase 3 — scheduled separately)
- Stock entry, low-stock alerts, waste logging

### Driver (Phase 4 — scheduled separately)
- Driver PWA installation
- Order assignment, status updates, GPS (Android) / manual fallback (iOS)

### Deliverables
- [ ] PDF guide per role (AR) — self-service reference after training
- [ ] Staff accounts list (role, branch, contact) — delivered to Owner
- [ ] Support channel: dedicated WhatsApp group (Wujood ↔ Kahramana management)
- [ ] Support period: 30 days post-launch bug fixes at no extra cost
- [ ] Post-launch: issues after 30 days billed at agreed hourly rate

---

## MENU DATA SOURCE — PHASE 1 EXCEPTION

`src/data/menu.json` is the **temporary Phase 1 data source**. This is intentional.

- Start: components read through `src/lib/menu.ts` (normalization layer)
- During Phase 1: Sanity schema built and populated in parallel
- End of Phase 1: Sanity becomes the live source; `src/data/menu.json` becomes read-only backup
- **DO NOT delete `src/data/menu.json`** until restaurant management confirms Sanity contains all 179+ items with verified pricing

**4 pricing structures** in `src/data/menu.json` (always access via `src/lib/menu.ts`):

```
Structure 1: { price_bhd: 1.6 }                         → 127 items (single price)
Structure 2: { sizes: { S: 1.5, L: 2.5 } }              → 40 items (size selector)
Structure 3: { variants: [{ label:{ar,en}, price_bhd }]} → 10 items (variant selector)
Structure 4: { sizes: {...}, variants: [{label:{ar,en}}]} → 2 items (quzi: size=paid, variant=free)
```

`sizes` keys (S/M/L/XL/Glass/0.5L/1L/1.5L/1KG/HALF KG) have no bilingual labels in JSON — UI layer maps them.
