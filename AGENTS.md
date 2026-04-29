# AGENTS.md — Kahramana Baghdad
> Cross-tool rules. Read by Antigravity, Claude Code, Codex, Cursor, and any future agent.
> Last updated: 2026-04-27 (session 3 — added Phone/Menu/DesignTokens/Accessibility rules + Phase Gate checks 6–8)

---

## PROJECT OVERVIEW

Kahramana Baghdad restaurant — full platform rebuild from static site to multi-branch ordering and operations system.

- Live site: https://kahramanat.com
- Plan: `.agent/PLAN.md` (9 phases, 14–20 months)
- State: `.agent/phase-state.json` (live — read every session)
- Rules: `.agent/RULES.md` (shared constraints — always apply)

---

## MANDATORY FIRST ACTIONS (every session, every tool)

1. Read `.agent/phase-state.json`
2. Identify current phase and status
3. Report: current phase / completed deliverables / pending deliverables / blockers
4. Wait for human confirmation before starting work

---

## TECH STACK

```
Framework:    Next.js 15 App Router
Language:     TypeScript strict (no `any`, no `as unknown`)
Styling:      Tailwind CSS v4
i18n:         next-intl (AR primary, EN secondary)
Database:     Supabase (PostgreSQL + RLS + Auth)
CMS:          Sanity (menu, images, pricing — all content)
Animations:   Framer Motion
Hosting:      Vercel Pro
CDN:          Cloudflare
Jobs:         Railway + BullMQ
Cache:        Upstash Redis
Analytics:    GA4 + Microsoft Clarity
Monitoring:   Sentry
Email:        Resend (transactional — password reset, order confirmations, reports)
```

---

## ABSOLUTE CODE RULES

### RTL / CSS
```
OK USE:  ps-4  pe-4  ms-auto  me-4  ps-[20px]  border-s  rounded-s
NO BAN:  pl-4  pr-4  ml-auto  mr-4  pl-[20px]  border-l  rounded-l
```
This is non-negotiable. RTL breaks silently with directional classes.

### TypeScript
```typescript
// OK Correct
const schema = z.object({ name: z.string().min(1) })
type Input = z.infer<typeof schema>

// NO Never
const data = response as any
```

### Bilingual
```typescript
// OK Correct — ALL text via next-intl
const t = useTranslations('menu')
return <h1>{t('title')}</h1>

// NO Never — hardcoded strings
return <h1>كهرمانة بغداد</h1>
```

### Supabase
```sql
-- Every new table must have this
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
-- Then add specific policies
```

### Phone Numbers & Contact Data
```typescript
// OK Correct — import from single source of truth
import { BRANCHES, buildWaOrderLink } from '@/constants/contact'
const link = buildWaOrderLink('riffa', 'ar')

// NO Never — hardcoded phone numbers or wa.me links anywhere in source
const link = 'https://wa.me/97317131413'
const phone = '+97317131413'
```
Violation grep: `grep -rn "97317\|wa\.me/" src/ app/ components/ | grep -v "src/constants/contact.ts"`
All branch phone numbers, WhatsApp links, and Maps URLs live exclusively in `src/constants/contact.ts`. (`src/constants/contact.ts` is the ALLOWED single source of truth — exempt from this grep, same as `lib/design-tokens.ts` is exempt from the hex color grep.)
Runtime values (used in order flow) are fetched from Supabase `branches` table to allow updates without redeploy.

### Menu Pricing — 4 Structures
`src/data/menu.json` uses 4 distinct pricing structures. ALWAYS access menu data through `src/lib/menu.ts` (normalization layer) — never read the raw JSON directly in components.

```
Structure 1: { price_bhd: 1.6 }                        → 127 items (single price)
Structure 2: { sizes: { S: 1.5, L: 2.5 } }             → 40 items (size selector)
Structure 3: { variants: [{ label:{ar,en}, price_bhd }]}→ 10 items (variant selector)
Structure 4: { sizes: {...}, variants: [{label:{ar,en}}]}→ 2 items (quzi: size=paid, variant=free stew choice)
```
Note: `sizes` keys (S/M/L/XL/Glass/0.5L/1L/1.5L/1KG/HALF KG) have no bilingual labels in JSON — UI layer must map them.

### Design Tokens
```typescript
// OK Correct — import from design tokens
import { colors, fonts } from '@/lib/design-tokens'
const gold = colors.brand.gold  // '#C8922A'

// NO Never — raw hex values in components
<div className="text-[#C8922A]" style={{ color: '#0A0A0A' }}>
```
Violation grep: `grep -rn "#[0-9a-fA-F]\{6\}" src/ app/ components/ --include="*.tsx" --include="*.ts"`
`lib/design-tokens.ts` is the single source of truth. Brand colors: black `#0A0A0A`, gold `#C8922A`. Inter font is FORBIDDEN.

### Accessibility
- All interactive elements must have `aria-label` — in Arabic when locale is AR
- Every async data section needs an error boundary + loading state
- Images must have meaningful `alt` text (bilingual where visible to user)

---

## PHASE GATE — MANDATORY

Before claiming any phase is done:
1. Every file in `deliverables_pending` must physically exist on disk
2. `tsc --noEmit` must pass
3. Zero occurrences of `pl-|pr-|ml-|mr-` in source files
4. All i18n keys present in both `ar.json` and `en.json`
5. All new tables have RLS enabled
6. Zero hardcoded phone numbers: `grep -rn "97317\|wa\.me/" src/ app/ components/ | grep -v "src/constants/contact.ts"` → must return nothing
7. Zero forbidden fonts: `grep -rn "Inter\|Poppins\|Nunito\|Montserrat\|Raleway\|Roboto" app/ components/ --include="*.tsx"` → must return nothing
8. Zero raw hex colors in components: `grep -rn "#[0-9a-fA-F]\{6\}" app/ components/ --include="*.tsx"` → must return nothing (only `lib/design-tokens.ts` may contain hex values)

Only after all 8 pass → update `phase-state.json` and unlock next phase.

---

## DO NOT

- Start Phase N+1 before Phase N is verified done in `phase-state.json`
- Use `<img>` instead of Next.js `<Image>`
- Store menu content outside Sanity (exception: `src/data/menu.json` is allowed as Phase 1 temporary source — see RULES.md)
- Hardcode branch phone numbers anywhere in source — ALWAYS import from `src/constants/contact.ts`
- Skip the session start status report
- Touch Phase 8 (AI) — it is future work, do not scaffold
- Add any library not in the tech stack without explicit human approval
- Build customer login/signup in Phase 1 — Phase 1 is Guest Only

> **Phase 6 note**: When WhatsApp Business API is integrated in Phase 6, phone numbers will migrate to environment variables and Supabase `branches` table for runtime updates. Until then, `src/constants/contact.ts` is the single and only source.
