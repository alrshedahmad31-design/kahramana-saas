# GEMINI.md — Kahramana Baghdad
> Antigravity-specific rules. These override AGENTS.md for Antigravity sessions only.
> Last updated: 2026-04-27

---

## MANDATORY SESSION START

Every session MUST begin by running the `/start-session` workflow.
Do not skip this. Do not assume state from memory.

Available workflows:
- `/start-session` — Load context and report current state
- `/start-phase [N]` — Formally begin a new phase
- `/complete-phase` — Run phase gate before closing a phase
- `/end-session` — **أجرِه قبل إغلاق Antigravity** — يحدّث phase-state.json + LAST-SESSION.md

---

## PROJECT CONTEXT FILES

Before any work, load these skills based on context:

**Every session (mandatory):**
1. `.agents/skills/kahramana-context.md` — architecture + business rules
2. `.agents/skills/phase-gate.md` — gate enforcement protocol
3. `.agent/PLAN.md` — full 9-phase plan
4. `.agent/RULES.md` — shared rules
5. `.agent/phase-state.json` — live state

**Phase-specific (load when relevant):**
- Phase 0 active → `.agents/skills/phase-0-discovery.md`
- Phase 1 init → `.agents/skills/project-setup.md`
- Any UI work → `.agents/skills/design-system.md` ← mandatory before any component

---

## ANTIGRAVITY-SPECIFIC BEHAVIOR

### Agent Manager
- Use the Project Lead agent to orchestrate sessions
- Delegate UI work to Frontend Engineer agent
- Delegate DB/API work to Backend Engineer agent
- QA Auditor agent runs `/complete-phase` workflow

### Browser Verification
When a phase produces visible UI, use Antigravity's browser to:
1. Load the local dev server
2. Take a screenshot
3. Verify RTL layout renders correctly (Arabic text right-aligned, nav flows right)
4. Verify no visual regression from previous phase

### Artifact Output
After completing a significant feature, produce an Artifact (screenshot + summary) so the human can review without diving into code.

---

## CRITICAL RULES (Antigravity enforcement)

```
NEVER:
- Start work without reading phase-state.json
- Mark phase done without running /complete-phase workflow
- Use pl-* pr-* ml-* mr-* in any className
- Hardcode Arabic or English strings in components
- Create a table without RLS

ALWAYS:
- Report current phase status at session start
- Update phase-state.json after completing deliverables
- Ask before adding any library not in the tech stack
- Route orders to branch-specific WhatsApp numbers
- Use next-intl for ALL user-facing text
```
