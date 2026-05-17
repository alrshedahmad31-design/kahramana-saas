# LAST-SESSION.md — Kahramana Baghdad
> Session 142: Acted on session-141 audit — Tier 1 + Tier 2 fixes landed
> end-to-end. Working tree contains all changes; **no commits yet** per the
> standing `git add -p always` rule. 7 commit messages prepared (see below).
> Two new migrations applied to remote: 172 + 173.
> Date: 2026-05-17
> Author: Claude Code (Opus 4.7, 1M context)

## SESSION 142 — SUMMARY

Followed session 141 directly. Worked the Tier 1 + Tier 2 checklist from the
public-facing audit. All 15 items landed in one session.

### Tier 1 — fail-open holes (5/5 done)

**T1-1: Turnstile fail-closed in production**
- `contact/actions.ts`, `reserve/actions.ts`, `catering/actions.ts`
- `verifyTurnstile()` now returns `false` when `NODE_ENV=production` and
  `TURNSTILE_SECRET_KEY` is unset. Dev/preview still fall back to
  honeypot-only so local testing isn't blocked.

**T1-2: Upstash rate-limit fail-closed**
- Same 3 files. Every Upstash branch is now `try/catch`-wrapped and
  production returns `rate_limit` on either missing env vars or thrown
  errors. Missing-env path also logs Sentry warning.

**T1-3: Rate-limit on `createQROrder`**
- `table/actions.ts` — two sliding windows keyed `(ip:branchId:tableNumber)`:
  burst (5/min) + sustained (30/hour). Fail-closed in prod with Sentry.

**T1-4: Staff /login server action**
- New file: `src/app/[locale]/login/actions.ts` — `staffLoginAction`
  wraps `signInWithPassword` with Zod (`email().max(254)`, `password.max(72)`)
  + Upstash 10/15min/IP + try/catch.
- `src/components/auth/LoginForm.tsx` now calls the action; the direct
  client-side `supabase.auth.signInWithPassword` is gone.

**T1-5: Column allowlist on `/order/[id]`**
- `src/app/[locale]/order/[id]/page.tsx` — explicit column list for
  both `orders` and `order_items`. Staff-only fields excluded:
  `driver_notes`, `actual_collected`, `cash_handed_over`,
  `handed_over_at`, `delivery_proof_url`, `customer_signature`.

### Tier 2 — abuse vectors (10/10 done)

**T2-1: CRLF guard on contact name** — `.refine(v => !/[\r\n]/.test(v))`.
**T2-2: Phone regex whitelist** — `/^[\d +\-()+]{7,30}$/` on contact,
reserve, catering.
**T2-3: Rate-limit `publicFindAvailableTables`** — 30/min/IP sliding window
prefixed `reserve_find:`.
**T2-4: Cron secret `timingSafeEqual`** — birthday-notify route now compares
the Bearer header with `crypto.timingSafeEqual` on equal-length Buffers
(matches `verifyWebhookSignature` in `tap-client.ts`).
**T2-5: Cron error sanitization** — no more `{ message: error.message }`
on 500; Sentry capture + generic code only.
**T2-6: Cron send-idempotency** — **migration 172** adds `notified_at
TIMESTAMPTZ` + partial index `WHERE notified_at IS NULL`. Cron route
filters by `.is('notified_at', null)` and UPDATEs after successful Resend.
Vercel Cron retries no longer re-send to the same customer.
**T2-7: Honeypot fake-success** — reserve + catering now return a fake
`success: true` on honeypot trip (mirrors contact behaviour). Bots stop
retrying without learning the real response shape.
**T2-8: Slug length cap** — `if (slug.length > 200) notFound()` on
`menu/[slug]/page.tsx` and `menu/item/[slug]/page.tsx`.
**T2-9: Account login Turnstile + email rate-limit** — Turnstile now
required for login mode (not just register); second rate-limit dimension
keyed on `sha256(email)` at 10/hour; Zod validation.
**T2-10: Tap webhook replay dedup** — **migration 173** changes
`process_tap_webhook` to short-circuit on ANY prior `payment_webhooks` row
with matching `gateway_id`, not just rows with `processed=true`.

