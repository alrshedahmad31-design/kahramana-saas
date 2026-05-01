# HANDOFF — Driver Flow Phase 2 (Orange + Yellow Fixes)
> Target executor: **Claude Code** (CLI)
> Last session: 34 (driver flow security hardening — committed `acb1b4b`)
> This document: standalone spec, no other context required beyond `CLAUDE.md` + `AGENTS.md` + `.agent/PLAN.md`.

---

## ⚠️ MIGRATION NUMBERING

The numbers `035–039` used in this document are **placeholders**. Before applying any migration, run:

```bash
ls supabase/migrations/ | sort -V | tail -3
```

…and use the next sequential number(s). At the time of writing, `035_inventory_core.sql` is already claimed by a parallel inventory track. Likely correct numbers are `036–040` or higher — verify before creating files.

Rename the SQL files AND every reference to them in this document accordingly.

---

## SESSION BOOTSTRAP

Run the standard Kahramana session-start ritual from `CLAUDE.md`, then read this file in full. Do NOT begin coding until you have:

1. Read `CLAUDE.md`, `AGENTS.md`, `.agent/PLAN.md`, `.agent/RULES.md`.
2. Confirmed `.agent/phase-state.json` shows `migration_status: "ALL APPLIED — through 034_driver_order_issues.sql"`.
3. Read this entire document.
4. Confirmed the human is ready to start — output the SESSION START block first.

Implementation order is **strict**: do not jump ahead. Each fix is independently shippable with its own commit.

---

## CONTEXT — what was just done (session 34, do not redo)

| Already shipped | Where |
|---|---|
| `submitCashHandover` server-recomputes total from DB; client `totalCash` ignored | `src/app/[locale]/driver/actions.ts:175` |
| `assignDriverToOrder` server action with audit + RBAC | `src/app/[locale]/dashboard/delivery/actions.ts` (NEW) |
| `DispatchModal` migrated off direct `supabase.update` | `src/components/delivery/DispatchModal.tsx` |
| Migration 034 applied to production | `supabase/migrations/034_driver_order_issues.sql` |

**Existing tables relevant to this work** (already in production):
- `orders` — has `picked_up_at`, `arrived_at`, `delivered_at`, `assigned_driver_id`, `total_bhd`
- `staff_basic` — has `availability_status` (online/offline/busy)
- `driver_locations` — append-only GPS log
- `driver_cash_handovers` — end-of-shift cash records
- `driver_order_issues` — driver issue reports
- `payments` — `method` ∈ (cash, benefit_qr, tap_card, tap_knet)
- `time_entries` — `clock_in`, `clock_out`, `break_minutes`, `total_hours` (already exists, NOT yet wired to driver toggle)
- `shifts` — exists, used for scheduled shifts (do NOT confuse with time_entries)
- `audit_logs` — has `actor_role`, `branch_id`, `record_id`, `changes (jsonb)`

---

## WORK QUEUE

### 🟠 ORANGE — ship as 1 commit per fix (4 commits total)

| # | Fix | New migration? | Estimated effort |
|---|---|---|---|
| 5 | Multiple cash handovers per shift | ✅ 035 | 1h |
| 6 | Enforce `arrived_at` before `delivered` | ❌ code only | 30m |
| 10 | Link `orders.cash_settled_at` ↔ handover | ✅ 036 | 1h |
| 19 | Cash reconciliation discrepancy workflow | ✅ 037 | 3h |

### 🟡 YELLOW — ship as 1 commit per fix (4 commits total)

| # | Fix | New migration? | Estimated effort |
|---|---|---|---|
| Y1 | GPS cleanup (only post when has active order) | ✅ 038 (retention) | 1h |
| Y2 | Cash handover reminder banner | ❌ code only | 30m |
| Y3 | Driver shift hours tracking | ❌ wire existing `time_entries` | 1h |
| Y4 | Tips support on cash deliveries | ✅ 039 | 1.5h |

**TOTAL:** 8 commits, ~10h focused work.

