# Pre-Launch QA Checklist — Kahramana Baghdad

> **Status**: Draft v1 — 2026-05-09 (session 80)
> **Scope**: Full system, all phases live (0, 1, 2, 3, 4, 5, 6, 6b, 7).
> **Production**: https://kahramanat.com · Vercel `sin1` · Supabase production · Migration 088 applied.
> **Owner**: Ahmed (sign-off) · **Exec**: Claude Code + browsing agent + on-site staff.

---

## 0. How to use this document

1. Each item has a unique ID (e.g. `CUST-MENU-03`) so it can be referenced in commits, issues, and bug reports.
2. Mark items with one of: `[ ]` not run · `[OK]` pass · `[X]` fail · `[~]` partial / known issue · `[N/A]` not applicable.
3. **Blocker** column: `B` = launch blocker, `S` = soft blocker (ship with caveat), `-` = nice-to-have.
4. Run the gates from `CLAUDE.md` (TSC, RTL, fonts, colors, currency, phones, hex, i18n, build) **before** executing this checklist; this doc assumes they pass.
5. Test on **two devices minimum**: an Android phone (Chrome) and a desktop (Chrome + Safari). Add iPhone Safari + iPad if available.
6. Run **every customer flow in both `ar` and `en`**. Dashboard items default to `ar`.
7. **Both branches** (Riffa + Qallali) must be exercised independently for branch-scoped flows.
8. When a failure is found, file a bug with the item ID and link it back into this doc in the Notes column.

---

## 1. Test environment

### 1.1 Required test data

| Item | Required | Status |
|---|---|---|
| 2 branches seeded (Riffa + Qallali) | Yes | OK live |
| 179 menu items priced + categorized | Yes | OK live (16 categories) |
| At least 1 menu item with **size variants** | Yes | verify post migration 088 |
| At least 1 menu item with **modifier groups** (required + optional) | Yes | verify post migration 088 |
| 40 dine-in tables seeded with QR codes | Yes | OK migration 085 |
| At least 1 active promotion (each type: percent, flat, BOGO) | Yes | verify |
| At least 1 active coupon (single-use + multi-use) | Yes | verify |
| Loyalty config row active (current rules) | Yes | OK migration 084 |
| Inventory: ≥ 5 ingredients, 1 prep item, 1 recipe with COGS | Yes | depends on chef Excel import |
| 1 test customer account with loyalty points + order history | Yes | create as part of QA |

### 1.2 Required test accounts

Create one account per role per branch. Use real emails the QA tester controls.

| Role | Riffa | Qallali | Owner-scope (no branch) | Notes |
|---|---|---|---|---|
| owner | — | — | `qa-owner@…` | sees both branches |
| general_manager | — | — | `qa-gm@…` | sees both branches |
| branch_manager | `qa-bm-riffa@…` | `qa-bm-qallali@…` | — | branch-scoped |
| kitchen | `qa-kit-riffa@…` | `qa-kit-qallali@…` | — | KDS access only |
| cashier | `qa-cash-riffa@…` | `qa-cash-qallali@…` | — | POS access |
| waiter | `qa-waiter-riffa@…` | `qa-waiter-qallali@…` | — | dine-in flow |
| driver | `qa-driver-riffa@…` | `qa-driver-qallali@…` | — | PWA, GPS |
| inventory_manager | `qa-inv-riffa@…` | `qa-inv-qallali@…` | — | inventory dashboard |
| marketing | — | — | `qa-marketing@…` | analytics, promotions, coupons |

### 1.3 Devices

| Device | Browser | Used for |
|---|---|---|
| Android phone | Chrome | customer + driver PWA + waiter |
| iPhone | Safari | customer + QR scan (camera) |
| Desktop Mac/Win | Chrome | dashboard, KDS, cashier, inventory |
| Desktop | Safari | bilingual rendering, RTL edge cases |
| Tablet | iPad Safari | KDS + waiter + manager dashboard |

