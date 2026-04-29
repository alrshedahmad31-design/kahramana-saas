# SKILL: Phase 0 — Discovery & Operational Audit

## Description
Load this skill when Phase 0 is active. Phase 0 is NOT a coding phase.
The agent's job is to **document and research** — not to build anything.

---

## Nature of This Phase

Phase 0 = information gathering + documentation only.
Every deliverable is a Markdown file in `docs/audit/`.
No `app/`, no `components/`, no Supabase tables — nothing is built yet.

---

## Step-by-Step Execution

### Step 1 — Site Audit → `docs/audit/site-audit.md`

Open https://kahramanat.com using the browser tool. Document:

```markdown
# Site Audit — kahramanat.com
Date: [today]

## Performance
- PageSpeed mobile score: [run https://pagespeed.web.dev/]
- LCP: [value]
- CLS: [value]
- FCP: [value]

## Current Tech Stack
- Built with: [detect from source]
- Hosting: [detect]
- CDN: [detect]

## Broken Elements
- [ ] List every broken image URL
- [ ] List every 404 link
- [ ] List missing meta tags

## Current Pages / URLs
- / — [title]
- /menu — [exists? title?]
- [all detected URLs]

## Current Menu Structure
- Categories detected: [list]
- Estimated item count: [count]
- Language: [AR only / bilingual?]

## Mobile Experience
- Responsive: [yes/no]
- Touch targets: [adequate?]
- Font readability: [adequate?]

## Current WhatsApp Integration
- wa.me link found: [yes/no]
- Number: [redact last 4]
- Branch routing: [single number / per branch?]

## Critical Issues
1. [issue]
2. [issue]
```

---

### Step 2 — SEO Migration Plan → `docs/audit/seo-migration-plan.md`

Before rebuilding, protect existing Google rankings.

```markdown
# SEO Migration Plan
Date: [today]

## Current URL Structure
| Current URL | New URL | Redirect Type |
|---|---|---|
| / | / | Same |
| /menu | /menu | Same or 301 |
| [all pages] | [new path] | 301 |

## Google Search Console Status
- Property verified: [ask human — yes/no]
- Current impressions: [ask human]
- Top ranking pages: [list if known]

## Migration Rules
- All old URLs → 301 redirect to new URL
- No URL should return 404 after launch
- Canonical tags on all pages
- sitemap.xml must be updated on launch day
- robots.txt must allow all public pages

## Schema.org Required
- Restaurant schema on homepage
- Menu schema on menu page
- LocalBusiness with both branch addresses
- BreadcrumbList on all inner pages
```

---

### Step 3 — Data Map → `docs/audit/data-map.md`

Document what data exists and what is missing.

```markdown
# Data Map
Date: [today]

## Menu Data
- Total categories: [count]
- Total items: [count — target ~194]
- Items with Arabic name: [count]
- Items with English name: [count]
- Items with price: [count]
- Items with image: [count]
- Items missing image: [list names]

## Branch Data
| Branch | Name AR | Name EN | Address | WhatsApp | Hours |
|---|---|---|---|---|---|
| Riffa | | | | | |
| Qallali | | | | | |
| Al-Badi' | Planned | Planned | — | — | — |

## Assets Inventory
| Asset | Status | Notes |
|---|---|---|
| Logo SVG | NO / OK | |
| Logo PNG (transparent) | NO / OK | |
| Dish photos | NO / OK | X of 194 ready |
| Branch photos | NO / OK | |
| OG image (1200×630) | NO / OK | |

## Data Sources
- Menu data currently lives in: [website HTML / Google Sheet / paper / other]
- Format: [structured / unstructured]
- Bilingual: [yes / partial / no]
```

---

### Step 4 — WhatsApp Flow → `docs/audit/whatsapp-flow.md`

Document the current ordering process end-to-end.

```markdown
# Current WhatsApp Order Flow
Date: [today]

## Customer Journey (current)
1. Customer visits site
2. [step]
3. [step — how do they reach WhatsApp?]
4. Customer sends order via WhatsApp
5. [who receives? what happens next?]

## Pain Points Identified
- [pain point 1]
- [pain point 2]

## New Flow (Phase 1 target)
1. Customer visits new site
2. Browses menu → adds to cart
3. Goes to checkout → fills name, phone (optional), branch, notes
4. Clicks "Send Order" → wa.me link opens with pre-filled summary
5. Order simultaneously saved to Supabase
6. Admin sees order in dashboard

## Branch WhatsApp Numbers
- Riffa: +973 [XXXX XXXX] — confirm with client
- Qallali: +973 [XXXX XXXX] — confirm with client
```

---

### Step 5 — Blockers → `docs/audit/blockers.md`

```markdown
# Blockers — Items Required from Restaurant Before Phase 1

## Critical (Phase 1 cannot launch without these)
| Item | Description | Status | Who Provides |
|---|---|---|---|
| Logo SVG | Vector logo, transparent background | NO Pending | Restaurant |
| Branch WhatsApp numbers | Both Riffa and Qallali confirmed | NO Pending | Restaurant |
| Menu data | All items, AR+EN names, prices, categories | NO Pending | Restaurant |
| Dish photos | Minimum: hero dishes (top 20) | NO Pending | Restaurant |

## Important (Phase 1 quality degrades without these)
| Item | Description | Status |
|---|---|---|
| Remaining dish photos | All 194 items | NO Pending |
| Branch addresses | Full Arabic + English | NO Pending |
| Opening hours | Both branches, all days | NO Pending |
| Staff accounts | Admin names + roles | NO Pending |

## Phase 3 Specific (not needed until Phase 3)
| Item | Description | Status |
|---|---|---|
| Chef recipes | Exact quantities for all ~194 dishes | NO Pending |

## External Approvals (start now — long lead time)
| Item | Lead Time | Status |
|---|---|---|
| Benefit Pay merchant account | 2–4 months via CBB | NO Not started |
| Meta Business Verification | 2–4 weeks | NO Not started |
```

---

## Phase 0 Completion Protocol

Before marking Phase 0 done, verify all 5 files exist and are filled:

```bash
ls -la docs/audit/
# Must show: site-audit.md, seo-migration-plan.md, data-map.md,
#            whatsapp-flow.md, blockers.md
# None should be empty (> 500 bytes each)
```

Then ask the human:
> "Phase 0 audit is complete. هل راجعت الملفات وتريد المتابعة إلى Phase 1؟"

**Do NOT auto-advance to Phase 1. Wait for explicit human confirmation.**