Do NOT bundle fixes. Each commit must independently pass all 9 phase-gates from `CLAUDE.md`.

---

## 🟠 FIX #5 — Multiple cash handovers per shift

### Problem
`submitCashHandover` rejects any submission if a row already exists for `(driver_id, shift_date)`. Real-world drivers do mid-shift handovers + end-of-shift handovers. Currently the second is silently blocked.

### Approach
Allow N handovers per `shift_date`, but each `order_id` can only appear in ONE handover (no double-counting).

### Migration `supabase/migrations/035_multiple_cash_handovers.sql`

```sql
-- 035_multiple_cash_handovers.sql
-- Allow multiple cash handovers per driver per shift_date.
-- Each delivered cash order can appear in exactly one handover.

-- Drop legacy unique-ish constraint (was indirect via index, see 029)
-- 029 didn't add an explicit unique constraint, but we relied on app logic.
-- Now we enforce uniqueness at the order level via a partial unique index
-- on driver_cash_handovers expanded by order_id.

-- Approach: keep order_ids as TEXT[] for backwards compat, but add a
-- helper table to enforce per-order uniqueness.

CREATE TABLE IF NOT EXISTS driver_cash_handover_orders (
  handover_id UUID NOT NULL REFERENCES driver_cash_handovers(id) ON DELETE CASCADE,
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  PRIMARY KEY (handover_id, order_id),
  UNIQUE (order_id)            -- prevents same order in two handovers
);

CREATE INDEX IF NOT EXISTS idx_dcho_handover ON driver_cash_handover_orders(handover_id);
CREATE INDEX IF NOT EXISTS idx_dcho_order    ON driver_cash_handover_orders(order_id);

ALTER TABLE driver_cash_handover_orders ENABLE ROW LEVEL SECURITY;

-- Driver: read own handover order links
CREATE POLICY "dcho_select_own"
  ON driver_cash_handover_orders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM driver_cash_handovers h
      WHERE h.id = driver_cash_handover_orders.handover_id
        AND h.driver_id = auth.uid()
    )
  );

-- Manager: read all
CREATE POLICY "dcho_select_manager"
  ON driver_cash_handover_orders FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_basic
      WHERE id = auth.uid()
        AND role IN ('owner', 'general_manager', 'branch_manager')
        AND is_active = TRUE
    )
  );

-- Driver: insert own (server-enforced too)
CREATE POLICY "dcho_insert_own"
  ON driver_cash_handover_orders FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM driver_cash_handovers h
      WHERE h.id = driver_cash_handover_orders.handover_id
        AND h.driver_id = auth.uid()
    )
  );

-- Backfill from existing order_ids[] in driver_cash_handovers
INSERT INTO driver_cash_handover_orders (handover_id, order_id)
SELECT h.id, ord_id::uuid
FROM driver_cash_handovers h
CROSS JOIN LATERAL unnest(h.order_ids) AS ord_id
WHERE EXISTS (SELECT 1 FROM orders WHERE id = ord_id::uuid)
ON CONFLICT (order_id) DO NOTHING;

-- ROLLBACK:
--   DROP TABLE IF EXISTS driver_cash_handover_orders;
```

### Code changes

**`src/app/[locale]/driver/actions.ts` → `submitCashHandover`:**

1. Remove the duplicate-shift_date check.
2. After validating orders, INSERT into `driver_cash_handovers` (existing).
3. Then INSERT into new `driver_cash_handover_orders` (handover_id, order_id) for each.
4. If the second insert fails with unique-violation (`23505`), rollback the handover row → return error: `'Some orders are already settled in another handover'`.
5. Use `createServiceClient()` for atomicity.

**`src/components/driver/DriverDashboard.tsx`:**

The `completedOrders` query already filters `delivered + this driver`. Add a left-join to `driver_cash_handover_orders` and exclude orders already settled. Updated query:

```ts
.select(`
  ...existing fields...,
  cash_settlement:driver_cash_handover_orders(handover_id)
`)
```

