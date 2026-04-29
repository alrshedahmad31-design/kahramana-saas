# Production Reference — Kahramana Baghdad
> Live ops quick reference. Full deployment guide: `.agent/DEPLOYMENT.md`
> Last updated: 2026-04-28

---

## Live URLs

| Resource | URL |
|---|---|
| **Site (AR)** | https://kahramana.vercel.app/ar |
| **Site (EN)** | https://kahramana.vercel.app/en |
| **Staff Dashboard** | https://kahramana.vercel.app/ar/login |
| **Driver PWA** | https://kahramana.vercel.app/ar/driver |
| **KDS** | https://kahramana.vercel.app/ar/dashboard/kds |
| **Vercel Project** | https://vercel.com/alrshedahmad31-designs-projects/kahramana |
| **Supabase Dashboard** | https://supabase.com/dashboard/project/[YOUR_PROJECT_REF] |

---

## Admin Credentials

| Account | Location | Notes |
|---|---|---|
| **First login** | email: `admin@kahramanat.com` | ⚠️ Change password immediately after first login |
| **Password reset** | Supabase Dashboard → Authentication → Users | Select user → Send reset email |
| **Add staff** | Supabase Dashboard → Authentication → Users → Add user | Then INSERT into `staff_basic` |
| **Vercel env vars** | Vercel Dashboard → Project → Settings → Environment Variables | Never commit to git |

---

## Deployment Commands

```bash
# Preview deploy (staging URL, not production)
npm run deploy:preview

# Production deploy
npm run deploy:prod

# Push database migrations to production
npm run db:migrate:prod

# Check migration status
npm run db:status

# Local dev
npm run dev
```

---

## Environment Variables

Set in Vercel Dashboard (never in code):

| Variable | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | All | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All | Public — enforces RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **Production only** | Server-side only — bypasses RLS |
| `NEXT_PUBLIC_SITE_URL` | All | `https://kahramana.vercel.app` (update when custom domain is live) |

---

## Rollback Procedure

### App rollback (instant — no rebuild)
```bash
vercel rollback
```
Or: Vercel Dashboard → Deployments → select previous → Promote to Production.

### Database rollback
Each migration file has a `-- ROLLBACK` section at the bottom.
Run the rollback block in Supabase SQL Editor for the specific migration.

**Migration order (newest first for rollback):**
```
011_fix_orders_rls.sql
010_production_seed.sql
009_coupons_schema.sql
008_loyalty_schema.sql
007_driver_schema.sql
005_kds_schema.sql
004_audit_logs_rls.sql
003_rls_staff_fix.sql
002_contact_messages.sql
001_initial_schema.sql
```

---

## Monitoring

| Tool | URL | What to watch |
|---|---|---|
| Vercel Analytics | Vercel Dashboard → Analytics | Page views, Web Vitals |
| Vercel Logs | `vercel logs --follow` | Server errors, function timeouts |
| Supabase Logs | Dashboard → Logs → API | 4xx/5xx spikes, auth failures |
| Supabase Logs | Dashboard → Logs → Auth | Failed login attempts |

---

## Build Info

| Metric | Value |
|---|---|
| Pages | 752 |
| TypeScript errors | 0 |
| RTL violations | 0 |
| Region | sin1 (Singapore) |
| Node.js | 18+ |
| Framework | Next.js 15.5.15 |
| Database | Supabase (PostgreSQL) |
| Migrations applied | 001–011 (006 dev-only — skipped in prod) |

---

## Key Architecture Notes

- **Server actions** use `createServiceClient` (service_role) — bypasses RLS, validates payload first
- **Client components** use `createClient` (anon key) — subject to RLS policies
- **Staff auth**: Supabase Auth → `staff_basic` table → RBAC via `rbac.ts`
- **Customer auth**: Supabase Auth → `customer_profiles` table → separate session (`customerSession.ts`)
- **KDS**: Supabase Realtime on `orders` + `kds_queue` tables
- **Checkout**: WhatsApp link (Phase 1) → Benefit Pay (Phase 6, locked)

---

## Pending Infrastructure

| Item | Status | Blocks |
|---|---|---|
| Custom domain `kahramanat.com` | Not configured | SEO, branded URLs |
| Benefit Pay CBB merchant approval | Not started | Phase 6 — 2–4 months |
| Meta Business Verification | Not started | WhatsApp API (Phase 6) |
| Deliverect contract | Not signed | Phase 7 |