---

## 2. Customer-facing — public site

### 2.1 Marketing pages

| ID | Scenario | Expected | ar | en | Mobile | Blocker |
|---|---|---|:---:|:---:|:---:|:---:|
| MKT-01 | Home `/` loads | Hero + featured items + CTAs render; no console errors | [ ] | [ ] | [ ] | B |
| MKT-02 | About `/about` | Renders with brand story, no broken images | [ ] | [ ] | [ ] | S |
| MKT-03 | Branches `/branches` | Both branches visible, map links work, hours correct | [ ] | [ ] | [ ] | B |
| MKT-04 | Branch detail `/branches/riffa` | LocalBusiness schema valid, address + phone + hours, "Order from this branch" CTA | [ ] | [ ] | [ ] | B |
| MKT-05 | Branch detail `/branches/qallali` | Same as MKT-04 for Qallali | [ ] | [ ] | [ ] | B |
| MKT-06 | Contact `/contact` | Form posts, success message renders, message lands in dashboard | [ ] | [ ] | [ ] | B |
| MKT-07 | Privacy `/privacy` | Renders, no lorem | [ ] | [ ] | [ ] | B |
| MKT-08 | Terms `/terms` | Renders, no lorem | [ ] | [ ] | [ ] | B |
| MKT-09 | Refund policy `/refund-policy` | Renders, no lorem | [ ] | [ ] | [ ] | B |
| MKT-10 | 404 `/garbage-url` | Branded not-found page, locale preserved | [ ] | [ ] | [ ] | S |
| MKT-11 | Locale switch (ar ↔ en) | Toggle preserves path; RTL flips correctly; no layout shift | [ ] | [ ] | [ ] | B |
| MKT-12 | Header nav | All links resolve; active state shows; cart count live | [ ] | [ ] | [ ] | B |
| MKT-13 | Footer | All links resolve; contact info matches `src/constants/contact.ts` | [ ] | [ ] | [ ] | S |

### 2.2 Menu

| ID | Scenario | Expected | Blocker |
|---|---|---|:---:|
| MENU-01 | `/menu` loads, all 16 categories render | Server-precomputed `fromPrice` shows; no SSR/CSR drift | B |
| MENU-02 | Each category page `/menu/[slug]` loads | All items in category render with image, price, description | B |
| MENU-03 | Item with size variants | All sizes selectable; price updates live; default size pre-selected | B |
| MENU-04 | Item with required modifier group | Cannot add to cart until required option selected; validation message visible | B |
| MENU-05 | Item with optional modifiers | Optional modifiers add price correctly; multi-select honoured | B |
| MENU-06 | Out-of-stock item | "Unavailable" badge; Add-to-cart disabled | B |
| MENU-07 | Image fallback | Items without image show branded placeholder, not broken icon | S |
| MENU-08 | Search / filter | If implemented, returns correct results; empty state copy correct | S |
| MENU-09 | Allergen badges | Display matches DB allergen flags | S |
| MENU-10 | Calorie display | Matches DB; respects locale digits | - |
| MENU-11 | Price formatting | All prices show 3 decimals + `BHD` suffix; **no `.000` truncation**; **no other currencies** | B |

### 2.3 Cart

| ID | Scenario | Expected | Blocker |
|---|---|---|:---:|
| CART-01 | Add item to cart | Drawer opens, item appears, count badge updates | B |
| CART-02 | Add same item twice with **different modifiers** | Two distinct line items (not merged) | B |
| CART-03 | Add same item twice with **same modifiers** | Single line item, qty = 2 | B |
| CART-04 | Increment / decrement qty | Subtotal recalculates; qty = 0 removes line | B |
| CART-05 | Remove line | Line removed; subtotal updates; cart can become empty | B |
| CART-06 | Persist across reload | Cart survives page reload (localStorage) | B |
| CART-07 | Persist across locale switch | Cart contents stable when ar ↔ en | B |
| CART-08 | Modifier surcharge in subtotal | Subtotal = sum of (item base + modifier deltas) × qty | B |
| CART-09 | Empty cart state | Empty illustration + CTA to menu; checkout disabled | S |
| CART-10 | Checkout button | Routes to `/checkout` with cart state intact | B |

