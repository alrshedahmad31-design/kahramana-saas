# LAST-SESSION.md — Kahramana Baghdad

**Session ID**: 49
**Date**: 2026-05-03
**Focus**: SEO Fixes Batch — Items 2–17 (canonical, sitemap, hreflang, schemas, llms.txt, robots, about)

---

## Accomplishments

### Phone number verification
- `src/constants/contact.ts` confirmed correct: Riffa +97317131413, Qallali +97317131213. No changes needed.

### Fix 2 — AR canonical (layout.tsx)
- `alternates.canonical` now returns `BASE` for AR (no `/ar` prefix), `${BASE}/en` for EN.

### Fix 3 — Sitemap AR URLs remove /ar prefix (sitemap.ts)
- All 4 URL groups (staticUrls, branchUrls, categoryUrls, itemUrls) now use `locale === 'ar' ? BASE${path} : BASE/en${path}`.
- alternates.languages.ar also fixed to no-prefix.

### Fix 4 + Fix 14 — Hreflang no-prefix AR + ar-BH/en-BH region codes (layout.tsx)
- AR hreflang href: `${SITE_URL}${alternatePath}` (no /ar prefix).
- EN hreflang href: `${SITE_URL}/en${alternatePath}`.
- x-default: same as AR (no prefix).
- hrefLang values changed: `"ar"` → `"ar-BH"`, `"en"` → `"en-BH"`.

### Fix 5 — /public/llms.txt
- Created new file with bilingual restaurant summary, branch hours/phones, cuisine, ordering, and links.

### Fix 8 — OpeningHoursSpecification closes 25:00 (schemas.ts)
- Added `schemaClosesTime()` helper: converts any close time with hour < 6 to `hour+24:mm` (e.g. 01:00 → 25:00).
- `buildOpeningHours()` now uses `schemaClosesTime(branch.hours.closes)`.

### Fix 9 — Branches FAQ bilingual (branches/page.tsx)
- Renamed `BRANCH_FAQS` → `BRANCH_FAQS_AR`.
- Added `BRANCH_FAQS_EN` with English translations of all 5 questions.
- Component now selects `isAr ? BRANCH_FAQS_AR : BRANCH_FAQS_EN`.

### Fix 12 — AI crawler directives (robots.ts)
- Added explicit `Allow: /` rules for: GPTBot, OAI-SearchBot, anthropic-ai, ClaudeBot, Google-Extended, PerplexityBot, Applebot-Extended.
- Removed `host` directive (ignored by Google/Bing).

### Fix 13 — About page hardcoded domain (about/page.tsx)
- `schemaOrg.url`: `https://kahramanat.com/...` → `${SITE_URL}/...`
- `schemaOrg.mainEntity['@id']`: hardcoded → `${SITE_URL}/#organization`

### Fix 14 (branches/page.tsx)
- `generateMetadata` alternates.languages keys: `'ar'`/`'en'` → `'ar-BH'`/`'en-BH'`.
- AR canonical URL: `${BASE}/branches` (no /ar prefix), EN: `${BASE}/en/branches`.
- OG url uses same `canonicalUrl` variable.

### Fix 15 — Doubled branches page title (branches/page.tsx)
- Title changed to `{ absolute: '...' }` format — bypasses layout template appending brand name.
- AR: `فروع كهرمانة بغداد — الرفاع وقلالي | كهرمانة بغداد`
- EN: `Kahramana Baghdad Branches — Riffa & Qallali | Kahramana Baghdad`

### Fix 16 — Founder Person schema (schemas.ts + about/page.tsx)
- Added `buildFounderSchema()` export in schemas.ts: Person with @id, name, alternateName, jobTitle, worksFor.
- Linked from `buildOrganizationSchema()` via `founder: buildFounderSchema()`.
- About page imports and injects standalone founder JSON-LD `<script>`.

### Fix 17 — EN about page meta description (about/page.tsx)
- Old: generic marketing copy with no entities.
- New: "Kahramana Baghdad — authentic Iraqi restaurant in Bahrain since 2018. Founded by Eng. Asaad Al-Jubouri, serving 168+ traditional Baghdadi dishes across two branches in Riffa and Qallali."

---

## Modified Files

- `src/app/[locale]/layout.tsx` — AR canonical fix + hreflang ar-BH/en-BH + no-prefix AR hrefs
- `src/app/sitemap.ts` — AR no-prefix URLs in all sections
- `src/lib/seo/schemas.ts` — closes 25:00 helper + buildFounderSchema + founder in org schema
- `src/app/[locale]/branches/page.tsx` — bilingual FAQ + absolute title + canonical + hreflang region codes
- `src/app/robots.ts` — AI crawler allow rules + removed host directive
- `src/app/[locale]/about/page.tsx` — hardcoded domain fix + EN description + founder JSON-LD
- `public/llms.txt` — NEW FILE

---

## Phase Gates (session 49)

- `npx tsc --noEmit`: PASS — 0 errors
- `npm run build`: PASS — 856 pages, 0 errors
- Old phone number grep (17198198, 17775596): PASS — 0 results
- Correct numbers in contact.ts: VERIFIED — +97317131413, +97317131213

---

## Decisions Made

1. `schemaClosesTime()` threshold is `h < 6` — any close time before 6 AM treated as past-midnight. Covers both branches (01:00 → 25:00).
2. `buildFounderSchema()` returns Person without `@context` — nested in Organization cleanly; about page adds `@context` for standalone injection.
3. `llms.txt` placed in `/public/` — served at `https://kahramanat.com/llms.txt` automatically by Next.js static file serving.

---

## Pending / Next Steps

### Still outstanding from session 48 SEO audit
1. **Verify/set kahramanat.com as primary Vercel domain** (non-code — Ahmed must do in Vercel dashboard)
2. Add visible `<HomeFAQ />` component to `page.tsx` consuming `home.faq` translation keys (homepage body copy ~80 words — needs 500+)
3. Replace goo.gl shortlinks with `<iframe>` Maps embeds on branch pages
4. Add `aggregateRating` to `buildBranchLocalBusiness` (needs real GBP rating values from Ahmed)
5. Fix about page canonical in generateMetadata: `${SITE_URL}/${locale}/about` still generates `/ar/about` for AR — should be `/about` (not in this batch's scope)
6. Submit sitemap in Google Search Console after domain propagation

### Non-code
7. Optimise `/public/assets/logo.svg` (292KB) → PNG/WebP at 2x ≤15KB
8. Pull `aggregateRating` values from GBP monthly and update schema

---

## Blockers

- Custom domain `kahramanat.com` not yet live on Vercel (must be done before canonicals/indexing fixes matter)
- `aggregateRating` needs real GBP data from Ahmed
