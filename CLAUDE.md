# CLAUDE.md — Kahramana Baghdad
> Claude Code specific. Inherits from AGENTS.md. Read both files.
> Last updated: 2026-05-10 (session 86 — gate 7 exempt list now includes src/lib/delivery/tokens.ts)

---

## SETUP

This project uses a shared agent system. Read in this order:
1. `AGENTS.md` — shared rules (apply all of them)
2. `.agent/PLAN.md` — full execution plan
3. `.agent/phase-state.json` — current state
4. `.agent/RULES.md` — enforcement protocol

---

## SESSION START (Claude Code)

Every session starts with this exact output format:

```
Status: KAHRAMANA — SESSION START [date]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Current Phase: [N] — [name]
Status: [pending / in-progress / locked]
Prerequisite: [OK met / NO BLOCKED: reason]

OK Completed: [list or "none"]
Pending Pending:   [list]
Blockers: Blockers:  [list or "none"]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Next action: [specific deliverable]
```

Then wait for the human to confirm before writing any code.

---

## PHASE COMPLETION (Claude Code)

Before marking a phase done, run these terminal commands:

```bash
# 1. TypeScript
npx tsc --noEmit

# 2. RTL violation check (must return nothing)
grep -rn "\bpl-\|\bpr-\|\bml-\|\bmr-\|padding-left\|padding-right\|margin-left\|margin-right" \
  app/ components/ lib/ --include="*.tsx" --include="*.ts" --include="*.css"

# 3. Forbidden fonts (must return nothing)
grep -rn 'Inter\|Poppins\|Nunito\|Montserrat\|Raleway\|Roboto' \
  app/ components/ --include="*.tsx" --include="*.ts"

# 4. Forbidden colors (must return nothing)
grep -rn 'purple\|violet\|indigo\|yellow-[0-9]\|amber-[0-9]' \
  app/ components/ --include="*.tsx"

# 5. Currency violation (must return nothing)
grep -rn 'BHD' app/ components/ --include="*.tsx"

# 6. Hardcoded phone numbers / wa.me links (must return nothing)
# src/constants/contact.ts — restaurant numbers (source of truth)
# src/lib/whatsapp.ts — WhatsApp utilities (buildCustomerContactLink uses dynamic phone from order data)
grep -rn "97317\|wa\.me/" src/ app/ components/ --include="*.tsx" --include="*.ts" | grep -v "src/constants/contact.ts" | grep -v "src/lib/whatsapp.ts"

# 7. Raw hex colors in components (must return nothing)
# Exempt token files (raw hex allowed):
#   - src/lib/design-tokens.ts  — global brand tokens
#   - src/lib/delivery/tokens.ts — delivery surface + Google Maps style tokens
grep -rn "#[0-9a-fA-F]\{6\}" app/ components/ --include="*.tsx" --include="*.ts"

# 8. i18n completeness — parity check (ar.json ↔ en.json) + t() usage scan
#    (t.raw() allowed against intermediate nodes; t/.rich/.markup must hit leaves)
npx tsx scripts/check-i18n.ts

# 9. Build check
npm run build
```

Only after all 9 pass → update `.agent/phase-state.json`.

---

## CLAUDE-SPECIFIC NOTES

- Use `Read` tool to check `.agent/phase-state.json` at session start — never rely on memory
- Use `Bash` tool to run verification commands before closing a phase
- When creating Supabase migrations, always include `ENABLE ROW LEVEL SECURITY` in the same file as the table creation
- For long sessions, re-read `phase-state.json` every ~45 minutes to stay synchronized
- **Before ending any session**: update `.agent/LAST-SESSION.md` manually with what was done, what's next, and any decisions made — this is the bridge to Claude.ai

## SEO Skill
Available: .agent/skills/kahramana-seo/SKILL.md
Trigger: 'seo audit' or 'seo fix' or 'فحص seo'
