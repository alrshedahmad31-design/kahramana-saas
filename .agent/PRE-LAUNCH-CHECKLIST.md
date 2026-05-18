# PRE-LAUNCH CHECKLIST — Kahramana Baghdad (Soft-launch, Cash-only)

> Generated: 2026-05-18 (session 155 HEAD `5b7445b`)
> Posture: dev work complete. All remaining items are operator/infra.
> Launch Risk: 8/10 (cash-only soft-launch shape)
> Legend: OK done | PEND pending | BLOCK blocker | NA n/a-for-cash-only

---

## 1. OPERATOR ACTIONS (must-do before launch)

| Status | Item | Notes |
|--------|------|-------|
| BLOCK  | **Supabase Free → Pro + Singapore migration** | Free tier auto-pauses on inactivity → cold reads at the worst moment. Pro+Singapore is the single biggest risk reducer left. |
| BLOCK  | **Resend domain verification for kahramanat.com** | DKIM/SPF/DMARC records on the registrar. Until verified, transactional email (order/reservation/birthday) falls back to `onboarding@resend.dev`, hits Gmail spam. |
| BLOCK  | **Owner sends 13 staff emails** | Required input to run staff seed (migration 090). Without staff rows, dashboard logins don't exist. |
| PEND   | **Run staff seed after emails arrive** | `supabase db query -f` against staff seed; verify roles in `staff_basic`. |
| PEND   | **Flip `NEXT_PUBLIC_ENABLE_QR_LOYALTY_SCAN=true` AFTER staff seed lands** | Hard-ordered. Flipping before staff exist breaks the waiter QR scanner. |
| PEND   | **Smoke-walk Riffa branch in person** | Verify: power, Wi-Fi to dashboard, printer paper, cash float counted + recorded in dashboard, opening balance via `rpc_record_opening_balance`. |
| OK     | البديع branch row deleted from `branches` table | Closed post-session 136. |
| OK     | `CONTACT_NOTIFY_EMAIL` set to `asaadaljobory@gmail.com` (Vercel env) | Added 2026-05-14. |
| OK     | VAPID push keys configured | `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` on Vercel Prod+Preview. Driver push notifications wired end-to-end. |

---

## 2. DEV ITEMS STILL OPEN

| Status | Item | Notes |
|--------|------|-------|
| OK     | All P0/P1 audit findings | Sessions 137–149 RPC sweep + 145 (AUD-V4-006/007) + 150 (AUD-V4-011/013/016) closed every blocking finding. |
| OK     | Security Tier 1 + Tier 2 (session 142) | Turnstile/Upstash fail-closed, CRLF/honeypot, cron `timingSafeEqual`, webhook replay dedup. |
| OK     | Public-surface hygiene (session 144) | All 15 findings in `.agent/public-audit-2026-05-18.md` closed except defense-in-depth deferred-by-design. |
| OK     | KDS station-routing alignment (session 155, migration 183) | DB column now matches UI screen across all 82 historical rows. |
| OK     | Mobile responsiveness + a11y focus rings (sessions 141, 154) | 44px touch targets, focus-visible rings on every nav control. |
| NA     | **TAP refund API wiring** | `refundPayment` flips DB state only — does NOT push money back to card. Cash-only launch means no Tap charges → no refunds → NOT a blocker for soft-launch. Wire when TAP merchant keys arrive. |
| NA     | Sprint 6B WhatsApp Business API | Blocked on Meta verification. Not on soft-launch critical path. |
| NA     | Sprint 6C Benefit Pay API | Blocked on CBB merchant approval. Not on soft-launch critical path. |
| NA     | Phase 7B Deliverect/POS aggregator | External contract. Not on soft-launch critical path. |
| NA     | Phase 8 AI assistant + demand forecasting | Needs 6 months production data. |

**Dev backlog is empty.** No remaining lanes that can be unblocked by code changes alone.

---

## 3. INFRASTRUCTURE

### Supabase
| Status | Item | Notes |
|--------|------|-------|
| BLOCK  | Free → Pro plan upgrade | Same as Section 1. |
| BLOCK  | Region migration to Singapore (`ap-southeast-1`) | Current region is `sin1` per `phase-state.json:deployment.region`, but matches the Vercel region. Confirm Supabase project region matches. Round-trip Bahrain ↔ default-region is order-of-100ms; Singapore is the closest sustainable choice. |
| OK     | Migrations 020–183 paired Local=Remote | Session 155 added migration 183 via MCP. `supabase migration list --linked` clean. |
| OK     | RLS hardened across orders/order_items/inventory/customers/contact_messages | BL-003/BL-004 sweep + 095 orders UPDATE tighten. |
| OK     | All financial writes go through SECURITY DEFINER RPCs | ARCH-004 closed across checkout, table, waiter, POS, POS service. |
| OK     | Backup policy | Supabase Pro auto-daily backups + PITR window. Confirm after Pro upgrade. |
| PEND   | Snapshot a fresh DB backup the morning of launch | Manual via Studio → Database → Backups, keep locally for 7 days. |

