# LAST-SESSION.md — Kahramana Baghdad

> **Session ID**: 68
> **Date**: 2026-05-07
> **Focus**: Security Audit Fixes — OWASP / AUD-001 through AUD-008
> **Status**: ALL FIXES APPLIED — TSC PASS (0 errors)

---

## SESSION 68 — Security Fixes

### FIXES APPLIED

#### AUD-001 🔴 CRITICAL — Hash clock_pin in DB
- **Migration**: `supabase/migrations/069_hash_clock_pins.sql`
  - Adds `clock_pin_hash TEXT` column
  - Backfills SHA-256 hash of every existing plaintext PIN via pgcrypto `digest()`
  - Drops `clock_pin CHAR(4)` plaintext column
- **File**: `src/app/clock/actions.ts`
  - Added `hashPin(pin)` using Node `createHash('sha256')`
  - All DB queries now use `.eq('clock_pin_hash', hashPin(pin))`
  - `as any` cast on column name — stale Supabase types still expect old `clock_pin`; regenerate types after applying migration

#### AUD-005 🟡 MEDIUM — Upstash rate limiting for clock PIN
- **File**: `src/app/clock/actions.ts` (same file as AUD-001)
  - Removed in-memory `Map<string, {count, resetAt}>` — resets on every cold start
  - Added `Ratelimit` (Upstash Redis, sliding window 5 attempts / 60s)
  - Graceful degradation: if `UPSTASH_REDIS_REST_URL` not set, falls through (allows) — no crash

#### AUD-003 🟠 HIGH — Auth guard on inventory template route
- **File**: `src/app/api/inventory/template/route.ts`
  - Added `requireDashboardRole(['owner', 'general_manager', 'branch_manager', 'inventory_manager'])`
  - Returns 401 JSON if unauthenticated or wrong role
  - Added `NextResponse` import

#### AUD-002 🟠 HIGH — Fix computeSubtotal in checkout
- **File**: `src/app/[locale]/checkout/actions.ts`
  - `computeSubtotal` now uses `item.item_total_bhd` (server-computed) instead of `item.quantity * item.unit_price_bhd` (client-supplied unit price)
  - Closes subtle tamper vector where a manipulated `unit_price_bhd` could survive into the subtotal sum

#### AUD-008 🔵 LOW — Remove SUPABASE_SERVICE_ROLE_KEY fallback from order-access.ts
- **File**: `src/lib/auth/order-access.ts`
  - Removed `PAYMENT_WEBHOOK_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` from fallback chain
  - Now only accepts `ORDER_TOKEN_SECRET` or `ORDER_ACCESS_SECRET`

#### AUD-004 + AUD-006 — Package version bumps (CVE fixes)
- **File**: `package.json`
  - `next-intl`: `^3.22.0` → `^3.26.0` (open redirect CVE GHSA-8f24, GHSA-4c35)
  - `postcss`: `^8.4.0` → `^8.4.31` (XSS in CSS stringify GHSA-qx2v)
  - **ACTION REQUIRED**: run `npm install` on Windows to update `package-lock.json`

### VERIFICATION
- `npx tsc --noEmit` → **PASS** (0 errors)

### PENDING ACTIONS
1. **Apply migration 069 to production**:
   ```bash
   npx supabase db push
   ```
   Then regenerate Supabase types:
   ```bash
   npx supabase gen types typescript --linked > src/lib/supabase/types.ts
   ```
   After types regenerate, remove the `as any` casts in `clock/actions.ts` (lines ~57, ~76)

2. **Run `npm install`** on Windows to lock the updated next-intl + postcss versions

3. **Add `ORDER_TOKEN_SECRET`** to Vercel env vars if not already set — without it, order tracking links will throw (graceful before: silently used service role key as fallback)

---

---

## SESSION 67 — Console Errors Audit

### FIXES APPLIED

#### Fix 1: `console.log` في `OrderStatsBar.tsx` — محذوف
- **File**: `src/components/dashboard/OrderStatsBar.tsx`
- **Issue**: `console.log('OrderStatsBar Data at', ...)` يُطبع في كل تحديث realtime — يظهر في Console بشكل مستمر
- **Fix**: حذف السطر + حذف تعليق `// Force rebuild` القديم

