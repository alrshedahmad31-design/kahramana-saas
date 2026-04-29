# Browsing Agent — Task Backlog
> Last updated: 2026-04-29
> Owner: any agent that can: open URLs, log into dashboards, run SQL on Supabase Studio,
>        configure DNS, send test emails, take screenshots
> Scope: external configuration + verification. NOT code work.

Each task lists Where, Steps, Acceptance, Failure-Recovery. Run in priority order.

---

## P0 — Production blockers

### BA-01 — Verify migration 028 applied + confirm RLS lockdown is live
- **Where:** Supabase Studio → SQL Editor (project `wwmzuofstyzworukfxkt`)
- **Steps:**
  ```sql
  -- 1. Confirm new policies exist
  SELECT policyname, tablename FROM pg_policies
  WHERE policyname IN (
    'orders_select_own_customer','orders_select_staff','orders_update_staff_only',
    'order_items_select_own_customer','order_items_select_staff',
    'branches_write_admin_only','menu_sync_write_admin_only',
    'contact_messages_select_staff','contact_messages_update_staff'
  );

  -- 2. Confirm permissive policies removed
  SELECT policyname FROM pg_policies
  WHERE policyname IN (
    'orders_select_authenticated','orders_update_authenticated',
    'order_items_select_authenticated','branches_write_staff',
    'menu_sync_write_authenticated','contact_messages_select_authenticated',
    'contact_messages_update_authenticated'
  );
  -- expected: empty result
  ```
- **Acceptance:** query 1 returns 9 rows, query 2 returns 0 rows
- **Failure recovery:** if policies missing, re-run `npx supabase db push --linked` from project root

### BA-02 — Verify migration 025 columns are present
- **Where:** Supabase Studio → SQL Editor
- **Steps:**
  ```sql
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name='orders'
  AND column_name IN (
    'delivery_building','delivery_street','delivery_area',
    'expected_delivery_time','customer_notes','driver_notes'
  )
  ORDER BY column_name;
  ```
- **Acceptance:** 6 rows. text columns are `text`. `expected_delivery_time` is `timestamp with time zone`
- **Failure recovery:** push migrations if missing

### BA-03 — Configure Supabase SMTP (Resend)
- **Where:** Supabase Dashboard → Project Settings → Authentication → SMTP Settings
- **Steps:**
  1. Enable Custom SMTP: ON
  2. Host: `smtp.resend.com`
  3. Port: `465`
  4. Username: `resend`
  5. Password: paste `RESEND_API_KEY`
  6. Sender email: `noreply@kahramanat.com`
  7. Sender name: `كهرمانة بغداد` / `Kahramana Baghdad`
  8. Save
  9. Authentication → Users → "Invite User" → enter your own email
  10. Wait 90 s, check inbox + spam
- **Acceptance:**
  - email arrives within 2 min
  - subject is Arabic ("كهرمانة بغداد — تفعيل الحساب" or similar)
  - body renders RTL with gold button on dark background (matches `emails/rendered/invite-staff.html`)
  - clicking button opens `/auth/callback?code=...`
- **Failure recovery:**
  - email in spam → check `BA-05` (Resend DNS)
  - email never arrives → Project → Logs → Auth Logs → look for SMTP error
  - rendering broken → re-paste from `emails/rendered/invite-staff.html` exact bytes

### BA-04 — Configure Supabase Auth URLs
- **Where:** Supabase Dashboard → Authentication → URL Configuration
- **Steps:**
  - **Site URL:** `https://kahramanat.com`
  - **Redirect URLs (allow-list):** add all of:
    - `https://kahramanat.com/auth/callback`
    - `https://kahramanat.com/en/auth/callback`
    - `https://kahramana.vercel.app/auth/callback`
    - `https://kahramana.vercel.app/en/auth/callback`
    - `http://localhost:3000/auth/callback` (dev)
- **Acceptance:** `{{ .ConfirmationURL }}` in invite emails resolves to `kahramanat.com/auth/callback?code=...`, not `*.supabase.co`

### BA-05 — Verify Resend domain DNS
- **Where:** https://resend.com/domains → `kahramanat.com`
- **Steps:**
  1. Confirm domain status: **Verified** (green)
  2. Confirm SPF, DKIM (3 CNAMEs), DMARC TXT records: all green
  3. If any red: copy exact TXT/CNAME values → set on registrar (Cloudflare / GoDaddy / wherever) → wait 30 min → re-check
- **Acceptance:** all 4 DNS rows green
- **Failure recovery:** propagation can take up to 24 h; use https://dnschecker.org to verify globally

### BA-06 — Apply migrations 016–028 to production (if not done)
- **Where:** local terminal in repo root
- **Steps:**
  ```bash
  npx supabase db push --linked
  ```
  (already-applied migrations are no-ops; `028_security_lockdown` is critical)
- **Acceptance:** `npx supabase migration list --linked` shows all 28 applied
- **Failure recovery:** errors are usually idempotency / enum mismatches; report exact error to Claude Code with migration file name

### BA-07 — Enable Realtime replication on critical tables
- **Where:** Supabase Dashboard → Database → Replication
- **Steps:** Toggle ON for:
  - `orders`
  - `order_items`
  - `kds_queue` (if exists)
- **Acceptance:** Dashboard shows ✓ for each. Open `/dashboard/orders` in two browser windows → status change in one reflects in the other within 2 s.

