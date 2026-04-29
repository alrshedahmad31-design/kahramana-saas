# Workflow: /start-session
## Description
Run this at the start of EVERY work session on Kahramana. It loads context, reports current state, and prepares the agent for focused work.

## Steps

### Step 1 — Load context
Use the `kahramana-context` skill to load project design system, architecture decisions, and constraints.

### Step 2 — Load phase gate
Use the `phase-gate` skill to read `.agent/phase-state.json`.

### Step 3 — Report status
Present the full session start report:
```
Status: KAHRAMANA STATUS — [today's date]
Current Phase: [N] — [phase name]
Phase Status: [status]
Prerequisite: OK met / NO BLOCKED

OK Completed deliverables: [list or "none yet"]
⏳ Pending deliverables: [list]
Blockers: External blockers: [list or "none"]

Target: Ready to work on: [specific next task based on pending deliverables]
```

### Step 4 — Ask for confirmation
Ask: "هل تريد المتابعة من حيث توقفنا؟ أم لديك أولوية مختلفة لهذه الجلسة؟"

### Step 5 — Begin work
Only after human confirmation, begin the task. Start with the first incomplete deliverable unless the human specifies otherwise.
