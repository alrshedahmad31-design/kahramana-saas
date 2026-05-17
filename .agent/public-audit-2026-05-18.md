# Public-Surface Hygiene Audit — 2026-05-18
> Auditor: Claude Opus 4.7 (session 144, read-only)
> Master: c55f0c9
> Scope: public routes + server actions + customer-triggered API routes
> Out of scope: dashboard, driver, waiter, clock, KDS, POS, cron, webhooks, staff `/login`

## Summary

| Severity | Count |
|---|---|
| P0 (deploy blocker) | 0 |
| P1 (this sprint) | 6 |
| P2 (hygiene) | 9 |
| **Total** | 15 |

No P0 issues. The session-142 T1/T2 hardening sweep closed the exploitable gaps; remaining items are defense-in-depth and cleanup. Project is in solid shape for a public-surface audit at this stage.

## Findings by surface

### Surface: /payment/[orderId]

#### P1
- **PUB-001** — `console.warn` / `console.error` swallow payment errors
  - File: `src/app/[locale]/payment/[orderId]/page.tsx:40, 83`
  - Evidence: `console.warn('[Payment Page] Order not found or error:', orderErr)` on the order-fetch fail path; `console.error('[Payment Page] Fatal Error:', err)` in the top-level catch.
  - Why P1: Per `CLAUDE.md` rules, customer-path errors must route to Sentry via `captureAnalyticsError`. A Tap charge that fails during page render disappears from observability.
  - Suggested fix: Replace the two console calls with `Sentry.captureException` (with stage tag) and keep the `notFound()` fallback.

- **PUB-002** — `orderId` not UUID-validated before `.eq('id', orderId)`
  - File: `src/app/[locale]/payment/[orderId]/page.tsx:33`
  - Evidence: route param `orderId` is passed straight into `supabase.from('orders').select(...).eq('id', orderId)` with no UUID guard. `/order/[id]/page.tsx:43-44` does this correctly; this sibling route does not.
  - Why P1: Postgres accepts the bad cast and returns `invalid_input_syntax_for_type_uuid`. With the current catch the user sees `notFound()`, but the unsanitized string is also passed to `appendOrderAccessToken` and the PaymentHandler component — easy to drift into a leaked-error vector on a future refactor.
  - Suggested fix: Apply the same UUID regex guard `/order/[id]/page.tsx` uses, returning `notFound()` before the Supabase call.

### Surface: /account/login (customer login) + /forgot-password

#### P1
- **PUB-003** — `forgotPasswordAction` rate-limit fails OPEN when Upstash env missing
  - File: `src/app/[locale]/forgot-password/actions.ts:41-50`
  - Evidence: `if (process.env.NODE_ENV !== 'production' || !process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return true`. Mirrors the pre-T1 pattern that contact/reserve/catering already migrated away from.
  - Why P1: Session-142 T1 established that production must fail-closed when Upstash is unconfigured. This action — the password-reset emailer, an obvious abuse target — silently allows unlimited resets if env vars are dropped during a Vercel project move.
  - Suggested fix: Adopt the contact/reserve fail-closed pattern with a `Sentry.captureMessage('forgot.rate_limit_unconfigured')` warning.

- **PUB-004** — `account/login/actions.ts checkRateLimit` also fails OPEN
  - File: `src/app/[locale]/account/login/actions.ts:66-90`
  - Evidence: `if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return true` — applies to both `loginAction` and `registerAction`. The hashed-email gate (`checkEmailRateLimit` at line 97) does the same.
  - Why P1: Same regression-risk shape as PUB-003 on a credential-stuffing-grade surface. Staff `/login` (`src/app/[locale]/login/actions.ts:34-37`) already fails closed here — customer login should match.
  - Suggested fix: Mirror the staff-login fail-closed branch with `Sentry.captureMessage` plus `return false` when env is missing in production.

#### P2
- **PUB-005** — `registerAction` skips Zod for email/name/phone
  - File: `src/app/[locale]/account/login/actions.ts:162-194`
  - Evidence: `loginSchema` parses login email/password through Zod, but `registerAction` only manually checks `password.length`, `name.length > 120`, and a phone regex. Email enters Supabase signup without a `.email()` parse or `.max(254)` cap.
  - Why P2: Supabase rejects malformed emails, so no exploit — just inconsistent with `loginSchema` and harder to maintain.
  - Suggested fix: Promote the manual checks to a `registerSchema` Zod object mirroring `loginSchema`.

