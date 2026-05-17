━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KAHRAMANA — BRIDGE CONTEXT
Generated: 2026-05-17 (session 132 close-out)
Master: d24e5e3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Claude.ai → Claude Code Context Bridge
# Updated: 2026-05-17 (session 132 close-out)
# Master: d24e5e3

## CURRENT STATUS
Launch Risk: 7/10 (unchanged — no launch-blocker changes)
Phase: pre_launch_operational
Next milestone: Soft-launch (cash-only)

## OPERATOR ACTIONS PENDING (Ahmed — not dev work)

COMPLETED 2026-05-17 (session 130):
- SESSION_BIND_SECRET added to Vercel (Production + Preview) ✅
- SENTRY_AUTH_TOKEN rotated + added to Vercel (Production + Preview) ✅
- Vercel redeploy triggered successfully ✅

COMPLETED 2026-05-15:
- Supabase new signups disabled
- order_item_station_status added to Realtime (8→9 tables)
- Turnstile keys live (NEXT_PUBLIC_TURNSTILE_SITE_KEY + TURNSTILE_SECRET_KEY)
- DNS kahramanat.com → Vercel

STILL PENDING:
- Supabase Free → Pro + Singapore migration
- TAP keys (blocked — merchant approval)
- Staff accounts — 13 staff emails pending from owner (blocks waiter/cashier
  activation + the QR loyalty flag flip)
- Resend domain verification for kahramanat.com (transactional email +
  birthday cron sends — without this Resend will reject FROM=noreply@kahramanat.com)
- VAPID keys for driver push notifications (Web Push)
- CONTACT_NOTIFY_EMAIL (optional — contact-form forwarding destination)
- After staff accounts: flip NEXT_PUBLIC_ENABLE_QR_LOYALTY_SCAN=true per
  pre-flip checklist in `.env.example`

ADDED 2026-05-17 (session 132):
- CRON_SECRET env var (Vercel Production + Preview).
  Generate: `openssl rand -hex 32`
  Required by /api/cron/birthday-notify. Without it the route 503s
  every request, including the scheduled Vercel Cron, so birthday
  emails never go out. pg_cron still credits points silently.

## ACTIVE DEV PRIORITIES (in order)

COMPLETED 2026-05-17 (session 132 — five-commit sweep, all pushed):
✅ P4-2 — Localize 7 raw-English checkout errors (9a93fe1)
   - PRICE_MISMATCH, Insufficient points, Coupon invalid, AUTH_REQUIRED,
     Customer session required, Minimum redemption, Order creation failed
   - Server emits lowercase codes; CheckoutForm's localizeCheckoutError
     maps to checkout.errors.* i18n keys (AR/EN parity).
   - min_redemption:<n> code carries dynamic count via prefix-parse.
   - fetchAndComputeCouponDiscount: 10 inner strings collapsed to
     single 'coupon_invalid' code (customer-friendly).

✅ F-01 — GA4 + Clarity preconnect leak gated behind cookie consent (92c6fba)
   - <Analytics> already gated script injection on localStorage[cookie-consent].
   - The leak: <link rel="preconnect"> in <head> rendered server-side for
     every visitor regardless of consent → DNS + TLS to googletagmanager.com
     and clarity.ms before user accepts.
   - Fix: moved both preconnects into <Analytics>; now render only after
     `consented === true`. First-time visitors get zero third-party
     connections until they tap Accept.

✅ /dashboard/catering — Catering inquiries listing (1d67b4a)
   - Server component with Suspense, role-gated owner/general_manager only.
   - Reads catering_inquiries via createServiceClient() (migration 160 RLS).
   - Cards show: name, short ref, phone, occasion, event date+time, guests,
     service type, area, preferred branch, budget, received timestamp.
   - <24h "NEW" badge. Bilingual WhatsApp CTA to customer phone.
   - Sidebar entry under customers group; rbac-ui.ts gains 'catering' section.
   - i18n: dashboard.nav.catering + full dashboard.catering namespace.

