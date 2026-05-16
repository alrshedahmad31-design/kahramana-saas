# LAST-SESSION.md — Kahramana Baghdad
> Session 129: Points-cap UX + cart drawer + driver realtime notifications + supabase client hardening. Master `b2f0555` → `2079f2c`.
> Date: 2026-05-16
> Author: Claude Code (Opus 4.7, 1M context)

## SESSION 129 — SUMMARY

Four commits on master, all pushed. No migrations. All gates clean on
every commit: `npx tsc --noEmit`, `npx tsx scripts/check-i18n.ts` (where
i18n keys changed), `NEXT_BUILD_WORKERS=1 npm run build`. One
out-of-band local environment fix (env file copy) that surfaced from a
checkout-page runtime error mid-session.

Theme: small, scoped UX fixes the user reported one-at-a-time, plus a
genuine audit task (driver notifications) that landed a real feature.
The supabase client hardening was a side-effect of the runtime error
investigation — the actual root cause was a missing `.env.local` in
the fresh tree.

## COMMITS (4 on master, all pushed)

| Hash | Type | Summary |
|------|------|---------|
| `0ae1d6d` | fix(checkout) | **Points redemption auto-cap.** Client used to redeem the full points balance value (`pointsToCredit(balance)`); server rejected with `points_over_cap` when that exceeded 50% of subtotal. UI promised a saving the server then refused. Wired `maxRedeemablePoints(balance, subtotal)` (already existed in `src/lib/loyalty/calculations.ts`) into `CheckoutForm.tsx`. New `cappedPointsToRedeem` + `pointsCapped` drive both the in-page line item AND the value sent to `createOrderWithPoints`. `LoyaltyRedemptionWidget` now takes `appliedCreditBhd` + `capped`; shows the actually-applied amount in the "saving" row plus a subtle bilingual note when capped. New i18n key `checkout.loyalty.cappedNote` (AR + EN). Widget gate also requires `cappedPointsToRedeem >= MIN_REDEMPTION` so tiny carts (sub-BHD 2) don't show a redemption that would fail the min-redemption check server-side. |
| `efe68b1` | fix(supabase) | **Actionable error when `NEXT_PUBLIC_SUPABASE_*` env vars are missing.** `src/lib/supabase/client.ts` was using `process.env.NEXT_PUBLIC_SUPABASE_URL!` then immediately `url.includes('/rest/v1')` — when the var was undefined, the client crashed with `Cannot read properties of undefined (reading 'includes')`. Added an explicit presence check that throws a clear message pointing at `.env.example`. Triggered by a runtime error in `CheckoutForm.loadBranchSupport` on the user's local dev. Root cause was an out-of-band local-env issue (see Infra Notes), but the harder failure mode is worth keeping. |
| `22f7071` | fix(cart) | "إضافة المزيد" (Add more) button in `CartDrawer.tsx` was navigating to `/menu` even when the user was already on a non-empty menu page. Changed `onClick={() => { closeCart(); router.push('/menu') }}` → `onClick={closeCart}` so the drawer just closes and the user stays on whatever page they were browsing. Intentionally left intact: empty-cart "browseMenu" still navigates to `/menu` (needs a way to find items from a non-menu page), and the checkout CTA still routes to `/checkout`. `useRouter` import kept — still used by both. |
| `2079f2c` | feat(driver) | **Sound + visual notifications for new delivery orders.** Audit found existing scaffolding — Web Audio synth `playBell('ready')` from `src/lib/audio/bells.ts` (no audio files needed), `useAudioAlert` hook, realtime channel on `orders`, Web Push subscription via service worker. Gaps: one-shot sound (didn't repeat), no in-page Notification API alert, no visual cue on the new card. Added `unacknowledgedIds` Set in `DriverDashboard.tsx` — populated when `fetchOrders` detects a new ready row, drained when the driver taps the card. Drives (a) an 8s interval that replays the bell while the set is non-empty (respects mute + online state), (b) `fireBrowserNotification` using the existing `Notification.permission` grant from `usePushNotifications`, (c) a new `isUnacknowledged` prop on `DriverOrderCard` that adds `ring-2 ring-brand-gold ring-offset-2 ring-offset-brand-black animate-pulse` and an outer `onPointerDown` to call `onAcknowledge(order.id)`. No new dependencies. No audio files added. |

## INFRA NOTES

- **`.env.local` was missing in `kahramana-Saas-fresh\`.** Surfaced
  when a runtime error on `/checkout` traced back to
  `NEXT_PUBLIC_SUPABASE_URL` being undefined. The user's working
  `.env.local` (with real Supabase creds) still lived at the old
  `kahramana-Saas\.env.local` and wasn't carried into the fresh
  clone because `.env*` is gitignored. Copied
  `kahramana-Saas/.env.local` → `kahramana-Saas-fresh/.env.local`
  with user approval. Memory `project_working_directory_moved.md`
  appended with the "gitignored runtime files don't migrate via git"
  lesson — checked once into memory so this doesn't bite again on
  any future fresh-clone migration.
- **No new env vars introduced** by any of the four commits.
- **No migrations.** Local↔Remote still paired at 162.

## KEY DECISIONS / JUDGMENT CALLS

1. **Auto-cap rather than warn-then-block.** Could have shown the
   full points value and warned "exceeds 50% cap — adjust manually."
   Auto-cap is friendlier: the UI never promises a saving the
   server will refuse. Server-side check is unchanged — it's still
   the source of truth; the client just stops asking for too much.

2. **Sub-2-BHD carts hide the redemption widget entirely.** If
   `cappedPointsToRedeem < MIN_REDEMPTION` (200 points), the
   server's min-redemption check would reject any attempt. Easier
   to gate the widget than to show "you can't redeem here" copy.

3. **`isUnacknowledged` clears on `onPointerDown`, not on any action
   button.** Driver may want to look at the card details before
   acting. Pointer-down on any part of the card is enough; doesn't
   require pressing "Picked up."

4. **Browser Notification reuses `usePushNotifications` permission
   grant.** `Notification.permission` is shared across all
   notification APIs in the browser. Web Push permission was
   already requested via the existing gold banner in
   `DriverPWAShell.tsx`. No second prompt; if push was granted,
   in-page Notification works too.

5. **Bell respects mute, browser Notification does not.** Mute is
   for audio. Visual cue + browser notification stays on for
   accessibility (driver in headphones-off mode still gets the
   visual signal).

6. **`supabase/client.ts` hardening kept even though root cause was
   environmental.** The crash message `Cannot read properties of
   undefined (reading 'includes')` is hostile — it points at the
   wrong place. The new throw points operators directly at
   `.env.example`. Cheap defensive change.

## VERIFICATION

- `npx tsc --noEmit` → clean (4 times, one per commit)
- `npx tsx scripts/check-i18n.ts` → 2,393 = 2,393 (post-cappedNote)
- `NEXT_BUILD_WORKERS=1 npm run build` → green (4 times)
- Driver-fix commit: no manual e2e on the realtime path; logic is
  pure with the existing realtime channel as the trigger source.

## DEFERRED / OPERATOR-PENDING

(unchanged from session 128 — recap)
- `SESSION_BIND_SECRET` env var on Vercel prod + preview.
- `SENTRY_AUTH_TOKEN` re-rotation.
- Supabase Free → Pro + Singapore migration.
- DNS kahramanat.com → Vercel (confirmed done in master notes;
  no action this session).
- TAP keys (merchant approval pending).
- `NEXT_PUBLIC_ENABLE_QR_LOYALTY_SCAN` flip when staff accounts
  go live — pre-flip checklist documented in `.env.example`.
- Birthday gift cron + idempotency + `loyalty_config.birthday_bonus_points`.
- Chef Excel recipe import (0/168 recipes mapped).
- `SetPasswordClient.tsx` dead-code cleanup.

## OPERATOR NOTE

- If you migrate machines or re-clone the repo, copy
  `.env.local` (and any other gitignored env files) by hand — they
  don't ride along with `git clone` by design. The new throw in
  `supabase/client.ts` will at least tell you which file to fix.

---
---
---

# Prior session 128 close-out preserved below ↓



## SESSION 128 — SUMMARY

Five commits on master, all pushed. One migration landed (162). All
gates clean on every commit: `npx tsc --noEmit`,
`npx tsx scripts/check-i18n.ts`, and `NEXT_BUILD_WORKERS=1 npm run build`.

Theme: ship a flag-OFF Waiter QR scanner without leaking any UI changes
until staff accounts go live, then immediately close the
data-correctness gap (UUID-prefix collisions on the QR lookup) and
extend RLS so the flag flip is one env-var change away from being safe.
Tail-end of the session caught two unrelated UI regressions reported
mid-session by the user, plus pushed back on a misdiagnosed driver-nav
bug.

## COMMITS (5 on master, all pushed)

| Hash | Type | Summary |
|------|------|---------|
| `3957abe` | feat(waiter) | **QR member scanner — feature-flagged OFF.** New `src/lib/feature-flags.ts` with `ENABLE_QR_LOYALTY_SCAN` (build-time, default `false`). New `lookupMemberByQR()` server action in `src/app/[locale]/waiter/actions.ts` — accepts `KAHRAMANA:KAH-XXXXXX` or `KAH-XXXXXX`, validates 6-hex, role-gated to WAITER_ROLES, 30/min/staff Upstash bucket (NODE_ENV=production gated per `feedback_rate_limit_node_env_gate`). New `src/components/waiter/QRScannerModal.tsx` — dynamic `html5-qrcode` import, rear camera, single-flight latch on first decode, RTL, tier badge via existing `TIER_COLORS` token. Wired into `WaiterOrderClient.tsx` (sidebar header button + resolved-member banner) only when flag enabled. `messages/{ar,en}.json` `waiter.qrScanner.*` keys, parity verified. `html5-qrcode` added to package.json. |
| `c07cbfd` | docs(env) | `.env.example` documents `NEXT_PUBLIC_ENABLE_QR_LOYALTY_SCAN=false` with the pre-flip checklist baked into the comment. |
| `568a6a0` | feat(db) | **Migration 162** — `customer_profiles.membership_id` STORED generated column (`'KAH-' \|\| UPPER(SUBSTRING(id::text, 1, 6))`) + UNIQUE index `idx_customer_profiles_membership_id` + SELECT-only RLS policy `waiter_cashier_read_customer_profiles`. Closes the ~16M-combo collision risk that 6-hex prefix lookup carried. `lookupMemberByQR` switched from `.filter('id::text','ilike','xxxxxx%').limit(2)` to `.eq('membership_id', 'KAH-' + upper).maybeSingle()` over RLS-aware `createClient()` (no more service-role bypass). `MemberLookupResult` lost the `'ambiguous'` code (UNIQUE makes it unreachable). Types regenerated; `Initialising login role…` + `<claude-code-hint />` stripped per `feedback_supabase_gen_types_pollution`. |
| `6babe48` | fix(inventory) | `InventoryAlertsListener` was using `Date.now()` as the React key on toast items. Two realtime `inventory_alerts` INSERTs landing in the same millisecond — or reconnect-replay re-firing buffered events — produced duplicate keys (`1778958646103` was the symptom in the report). Swapped to `crypto.randomUUID()`. DB row identity still on `item.id`; only the per-toast React key changed. |
| `b2f0555` | fix(checkout) | The "Points discount cannot exceed 50% of order subtotal" string was emitted raw-English from two sites in `src/app/[locale]/checkout/actions.ts` (early subtotal-cap check + `POINTS_OVER_CAP` RPC sentinel branch). `CheckoutForm.localizeCheckoutError` only mapped zod field codes, so the top-level `result.error` leaked through `setSubmitError` at line 422 and the `throw new Error()` at line 430. Flipped the contract: server emits the stable code `'points_over_cap'`; client maps via `localizeCheckoutError` + new `checkout.errors.pointsOverCap` i18n key. Both surface points (line 422 + 430) now route `result.error` through the mapper, so any future server code is localized — not just this one. |

## INFRA NOTES

- **Supabase link re-established.** The fresh tree had no
  `supabase/.temp/project-ref`; ran `npx supabase link --project-ref
  wwmzuofstyzworukfxkt` (kahramana-prod). State now stored under
  `supabase/.temp/` in the fresh tree.
- **Migration 015 recovered locally.** `supabase/migrations/015_production_admin.sql`
  was gitignored (`.gitignore:26`) so the fresh clone lacked it; the
  Supabase CLI refused to push 162 because remote tracked 015 with no
  local file. Copied `015_production_admin.sql` from the old
  `kahramana-Saas\` tree to satisfy the check; file remains
  uncommitted (still gitignored).
- **Local↔Remote migrations paired at 162.**
- **`html5-qrcode` added to dependencies** (1 package, 0 vulnerabilities).
- **`.agent/LAST-SESSION.md` had pending uncommitted edits** from
  session 127 close-out at the start of this session. Left in place
  (not staged in any of the five session-128 commits) to avoid
  overwriting the session-127 hand-off. This session's edits sit
  inside the same file (you're reading them now).

## OPERATOR PUSH-BACK (no work delivered, by design)

User asked to add `delivery_lat`/`delivery_lng` to seven `.select()`
calls in `src/app/[locale]/driver/actions.ts` to fix
"`customerNavUrl` falls back to DMS URL." Investigation showed:

  1. `src/app/[locale]/driver/page.tsx` `ORDER_SELECT` already
     includes both columns (line 37).
  2. Every `.select()` in `actions.ts` is **validation-only** —
     `driverBumpOrder`, `markDriverArrived`, `postDriverLocation`,
     `submitDriverIssue`, `reportDeliveryFailure`,
     `uploadDeliveryProof`, `submitHandover`. The fetched `order` is
     read for `order_type` / `status` / `branch_id` / `assigned_driver_id`
     / etc., never returned to the UI.
  3. `DriverOrderCard.tsx:251-253` (commit `20fdf58`, last session)
     already prefers `order.delivery_lat`/`order.delivery_lng` over
     `extractedUrl` from `delivery_address`.

Plausible real causes raised in the reply:
  a. `delivery_lat`/`delivery_lng` are NULL on the offending row
     (creation flow didn't persist coords — manual POS / older
     order / share-URL-only checkout). Worth a `SELECT id,
     delivery_lat, delivery_lng, delivery_address FROM orders
     WHERE id = '<bad order>'`.
  b. Turbopack browser-cache / module-registry staleness — see
     `feedback_turbopack_chrome_chunk_cache` and
     `feedback_turbopack_module_registry_stale`. Ctrl+Shift+R or
     drop `--turbopack` and run `npx next dev` once.

User has not yet replied with the order ID for path (a), so no edit
was made. **If the bug is still happening: please send the order ID
or confirm the cache route.**

## DEFERRED / OPERATOR-PENDING

(unchanged from session 127 — recap for the hand-off)
- `SESSION_BIND_SECRET` env var on Vercel prod + preview
  (`openssl rand -hex 32`).
- `SENTRY_AUTH_TOKEN` re-rotation (regressed; release tagging +
  sourcemap upload 401 on `cef2850` build).
- Supabase Free → Pro + Singapore migration.
- DNS kahramanat.com → Vercel.
- TAP keys (merchant approval pending).
- **`NEXT_PUBLIC_ENABLE_QR_LOYALTY_SCAN`** stays `false` until staff
  accounts (waiter/cashier) are activated. When flipped:
    1. Verify a real customer_profile has the expected
       `membership_id` via Studio.
    2. Re-test the QR scan flow end-to-end on a real device camera.
    3. Confirm RLS policy `waiter_cashier_read_customer_profiles`
       lets a staff session SELECT the row.
- Birthday gift cron + idempotency + `loyalty_config.birthday_bonus_points`.
- Chef Excel recipe import (0/168 recipes mapped — pending since session 38).
- `SetPasswordClient.tsx` dead-code cleanup (orphaned since session 101).

## CANDIDATE NEXT LANES (none are launch blockers)

- Diagnose the driver `customerNavUrl` complaint with a real
  order ID once the user replies.
- Apply the same `localizeCheckoutError` routing to the *other* raw
  English server errors in `src/app/[locale]/checkout/actions.ts`
  (Minimum redemption, Insufficient points balance, Coupon invalid,
  PRICE_MISMATCH, AUTH_REQUIRED, Customer session required, Order
  creation failed). Same pattern; cheap. Not in scope this session
  because the bug report named only the 50% cap message.
- Birthday gift cron follow-up.
- Inventory page banner: "0/168 recipes mapped — chef Excel import pending".

---
---
---

# Prior session 127 close-out preserved below ↓


## SESSION 127 — SUMMARY

Three commits on master, all pushed. One migration landed (161). No
regressions: tsc + `NEXT_BUILD_WORKERS=1 npm run build` clean on both
the migration commit and the driver-fix commit.

Mid-session discovery: the working copy at `kahramana-platform\kahramana-Saas\`
had lost its `.git` directory (cause unknown — probably an accidental
unzip-over-tree from one of the `.zip` files in the parent folder).
User created a fresh clone at `kahramana-platform\kahramana-Saas-fresh\`
and instructed all future work to happen there. Memory updated:
`project_working_directory_moved.md`.

## COMMITS (3 on master, all pushed)

| Hash | Type | Summary |
|------|------|---------|
| `2b45a6d` | fix(db) | **Migration 161** — `fn_sync_kds_on_order_terminal_status` + `trg_sync_kds_on_order_terminal_status` (AFTER UPDATE OF status ON orders). When `orders.status` transitions INTO `('delivered','completed','cancelled')`, force every non-completed `order_item_station_status` row for that order to `'completed'`. Re-fire guard via `OLD.status NOT IN (terminal)`. `bumped_at` deliberately not touched so `get_station_daily_count` doesn't show cancellations as kitchen completions. One-shot backfill UPDATE included for already-terminal orders with stale item rows. Applied to remote DB; trigger live (`pg_trigger.tgenabled='O'`), backfill query post-apply returns 0 ghost rows. |
| `dabfb87` | fix(kds) | Selector count query in `src/app/[locale]/dashboard/kds/page.tsx` now embeds `orders!inner(status)` and filters `orders.status IN ('accepted','preparing','ready')` — same window the inner station board renders. Defense in depth so selector chip counts and station-board content always match, even if a future code path bypasses the new trigger. |
| `20fdf58` | fix(driver) | `customerNavUrl` priority flip in `src/components/driver/DriverOrderCard.tsx`. Old order ran the share-URL branch first and either matched a strict decimal regex OR returned `extractedUrl` verbatim — so a customer-pasted DMS-formatted Maps URL (e.g. `?q=N 26°08'02.1" E 50°34'59.0"`) beat the clean decimal lat/lng in the DB. New order: DB `delivery_lat`/`delivery_lng` win when present (with `Number()` coercion for PostgREST's NUMERIC-as-string + `Number.isFinite` to drop NaN), then share-URL fallback, then structured-address search. Regex unchanged. |

---

## KEY DECISIONS / JUDGMENT CALLS

1. **Why migration 161 was the right shape.** The KDS ghost-count audit showed a structural mismatch: selector counted `order_item_station_status` items, board rendered `orders`. Two possible fixes — sync items→order or order→items. We already had the items→order direction (`bump_station_order` stamps `orders.ready_at`); order→items was the unwired edge. Adding the trigger closes the loop without changing query semantics on either surface.

2. **`bumped_at` left NULL on auto-completed rows.** A KDS bump and an order-cancellation force-complete are semantically different events. `get_station_daily_count` gates on `bumped_at` to compute "kitchen completions today" — sweeping cancelled-order item rows into that count would inflate the daily ops metric. The trigger updates `updated_at` (audit) but not `bumped_at` (KPI).

3. **Selector query change is defense-in-depth, not the fix.** The trigger already prevents the ghost-count condition going forward + backfill cleared the existing rows. The `orders!inner(status)` join exists so that selector and board always render the same set even if a future code path bypasses the trigger (e.g. a `delete from order_item_station_status` cleanup with no order transition).

4. **DriverOrderCard priority flip vs in-place share-URL fix.** Considered "if regex doesn't match, fall through" inside the share-URL branch. Cleaner is full priority flip: DB decimal coords are always more reliable than embedded address URLs (which are customer-typed). Share-URL still survives as the fallback for orders where checkout-GPS wasn't tapped.

5. **Working tree migrated to `kahramana-Saas-fresh\`.** When `.git` was found missing in `kahramana-Saas\`, did NOT `git init` blindly — that would have manufactured a fresh repo with no history and broken any subsequent push. Stopped, surfaced evidence, and waited for user direction. User confirmed a fresh clone was made; hash-diffed today-modified files (with `Test-Path -LiteralPath` to dodge the `[locale]` glob trap that initially produced 31 false-positive "new" files) → only the expected 2 files drifted. Copied + validated + committed in fresh.

---

## VERIFICATION

- `npx supabase db push --linked --include-all` → 161 applied
- `pg_trigger` query → `trg_sync_kds_on_order_terminal_status` on `orders`, enabled
- Ghost-row probe (terminal orders × non-completed items) → 0 rows post-backfill
- `npx tsc --noEmit` → clean (twice: post-migration, post-driver-fix)
- `NEXT_BUILD_WORKERS=1 npm run build` → green (twice)
- `npm ci` in fresh clone → 918 packages, 0 vulnerabilities

## OPEN / NEXT

- The old `kahramana-platform\kahramana-Saas\` tree is now stale and orphaned (no `.git`). User may want to delete it after confirming nothing else lives in there. Memory note exists so future sessions cd into `-fresh`.
- KDS selector should now show real counts (6/3/1 → 0/0/0 unless there's actual active work). User to verify in production.
- Driver nav: customer with `delivery_lat=26.133906, delivery_lng=50.583056` → URL is `https://www.google.com/maps?q=26.133906,50.583056`. Pasted DMS URLs are no longer fatal.

---

# === PREVIOUS SESSION (126) ===

> Session 126: branded confirm modal + loyalty i18n bug + البديع cleanup + founder card copy + BiDi fix + catering form hardening. Master `0675f78` → `2ef822c`.
> Date: 2026-05-16
> Author: Claude Code (Opus 4.7, 1M context)

## SESSION 126 — SUMMARY

UI + content + security session. Eight commits, all pushed. One
migration landed (160). No regressions: tsc + `next build`
(`NEXT_BUILD_WORKERS=1`) clean after every commit; i18n parity gate
green throughout (final 2,375 = 2,375).

The session went broad: a UI primitive (ConfirmModal), a runtime crash
fix on /checkout, a branch-data cleanup spanning 8 files + 2 i18n
strings, two consecutive content/styling fixes on the founder card,
and a full catering-form security hardening that lifted the form from
"wa.me handoff only" to a server-side flow with Turnstile + rate limit
+ DB persistence + branded success state.

---

## COMMITS (8 on master, all pushed)

| Hash | Type | Summary |
|------|------|---------|
| `4dd4a19` | feat | **ConfirmModal** primitive (`src/components/ui/ConfirmModal.tsx`) — branded, motion-animated, RTL-aware, `default` / `danger` variants, uses existing brand tokens + Almarai/Editorial fonts. Six callers wired: ReorderButton (cart replace), CartDrawer (clear cart), IntegrationsSettings (disconnect), PromotionsClient (delete promotion), DeliveryKanban (unassign driver), ModifiersEditor (delete option group + delete option). Every `window.confirm` in the codebase is gone (false positive remaining: `VariantPicker.confirm()` is a local function). `alert()` calls in `ImportDropzone.tsx` swapped to `toast.error()` since they're notifications, not confirmations. |
| `ad608f6` | fix | Runtime crash on /checkout. `CheckoutForm.tsx` passes `useTranslations('checkout')` into `LoyaltyRedemptionWidget`, but the widget called `t('checkout.loyalty.X')` → resolved as `checkout.checkout.loyalty.X` and threw MISSING_MESSAGE. Stripped the redundant prefix on 5 keys (needMore, balance, equivalent, toggle, saving). |
| `a2b2009` | fix | Removed every reference to the "البديع" / badi restaurant branch — 8 files: `BranchId` union narrowed to `'riffa' \| 'qallali'`, `HIDDEN_BRANCHES` left as empty typed array (~30 callers reference it), badi entries removed from `contact.ts BRANCHES`, `BRANCH_EXTENDED_DATA`, `lib/constants/branches.ts`, `BRANCH_IMAGES`, the Story `BranchesSection` Soon-card, analytics name map, and AR/EN SEO title/description. `Budaiya` in pos/OrderBuilder.tsx delivery-address picker is **NOT a branch** — kept. Applied migrations 010/013 left untouched; manual DB cleanup steps provided to operator. |
| `b537d60` | fix | Founder role copy. `story.founder.heritageLabel`: AR `"تراث عراقي"` → `"المؤسس \| مالك المطعم"`, EN `"Iraqi Heritage"` → `"Founder \| Restaurant Owner"`. Single-key change in both locale files. |
| `7c6c332` | fix | BiDi rendering for founder role text. The new `heritageLabel` value contains an ASCII pipe `\|` (neutral character) between two Arabic phrases — in LTR-leaning contexts (commit viewers, English browser tabs, ambiguous parent direction) the Unicode BiDi algorithm flips visual order around the pipe. Verified the file bytes were correct via hex-dump; fix is at the rendering layer. Added `dir={isRTL ? 'rtl' : 'ltr'}` to four nodes in `FounderSection.tsx`: both `signature` occurrences (float badge + quote block), `heritageLabel`, and `role`. Conditional because the component renders for both locales on /about. |
| `48d9285` | feat | **Migration 160** — `catering_inquiries` table for first-party catering-lead capture. Columns mirror `CateringInquiryValues` (name, phone, occasion_type, event_date DATE, event_time TIME nullable, guest_count INT 1-1000, area, service_type, preferred_branch TEXT FK→branches.id, budget nullable, notes, created_at). RLS enabled with **zero anon/authenticated policies** — only service_role writes (matching `contact_messages` / `reservations`). Explicit `REVOKE ALL ... FROM anon`/`authenticated` + `GRANT ... TO service_role` per the default-grants memory. Indexes on `created_at DESC` and partial on `preferred_branch`. Applied to remote; types regenerated and Windows pollution markers stripped per memory. |
| `e5908b4` | feat | `src/app/[locale]/catering/actions.ts` — server action mirroring `reserve/actions.ts`. Honeypot, Turnstile verify (soft-fallback when secret unset), Zod schema (guest_count coerce to int 1-1000, event_date Date.parse() check, phone 8-30, notes 1-2000), Upstash rate limit 3/IP/hour production-only, createServiceClient INSERT, returns `{ inquiryId, waLink }`. WhatsApp message title gets `#<last-8>` appended so staff can correlate WA messages with DB rows. |
| `2ef822c` | fix | `inquiry-form.tsx` rewrite: state machine `idle → submitting → success`, branded success card (mirrors ReserveForm — gold check circle, short-id, "Continue on WhatsApp" CTA, "Submit another" reset), sonner toasts for rate_limit/captcha/invalid_input/generic, Turnstile widget + honeypot, `window.open` return-value check → "popup blocked" toast for iOS Safari. GA events now fire **after** persistence. 11 new i18n keys per locale under `catering.form`. |

---

## KEY DECISIONS / JUDGMENT CALLS

1. **ConfirmModal API — declarative, not imperative.** Built `<ConfirmModal isOpen onConfirm onCancel />` (mirrors existing `PromptDialog`) rather than a global imperative `confirm(opts).then(...)`. Each caller manages its own state. Consistent with project pattern; no new abstraction.

2. **`window.alert()` calls in `ImportDropzone.tsx` swapped to `toast.error()`, not ConfirmModal.** Task spec said "replace all window.confirm() / window.alert() with the modal pattern" — but alerts are single-action notifications, not confirmations, and the project just adopted sonner (commit 5087b2b). Toast is the established notification pattern; confirmation modal would be overkill for "Only .xlsx files are accepted".

3. **`HIDDEN_BRANCHES` infrastructure kept even though now empty.** Referenced in ~30 files (analytics filters, KDS, payments, owner dashboard). Tearing it out would be a 30-file refactor for no functional benefit beyond cosmetics. Emptied the array (`BranchId[] = []`); existing `length > 0` guards everywhere skip the filter step correctly. Documented in commit message.

4. **`Budaiya` in `pos/OrderBuilder.tsx:231` was NOT removed.** That's a customer **delivery address area** in Northern Governorate (real Bahraini city), not a restaurant branch. Different concept; deliberately different spelling (`Budaiya` vs `Al-Badi'`). User confirmed by saying "remove all references to البديع **branch**" — emphasis on branch.

5. **BiDi fix used conditional `dir`, not hardcoded RTL.** `FounderSection` renders for both locales on `/about`. Hardcoding `dir="rtl"` would have broken the English page. Used `dir={isRTL ? 'rtl' : 'ltr'}` so English stays LTR.

6. **`guest_count` coerced to number on the client, not just the server.** First attempt used `z.coerce.number()` and sent the raw string from the form. tsc rejected it because `z.input<typeof submitSchema>` reports `number` (not `string`) as the input type for coerced numbers under our Zod version. Fixed with `Number(values.guestCount)` on the client; `NaN` from non-numeric input is caught server-side by `.int().positive()`.

7. **Catering form's `occasion_type` and `service_type` stored as localized strings, not enum keys.** Form's `<option value={t(...)}>` predates this session; values sent are the translated label (`"وليمة عائلية"` / `"Family Feast"`). DB stores `TEXT`. Not normalized; deliberately not refactored since the spec was "mirror reserve pattern" not "redesign the form". Worth a follow-up if dashboard filtering by occasion type is needed.

8. **Turnstile rendering — same `process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY` guard as reserve form.** No widget shown if env var absent (local dev without Turnstile keys); server-side `TURNSTILE_SECRET_KEY` check soft-passes the same way reserve does. Soft-launch fallback is intentional.

9. **Audit-only response on reservation/inquiry form architecture (no commit).** Spent significant analysis time before commit 48d9285 explaining that the "أخبرنا عن مناسبتك" form is the **catering** form, not the reservation form — they're architecturally different. The reserve form already has full server-side stack (commit history); the catering form was deliberately wa.me-only per the existing `notice` i18n string. User then approved the upgrade, which the three catering commits delivered.

10. **Turnstile HMR error diagnosed as Turbopack module-registry bug, not code change.** A `ChevronDown` import in `menu-hero.tsx` threw `module factory is not available` in dev. Code was correct; the fix was Ctrl+Shift+R or dropping `--turbopack` (per existing turbopack memory). No commit.

---

## OUTSTANDING OPERATOR ACTIONS

1. **Manual DB cleanup of `badi` branch row.** Migration 010 + 013 seeded a `badi` row into `branches`; applied migrations are immutable. Provided SQL for the user to run in Supabase SQL Editor:
   ```sql
   -- Inspect:
   SELECT id, name_ar, name_en, is_active FROM branches WHERE id = 'badi';
   -- Check FKs:
   SELECT 'orders' AS t, COUNT(*) FROM orders WHERE branch_id = 'badi'
   UNION ALL SELECT 'staff_profiles', COUNT(*) FROM staff_profiles WHERE branch_id = 'badi'
   UNION ALL SELECT 'reservations', COUNT(*) FROM reservations WHERE branch_id = 'badi'
   UNION ALL SELECT 'payments', COUNT(*) FROM payments WHERE branch_id = 'badi';
   -- If no FKs: DELETE FROM branches WHERE id = 'badi';
   -- If FKs:    UPDATE branches SET is_active = false WHERE id = 'badi';
   ```
   User has not yet reported results.

2. **No new env vars needed.** The catering action reuses `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, and `UPSTASH_REDIS_REST_URL/TOKEN` which are already set in Vercel for the reserve form. Same Upstash key namespace (separate Redis prefix: `catering:` vs `reserve:`).

3. **SENTRY_AUTH_TOKEN re-rotation still pending** (carried from session 120). Not touched this session.

4. **SESSION_BIND_SECRET still pending** (carried from session 120). Not touched this session.

---

## DEFERRED / FOLLOW-UPS

- **Catering audit findings #6 + #8 not addressed.** #6 (no email fallback) and #8 (HTML5 validation balloon doesn't follow next-intl locale) are deferred. The high-priority findings (#1, #2, #3, #4, #5, #7) all shipped.

- **Catering `occasion_type` / `service_type` normalization.** Currently stored as the user's locale-rendered string. If dashboard filtering by occasion type is needed, normalize to enum keys (`familyFeast`, `majlis`, etc.) at the action layer.

- **Catering dashboard page not built.** Migration 160 + service-role action are in; no `/dashboard/catering` route or component yet. Reads exist only via direct Supabase Studio access for now.

- **`HIDDEN_BRANCHES` cleanup follow-up** (purely cosmetic): now-empty `length > 0` guards across ~30 files could be removed in a separate sweep. Not a priority.

- **B-rated audit findings #6 / #8** as above.

---

## MIGRATION STATE

- Local = Remote = **160 migrations applied**
- Session 126 added: **160** (catering_inquiries)
- No migration repairs needed

---

## SESSION HISTORY (last 5)

- Session 123: H-2 hydration fix — global-error.tsx reads locale from cookie
- Session 124: Launch audit + 3 fixes (driver delivered, location push, stuck orders)
- Session 125: Birthday cron + reorder/history + sonner + grant bugfix + motion v12
- Session 126: ConfirmModal + loyalty i18n fix + البديع cleanup + founder copy + BiDi + catering hardening
- Session 127: KDS ghost-count root-cause (migration 161 + selector tightening) + driver nav DMS bug + working tree moved to kahramana-Saas-fresh