Then filter in JS: `.filter(o => o.payments?.method !== 'cash' || !o.cash_settlement?.length)` for the modal source. The existing list shows all delivered orders; just narrow the cash-handover modal to only un-settled cash.

**`src/components/driver/CashHandoverModal.tsx`:**

Add prop `unsettledCashOrders` (driver dashboard already filters), title becomes "تسليم النقد — جزئي/نهائي" based on `unsettledCashOrders.length === all-day-cash-orders`.

### Tests
- Driver delivers 3 cash orders, hands over 2, hands over 1 more → both succeed.
- Driver tries to include same order_id in 2nd handover → rejected with `Some orders are already settled in another handover`.
- Backfill check: existing handovers in production should populate `driver_cash_handover_orders` correctly.

---

## 🟠 FIX #6 — Enforce `arrived_at` before `delivered`

### Problem
Driver can press "DELIVERED" without ever pressing "ARRIVED" in the UI — `driverBumpOrder('out_for_delivery' → 'delivered')` doesn't validate `arrived_at`. The 4-step stepper is theatre; analytics are corrupted.

### Approach
Reject `delivered` transition if `arrived_at IS NULL`. UI already enforces this; this is the server-side guard.

### Code changes

**`src/app/[locale]/driver/actions.ts` → `driverBumpOrder`:**

After fetching `order`, before the update, if `currentStatus === 'out_for_delivery'`:
```ts
const { data: order, ... } = await supabase
  .from('orders')
  .select('id, status, branch_id, assigned_driver_id, arrived_at')  // add arrived_at
  ...

if (currentStatus === 'out_for_delivery' && !order.arrived_at) {
  return { success: false, error: 'Must mark as arrived before delivering' }
}
```

**`src/components/driver/DriverOrderCard.tsx`:**

Translate the new error in the action error block:
```ts
actionError === 'Must mark as arrived before delivering'
  ? (isRTL ? 'يجب تأكيد الوصول للزبون قبل التسليم' : 'Confirm arrival before delivery')
  : ...existing branches...
```

### Tests
- Driver picks up, presses DELIVERED without ARRIVED → error toast.
- Driver picks up, presses ARRIVED, then DELIVERED → success.

### Compatibility
No migration needed. Pre-existing delivered orders without `arrived_at` are unaffected (this rule applies only to NEW transitions).

---

## 🟠 FIX #10 — Link `orders.cash_settled_at` ↔ handover

### Problem
`driver_cash_handovers` is a separate ledger; `orders` table has no flag indicating cash was handed over. If the ledger table is corrupted/dropped, you cannot reconstruct settlement state from `orders`. Also no efficient way to query "unsettled cash orders for driver X" without joining.

### Migration `supabase/migrations/036_orders_cash_settlement.sql`

```sql
-- 036_orders_cash_settlement.sql
-- Adds cash settlement timestamp + handover backlink to orders.
-- Backfills from existing driver_cash_handover_orders (created in 035).
-- DEPENDS ON 035 being applied first.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cash_settled_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cash_settlement_id  UUID REFERENCES driver_cash_handovers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_cash_unsettled
  ON orders(assigned_driver_id, status)
  WHERE cash_settled_at IS NULL;

-- Backfill from 035's link table
UPDATE orders o
SET    cash_settled_at    = h.handed_at,
       cash_settlement_id = h.id
FROM   driver_cash_handover_orders link
JOIN   driver_cash_handovers       h ON h.id = link.handover_id
WHERE  link.order_id = o.id
  AND  o.cash_settled_at IS NULL;

-- ROLLBACK:
--   ALTER TABLE orders DROP COLUMN IF EXISTS cash_settlement_id;
--   ALTER TABLE orders DROP COLUMN IF EXISTS cash_settled_at;
--   DROP INDEX IF EXISTS idx_orders_cash_unsettled;
```

### Code changes

**`src/app/[locale]/driver/actions.ts` → `submitCashHandover`:**

