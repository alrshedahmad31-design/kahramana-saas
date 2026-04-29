# KAHRAMANA — SHARED EXECUTION RULES
> These rules apply to ALL agents on this project regardless of tool used.

---

## THE PRIME DIRECTIVE

**Before doing anything in a session:**
1. Read `.agent/phase-state.json`
2. Find the current active phase using this algorithm:
   - First: look for any phase with status `in_progress` → that is the active phase
   - If none: look for the first phase with status `locked` whose `prerequisite` phase is `done` → that is the next phase to unlock (report it, do not start without confirmation)
   - If none found: report **"لا توجد مرحلة نشطة — شغّل `/start-phase N`"** and stop
3. Verify prerequisite phases are `done` in `phase-state.json` — if not, STOP and report the blocker
4. Present a status summary to the human before touching any file

**After completing any work:**
1. Update `.agent/phase-state.json` — move completed deliverables from `pending` to `completed`
2. If all deliverables for a phase are done → set status to `done`, set `completed_at`
3. Unlock the next phase in `phase-state.json`

---

## PHASE GATE PROTOCOL

A phase is `done` ONLY when ALL of the following pass:

1. Every file in `deliverables_pending` physically exists on disk (verified, not assumed)
2. `npx tsc --noEmit` passes — zero TypeScript errors
3. Zero RTL violations: `grep -rn "\bpl-\|\bpr-\|\bml-\|\bmr-\|padding-left\|padding-right\|margin-left\|margin-right" app/ components/ lib/ --include="*.tsx" --include="*.ts" --include="*.css"`
4. All i18n keys present in both `messages/ar.json` AND `messages/en.json`
5. All new Supabase tables have RLS enabled
6. Zero hardcoded phones/links: `grep -rn "97317\|wa\.me/" src/ app/ components/ --include="*.tsx" --include="*.ts" | grep -v "src/constants/contact.ts"` → must return nothing (`src/constants/contact.ts` is the ALLOWED single source of truth — exempt like `lib/design-tokens.ts` is exempt from the hex check)
7. Zero forbidden fonts: `grep -rn "Inter\|Poppins\|Nunito\|Montserrat\|Raleway\|Roboto" app/ components/ --include="*.tsx" --include="*.ts"` → must return nothing
8. Zero raw hex in components: `grep -rn "#[0-9a-fA-F]\{6\}" app/ components/ --include="*.tsx" --include="*.ts"` → must return nothing (only `lib/design-tokens.ts` is exempt)
9. `npm run build` completes without errors
10. Zero hidden-on-mobile patterns in critical components (checkout, cart, menu — these MUST work on mobile):
    ```bash
    grep -rn "hidden sm:block\|hidden md:block" \
      app/\(ordering\)/ components/checkout/ components/cart/ components/menu/
    # Must return nothing — hiding checkout/cart/menu elements on mobile is a critical UX bug
    ```

Only after all 10 pass → update `phase-state.json`, set `completed_at`, unlock next phase.

**A phase is NEVER done just because code was written.**

---

## CODE STANDARDS — NON-NEGOTIABLE

### CSS / Styling
- ONLY use CSS logical properties: `ps`, `pe`, `ms`, `me`, `bs`, `be`
- FORBIDDEN: `pl`, `pr`, `ml`, `mr`, `padding-left`, `padding-right`, `margin-left`, `margin-right`
- Violation of this rule breaks RTL layout — it is a critical bug

### TypeScript
- Strict mode always — no `any`, no `as unknown`
- Zod validation on ALL external inputs (API, forms, Supabase responses)
- Error boundaries on all async Server Components

### Bilingual
- Arabic is primary (html dir="rtl", lang="ar")
- Every user-facing string MUST exist in both `messages/ar.json` AND `messages/en.json`
- No hardcoded Arabic or English strings in components — use next-intl only

### Supabase
- Every table must have RLS enabled — no exceptions
- No direct DB queries in React components — only through `lib/supabase/`
- Auth uses Supabase Auth (Magic Link + optional Google OAuth)

### Performance
- Images: Next.js `<Image>` always — never raw `<img>`
- No bundle > 250kb first load JS
- LCP target: < 3s on mobile 4G

---

## MOBILE-FIRST — NON-NEGOTIABLE

90% of customers AND staff access the site via smartphones.
This is not a preference — it is the primary platform.

