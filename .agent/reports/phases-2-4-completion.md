# Phases 2 + 4 — Completion Report
> Kahramana Baghdad | Session 8 | 2026-04-28
> Phase 3 skipped (blocked on chef recipe data). Phase 4 built out-of-order.

---

## Summary

| Phase | Name | Status | Files |
|---|---|---|---|
| Phase 2 | KDS & Live Orders | ✅ done | 20 files |
| Phase 3 | Inventory & Waste / COGS | ⏸️ blocked | 0 files |
| Phase 4 | Driver PWA & Delivery Tracking | ✅ done | 10 files |
| **Total** | | | **30 files** |

Build: **391 pages, 0 errors**

---

## Phase 2 — KDS & Live Orders

### What was built

#### Security & RLS Hardening
- **`supabase/migrations/003_rls_staff_fix.sql`**
  Fixes privilege escalation (AUD-003): staff can no longer update their own `role` or `branch_id`. Enforces row-level policy so every staff member can only read/write records within their scope.
- **`supabase/migrations/004_audit_logs_rls.sql`**
  RLS on `audit_logs`: only `owner` and `branch_manager` roles can read; no role can delete or update. Prevents tampered audit trails.

#### KDS Schema
- **`supabase/migrations/005_kds_schema.sql`**
  New tables: `kds_queue` (station-based order items with bump timestamps) + `kds_stations` config. Postgres trigger auto-enqueues items into the correct station when an order moves to `preparing`.

#### Auth & RBAC
- **`src/lib/auth/rbac.ts`**
  9-role permission matrix: `owner`, `branch_manager`, `cashier`, `kitchen`, `grill`, `salads`, `desserts`, `drinks`, `driver`. Permissions are derived, not stored in DB, reducing attack surface.
- **`src/middleware.ts`** (updated)
  Route guards added for `/dashboard/kds` (kitchen roles only) and `/driver` (driver role only). Unauthenticated requests redirect to `/login`.

#### Staff Management
- **`src/app/[locale]/dashboard/staff/page.tsx`** — Staff list with role badges, branch filter, active toggle
- **`src/app/[locale]/dashboard/staff/actions.ts`** — Server Actions: create, update role, toggle active, delete
- **`src/components/dashboard/StaffTable.tsx`** — Sortable staff table with inline status toggle
- **`src/components/dashboard/StaffForm.tsx`** — Create/edit modal with role dropdown + branch select

#### KDS Dashboard
- **`src/lib/kds/priorities.ts`** — Priority scoring: elapsed time × category weight. Grill items auto-escalate after 8 min.
- **`src/lib/kds/constants.ts`** — `ALL_STATIONS` array (extracted from client component to fix Server Component TypeError)
- **`src/app/[locale]/dashboard/kds/page.tsx`** — Server Component: reads `?station=` param, guards with `canAccessKDS()`, passes `initialStation` to board
- **`src/app/[locale]/dashboard/kds/actions.ts`** — `bumpKDSItem()`: marks item done, auto-advances order status when all items for a station are bumped
- **`src/components/kds/KDSBoard.tsx`** — Client Component: Supabase realtime subscription, station tabs, 12-item grid with auto-refresh
- **`src/components/kds/KDSCard.tsx`** — Order item card: elapsed timer, priority ring, bump CTA, special notes
- **`src/components/kds/StationSelector.tsx`** — Station tab bar (grill / fry / salads / desserts / drinks / packing)

#### UI & Icon System
- **`src/components/icons/LuxuryIcon.tsx`** — Inline SVG icon system replacing all emoji glyphs. Tokens map to brand-gold paths. Used across KDS cards and dashboard sidebar.
- **`src/app/[locale]/branches/page.tsx`** (Cinematic Redesign) — Interior photography hero, interactive Google Maps embeds, trust section
- **`src/components/home/FeatureArtifacts.tsx`** (Cinematic Refresh) — Brand storytelling artifacts with spring physics

#### Fixes (Session 8, same phase)
- **`src/app/[locale]/dashboard/settings/page.tsx`** — Placeholder page; resolved 404 on nav link
- **`public/favicon.ico`** — Deleted; resolved conflict with `src/app/favicon.ico` (was causing 500)

---

### Phase 2 Files — Full List

| # | File | Type |
|---|---|---|
| 1 | `supabase/migrations/003_rls_staff_fix.sql` | DB Migration |
| 2 | `supabase/migrations/004_audit_logs_rls.sql` | DB Migration |
| 3 | `supabase/migrations/005_kds_schema.sql` | DB Migration |
| 4 | `src/lib/auth/rbac.ts` | Auth |
| 5 | `src/middleware.ts` (updated) | Auth |
| 6 | `src/app/[locale]/dashboard/staff/page.tsx` | Page |
| 7 | `src/app/[locale]/dashboard/staff/actions.ts` | Server Action |
| 8 | `src/components/dashboard/StaffTable.tsx` | Component |
| 9 | `src/components/dashboard/StaffForm.tsx` | Component |
| 10 | `src/lib/kds/priorities.ts` | Lib |
| 11 | `src/lib/kds/constants.ts` | Lib |
| 12 | `src/app/[locale]/dashboard/kds/page.tsx` | Page |
| 13 | `src/app/[locale]/dashboard/kds/actions.ts` | Server Action |
| 14 | `src/components/kds/KDSCard.tsx` | Component |
| 15 | `src/components/kds/KDSBoard.tsx` | Component |
| 16 | `src/components/kds/StationSelector.tsx` | Component |
| 17 | `src/components/icons/LuxuryIcon.tsx` | Component |
| 18 | `src/app/[locale]/branches/page.tsx` (redesign) | Page |
| 19 | `src/components/home/FeatureArtifacts.tsx` (refresh) | Component |
| 20 | `src/app/[locale]/dashboard/settings/page.tsx` | Page |