After inserting handover + link rows, also UPDATE `orders` for each settled order:
```ts
await service
  .from('orders')
  .update({ cash_settled_at: now, cash_settlement_id: handover.id })
  .in('id', orderIds)
  .eq('assigned_driver_id', user.id)   // belt + suspenders
  .is('cash_settled_at', null)         // optimistic guard
```

**`src/components/driver/DriverDashboard.tsx`:**

Now `cash_settled_at` is ON the order — simplifies the query:
```ts
const isCashUnsettled = (o: DriverOrder) =>
  o.payments?.method === 'cash' && !o.cash_settled_at
```

Pass `cashOrders.filter(isCashUnsettled)` to `CashHandoverModal`.

**`src/lib/supabase/custom-types.ts`:**
Regenerate types after migration — or manually add `cash_settled_at: string | null` and `cash_settlement_id: string | null` to `OrderRow`/`DriverOrder` types.

### Tests
- Driver hands over → `orders.cash_settled_at` populated for those orders.
- Driver opens modal again → only NEW cash orders shown.
- Manager queries `SELECT count(*) FROM orders WHERE cash_settled_at IS NULL AND payments.method='cash'` to find unsettled.

---

## 🟠 FIX #19 — Cash reconciliation discrepancy workflow

### Problem
Manager can only press "Verify" — no way to record "I counted 48 BD but driver said 50 BD". Real-world reconciliation always has discrepancies.

### Migration `supabase/migrations/037_cash_reconciliation_discrepancy.sql`

```sql
-- 037_cash_reconciliation_discrepancy.sql

ALTER TABLE driver_cash_handovers
  ADD COLUMN IF NOT EXISTS actual_received NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS discrepancy     NUMERIC(10,3) GENERATED ALWAYS AS (COALESCE(actual_received, total_cash) - total_cash) STORED,
  ADD COLUMN IF NOT EXISTS reconciliation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (reconciliation_status IN ('pending', 'verified', 'discrepancy', 'disputed')),
  ADD COLUMN IF NOT EXISTS manager_notes TEXT,
  ADD COLUMN IF NOT EXISTS verified_at  TIMESTAMPTZ;

-- Backfill: existing verified rows = 'verified', else 'pending'
UPDATE driver_cash_handovers
SET    reconciliation_status = CASE WHEN verified THEN 'verified' ELSE 'pending' END,
       verified_at = CASE WHEN verified THEN handed_at ELSE NULL END,
       actual_received = CASE WHEN verified THEN total_cash ELSE NULL END
WHERE  reconciliation_status = 'pending';

-- Drop the old `verified` boolean column (use status instead) — DEFERRED to a later migration
-- to keep this one safe and reversible.

CREATE INDEX IF NOT EXISTS idx_handovers_status
  ON driver_cash_handovers(reconciliation_status, handed_at DESC);

-- ROLLBACK:
--   ALTER TABLE driver_cash_handovers DROP COLUMN IF EXISTS actual_received CASCADE;
--   ALTER TABLE driver_cash_handovers DROP COLUMN IF EXISTS reconciliation_status;
--   ALTER TABLE driver_cash_handovers DROP COLUMN IF EXISTS manager_notes;
--   ALTER TABLE driver_cash_handovers DROP COLUMN IF EXISTS verified_at;
```

### Code changes

**`src/app/[locale]/dashboard/delivery/cash-reconciliation/actions.ts`:**

Replace `verifyCashHandover` with `reconcileCashHandover`:
```ts
export async function reconcileCashHandover(input: {
  handoverId: string
  actualReceived: number     // amount manager counted
  notes?: string
}): Promise<{ success: true; status: 'verified' | 'discrepancy' } | { error: string }>
```

Logic:
- Validate manager role.
- Fetch handover, ensure `reconciliation_status === 'pending'`.
- Compute `delta = actualReceived - total_cash`.
- If `|delta| <= 0.500` → status `'verified'`, auto-close.
- Else → status `'discrepancy'`, require `notes` (reject if empty).
- Write audit log entry with delta amount.
- Update: `actual_received`, `reconciliation_status`, `manager_notes`, `received_by = user.id`, `verified_at = now()`.

