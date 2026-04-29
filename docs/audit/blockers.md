# BLOCKERS — Kahramana Baghdad
> Phase 0 Audit | Generated: 2026-04-27 | Agent: Claude
> External dependencies that CANNOT be resolved by code. Must be tracked separately.

---

## PRIORITY 1 — Blocks Phase 1 Launch

### OK Logo SVG — DONE

| Field | Detail |
|---|---|
| Status | OK Done |
| File | `public/brand/logo.svg` |
| viewBox | `0 0 326 766` OK |
| Dimensions | `width="100%"` — no fixed pixels OK |
| Fill | `fill="currentColor"` for black paths (theme-switchable) — gold brand colors preserved OK |
| Resolved | 2026-04-27 |

---

### Medium Dish Photos — PARTIAL (183/~194)

| Field | Detail |
|---|---|
| Status | Warning: Partial |
| Available | 183 images in `/public/assets/gallery/` |
| Expected | ~194 items across all menu categories |
| Gap | ~11 dishes with missing photos |
| Workaround | Use placeholder image (`/assets/gallery/placeholder.webp`) — create one in Phase 1 |
| Action required | Identify which ~11 items are missing and photograph them |

---

### OK Menu Data — DONE (structure complete, ~15 items pending)

| Field | Detail |
|---|---|
| Status | OK Done (data complete) / Warning: Partial (items count) |
| File | `src/data/menu.json` |
| Items received | 179 of ~194 (~15 missing from restaurant) |
| Categories | 16 confirmed |
| Names (AR + EN) | OK All 179 items bilingual |
| Descriptions (AR + EN) | OK All 179 items bilingual |
| Images | OK All 179 items have `image_url` |
| Pricing | OK 179/179 — 4 structures: direct / sizes / variants-priced / sizes+variants-free |
| Action required | Restaurant to provide ~15 remaining items (Phase 1 can launch with 179) |
| Resolved | 2026-04-27 |

---

### OK Branch WhatsApp Numbers — DONE

| Field | Detail |
|---|---|
| Status | OK Done |
| Riffa | +973 1713 1413 → `https://wa.me/97317131413` |
| Muharraq / Qallali | +973 1713 1213 → `https://wa.me/97317131213` |
| Docs | `docs/branches.md` (source of truth) |
| Code | `src/constants/contact.ts` (single import point for all contact data) |
| Resolved | 2026-04-27 |
| Remaining | Google Maps URLs still pending — restaurant to confirm |

---

### Critical Staff Data & Roles — PENDING

| Field | Detail |
|---|---|
| Status | NO Pending |
| What's needed | List of staff who need dashboard access: name, role (admin/manager/staff), branch assignment |
| Why it matters | Required to configure Supabase Auth + RLS policies in Phase 1 |
| Action required | Restaurant management to provide staff list with roles |

---

---

### Critical Internal Contact / Project Owner — PENDING

| Field | Detail |
|---|---|
| Status | NO Pending |
| What's needed | One named person from the restaurant responsible for decisions, data provision, and approvals |
| Why it matters | Without a clear point of contact, every decision is delayed — especially for RBAC setup, data entry, and legal approvals |
| Action required | Restaurant management to designate an internal project owner |

---

### Critical Cancellation & Refund Policy — PENDING

| Field | Detail |
|---|---|
| Status | NO Pending |
| What's needed | Written policy: what can be cancelled, within what timeframe, how refunds work |
| Why it matters | Legal requirement before Phase 1 launch — must be displayed at checkout |
| Action required | Restaurant management to draft and approve policy |

---

### Critical Google Business Profile Access — PENDING

| Field | Detail |
|---|---|
| Status | NO Pending |
| What's needed | Access to Google Business Profile for kahramanat.com (or confirmation it doesn't exist) |
| Why it matters | Required for Schema.org verification, Google Maps listing accuracy, and local SEO |
| Action required | Locate or create Google Business Profile — share management access |

---

## PRIORITY 2 — Blocks Phase 3

### Critical Suppliers List + Raw Materials — PENDING

| Field | Detail |
|---|---|
| Status | NO Pending |
| What's needed | List of all ingredient suppliers, raw material names (AR + EN), units of measure |
| Why it matters | Required to build the inventory schema and link ingredients to chef recipes in Phase 3 |
| Action required | Restaurant / head chef to provide supplier contacts and materials list |

---

### Critical Chef Recipes (Exact Quantities) — PENDING

| Field | Detail |
|---|---|
| Status | NO Pending — CRITICAL |
| What's needed | Every dish (~194) with exact ingredient quantities (grams/ml) |
| Why it matters | Inventory auto-deduction in Phase 3 is impossible without this |
| Timeline | 3–5 weeks of joint data entry with chef required |
| Action required | Schedule working sessions with head chef before Phase 2 completion |

---

## PRIORITY 3 — Blocks Phase 6 (start paperwork at Phase 1 launch)

### Critical Benefit Pay Merchant Account — NOT STARTED

| Field | Detail |
|---|---|
| Status | NO Not started |
| Authority | Central Bank of Bahrain (CBB) |
| Timeline | 2–4 months approval process |
| Action required | **Start paperwork at Phase 1 launch** — cannot be accelerated |

### Critical Meta Business Verification — NOT STARTED

| Field | Detail |
|---|---|
| Status | NO Not started |
| Required for | WhatsApp Business API (Phase 6) |
| Action required | Begin Meta Business Manager verification process |

---

## PRIORITY 4 — Blocks Phase 7

### Critical Deliverect Contract — NOT STARTED

| Field | Detail |
|---|---|
| Status | NO Not started |
| Dependency | Must confirm Bahrain availability with Deliverect sales team |
| Action required | Contact Deliverect for Bahrain availability + pricing |

### Critical POS API Documentation — NOT STARTED

| Field | Detail |
|---|---|
| Status | NO Not started |
| What's needed | API docs for the restaurant's current POS system |
| Action required | Restaurant to identify which POS they use and provide API access |

---

## Font File Notes (Technical — Phase 1)

| Issue | Detail |
|---|---|
| `EditorialNew-Light.woff2` | File exists but design-system expects `EditorialNew-Regular.woff2` for weight 300 — rename or update `@font-face` declaration |
| `Satoshi-Variable.woff2` missing | Only static weights present (Regular + Medium). Variable font preferred for range support — download from fontshare.com |
| Cairo & Almarai | Will load via `next/font/google` in Phase 1 — acceptable, no action needed |

---

## Summary Table

| Blocker | Priority | Blocks | Status |
|---|---|---|---|
| Logo SVG | P1 | Phase 1 | OK Done — `public/brand/logo.svg` |
| Dish photos (~11 missing) | P1 | Phase 1 (partial) | Warning: 183/194 present |
| Menu data — ~15 items still missing | P1 | Phase 1 | OK 179/~194 done — can launch, ~15 pending |
| Branch WhatsApp numbers | P1 | Phase 1 | OK Done — `src/constants/contact.ts` |
| Staff data & roles | P1 | Phase 1 | NO Pending |
| Internal contact person | P1 | Phase 1 | NO Pending |
| Cancellation & refund policy | P1 | Phase 1 | NO Pending |
| Google Business Profile | P1 | Phase 1 | NO Pending |
| Suppliers list + raw materials | P2 | Phase 3 | NO Pending |
| Chef recipes | P2 | Phase 3 | NO Pending |
| Benefit Pay merchant | P3 | Phase 6 | NO Not started |
| Meta Business Verification | P3 | Phase 6 | NO Not started |
| Deliverect contract | P4 | Phase 7 | NO Not started |
| POS API docs | P4 | Phase 7 | NO Not started |