### Vercel
| Status | Item | Notes |
|--------|------|-------|
| OK     | Production deployment live at `https://kahramanat.com` | Last build `5b7445b`, 540 pages, build PASS. |
| OK     | Region pinned to `sin1` | Matches Bahrain audience latency target. |
| OK     | Env vars set: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_CLARITY_ID`, `VAPID_*`, `CONTACT_NOTIFY_EMAIL` | Per `phase-state.json:env_vars_production`. |
| OK     | Vercel Cron configured for `/api/cron/birthday-notify` | Migration 158 + 172 + secret with `timingSafeEqual`. |
| PEND   | `TAP_SECRET_KEY` + `PAYMENT_WEBHOOK_SECRET` env vars | Deferred for cash-only. Add when TAP merchant keys arrive. |
| PEND   | **Verify Vercel project region in dashboard** | `phase-state.json` says `sin1` but worth confirming in the Vercel UI before launch day. |
| PEND   | **Run one preview deploy from master** to confirm pipeline green before flipping production traffic. |
| PEND   | Set up Vercel Speed Insights + Web Analytics alerts | `@vercel/speed-insights` already installed; configure threshold alerts. |

### DNS
| Status | Item | Notes |
|--------|------|-------|
| OK     | `kahramanat.com` resolves to Vercel | `NEXT_PUBLIC_SITE_URL=https://kahramanat.com`. |
| PEND   | **Verify DNS propagation 24h before launch**: A/AAAA + CNAME `www.kahramanat.com` | `dig kahramanat.com +short` from a non-Bahrain network. |
| PEND   | **Confirm SSL certificate auto-renew is healthy** | Vercel dashboard → Domains → SSL status = "Issued" with future expiry. |
| BLOCK  | Resend DNS records (DKIM/SPF/DMARC) | See Section 1. Without these, email is degraded. |

### Other infra
| Status | Item | Notes |
|--------|------|-------|
| OK     | GitHub repo `alrshedahmad31-design/kahramana-saas` connected | Master pushed to `5b7445b`. |
| OK     | CI workflows on Node 24 (session 150) | audit.yml + e2e.yml + playwright.yml all pinned. |
| OK     | Migrations registry synced | `.agent/db_migration_state.md` matches remote. |

---

## 4. STAFF READINESS

### Accounts
| Status | Item | Notes |
|--------|------|-------|
| BLOCK  | 13 staff emails collected from owner | Hard prerequisite for migration 090. |
| PEND   | Seed staff rows via migration 090 | After emails arrive. |
| PEND   | Send password-set emails to all 13 | Customer auth uses Supabase magic-link / password-set flow. |
| PEND   | Verify each staff member can log in to `/login` and lands on the correct role surface | Owner→/dashboard, GM→/dashboard, branch_manager→branch-scoped, cashier→POS, kitchen→KDS, driver→`/driver`, waiter→`/waiter`. |
| PEND   | Confirm 2FA / strong passwords on owner + GM accounts | Owner-level credential is the master key. |
| PEND   | Verify each branch_manager sees only their branch in dashboards | Branch-scope RLS already enforced; this is a smoke check, not new work. |

### Training
| Status | Item | Notes |
|--------|------|-------|
| PEND   | **Cashier training — POS flow** | Open shift → record opening balance → take cash orders → close shift → reconcile cash. |
| PEND   | **Kitchen training — KDS** | Read incoming orders by station (mains/grill/shawarma/pizza/cold/unassigned), bump, recall window (60s). |
| PEND   | **Waiter training — table assignment + waiter QR** | Pick table from registry (40 seeded), create order, mark dine-in. |
| PEND   | **Driver training — accept/dispatch/POD** | Login → accept order → live GPS share → photo + signature on delivery → cash handover at end of shift. |
| PEND   | **Manager training — cash reconciliation + handover confirmation** | `confirmCashHandover` with manager_confirmed CAS (AUD-V4-013). |
| PEND   | **Owner training — refund flow, coupon issuance, reservation override** | Manual override paths for edge cases. |
| PEND   | Print one-page cheat-sheets in AR + EN for each role | Single laminated page taped near each station. |
| PEND   | Designate go-live shift captain | Owner or GM physically on-site during first 4 hours. |