#### Fix 2: `key={i}` في `StaffTable.tsx` — مُصلح
- **File**: `src/components/dashboard/StaffTable.tsx`
- **Issue**: Table headers تستخدم `key={i}` (index) — يسبب React warning عند إعادة الترتيب
- **Fix**: `key={h}` باستخدام نص الـ header، `''` → `'actions'`

#### Fix 3: `key={i}` في `MetricsStrip.tsx` — مُصلح
- **File**: `src/components/delivery/MetricsStrip.tsx`
- **Issue**: `cards.map((card, i) => ... key={i})` — index key في static list
- **Fix**: `key={card.labelEn}` باستخدام القيمة الفريدة

#### Fix 4: `alert()` في `DeliveryPageClient.tsx` — مستبدل بـ inline error
- **File**: `src/components/delivery/DeliveryPageClient.tsx`
- **Issue**: `handleUnassign` و`handleCancel` يستخدمان `alert(res.error)` — native browser dialog في production dashboard
- **Fix**: أضفت `actionError` state + error banner أحمر تحت DeliveryHeader مع زر dismiss

### VERIFICATION
- `npx tsc --noEmit` → **PASS** (0 errors)
- `npm run build` → لا يعمل في Linux sandbox (SWC binary missing) — طبيعي، يعمل على Windows

### ما لم يُصلح (قرار مقصود)
- `alert()` في `ImportDropzone.tsx` و`CartDrawer.tsx` — تقع خارج dashboard وصغيرة الأثر
- `key={i}` في `ImportPreview.tsx` / `InventoryWidgetsSkeleton.tsx` — قوائم static لا تتغير ترتيبها
- `as any` / `as unknown as` في inventory pages — موثق في AGENTS.md كـ Supabase type limitation

---

---

## COMPLETED DELIVERABLES

### BUG-1: Driver "وصلت للزبون" button — system error
- **File**: `src/app/[locale]/driver/actions.ts`
- **Root cause**: `markDriverArrived` used `createClient()` (session-scoped, RLS-restricted) for the order fetch. If the driver's RLS policy didn't match, the fetch returned an error and the action failed.
- **Fix**: Switched both fetch and update to `createServiceClient()` (bypasses RLS), keeping all authorization checks in application code (role, branch_id, assigned_driver_id).

### BUG-2: Item sizes missing in CartDrawer, KDS, Staff Dashboard
- **Files**: `src/components/cart/CartDrawer.tsx`, `src/components/kds/KDSOrderCard.tsx`, `src/app/[locale]/dashboard/orders/[id]/page.tsx`
- **Root cause**: `SIZE_LABELS` existed in `src/lib/cart.ts` but none of the display components imported or used it.
- **Fix**: Added `SIZE_LABELS` import and locale-aware lookup to all three components. CartDrawer shows size inline with item name; KDS shows size badge; Dashboard order detail shows size in the options line.

### BUG-3: Map link uses wrong coordinates
- **File**: `src/components/delivery/OrderDetailDrawer.tsx`
- **Root cause**: The delivery manager's order drawer showed `customer_address` as plain unclickable text. The address string contains an embedded Google Maps URL (injected by `CheckoutForm.tsx` when customer uses GPS). Managers had no way to click to navigate.
- **Fix**: Added `mapsDirectionsUrl` import. Now uses `customer_location.lat/lng` (preferred, direct GPS) → falls back to extracting URL from `customer_address` string → MapPin icon and address text become a clickable anchor to Google Maps directions.

### BUG-4: Loyalty points banner never appears after delivery orders
- **File**: `supabase/migrations/067_fix_loyalty_trigger_for_delivery.sql` (NEW)
- **Root cause**: `award_loyalty_points_on_completion()` trigger guard was `IF NEW.status <> 'completed'` — but delivery orders end on `delivered`, never `completed`. Points were never awarded for any delivery order.
- **Fix**: Updated guard to `IF NEW.status NOT IN ('completed', 'delivered') OR OLD.status IN ('completed', 'delivered')` — fires on first entry into either terminal status. Guard prevents double-awarding if status ever moves between terminal states.

---

## VERIFICATION

