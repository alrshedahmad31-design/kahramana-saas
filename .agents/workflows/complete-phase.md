# Workflow: /complete-phase
## Description
Run this when claiming a phase is done. Enforces the phase gate before unlocking the next phase.

## Steps

### Step 1 — Identify phase under review
Ask: "أي مرحلة تريد إغلاقها؟" or infer from `phase-state.json` if obvious.

### Step 2 — Verify deliverables on disk
For every file listed in `deliverables_pending` for this phase:
- Use file system tools to confirm the file exists
- Check it is not empty (> 0 bytes)
- Log: OK exists | NO MISSING for each

### Step 3 — Run quality checks
Execute the following in the terminal:

```bash
# TypeScript check
npx tsc --noEmit

# RTL logical property violation check (must return 0 results)
grep -r "\bpl-\|\bpr-\|\bml-\|\bmr-\|padding-left\|padding-right\|margin-left\|margin-right" \
  --include="*.tsx" --include="*.ts" --include="*.css" \
  app/ components/ lib/

# Check all ar.json keys exist in en.json
node -e "
  const ar = Object.keys(require('./messages/ar.json'));
  const en = Object.keys(require('./messages/en.json'));
  const missing = ar.filter(k => !en.includes(k));
  if (missing.length) { console.log('MISSING in en.json:', missing); process.exit(1); }
  else console.log('OK All translation keys present');
"
```

### Step 4 — Check Supabase RLS
Review any new tables created in this phase.
Confirm each has `ALTER TABLE [table] ENABLE ROW LEVEL SECURITY;` in its migration.

### Step 5 — Decision
**If ALL checks pass:**
- Update `phase-state.json`: move deliverables to `completed`, set `status: "done"`, set `completed_at`
- Unlock next phase: set its `status` from `"locked"` to `"pending"`
- Report: "OK Phase [N] officially closed. Phase [N+1] is now active."

**If ANY check fails:**
- List every failure with the exact file or issue
- Do NOT update phase status
- Report: "NO Phase [N] cannot be closed. [N] issues must be resolved first."

### Step 6 — Update external blockers
After phase completion, check if any external blockers (payment approval, etc.) should now be initiated. Remind the human if so.