### 2.4 Checkout — Delivery

| ID | Scenario | Expected | Blocker |
|---|---|---|:---:|
| CHK-DEL-01 | Select Delivery, pick branch | Delivery fee + ETA shown per branch | B |
| CHK-DEL-02 | Address required | Cannot submit without address; form validation messages clear | B |
| CHK-DEL-03 | Phone required + format | Bahraini phone format enforced; clear error on bad input | B |
| CHK-DEL-04 | Apply coupon | Valid coupon discounts subtotal; invalid shows error; expired shows error | B |
| CHK-DEL-05 | Apply promotion (auto) | Eligible promotion auto-applies; promotion_id + promotion_discount_bhd persist on order | B |
| CHK-DEL-06 | Loyalty redemption widget | Logged-in user with ≥ threshold sees widget; toggle redeems points; discount applies; widget hidden for guests | B |
| CHK-DEL-07 | Redemption + coupon stacking | Stacking rules enforced per business policy (verify with Ahmed) | B |
| CHK-DEL-08 | Stock warning banner | If item low/out post-add, banner visible but checkout still allowed | S |
| CHK-DEL-09 | Submit order | Success → routes to `/payment/[orderId]` (or `/order/[id]` if paid offline) | B |
| CHK-DEL-10 | Order persisted | `orders` row created with correct branch, items, modifiers, totals, source = `online` | B |
| CHK-DEL-11 | Loyalty points awarded | `loyalty_transactions` row created on completion | B |
| CHK-DEL-12 | KDS receives order | New order appears on kitchen station within 3 s (realtime) | B |
| CHK-DEL-13 | WhatsApp link / notification | Customer + branch numbers receive correct message via `buildCustomerContactLink` | S |

### 2.5 Checkout — Pickup

| ID | Scenario | Expected | Blocker |
|---|---|---|:---:|
| CHK-PCK-01 | Select Pickup, pick branch | No delivery fee; ETA shown | B |
| CHK-PCK-02 | Submit pickup order | Order created with `order_type='pickup'`, no address required | B |
| CHK-PCK-03 | KDS receives order | Visible at correct branch only | B |

### 2.6 Checkout — Dine-in (table QR)

| ID | Scenario | Expected | Blocker |
|---|---|---|:---:|
| CHK-DIN-01 | Scan QR `/qr/<code>` (camera) | Lands on menu pre-bound to table_number + branch | B |
| CHK-DIN-02 | Cart shows table label | Header / cart drawer indicates "Table #X" | B |
| CHK-DIN-03 | Submit dine-in order | `order_type='dine_in'`, `source='qr'`, table_number persisted, status auto = `accepted` | B |
| CHK-DIN-04 | KDS shows table number | KDS card surfaces "Table N" badge | B |
| CHK-DIN-05 | Waiter app sees order | Order appears in waiter view for the same branch | B |
| CHK-DIN-06 | Invalid / unknown QR | Branded error page, no crash | S |

### 2.7 Order tracking

| ID | Scenario | Expected | Blocker |
|---|---|---|:---:|
| TRK-01 | `/order/[id]` for own order (logged-in) | Renders status, items, totals, ETA | B |
| TRK-02 | `/order/[id]` for someone else's order | 404 or access-denied — never reveals data | B |
| TRK-03 | Status updates live | New status (preparing → ready → out-for-delivery → delivered) appears within 3 s | B |
| TRK-04 | Driver location visible (delivery) | If assigned, customer sees live driver pin on Leaflet map | S |

---

## 3. Customer auth + loyalty

