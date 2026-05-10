# Driver and Delivery Audit - 2026-05-10

Scope:
- `src/app/[locale]/dashboard/delivery/**`
- `src/app/[locale]/driver/**`
- `src/components/delivery/**`
- `src/components/driver/**`
- Related server actions, RLS policies, realtime subscriptions, offline/PWA support

Notes:
- Read-only audit. No application code was changed.
- Source-backed findings only; no live Supabase SQL was executed in this pass.
- Realtime cleanup is present in the inspected client components: driver dashboard clears interval, location watch, online listener, and Supabase channel; delivery dashboard removes all three Supabase channels.
- Driver self-claim from another branch is blocked in the normal server action path for branch-scoped drivers, but service-role and non-driver-manager paths still have issues below.
- Empty states exist for the driver pickup/completed sections and delivery kanban/list views.

## Security

| # | File:Line | Severity | Category | Issue | Fix |
|---|-----------|----------|----------|-------|-----|
| 1 | `src/lib/auth/rbac.ts:167` | B | Security | Non-driver manager roles can access `/driver`. `canAccessDriver` allows `branch_manager` and above, and the driver layout renders the driver page under a dashboard shell for those users. | Split driver PWA access from manager monitoring. Make `/driver` operational mutations driver-only, or provide a read-only manager view that cannot call driver actions. |
| 2 | `src/app/[locale]/driver/actions.ts:7` | B | Security | Driver actions explicitly allow `branch_manager`, `general_manager`, and `owner`. In `driverBumpOrder`, a manager can claim a ready order and write their own staff id to `assigned_driver_id`, even though they are not a driver. | Restrict `driverBumpOrder`, `markDriverArrived`, and driver failure/report actions to `user.role === 'driver'` unless a separate manager action is intentionally designed and audited. |
| 3 | `src/app/[locale]/driver/actions.ts:146` | B | Security | `postDriverLocation` uses the service role and trusts client-supplied `order_id`. It overwrites `driver_id` but never verifies the order is assigned to this driver, is `out_for_delivery`, or belongs to the driver's branch. | Fetch the order before upsert and require `assigned_driver_id = user.id`, `status = 'out_for_delivery'`, and matching branch. Reject all other `order_id` values. |
| 4 | `supabase/migrations/042_dashboard_security_hardening.sql:68` | B | Security | The current dashboard order update RLS allows branch `cashier` and `kitchen` users to update branch orders directly through Supabase. That can bypass delivery server actions and mutate `status`, `assigned_driver_id`, or delivery timestamps if they use the client API directly. | Move status/driver mutations behind RPCs with role and transition checks, or restrict direct `orders` update RLS to the exact roles and columns required. |
| 5 | `src/app/[locale]/driver/page.tsx:51` | B | Security | Driver PWA ready-order query does not filter `order_type = 'delivery'`. Drivers can see and claim ready pickup or dine-in orders in their branch because the claim action also does not validate `order_type`. | Add `order_type = 'delivery'` to driver ready-order queries and validate it inside `driverBumpOrder` before assignment. |
| 6 | `src/app/[locale]/driver/push-actions.ts:105` | W | Security | `sendPushToDriver` is exported from a `use server` module, uses the service role, and has no auth guard. It is currently only imported by server delivery actions, but if it is ever imported by a client component it becomes an unguarded push-send action. | Keep it internal to server-only code, or add a manager-role guard and driver-branch validation before reading subscriptions. |
| 7 | `src/app/[locale]/dashboard/delivery/actions.ts:113` | W | Security | `unassignDriver` uses service role and validates branch, but it does not validate the current order status before clearing assignment. A manager can unassign and reset any branch order to `ready`. | Restrict unassign to `ready` or `out_for_delivery` orders and verify affected row count. |
| 8 | `src/app/[locale]/dashboard/delivery/actions.ts:230` | W | Security | `reassignDriver` validates the new driver and branch but does not restrict the current order status. Managers can reassign delivered, cancelled, or otherwise terminal orders if they know the id. | Require an active delivery status such as `ready` or `out_for_delivery`, and scope the update by the fetched status. |

## Runtime Bugs