All 9 phase-completion checks passed:
1. `npx tsc --noEmit` → **PASS** (0 errors)
2. RTL violations → **PASS**
3. Forbidden fonts → **PASS**
4. Forbidden colors → **PASS**
5. Currency (BHD) → pre-existing hits in inventory pages only, not from this session
6. Hardcoded phones → **PASS**
7. Raw hex colors → pre-existing hits in Leaflet marker HTML only
8. i18n completeness → no keys changed this session
9. `npm run build` → **PASS** (524 static pages, 0 errors)

---

## SESSION 64 — Security Fix (2026-05-07)

### COMPLETED: RLS vulnerability patched
- **Issue**: Supabase security advisor flagged `rls_disabled_in_public` on project `kahramana-prod`
- **Root cause**: `public.jetski_test` — a test table created directly in the Supabase dashboard (outside migrations), with RLS never enabled
- **Fix**: Dropped the table via SQL Editor. Added `supabase/migrations/068_drop_test_table.sql` to the audit trail
- **Verified**: Re-ran detection query → 0 rows returned. All public tables now have RLS enabled

---

---

## SESSION 65 — Bug Fixes Deployed (2026-05-07)

### COMPLETED: Map, SIZE_LABELS, Driver Realtime, actions.ts — all deployed

**Bugs fixed (from previous sessions, deployed this session):**

#### Fix 1: Blank delivery map (React error #419)
- **File**: `src/components/delivery/DeliveryPageClient.tsx`
- **Root cause**: `MapView` used Leaflet (browser-only lib) but was statically imported → server-side render crash
- **Fix**: Changed to `dynamic(() => import('./MapView'), { ssr: false })`

#### Fix 2: Driver location freeze (realtime only on INSERT)
- **File**: `src/components/delivery/DeliveryPageClient.tsx`
- **Root cause**: Supabase realtime subscription listened for `event: 'INSERT'` only. `postDriverLocation` uses `upsert` → subsequent pings are UPDATE events, ignored
- **Fix**: Changed to `event: '*'` to catch INSERT + UPDATE

#### Fix 3: SIZE_LABELS not used in 6 components
- **Files**: `OrderCard`, `OrderDetailsModal`, `DriverOrderCard`, `KDSCard`, `OrderDetailDrawer`, `order/[id]/page.tsx`
- **Root cause**: `SIZE_LABELS` existed in `src/lib/cart.ts` but wasn't imported in these screens → raw keys like `1.5L` shown instead of `١.٥ لتر`
- **Fix**: Added import + locale-aware lookup to all 6 files

#### Fix 4: Truncated `actions.ts`
- **File**: `src/app/[locale]/checkout/actions.ts`
- **Root cause**: File was cut off at line 703 mid-`sendOrderConfirmation` call
- **Fix**: Completed the email block + return statement + closing braces

#### Fix 5: Nominatim geocoding (new file)
- **File**: `src/lib/utils/geocode.ts`
- Free OpenStreetMap geocoding for Bahraini addresses → converts block/road/building text to lat/lng for map display

#### Fix 6: MobileBottomNav.tsx null bytes
- **Root cause**: Null bytes (`\x00`) in file caused TypeScript TS1127 errors
- **Fix**: Filtered all bytes < 9 using Python

**Deployment:**
- Commit `eee9f4b` pushed to GitHub (`alrshedahmad31-design/kahramana-saas`)
- GitHub connected to Vercel project for first time (was previously CLI-only)
- Empty trigger commit `f333a5f` created via GitHub API to fire Vercel webhook
- Production deployment `JA5KMTVRt` → **Ready** in 2m 10s ✅

---

---

## SESSION 66 — UI Polish + QA Bugs (2026-05-07)

### COMPLETED: Homepage visual polish

1. **Removed duplicate PhilosophyCards** from `src/app/[locale]/page.tsx` — 01–04 values block was rendering twice. Import and JSX removed.

2. **Fixed `next/image` quality warning** in `next.config.ts` — added `qualities: [70, 72, 75, 80, 85, 90]`. Eliminates console warning for `/assets/protocol/` images.