### Files changed

```
modified:
  src/app/[locale]/contact/actions.ts
  src/app/[locale]/reserve/actions.ts
  src/app/[locale]/catering/actions.ts
  src/app/[locale]/table/actions.ts
  src/app/[locale]/order/[id]/page.tsx
  src/app/[locale]/menu/[slug]/page.tsx
  src/app/[locale]/menu/item/[slug]/page.tsx
  src/app/[locale]/account/login/actions.ts
  src/app/[locale]/account/login/AccountLoginClient.tsx
  src/app/api/cron/birthday-notify/route.ts
  src/components/auth/LoginForm.tsx

new:
  src/app/[locale]/login/actions.ts
  supabase/migrations/172_birthday_point_credits_notified_at.sql
  supabase/migrations/173_tap_webhook_replay_dedup.sql
```

### Gates (all green)

- `npx tsc --noEmit` — clean.
- `npx tsx scripts/check-i18n.ts` — gate 8 PASS (2,541 keys parity).
- `NEXT_BUILD_WORKERS=1 npm run build` — Ready (no errors; turbopack
  parallel build had an unrelated chunk-load race, NEXT_BUILD_WORKERS=1
  recovers — same workaround as session 140).

### Commit groups prepared (NOT yet committed)

Per standing `git add -p always` rule, no commits were made. Suggested groups:
1. `fix(security): T1-1/2 — Turnstile + Upstash fail-closed in production`
2. `fix(security): T1-3/4 — QR order rate-limit + staff login server action`
3. `fix(security): T1-5 — order tracking column allowlist (no staff fields)`
4. `fix(security): T2-1/2/3 — CRLF + phone whitelist + findAvailableTables rate-limit`
5. `fix(security): T2-4/5/6 — cron timingSafeEqual + error sanitize + notified_at (migration 172)`
6. `fix(security): T2-7/8/9 — honeypot fake-success + slug cap + account login hardening`
7. `fix(security): T2-10 — tap webhook replay dedup regardless of processed flag (migration 173)`

### Migration parity note

Migrations 172 + 173 are applied to remote via MCP under timestamped
suffixes (`20260517193957`, `20260517194237`) — same harmless drift
introduced in past sessions for `20260505190424` /
`20260508120000`. Local files use the `172_` / `173_` prefix matching the
project's monotonic numbering. `supabase migration list --linked` will
flag the mismatch cosmetically; it has no production impact.

### Implementation notes / caveats

- **`birthday_point_credits.notified_at` cast** — the cron UPDATE casts
  to `Record<string, never>` because `src/lib/supabase/types.ts` was not
  regenerated this session (MCP `generate_typescript_types` output
  exceeded context). Safe at runtime; a future type regen will clean it
  up.
- **`OrderWithItems` join syntax** — collapsed to a single literal-string
  `.select()` so the supabase-js type parser still produces a row type.
  An array `.join(', ')` build broke type inference (returned
  `ParserError<...>`).
- **`account/login` Turnstile widget** — now rendered in both login and
  register modes when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set. Existing
  `tAuth('captchaRequired')` / `tAuth('rateLimited')` keys reused.

## OPERATOR PENDING (unchanged from session 141)

- Supabase Free → Pro + Singapore migration
- Resend domain verification for kahramanat.com
- 13 staff emails from owner → run staff seed (migration 090)
- TAP merchant keys → wire refund
- WhatsApp Business API + Benefit Pay merchant approval
- ~12 missing dish photos

## NEXT SESSION

- Review the working tree with `git add -p` and stage the 7 commit groups.
- Optional: regenerate `src/lib/supabase/types.ts` to drop the
  `notified_at` cast in the cron route.
- Optional: tackle Tier 3 (the 19 P2 hygiene findings from session 141)
  if the audit list is still worth closing out before soft-launch.

If no further dev wanted, the soft-launch posture is now stricter than
the session-140 baseline — every public write surface fails closed under
misconfiguration, Tap webhooks are dedup-locked, cron sends are
idempotent, and `/order/[id]` no longer leaks staff fields.