| ID | Scenario | Expected | Blocker |
|---|---|---|:---:|
| AUTH-01 | Login `/login` with email link | Magic link arrives via Resend, lands logged-in | B |
| AUTH-02 | Login persists across reload | Session cookie survives | B |
| AUTH-03 | Logout clears session | Cookie cleared, navigation reflects guest state | B |
| LOY-01 | New customer sees 0 points + Bronze tier | Correct on first login | B |
| LOY-02 | Points awarded after delivered order | `loyalty_transactions` insert; balance updates within 1 min | B |
| LOY-03 | Tier upgrades at thresholds | Silver 5/50, Gold 15/200, Platinum 30/500 (per `feedback`) | S |
| LOY-04 | Redemption widget shows correct max-redeemable | Capped at order subtotal × policy | B |
| LOY-05 | Redemption persists `loyalty_points_redeemed` + `loyalty_discount_bhd` | Visible on order detail | B |
| LOY-06 | Trigger fires on `delivered` | `067_fix_loyalty_trigger_for_delivery.sql` behaviour intact | B |

---

## 4. Dashboard — by role

> Verify each role **only sees what they should** and **cannot reach restricted routes** (server-side, not just sidebar hiding).

### 4.1 Owner / GM

| ID | Scenario | Expected | Blocker |
|---|---|---|:---:|
| OWN-01 | `/dashboard` home | KPIs across all branches; revenue, orders, AOV today vs. yesterday | B |
| OWN-02 | Switch branch filter | All widgets refilter | B |
| OWN-03 | Sees all dashboard sections | Orders, Menu, Promotions, Coupons, Loyalty, Inventory, Staff, Reports, Analytics, Settings | B |
| OWN-04 | Staff page | Can create/edit/delete users for both branches | B |
| OWN-05 | Settings | Can edit restaurant profile, hours, branches | B |

### 4.2 Branch manager

| ID | Scenario | Expected | Blocker |
|---|---|---|:---:|
| BM-01 | KPIs scoped to own branch | Cannot see other branch's totals | B (RLS) |
| BM-02 | Cannot edit menu master data | UI disables; server-side blocks | B |
| BM-03 | Can view + manage own branch staff | Cross-branch staff invisible | B (RLS) |
| BM-04 | Can update orders for own branch | Cross-branch orders 404 / forbidden | B (RLS) |

### 4.3 Cashier (POS)

| ID | Scenario | Expected | Blocker |
|---|---|---|:---:|
| CASH-01 | POS opens scoped to assigned branch | Branch lock visible | B |
| CASH-02 | Variant picker — additive size pricing | Size delta added correctly (per session 80 commit) | B |
| CASH-03 | Modifier picker | Required vs optional honoured; price updates live | B |
| CASH-04 | Cash payment flow | Order created with `source='manual'`, `payment_method='cash'`, auto-accepted | B |
| CASH-05 | Card / Benefit payment flow | If on, routes to payment provider | S (deferred) |
| CASH-06 | Receipt print | Print preview matches order; bilingual; correct branch + table | B |
| CASH-07 | Refund / void | Per policy; audit log entry created | S |

### 4.4 Kitchen (KDS)

| ID | Scenario | Expected | Blocker |
|---|---|---|:---:|
| KDS-01 | KDS loads scoped to branch | Branch RLS enforced (mig 089) | B |
| KDS-02 | Station selector shows active counts | Counts match DB per station | B |
| KDS-03 | New order arrives in <3 s | Realtime filter `station=eq.X,branch_id=eq.Y` | B |
| KDS-04 | Modifier pills under each line | Correct modifiers displayed | B |
| KDS-05 | Source badge | qr / waiter / manual / online / kiosk render correctly | B |
| KDS-06 | Table number on dine-in | Visible label | B |
| KDS-07 | Start prep → ready → delivered transitions | Buttons in Arabic; progress 0/50/100; status persists; customer + waiter receive update | B |
| KDS-08 | SLA timer baseline = `station_assigned_at` | Timer starts at station entry, not order create | B |
| KDS-09 | Cross-branch order invisible | Manager from other branch never sees this card | B |
| KDS-10 | Realtime fallback | If WebSocket drops, 15 s polling continues | B |
| KDS-11 | Two stations don't double-claim | `UNIQUE(item_id)` prevents duplicate assignment | B |
| KDS-12 | Stock dot per item | `slugStockMap` reflects low/out stock | S |