---

## 5. CONTENT

### Photos
| Status | Item | Notes |
|--------|------|-------|
| PEND   | **~12 missing dish photos** | Shoot list in commit `da5b199`. Session 155 confirmed 160/160 DB + 175/175 menu.json `image_urls` resolve on disk — so the gap is the additional ~12 items still flagged in external_dependencies. |
| OK     | Branded fallback when image fails to load | `MenuItemImage` flips to dark `bg-brand-black` + logo watermark on `onError` (session 155 commit `a9b3962`). Soft-launch can ship with the missing photos using the fallback. |
| OK     | Hero photography, gallery, brand logos | `logo-full.webp` restored to horizontal mark (session 155 commit `d77283e`). |

### Menu accuracy
| Status | Item | Notes |
|--------|------|-------|
| PEND   | **Final menu walkthrough with chef** | Confirm: prices, availability toggles, AR/EN names, allergens, station assignments. Print a master copy. |
| OK     | 179 items × 16 categories, all priced | Per `phase-state.json:external_dependencies.menu_data`. |
| OK     | Turkish Coffee + 7 egg sandwiches seeded into `menu_items_sync` | Sessions 151 + 153 (migrations 180 + 182). |
| OK     | Modifiers / option groups wired | Migration 082 + 083. |
| OK     | Loyalty rules in `loyalty_config` (10 pts/BHD, silver/gold/platinum tiers) | Migration 084 + UI confirmed in tier benefits panel (session 155). |
| OK     | Currency display = BHD with 3 decimals throughout | Gate 5 PASS. |
| OK     | i18n parity AR=EN=2,558 keys | Gate 8 PASS. |

### Legal / policy
| Status | Item | Notes |
|--------|------|-------|
| PEND   | **Privacy policy reviewed and current date stamped** | `/privacy` reachable; verify wording matches actual data practices (Resend, GA4, Clarity). |
| PEND   | Terms of service reviewed | `/terms` reachable. |
| PEND   | Refund policy reviewed | `/refund-policy` — clarify cash-only refund process (in-person, same branch, manager signoff). |
| OK     | Cookie consent gates GA4 + Clarity | Session 131 F-01. |

---

## 6. TESTING (manual critical journeys)

Run each end-to-end on production (`kahramanat.com`) the day before launch. Use a real Bahrain phone number where the flow asks. Use a real card only if Tap is enabled — for cash-only, all order tests should pay-on-delivery.

### Customer
| Status | Journey | Verify |
|--------|---------|--------|
| PEND   | **Browse menu (AR + EN)** | All 16 categories load; images render; prices show BHD with 3 decimals; modifiers expand. |
| PEND   | **Place delivery order (cash)** | Cart → checkout → cash payment → success page → order ID returned → SMS/email confirmation (Resend domain must be verified). |
| PEND   | **Place pickup order (cash)** | Same as above with pickup branch. |
| PEND   | **Place dine-in order via QR** | Scan table QR → order → arrives at KDS at correct station + auto-accepts. |
| PEND   | **Reservation flow** | `/reserve` → pick date/time/party → `find_available_tables` returns slots → confirm → reservation row + WhatsApp deep-link. |
| PEND   | **Account register + login + forgot-password** | Turnstile fail-closed in production; rate-limit triggers after 5 attempts in 15min. |
| PEND   | **Loyalty redemption at checkout** | Member with ≥ pts threshold → toggle redemption widget → 50% cap enforced → DB columns populated. |
| PEND   | **Order status page `/order/[id]`** | Loads for the order owner; 404 / redirect for non-owners. |
| PEND   | **Contact form** | Submits; email lands in `asaadaljobory@gmail.com`. |
| PEND   | **Catering inquiry** | Form submits; appears in `/dashboard/catering` for owner. |