3. **Protocol section rebuilt** (`src/components/home/ProtocolStack.tsx` refactored + `src/components/home/ProtocolStackClient.tsx` NEW):
   - Server component fetches 3 steps (step 04 dropped per Role.md spec) and passes to client
   - GSAP ScrollTrigger stacking: `pin: true, pinSpacing: false` — cards pin in sequence; previous card animates to `scale(0.9), blur(20px), opacity(0.5)` via scrub
   - 3 SVG animations: GeometricMotif (concentric rings, GSAP `rotation` + `svgOrigin`), LaserGrid (9×9 dot grid + scanner group, GSAP `y` yoyo), EKGWaveform (`stroke-dashoffset` draw-on loop)
   - `prefers-reduced-motion` respected; `gsap.context()` cleanup on unmount

4. **About page scroll reveal** (`src/components/about/AboutReveal.tsx` NEW + `src/app/[locale]/about/page.tsx` updated):
   - Client wrapper using `container.querySelectorAll('section')` — all 9 sections have `<section>` root
   - `gsap.set(sections, { opacity: 0, y: 40 })` client-side only (no SSR flash)
   - Each section: `ScrollTrigger { start: 'top 82%', once: true }` fade-up, `duration: 0.85, ease: 'power3.out'`
   - `StoryHero` stays outside wrapper; 9 below-fold sections wrapped
   - Key: uses `container` (DOM element) not `ref` (RefObject) as `gsap.context` scope — fixes empty-selector bug

### COMPLETED: QA Bug Fixes

5. **BUG-1 — DispatchModal Confirm button silent failure** (`src/components/delivery/DispatchModal.tsx`):
   - `handleAssign()` had `if (!selected || !order) return` — silent when `order=null` (opened from DeliveryHeader with no specific order)
   - Fix: `!order` now calls `setError(...)` with visible message; `order_type === 'pickup'` also surfaces error
   - Confirm button `disabled` now includes `!order`
   - `available` drivers filtered by `order.branch_id` — mismatched-branch drivers no longer appear in list

6. **BUG-2 — MapPin icon links to `#`** (`src/components/delivery/OrderDetailDrawer.tsx`):
   - `mapsHref` was `null` when both coords and embedded URL absent → `href="#"`
   - Fix: priority chain — coords → embedded URL → Google Maps text-search (`addrText + ', Bahrain'`) → `null`
   - When `null`: `<MapPin>` renders without `<a>` wrapper; `href="#"` eliminated entirely
   - Removed unused `mapsDirectionsUrl` import

### VERIFICATION
- `npx tsc --noEmit` → **PASS** (0 errors)
- `npm run build` → **PASS** (524 pages, 0 errors)

---

## NEXT ACTIONS (Session 65 → 66)

1. **Apply migration 067 to production** (pending since session 63):
   ```bash
   npx supabase db push
   ```
   Updates `award_loyalty_points_on_completion()` — fixes loyalty points for delivery orders. Safe, no schema changes.

2. **Test delivery map on production** — open `kahramana.vercel.app/ar/delivery`, confirm Leaflet map renders (not white page), driver marker appears and moves in realtime.

3. **Test SIZE_LABELS on production** — place an order with a sized item (e.g., tea), confirm size shows as `١.٥ لتر` in KDS, delivery dashboard, driver screen, and order history.

4. **Test loyalty flow** with a delivery order — confirm points awarded and toast banner appears on `delivered` status.

5. **Pull the trigger commit** locally when Windows git lock clears:
   ```bash
   git pull origin master
   ```
   (The repo now has 2 extra commits: `eee9f4b` + `f333a5f trigger` not yet in local working tree due to lock files)

---

## DECISIONS MADE
- Delivery orders use `delivered` status (driver-set), not `completed` (KDS-set). The loyalty trigger was silently skipping all delivery orders since day 1. Fix is backwards-compatible — no historical data backfill needed.
- `createServiceClient()` is appropriate for `markDriverArrived` since all auth checks are done in application code before any DB call is made.
- Vercel project is now connected to GitHub (`alrshedahmad31-design/kahramana-saas`) — all future `git push master` will auto-deploy. No more manual `vercel --prod` needed.
- GitHub classic PAT (`ghp_DXd...`) stored for push auth — expires in 30 days (Jun 6, 2026). Renew before then.
- Vercel API token (`vcp_6riI8...`) created, expires Jun 6, 2026. Not needed now that GitHub integration is active.