### Surface: /contact

#### P2
- **PUB-006** — `contact_messages.branch_id` lacks length cap
  - File: `src/app/[locale]/contact/actions.ts:15`
  - Evidence: `branch_id: z.string().optional().or(z.literal(''))` — no `.max()`. Branch IDs are short identifiers (`riffa`, `qallali`); a 1MB string would still validate.
  - Why P2: Backed by FK `branches(id)` so an oversized value would fail the constraint, not corrupt data. Hygiene only.
  - Suggested fix: Add `.max(50)` to align with `reserve` (`actions.ts:18`) and `catering` (`actions.ts`).

### Surface: /reserve

#### P2
- **PUB-007** — `createPublicReservation` localizes RPC errors via string-match
  - File: `src/app/[locale]/reserve/actions.ts:210-216`
  - Evidence: `if (message.includes('RESERVATION_CONFLICT'))` etc. — sentinel detection by substring of `error.message`.
  - Why P2: Works today because the RPC raises a fixed sentinel, but a future RPC refactor that wraps the error context will silently degrade to the generic `server_error` branch. The checkout-side equivalent (`checkout/actions.ts:723-735`) has the same pattern but is paired with code checks too.
  - Suggested fix: Have the RPC `RAISE` with a SQLSTATE code (`P0001` + a structured `MESSAGE`) and switch the JS to a code-based match.

### Surface: /menu + /menu/[slug]

#### P2
- **PUB-008** — `q` searchParam passes through to client without trim/length cap
  - File: `src/app/[locale]/menu/page.tsx:14, 56, 90`
  - Evidence: `searchParams: Promise<{ q?: string }>` → `MenuPageClient initialQuery={q}` → `MobileSearchOverlay initialQuery={initialQuery}`. No length cap, no trim.
  - Why P2: It's a search box pre-fill, no DB query happens server-side. A 1MB `q` is just bad UX, not an exploit.
  - Suggested fix: Clamp to `q?.slice(0, 100)` on the server before passing down.

### Surface: /order/[id]

#### P2
- **PUB-009** — `as unknown as OrderWithItems` cast hides Supabase type drift
  - File: `src/app/[locale]/order/[id]/page.tsx:65`
  - Evidence: `order = data as unknown as OrderWithItems` after the explicit-column select.
  - Why P2: The select column list is hand-written; if those columns drift from `OrderWithItems`, TypeScript won't catch it. Not exploitable.
  - Suggested fix: Define a narrow row type matching the exact select list (or migrate to a typed helper) so the cast becomes a structural assert, not a blind one.

### Surface: /set-password

#### P2
- **PUB-010** — `setPasswordAction` has no `.max(72)` on `newPassword`
  - File: `src/app/[locale]/set-password/actions.ts:26`
  - Evidence: `if (typeof newPassword !== 'string' || newPassword.length < 8)` — only a minimum is enforced.
  - Why P2: Supabase truncates to bcrypt's 72-byte limit; no exploit. But the rest of the codebase caps at 72 (`loginSchema`, `account/login/actions.ts`).
  - Suggested fix: Add `newPassword.length > 72` to the early-reject branch with a `too_long` error code.

- **PUB-011** — `setPasswordAction` has no rate-limit or audit log
  - File: `src/app/[locale]/set-password/actions.ts:22-89`
  - Evidence: Password rotation requires a verified live session or the HMAC recovery cookie. No Upstash gate.
  - Why P2: The recovery cookie is HMAC-bound to the user_id (L1) and one-shot, so abuse surface is small. Worth adding a per-user limiter for credential-spray attempts that bypass the session check.
  - Suggested fix: Add a 5/15m sliding limiter keyed on the live session user id.

### Surface: /checkout