Add `disputeCashHandover` for cases where manager flags it as disputed (driver claims different):
```ts
export async function disputeCashHandover(handoverId: string, notes: string)
```

**`src/components/delivery/CashReconciliationClient.tsx`:**

Replace single "Verify" button with reconciliation panel:
- Number input: "Actual Cash Received" (BD)
- Auto-show discrepancy delta in real-time as user types
- If delta > 0.500: required notes field appears
- Two buttons: "Verify (within tolerance)" disabled until input matches, "Flag Discrepancy" with notes.
- Status badges: pending/verified/discrepancy/disputed with distinct colors.

**Stats cards on the page:**
- Pending Verification (yellow)
- Verified (green)
- Discrepancies (red — sum of |delta| for last 30 days)

### Tests
- Manager enters 50.000 for a 50.000 handover → status verified.
- Manager enters 49.500 (delta -0.500) → still within tolerance, verified.
- Manager enters 48.000 (delta -2.000) → notes required, status discrepancy.
- Submit without notes when discrepancy → blocked client-side AND server-side.

---

## 🟡 FIX Y1 — GPS cleanup

### Problems
1. GPS posts even when no active order → battery drain.
2. `driver_locations` grows without bound — no retention.
3. Silent failures on GPS error → driver thinks they're tracked but aren't.

### Code changes

**`src/components/driver/DriverDashboard.tsx`:**

Replace existing GPS effect:
```ts
useEffect(() => {
  if (!isOnline || !('geolocation' in navigator)) return

  const activeOrder = orders.find(o => o.status === 'out_for_delivery')
  if (!activeOrder) return  // ← NEW: don't track when idle

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      postDriverLocation({
        driver_id:  driverId,
        order_id:   activeOrder.id,
        lat:        pos.coords.latitude,
        lng:        pos.coords.longitude,
        accuracy_m: pos.coords.accuracy ?? null,
      })
    },
    (err) => {
      // Surface non-permission errors to driver
      if (err.code !== err.PERMISSION_DENIED) {
        console.warn('GPS error:', err.message)
      }
    },
    { enableHighAccuracy: true, maximumAge: 30_000 },
  )
  return () => navigator.geolocation.clearWatch(watchId)
}, [isOnline, driverId, orders])
```

Add a small state badge showing "GPS active" / "GPS off" near the online toggle when there's a delivery in progress.

**`src/app/[locale]/driver/actions.ts` → `postDriverLocation`:**

Add server-side rate limit (max 1 insert per 15s per driver):
```ts
// Check last insert
const { data: last } = await supabase
  .from('driver_locations')
  .select('created_at')
  .eq('driver_id', user.id)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()

if (last && Date.now() - new Date(last.created_at).getTime() < 15_000) {
  return { success: true } // silent throttle, no error
}
```

### Migration `supabase/migrations/038_driver_locations_retention.sql`

```sql
-- 038_driver_locations_retention.sql
-- Adds a retention function + scheduled cleanup for driver_locations.
-- Requires pg_cron extension (Supabase has this enabled by default).

CREATE OR REPLACE FUNCTION cleanup_driver_locations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM driver_locations
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$;

-- Schedule daily at 3am Bahrain time (00:00 UTC)
SELECT cron.schedule(
  'driver-locations-cleanup',
  '0 0 * * *',
  $$ SELECT cleanup_driver_locations(); $$
);

-- ROLLBACK:
--   SELECT cron.unschedule('driver-locations-cleanup');
--   DROP FUNCTION IF EXISTS cleanup_driver_locations();
```

If `pg_cron` is unavailable on the project, document a manual cleanup route at `/api/cron/cleanup-driver-locations` and a Vercel Cron job in `vercel.json`.

---

## 🟡 FIX Y2 — Cash handover reminder banner

### Problem
Driver finishes shift with cash in pocket, forgets to hand over. No prompt.