### Staff
| Status | Journey | Verify |
|--------|---------|--------|
| PEND   | **Cashier opens shift + records opening balance** | `rpc_record_opening_balance`; appears in cash flow page. |
| PEND   | **Cashier creates POS order (cash)** | `rpc_create_order` with `p_payment_mode='cod'`. |
| PEND   | **Waiter creates dine-in order** | Table picker → order arrives at KDS. |
| PEND   | **KDS bump + recall (within 60s)** | `bump_station_order` (text overload) → recall window closes. |
| PEND   | **Driver login + accept order + GPS share + POD** | Photo + signature uploads. |
| PEND   | **Cash handover end-of-shift** | Driver → branch_manager `confirmCashHandover` with CAS. |
| PEND   | **Manager refund (cash, manual)** | Flips DB state; audit row appears. |
| PEND   | **Dashboard analytics page loads** | Labor cost widget + menu engineering matrix render. |
| PEND   | **Birthday cron fires** | Manual trigger via authenticated request; one customer with birthday-today gets email + WhatsApp deep-link. |

### Negative tests
| Status | Journey | Verify |
|--------|---------|--------|
| PEND   | **Turnstile fail-closed in prod** | Disable JS, submit contact form → blocked. |
| PEND   | **Rate-limit triggers** | Hit `/account/login` 6x in 5min → 429. |
| PEND   | **Unauthorized dashboard access** | `/dashboard` while logged out → redirect to `/login`. |
| PEND   | **Branch isolation** | Login as Qallali branch_manager; confirm Riffa orders not visible. |
| PEND   | **`/payment/[orderId]` with malformed UUID** | UUID guard returns 404. |

---

## 7. MONITORING

### Sentry
| Status | Item | Notes |
|--------|------|-------|
| OK     | Server / edge / client configs in place | `sentry.server.config.ts`, `sentry.edge.config.ts`, `src/instrumentation-client.ts`. |
| OK     | `enableLogs: true` removed from all three configs | Session 145 (AUD-V4-007). |
| OK     | All swallowed-error sites route through `Sentry.captureException` with stage tags | Sessions 144 (T3-A2) + 150 (AUD-V4-011). |
| PEND   | **Verify Sentry DSN is set on Vercel Prod** | `SENTRY_AUTH_TOKEN` + `NEXT_PUBLIC_SENTRY_DSN`. |
| PEND   | **Watch the Sentry "Issues" page during the first 2h of launch** | Triage anything new at P1 or higher live. |
| PEND   | Configure Sentry alert rules | New-issue alert → Slack or email; spike-protection on issue volume. |

### Analytics
| Status | Item | Notes |
|--------|------|-------|
| OK     | GA4 configured (`G-521712793`) | `NEXT_PUBLIC_GA_ID` set; cookie-consent-gated. |
| OK     | Clarity configured (`vzlrozut31`) | `NEXT_PUBLIC_CLARITY_ID` set; cookie-consent-gated. |
| OK     | Vercel Speed Insights live | `<SpeedInsights />` in layout. |
| OK     | GSC + Bing Webmaster registered | Sitemap submitted; Bing meta tag in `layout.tsx`. |
| PEND   | **Confirm GA4 + Clarity start receiving live events after launch** | Realtime view in GA4; Clarity dashboard. |
| PEND   | **Set GA4 conversion events** | `order_completed`, `reservation_created`, `account_registered`. |

### Operational dashboards
| Status | Item | Notes |
|--------|------|-------|
| PEND   | **Supabase Pro Logs Explorer pinned to: failed RPCs, 500s, slow queries** | Easier triage when an order misbehaves. |
| PEND   | **Vercel runtime logs filtered to `/api/*` errors** | Webhook + cron + checkout failures surface here. |
| PEND   | **Set up Better Stack (or similar) uptime monitor on `https://kahramanat.com/`** | The `phase-state.json` note references "Better Stack monitor assertion swap" — confirm it's now `'ok'` not `'unhealthy'`. |
| PEND   | **WhatsApp deep-link smoke check** | Send a test `wa.me` to the Riffa restaurant number; confirm chat opens. |

---

## SUMMARY

**Blockers (3)** — all operator/external, all fixable in one business day except Resend DNS propagation:
1. Supabase Free → Pro + Singapore migration
2. Resend domain verification for kahramanat.com
3. 13 staff emails from owner → migration 090

**Cash-only deferrals (3)** — explicitly out of scope for soft-launch and have NO bearing on cash flows:
- TAP refund API wiring
- WhatsApp Business API (Sprint 6B)
- Benefit Pay merchant integration (Sprint 6C)

**Critical day-of checklist:**
1. Confirm Supabase Pro live + backup taken
2. Confirm Resend DNS verified (test transactional email)
3. Run all 10 customer manual tests (Section 6)
4. Run all 9 staff manual tests (Section 6)
5. Confirm Sentry, GA4, Clarity, uptime monitor all reporting live
6. Shift captain on-site for first 4 hours

**Dev backlog at launch:** empty. No code changes required to ship.