### 4.5 Driver PWA

| ID | Scenario | Expected | Blocker |
|---|---|---|:---:|
| DRV-01 | `/driver` PWA installable on Android | Install prompt fires; app icon appears | B |
| DRV-02 | Login as driver | Sees only own assigned orders | B |
| DRV-03 | Accept assignment | Order moves to "out for delivery" | B |
| DRV-04 | GPS watchPosition every 15 s | `driver_locations` rows insert; retention purges after 7 d | B |
| DRV-05 | Customer sees driver pin | Within 5 s of first GPS fix | S |
| DRV-06 | Mark delivered | Order status → `delivered`; loyalty + payments triggers fire | B |
| DRV-07 | Cash handover flow | Driver can record handover; manager verifies + reconciles discrepancy | B |
| DRV-08 | Multiple cash handovers | One driver can do several handovers per shift | B |
| DRV-09 | Offline page `/driver/offline` | Renders when network drops | S |
| DRV-10 | Driver issue report | Driver can log a problem; lands in dashboard | S |

### 4.6 Waiter app

| ID | Scenario | Expected | Blocker |
|---|---|---|:---:|
| WAI-01 | Waiter login routes to waiter view | Branch-scoped | B |
| WAI-02 | Sees all dine-in orders for branch | QR + waiter-created | B |
| WAI-03 | Create order on behalf of table | Sets `source='waiter'`, auto-accepted | B |
| WAI-04 | Mark "served" | Status updates, customer notified | B |
| WAI-05 | Switch tables | Table change reflected on order + KDS | S |

### 4.7 Inventory manager

| ID | Scenario | Expected | Blocker |
|---|---|---|:---:|
| INV-01 | `/dashboard/inventory` overview | KPIs, low stock, expiry, alerts widgets render | B |
| INV-02 | Realtime alerts | Toast on new low-stock event | S |
| INV-03 | Ingredients CRUD | Create / edit / delete; price history captured | B |
| INV-04 | Prep items CRUD | Same | B |
| INV-05 | Recipe BOM editor | Live COGS + margin computes; saves | B |
| INV-06 | Stock by branch | Valuation cards reflect DB; drill-down works | B |
| INV-07 | Par levels inline edit | Saves without page reload | S |
| INV-08 | Excel template download | Returns 6-sheet xlsx with dropdowns | B |
| INV-09 | Excel import | Validates; surfaces errors + warnings; commits on confirm | B |
| INV-10 | Excel export | Returns current DB in same template format | S |
| INV-11 | Stock check on checkout | Non-blocking warning; no false negatives | S |
| INV-12 | KDS stock dots | Matches inventory state | S |

### 4.8 Marketing

| ID | Scenario | Expected | Blocker |
|---|---|---|:---:|
| MKTG-01 | Promotions list + filters | Active / scheduled / expired states correct | B |
| MKTG-02 | Create promotion (each type) | Percent, flat, BOGO save and apply at checkout | B |
| MKTG-03 | Promotion use-count atomic | Concurrent redemptions don't exceed cap | B |
| MKTG-04 | Coupon wizard | Single-use + multi-use both work | B |
| MKTG-05 | Coupon templates modal | Templates load + apply | S |
| MKTG-06 | Coupon analytics modal | Stats render | S |
| MKTG-07 | Coupon QR | Generates valid QR | S |
| MKTG-08 | Loyalty config edit | Updates global active row; partial unique index respected | B |

### 4.9 Order operations (all branch-scoped roles)

