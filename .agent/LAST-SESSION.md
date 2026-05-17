# LAST-SESSION.md — Kahramana Baghdad
> Session 134: ARCH-004 atomic checkout RPC (migration 163) + catering form fallback CTA & noValidate. Master `e9b1ec6` → `22ee548`.
> Date: 2026-05-17
> Author: Claude Code (Opus 4.7, 1M context)

## SESSION 134 — SUMMARY

Three commits on master, all pushed. One migration (163). i18n parity
2,433 → 2,436. Gates clean on every commit: `npx tsc --noEmit` exit 0;
`npx tsx scripts/check-i18n.ts` PASS; `NEXT_BUILD_WORKERS=1 npm run
build` clean (566/566 pages).

Theme: close the two oldest phase-6-blocker items on the deferred list
— ARCH-004 atomic checkout RPC and catering audit findings #6 + #8.

ARCH-004 was the meaningful piece. Customer checkout had two writes
running in serial JS *after* `rpc_create_order` returned: an UPDATE
of `orders.delivery_flat` (migration 154 added the column after the
RPC was written) and an INSERT into `payments` (createInitialPayment).
If the payment INSERT failed for any reason — UNIQUE-constraint race,
DB hiccup mid-flight, process kill — the order row was already
committed but no payment row existed. A retry with the same
idempotency_key would hit the early-return path in the RPC and
*never* create the payment row, leaving an orphaned order that the
webhook reconciler could not settle and that did not show in cashier
reconciliation.

Migration 163 folds both writes into the RPC. Three opt-in params
(`p_delivery_flat`, `p_payment_mode`, `p_payment_expires_at`) with
NULL defaults so the four legacy callers (`table/`, `waiter/`,
`dashboard/pos/`, `dashboard/pos/service/`) keep their existing JS
payment-row inserts unchanged. The legacy 28-arg overload was
explicitly DROPped so the new 31-arg version is the sole resident
definition — same pattern as migration 135. Return type stays `uuid`
for source-compat with all `{ data: orderId }` destructures.

Catering findings were a 30-minute follow-up. Finding #6: added a
"Copy WhatsApp link" button to the success card alongside "Continue
on WhatsApp" so customers whose popup was blocked (iOS Safari is the
common culprit) can paste the prefilled wa.me link into WhatsApp
manually instead of resubmitting. Finding #8: added `noValidate` to
the form so the browser's native validation balloons (whose text
follows OS/browser language and ignores next-intl) no longer leak
English popups on Arabic pages. Server-side Zod already returns
localized error toasts via sonner — same UX, one round-trip.

## COMMITS (3 on master, all pushed)

| Hash | Type | Summary |
|------|------|---------|
| `be15f22` | feat(db) | **Migration 163 — atomic rpc_create_order extends to delivery_flat + payment row.** Folds the delivery_flat persistence (`orders.delivery_flat`, column added 154) and the initial `payments` row INSERT into the same transaction as the order/order_items/loyalty/coupon writes. Three opt-in params added: `p_delivery_flat TEXT DEFAULT NULL`, `p_payment_mode TEXT DEFAULT NULL` (NULL = skip payment insert / legacy callers; `'cod'` → method=cash, status=pending_cod; `'online'` → method=NULL, status=pending — gateway fills in via Tap webhook), `p_payment_expires_at TIMESTAMPTZ DEFAULT NULL`. Legacy 28-arg overload DROPped so the 31-arg version is sole resident (same pattern as 135). Return type stays `uuid` for source-compat. Idempotency early-return still at the top — duplicate requests can't double-insert payments. All other behaviour (PRICE_MISMATCH guard, COUPON_INVALID branches, FOR-UPDATE coupon lock, points deduction, status-by-payment_method CASE, coupon_usages audit row from 155) copied verbatim. REVOKE/GRANT re-stated for the new signature. Migration paired (local = remote = 163). `npx supabase gen types typescript` regenerated; stripped `<claude-code-hint />` pollution marker from EOF. |
| `80f737e` | refactor(checkout) | **Replace serial JS steps with atomic rpc_create_order.** Drops the post-RPC `UPDATE orders SET delivery_flat` (best-effort, with Sentry capture) and the `createInitialPayment` helper from `src/app/[locale]/checkout/actions.ts`. Both writes now happen inside the RPC. Forwards `p_delivery_flat`, `p_payment_mode: paymentMode === 'cod' ? 'cod' : 'online'`, and `p_payment_expires_at: expiresAt ?? undefined` into the call. localizeCheckoutError sentinels (PRICE_MISMATCH, AUTH_REQUIRED, COUPON_INVALID, INSUFFICIENT_POINTS, POINTS_OVER_CAP) and idempotency_key short-circuit preserved. Net: 14 insertions / 51 deletions on one file. Address auto-save to `customer_profiles` and order confirmation email still happen in JS (auth-bound RLS + fire-and-forget email — neither belongs in the DB transaction). |
| `22ee548` | fix | **Catering form #6 WhatsApp fallback CTA + #8 noValidate locale fix.** #6: added "Copy WhatsApp link" button to success card between the "Continue on WhatsApp" anchor and "Send another inquiry". Uses `navigator.clipboard.writeText(submit.waLink)` with `toast.success` confirmation and `toast.error` fallback for browsers that deny clipboard permission. #8: `noValidate` on `<form>` suppresses the browser's native validation balloons; server-side Zod via sonner toast retains localized errors. Three new i18n keys × 2 locales: `catering.form.{copyLink, copyLinkSuccess, copyLinkFailed}`. Parity 2,433 → 2,436. |

## INFRA NOTES

- **One migration added (163).** Paired live on `kahramana-prod`
  (project `wwmzuofstyzworukfxkt`) via `supabase db push --linked
  --include-all`. Migration count now 163 (plus the two
  `2026050519...` / `2026050812...` timestamp entries).
- **`src/lib/supabase/types.ts` regenerated** from
  `kahramana-prod`. New params reflected: `p_delivery_flat`,
  `p_payment_mode`, `p_payment_expires_at` on `rpc_create_order`.
  Stripped trailing `<claude-code-hint v="1" ... />` plugin pollution
  marker at line 5357 (causes TS1005 parse error).
- **No env vars touched.** No new deps. Bundle output unchanged at
  page level — refactor is pure write-path consolidation.

## KEY DECISIONS / JUDGMENT CALLS

