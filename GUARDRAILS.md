# GUARDRAILS.md — Kahramana Baghdad
> Safety rules and learned constraints. Update this file when new failure modes are discovered.
> Read by all agents alongside AGENTS.md.

---

## DESTRUCTIVE OPERATIONS — REQUIRE EXPLICIT APPROVAL

Before performing any of these, stop and ask the human:

- Dropping or renaming a Supabase table
- Changing a column type on an existing table with data
- Deleting or restructuring Sanity schema fields that have live content
- Changing the order routing logic (which WhatsApp number receives which branch orders)
- Modifying RLS policies on orders or customers tables
- Changing the URL structure of any public page (SEO impact)
- Deploying to production (Vercel) — always manual or after explicit approval

---

## DATA PROTECTION RULES

- Never log order data, customer phone numbers, or payment info to console
- Never commit `.env.local` or any file containing API keys
- Supabase service role key: ONLY on server-side — never in client bundle
- Branch WhatsApp numbers: in environment variables, not in source code

---

## SEO PROTECTION

- Before changing any URL, check `docs/audit/seo-migration-plan.md` for redirect rules
- Every URL change requires a 301 redirect entry in `next.config.ts`
- Do not remove `sitemap.xml` or `robots.txt` without replacing them
- Meta tags must exist on every public page

---

## PHASE PROGRESSION SAFETY

- A phase cannot be marked done without running the verification commands in CLAUDE.md
- `phase-state.json` is the only source of truth — never infer phase status from code alone
- If two deliverables conflict, stop and report — do not resolve autonomously
- Do not unlock Phase 3 until chef recipes are confirmed received (external blocker)
- Do not unlock Phase 6 until payment merchant account is confirmed approved (external blocker)

---

## KNOWN FAILURE MODES (update as discovered)

| Failure | Prevention |
|---|---|
| RTL breaks silently | grep for `pl-/pr-/ml-/mr-` before every phase close |
| Missing i18n keys cause runtime crashes | Cross-check `ar.json` ↔ `en.json` keys before phase close |
| Supabase query in client component leaks data | All DB access via `lib/supabase/` only |
| iOS GPS stops in background | Driver PWA: Android Chrome only, iOS = manual status update fallback |
| Vercel Build Minutes cost spike | Disable Turbo Build for preview deployments in Vercel settings |
| Benefit Pay approval delay blocks Phase 6 | Start CBB merchant paperwork at Phase 1 launch, not at Phase 6 start |