| ID | Scenario | Expected | Blocker |
|---|---|---|:---:|
| ORD-01 | `/dashboard/orders` list | Filter by status, source, branch, date | B |
| ORD-02 | Order detail | Items, modifiers, totals, status timeline, payment, customer | B |
| ORD-03 | Status select | Allowed transitions only; audit log entry per change | B |
| ORD-04 | Bulk actions (if any) | Per role permission | S |

---

## 5. Cross-cutting

### 5.1 Bilingual + RTL

| ID | Scenario | Expected | Blocker |
|---|---|---|:---:|
| I18N-01 | `npx ts-node scripts/check-i18n.ts` (or manual) — every key in both files | No missing key in either ar.json or en.json | B |
| I18N-02 | Numbers + currency formatted per locale | ar uses Arabic-Indic where chosen; BHD with 3 decimals | B |
| I18N-03 | Dates + times localized | ar Hijri/Gregorian per design; en Gregorian | S |
| I18N-04 | RTL flip on `dir="rtl"` | All paddings/margins use logical props; no `pl-/pr-/ml-/mr-` (gate 2) | B |
| I18N-05 | Mixed-direction strings | Numbers + Latin brand names render correctly in `ar` paragraphs | B |
| I18N-06 | Form inputs in `ar` | Cursor + caret behaviour correct; placeholders RTL | S |

### 5.2 Mobile + responsive

| ID | Scenario | Expected | Blocker |
|---|---|---|:---:|
| MOB-01 | All breakpoints (sm, md, lg, xl) render without horizontal scroll | No overflow | B |
| MOB-02 | Touch targets ≥ 44 px | A11y minimum | B |
| MOB-03 | Sticky cart / checkout CTA | Always reachable on mobile | S |
| MOB-04 | Hero LCP image | Mobile ~40 KB (priority Image) | B |

### 5.3 PWA

| ID | Scenario | Expected | Blocker |
|---|---|---|:---:|
| PWA-01 | Driver PWA installable | manifest.json valid, icons present, service worker registers | B |
| PWA-02 | Customer site installable | If supported, install prompt | S |

### 5.4 Realtime + concurrency

| ID | Scenario | Expected | Blocker |
|---|---|---|:---:|
| RT-01 | Two browsers viewing same KDS | Both update within 3 s | B |
| RT-02 | Two cashiers create orders simultaneously | No order id collision; both KDS cards appear | B |
| RT-03 | Driver location updates | Customer + manager receive within 5 s | S |
| RT-04 | Inventory alert fires | Toast on low-stock event in inventory dashboard | S |

### 5.5 Security / RLS spot-checks

| ID | Scenario | Expected | Blocker |
|---|---|---|:---:|
| SEC-01 | Branch manager A queries branch B orders via Supabase JS | RLS denies | B |
| SEC-02 | Kitchen role attempts dashboard analytics | 403 / redirect | B |
| SEC-03 | Anon GET on `driver_locations` | RLS denies (mig 060) | B |
| SEC-04 | Anon GET on `staff` | RLS denies | B |
| SEC-05 | Anon writes to `orders` outside `rpc_create_order` | RLS denies | B |
| SEC-06 | `update_order_item_station_status` RPC with wrong branch | Raises `BRANCH_MISMATCH` (mig 089) | B |
| SEC-07 | Customer queries another customer's order | RLS denies | B |
| SEC-08 | Service role key not exposed in client bundle | grep build output for `SUPABASE_SERVICE_ROLE_KEY` | B |
| SEC-09 | Magic-link token reuse | Single-use enforced | B |
| SEC-10 | Rate limiting on contact form + login | Per Vercel / framework defaults | S |

### 5.6 SEO / GEO

