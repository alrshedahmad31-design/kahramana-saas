# Deployment Guide — Kahramana Baghdad
> Vercel (frontend + server actions) + Supabase (database + auth + storage)
> Last updated: 2026-04-28 | v1.1-phase5-complete

---

## Architecture Overview

```
Browser / PWA
    │
    ▼
Vercel (sin1 — Singapore)
  ├── Next.js App Router (SSR + server actions)
  ├── Static assets (public/)
  └── Edge middleware (locale + auth redirects)
    │
    ▼
Supabase (ap-southeast-1 — Singapore)
  ├── PostgreSQL — orders, staff, loyalty, coupons
  ├── Auth — staff + customer sessions
  ├── Realtime — KDS live orders
  └── Storage — dish photos (future)
```

---

## Part 1 — Supabase Production Setup

### 1.1 Create the project

1. Go to https://supabase.com/dashboard → **New project**
2. Settings:
   - **Name:** `kahramana-baghdad-prod`
   - **Organization:** your org
   - **Region:** Southeast Asia (Singapore) — `ap-southeast-1`
   - **Database password:** generate a strong random password (save it in 1Password / Bitwarden — you'll never see it again after creation)
3. Wait ~2 minutes for provisioning

### 1.2 Collect production credentials

From **Project Settings → API**:

| Variable | Where to find |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (e.g. `https://xyzxyz.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key — **never expose client-side** |

Save all three now. The service_role key goes to Vercel only (server env).

### 1.3 Install Supabase CLI

```bash
npm install -g supabase
```

Verify:

```bash
supabase --version
```

### 1.4 Link local project to production

```bash
# Login to Supabase CLI
supabase login

# Find your project ref in the dashboard URL:
# https://supabase.com/dashboard/project/YOUR_PROJECT_REF
supabase link --project-ref YOUR_PROJECT_REF
```

### 1.5 Run all migrations

```bash
# Push all 10 migrations in order (001 → 010)
# DO NOT push 006_seed_test_staff.sql — it's dev-only
npx supabase db push
```

> **WARNING:** Migration 006 (`006_seed_test_staff.sql`) is marked dev-only.
> The `supabase db push` command pushes ALL files in `supabase/migrations/`.
> Before pushing, temporarily rename it to skip it:
> ```bash
> mv supabase/migrations/006_seed_test_staff.sql supabase/migrations/006_seed_test_staff.sql.skip
> npx supabase db push
> mv supabase/migrations/006_seed_test_staff.sql.skip supabase/migrations/006_seed_test_staff.sql
> ```
> Or push migration 010 manually via the Supabase SQL Editor after pushing 001–005 + 007–009.

### 1.6 Verify migrations ran

In Supabase dashboard → **Table Editor**, confirm these tables exist:

- `branches` — should have 3 rows (riffa, qallali, badi) from migration 010
- `orders`, `order_items`, `customers`
- `staff_basic`
- `kds_stations`, `kds_order_items`
- `driver_sessions`, `delivery_events`
- `customer_profiles`, `points_transactions`
- `coupons`, `coupon_usages`
- `audit_logs`, `contact_messages`

### 1.7 Create production staff users

Staff accounts must be created through **Supabase Dashboard → Authentication → Users** — NOT via SQL migration.

**For each staff member:**

1. Supabase Dashboard → **Authentication** → **Users** → **Add user**
2. Set email + strong password
3. Note the generated `user_id` (UUID)
4. Run in SQL Editor:

```sql
-- Replace with real name, role, branch_id
INSERT INTO staff_basic (id, name, role, branch_id, is_active)
VALUES (
  'PASTE_USER_UUID_HERE',
  'Ahmed Al-Rashid',   -- real name
  'owner',             -- owner | general_manager | branch_manager | cashier | kitchen | driver | inventory | marketing | support
  'riffa',             -- riffa | qallali | badi
  true
);
```

**Required production accounts (minimum):**

| Role | Count | Branch |
|---|---|---|
| `owner` | 1 | riffa |
| `general_manager` | 1 | riffa |
| `branch_manager` | 1 per branch | riffa + qallali |
| `kitchen` | 1–2 per branch | both |
| `driver` | as needed | both |
| `cashier` | 1 per branch | both |

### 1.8 Supabase Auth settings

In **Authentication → Settings**:

- **Site URL:** `https://kahramanat.com`
- **Redirect URLs:** add `https://kahramanat.com/**`
- **Email auth:** Enabled
- **Email confirmations:** Enable for customer accounts; disable for staff (you create them manually)
- **JWT expiry:** 3600 (1 hour) — adjust based on shift length preference
- **Refresh token rotation:** Enabled

### 1.9 Realtime configuration

KDS uses Supabase Realtime. In **Database → Replication**:

Enable realtime on:
- `orders` table
- `order_items` table
- `kds_order_items` table

---

## Part 2 — Vercel Deployment

### 2.1 Install Vercel CLI

```bash
npm i -g vercel
vercel --version
```

### 2.2 Login and link

```bash
# Login (opens browser)
vercel login

# From project root
vercel link
# → Set up project: Y
# → Which scope: your account/team
# → Link to existing project? N (first time) or Y if project exists
# → Project name: kahramana-baghdad
# → Directory: ./ (current)
```

### 2.3 Set environment variables

Run each command and select **Production** when prompted:

```bash
# Supabase (required)
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY

# Site URL (required for auth redirects)
vercel env add NEXT_PUBLIC_SITE_URL
# Value: https://kahramanat.com

# Optional: add to Preview too (use dev Supabase project)
```

Verify all env vars:

```bash
vercel env ls
```

Expected output:
```
NEXT_PUBLIC_SUPABASE_URL      Production, Preview, Development
NEXT_PUBLIC_SUPABASE_ANON_KEY Production, Preview, Development
SUPABASE_SERVICE_ROLE_KEY     Production (only — never Preview/Development)
NEXT_PUBLIC_SITE_URL          Production, Preview
```

### 2.4 Deploy to production

```bash
# Preview deploy first (smoke test)
vercel

# Promote to production
vercel --prod
```

Or use the npm script added in package.json:

```bash
npm run deploy:preview   # → vercel
npm run deploy:prod      # → vercel --prod
```

### 2.5 Monitor build

```bash
vercel logs --follow
```

Build should produce ~752+ pages with 0 errors.

---

## Part 3 — Domain Setup

### 3.1 Add custom domain in Vercel

1. Vercel Dashboard → Project → **Settings** → **Domains**
2. Add: `kahramanat.com`
3. Add: `www.kahramanat.com` → redirect to `kahramanat.com`

### 3.2 DNS records

At your domain registrar (e.g. GoDaddy, Namecheap, Cloudflare):

| Type | Name | Value |
|---|---|---|
| `A` | `@` | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns.com` |

> DNS propagation: 5 minutes (Cloudflare) to 24 hours (others).

### 3.3 SSL

Vercel provisions Let's Encrypt SSL automatically. No action needed.
Confirm at: **Project → Settings → Domains** — green lock icon.

### 3.4 Update Supabase with production URL

After domain is live, update Supabase:

- **Authentication → Settings → Site URL:** `https://kahramanat.com`
- **Authentication → Settings → Redirect URLs:** `https://kahramanat.com/**`

---

## Part 4 — Post-Deployment Verification

Run through this checklist immediately after going live:

### Customer-facing pages

- [ ] `kahramanat.com/ar` — Arabic homepage loads, hero image shows
- [ ] `kahramanat.com/en` — English homepage loads, hero image shows
- [ ] Language switcher works (AR ↔ EN, RTL switches)
- [ ] `/ar/menu` — all 16 categories load
- [ ] `/ar/menu/[slug]` — dish detail page loads (pick 3–4 dishes)
- [ ] `/ar/branches` — both branches show with maps links
- [ ] `/ar/about` — page loads
- [ ] `/ar/contact` — contact form submits (check Supabase contact_messages table)
- [ ] `/ar/account` — account page loads (shows login prompt for guests)
- [ ] `/ar/account/login` — customer login form renders

### Cart + Checkout

- [ ] Add item to cart — cart drawer opens, item shows
- [ ] Checkout page loads
- [ ] WhatsApp order button generates correct link with branch number
- [ ] Coupon code input shows
- [ ] Points panel shows (hidden for guests)

### Staff Dashboard

- [ ] `/ar/login` — staff login renders
- [ ] Login with owner account — redirects to `/ar/dashboard`
- [ ] Dashboard shows orders (empty is fine on day 1)
- [ ] `/ar/dashboard/orders` — orders list
- [ ] `/ar/dashboard/staff` — staff list (owner only)
- [ ] `/ar/dashboard/kds` — KDS board loads, selects station
- [ ] `/ar/dashboard/coupons` — coupon management (manager+ only)
- [ ] `/ar/dashboard/settings` — settings page

### Driver PWA

- [ ] `/ar/driver` — redirects to login if not authenticated
- [ ] Login as driver — driver board shows
- [ ] "Add to Home Screen" prompt appears on mobile
- [ ] Offline page loads when network is cut

### Technical checks

- [ ] SSL padlock shows in browser — `https://kahramanat.com`
- [ ] `robots.txt` accessible at `/robots.txt`
- [ ] `sitemap.xml` accessible at `/sitemap.xml`
- [ ] No console errors on homepage
- [ ] No 404s on navigation
- [ ] Supabase Realtime — open KDS in one tab, update order status in another → KDS updates live

---

## Part 5 — Environment Variables Reference

### `.env.local` (local dev — never commit)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_DEV_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Vercel Production (set via `vercel env add`)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROD_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...    # Production only — NOT Preview
NEXT_PUBLIC_SITE_URL=https://kahramanat.com
```

### `.env.production.example` (committed — values are placeholders)

See `/.env.production.example` in the repo root.

---

## Part 6 — Security Checklist

### Database

- [ ] RLS enabled on ALL tables (verify in Supabase → Table Editor → each table → RLS badge)
- [ ] `auth.users` is not directly readable by `anon` role
- [ ] `staff_basic` — RLS allows staff to read own row only; owner/GM reads all
- [ ] `orders` — staff CRUD, customers read own, anon insert (guest checkout)
- [ ] `coupons` — public read active only; staff manage; customer insert usage
- [ ] `audit_logs` — insert by service_role only; staff read only own entries

### Application

- [ ] `SUPABASE_SERVICE_ROLE_KEY` appears ONLY in server files (`/app/**`, `/lib/**`) — never in `'use client'` components
- [ ] Grep for service_role exposure: `grep -rn "SERVICE_ROLE" src/components/ src/app/[locale]/*.tsx`
- [ ] No `.env.local` in git history: `git log --all --full-history -- .env.local`
- [ ] `next.config.ts` does not expose sensitive env vars via `env:` or `publicRuntimeConfig:`

### Vercel

- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set to **Production only** (not Preview, not Development)
- [ ] Preview deployments are password-protected (Vercel → Settings → Security → Vercel Authentication)
- [ ] No `console.log` of secrets in server actions (search: `grep -rn "console.log.*key\|console.log.*secret\|console.log.*password" src/`)

### Headers (next.config.ts)

Verify these headers are active in production (check via `curl -I https://kahramanat.com`):

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

---

## Part 7 — Monitoring Setup

### Vercel Analytics

1. Vercel Dashboard → Project → **Analytics** → Enable
2. No code changes needed (Next.js integration is automatic)
3. Tracks: page views, Web Vitals (LCP, FID, CLS), unique visitors

### Vercel Speed Insights

```bash
npm install @vercel/speed-insights
```

Add to `src/app/[locale]/layout.tsx`:

```tsx
import { SpeedInsights } from '@vercel/speed-insights/next'

// Inside <body>:
<SpeedInsights />
```

### Supabase Logs

Supabase Dashboard → **Logs**:

- **API logs** — watch for 4xx/5xx spikes
- **Auth logs** — failed login attempts
- **Database logs** — slow queries

### Uptime Monitoring (free options)

- **UptimeRobot** — https://uptimerobot.com — free, 5-minute checks, email alerts
  - Monitor: `https://kahramanat.com` (HTTP keyword: "كهرمانة")
  - Monitor: `https://kahramanat.com/ar/menu` (HTTP 200)
- **Better Uptime** — https://betteruptime.com — free tier, on-call alerts

### Error Tracking (optional — if you want stack traces)

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Set `SENTRY_DSN` in Vercel env vars.

---

## Part 8 — Rollback Procedure

If production breaks after a deploy:

```bash
# Instant rollback to previous deployment (no rebuild)
vercel rollback

# Or from Vercel dashboard:
# Deployments → previous deployment → "Promote to Production"
```

Database rollback (if migration broke something):

```sql
-- Connect to production via Supabase SQL Editor
-- Each migration has a ROLLBACK section at the bottom
-- Run the ROLLBACK block from the specific migration file
```

---

## Part 9 — CI/CD (Optional Future Setup)

Connect GitHub → Vercel for automatic deployments:

1. Vercel Dashboard → Project → **Settings** → **Git**
2. Connect GitHub repository
3. Configure:
   - **Production branch:** `main`
   - **Preview branches:** all other branches → get unique preview URLs

Every `git push main` → automatic production deploy.
Every PR → automatic preview URL for review.

---

## Deployment Log

| Date | Version | Pages | Notes |
|---|---|---|---|
| 2026-04-28 | v1.1-phase5-complete | 752 | Initial deployment target |
| 2026-04-29 | v1.5-enterprise-coupons | 757 | Deployed via `vercel --prod`. Settings page, staff management, delivery dashboard, enterprise coupons. |
| 2026-04-29 | — | — | DB migrations 019–023 applied manually via Supabase SQL Editor. 8 new tables created. See Section 10 below. |

---

## Part 10 — DB Migration History (Manual SQL Editor Runs)

These migrations were applied manually via Supabase Dashboard → SQL Editor because the Supabase CLI was not linked at time of deployment.

### Applied 2026-04-29

| File | Tables Created | RLS | Seed Data |
|------|---------------|-----|-----------|
| `019_report_audit_log.sql` | `report_audit_log` | ✅ owner + GM only | None |
| `020_restaurant_profile.sql` | `restaurant_profile` | ✅ all read, owner/GM write | 1 row: Kahramana Baghdad |
| `022_staff_complete.sql` | `staff_permissions`, `staff_documents`, `staff_payroll` | ✅ all three tables | None |
| `023_settings_schema.sql` | `business_hours`, `user_preferences`, `system_settings` | ✅ all three tables | payment_methods + menu_display defaults |

**Total new tables from this batch:** 8  
**Verified in:** Supabase Table Editor on 2026-04-29

### Future migrations — apply in this order when ready

```bash
# If Supabase CLI is ever linked:
supabase db push

# Or apply manually via SQL Editor in numeric order:
# 024_xxx.sql, 025_xxx.sql, etc.
```
