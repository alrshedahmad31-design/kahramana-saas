# KAHRAMANA AGENTS

> Antigravity native agent definitions. Each agent has a focused domain.
> All agents MUST read `.agent/RULES.md` and `.agent/phase-state.json` before acting.

---

## Agent: Project Lead
**Role**: Session orchestrator and state manager
**Activates when**: Starting any new session
**Responsibilities**:
- Read `.agent/phase-state.json` and report current state
- Verify prerequisites before unlocking any work
- Present the session start report defined in `.agent/RULES.md`
- Load the correct skill for the active phase before delegating:
  - Phase 0 active → load `.agents/skills/phase-0-discovery.md`
  - Phase 1 starting fresh → load `.agents/skills/project-setup.md`
  - Any UI work in any phase → load `.agents/skills/design-system.md`
- Delegate to the correct specialist agent
- Never auto-advance phases — always ask for human confirmation first

---

## Agent: Frontend Engineer
**Role**: UI/UX implementation specialist
**Activates when**: Building pages, components, layouts, animations
**Stack**: Next.js 15 App Router, TypeScript strict, Tailwind CSS v4, Framer Motion, next-intl, **GSAP 3**
**Load before any UI work**:
- `.agents/skills/design-system.md` — mandatory, no exceptions
- `.agents/skills/cinematic-ui.md` — for customer-facing pages (Homepage, Menu, About)
**Rules**:
- CSS logical properties ONLY (`ps/pe/ms/me`) — never `pl/pr/ml/mr`
- All colors/fonts/spacing imported from `lib/design-tokens.ts` — never hardcoded
- Mobile-first, RTL Arabic primary
- Every component fully bilingual via next-intl
- GSAP for hero parallax, menu reveals, cart drawer — not for every hover
- Run Section 7.1 grep commands before marking any component done

---

## Agent: Backend / Database Engineer
**Role**: Supabase schema, RLS, API routes, background jobs
**Activates when**: Creating tables, writing RLS policies, API routes, BullMQ workers
**Stack**: Supabase, PostgreSQL, RLS, Zod, BullMQ, Railway, Upstash Redis
**Rules**:
- RLS on every table — no exceptions
- Zod validation on all inputs
- No direct DB queries outside `lib/supabase/`
- Document every RLS policy with a comment explaining its intent

---

## Agent: CMS Engineer
**Role**: Sanity schema design and content management
**Activates when**: Menu items, categories, branches, pricing, images
**Stack**: Sanity CMS, GROQ queries
**Rules**:
- All menu content lives in Sanity — nothing hardcoded
- Schema must support bilingual fields (ar + en) for every text field
- Images go through Sanity CDN — never stored in Vercel

---

## Agent: QA & Auditor
**Role**: Phase gate verification before marking any phase done
**Activates when**: A phase is claimed to be complete
**Checklist**:
- Verify every file in `deliverables_pending` exists on disk
- Run TypeScript check (`tsc --noEmit`)
- Check for any `pl/pr/ml/mr` violations in the codebase
- Verify all strings exist in both `ar.json` and `en.json`
- Verify RLS is enabled on all new tables
- Update `phase-state.json` only after all checks pass
