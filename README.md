# كهرمانة بغداد — Kahramana Baghdad
**Full platform rebuild** | Agency: Wujood Digital | Live: kahramanat.com

---

## Agent Onboarding (READ FIRST)

This project uses a structured execution system that works across all AI coding tools.

### File Hierarchy — Agent System

```
kahramana-web/               ← project root (open this in Antigravity)
│
├── .agents/                 ← Antigravity native directory
│   ├── agents.md            ← 5 agent personas and roles
│   ├── skills/
│   │   ├── kahramana-context.md    ← architecture + business rules
│   │   ├── design-system.md        ← colors, fonts, RTL, components ← load before ANY UI
│   │   ├── phase-0-discovery.md    ← Phase 0 audit guide
│   │   ├── project-setup.md        ← Phase 1 initialization steps
│   │   └── phase-gate.md           ← phase verification protocol
│   └── workflows/
│       ├── start-session.md        ← /start-session
│       ├── start-phase.md          ← /start-phase [N]
│       ├── complete-phase.md        ← /complete-phase
│       └── end-session.md          ← /end-session ← run before closing
│
├── .agent/                  ← tool-agnostic shared state
│   ├── PLAN.md              ← 9-phase execution plan (source of truth)
│   ├── phase-state.json     ← live state (update after every phase)
│   ├── LAST-SESSION.md      ← session summary (paste into Claude.ai)
│   └── RULES.md             ← shared enforcement rules
│
├── GEMINI.md                ← Antigravity-specific (highest priority)
├── AGENTS.md                ← cross-tool shared rules
├── CLAUDE.md                ← Claude Code wrapper
├── GUARDRAILS.md            ← safety constraints
├── .env.example             ← all required env vars
├── .env.local               ← create from .env.example (never commit)
│
├── docs/
│   ├── audit/               ← Phase 0 deliverables (5 files)
│   └── KAHRAMANA-DESIGN-SYSTEM.docx  ← original design system (human reference)
│
│ ── BELOW: Next.js project (created at Phase 1 start) ──
│
├── src/
│   ├── app/
│   │   ├── (marketing)/     ← Homepage, Menu, About, Contact
│   │   ├── (ordering)/      ← Cart, Checkout, Confirmation
│   │   └── (dashboard)/     ← Admin panel
│   ├── components/
│   │   ├── menu/
│   │   ├── cart/
│   │   ├── checkout/
│   │   ├── layout/
│   │   └── ui/
│   ├── lib/
│   │   ├── design-tokens.ts ← SINGLE SOURCE — import all values from here
│   │   ├── supabase/
│   │   └── sanity/
│   ├── i18n/
│   └── messages/
│       ├── ar.json          ← Arabic (primary)
│       └── en.json          ← English (secondary)
│
├── public/
│   ├── fonts/               ← Editorial New + Satoshi woff2 files
│   └── images/
│
├── sanity/                  ← Sanity CMS schemas
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

### How to Start a Session

**في Antigravity**: اكتب `/start-session`
**في Claude Code**: الـ agent يقرأ `CLAUDE.md` ويعرض الحالة تلقائياً
**في Claude.ai (هنا)**: انسخ محتوى `.agent/LAST-SESSION.md` في بداية المحادثة

### How to End a Session

**في Antigravity**: اكتب `/end-session` — يحدّث `phase-state.json` و`LAST-SESSION.md` معاً
**في Claude Code**: حدّث `.agent/LAST-SESSION.md` يدوياً قبل الإغلاق

### How to Progress a Phase

1. Complete all deliverables listed in `.agent/PLAN.md` for the current phase
2. Run `/complete-phase` (Antigravity) or the verification commands in `CLAUDE.md`
3. All checks must pass — phase-state.json is updated only after verification
4. Next phase unlocks automatically

---

## Current Status

See `.agent/phase-state.json` for live state.

**Phase 0** (Discovery & Audit) → **Status: pending**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 App Router |
| Language | TypeScript strict |
| Styling | Tailwind CSS v4 (logical properties only) |
| Database | Supabase |
| CMS | Sanity |
| i18n | next-intl (AR primary) |
| Animations | Framer Motion |
| Hosting | Vercel Pro |

---

## Critical Rules Summary

```
OK ps-4 pe-4 ms-auto me-4     (CSS logical properties — RTL safe)
NO pl-4 pr-4 ml-auto mr-4     (FORBIDDEN — breaks RTL)

OK useTranslations('key')      (all text via next-intl)
NO <h1>Arabic text here</h1>   (FORBIDDEN — hardcoded strings)

OK RLS on every Supabase table
NO Table without RLS policy
```
