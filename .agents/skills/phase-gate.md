# SKILL: Phase Gate Enforcement

## When to use this skill
Use this skill before starting any work, before claiming any phase is done, and before moving to the next phase.

## Step 1 — Read current state
```
Read: .agent/phase-state.json
Find: First phase where status is "in-progress" or first "pending" phase that is not "locked"
```

## Step 2 — Verify prerequisites
For the target phase, check `prerequisite` field.
If prerequisite phase status is NOT `done` → STOP. Report the blocker. Do not proceed.

## Step 3 — Present status report
Format:
```
Status: KAHRAMANA STATUS — [date]
Current Phase: [N] — [name]
Status: [pending/in-progress]
Prerequisite: OK met / NO BLOCKED — [reason]

OK Done: [files]
⏳ Pending: [files]
Blockers: Blockers: [list or "none"]
```

## Step 4 — After completing work (phase done check)
Before marking a phase done:
1. Verify every file in `deliverables_pending` physically exists using file system tools
2. Run: check for `pl|pr|ml|mr` in className strings — must be zero violations
3. Run: `tsc --noEmit` — must pass
4. Check: all user-facing strings exist in both `messages/ar.json` and `messages/en.json`
5. Check: all new Supabase tables have RLS enabled

If all pass:
- Move deliverables from `pending` to `completed` in `phase-state.json`
- Set `status: "done"`, set `completed_at` to today's date
- Set next phase `status: "pending"` (unlock it)
- Report: "Phase [N] complete. Phase [N+1] is now unlocked."

If any fail:
- List exactly what failed
- Do NOT update phase status
- Do NOT move to next phase
