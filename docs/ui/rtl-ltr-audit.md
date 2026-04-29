# RTL/LTR Layout Audit

Date: 2026-04-28

## Scope

Audited the Next.js app source under `src`, including locale layout, marketing pages, menu, checkout, contact, order confirmation, dashboard, staff management, KDS, cart drawer, shared layout, and story/home components.

## Direction Enforcement

- Global direction is enforced in `src/app/[locale]/layout.tsx` with `<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>`.
- Dashboard content now explicitly inherits the locale direction at the dashboard shell level.
- Branch cards and staff modal dialogs now set local direction where they are rendered as isolated client components.
- Phone number fields and phone displays remain `dir="ltr"` so Bahrain numbers render correctly inside Arabic pages.

## Issues Found and Fixed

| Area | Issue | Fix |
| --- | --- | --- |
| Dashboard shell | Dashboard wrapper relied only on root direction. | Added `dir` to dashboard layout wrapper. |
| Mobile dashboard sidebar | Sidebar used physical `left-0` / `right-0`. | Replaced with logical `start-0`; off-canvas transform remains locale-aware. |
| Header mobile menu | Overlay used physical `left-0 right-0`. | Replaced with `inset-x-0`. |
| Home hero | Hero used `text-left` / `text-right`. | Replaced with `text-start`; alignment now follows inherited direction. |
| Feature telemetry | Live badge used `right-4`; feed animation always entered from left. | Replaced with `end-4`; animation direction now follows locale. |
| Story sections | Decorative and timeline elements used physical `left/right` classes. | Replaced with logical `start/end` or `inset-x`; milestone alternating layout now mirrors by locale. |
| Branch cards | Contact rows manually reversed with `flex-row-reverse`. | Added component `dir`; rows now rely on natural flex direction. |
| Branch FAQ | Arabic FAQ summary forced `flex-row-reverse`. | Removed manual reversal; summary follows `dir`. |
| Dashboard links | Arrows were hardcoded for English flow. | Back/forward arrows now change by locale. |
| Breadcrumbs | Breadcrumb separator always pointed in the English direction. | Separator now mirrors for Arabic. |
| Dashboard tables | Some headers and branch names remained English in Arabic. | Added translated `status` and `phone`; branch names now use Arabic names in Arabic locale. |
| Staff modal | Modal had no local direction and hardcoded close/cancel text. | Added `dir`; close/cancel now use `common` translations. |
| Order confirmation | Several rows used manual `flex-row-reverse`. | Rows now rely on inherited direction and `text-start`. |
| Checkout summary | Order item row used manual `flex-row-reverse`. | Replaced with natural direction-aware flex layout. |

## Validation

- `npm run type-check`: pass.
- `npm run build`: pass, 391 static/generated pages.
- Source physical direction scan: pass.
- The scan checks for `pl-`, `pr-`, `ml-`, `mr-`, `left-*`, `right-*`, `text-left`, `text-right`, `border-left/right`, `padding-left/right`, and `margin-left/right` under `src`.
- Browser automation was not run because `agent-browser` is not installed in this environment.

## Remaining Recommendations

- Add Playwright or `agent-browser` visual regression checks for `/ar` and `/en` at mobile and desktop widths once browser tooling is available.
- Prefer component-level `dir` only for isolated widgets, modals, and drawers. Normal page content should inherit from `<html dir>`.
- Keep numeric identifiers, phone numbers, UUIDs, and currency values `dir="ltr"` or `tabular-nums` inside Arabic layouts.
- Continue using `text-start/end`, `start/end`, `border-s/e`, `ps/pe`, and `ms/me` for all future UI.