#### P2
- **PUB-012** — `console.error` allowed only via Sentry — checkout action is clean, but `error.tsx` boundary uses raw console
  - File: `src/app/[locale]/checkout/error.tsx:17`
  - Evidence: `console.error('[CheckoutError]', error)` in the Next.js error boundary.
  - Why P2: Error boundaries are an accepted exception per CLAUDE.md spirit, but `captureException` would give a Sentry trail for the cart-abandonment funnel.
  - Suggested fix: Add `Sentry.captureException(error, { tags: { stage: 'checkout.error_boundary' } })` alongside the console.

### Surface: cross-cutting

#### P1
- **PUB-013** — Inconsistent `force-dynamic` declaration
  - File: `src/app/[locale]/order/[id]/page.tsx`, `src/app/[locale]/payment/[orderId]/page.tsx`, `src/app/[locale]/account/page.tsx`, `src/app/[locale]/checkout/page.tsx`
  - Evidence: All four pages read cookies / call user-specific data but lack an explicit `export const dynamic = 'force-dynamic'`. By contrast `/menu/[slug]` and `/menu/item/[slug]` declare it explicitly.
  - Why P1: Next 15 marks these dynamic implicitly via `headers()` / `cookies()`. It works today, but a refactor that hoists the session call into a layout would silently regenerate a stale ISR page exposing one user's order data to another.
  - Suggested fix: Add `export const dynamic = 'force-dynamic'` to these four pages as a structural pin.

- **PUB-014** — `account/login/actions.ts:30` Turnstile soft-launch fall-through
  - File: `src/app/[locale]/account/login/actions.ts:28-32`
  - Evidence: `async function verifyTurnstile(token) { const secret = process.env.TURNSTILE_SECRET_KEY; if (!secret) return true; ... }`. Same shape as the pre-T1 contact action that was hardened in `fb3995f`.
  - Why P1: Contact/reserve/catering Turnstile checks now fail closed in production when the secret isn't set. Account login + register currently fall through silently — a Vercel env-var rotation would briefly drop Turnstile on the credential-stuffing surface without alerting.
  - Suggested fix: Mirror the contact `verifyTurnstile` fail-closed branch (`if (!secret) { if (NODE_ENV === 'production') return false; return true }`).

#### P2
- **PUB-015** — Phone regex `PHONE_RE` declared in three actions; should be one shared constant
  - File: `src/app/[locale]/contact/actions.ts:9`, `src/app/[locale]/reserve/actions.ts:15`, `src/app/[locale]/catering/actions.ts:44`
  - Evidence: Identical `/^[\d +\-()+]{7,30}$/` literal in three files (also normalizePhone duplicated across checkout/account).
  - Why P2: Drift risk — a tightening in one file won't propagate.
  - Suggested fix: Move to `src/lib/validation/phone.ts` and re-export.

## Surfaces audited with no findings

- `/` (home) — static schemas + ISR, no input
- `/about` — static narrative content
- `/privacy-policy`, `/terms`, `/refund-policy` — static MDX-like content
- `/branches` + `/branches/[branchId]` — static branch directory; `[branchId]` is keyed against `BRANCHES` whitelist before render
- `/catering` page — render only; `/catering/actions.ts` matches the post-T2 reserve pattern correctly
- `/contact` page — render only; `/contact/actions.ts` clean other than PUB-006
- `/reserve` page — render only; `/reserve/actions.ts` clean other than PUB-007
- `/auth/callback` — already pins redirects to `NEXT_PUBLIC_SITE_URL`, HMAC-binds recovery cookie, redacts exchange-error reason

## Notes

- The session-142 T1/T2 sweep visibly raised the floor. Every public write surface I read either fails closed correctly or has an explicit reason it doesn't (set-password gated by recovery cookie; menu has no write at all).
- The `console.warn` / `console.error` in `/payment/[orderId]/page.tsx` is the only finding that looks like the previous-author missed a Sentry conversion — every other action file routes through `Sentry.captureException` consistently.
- PUB-013 (missing `force-dynamic`) is on the edge between P1 and P2. Marked P1 because the failure mode if a future refactor breaks the implicit-dynamic guarantee is "leaked order data," not just "stale page." Easy to add four exports as a pin.
- Worth Ahmed's eye: `forgot-password` Turnstile (`actions.ts:13-16`) is also a soft-launch fall-through (`if (!secret) return true`) — bundled into PUB-014's family but in a separate file. If you take PUB-014, take this too.