### Approach
Show a sticky banner in `DriverDashboard` when:
- (a) Driver toggles to offline AND has unsettled cash, OR
- (b) Driver has 4+ unsettled cash orders.

### Code changes

**`src/components/driver/DriverDashboard.tsx`:**

Above the order grid, add:
```tsx
{shouldRemindHandover && (
  <CashHandoverReminderBanner
    unsettledCount={unsettledCashOrders.length}
    unsettledTotal={unsettledTotal}
    onOpenHandover={() => setShowHandover(true)}
    onDismiss={() => setReminderDismissed(true)}
    isRTL={isAr}
  />
)}
```

Logic:
```ts
const unsettledCashOrders = completedOrders.filter(o =>
  o.payments?.method === 'cash' && !o.cash_settled_at)

const shouldRemindHandover =
  !reminderDismissed &&
  (unsettledCashOrders.length >= 4 ||
   (!isOnline && unsettledCashOrders.length > 0))
```

**New file `src/components/driver/CashHandoverReminderBanner.tsx`:**
- Sticky top banner, red accent (`bg-red-500/15 border-red-500/40`).
- Pulse animation, dismiss X.
- AR/EN strings, `min-h-[44px]`.

### Tests
- Driver delivers 4 cash orders → banner appears.
- Driver toggles offline with 1 unsettled cash order → banner appears.
- Driver dismisses → no banner until next delivery.

---

## 🟡 FIX Y3 — Driver shift hours tracking

### Problem
`toggleDriverAvailability` flips `staff_basic.availability_status` but no record of when. No payroll data, no shift hours.

### Approach
Wire `time_entries` (existing table, already has clock_in / clock_out / total_hours).

### Code changes

**`src/app/[locale]/driver/actions.ts` → `toggleDriverAvailability`:**

After updating availability_status, also write to `time_entries`:
```ts
const service = await createServiceClient()

if (next === 'online') {
  // Clock-in: insert open shift
  await service.from('time_entries').insert({
    staff_id: user.id,
    clock_in: now,
    clock_out: null,
  })
} else {
  // Clock-out: close most recent open shift
  const { data: open } = await service
    .from('time_entries')
    .select('id, clock_in')
    .eq('staff_id', user.id)
    .is('clock_out', null)
    .order('clock_in', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (open) {
    const hours = (Date.now() - new Date(open.clock_in).getTime()) / 3_600_000
    await service.from('time_entries')
      .update({ clock_out: now, total_hours: Number(hours.toFixed(2)) })
      .eq('id', open.id)
  }
}
```

**`src/components/driver/DriverHeader.tsx`:**

Add hours-today summary in the performance bar:
```tsx
{hoursToday > 0 && (
  <>
    <span className="w-px h-4 bg-brand-border shrink-0" />
    <div className="flex items-center gap-1.5">
      <ClockMiniIcon />
      <span className="font-satoshi font-black text-sm tabular-nums">
        {hoursToday.toFixed(1)}h
      </span>
    </div>
  </>
)}
```

`hoursToday` = sum of `total_hours` from today's closed entries + (now - clock_in) for the current open entry.

**`src/app/[locale]/driver/page.tsx`:**

Server-side fetch today's `time_entries` for this driver, pass `hoursToday` to `DriverDashboard`.

### Manager view
Manager already has `/dashboard/staff/[id]` — add a "Today's hours" card showing each driver's clocked hours. Out of scope for this commit; create a follow-up task.

### Tests
- Driver toggles online → row appears in `time_entries`.
- Driver toggles offline → same row gets `clock_out` and `total_hours`.
- Driver toggles online, online, online (rapid) → only one open entry.

### Edge cases
- Driver was online from previous day (left online overnight) → on next online toggle, close the previous open entry first, then open new.
- Add a guard in clock-in: if there's an existing open entry, close it with current timestamp first.

---

## 🟡 FIX Y4 — Tips support on cash deliveries

### Problem
Customer adds a tip in cash → no field to record it. Either driver pockets undocumented (lost revenue) or hands over with the principal (lost tip).

### Migration `supabase/migrations/039_tips.sql`