### BA-08 — Verify `.env` parity Vercel ↔ local
- **Where:** Vercel Dashboard → Project → Settings → Environment Variables
- **Steps:** confirm all of these exist for **Production**:
  ```
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  NEXT_PUBLIC_SITE_URL=https://kahramanat.com
  TAP_SECRET_KEY
  PAYMENT_WEBHOOK_SECRET
  RESEND_API_KEY
  EMAIL_FROM=noreply@kahramanat.com
  NEXT_PUBLIC_GA_ID            (after BA-12)
  NEXT_PUBLIC_CLARITY_ID       (after BA-12)
  NEXT_PUBLIC_SENTRY_DSN       (after Sentry account)
  SENTRY_AUTH_TOKEN
  ```
- **Acceptance:** zero missing rows. trigger a redeploy after any change.

---

## P1 — SEO Activation

### BA-09 — Register on Google Search Console
- **Where:** https://search.google.com/search-console
- **Steps:**
  1. Add property `https://kahramanat.com`
  2. Verify via DNS TXT record (preferred) or HTML meta tag
  3. Submit sitemap `https://kahramanat.com/sitemap.xml`
  4. Wait 2–5 days for first crawl
- **Acceptance:** Coverage report shows ≥ 386 valid URLs indexed

### BA-10 — Register on Bing Webmaster Tools
- **Where:** https://www.bing.com/webmasters
- **Steps:** Same as BA-09 but for Bing. Sitemap submission identical.
- **Acceptance:** Bing index shows the site

### BA-11 — Set up Google Business Profile per branch
- **Where:** https://business.google.com
- **Steps for each branch (Riffa, Qallali):**
  1. Create new business: name "Kahramana Baghdad - Riffa" (or Qallali)
  2. Address from `src/constants/contact.ts`
  3. Phone from constants (no fake numbers)
  4. Hours from constants (Riffa: 19:00–01:00, Qallali: 12:00–01:00)
  5. Category: Iraqi Restaurant + Restaurant
  6. Verify by postcard or phone
  7. Add ≥ 5 dish photos + branch photo
  8. Set website link to `https://kahramanat.com/branches`
- **Acceptance:** both branches verified and visible on Google Maps

### BA-12 — Create Google Analytics 4 + Microsoft Clarity
- **Where:** https://analytics.google.com (GA4) and https://clarity.microsoft.com
- **Steps:**
  1. GA4: create property → get `G-XXXXXXXXXX` measurement ID
  2. Clarity: new project → get project ID
  3. Add to `.env.local` and Vercel env: `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_CLARITY_ID`
  4. Hand off to Claude Code (CC-04) to inject scripts
- **Acceptance:** real-time visitor shows in both dashboards after deploy

### BA-13 — Enable Vercel Speed Insights
- **Where:** Vercel Dashboard → Project → Speed Insights
- **Steps:** toggle ON. Zero code change needed.
- **Acceptance:** CWV (LCP, INP, CLS) numbers populate within 24 h

---

## P2 — E2E QA before client handoff

### BA-14 — Auth flow end-to-end test
- **Where:** Incognito browser → `https://kahramana.vercel.app`
- **Test matrix:**
  | # | Action | Expected |
  |---|--------|----------|
  | 1 | `/login` → owner credentials | redirects to `/dashboard`, no console errors |
  | 2 | DevTools → Application → Cookies | `sb-access-token` + `sb-refresh-token` present |
  | 3 | Hard refresh dashboard | still logged in |
  | 4 | Open second incognito → change order status as cashier | first tab updates within 2 s |
  | 5 | Logout | redirects `/login`, cookies cleared |
  | 6 | Visit `/dashboard` while logged out | redirects `/login?redirect=/dashboard` |
  | 7 | `/dashboard/staff` while cashier | redirects `/dashboard` (RBAC) |
  | 8 | `/dashboard/staff` invite test email | email arrives Arabic with gold button |
  | 9 | Click activation link → set password | lands on `/dashboard` |
- **For each failure:** capture console + network + screenshot → file issue with exact reproduction steps

### BA-15 — Order placement E2E (customer side)
- **Where:** Incognito → `https://kahramana.vercel.app/menu`
- **Steps:**
  1. Browse menu → add 2 items to cart
  2. Checkout → fill name + Bahrain phone
  3. Choose Riffa branch → pay cash
  4. Confirmation page shows order ID
  5. WhatsApp link opens with pre-filled message
  6. As staff in another tab: order appears in `/dashboard/orders` Kanban "New" column within 2 s (Realtime)
- **Acceptance:** end-to-end, no errors, order persisted, Realtime works

### BA-16 — Schema.org Rich Results validation
- **Where:** https://search.google.com/test/rich-results
- **Test URLs:**
  - `https://kahramanat.com/`
  - `https://kahramanat.com/branches`
  - `https://kahramanat.com/menu`
  - `https://kahramanat.com/menu/item/grills-kahramana-mix` (sample dish)
  - `https://kahramanat.com/contact`
- **Acceptance:** each URL returns ≥ 1 valid Rich Result type. Zero errors. Warnings acceptable.

### BA-17 — Lighthouse CWV audit on key pages
- **Where:** Chrome DevTools → Lighthouse → Mobile + Desktop
- **Pages to test:** `/`, `/menu`, `/menu/item/<slug>`, `/branches`, `/contact`
- **Acceptance:** Performance ≥ 80 mobile, ≥ 95 desktop. SEO 100. Accessibility ≥ 95.
- **Failure:** capture report JSON → file issue with target metric and current value

---

## Reporting Format
For each task, post results as:
```
[BA-XX] STATUS: ✅ pass | ⚠ partial | ❌ fail
Notes:
  - what was done
  - any unexpected output
  - links to screenshots / logs
Next blocker (if any): [BA-YY needs Ahmed's input]
```