1. **Keep `RETURNS uuid`, don't switch to JSONB.** Task brief mentioned
   a structured return (`{ order_id, order_number,
   loyalty_points_deducted, coupon_applied, payment_record_id }`) but
   also "Keep backward compatible return shape so existing callers
   don't break." Four call sites destructure `{ data: orderId } =
   await supabase.rpc(...)` and treat orderId as a UUID string —
   changing to a record would silently break them all. Resolved the
   tension by keeping `RETURNS uuid` (backward compat wins) and
   noting in the migration prologue that the conceptual contract is
   the same: order_id is returned, order_number = last-8 of order_id,
   loyalty_points_deducted = `p_points_to_redeem` (input), coupon_
   applied = `p_coupon_id IS NOT NULL` (input), and payment_record_id
   exists iff `p_payment_mode IS NOT NULL`.

2. **Opt-in `p_payment_mode = NULL` default for legacy callers.**
   `table/`, `waiter/`, `dashboard/pos/`, `dashboard/pos/service/` all
   insert their own `payments` row in JS after the RPC (POS uses
   `rpc_pos_finalize_order` for atomic payment+audit; table+waiter
   insert cash rows). Forcing them onto the new inline path would
   require touching their payment flow which is out of scope. Defaulting
   `p_payment_mode = NULL` skips the inline INSERT and leaves their
   behavior unchanged — only checkout opts in.

3. **DROP the legacy 28-arg overload before CREATE OR REPLACE.** PG
   `CREATE OR REPLACE FUNCTION` only matches *identical* signatures
   — without the explicit DROP, the 28-arg version (migration 155 body)
   would coexist with the new 31-arg version as overloads, and any
   28-arg call would be ambiguous or silently hit the legacy body that
   lacks the inline payment insert. Same pattern migration 135 used to
   kill the 25-arg overload.

4. **Address auto-save + email send stay in JS.** The customer_profiles
   default-address update uses the cookie-bound anon client so RLS
   applies (service_role would bypass column-level grants); the order
   confirmation email is fire-and-forget. Neither belongs inside the
   DB transaction. Best-effort comment retained in checkout/actions.ts.

5. **Catering #8: `noValidate` over `setCustomValidity()`.** Task brief
   explicitly offered both options and recommended `noValidate` as
   "1 line". Server-side Zod already returns `invalid_input` with a
   localized toast — the trade-off is one round-trip vs. two languages
   of error popups, and round-trip wins on locale correctness.

6. **Catering #6: clipboard fallback inside try/catch, not feature
   detection.** `navigator.clipboard` is gated to secure contexts
   (HTTPS only); production is HTTPS so it resolves, but a customer
   inside a cross-origin iframe or with permissions denied still
   needs a path. The try/catch on `writeText()` covers both branches
   with a localized error toast — simpler than detecting Permissions
   API status upfront.

## VERIFICATION

- `npx tsc --noEmit` → exit 0 (clean) after both commits.
- `npx tsx scripts/check-i18n.ts` → PASS, parity 2,436 / 2,436.
- `NEXT_BUILD_WORKERS=1 npm run build` → green; 566/566 pages
  generated; only warning is the pre-existing `[@sentry/nextjs]
  DEPRECATION WARNING: unstable_sentryWebpackPluginOptions`.
- `supabase migration list --linked` → 163 paired (Local = Remote = 163).
- No runtime smoke-test of the new RPC path (no staging DB; Tap keys
  pending). The atomicity claim is provable by inspection: every
  formerly-serial write now lives inside the `BEGIN ... END;` block.

## DEFERRED / OPERATOR-PENDING

(updated for session 134)
- Supabase Free → Pro + Singapore migration.
- TAP keys (merchant approval pending).
- Staff accounts — 13 staff emails pending from owner.
- Resend domain verification for kahramanat.com — still pending.
- VAPID keys for driver push notifications.
- CONTACT_NOTIFY_EMAIL (optional).
- After staff accounts: flip `NEXT_PUBLIC_ENABLE_QR_LOYALTY_SCAN=true`.
- Extend `localizeCheckoutError` to `waiter/actions.ts:222` (staff
  surface, different return shape).
- Catering `occasion_type` / `service_type` normalization.
- Sprint 6B WhatsApp Business API (Meta verification).
- Sprint 6C Benefit Pay API (CBB approval).
- Inventory page banner: "0/168 recipes mapped — chef Excel import
  pending" (operator visibility).
- Chef Excel recipe import — root-cause fix for 168/168 unmapped.
- Migration 015 gitignore issue (copied by hand into fresh tree).
- Migration 131 cowork diff verification.
- البديع branch row DB cleanup (SQL provided session 126).
- ~11 missing dish photos.
- Once Tap keys arrive: Refund Modal (refundPayment currently flips
  DB state only; does NOT call Tap to push money back).
- ~~ARCH-004 atomic checkout RPC~~ — **DONE this session (`be15f22` +
  `80f737e`, migration 163).**
- ~~Catering audit findings #6 + #8~~ — **DONE this session
  (`22ee548`).**

## OPERATOR NOTES

- **Checkout write path is now fully atomic.** Customer-facing
  `createOrderWithPoints` makes a single RPC call covering order,
  order_items, loyalty deduction, points transaction, coupon
  lock+increment+usage row, promotion increment, delivery_flat, AND
  the initial payments row. Either everything commits or everything
  rolls back. The webhook reconciler and cashier reconciliation can
  now trust that `orders` JOIN `payments` is total over the customer
  checkout flow.

- **Legacy callers unchanged.** `table/`, `waiter/`, `dashboard/pos/`,
  `dashboard/pos/service/` still call `rpc_create_order` without the
  new `p_payment_*` params and still insert their own `payments` row
  in JS. Any future atomicity work on those surfaces should set
  `p_payment_mode = 'cod'` and drop the JS insert — but be aware POS
  also uses `rpc_pos_finalize_order` for the audit row, so the move
  is not a pure copy of the checkout pattern.

- **Catering form popup-block path is now covered.** Customer can
  copy the wa.me link from the success card if the auto-open is
  blocked or the new tab gets closed. Inquiry is still saved to DB
  either way — the gap was only the customer's UX path to WhatsApp.

---
---
---

# Prior session 133 close-out preserved below ↓

## SESSION 133 — SUMMARY

Two commits on master. No migrations. No i18n changes. Gates clean
on every commit: `npx tsc --noEmit` exit 0; `NEXT_BUILD_WORKERS=1 npm
run build` clean (only pre-existing Sentry deprecation warning,
unrelated).

Theme: pure cleanup. Two carry-forwards from prior session notes,
both turned out to be paper-only debt (AUD-V3-007/011) or shipped-
infrastructure debt (HIDDEN_BRANCHES guards left over from the
البديع cleanup in session 126).

The first task — "remove ~15 remaining `as any` casts" — investigation
showed `src/` was already clean. Both audit tickets had landed in
earlier commits (`f921e66` AUD-V3-011, `0f95f5a` AUD-V3-007); only the
hand-off notes still claimed they were open. Pivoted from refactor to
doc cleanup so the next agent does not chase the same ghost.

Operator-side: Ahmed set `CRON_SECRET` in Vercel (prod + preview) and
triggered a redeploy. Birthday notification cron is now wired
end-to-end; will fire next morning a customer birthday matches today's
Asia/Bahrain date.

## COMMITS (2 on master, both pushed)

| Hash | Type | Summary |
|------|------|---------|
| `f6e403e` | docs | **Mark AUD-V3-007/011 closed — stale `as any` references removed.** Investigation triggered by the task brief claiming "~15 `as any` sites remain". `grep -rn "as any" src/` returned zero matches; `git log` confirmed `f921e66` (AUD-V3-011 all `as any` casts removed) and `0f95f5a` (AUD-V3-007 next-intl v3→v4 bump). Updated three stale lines in `.agent/LAST-SESSION.md` (147, 255, 402) and one in `kahramana-conversation-master-notes.md` (454) with strike-through + commit hashes. `docs/audit/dashboard-audit-2026-05-13-v3.md:28` already showed CLOSED — the carry-forward notes simply never got trimmed. Net: 4 insertions / 4 deletions across 2 files. |
| `57ac6a9` | refactor | **Remove dead HIDDEN_BRANCHES length > 0 guards (~30 sites, 15 files).** `HIDDEN_BRANCHES` was narrowed to `BranchId[] = []` in commit `a2b2009` (session 126, البديع branch cleanup). The 30 `HIDDEN_BRANCHES.length > 0` guards across analytics queries, KDS, payments, owner dashboard, delivery, reports, inventory widgets, etc. have been unreachable since then. Three patterns removed: `} else if (HIDDEN_BRANCHES.length > 0) { ... }` blocks (most common), `: HIDDEN_BRANCHES.length > 0 ? X : Y` ternaries (4 in InventoryWidgetsSection), and one `else if (isGlobalAdmin && HIDDEN_BRANCHES.length > 0)` block in `payments/page.tsx` (also dropped the orphaned `excludedOrderIds` accumulator). HIDDEN_BRANCHES const itself **stays** in `src/constants/contact.ts` as `BranchId[] = []`, along with `isHiddenBranch()` and the `BRANCH_LIST.filter` — type-safe no-ops kept in case a branch is hidden again. `OrdersClient.tsx` import collapsed `{ BRANCHES, HIDDEN_BRANCHES }` → `{ BRANCHES }`; `owner/page.tsx` import collapsed `{ HIDDEN_BRANCHES, isHiddenBranch }` → `{ isHiddenBranch }`. Net: 18 insertions / 123 deletions across 15 files. |

## INFRA NOTES

- **No env vars touched.** No migrations.
- **No new deps.** No i18n changes.
- **Build size:** unchanged at the page level (dead-branch removal is
  TS-only; bundle output identical except for source-map shrinkage).
- **CURRENT-SESSION.md** at session start was synced from the master
  gist hook (sync-context.ps1) showing master `160bbdd` and stale
  session 120 bridge content. Updated end-of-session to reflect 57ac6a9.

## KEY DECISIONS / JUDGMENT CALLS

1. **Refuse to fabricate work when the task premise was already
   resolved.** The "~15 `as any` sites" brief was confidently wrong;
   easier path was to start "removing" casts that no longer existed
   and produce a no-op commit. Instead reported the finding (commit
   hashes proving both tickets shipped) and asked the operator to
   pick a real lane. Operator pivoted to docs cleanup + the
   already-flagged HIDDEN_BRANCHES follow-up.

2. **Keep `HIDDEN_BRANCHES` as `BranchId[] = []`, not delete the
   const.** Brief was explicit ("do not delete the const itself — it
   may be needed if branches expand in future"). The cost of keeping
   it is one symbol export + the BRANCH_LIST.filter call returning the
   full list (cheap). The cost of removing it would be a wider diff
   (every import callsite) and re-introducing it later if a branch
   ever needs hiding again would touch the same 15 files. Net: keep.

3. **Strike-through, not delete, in archived notes.** When marking
   the AUD-V3-007/011 lines closed in `LAST-SESSION.md` and
   `kahramana-conversation-master-notes.md`, used `~~text~~ —
   **CLOSED** (`hash`)` rather than removing the line entirely. The
   strike-through documents that the item was real once and is now
   resolved; future agents grepping for the ticket numbers still hit
   the line and immediately see the closure pointer.

4. **OrdersClient.tsx kept BRANCHES, dropped only HIDDEN_BRANCHES.**
   The import was `{ BRANCHES, HIDDEN_BRANCHES }` — `BRANCHES` is
   actively used for the branch-filter dropdown options. Narrowed the
   import rather than ripping out the line.

5. **`payments/page.tsx` `excludedOrderIds` removed entirely.** The
   variable was declared at line 45, populated only inside the dead
   `else if (isGlobalAdmin && HIDDEN_BRANCHES.length > 0)` block, and
   gated downstream by `if (excludedOrderIds.length > 0)`. Once the
   populating branch dies, the variable becomes write-never, so both
   the declaration and the two `.length > 0` consumer lines were
   dropped. Net cleaner than leaving a `let excludedOrderIds: string[] = []`
   that nothing ever writes.

## VERIFICATION

- `npx tsc --noEmit` → exit 0 (clean) post-refactor commit.
- `NEXT_BUILD_WORKERS=1 npm run build` → green; 566/566 pages; only
  warning is the pre-existing `[@sentry/nextjs] DEPRECATION WARNING:
  unstable_sentryWebpackPluginOptions` (unrelated, present before
  this session).
- `grep -rn "HIDDEN_BRANCHES.length" src/` → zero matches post-fix.
- `grep -rn "HIDDEN_BRANCHES" src/` → 4 expected hits: declaration
  in `contact.ts:18`, the `isHiddenBranch` helper, the `BRANCH_LIST`
  filter, and the docstring in `branches/queries.ts:5`.
- i18n parity script not run (no i18n touched).
- No runtime verification — refactor is pure dead-branch deletion;
  TS proves shape, build proves bundle.

## DEFERRED / OPERATOR-PENDING

(updated for session 133)
- Supabase Free → Pro + Singapore migration.
- TAP keys (merchant approval pending).
- Staff accounts — 13 staff emails pending from owner.
- ~~**`CRON_SECRET`** on Vercel~~ — **DONE 2026-05-17 by operator
  (Production + Preview).** Redeploy triggered. Birthday cron now
  fully wired; will fire next morning a customer birthday matches
  today's Asia/Bahrain date. Resend domain verification remains the
  one missing piece for actual email delivery.
- Resend domain verification for kahramanat.com — still pending.
- VAPID keys for driver push notifications.
- CONTACT_NOTIFY_EMAIL (optional).
- After staff accounts: flip `NEXT_PUBLIC_ENABLE_QR_LOYALTY_SCAN=true`.
- Extend `localizeCheckoutError` to `waiter/actions.ts:222` (staff
  surface, different return shape).
- Catering audit findings #6 (no email fallback) + #8 (HTML5
  validation balloon doesn't follow next-intl locale).
- Catering `occasion_type` / `service_type` normalization.
- ARCH-004 atomic checkout RPC.
- Sprint 6B WhatsApp Business API (Meta verification).
- Sprint 6C Benefit Pay API (CBB approval).
- Migration 015 gitignore issue (copied by hand into fresh tree).
- Migration 131 cowork diff verification.
- البديع branch row DB cleanup (SQL provided in session 126;
  operator-side one-shot UPDATE).
- ~11 missing dish photos.
- ~~~15 `as any` sites (AUD-V3-007/011)~~ — **CLOSED prior**
  (`f921e66` + `0f95f5a`); doc references corrected this session.
- ~~HIDDEN_BRANCHES cleanup~~ — **DONE this session (57ac6a9).**

## OPERATOR NOTES

- **Birthday cron is now live end-to-end.** `CRON_SECRET` set, route
  no longer 503s. Next blocker for actual sends is Resend domain
  verification; until then `sendBirthdayBonus` will return a
  SendResult with failure but the cron loop survives (per-row Sentry
  catch).

- **HIDDEN_BRANCHES const stays.** If a branch ever needs hiding,
  add its `BranchId` to the array in `src/constants/contact.ts:18`
  and re-introduce the `.length > 0` guard at the relevant query
  site. Pattern is documented in `branches/queries.ts:5` comment.

---
---
---

# Prior session 132 close-out preserved below ↓

## SESSION 132 — SUMMARY

Five commits on master, all pushed. No migrations. All gates clean on
every commit: `npx tsc --noEmit`, `npx tsx scripts/check-i18n.ts`,
`NEXT_BUILD_WORKERS=1 npm run build`.

Theme: clear the named launch-prep backlog. Two carry-forwards from
session 131's audit (P4-2 raw English in checkout, F-01 consent
gating), then two new dashboard/notification surfaces (catering
listing + birthday email). One operator action added (CRON_SECRET);
no operator actions cleared.

The F-01 work surfaced a real violation that a pure UI audit would
have missed — the script tags were already consent-gated, but two
`<link rel="preconnect">` tags in <head> were still leaking
DNS + TLS to googletagmanager.com and clarity.ms on every first
paint regardless of consent.

The birthday work split cleanly into two commits as specified — a
scaffold (route + cron config + env var) followed by the actual
sending (template + wa.me + i18n).

## COMMITS (5 on master, all pushed)

| Hash | Type | Summary |
|------|------|---------|
| `9a93fe1` | fix(checkout) | **P4-2 — localize all 7 raw-English checkout errors.** Carry from session 128's `points_over_cap` work. Seven server-side strings in `src/app/[locale]/checkout/actions.ts` collapsed to stable lowercase codes consumed by `localizeCheckoutError` in `CheckoutForm.tsx`. Codes: `min_redemption:<n>` (carries dynamic count via prefix-parse, `{points}` interpolation in i18n), `insufficient_points`, `coupon_invalid`, `price_mismatch`, `auth_required`, `order_creation_failed`. `fetchAndComputeCouponDiscount` had 10 internal validation strings (paused / expired / branch / time window / per-customer limit / etc.) — all collapsed to `coupon_invalid` so the customer sees one localized message. 5 new i18n keys × 2 locales; parity 2,394 → 2,399. Sibling audit: `reserve/actions.ts` and `catering/actions.ts` already use code pattern (clean); `waiter/actions.ts:222` carries `'Order creation failed'` literal but is a staff surface with different return shape (out of scope, flagged for follow-up). |
| `92c6fba` | fix(privacy) | **F-01 — gate GA4 + Clarity behind cookie consent.** Audit was verification-only by spec; violation found. `<Analytics>` was already properly consent-gated for script injection. The leak was two `<link rel="preconnect">` tags in `src/app/[locale]/layout.tsx:236-241` rendered server-side for every visitor regardless of consent. Preconnect performs DNS lookup + TLS handshake — that's a third-party network request before user accepts anything. Fix moved both preconnects into `<Analytics>` next to the Script tags they exist to warm up. Edge cases verified: returning consented user (useEffect on mount → preconnect + script inject immediately), never-accepted user (state stays false forever → no third-party connection), any non-`'accepted'` localStorage value (strict equality → blocks). |
| `1d67b4a` | feat(catering) | **/dashboard/catering inquiry listing page.** Migration 160's `catering_inquiries` table had been writing leads since session 126 with only Supabase Studio reads. New server-component page at `src/app/[locale]/dashboard/catering/page.tsx` with `requireDashboardSection('catering')` (owner + general_manager only — catering leads carry personal info + budget, tight gate). Suspense wraps `CateringInquiriesList.tsx` which reads via `createServiceClient()` (RLS service-role-only, mirrors reservations pattern), orders by `created_at DESC`, limit 200. Cards show all 12 columns from the spec: name, short ref (last 8 hex, mono), phone, occasion, event date + optional time, guests (locale-aware), service type, area, preferred branch (resolved via BRANCHES → AR/EN name, "Any branch" fallback), budget ("—" fallback), notes, received timestamp. Fresh (<24h) gets a gold "NEW" pill. WhatsApp CTA via `buildCustomerContactLink` with bilingual greeting + short-ref. Sidebar entry under customers group reuses `<ReservationsIcon />`. New `catering` section in `rbac-ui.ts` (distinct from existing `inventory_catering`). 17 new i18n keys × 2 locales. |
| `29ac5f2` | feat(cron) | **Birthday notification scaffold — /api/cron/birthday-notify + Vercel Cron config.** Auth via `Authorization: Bearer <CRON_SECRET>` (header Vercel injects on scheduled fires); without `CRON_SECRET` env var, route 503s every request including the scheduled cron — missing secret can never silently leak. Idempotency: 2h `created_at` lookback on `birthday_point_credits` — wide enough to catch today's pg_cron batch (05:00 UTC) when this route fires 1h later (06:00 UTC = 09:00 Asia/Bahrain), narrow enough that yesterday's rows fall outside. Documented caveat: manual mid-window curl within 2h of pg_cron WILL duplicate (intentional operator action; one-line `notified_at TIMESTAMPTZ` migration available if duplicate-send becomes real). `vercel.json` gains `crons` array. `.env.example` gains a new VERCEL CRON section with `CRON_SECRET` block + `openssl rand -hex 32` instructions. This commit's response is `{found, notified:0, cutoff}` — scaffold only. |
| `d24e5e3` | feat(email) | **Birthday email template + WhatsApp deep-link notification.** New `emails/templates/BirthdayBonus.tsx`: bilingual single email, two stacked sections (RTL AR → divider → LTR EN), two CTA buttons (Visit Account + Continue on WhatsApp). PreviewProps included for `react-email` dev mode. `sendBirthdayBonus(to, subject, props)` added to `src/lib/email/send.ts` — same `send()` helper as every other transactional email, returns SendResult union, never throws. Route loop in `/api/cron/birthday-notify` replaces the scaffold's `notified:0` placeholder: per credit row fetch `customer_profiles` (name, email, points_balance, loyalty_tier) → skip silently if email null → build AR+EN copy via `getTranslations({ locale })` → `sendBirthdayBonus` → on failure log to Sentry with `stage: birthday_notify.send_failed` and increment `failed` (one bad row can't kill the batch). wa.me URL built once outside the loop: Riffa branch number (`customer_profiles` has no preferred_branch column) + bilingual pre-filled text URL-encoded. New top-level `email.birthday` i18n namespace: subject, heading, subheading {name}, pointsAwarded {points}, balance {balance}, tier {tier}, tierNames.{bronze\|silver\|gold\|platinum}, accountCta, whatsappCta, whatsappMessage, footnote. Parity 2,419 → 2,433. |

## INFRA NOTES

- **No new env vars used by checkout/F-01/catering**. Birthday notification
  introduces `CRON_SECRET` (operator action added to bridge).
- **No migrations.** Local↔Remote still paired at 162.
- **No new dependencies.** Email template reuses existing
  `@react-email/components` primitives and the four Kahramana* layout
  components in `emails/components/`.
- **Build size delta:** /api/cron/birthday-notify went from 420 B
  (scaffold) → 2.19 kB (full loop). /[locale]/dashboard/catering at
  2.19 kB / 245 kB first-load. Total pages 564 → 566.

## KEY DECISIONS / JUDGMENT CALLS

1. **`min_redemption:<n>` prefix encoding over an `errorParams` field on
   `CheckoutResult`.** Adding a new param object to the result type
   would have rippled through every consumer of `CheckoutResult.error`.
   The prefix-and-parse pattern keeps `error: string` intact and
   confines all parameter-extraction logic to a single branch inside
   `localizeCheckoutError`. Only one parameterized error currently —
   if more arrive, the convention is documented in the route comment.

2. **All 10 coupon-validation strings collapse to `coupon_invalid`.**
   Considered keeping `coupon_expired` / `coupon_paused` /
   `coupon_below_minimum` distinct for actionability. The task brief
   listed "Coupon invalid" as a single bucket; customer can see the
   coupon UI for the precise reason. Specific codes can be split in a
   follow-up if dashboard analytics needs them.

3. **F-01: moved preconnects into `<Analytics>` rather than deleting
   them.** Considered just removing both — the perf benefit is small
   when the Script tag triggers DNS on its own. Kept them inside
   `<Analytics>` so the gate is identical for both layers and the
   original perf intent (warm DNS just before script load) is
   preserved post-consent.

4. **Catering dashboard: read-only listing, no realtime, no filter UI.**
   Reservations page has Realtime + filter chips + status mutations;
   reservation flow has live operational urgency (turn the table,
   confirm seating). Catering leads land via the public form, get
   processed via WhatsApp, and don't have a status lifecycle worth
   tracking yet. A status workflow (replied / quoted / closed) can
   land in a follow-up session when the operator decides what state
   they want to track.

5. **Birthday notification: bilingual single email, not locale-targeted.**
   The simpler alternative (`customer_profiles.preferred_locale` column
   + locale-specific send) needs a schema change and a backfill
   heuristic. Bilingual body is zero-DDL and the existing customer
   audience reads both anyway. AR block renders RTL, divider, EN block
   renders LTR.

6. **Birthday idempotency: 2h `created_at` window, not a `notified_at`
   column.** A `notified_at TIMESTAMPTZ` column on
   `birthday_point_credits` is the bulletproof solution. The 2h window
   is the cheap solution. Picked cheap for soft-launch because: pg_cron
   fires at 05:00 UTC, Vercel Cron fires at 06:00 UTC — 1h gap means
   the window naturally bounds to today's batch. Documented in route
   comments + commit body. Migration is one-line away if duplicate-send
   ever happens.

7. **Birthday WhatsApp: default to Riffa branch number.** Customer
   profiles don't track a preferred branch. Riffa is the live default
   per `BRANCHES`; both branches share the same wa.me hand-off pattern
   used everywhere else.

8. **Two-commit split for birthday work.** Task brief specified the
   exact commit messages. Commit 1 (scaffold) is meaningful on its own
   — operator can set CRON_SECRET and verify the auth + read path end
   to end before any actual sends go out. Commit 2 (content) replaces
   the placeholder.

## VERIFICATION

- `npx tsc --noEmit` → clean on every commit
- `npx tsx scripts/check-i18n.ts` →
    - Post-9a93fe1: 2,399 = 2,399
    - Post-1d67b4a: 2,419 = 2,419
    - Post-d24e5e3: 2,433 = 2,433
- `NEXT_BUILD_WORKERS=1 npm run build` → green on every commit (564 →
  566 pages, /api/cron/birthday-notify + /[locale]/dashboard/catering
  registered)
- **No runtime verification of birthday cron** — needs CRON_SECRET set
  in Vercel and a real birthday matching today's Asia/Bahrain civil
  date to fire. Operator can manually curl the route after setting
  the secret to dry-run the path.
- F-01 verified by reading the four edge cases in `<Analytics>`
  through; not exercised in a real browser this session. Operator can
  confirm in Chrome incognito Network tab.

## DEFERRED / OPERATOR-PENDING

(updated for session 132)
- Supabase Free → Pro + Singapore migration.
- TAP keys (merchant approval pending).
- Staff accounts — 13 staff emails pending from owner.
- **CRON_SECRET on Vercel** (new this session) — required for birthday
  cron to fire. `openssl rand -hex 32`, then set Production + Preview.
- Resend domain verification for kahramanat.com (already pending;
  birthday cron + every other transactional email needs it).
- VAPID keys for driver push notifications.
- CONTACT_NOTIFY_EMAIL (optional).
- After staff accounts: flip `NEXT_PUBLIC_ENABLE_QR_LOYALTY_SCAN=true`.
- WhatsApp/email birthday notification surface — **shipped this
  session (29ac5f2 + d24e5e3)**. Surface is live; needs CRON_SECRET +
  Resend verification to actually deliver. Will fire next morning
  there's a customer birthday matching today's Bahrain date.
- /dashboard/catering page — **shipped this session (1d67b4a)**. Empty
  state will show until the public form starts collecting leads in prod.
- ~~~15 `as any` sites (AUD-V3-007/011)~~ — **CLOSED**. AUD-V3-011 shipped in `f921e66` (all `as any` casts removed); AUD-V3-007 shipped in `0f95f5a` (next-intl v3→v4 bump). `src/` is clean: `grep -rn "as any" src/` returns zero matches.
- Extend `localizeCheckoutError` to the remaining raw-English errors NOT
  in the named seven — `waiter/actions.ts:222` is the named follow-up
  (staff surface, different return shape).
- Catering audit findings #6 (no email fallback) + #8 (HTML5 validation
  balloon doesn't follow next-intl locale) — deferred since session 126.
- Catering occasion_type / service_type normalization — currently
  locale-rendered string.
- HIDDEN_BRANCHES cleanup follow-up — purely cosmetic.

## OPERATOR NOTES

- **Set CRON_SECRET before the first birthday cron fire.** Without it
  the route returns 503 to every request, including the scheduled
  Vercel Cron at 06:00 UTC. pg_cron will still credit points
  silently — only the notification leg is gated.

- **/dashboard/catering is live for owner + GM only.** Cashiers /
  branch managers / waiters won't see it in the sidebar (RBAC filter
  hides it). Reads via service-role per migration 160's contract.

- **F-01 fix is invisible to consented users.** Already-accepted
  visitors get the preconnect + script bundle the moment `<Analytics>`
  hydrates, same as before. First-time visitors get zero third-party
  connections until they tap Accept.

---
---
---

# Prior session 131 close-out preserved below ↓

## SESSION 131 — SUMMARY

One commit on master. No migrations. Gates clean: `npx tsc --noEmit`.
No i18n touched (parity script not run — nothing to check).

Theme: clear a single deferred item that's been carried since session
101. The CLAUDE-AI-CONTEXT.md hand-off named `SetPasswordClient.tsx`
as the orphaned file; investigation showed it had already been
removed in an earlier pass (only docs still referenced it). The
sibling `ForgotPasswordClient.tsx` was the actual orphan — page
mounts `ForgotPasswordForm` from `@/components/auth/`, and grep
across `src/` + `app/` found zero references to the `Client`
variant. Deleted; 144 LOC gone.

No operator actions cleared this session. The three from session 130
(`SESSION_BIND_SECRET`, `SENTRY_AUTH_TOKEN` rotation, redeploy) stay
recorded as done.

## COMMITS (1 on master, not pushed by Claude — push at operator discretion)

| Hash | Type | Summary |
|------|------|---------|
| `c4fe9a8` | chore | **P4-1 ForgotPasswordClient.tsx removed (144 LOC).** `src/app/[locale]/forgot-password/page.tsx` mounts `ForgotPasswordForm` from `@/components/auth/ForgotPasswordForm`. The sibling `ForgotPasswordClient.tsx` in the same route folder had zero references in source — verified via `grep -r ForgotPasswordClient src/ app/` returning only the file itself and `.agent/phase-state.json` (a stale note). `git rm` + `tsc --noEmit` clean. `SetPasswordClient.tsx` was named in the carry-forward note but Glob confirmed the file no longer exists — already cleaned in a prior pass. |

## INFRA NOTES

- **No new env vars introduced.**
- **No migrations.** Local↔Remote still paired at 162.
- **No new dependencies.**
- **No i18n changes** — parity stays at 2,394 ↔ 2,394.

## KEY DECISIONS / JUDGMENT CALLS

1. **Verified the carry-forward note before deleting.** Memory and
   docs both named `SetPasswordClient.tsx` as the orphan. Glob first
   — file was already gone. Then grepped for the actual orphan
   (`ForgotPasswordClient`) and confirmed `page.tsx` mounts a
   *different* component (`ForgotPasswordForm`, from `components/auth/`).
   Removing the wrong file based on stale docs would have been
   silently destructive.

2. **`git add` only the deletion.** `sync-context.ps1` had clobbered
   `.agent/CURRENT-SESSION.md` at session start with stale
   session-120 content from `CLAUDE-AI-CONTEXT.md`. Left that drift
   unstaged in the cleanup commit per `git add -p` project rule —
   sibling work doesn't ride along. Resolved separately in this
   close-out commit.

3. **No build run.** `tsc --noEmit` was sufficient gate for a pure
   deletion of a file with no inbound references. Build would have
   passed but added several minutes for no new signal.

## VERIFICATION

- `npx tsc --noEmit` → clean
- `grep -r ForgotPasswordClient src/ app/` (via Grep tool) → only
  the deleted file itself + stale `phase-state.json` reference

## DEFERRED / OPERATOR-PENDING

(updated for session 131)
- Supabase Free → Pro + Singapore migration.
- TAP keys (merchant approval pending).
- **Staff accounts — 13 staff emails pending from owner** (blocks
  waiter/cashier activation + the QR loyalty flag flip).
- **Resend domain verification for kahramanat.com** (transactional
  email delivery).
- **VAPID keys for driver push notifications** (Web Push subscription
  on `DriverPWAShell`).
- **`CONTACT_NOTIFY_EMAIL`** (optional — contact-form forwarding
  destination).
- `NEXT_PUBLIC_ENABLE_QR_LOYALTY_SCAN` flip after staff accounts.
- WhatsApp/email birthday notification surface (cron + DB done;
  UI deferred).
- `/dashboard/catering` route (migration 160 + server action shipped;
  no UI).
- ~~**P4 follow-up: ~15 `as any` sites** (AUD-V3-007/011)~~ — **CLOSED** (`f921e66` + `0f95f5a`). `src/` confirmed clean.
- F-01 consent check (Chrome incognito → confirm GA/Clarity blocked
  pre-consent).
- Extend `localizeCheckoutError` to remaining raw-English errors.
- `HIDDEN_BRANCHES` cleanup follow-up (~30 redundant `length > 0`
  guards now that the array is empty).
- ~~`SetPasswordClient.tsx` dead-code cleanup~~ — **DONE in an
  earlier pass; carry-forward note was stale.**
- ~~`ForgotPasswordClient.tsx` dead-code cleanup~~ — **DONE
  2026-05-17 (P4-1, c4fe9a8).**
- `git push` of `c4fe9a8` (and the prior session-130 commits
  `786f549..e7ab0cb` if still local) is at operator discretion —
  Claude did not push.

## OPERATOR NOTES

- The forgot-password flow continues to use
  `@/components/auth/ForgotPasswordForm`. No user-visible change.

---
---
---

# Prior session 130 close-out preserved below ↓

## SESSION 130 — SUMMARY

Six commits on master. No migrations. All gates clean on every commit:
`npx tsc --noEmit`, `npx tsx scripts/check-i18n.ts` (after each i18n
touch), `NEXT_BUILD_WORKERS=1 npm run build`.

Theme: clear the dev-side backlog around the soft-launch milestone and
unblock two operator-side observability blockers. Operational hole
called out in master notes (`fn_inventory_reserve` no-op since session
38, recipes table empty) got two attacks: P2-1 ships the chef-facing
Excel import; P2-2 makes the operator-visible "X/168 mapped" banner
actionable. Loyalty surface caught up to migration 158 (birthday cron
already scaffolded — P3-1 wires the bonus value into the customer UI);
QR loyalty scanner audited and confirmed safe in flag-OFF state (P3-2).
Riffa hours corrected twice in one session — B-001 closed 01:00 → 02:00
at user request, then BUG-001 surfaced the latent opens 19:00 → 07:00
mismatch via a real-world report at 10:55 AM Bahrain. The `isOpen()`
logic was correct; the data was wrong (BRANCH_CONTACTS.md was the
source-of-truth all along). Three operator actions cleared mid-session
(SESSION_BIND_SECRET set + SENTRY_AUTH_TOKEN rotated + redeploy).

## COMMITS (6 on master, not pushed by Claude — push at operator discretion)

| Hash | Type | Summary |
|------|------|---------|
| `786f549` | feat(inventory) | **Chef Excel recipes import — wires inventory deduction (P2-1).** New `/dashboard/inventory/recipes/import` route, role-gated to `owner / general_manager / inventory_manager`. Single-sheet workbook shape: `menu_item_slug \| ingredient_id \| quantity_used \| unit`. Parser in `src/lib/inventory/recipe-import-parser.ts` (UUID-format check, per-row AR+EN errors). Server action in `src/app/[locale]/dashboard/inventory/recipes/import/actions.ts` — `analyze` pass validates against `menu_items_sync` + `ingredients` and detects both in-workbook duplicates and existing `(slug, ingredient_id)` pairs already in `recipes`; `import` pass inserts the survivors via service-role with an `audit_logs` entry tagged `source: 'chef_excel_import'`. Client UI in `src/components/inventory/RecipeImportClient.tsx` follows the existing inventory dashboard card/table tokens (`brand-surface`, `brand-border`, `brand-gold`, RTL via `isAr` ternaries). "Import from Excel" CTA added to `src/app/[locale]/dashboard/inventory/recipes/page.tsx` for the same three roles. The `unit` column is intentionally informational only — the recipes table doesn't store a unit; the source of truth is `ingredients.unit`. |
| `d5da803` | feat(inventory) | **Mapped-recipes banner now actionable (P2-2).** `src/components/inventory/RecipesBannerClient.tsx` gained an `importHref` prop and a `<Link>` CTA pointing at the new P2-1 import page. `src/app/[locale]/dashboard/inventory/page.tsx`: role gate flipped from `owner / general_manager / branch_manager` → `owner / general_manager / inventory_manager`. Trigger condition tightened from `recipesCount === 0 && menuItemsCount > 0` → `menuItemsCount > 0 && recipesCount < menuItemsCount` so the banner now fires while a partial mapping is in progress. Mapped count switched from raw `recipes` row count to `DISTINCT menu_item_slug`. i18n: `recipesBanner.title` reworded; new `recipesBanner.cta` key. |
| `bfc18cd` | fix(branches) | **Riffa closing time 01:00 → 02:00 across all surfaces (B-001).** Changed only in Riffa rows — Qallali kept at 01:00. Files: `src/constants/contact.ts` (`hours.ar` / `hours.en` / `closes`), `src/lib/constants/branches.ts` (`closes_display_ar` / `closes_display_en`), `messages/ar.json` + `messages/en.json` (FAQ hours answer, Riffa segment only), `public/llms.txt` (Riffa AR + EN line), `docs/branches.md` (Riffa table Hours AR/EN + Closes). Schema.org payload: no change needed — `schemaClosesTime()` already maps cross-midnight values to `26:00`. Intentionally not changed: `023_settings_schema.sql` (generic DB default), `HoursSettings.tsx` (generic UI placeholder), `sanity/schema/index.ts` (placeholder only), `BRANCH_CONTACTS.md` (already documented `2:00 AM`). |
| `34e2da2` | feat(loyalty) | **BirthdayGiftCard reads bonus points from loyalty_config (P3-1).** Migration 158 had already shipped the column (`loyalty_config.birthday_bonus_points` default 50), the idempotency table (`birthday_point_credits` UNIQUE on `(customer_id, year)`, RLS service-role only), the RPC (`credit_birthday_points()` with idempotency-claim-first via `ON CONFLICT`, anchored to Asia/Bahrain civil date), and the `pg_cron` schedule (`0 5 * * *` UTC = 08:00 Bahrain). Items 2-4 of the brief were therefore no-ops. Item 5 wired the bonus value into the customer UI: `LoyaltyConfig` type + `DEFAULT_LOYALTY_CONFIG` fallback gain `birthdayBonusPoints`; `getLoyaltyConfig()` selects `birthday_bonus_points`; cache key bumped `v1 → v2` so older cached shapes don't satisfy the new field; account page fetches the config server-side and passes `bonusPoints` to `BirthdayGiftCard`; component renders the figure in all three states (countdown, today, prompt CTA) via locale-aware `Intl.NumberFormat`; i18n AR + EN updated with `{points}` placeholder, parity check stays at 2,394 ↔ 2,394. |
| `256b35e` | docs(flags) | **QR Loyalty scan flag audit + activation comment (P3-2).** Audit-only pass on `NEXT_PUBLIC_ENABLE_QR_LOYALTY_SCAN`. Flag stays OFF until staff (waiter/cashier) accounts are activated. Off-path verified clean: scan button (`WaiterOrderClient:263`), modal mount (`WaiterOrderClient:475`), `scannedMember` state and the `lookupMemberByQR` server action are all dead branches in the off-state; `html5-qrcode` is dynamic-imported inside the modal effect so the bundle is unaffected when off. `lookupMemberByQR` remains exported but is defended by role check (`QR_LOOKUP_ROLES`), Upstash rate limit, regex, and migration 162's `waiter_cashier_read_customer_profiles` RLS policy. `supabase migration list --linked`: 162 applied on remote. One-line activation trigger comment added next to the flag definition. |
| `e7ab0cb` | fix(branches) | **Riffa branch isOpen() — opens 19:00 → 07:00 (BUG-001).** Real-world report: Riffa shown as `مغلق حالياً` at 10:55 AM Bahrain. `src/lib/utils/time.ts` handled cross-midnight correctly via `Intl.DateTimeFormat` in Asia/Bahrain — verified all four required cases (10:55→OPEN, 01:30→OPEN, 02:30→CLOSED, 06:30→CLOSED). Root cause was stale data: `src/constants/contact.ts` had Riffa as a dinner-only branch (`opens: '19:00'`, hours.* "7:00 PM"). `BRANCH_CONTACTS.md` — the operator source-of-truth — has always shown Riffa as "Daily 7:00 AM - 2:00 AM"; the codebase was the outlier. B-001 had fixed the closing time but missed the opens field, so `isBranchOpen` kept returning false for the entire daytime window. Fan-out mirrored B-001's surface list: `src/constants/contact.ts` (opens 19:00 → 07:00, hours.ar `م` → `ص`, hours.en `PM` → `AM`), `src/lib/constants/branches.ts` (`opens_display_*`), `messages/ar.json` + `messages/en.json` (FAQ hours answer), `public/llms.txt` (Riffa hours line), `docs/branches.md` (table + Notes section). Schema.org `openingHoursSpecification` auto-rebuilds correctly because `schemas.ts` reads from `CONTACT_BRANCHES`. |

## INFRA NOTES

- **No new env vars introduced** by any of the six commits. Operator
  did set `SESSION_BIND_SECRET` + rotated `SENTRY_AUTH_TOKEN` in Vercel
  during the session, then triggered a redeploy.
- **No migrations.** Local↔Remote still paired at 162. P3-1 consumed
  the already-shipped migration 158 (birthday gift mechanic).
- **Service-role insert path.** P2-1 uses `createServiceClient()` for
  `recipes` writes; the broader inventory import already does the
  same.
- **No new dependencies.** P2-1 reuses `exceljs` (already in deps).
- **Cache key bumped.** `getLoyaltyConfig`'s `unstable_cache` tag went
  `loyalty-config-v1` → `loyalty-config-v2` to invalidate cached rows
  lacking the new `birthdayBonusPoints` field.

## KEY DECISIONS / JUDGMENT CALLS

1. **Separate recipes-only import route instead of extending the
   existing `/dashboard/inventory/import` flow.** Existing broader
   importer expects a multi-sheet template keyed by `name_ar`. The
   chef's pending sheet is recipes-only with raw `ingredient_id` UUIDs.
   New focused route keeps the existing flow untouched.

2. **`unit` column accepted but not stored.** Recipes table has no
   `unit` column — `ingredients.unit` is authoritative. Column exists
   for chef readability and a future warn-on-mismatch check.

3. **In-workbook duplicates land in `skipped`, not `failed`.** First
   occurrence wins; rest reported as skipped — more forgiving than
   rejecting the whole import.

4. **`DISTINCT menu_item_slug` for the X/Y banner count.** Matches the
   human meaning of "X dishes have a recipe" — a dish with 5
   ingredients no longer counts as 5 toward "X/168".

5. **Banner role gate dropped `branch_manager`, added
   `inventory_manager`.** Branch managers don't author menu↔ingredient
   mappings.

6. **B-001 deliberately did not touch the DB default or
   `HoursSettings.tsx` placeholder.** Both are generic across all
   branches; flipping them to `02:00` would silently change defaults
   for any future branch row.

7. **P3-1: items 2-4 of the brief were already shipped in migration
   158.** Asked the user before reshaping rather than blindly creating
   new migrations to rename `birthday_point_credits` →
   `birthday_gift_log` or bump default 50 → 100. User confirmed
   "only do item #5". Cache key bump (`v1 → v2`) was the only side
   effect needed to surface the existing column in already-warm caches.

8. **P3-2: refused to flip the flag.** The brief explicitly forbade it,
   but the audit also confirmed there was no UI improvement to ship —
   off-state is already clean. Limited the change to a single inline
   activation-trigger comment so the next operator doesn't need to grep
   `.env.example` to find the gate condition. No empty work, no scope
   creep.

9. **BUG-001: refused to silently flip operating hours.** First
   confirmation from the user that Riffa is genuinely all-day
   (7am–2am), then applied. `BRANCH_CONTACTS.md` retroactively
   validated the choice — it had always said "Daily 7:00 AM - 2:00 AM".
   The codebase data was wrong, not the brief.

## VERIFICATION

- `npx tsc --noEmit` → clean on every commit
- `npx tsx scripts/check-i18n.ts` → 2,394 = 2,394 maintained
- `NEXT_BUILD_WORKERS=1 npm run build` → builds green on every commit
- **End-to-end of `fn_inventory_reserve` post-import is NOT verified
  in-session.** Smoke-test plan documented for operator: import one
  row, place an order on that slug, confirm an `inventory_movements`
  row with `movement_type = 'reservation'` appears (and matching
  `inventory_stock.reserved` increment) instead of an
  `inventory_alerts` row with `alert_type = 'unmapped_item'`.
- **Birthday cron** itself not verified in-session — needs a real
  birthday date in production to fire. Schema + RPC + idempotency table
  shipped in migration 158 are tested by their own constraints
  (`UNIQUE (customer_id, year)`).

## DEFERRED / OPERATOR-PENDING

(updated for session 130)
- Supabase Free → Pro + Singapore migration.
- TAP keys (merchant approval pending).
- Staff (waiter/cashier) accounts — external dependency.
- `NEXT_PUBLIC_ENABLE_QR_LOYALTY_SCAN` flip after staff accounts.
- WhatsApp/email birthday notification surface (cron + DB done; UI deferred).
- `/dashboard/catering` route (migration 160 + server action shipped; no UI).
- `SetPasswordClient.tsx` dead-code cleanup.
- ~~~15 `as any` sites (AUD-V3-007/011)~~ — **CLOSED** (`f921e66` + `0f95f5a`).
- F-01 consent check (Chrome incognito → confirm GA/Clarity blocked pre-consent).
- Extend `localizeCheckoutError` to remaining raw-English errors.
- ~~Chef Excel recipe import (0/168 recipes mapped)~~ — **import
  surface now shipped (P2-1 + P2-2). Outstanding: chef hands over a
  filled `.xlsx`, operator imports, operator runs the smoke test.**
- ~~SESSION_BIND_SECRET~~ **DONE 2026-05-17.**
- ~~SENTRY_AUTH_TOKEN re-rotation~~ **DONE 2026-05-17.**
- `git push` of `786f549..e7ab0cb` is at operator discretion — Claude
  did not push.

## OPERATOR NOTES

- The P2-1 import page is reachable at
  `/dashboard/inventory/recipes/import` (linked from the recipes index
  page and from the P2-2 banner on the inventory home).
- The chef's `ingredient_id` column is the UUID from the `ingredients`
  table — the page links to `/dashboard/inventory/ingredients` so the
  chef can look IDs up.
- Birthday bonus amount is tunable in `loyalty_config.birthday_bonus_points`
  (default 50, CHECK 0..10000). The UI surfaces the live value in the
  account page's `BirthdayGiftCard` in all three states.

---
---
---

# Prior session 129 close-out preserved below ↓

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