```sql
-- 039_tips.sql

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tip_bhd NUMERIC(10,3) NOT NULL DEFAULT 0
    CHECK (tip_bhd >= 0);

-- Driver-recorded at delivery time. NOT included in total_bhd; tracked separately.

CREATE INDEX IF NOT EXISTS idx_orders_tip
  ON orders(assigned_driver_id, delivered_at DESC)
  WHERE tip_bhd > 0;

-- ROLLBACK:
--   ALTER TABLE orders DROP COLUMN IF EXISTS tip_bhd;
```

### Code changes

**`src/app/[locale]/driver/actions.ts` → `driverBumpOrder`:**

Add optional `tipBhd` parameter:
```ts
export async function driverBumpOrder(
  orderId:       string,
  currentStatus: 'ready' | 'out_for_delivery',
  tipBhd?:       number,   // ← NEW: only meaningful for delivered transition
): Promise<DriverActionResult>
```

When transitioning to `delivered` and `tipBhd && tipBhd > 0`:
```ts
if (currentStatus === 'out_for_delivery' && tipBhd && tipBhd > 0) {
  if (tipBhd > 50) return { error: 'Tip exceeds maximum (50 BD)' } // sanity bound
  orderUpdate.tip_bhd = tipBhd
}
```

**`src/components/driver/DriverOrderCard.tsx`:**

In the cash-delivery confirmation step, add an optional tip input:
```tsx
{confirmDeliver && isCash && (
  <div className="...">
    <p>تأكيد: هل استلمت {total} BD نقداً؟</p>
    <label>
      إكرامية إضافية؟ (اختياري)
      <input
        type="number"
        step="0.100"
        min="0"
        max="50"
        value={tipBhd}
        onChange={e => setTipBhd(Number(e.target.value) || 0)}
      />
    </label>
    <button onClick={() => handleDeliver(tipBhd)}>نعم، تم التسليم ✓</button>
  </div>
)}
```

Plumb `tipBhd` through `handleDeliver` → `onAction(orderId, 'out_for_delivery', tipBhd)` → `driverBumpOrder(..., tipBhd)`.

**`src/components/driver/CashHandoverModal.tsx`:**

In the breakdown, show tip per order if present:
```tsx
{Number(o.total_bhd).toFixed(3)} BD
{o.tip_bhd > 0 && (
  <span className="text-emerald-400 ms-1">+{o.tip_bhd.toFixed(3)} tip</span>
)}
```

`submitCashHandover` should sum `total_bhd + tip_bhd` from DB for the authoritative cash collected.

**`src/app/[locale]/dashboard/delivery/cash-reconciliation/page.tsx`:**

Show tip total per handover. Manager reconciles against `total_cash + tips`.

### Tests
- Driver delivers cash 5.000 BD with tip 0.500 → orders.tip_bhd = 0.500.
- Cash handover sums to 5.500 BD.
- Manager reconciles → 5.500 BD expected.

---

## PHASE-GATE CHECKLIST (run BEFORE each commit)

From `CLAUDE.md` — all 9 must pass:

```bash
# 1. TypeScript
npx tsc --noEmit

# 2. RTL violations
grep -rn "\bpl-\|\bpr-\|\bml-\|\bmr-\|padding-left\|padding-right\|margin-left\|margin-right" \
  app/ components/ lib/ --include="*.tsx" --include="*.ts" --include="*.css"

# 3. Forbidden fonts
grep -rn 'Inter\|Poppins\|Nunito\|Montserrat\|Raleway\|Roboto' app/ components/ --include="*.tsx" --include="*.ts"

# 4. Forbidden colors
grep -rn 'purple\|violet\|indigo\|yellow-[0-9]\|amber-[0-9]' app/ components/ --include="*.tsx"

# 5. Currency violation
grep -rn 'BHD' app/ components/ --include="*.tsx"

# 6. Hardcoded phone numbers
grep -rn "97317\|wa\.me/" src/ app/ components/ --include="*.tsx" --include="*.ts" \
  | grep -v "src/constants/contact.ts" | grep -v "src/lib/whatsapp.ts"

# 7. Raw hex colors in components
grep -rn "#[0-9a-fA-F]\{6\}" app/ components/ --include="*.tsx" --include="*.ts"

# 8. i18n completeness
npx ts-node scripts/check-i18n.ts 2>/dev/null || echo "Warning: check-i18n script not yet created"

# 9. Build check
npm run build
```