| ID | Scenario | Expected | Blocker |
|---|---|---|:---:|
| SEO-01 | `/robots.txt` | Returns 200, allows production, blocks staging | B |
| SEO-02 | `/sitemap.xml` | All public routes; lastmod recent | B |
| SEO-03 | Per-page metadata | Title + description + OG + canonical correct, no leaked canonical from layout | B |
| SEO-04 | Schema.org | Organization (with phone+address), LocalBusiness per branch, MenuItem, BreadcrumbList, FAQPage validate in Rich Results Test | B |
| SEO-05 | Bing verification meta | Present in `<head>` | B |
| SEO-06 | GA4 + Clarity firing | Network tab confirms on production | S |
| SEO-07 | Speed Insights live | `<SpeedInsights />` in layout | S |
| SEO-08 | hreflang ar / en | Both alternates linked | S |

### 5.7 Performance

| ID | Scenario | Expected | Blocker |
|---|---|---|:---:|
| PERF-01 | Mobile LCP on home | < 2.5 s on simulated 4G | B |
| PERF-02 | INP across menu / checkout | < 200 ms | B |
| PERF-03 | CLS | < 0.1 | B |
| PERF-04 | Lighthouse mobile score (perf, a11y, best-practices, SEO) | ≥ 90 each | S |
| PERF-05 | Bundle size | No regression vs last deploy | S |

### 5.8 Errors + observability

| ID | Scenario | Expected | Blocker |
|---|---|---|:---:|
| ERR-01 | `/[locale]/error.tsx` boundary | Friendly fallback on thrown server error | B |
| ERR-02 | Vercel function logs | No `error` level for healthy traffic | B |
| ERR-03 | Supabase logs | No constant 4xx / 5xx | B |
| ERR-04 | Email send failure (Resend) | Queued retry / logged; user sees friendly message | S |

### 5.9 Email

| ID | Scenario | Expected | Blocker |
|---|---|---|:---:|
| EML-01 | Magic-link email arrives | Subject + body bilingual where applicable, from `noreply@kahramanat.com` | B |
| EML-02 | Order confirmation email | Items + totals + pickup/delivery info correct | S |
| EML-03 | Contact-form auto-reply (if any) | Lands; not in spam | S |

---

## 6. Pre-launch hard gates (must all be `[OK]`)

| Gate | State | Owner |
|---|:---:|---|
| Migration 088 applied to production | OK 2026-05-09 | DB |
| Migration 089 applied to production | OK 2026-05-09 | DB |
| `npx tsc --noEmit` | [ ] | Claude Code |
| `npm run build` (NEXT_BUILD_WORKERS=1) | [ ] | Claude Code |
| All `CLAUDE.md` Phase Completion grep gates clean | [ ] | Claude Code |
| Real chef recipes loaded (Excel) | [ ] | Chef + Ahmed |
| Real staff accounts created (all roles, both branches) | [ ] | Ahmed |
| Tap merchant approval | [ ] | Ahmed (CBB) |
| WhatsApp API verification (Meta) | [ ] | Ahmed |
| Database backup schedule confirmed | [ ] | Ahmed (Supabase) |
| Vercel error rate dashboard reviewed | [ ] | Ahmed |
| `kahramanat.com` domain + SSL healthy | [ ] | Ahmed |
| Robots / sitemap / GSC indexing | [ ] | Marketing |
| Privacy + Terms + Refund finalised in both locales | [ ] | Legal |

---

## 7. Launch decision rubric

- **All `B` rows pass** → green-light launch.
- **Any `B` fails** → block launch, file issue, fix, re-run impacted section.
- **`S` fails** → ship with documented caveat in `docs/qa/known-issues.md` (create on first S failure).
- **`-` fails** → log for post-launch backlog.

---

## 8. Sign-off

| Role | Name | Date | Verdict |
|---|---|---|---|
| Owner | Ahmed | | |
| QA Lead | | | |
| Tech (Claude Code) | | | |

---

## 9. Change log

| Date | Author | Change |
|---|---|---|
| 2026-05-09 | Claude Code session 80 | Initial draft, post migration 088 + types regen + CoWork commit |
