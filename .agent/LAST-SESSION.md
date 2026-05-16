# LAST-SESSION.md — Kahramana Baghdad
> Session 124: Audit remediation sweep — 6 HIGH + 6 MEDIUM closed. Master `f948cc1` → `cdb6b3b`.
> Date: 2026-05-16
> Author: Claude Code (Opus 4.7, 1M context)

## SESSION 124 — SUMMARY

Pure audit-remediation session. Twelve focused fixes, twelve commits, all pushed.
One new migration (155). No regressions: tsc + `next build` (`NEXT_BUILD_WORKERS=1`)
clean after every commit. Local DB and code both updated; types regenerated.

Session 123 left a 6 HIGH / 16 MEDIUM / 21 LOW / 14 INFO queue. This session
closed all 6 HIGH and 6 of the MEDIUMs.

---

## COMMITS (12 on master, all pushed)

### HIGH-severity payment-flow cluster

| Hash | VULN | Summary |
|------|------|---------|
| `58ac2ee` | VULN-001 | `initializePayment` rejects online→cash flips on an existing payment row; removed the customer-side `orders.status='confirmed'` side-effect (COD confirmation now lives only in `completeCashPayment`) |
| `1e7f46b` | VULN-002 | `completeCashPayment` role allowlist (`owner / general_manager / branch_manager / cashier / waiter`) + branch-scope assertion for non-global roles + CAS pin on `status='pending_cod'` (not `pending`) |
| `232ae22` | VULN-003 | `confirmBenefitPayment` CAS now pins `method='benefit_qr'` — Tap payments can no longer be self-parked into `awaiting_manual_review` |

### HIGH — coupon race + abandoned dep

| Hash | VULN | Summary |
|------|------|---------|
| `18ed4ec` | VULN-004 | **Migration 155** — snapshot `per_customer_limit INTEGER` column on `coupon_usages`, partial UNIQUE INDEX `idx_coupon_usages_one_per_customer ON (coupon_id, customer_id) WHERE per_customer_limit = 1`, **`coupon_usages` INSERT moved inside `rpc_create_order`** under the existing `FOR UPDATE` lock on coupons (PG row locks live until txn commit, so the audit insert is in the same atomic window as the `usage_count` increment). Types regenerated; trailing `<claude-code-hint />` stripped. Same RPC signature — no caller breakage |
| `bb75e0d` | VULN-004 | Removed the post-RPC `coupon_usages` insert from `checkout/actions.ts` + unused `CouponUsageInsert` import |
| `7ac2459` | VULN-006 | `lucide-react: ^1.11.0 → ^0.460.0`. Resolved 1.11.0 → 0.460.0 in lockfile. tsc clean across all 67 import sites — no icon renames needed for icons this codebase actually uses |

### MEDIUM-severity sweep

| Hash | VULN | Summary |
|------|------|---------|
| `3649f7e` | VULN-007 | `postDriverLocation` zod-parses payload to `{order_id, lat, lng, accuracy_m}`; explicit column upsert; no `...payload` spread. `driver_id` continues to come from session |
| `fcb03c8` | VULN-008 | `permissions: contents: read` added to all three workflows (`audit.yml`, `e2e.yml`, `playwright.yml`) |
| `50f3b02` | VULN-009 | `next.config.ts` images: `contentSecurityPolicy: "default-src 'none'; style-src 'unsafe-inline'; sandbox"` + `contentDispositionType: 'attachment'` paired with the existing `dangerouslyAllowSVG: true` |
| `e749795` | VULN-019 | Tap webhook bails 202 the moment `eventType !== 'charge'` — after IP/rate-limit/shape/signature gates, before any DB write. Non-charge events (refund, dispute, settlement) no longer fall through to `process_tap_webhook` with `p_status='pending'` |
| `7815a25` | VULN-020 | `registerAction` gated by Turnstile (same soft-launch helper as `forgotPasswordAction` — bypasses when `TURNSTILE_SECRET_KEY` unset). New `'captcha'` `AuthError` variant. `AccountLoginClient.tsx` renders the widget in register mode only when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set; widget reset on any failure; existing `captchaRequired` translation key reused |
| `cdb6b3b` | VULN-021 | `toSafeError()` sweep across ~28 sites in 8 files (`dashboard/menu/actions.ts` 11, `dashboard/kds/actions.ts` 6, `dashboard/kds/page.tsx` 1, `dashboard/coupons/actions.ts` 4 Supabase paths only, `driver/actions.ts` 5, `driver/push-actions.ts` 1, `lib/loyalty/restore.ts` 1, `checkout/actions.ts` outermost catch). Sentry/`captureAnalyticsError` sites intentionally untouched |

---

## JUDGMENT CALLS WORTH FLAGGING

