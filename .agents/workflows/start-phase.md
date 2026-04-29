# Workflow: /start-phase [N]
## Description
Formally begin a new phase. Verifies prerequisites, scaffolds the initial structure, and locks in the work plan.

## Steps

### Step 1 — Prerequisite gate
Read `phase-state.json`. Confirm:
- The requested phase status is `pending` (not `locked` or `done`)
- All prerequisite phases are `done`

If prerequisite is NOT done → STOP. Report what is blocking and exit.

### Step 2 — Load phase plan
Read `.agent/PLAN.md`. Extract for the requested phase:
- Full deliverables list
- Acceptance criteria
- Any conditional blockers (external data needed)

### Step 3 — Check external blockers
If the phase has external dependencies (chef recipes, payment approval, etc.) that are still `pending` in `phase-state.json`:
- Report them clearly
- Ask human: "هل تريد المتابعة رغم النواقص الخارجية، أم ننتظر؟"
- Wait for explicit confirmation before proceeding

### Step 4 — Update phase status
Set phase status to `in-progress` in `phase-state.json`. Set `started_at` to today.

### Step 5 — Scaffold phase structure
Create the folder structure for this phase's deliverables:
- Create all directories listed in the deliverables
- Create placeholder `README.md` files in each module folder
- Do NOT write actual implementation code yet

### Step 6 — Present work plan
Show the human:
```
Launch: Phase [N] — [Name] is now ACTIVE

Planned deliverables:
[numbered list from PLAN.md]

Suggested build order:
1. [Most foundational deliverable first]
2. [Then...]
...

Estimated effort: [from PLAN.md duration]

Shall I begin with [first deliverable]?
```

### Step 7 — Begin first deliverable
Only after human confirmation, start building the first deliverable.
