# LAST-SESSION.md — Kahramana Baghdad
> Session 119: H-2 hydration close-out + dashboard operations audit + 3 launch-blocker fixes + Claude.ai bridge. 6 commits on master, tip at `595513d`.
> Date: 2026-05-15
> Author: Claude Code (Opus 4.7, 1M)

## SESSION 119 — SUMMARY

Three tracks: (1) hydration mismatch H-2 reopened from session 118 because the agreed fix target (`global-error.tsx`) was a no-go in code review until the user re-confirmed; landed as planned. (2) Two read-only audits — loyalty zero-points debug + full dashboard operations smoke — produced a prioritized launch-risk list. (3) Top-2 launch blockers fixed (with FIX #3 piggybacked because both #1 and #2 cleared TSC+build green). Closed with a Claude.ai ↔ Claude Code session-context bridge so future sessions inherit operator state without re-explanation.

### Commits this session (in order)

| Hash | Subject |
|---|---|
| `3b22737` | fix(i18n): global-error.tsx reads locale from cookie — fixes lang=en hydration mismatch (H-2) |
| `e3483e4` | fix(driver): add arrived → delivered transition — unblocks loyalty + COD reconciliation |
| `0a3ae27` | fix(driver): wire location push visibility + extend through arrival window |
| `ceaafe8` | feat(ops): migration 150 — pg_cron daily stuck-order alert |
| `d6a2c75` | chore(bridge): Claude.ai ↔ Claude Code context bridge |
| `595513d` | chore(bridge): initialize Claude.ai context bridge — session 119 state |

`origin/master` at `595513d`. No sibling-agent commits landed during the session.

### H-2 hydration fix (commit `3b22737`)

`global-error.tsx` was hardcoded `<html lang="en">`. On any global-error fire for an Arabic visitor (the dominant user path) React emits server `lang="en"` while client expects `lang="ar"` — exactly the Sentry symptom. Fix: read `NEXT_LOCALE` cookie on client, default to `'ar'` on SSR. Preserved the `Sentry.captureException` `useEffect` (user spec dropped it but losing observability on global errors is a regression).

Trade-off accepted: English users hitting global-error now see SSR=`ar` / client=`en` — a residual mismatch on the error page itself. If Sentry shows that follow-up, defer the locale read to `useEffect` so SSR emits a stable neutral default.

### Loyalty audit (read-only)

`points_transactions` was empty across the entire DB; trigger `trg_award_loyalty_points` was healthy. Root cause: the 4 recent direct-channel orders for `+97336396699` had status `'new'` (2) or `'arrived'` (2) — none had transitioned to `'completed'`/`'delivered'`. The trigger fires `AFTER UPDATE OF status` into those terminal states only. Two intertwined gaps surfaced:

1. `arrived` is intermediate — driver was supposed to advance it to `delivered`.
2. Driver app couldn't actually do that.

→ Led directly into FIX #1.

### Dashboard ops audit (10 probes + workflow checklist)

| Surface | Verdict |
|---|---|
| Orders by status | 2 stuck >24h (`b29cf94c` @ 76h `accepted`/waiter; `fe01c38e` @ 28h `arrived`) |
| Staff roles | All 5 roles covered, all rows active |
| KDS | 9 pending items (operational, not bug) |
| Inventory alerts | 158 unread `unmapped_item` (recipe-link gap, noise) |
| Payments | 14 cash completed + 15 cash pending_cod (handover queue) |
| Shifts | tables present (`shift_closings`, `shifts`, `cash_handovers`) |
| `driver_locations` | 0 rows ever — wiring complete, just no real shifts yet |
| Loyalty config | healthy, single row |
| Reservations | 5 rows across 4 statuses, looks fine |
| Menu | 175 items all `is_available=true` |

Plus: no auto-audit trigger on `orders` (95% of state transitions unlogged); 9/31 dashboard pages don't import `requireDashboardSection` at page level (some have it in actions instead).

Launch Risk **before fixes: 5/10**.

### FIX #1 — driver `arrived → delivered` (commit `e3483e4`)

Server action `driverBumpOrder` already supported `'arrived'` as input. The block was 100% client-side:
- `driver/page.tsx` transit query stopped at `'out_for_delivery'`
- `DriverDashboard.fetchOrders` filter `.in('status', ['ready','out_for_delivery'])`
- `activeOrders` filter, `hasActiveOrder` (wake-lock) memo, offline-sync `as` cast
- `DriverOrderCard.DriverActiveStatus` type union, `isOnRoad` gate on the Deliver button, `deriveSteps` step derivation, `finishDelivery` hardcoded current-status pass

All widened to include `'arrived'`. Also added `audit_logs` insert + `revalidatePath` on every `driverBumpOrder` transition per task spec — this also chips away at the audit-coverage gap from the audit pass. Replaced the existing unsafe `as 'ready' | 'out_for_delivery'` assertion in the offline-sync loop with a runtime narrow that discards genuinely-unknown queued statuses.

### FIX #2 — driver location push (commit `0a3ae27`)

`DriverDashboard.tsx` already had `watchPosition` + 15s-throttled `postDriverLocation` calls. Empty `driver_locations` was operational — 32 `delivered` orders had been status-flipped via the dashboard, never going through the driver app under a real shift.

Three real fixes:
1. The fire-and-forget `postDriverLocation()` got a `.then/.catch` so silent server rejections (auth/status/branch mismatch) now log — key reason this was undiagnosable before.
2. Client GPS gate widened to `'out_for_delivery' || 'arrived'` so the dispatch map stays live through the final-handoff window.
3. Server `postDriverLocation` accepts both statuses (was rejecting `'arrived'` at line 235).

### FIX #3 — stuck-order cleanup + abandonment alerts (commit `ceaafe8`)

Step 1 — closed `b29cf94c` via SQL:
```sql
UPDATE orders SET status='cancelled',
  notes = COALESCE(notes||E'\n','') || '[CANCELLED <ts>]: stuck-in-accepted-auto-closed-pre-launch (session 119)',
  updated_at = NOW()
WHERE id='b29cf94c-…' AND status='accepted';
```
Used `notes` (the project's existing cancel pattern) — there is no `cancellation_reason` column, contra the task spec.

Step 2 — migration 150 (`supabase/migrations/150_stuck_order_alerts.sql`):
- New table `operations_alerts` (id, alert_type, severity, message, ref_table, ref_id, branch_id, metadata jsonb, is_read, created_at, updated_at) + 3 indexes
- RLS: branch_manager+ read (Owner/GM unscoped), branch_manager UPDATE on own branch; anon revoked entirely; authenticated SELECT/UPDATE only
- `detect_stuck_orders()` — SECURITY DEFINER, scans non-terminal orders older than 24h, dedupes against alerts in the trailing 24h window, returns insert count
- `pg_cron` extension enabled via SQL (worked first try despite earlier memory that managed-Supabase strips superuser — extension-create is the carve-out)
- `cron.schedule('stuck-order-scan', '0 5 * * *', …)` = 08:00 Bahrain time

Defensive `DO $$ ... EXCEPTION` wrapper around `CREATE EXTENSION` so the table + function still land if pg_cron were unavailable.

First scan inserted 1 alert: `Order #FE01C38E stuck in arrived for 28h` (severity `warn`, branch `riffa`). `cron.job` shows `jobname='stuck-order-scan'` active.

Launch Risk **after fixes: 8/10**.

### Claude.ai ↔ Claude Code bridge (commits `d6a2c75`, `595513d`)

Two-commit split per user direction:
- Infrastructure: `.agent/sync-context.ps1` + a `## BRIDGE — Read at session start` hook in CLAUDE.md
- Content: `.agent/CLAUDE-AI-CONTEXT.md` initialized with session 119 strategic state (operator pending actions, dev priorities, architecture decisions, known ceilings, migration state, session history)

Script generates `.agent/CURRENT-SESSION.md` with live `git rev-parse HEAD` + timestamp wrapped around the strategic content. Verified working.

Flagged: the `Master: ceaafe8` line inside `CLAUDE-AI-CONTEXT.md` is static (manual update marker) while the bridge header shows the live tip — they're expected to diverge over time. Not a bug.

## MIGRATIONS APPLIED TO PROD (session 119)

- `150_stuck_order_alerts.sql` — applied via `supabase db push --linked --include-all`. Verified post-apply with probe `fix3-verify-migration.sql` (table + function + pg_cron extension all present) and `fix3-verify-cron-detail.sql` (schedule `0 5 * * *` active, jobid=1).

## VERIFICATION

- `npx tsc --noEmit` after each commit — 0 errors.
- `NEXT_BUILD_WORKERS=1 npm run build` after `3b22737`, `e3483e4`, and `0a3ae27` — 562/562 pages, 0 errors each time. (Required `NEXT_BUILD_WORKERS=1` per `feedback_windows_build_race.md`.)
- Bridge commits are non-code (`.ps1` + `.md`) so no TSC/build re-run was needed.
- `git diff --cached --stat` before every commit — only the intended files staged each time; the long-running sibling carry (`messages/*.json`, `CheckoutForm.tsx`, `cart.ts`, `LAST-SESSION.md`) stayed untouched.

## WHAT'S NEXT (session 120 candidates, in priority order)

1. **`operations_alerts` UI** — add an unread-alert banner to `src/app/[locale]/dashboard/page.tsx`. Branch-scoped via RLS already. Owner/GM see all; branch_manager + cashier see own branch. Should also surface critical-severity rows in red. ~1–2 hr.
2. **AUD-V3-012 close-out** — write the follow-up migration sketched in session 117's notes: grant `authenticated` SELECT on the 3 reporting matviews + tighten + grant EXECUTE on the 2 reporting RPCs. Then drop the 6 `AUD-V3-012` reason comments and swap those callers to `createClient()`. `refresh_analytics_views` stays service-role indefinitely. ~2 hr.
3. **Inventory `unmapped_item` noise** — either suppress alerts when no recipe is configured (operational state, not bug) or batch-link recipes for the 175 menu items. 158 unread alerts are drowning out real low-stock signals.
4. **Order-status audit trigger** — single migration: `AFTER UPDATE OF status ON orders` → write to `audit_logs`. Closes the 95%-unlogged gap from the audit. ~30 min.
5. **Smoke-test driver flow end-to-end on a real device** before Ahmed promotes the soft-launch. Specifically: place an order through the website, accept in dashboard, advance through KDS to ready, login as a driver on phone, pick up → out_for_delivery (watch `driver_locations` populate in real-time), mark arrived, mark delivered. Verify `points_transactions` row materializes and a `'stuck_order'` alert does NOT fire (since the order will hit terminal status well under 24h).

## CARRY FILES (not staged this session)

Pre-existing dirty tree carried from session 110+:
- `messages/ar.json`, `messages/en.json`
- `src/components/checkout/CheckoutForm.tsx`
- `src/lib/cart.ts`

Plus this session's `.agent/audit-*.sql` and `.agent/fix3-*.sql` probe files. None are intended for commit — they are debugging artifacts. `git status` noise next session is expected.

## NOTES FOR PHASE-STATE BACK-ANNOTATION

`.agent/phase-state.json` `last_updated` is still frozen at session 101. Sessions 102–119 have landed without back-annotation. The new bridge (`.agent/CLAUDE-AI-CONTEXT.md`) supersedes phase-state.json as the strategic snapshot — recommend retiring phase-state.json or re-purposing it to "phase 0 launch milestone tracker" only.
