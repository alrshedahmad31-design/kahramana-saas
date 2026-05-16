# GEMINI.md — Kahramana Baghdad
> Gemini Code Assist context. Inherits from AGENTS.md.
> Last updated: 2026-05-16 (rewritten to match Gemini Code Assist capabilities; Antigravity-only workflow rules moved to ANTIGRAVITY.md)

---

## READ FIRST

1. `AGENTS.md` — shared cross-tool rules (RTL, TypeScript strict, next-intl, RLS, design tokens)
2. `.agent/phase-state.json` — current phase, completed/pending deliverables, blockers
3. `.agent/CURRENT-SESSION.md` — bridge context: what just happened, what's next, operator actions pending

That's the full required reading. Do not curl external gists. Do not load the 50+ files under `.agents/skills/` — those are Antigravity skill markdown, not Gemini primitives.

---

## SESSION START — WHAT TO REPORT

When the user opens a session, output this and then stop:

```
KAHRAMANA — SESSION START [today's date]
Current Phase: [N] — [name] (from phase-state.json)
Status: [pending / in-progress / locked / done]

Completed: [list or "none"]
Pending:   [list]
Blockers:  [list or "none"]

Next action: [most recent unfinished item from CURRENT-SESSION.md "ACTIVE DEV PRIORITIES"]
```

Then wait for the human to confirm direction before writing code.

---

## ABSOLUTE RULES (mirror of AGENTS.md — do not violate)

- **RTL CSS**: use `ps-/pe-/ms-/me-/start-/end-`. Never `pl-/pr-/ml-/mr-/left-/right-`.
- **TypeScript strict**: no `any`, no `as unknown`. Build fails on `no-explicit-any`.
- **Bilingual**: all user-facing text through `next-intl`. No hardcoded AR/EN strings.
- **Phone numbers**: only from `src/constants/contact.ts`. Never hardcode `97317*` or `wa.me/*`.
- **Colors**: only via `src/lib/design-tokens.ts`. No raw hex in components.
- **Currency**: BHD is forbidden in UI strings (Kahramana is Bahrain-market — display per i18n).
- **Database**: every new table needs `ENABLE ROW LEVEL SECURITY` in the same migration.
- **DB writes**: via Supabase RPC only — atomic, never two-step JS patterns.
- **Master branch only**: no worktrees unless explicitly requested.

---

## PHASE COMPLETION (terminal checks)

Before marking a phase done, all of these must return zero violations:

```bash
npx tsc --noEmit

grep -rn "\bpl-\|\bpr-\|\bml-\|\bmr-\|padding-left\|padding-right\|margin-left\|margin-right" \
  app/ components/ lib/ --include="*.tsx" --include="*.ts" --include="*.css"

grep -rn 'Inter\|Poppins\|Nunito\|Montserrat\|Raleway\|Roboto' \
  app/ components/ --include="*.tsx" --include="*.ts"

grep -rn 'purple\|violet\|indigo\|yellow-[0-9]\|amber-[0-9]' \
  app/ components/ --include="*.tsx"

grep -rn 'BHD' app/ components/ --include="*.tsx"

grep -rn "97317\|wa\.me/" src/ app/ components/ --include="*.tsx" --include="*.ts" \
  | grep -v "src/constants/contact.ts" | grep -v "src/lib/whatsapp.ts"

grep -rn "#[0-9a-fA-F]\{6\}" app/ components/ --include="*.tsx" --include="*.ts"

npx tsx scripts/check-i18n.ts

npm run build
```

Exempt files for the raw-hex grep:
- `src/lib/design-tokens.ts` — global brand tokens
- `src/lib/delivery/tokens.ts` — delivery surface + Google Maps style tokens

---

## WHAT NOT TO DO

- Do **not** run `/start-session` as a slash command — Gemini Code Assist does not resolve it. Just produce the session-start report from this file directly.
- Do **not** load files under `.claude/worktrees/`. They are Claude Code sibling sessions, listed in `.geminiignore`. Each one is a near-full repo clone.
- Do **not** load `.agents/skills/*` unless the user explicitly names a skill — they are Antigravity-format markdown.
- Do **not** start Phase N+1 before Phase N is verified done in `phase-state.json`.
- Do **not** touch Phase 8 (AI) — locked, needs 6 months of production data.
- Do **not** scaffold customer login/signup — Phase 1 is Guest Only.

---

## LANGUAGE

Reply in English by default even when Ahmed writes in Arabic. Switch to Arabic only when he explicitly asks.