---

## Phase 3 — Inventory & Waste / COGS (Blocked)

**Reason**: Chef recipe data (exact ingredient quantities for all ~194 dishes) not yet provided by the restaurant.

**Estimated unlock**: 3-5 weeks after data delivery.

**What is needed before Phase 3 can start**:
1. Chef recipes with ingredient names + exact quantities for all ~194 menu items
2. Suppliers list with raw material pricing

Phase 4 was advanced instead to keep momentum while waiting.

---

## Phase 4 — Driver PWA & Delivery Tracking

### What was built

#### Database
- **`supabase/migrations/007_driver_schema.sql`**
  - `driver_locations` table: `(driver_id, lat, lng, accuracy, recorded_at)` with RLS (driver writes own rows, manager reads all)
  - `assigned_driver_id` column on `orders` (FK → `staff_basic.id`)
  - Index on `(driver_id, recorded_at DESC)` for efficient last-location query

#### Driver App Routes
- **`src/app/[locale]/driver/layout.tsx`**
  Standalone layout (no dashboard sidebar). Registers service worker, applies PWA viewport meta. RBAC-gated: `driver` role only.
- **`src/app/[locale]/driver/page.tsx`**
  Driver board page: fetches assigned + available orders, passes to `DriverBoard`.
- **`src/app/[locale]/driver/actions.ts`**
  Server Actions:
  - `acceptOrder(orderId)` — assigns driver, moves order to `out_for_delivery`
  - `markDelivered(orderId)` — moves order to `delivered`, logs timestamp
  - `updateLocation(lat, lng, accuracy)` — inserts into `driver_locations`
- **`src/app/[locale]/driver/offline/page.tsx`**
  Offline fallback rendered by service worker when network is unavailable. Shows last-known orders from cache and a reconnect CTA.

#### Driver Components
- **`src/components/driver/DriverBoard.tsx`**
  Client Component with Supabase realtime subscription on `orders` filtered by `assigned_driver_id`. Sections: "Available" (unassigned delivery orders) + "My Active Orders".
- **`src/components/driver/DriverOrderCard.tsx`**
  Order card: customer name, address, phone (tap-to-call), status badge, primary CTA (Accept / Mark Delivered). Respects RTL layout.
- **`src/components/driver/DriverPWAShell.tsx`**
  Installable PWA wrapper: `beforeinstallprompt` handling, install banner, iOS "Add to Home Screen" hint. GPS polling via `navigator.geolocation.watchPosition` with 10-second interval, falls back to manual location entry on iOS (GPS restriction by design).

#### PWA Manifest
- **`public/manifest.json`** — `name: "Kahramana Drivers"`, `start_url: /ar/driver`, `display: standalone`, `theme_color: #C8922A` (brand gold), `background_color: #0A0A0A` (brand black). Driver-specific icons.

#### Test Data
- **`supabase/migrations/006_seed_test_staff.sql`** (updated)
  Driver test user added:
  - `auth.users`: `driver@kahramana.test` / `driver123`
  - `auth.identities`: email provider row for sign-in
  - `staff_basic`: `Test Driver`, role `driver`, branch `riffa`, active `true`

---

### Phase 4 Files — Full List

| # | File | Type |
|---|---|---|
| 1 | `supabase/migrations/007_driver_schema.sql` | DB Migration |
| 2 | `src/app/[locale]/driver/layout.tsx` | Layout |
| 3 | `src/app/[locale]/driver/page.tsx` | Page |
| 4 | `src/app/[locale]/driver/actions.ts` | Server Action |
| 5 | `src/app/[locale]/driver/offline/page.tsx` | Page |
| 6 | `src/components/driver/DriverBoard.tsx` | Component |
| 7 | `src/components/driver/DriverOrderCard.tsx` | Component |
| 8 | `src/components/driver/DriverPWAShell.tsx` | Component |
| 9 | `public/manifest.json` | PWA |
| 10 | `supabase/migrations/006_seed_test_staff.sql` (updated) | DB Seed |

---

## All Phases — Cumulative File Count

| Phase | Files | Cumulative |
|---|---|---|
| Phase 0 | 5 | 5 |
| Phase 1 | 56 | 61 |
| Phase 2 | 20 | 81 |
| Phase 3 | 0 (blocked) | 81 |
| Phase 4 | 10 | 91 |

**Total source files to date: 91**

---

## Completion Stats

| Metric | Value |
|---|---|
| Total files created | 91 |
| DB migrations | 7 (001–007) |
| Pages | 20 |
| Components | 22 |
| Server Actions | 4 |
| Lib modules | 8 |
| Build pages (Next.js) | 391 |
| Build errors | 0 |
| TypeScript errors | 0 |
| Test users | 4 (owner / manager / kitchen / driver) |
| Phases complete | 4 of 9 (Phase 0-1-2-4) |
| Phases blocked | 1 (Phase 3 — recipe data) |
| Phases remaining | 4 (Phase 5-6-7-8) |

---

## Next Action

**Recommended: Phase 5 — Loyalty & Coupons**
No external blockers. Prerequisites (Phase 1 + Phase 2) both done.

**Run simultaneously**:
- Start Benefit Pay merchant paperwork (2-4 month approval window)
- Start Meta Business Verification for WhatsApp API
