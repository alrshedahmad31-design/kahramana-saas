# Last Session — 2026-04-29 (Session 19 — continued from compacted context)

## What was done

### 1. World-Class Driver Interface Rebuild ✅
Complete rebuild of the driver system. Commit: `2ccdae5`

**New files:**
- `src/lib/utils/delivery.ts` — Haversine distance (object API), traffic-aware ETA (Baghdad peak hours 7–9, 12–2, 5–8), urgency levels, `travelmode=driving` nav URLs, RTL formatters, `resolveExpectedAt`
- `src/components/driver/DriverPerformanceDashboard.tsx` — 4-metric 2×2 grid: deliveries today, avg delivery time, order total (BD), on-time rate (%)
- `supabase/migrations/025_driver_complete.sql` — 6 new columns: `delivery_building`, `delivery_street`, `delivery_area`, `expected_delivery_time`, `customer_notes`, `driver_notes`

**Modified files:**
- `DriverOrderCard.tsx` — full rewrite:
  - Urgency banner (red pulsing = critical <10 min, orange = urgent <20 min, with countdown)
  - Connected route view: gold dot → line → green dot, both nav buttons use `travelmode=driving`
  - Distance + ETA pills with traffic awareness
  - Collapsible items section (auto-expanded for `ready` orders)
  - `customer_notes` speech bubble (falls back to `delivery_instructions`)
  - Card border highlights by urgency
- `DriverDashboard.tsx` — added `sortByUrgency`, `onTimeRate`, `DriverPerformanceDashboard`, expanded SELECT with 9 new columns
- `driver/page.tsx` — expanded ORDER_SELECT to include all new columns
- `src/lib/supabase/types.ts` — `OrderRow` gains 9 new fields: `delivery_building/street/area`, `expected_delivery_time`, `customer_notes`, `driver_notes`, `picked_up_at`, `arrived_at`, `delivered_at`; `OrderInsert` updated accordingly

### 2. Auth Callback Fix ✅ (completed earlier in this session)
- Created `/src/app/auth/callback/route.ts` — full PKCE handler for magic links + password reset
- Updated middleware matcher to exclude `/auth/*`
- Fix shipped in commit `06e0998`

---

## Git State
- **Branch:** `master`
- **Latest commit:** `2ccdae5` — world-class driver rebuild
- **Remote:** pushed ✅

## Vercel
- Vercel auto-deploys on push to master — deploy triggered by `2ccdae5`

---

## Action Required Before Next Session

### CRITICAL — Apply Migration 025 to Production
Migration 025 is local only. Run in Supabase Dashboard → SQL Editor:

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_building') THEN
    ALTER TABLE orders ADD COLUMN delivery_building TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_street') THEN
    ALTER TABLE orders ADD COLUMN delivery_street TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_area') THEN
    ALTER TABLE orders ADD COLUMN delivery_area TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='expected_delivery_time') THEN
    ALTER TABLE orders ADD COLUMN expected_delivery_time TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='customer_notes') THEN
    ALTER TABLE orders ADD COLUMN customer_notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='driver_notes') THEN
    ALTER TABLE orders ADD COLUMN driver_notes TEXT;
  END IF;
END $$;
```

App will NOT break without it (all new fields are nullable), but urgency will always use the 45-min fallback until `expected_delivery_time` is populated.

### Add Supabase Redirect URL
Go to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs.
Add: `https://kahramana.vercel.app/auth/callback`
(Required for magic link + password reset to work on production.)

---

## Next Session — Start Here
1. Confirm migration 025 applied to production
2. Confirm `/auth/callback` redirect URL added in Supabase
3. Test driver page at `/ar/driver` — should show urgency banners, connected route, performance dashboard
4. Optional next feature: wire `expected_delivery_time` into order creation so urgency is live from day 1
5. Optional: driver notes (`driver_notes`) — allow drivers to add notes from their UI

---

## Active Blockers
| Blocker | Owner |
|---------|-------|
| Migration 025 apply on prod | Ahmed |
| Supabase redirect URL for /auth/callback | Ahmed |
| Chef recipes for ~194 dishes | Chef |
| Benefit Pay merchant approval | Restaurant owner |
| Meta Business Verification | Restaurant owner |