| # | File:Line | Severity | Category | Issue | Fix |
|---|-----------|----------|----------|-------|-----|
| 9 | `src/components/driver/DriverDashboard.tsx:168` | W | Runtime Bugs | GPS location updates call `postDriverLocation(...)` without `await`, `catch`, or result handling. If the server action rejects or returns `{ success: false }`, the UI still shows tracking and the failed write can become an unhandled rejection. | Await the call, handle `success: false`, and set `gpsStatus = 'error'` with a retry/backoff path. |
| 10 | `src/components/delivery/DeliveryPageClient.tsx:109` | W | Runtime Bugs | Delivery dashboard refresh queries ignore Supabase errors. `refreshOrders` and `refreshDrivers` only inspect `data`, so DB/RLS/realtime failures silently leave stale state. | Destructure `error` for each query and surface a recoverable dashboard error banner. |
| 11 | `src/app/[locale]/dashboard/delivery/page.tsx:53` | W | Runtime Bugs | Server-rendered delivery page ignores errors for active orders, completed orders, drivers, and driver locations. A failed fetch renders empty/stale metrics instead of an error state. | Handle query errors and render a delivery-specific failure state. |
| 12 | `src/app/[locale]/dashboard/delivery/loading.tsx:1` | W | Runtime Bugs | `/dashboard/delivery` has a loading file but no local `error.tsx`. Unexpected render exceptions fall to a parent/global boundary rather than a delivery-specific recovery UI. | Add `src/app/[locale]/dashboard/delivery/error.tsx`. |
| 13 | `src/components/delivery/DispatchModal.tsx:66` | W | Runtime Bugs | `handleAssign` awaits the server action without `try/catch`. A thrown network/action error leaves the modal in a failed path not covered by `translateDispatchError`. | Wrap the call in `try/catch/finally`, reset loading, and show a localized transient error. |
| 14 | `src/components/driver/IssueReportModal.tsx:34` | W | Runtime Bugs | Issue and delivery-failure modals await server actions without `try/finally`. If the action throws, `busy` can remain true and the modal becomes stuck. | Use `try/catch/finally` around the server action and always clear `busy`. |
| 15 | `public/sw.js:86` | W | Runtime Bugs | The service worker defines a Background Sync tag and its own IndexedDB queue, but the app never registers `driver-status-sync` and driver actions are stored in a separate `KahramanaOfflineDB` store. Background sync code is effectively dead unless the page is open and the `online` listener runs. | Use one queue and register `registration.sync.register('driver-status-sync')`, or remove SW sync and make the page-level online replay explicit. |
| 16 | `src/hooks/usePushNotifications.ts:75` | W | Runtime Bugs | Push permission flow awaits `Notification.requestPermission()`, `navigator.serviceWorker.ready`, and subscription without a top-level `try/catch`. Service worker readiness failures can reject the button handler. | Wrap `requestPermission` in `try/catch` and expose an error state in the PWA shell. |

## Data Integrity

| # | File:Line | Severity | Category | Issue | Fix |
|---|-----------|----------|----------|-------|-----|
| 17 | `src/app/[locale]/driver/actions.ts:386` | B | Data Integrity | `reportDeliveryFailure` lets owner/general manager skip the assigned-driver and `out_for_delivery` checks. A global manager can mark any order as `delivery_failed`, regardless of current status. | Keep global branch override separate from workflow validation. Require `status = 'out_for_delivery'` for every caller and require an assigned driver unless using a dedicated manager override with audit reason. |
| 18 | `src/app/[locale]/driver/actions.ts:78` | B | Data Integrity | `actualCollected` is trusted from the client and only rounded. A tampered call can submit a negative or non-finite collected amount when delivering a cash order. | Validate `Number.isFinite(actualCollected)`, require `actualCollected >= 0`, and clamp/store exactly 3 decimal places server-side. |
| 19 | `src/app/[locale]/dashboard/delivery/actions.ts:64` | W | Data Integrity | Manager dispatch immediately sets `status = 'out_for_delivery'` and `picked_up_at = now`. This records pickup at assignment time, not when the driver actually picks up the order. | Separate assignment from pickup, or require driver pickup confirmation before setting `picked_up_at` and moving to `out_for_delivery`. |
| 20 | `src/app/[locale]/dashboard/delivery/actions.ts:187` | W | Data Integrity | `confirmDelivery` only requires `status = 'out_for_delivery'`. It does not require an assigned driver or `arrived_at`, and the update is not scoped by current status after the fetch. | Require `assigned_driver_id IS NOT NULL`, require `arrived_at` if that is the workflow, and update with `.eq('status', 'out_for_delivery')`. |
| 21 | `src/app/[locale]/driver/actions.ts:108` | W | Data Integrity | `markDriverArrived` validates status and assignment before update, but the update only scopes by `id`. A concurrent delivery/unassign after fetch can still receive `arrived_at`. | Add `.eq('status', 'out_for_delivery')` and `.eq('assigned_driver_id', user.id)` or an equivalent manager override predicate to the update. |
| 22 | `src/app/[locale]/dashboard/delivery/actions.ts:127` | W | Data Integrity | `unassignDriver` does not verify affected row count and does not pin the update to a current active status. A no-op or stale update can still return success. | Add active-status predicates and select affected rows, returning conflict if no row changed. |
| 23 | `src/app/[locale]/dashboard/delivery/actions.ts:144` | W | Data Integrity | `cancelDeliveryOrder` validates a cancellable status before update, but the update is not scoped by that status. A race can cancel an order after it was delivered by another request. | Add `.eq('status', order.status)` and check affected rows before returning success. |
| 24 | `src/app/[locale]/dashboard/delivery/actions.ts:230` | W | Data Integrity | `reassignDriver` can move assignment without preserving or recalculating pickup/arrival timestamps. Reassigning an in-transit order leaves old `picked_up_at`/`arrived_at` semantics attached to the new driver. | Decide whether reassignment preserves pickup history; if not, reset arrival/pickup timestamps or store assignment history in a separate table. |
| 25 | `src/components/driver/DriverDashboard.tsx:211` | W | Data Integrity | Offline replay stores only `orderId`, `currentStatus`, and metadata. If a queued delivery action replays much later, the server may reject it, but the driver only sees a pending count, not which order failed or why. | Store last error per queued action and show a retry/discard UI when replay fails permanently. |

