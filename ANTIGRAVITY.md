# ANTIGRAVITY.md — Kahramana Baghdad
> Antigravity-specific rules. Read only inside Antigravity sessions.
> Read AGENTS.md first for shared cross-tool rules.
> Last updated: 2026-05-16 (slimmed mandatory-read list so the workspace doesn't stall Antigravity on cold start)

---

## MANDATORY SESSION START (Antigravity)

Every session MUST begin by running the `/start-session` workflow.
Do not skip this. Do not assume state from memory.

Available workflows (under `.agents/workflows/`):
- `/start-session` — Load context and report current state
- `/start-phase [N]` — Formally begin a new phase
- `/complete-phase` — Run phase gate before closing a phase
- `/end-session` — أجرِه قبل إغلاق Antigravity — يحدّث phase-state.json + LAST-SESSION.md

---

## PROJECT CONTEXT FILES (Antigravity skill loader)

**Every session — MINIMAL set only:**
1. `AGENTS.md` — shared cross-tool rules (~150 lines, kept lean)
2. `.agent/phase-state.json` — current phase + deliverables + blockers
3. `.agent/CURRENT-SESSION.md` — bridge context: what just happened, what's next

That's it for session start. Total ~900 lines / ~75 KB — small enough to load instantly.

**Load on demand (NOT at session start) — only when actually relevant:**
- `.agent/PLAN.md` — full 9-phase plan (1000+ lines, mostly historical). Read only when starting a phase or auditing scope.
- `.agent/RULES.md` — shared rules. Read only when a rule is being authored or contested.
- `.agents/skills/kahramana-context.md` — architecture deep-dive. Read when architecture is the actual topic.
- `.agents/skills/phase-gate.md` — gate enforcement protocol. Read inside `/complete-phase` only.
- `.agents/skills/design-system.md` — design tokens deep-dive. Read before UI work, not before every session.
- `.agents/skills/phase-0-discovery.md` / `project-setup.md` — phase-specific scaffolds.

**Never auto-load:**
- `.agents/skills/impeccable/**` — frontend design reference subtree, loaded only when the impeccable skill is explicitly invoked.
- `messages/*.json`, `src/data/menu.json` — translation + menu data; grep on demand.
- `supabase/migrations/` — 153 historical SQL files; grep on demand.

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
