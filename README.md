# Kahramana Baghdad — كهرمانة بغداد

Production SaaS platform for a multi-branch restaurant operation in Baghdad. Live at **kahramanat.com**.

Private repository. Not open source.

---

## Overview

Kahramana is a full-stack restaurant operations platform covering the customer-facing storefront and the back-of-house management surface for every branch. The system runs the menu, ordering, payments, loyalty, reservations, delivery dispatch, point-of-sale, inventory, and staff workflows from a single codebase.

The interface is bilingual (Arabic primary, English secondary) with full RTL support, and the platform is designed for the Iraqi market — IQD currency, local payment rails, and WhatsApp-driven customer comms.

---

## Feature Surface

### Customer
- Bilingual marketing site, menu, and branch pages
- Cart, checkout, and order confirmation with Tap Payments + cash-on-delivery
- Loyalty program with tiers, points accrual, and reward redemption
- Reservations with branch-level availability
- Order tracking and WhatsApp notifications
- Delivery flow with live driver status

### Operations (Admin Dashboard)
- Multi-branch management with per-branch menus, hours, and staff
- Real-time order queue, kitchen display, and status transitions
- Point-of-sale (POS) for in-store and takeaway orders
- Inventory tracking with stock movements and low-stock alerts
- Delivery dispatch, driver assignment, and earnings ledger
- Reservations calendar and capacity management
- Staff management — roles, schedules, PINs, shifts
- Loyalty program controls and customer CRM
- Reporting on sales, payments, refunds, and operational KPIs

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, React 19) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 — CSS logical properties only (RTL-safe) |
| Database | Supabase (Postgres + Row Level Security) |
| Auth | Supabase Auth (`@supabase/ssr`) |
| Realtime | Supabase Realtime channels |
| CMS | Sanity (marketing content) |
| i18n | next-intl — Arabic primary, English secondary |
| Payments | Tap Payments (cards) + COD |
| Messaging | WhatsApp Business API |
| Monitoring | Sentry |
| Rate limiting | Upstash Redis |
| Hosting | Vercel (Pro) |

---

## Architecture Notes

- All data access goes through Supabase with RLS enforced on every table
- Sensitive write paths use RPCs (`rpc_create_order`, etc.) with server-side validation
- Bilingual content is split between next-intl message catalogues (`ar.json` / `en.json`) for UI and Sanity for marketing copy
- A single design-token source (`src/lib/design-tokens.ts`) governs colors, typography, and spacing — no raw hex values in components
- Background jobs and webhooks (Tap, WhatsApp) run as Next.js route handlers on Vercel Functions

---

## Deployment

- **Platform**: Vercel Pro
- **Primary domain**: kahramanat.com
- **Branching**: `master` → production; preview deployments per PR
- **Environment**: secrets managed via Vercel project env (mirrored locally in `.env.local`, never committed)
- **Observability**: Sentry for errors + Vercel Analytics for performance

---

## Repository Conventions

This codebase is governed by a structured agent workflow. See `AGENTS.md` (shared rules), `CLAUDE.md` (Claude Code wrapper), and `.agent/PLAN.md` (execution plan) for the working contract. Phase gates and verification commands are enforced before any phase is marked complete.

---

© Kahramana Baghdad. All rights reserved.