**Rules:**
- Every component is designed mobile-first; desktop is the adaptation
- Touch targets: minimum **44×44px** on ALL interactive elements (buttons, links, cards, icons)
- Body font size: minimum **16px** — prevents iOS Safari auto-zoom on any text
- Input fields: minimum height **48px**, `font-size: 16px` — prevents iOS auto-zoom on focus
- Cart: **full-screen bottom sheet** on mobile, side drawer on desktop (≥ 1024px)
- Category filter: **horizontal scroll with CSS scroll-snap + touch momentum** — never a wrapping grid on mobile
- KDS (Phase 2): dish name `font-size: 24px+`, touch targets `48×48px+` — readable from 1 meter distance in a noisy kitchen environment
- Dashboard: fully functional on mobile — **zero "please use desktop" messages** allowed
- Test every component at **375px width (iPhone SE)** before any other breakpoint
- Images: always set `sizes` prop on `<Image>` for responsive loading — optimize for mobile bandwidth first
- No horizontal overflow on any page at any mobile width

**Acceptance criteria added to EVERY phase:**
- [ ] All touch targets ≥ 44×44px (verified in browser DevTools)
- [ ] All `<input>` / `<textarea>` / `<select>` have `font-size: 16px` minimum
- [ ] Zero horizontal scroll at 375px on any page
- [ ] Lighthouse mobile Performance ≥ 85, Accessibility ≥ 90

---

## PRICE SNAPSHOT RULE — NON-NEGOTIABLE

When an order is created, the price of each item MUST be copied into `order_items.unit_price_bhd` at that exact moment.

```typescript
// OK Correct — price captured at order creation time
order_items.unit_price_bhd = menuItem.resolvedPrice  // from src/lib/menu.ts at request time

// NO Never — joining back to Sanity/CMS to get the price after the fact
order_items.sanity_item_id = id  // and then fetching price on render
```

**Why**: Prices in Sanity CMS can be updated at any time. A price change MUST NOT retroactively alter existing orders, receipts, or revenue reports. The snapshot in `order_items` is the legal and financial record.

**Enforcement**: Agents must never query Sanity for prices when displaying historical orders. Always use the stored `unit_price_bhd` from the database.

---

## DATABASE MIGRATION RULES

Every Supabase schema change must follow this protocol:

```
lib/supabase/migrations/
  YYYYMMDD_short_description.sql   ← one file per change
```

Rules:
1. **One change per file** — never combine unrelated changes
2. **Always reversible** — include a `-- ROLLBACK:` comment with the inverse SQL
3. **New columns must have DEFAULT or be nullable** — never break existing rows
4. **Never change a column type directly** — add new column → migrate data → drop old column
5. **Test on staging first** — apply to Supabase branch before production
6. **Verify after apply** — run a row count SELECT before deploying the app

---

## MENU DATA SOURCE — PHASE 1 EXCEPTION

**Phase 1 uses `src/data/menu.json` as the temporary menu data source.** This is intentional and not a violation of the "no content outside Sanity" rule.

The migration happens incrementally during Phase 1:
- Start: components read from `src/lib/menu.ts` (which normalizes `src/data/menu.json`)
- During Phase 1: Sanity schema is built and populated in parallel
- End of Phase 1: Sanity becomes the live source; `src/data/menu.json` becomes read-only backup
- **Do NOT delete `src/data/menu.json` until a human explicitly confirms Sanity contains all 179+ items with verified pricing**

---

## WHAT AGENTS MUST NOT DO

- Do not start Phase N+1 work before Phase N is verified done
- Do not mark a phase done without updating `phase-state.json` with real file paths
- Do not add a service/library not listed in the tech stack without asking first
- Do not write inline styles with directional properties (left/right)
- Do not delete or modify `src/data/menu.json` — it is the source backup until Sanity is confirmed complete
- Do not scaffold Phase 8 (AI) — it is future work, do not touch
- Do not build customer login/signup in Phase 1 — Phase 1 is Guest Only
- Do not recalculate prices from Sanity for historical orders — always use `order_items.unit_price_bhd`

---

## SESSION START TEMPLATE

Every session must begin with this report:

```
Status: KAHRAMANA STATUS
Current Phase: [N] — [Phase Name]
Phase Status: [pending/in-progress/locked]
Prerequisite: [done/BLOCKED — reason]

OK Completed deliverables: [list]
Pending Pending deliverables: [list]
Blockers: Blockers: [list or "none"]

Ready to work on: [specific next task]
```

---

## BLOCKERS PROTOCOL

If a blocker is external (restaurant data, payment approval, etc.):
- Document it in `phase-state.json` under `blockers`
- Do NOT skip the phase or work around it with dummy data
- Report it clearly and wait for human decision