Then:

```bash
git add -A
git commit -m "<conventional commit message>"
git push
```

---

## COMMIT MESSAGE TEMPLATES

```
fix(driver): allow multiple cash handovers per shift

- migration 035: driver_cash_handover_orders link table with unique(order_id)
- submitCashHandover: removed duplicate-shift_date check
- DriverDashboard: filter unsettled cash orders for handover modal
- backfill: existing handovers populate link table
```

```
fix(driver): enforce arrived_at before delivered transition

- driverBumpOrder: reject delivered transition when arrived_at IS NULL
- DriverOrderCard: translate new error to AR/EN
- analytics no longer corrupted by skipped arrival timestamps
```

```
feat(orders): link cash settlement to orders table

- migration 036: orders.cash_settled_at + orders.cash_settlement_id
- backfill from driver_cash_handover_orders
- submitCashHandover writes settlement metadata to orders
- DriverDashboard simplified: filter by orders.cash_settled_at IS NULL
```

```
feat(reconciliation): manager discrepancy workflow

- migration 037: actual_received, discrepancy (generated), reconciliation_status
- reconcileCashHandover server action with tolerance + notes requirement
- CashReconciliationClient: amount input + status badges + delta display
- audit log entry per reconciliation
```

```
perf(driver): GPS only when active delivery + retention cleanup

- DriverDashboard: GPS effect requires out_for_delivery order
- postDriverLocation: 15s rate limit per driver
- migration 038: pg_cron daily cleanup of driver_locations >7 days
```

```
feat(driver): cash handover reminder banner

- CashHandoverReminderBanner component with pulse + dismiss
- triggers on 4+ unsettled cash orders or going offline with cash
```

```
feat(driver): clock-in/clock-out via toggleDriverAvailability

- writes to existing time_entries table on online/offline toggle
- closes orphaned open entries on re-clock-in
- DriverHeader shows hours-today
```

```
feat(orders): tip support on cash deliveries

- migration 039: orders.tip_bhd column
- driverBumpOrder accepts optional tipBhd on delivered transition
- DriverOrderCard: optional tip input in cash confirmation
- CashHandoverModal + reconciliation surface tips separately
```

---

## DO NOT

- Do NOT bundle multiple fixes into one commit.
- Do NOT skip the phase-gate checks "because it's a small change".
- Do NOT add new fonts, colors, or `BHD` strings.
- Do NOT use `pl-/pr-/ml-/mr-` — use `ps-/pe-/ms-/me-`.
- Do NOT hardcode phone numbers.
- Do NOT regenerate Supabase types via `supabase gen types` without confirming with the human first — manual updates to `custom-types.ts` are preferred.
- Do NOT mark `.agent/phase-state.json` updated unless ALL listed fixes in this document are completed.

---

## ON COMPLETION

After all 8 commits land:

1. Update `.agent/phase-state.json`:
   - `last_updated` to today + session number.
   - `applied_db_migrations` to include 035, 036, 037, 038, 039.
   - `last_git_commit` to the final commit SHA.

2. Update `.agent/LAST-SESSION.md` with:
   - Summary of all 8 fixes.
   - Any deviations from this spec (and why).
   - Outstanding follow-ups (e.g., manager hours dashboard for Y3).

3. Push final commit. Vercel auto-deploys.

4. Output a final SESSION END block summarizing:
   - Migrations applied: 035, 036, 037, 038, 039 (5 new).
   - Build pages (expect ~785, possibly +2 for new routes).
   - Phase-gate: 9/9 PASS.
   - Awaiting human acceptance test on production.