## UX / Functional

| # | File:Line | Severity | Category | Issue | Fix |
|---|-----------|----------|----------|-------|-----|
| 26 | `src/components/delivery/DeliveryPageClient.tsx:97` | B | UX / Functional | Client-side refresh omits the server page's delivery-only filter. Initial page load excludes pickup orders, but realtime refresh fetches active orders without `order_type` and can show pickup/dine-in orders on the delivery board. | Select `order_type` and filter `order_type = 'delivery'` in every delivery-board refresh path. |
| 27 | `src/app/[locale]/dashboard/delivery/page.tsx:44` | W | UX / Functional | Initial delivery board excludes only pickup orders with `.neq('order_type', 'pickup')`, so dine-in orders can still enter the delivery dispatch board if they reach an active status. | Use `.eq('order_type', 'delivery')` for delivery operations. |
| 28 | `public/manifest.json:5` | W | UX / Functional | Installed staff PWA starts at `/ar/dashboard`, not the driver app. Drivers installing from `/driver` may reopen into the dashboard route instead of the driver workflow. | Use a driver-specific manifest or set the driver install surface start URL to `/ar/driver`. |
| 29 | `public/sw.js:9` | W | UX / Functional | Offline fallback is hardcoded to `/ar/driver/offline`. English driver navigations offline still land on the Arabic fallback path. | Choose fallback by request pathname locale or precache and route to `/en/driver/offline` for English requests. |
| 30 | `src/components/driver/DriverPWAShell.tsx:116` | W | UX / Functional | The PWA shell shows an offline banner, but navigation fallback and action replay are not connected to a detailed offline action queue UI. Drivers can see "syncing N actions" but not which orders are pending or failed. | Add a queue detail panel with order refs, action type, last error, retry, and discard controls. |
| 31 | `src/components/delivery/DeliveryPageClient.tsx:214` | I | UX / Functional | Delivery realtime subscriptions are cleaned up, but they subscribe to all `orders`, `driver_locations`, and `staff_basic` changes. Branch-scoped users still trigger refresh work for unrelated realtime events. | Add realtime filters where possible and debounce/coalesce refreshes. |
| 32 | `src/components/delivery/DeliveryKanban.tsx:257` | I | UX / Functional | Manager kanban card action buttons do not have async disabled state at the card level for unassign/cancel. The server protects most races, but users can double-click and create duplicate prompts/requests. | Track pending action per order id and disable related card actions while a request is in flight. |

## Top 5 Critical Fixes

1. Make driver PWA mutations driver-only. Managers should not be able to claim orders as themselves or use driver delivery actions.
2. Harden `postDriverLocation` so a driver can only write GPS rows for their own assigned `out_for_delivery` order.
3. Filter driver and delivery boards to `order_type = 'delivery'` everywhere, including realtime/client refresh paths and the driver claim action.
4. Tighten direct `orders` update RLS so cashier/kitchen/direct client calls cannot bypass delivery status and assignment server actions.
5. Add server-side workflow validation for delivery failure, unassign, reassign, confirm delivery, and cash collection amounts, with status predicates and affected-row checks.