✅ Birthday notification scaffold (29ac5f2)
   - vercel.json crons: { path: /api/cron/birthday-notify, schedule: '0 6 * * *' }
   - /api/cron/birthday-notify/route.ts: Bearer CRON_SECRET auth, 2h
     created_at lookback on birthday_point_credits. Placeholder response
     reports row count.
   - .env.example: CRON_SECRET block with generation instructions.

✅ Birthday notification content (d24e5e3)
   - emails/templates/BirthdayBonus.tsx: bilingual AR+EN body, two stacked
     CTAs (Visit Account + Continue on WhatsApp).
   - sendBirthdayBonus(to, subject, props) added to src/lib/email/send.ts.
   - Route loop: fetch customer_profiles, build AR+EN copy via
     getTranslations({ locale }), send email + embed wa.me deep-link
     (Riffa default brand WhatsApp + bilingual pre-filled text).
     Per-row try/catch → Sentry on failure → batch continues.
   - email.birthday.* i18n namespace (2,419 → 2,433 keys parity).

## DEFERRED (separate sessions — none are launch blockers):
- ~15 `as any` sites (AUD-V3-007/011) — P4 follow-up
- HIDDEN_BRANCHES cleanup follow-up (~30 redundant `length > 0` guards)
- Extend localizeCheckoutError to remaining raw-English errors NOT in the
  named seven (waiter/actions.ts:222 'Order creation failed' — staff
  surface, different return shape, out of P4-2 scope)
- Birthday notification: notified_at TIMESTAMPTZ column on
  birthday_point_credits if duplicate-send becomes a real concern
  (currently relies on 2h created_at window)
- Catering form audit findings #6 (no email fallback) + #8 (HTML5 validation
  balloon doesn't follow next-intl locale) — deferred from session 126
- Catering occasion_type / service_type normalization (currently locale string)

## ARCHITECTURE DECISIONS (do not reverse)
- CSS: ps/pe/ms/me ONLY — never pl/pr/ml/mr/left/right
- No dynamic imports on dashboard routes
- All DB writes via RPC only (atomic)
- AnalyticsResult<T> pattern for all analytics queries (AUD-V3-008)
- createClient() (anon) for analytics reads where RLS covers it
- createServiceClient() only for: matviews + RPCs without authenticated grant
- x-real-ip before x-forwarded-for for rate limiting
- No console.error swallowing — Sentry via captureAnalyticsError
- git add -p always — never stage sibling work
- Work on master directly — no worktrees unless explicitly requested
- Customer-facing server actions emit lowercase i18n codes; never raw English.
  Client localizeCheckoutError-style mapper resolves to t('errors.<key>').
- Third-party preconnect for analytics/observability MUST be consent-gated.

## KNOWN CEILINGS (do not attempt to fix)
- Lighthouse Score ~49 on mobile simulation = GSAP/Framer Motion floor
- TBT ~1600ms on Slow 4G = animation cost, intentional brand decision
- Recipes empty (0/168 mapped) until chef Excel lands — import surface
  shipped session 130 (P2-1); waiting on chef workbook + operator smoke-test

## MIGRATION STATE
- Local = Remote = 162 migrations applied (no new migrations this session)
- Session 132 added: 0 migrations.

## SESSION HISTORY (last 5)
- Session 128: Waiter QR member scanner scaffold (flag OFF), migration 162
- Session 129: Points auto-cap, cart drawer fix, driver notifications,
  supabase client hardening, .env.local copied into fresh tree
- Session 130: P2-1 chef Excel recipes import, P2-2 banner actionable,
  B-001 + BUG-001 Riffa hours, P3-1 birthday bonus wired to UI,
  P3-2 QR loyalty flag audited; operator cleared SESSION_BIND_SECRET +
  SENTRY_AUTH_TOKEN
- Session 131: P4-1 ForgotPasswordClient.tsx dead-code removed (144 LOC)
- Session 132: P4-2 localize 7 checkout errors + F-01 preconnect leak +
  /dashboard/catering listing + birthday notification (cron route +
  email template + wa.me)

## BRIDGE PROTOCOL
- Claude Code reads this file at session start via: pwsh .agent/sync-context.ps1
- Claude.ai updates this file after every strategic decision
- Never delete this file — append/overwrite sections only

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
