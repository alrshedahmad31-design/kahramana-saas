# Claude Code — Task Backlog
> Last updated: 2026-04-29
> Owner: Claude Code (CLI coding agent)
> Scope: pure-code tasks. No browser, no external accounts, no manual UI.

Each task lists Priority, File(s), Why, Acceptance Criteria. Run in priority order.

---

## P0 — Blockers / Production-critical

### CC-01 — Replace `xlsx` with `exceljs` (CVE remediation)
- **Why:** `xlsx@0.18.5` has unpatched HIGH-severity Prototype Pollution + ReDoS (GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9). No fix available in `xlsx`. Used only in dashboard reports (admin-only path), but still a known-vulnerable dependency in production bundle.
- **Files:**
  - `src/lib/reports/export-excel.ts` (full rewrite against `exceljs` API)
  - `package.json` — remove `xlsx`, add `exceljs@^4.4.0`
  - any caller of `export-excel.ts`
- **Acceptance:**
  - `npm audit --audit-level=high` returns 0 high/critical
  - `npm run build` passes
  - Manual export of one sales / customer / coupon report still produces a valid `.xlsx`
  - Sheet headers, formulas, formatting (currency / dates) match the previous output

### CC-02 — Add ContactForm rate-limit + honeypot (anti-spam)
- **Why:** `src/components/contact/ContactForm.tsx` writes directly to `contact_messages` from the anon client. No rate-limit, no captcha, no honeypot. Open spam vector.
- **Decision needed (ask Ahmed before starting):** Vercel KV (recommended), Upstash Redis, or hCaptcha + honeypot only?
- **Files:**
  - convert form submit to a Server Action `submitContactMessage(payload)`
  - `src/app/[locale]/contact/actions.ts` (new)
  - install `@vercel/kv` or `@upstash/ratelimit`
- **Acceptance:**
  - 5 submissions / IP / hour cap (sliding window)
  - hidden honeypot field rejects bots
  - failing requests return user-friendly error in current locale
  - existing happy-path UX unchanged
  - all existing zod validation preserved

---

## P1 — Important hardening / UX

### CC-03 — Migrate dashboard `<img>` tags to `next/image`
- **Why:** 4 raw `<img>` in dashboard cause CLS + miss optimization. AGENTS.md guardrail.
- **Prereq:** Ahmed must confirm the Supabase Storage host (e.g. `wwmzuofstyzworukfxkt.supabase.co`).
- **Files:**
  - `src/components/delivery/DriverFleetPanel.tsx:85`
  - `src/components/settings/ProfileSettings.tsx:152`
  - `src/components/staff/StaffCardGrid.tsx:132`
  - `src/components/staff/StaffFormWizard.tsx:390`
  - `next.config.ts` — add Supabase host to `images.remotePatterns`
- **Acceptance:**
  - all 4 use `<Image>` with explicit `width`/`height` (or `fill` + `sizes`)
  - alt text comes from data layer (driver.name / member.name / "logo")
  - no console warnings about unconfigured hosts on staging

### CC-04 — Wire up GA4 + Microsoft Clarity scripts
- **Why:** `.env.example` declares `NEXT_PUBLIC_GA_ID` and `NEXT_PUBLIC_CLARITY_ID` but `layout.tsx` never injects the scripts. Analytics dead.
- **Files:**
  - `src/app/[locale]/layout.tsx` — add `<Script>` tags using `next/script` (`strategy="afterInteractive"`)
  - guard with `if (process.env.NEXT_PUBLIC_GA_ID)` so dev still works
- **Acceptance:**
  - GA4 script only loads when env var present
  - Clarity script only loads when env var present
  - CSP `script-src` already allows `googletagmanager.com` and `clarity.ms` (verified)
  - no hydration mismatches

### CC-05 — Add `/forgot-password` and `/set-password` pages
- **Why:** `tests/e2e/auth/password-reset.spec.ts` documents this gap. Without these pages, users completing a Supabase reset link land on `/auth/callback` then redirect to a 404.
- **Files:**
  - `src/app/[locale]/forgot-password/page.tsx` (new — email input form → calls `supabase.auth.resetPasswordForEmail`)
  - `src/app/[locale]/set-password/page.tsx` (new — used after reset link → `supabase.auth.updateUser({password})`)
  - update `src/app/auth/callback/route.ts` to detect reset flow (`?type=recovery`) and redirect to `/set-password`
  - matching i18n keys in `messages/ar.json` + `messages/en.json` under `auth.forgotPassword.*` and `auth.setPassword.*`
- **Acceptance:**
  - `password-reset.spec.ts` passes when `.env.test` is configured
  - both pages match login page styling (same container, same field component)
  - bilingual: AR + EN
  - Supabase email-template `{{ .ConfirmationURL }}` correctly lands on `/set-password`

### CC-06 — Implement /driver RBAC decision
- **Why:** Open question from Brief: should owner be redirected from `/driver`, or allowed?
- **Decision needed:** Ahmed must answer first.
- **Files (option A — owner blocked):** `src/lib/auth/rbac.ts` — change `canAccessDriver` to `user.role === 'driver'` only. Add `canViewDriverDispatch` for managers.
- **Files (option B — owner allowed):** No change; just update brief to match code.
- **Acceptance:** matches Ahmed's chosen behaviour and `tests/e2e/auth/rbac.spec.ts` expectations