1. **VULN-002 — owner / general_manager bypass branch scope.** Task said `staff.branch_id === order.branch_id` literally, but those two roles carry `branch_id = null` by design. Added `isGlobalRole` bypass; otherwise the allowlist would lock owners out of cash settlement. Flag if you want strict equality regardless.
2. **VULN-004 — snapshot column over generated column.** PG `GENERATED ... STORED` can't reference another table, so a literal `WHERE per_customer_limit = 1` predicate needed a column on the indexed table. Added regular `INTEGER NOT NULL DEFAULT 1` populated by the RPC at insert time. No existing duplicates blocked index creation (`probe_dupes.sql` returned 0 rows pre-create).
3. **VULN-007 — heading/speed dropped from zod schema.** Task allowlist mentioned `heading` and `speed`; the `driver_locations` schema has neither (only `lat`, `lng`, `accuracy_m`), and the only client caller in `DriverDashboard.tsx` doesn't send them. Including them would be dead allowlist entries; if you want them captured as columns, that's a separate migration.
4. **VULN-020 — client form touched.** Adding the server gate without rendering a widget would break registration the moment `TURNSTILE_SECRET_KEY` is set in prod. Inserted the widget with the exact JSX shape used by `ForgotPasswordForm`; the surrounding form CSS/layout is untouched. Flag if you'd prefer this split.
5. **VULN-021 — coupon domain-error returns preserved.** Two `err.message` returns in `coupons/actions.ts` come from `assertCouponWithinLimits` throwing curated `COUPON_VALUE_EXCEEDS_LIMIT` / `COUPON_REQUIRES_CAP` / `COUPON_REQUIRES_USAGE_LIMIT` codes — intentional UX strings, not raw Supabase. Left as-is. `dashboard/alerts/actions.ts` similarly untouched (only message ref is inside a Sentry-sibling `captureAnalyticsError`; user-facing return is already a generic `'update_failed'`).

---

## MIGRATION STATE

- Local = Remote = **155 migrations applied**
- Session 124 added: 155 (`coupon_usages` snapshot column + partial unique index + new `rpc_create_order` body)
- Applied via `npx supabase db query -f` then `migration repair --status applied 155 --linked` to sync CLI tracking (precedent: `feedback_migration_repair_workflow.md`)
- Post-apply probe confirmed column exists, unique index exists, rewritten RPC contains the VULN-004 marker
- `supabase gen types` re-run; trailing `<claude-code-hint />` tag stripped per Windows pollution memory

---

## REMEDIATION QUEUE — POST-SESSION-124

**Closed this session:** 6/6 HIGH, 6/16 MEDIUM (VULN-007, -008, -009, -019, -020, -021).

**Still open from session 123 audit (re-verify before treating as work — `feedback_audit_doc_decay.md`):**
- VULN-005 — Tap webhook HMAC consistency check on top-level vs nested `amount.currency`
- VULN-010 — `staff-photos` storage bucket `public=true`
- VULN-013 — no partial unique index on `(assigned_driver_id) WHERE status IN ('out_for_delivery','arrived')` — driver double-dispatch possible
- VULN-015 — clock-in 4-digit PIN with 10/hr/staff budget enables time-card fraud
- ~10 more MEDIUMs from the audit's "Remediation Priority" section
- 21 LOW + 14 INFO

**Two attack chains from session 123 audit:**
- ~~CHAIN-001: VULN-001 alone = free-order primitive.~~ **Closed by `58ac2ee`.**
- CHAIN-002: VULN-001 fixed, but the 72h reusable order-access token (bound to `orderId` only, not customer phone) remains. With VULN-001 closed, the cross-customer payment-takeover path is broken; the token-binding hardening is now a defense-in-depth opportunity, not a critical path.

---

## DEFERRED / NOT TOUCHED

- Remaining audit findings (10 MED + 21 LOW + 14 INFO + token-TTL hardening)
- Birthday gift cron + idempotency + `loyalty_config.birthday_bonus_points`
- Chef Excel recipe import (0/168 mapped; banner from session 123 still surfaces this)
- `.env.test` reuses production Supabase service-role key (PCI 6.4 separation-of-duties concern — operator-side, needs a staging Supabase project)
- TAP keys, Supabase Free → Pro, DNS cutover, `SENTRY_AUTH_TOKEN` re-rotation, `SESSION_BIND_SECRET` — operator-side

---

## SESSION-RELEVANT MEMORIES (existing — no new ones added)

Session 124 didn't surface any new cross-session learnings worth memorizing — the
work was direct application of patterns already memorized:
- `feedback_postrpc_update_pattern.md` — informed the VULN-004 decision to fold
  `coupon_usages` INSERT into the RPC (in this case more than a focused UPDATE was
  warranted: the whole CAS + locking semantic depended on co-location)
- `feedback_supabase_gen_types_pollution.md` — `<claude-code-hint />` stripped from
  regenerated types as expected
- `feedback_migration_repair_workflow.md` — followed `db query -f` + `migration
  repair --status applied N` precisely
- `feedback_autostash_pattern.md` — `git pull --rebase --autostash` used before
  every push

---

## NEXT SESSION POINTERS

1. **Run `tsc --noEmit` + the gate-7 grep suite at session start** to confirm
   nothing in `.agent/CURRENT-SESSION.md` carries over uncommitted.
2. Triage remaining MEDIUM queue (VULN-005, -010, -013, -015 first — they're the
   ones the original audit flagged closest to payment/auth surfaces).
3. Token-TTL hardening for `/payment/[orderId]` access token (CHAIN-002 follow-up).
4. Chef Excel recipe import is still the recipes blocker.
5. Re-verify each audit finding against current code before treating it as a
   work queue (`feedback_audit_doc_decay.md`).
