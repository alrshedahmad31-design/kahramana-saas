# Product

## Register

brand

## Users

Two audiences with very different jobs.

**Diners (primary, brand surface).** Bahrain residents and visitors choosing where to eat or order from. Often deciding fast on a phone, often bilingual (Arabic at home, English at work), often choosing on emotional grounds before they read a single menu item. They land on the homepage, /menu, /branches, or a delivery surface. Their job: decide that *this place is the real thing* and either book, order, or visit.

**Operators (secondary, product surface).** Staff inside the restaurants: KDS at the line, waiters on the floor, drivers on the road, managers in the back office. Their job: get an order from in to out without dropping anything. They use the same product, but the design contract flips — quiet, dense, glanceable, never decorative.

The strategic surface is the brand side. Operations should function; the diner-facing pages should *convince*.

## Product Purpose

Kahramana Baghdad is a real Iraqi restaurant in Bahrain, operating since 2018, with branches in Riffa and Qallali, 1,685+ Google reviews at 4.6, and a kitchen built around charcoal masgouf, quzi, Baghdadi grills, and traditional Iraqi breakfast. The platform is the whole online presence: marketing site, menu, ordering, loyalty, delivery, and the operations stack (KDS, waiter, driver, inventory) that makes it run.

Success is not "more sign-ups." Success is that a stranger who never heard of the restaurant lands on the homepage, feels that it's a serious heritage kitchen with seven years of standing behind it, and either orders, drives there, or saves it for later, without ever doubting whether it's the real thing.

## Brand Personality

**Heritage. Earned. Generous.**

- **Heritage** — Iraqi food culture is older than the country. The brand carries that weight without explaining it. No marketing voice telling you it's authentic; the typography, the masgouf imagery, the bilingual fluency carry it.
- **Earned** — seven years in market, 1,685+ reviews, two branches. The design borrows from that confidence. It doesn't perform newness or chase trends. It looks like a place that has been here, and will be here.
- **Generous** — Iraqi table hospitality. Large portions, the third tea, the extra dish you didn't order. Translated into the interface: comfortable spacing, food at full bleed, copy that addresses the diner like a guest, never a conversion funnel.

The voice in copy is warm, specific, and unhurried. Arabic is primary; English is secondary and never the source language. Both registers are formal-but-personal: closer to a respected family restaurant than a hospitality startup.

## Anti-references

This brand must not look like any of the following. Each is a specific failure mode, not a generic dislike.

1. **Generic SaaS / startup landing.** Purple or violet gradients, hero-metric templates ("Trusted by 5,000+ restaurants"), identical card grids of features, glassmorphism, "Get started free" CTAs over a blurry product screenshot. If a variant could plausibly belong to a B2B AI tool, it has failed.

2. **Western fast-casual chain (Chipotle / Shake Shack / Sweetgreen).** Red-and-cream palette, oversized circular logo lockups, friendly-rounded sans-serifs, smiling-staff photography, "Build your own bowl" interaction patterns. The food is Iraqi; the visual rhetoric is not.

3. **Tourist Middle-Eastern cliché.** Arabesque ornamental borders, faux-papyrus textures, camel-lamp-genie iconography, calligraphy used as decoration rather than language. Treats the culture as a costume. The brand is from inside the culture, not curating it for outsiders.

4. **Generic delivery app.** Bright orange/red, scooter/motorbike icons, urgency timers ("Order in 28:43"), gamified loyalty noise (confetti, level-up badges, streak counters), "spin the wheel" promotions. The delivery surfaces must read as the same restaurant, not as a UberEats clone.

When designing variants, the squint test is: could someone glance at this and place which of the above four it is? If yes, rework.

## Design Principles

1. **Bilingual at origin, not translated.** Arabic is primary; the RTL layout, the Arabic typography (Cairo / Almarai), and the right-to-left reading order are first-class. English is the secondary cut, with its own type pairing (Editorial New / Satoshi). Both are equally finished. Never an Arabic afterthought on an English-first design.

2. **Show the food, not the chrome.** The product is masgouf, quzi, Baghdadi breakfast. Photography and the menu carry the brand. UI scaffolding (nav, headers, buttons) recedes; the food gets the bleed, the scale, the silence around it. If the chrome competes with the food, the chrome loses.

3. **Heritage is restrained.** Gold is used like jewelry: small, deliberate, on a black ground. Not as a wash, not as a gradient, not as page decoration. Ornament is earned by meaning (a divider that marks a section break, a star that marks a count) and refused everywhere else.

4. **Operations are quiet; marketing breathes.** Two contracts in one project. Marketing pages get generous space, slow motion, full-bleed imagery, editorial type. Operations screens (KDS, driver, waiter, dashboard) get density, glanceability, no decorative motion, and copy that names the action in one word. Same brand, two volumes.

5. **Earned, not performed.** Seven years in market means the design can be confident without proving it. No "trusted by X," no review counts pasted across the page (the one on the hero is a deliberate exception, placed once, small). No "since 2018" badges layered on every section. The confidence is in the typography and the silence, not in the claims.

## Accessibility & Inclusion

- **Target:** WCAG AA on all customer-facing surfaces (homepage, menu, branches, catering, story, contact, delivery, ordering). WCAG AA on operations surfaces where staff readability is operationally critical (KDS, driver, waiter).
- **Bilingual & RTL.** Arabic-primary RTL must be correct everywhere: logical properties only (`ps`/`pe`/`ms`/`me`, `border-s`/`border-e`, `rounded-s`/`rounded-e`); no `pl/pr/ml/mr`. Arabic text uses Cairo (headings) / Almarai (body); English uses Editorial New (headings) / Satoshi (body). Numerals are tabular (`Satoshi`) in both locales for consistent alignment.
- **Color contrast.** All text on the brand-black surface (`#0A0A0A`) and brand-surface (`#141210`) must meet WCAG AA against `text` (`#F5F5F5`) for body and headings. Gold (`#C8922A`) is a display accent, not a body-text color on dark; if used on text, must be tested for contrast at the size it appears.
- **Motion.** Honor `prefers-reduced-motion` on every page with animation (hero parallax, philosophy manifesto, scroll-driven sections). Reduce to static reveals; never disable a critical state change (toast, dialog, error).
- **Touch targets.** ≥44×44 CSS px for any interactive control on customer surfaces. Operations surfaces (KDS bump buttons, driver actions) target ≥56×56 because the user is standing, in motion, or in low light.
- **Forms & errors.** Form inputs and error messages remain in the active locale; error copy is human, names the field, and offers the next step (not just "invalid"). Phone, address, and CR-number fields validate against Bahrain formats and surface their format in the placeholder.
- **Keyboard.** All interactive paths reachable by keyboard; visible focus rings (not just `outline: none`). The operations screens add explicit keyboard shortcuts (Esc, R, M on KDS; same pattern elsewhere) and document them in-screen.