---

## P2 — Code quality / maintainability

### CC-07 — Regenerate Supabase TypeScript types + drop `as any` casts
- **Why:** `src/lib/supabase/types.ts` lags behind 28 migrations. 84 `as any` casts mask real type drift. AGENTS.md forbids `as any`.
- **Prereq:** Supabase CLI linked (Ahmed runs `npx supabase link --project-ref wwmzuofstyzworukfxkt` once).
- **Files:**
  - `src/lib/supabase/types.ts` — regenerate via `npx supabase gen types typescript --linked`
  - hunt + remove `as any` across `src/app/[locale]/dashboard/**`, `src/app/clock/actions.ts`, `src/lib/analytics/queries.ts`, `src/lib/reports/validator.ts`
- **Acceptance:**
  - `npx tsc --noEmit` passes
  - `grep -rn 'as any' src/` returns ≤ 5 (only justified casts with comment)

### CC-08 — Tighten CSP further (nonce-based scripts)
- **Why:** Current CSP still allows `'unsafe-inline'` for scripts (needed for inline JSON-LD). Switching to nonce-based eliminates the last XSS surface.
- **Files:**
  - `next.config.ts` — generate nonce per request via middleware
  - `src/middleware.ts` — set `X-Nonce` header
  - all 8 pages with `<script type="application/ld+json">` — pass nonce prop
- **Acceptance:**
  - `'unsafe-inline'` removed from `script-src` in production
  - JSON-LD still validates in Schema.org Rich Results test
  - no console CSP-violation warnings on staging

### CC-09 — SEO copy refresh
- **Why:** SEO audit recommended pattern updates not yet applied to translation files.
- **Files:**
  - `messages/ar.json` and `messages/en.json` under `seo.*`:
    - `homeTitle`: `كهرمانة بغداد — مطعم عراقي في البحرين | الرفاع وقلالي` / `Kahramana Baghdad — Iraqi Restaurant in Bahrain | Riffa & Qallali`
    - `categorySeoTitle` pattern: `{category} في كهرمانة بغداد | مطعم عراقي البحرين`
    - `contactTitle`: include "البحرين" / "Bahrain"
- **Acceptance:** Ahmed approves the copy tone before committing

### CC-10 — Add `loading.tsx` to remaining route groups
- **Why:** UX gap. Some dashboard sub-routes show blank page during transitions.
- **Files (new):**
  - `src/app/[locale]/dashboard/orders/loading.tsx`
  - `src/app/[locale]/dashboard/kds/loading.tsx`
  - `src/app/[locale]/dashboard/schedule/loading.tsx`
  - `src/app/[locale]/dashboard/settings/loading.tsx`
  - `src/app/[locale]/dashboard/staff/loading.tsx`
  - `src/app/[locale]/dashboard/coupons/loading.tsx`
  - `src/app/[locale]/dashboard/delivery/loading.tsx`
- **Acceptance:** all match the existing `analytics/loading.tsx` skeleton style

### CC-11 — Audit and clean unused Tailwind brand tokens
- **Why:** `tailwind.config.ts` has `brand-cream`, `brand-deep`, `brand-dark`, `brand-void`, `brand-soft`, `brand-walnut`, `brand-ember`, `brand-parchment`, `brand-gold-dim` that may be unused.
- **Acceptance:**
  - run usage audit per token
  - drop unused
  - keep `tailwind.config.ts` and `src/lib/design-tokens.ts` perfectly in sync

---

## P3 — Polish

### CC-12 — Strip remaining production `console.log` statements
- **Why:** ~17 still in error boundaries, auth callback, checkout components. Replace with Sentry breadcrumbs once Sentry is configured.
- **Files:** scan with `grep -rn 'console\.' src/ --include='*.ts*' | grep -v "node_modules"`
- **Acceptance:** zero `console.log/warn` in production paths; `console.error` only inside `error.tsx` boundaries

### CC-13 — Replace `IBM_Plex_Sans_Arabic` if any leftover
- **Why:** Off-design-system font.
- **Files:** verify no remaining `next/font/google` imports outside the layout's Cairo+Almarai
- **Acceptance:** `grep -rn "next/font/google" src/` returns only `layout.tsx`

### CC-14 — Add Sentry source-map upload
- **Why:** `productionBrowserSourceMaps: false` is correct, but Sentry needs maps uploaded for stack-trace symbolication. `SENTRY_AUTH_TOKEN` already in `.env.example`.
- **Files:** `next.config.ts` — wrap with `withSentryConfig`
- **Acceptance:** errors in Sentry show real file paths, not minified

---

## Run Order
1. CC-01 (security)
2. CC-02 (security — after Ahmed's rate-limit decision)
3. CC-04, CC-05 (analytics + auth completeness)
4. CC-06 (after Ahmed's RBAC decision)
5. CC-03 (after Ahmed confirms image host)
6. CC-09 (after Ahmed approves copy)
7. CC-07, CC-08, CC-10, CC-11 (polish)
8. CC-12, CC-13, CC-14 (last-mile)

After each completed task: `npm run build` + `npx tsc --noEmit` must both pass.
