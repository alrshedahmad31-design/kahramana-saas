---
name: Kahramana Baghdad
description: Visual system for an Iraqi heritage restaurant SaaS, bilingual AR/EN, dark-first.
colors:
  brand-black: "#0A0A0A"
  brand-surface: "#141210"
  brand-surface-2: "#1C1A16"
  brand-border: "#2A2A2A"
  brand-text: "#F5F5F5"
  brand-muted: "#6B6560"
  brand-gold: "#C8922A"
  brand-gold-light: "#E8B86D"
  brand-gold-dark: "#A67C00"
  brand-error: "#C0392B"
  brand-success: "#27AE60"
  delivery-bg: "#0E0700"
  delivery-surface: "#1C0F03"
  delivery-amber: "#C4933A"
typography:
  display-ar:
    fontFamily: "Cairo, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 7vw, 4rem)"
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: "normal"
  display-en:
    fontFamily: "Editorial New, Georgia, serif"
    fontSize: "clamp(2.25rem, 7vw, 4rem)"
    fontWeight: 400
    lineHeight: 0.9
    letterSpacing: "normal"
  headline:
    fontFamily: "Cairo, Editorial New, serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.15
  title:
    fontFamily: "Cairo, Editorial New, serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
  body-ar:
    fontFamily: "Almarai, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  body-en:
    fontFamily: "Satoshi, Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Satoshi, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.3em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "9999px"
  premium: "2.5rem"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  xl2: "64px"
  section: "10rem"
components:
  button-primary:
    backgroundColor: "{colors.brand-gold}"
    textColor: "{colors.brand-black}"
    rounded: "{rounded.pill}"
    padding: "16px 32px"
  button-primary-hover:
    backgroundColor: "{colors.brand-gold-light}"
    textColor: "{colors.brand-black}"
    rounded: "{rounded.pill}"
    padding: "16px 32px"
  button-secondary:
    backgroundColor: "{colors.brand-surface}"
    textColor: "{colors.brand-text}"
    rounded: "{rounded.pill}"
    padding: "16px 32px"
  button-secondary-hover:
    backgroundColor: "{colors.brand-surface-2}"
    textColor: "{colors.brand-gold}"
    rounded: "{rounded.pill}"
    padding: "16px 32px"
  card-surface:
    backgroundColor: "{colors.brand-surface}"
    textColor: "{colors.brand-text}"
    rounded: "{rounded.xl}"
    padding: "24px"
  card-surface-elevated:
    backgroundColor: "{colors.brand-surface-2}"
    textColor: "{colors.brand-text}"
    rounded: "{rounded.xl}"
    padding: "24px"
  input-field:
    backgroundColor: "{colors.brand-surface}"
    textColor: "{colors.brand-text}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  input-field-focus:
    backgroundColor: "{colors.brand-surface}"
    textColor: "{colors.brand-text}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  chip-gold:
    backgroundColor: "{colors.brand-gold}"
    textColor: "{colors.brand-black}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  dialog-surface:
    backgroundColor: "{colors.brand-surface}"
    textColor: "{colors.brand-text}"
    rounded: "{rounded.xl}"
    padding: "32px"
---

# Design System: Kahramana Baghdad

## 1. Overview

**Creative North Star: "The Bronze Kitchen at Night"**

The platform is the visual scene of an Iraqi grill house at dusk, photographed and translated into screens. Charcoal black is the room, bronze gold is the lamp over the table and the colour of food coming off the fire, and the white text on dark surfaces is the linen napkin underneath. The system commits to dark by default because the food deserves it: masgouf, quzi, kabab, and tepsi all photograph as bronze and copper, and they only carry that weight against a near-black background.

The personality the system supports is *Heritage. Earned. Generous.* Generosity shows up as comfortable spacing and food at full bleed; earned-ness shows up as restraint with ornament and a refusal to perform newness; heritage shows up in the typography and the bilingual fluency rather than in decorative motifs. The system explicitly rejects the four anti-references named in PRODUCT.md: SaaS startup gradients, Western fast-casual cream-and-red palettes, tourist Middle-Eastern arabesques, and the bright-orange generic delivery app.

**Key Characteristics:**
- Dark-first surface (`#0A0A0A`), warm-tinted, with a fixed SVG fractal-noise grain over the page that gives every screen a faint film texture.
- Bronze gold (`#C8922A`) used like jewelry; small surface area, never as a gradient or full bleed.
- Bilingual at origin: Arabic-primary RTL is first-class, English is the secondary cut with its own type pairing.
- Flat by default; depth is tonal layering of three near-black surfaces, not drop shadows.
- Generous-and-tactile components: comfortable padding, pill or large-radius corners on customer surfaces, no decorative motion.
- Operations surfaces (KDS, driver, waiter) inherit the same tokens but turn the volume down: density up, ornament off, copy named in one word.

## 2. Colors: The Bronze-and-Charcoal Palette

The palette has one chromatic voice, bronze gold, against a near-black ground. Everything else is a tinted neutral. There is no secondary accent; if a second colour is needed for state (error, success, status), it borrows from a strictly delimited semantic set and never competes with gold.

### Primary
- **Bronze Gold** (`#C8922A`): the brand colour, used like a piece of jewelry. Lives in the hero eyebrow, CTA buttons, focus rings, the scrollbar thumb, and small accents like the divider line under the menu number. Roughly 5–8% of any customer-facing screen by surface area.
- **Bronze Gold Light** (`#E8B86D`): hover and active state of the primary button, occasional emphasis in dialog headers, and the gold half of the cinematic gradient where one is briefly admitted.
- **Bronze Gold Dark** (`#A67C00`): pressed state, depressed UI elements, and the rare second step of a gold-led ramp.

### Neutral (The Charcoal Stack)
- **Charcoal Black** (`#0A0A0A`): the page background and the colour of the room. Never `#000`; always tinted very slightly warm to sit under the gold without going cold.
- **Surface One** (`#141210`): the first layer above the page; cards, headers, nav bars, dialog backgrounds.
- **Surface Two** (`#1C1A16`): elevated layer above Surface One; modal inner panels, dropdown menus, hover state of Surface One cards, scrollbar track.
- **Border** (`#2A2A2A`): the only border colour on the system. Used as a 1px hairline; never thicker than 1px, never as a coloured stripe.
- **Text** (`#F5F5F5`): the only body-and-heading colour on dark. Never pure `#fff`; very slightly warm to match the room temperature.
- **Muted Text** (`#6B6560`): secondary copy, eyebrows after the gold one, timestamps, captions. Always paired with a primary colour in the same block; never carries a paragraph alone.

### Semantic (rare; never decorative)
- **Brand Error** (`#C0392B`): destructive confirmations, validation errors, "STALLED" lane in the KDS, delete buttons.
- **Brand Success** (`#27AE60`): completed states, success toasts, "READY" lane in the KDS.

### The Delivery Sub-Palette
The delivery surface (driver app, customer-facing order tracking, related dashboards) runs on a parallel warm-brown ramp tuned for night-time visibility. It is the same brand, photographed at the loading door rather than the dining room.
- **Delivery Page** (`#0E0700`): the page background; deeper and warmer than charcoal.
- **Delivery Surface** (`#1C0F03`): the first layer above.
- **Delivery Amber** (`#C4933A`): the primary accent, slightly more saturated than brand gold to read at glance distance.

### Named Rules
**The One Voice Rule.** There is one chromatic voice on the system, and it is bronze gold. No second accent colour is admitted to the palette. If a screen needs to distinguish more than two states, the answer is type weight, ornament, or layout, not a new hue.

**The Jewelry Rule.** Gold is used like jewelry, not paint. On any customer-facing screen, gold-coloured surface area must stay at or below roughly 10% of the visible viewport. Gold is the eyebrow, the CTA, the focus ring, the divider. It is never the page background, never a full-bleed gradient, never a hero wash.

**The Tinted-Neutral Rule.** Every neutral on the system is tinted warm. `#000` and `#fff` are prohibited everywhere. The chosen black is `#0A0A0A`; the chosen white is `#F5F5F5`. If a designer reaches for pure black or pure white, the right answer is one of the two existing tokens.

## 3. Typography

**Arabic Display Font:** Cairo (with `system-ui, sans-serif` fallback)
**Arabic Body Font:** Almarai (with `system-ui, sans-serif` fallback)
**English Display Font:** Editorial New (with `Georgia, serif` fallback)
**English Body Font:** Satoshi (with `Inter, system-ui, sans-serif` fallback)

**Character:** Two fully resolved pairings, one per language, designed to feel like the same brand spoken in two voices. Arabic leads with Cairo's confident geometry for headlines and Almarai's softer humanist body for copy. English leads with Editorial New's printed-book serif (often italicized for the second line of a hero) and Satoshi's neutral grotesque for body. The pairings are intentionally non-symmetric: Arabic is sans-led, English is serif-led, because that is what reads as right in each script.

### Hierarchy
- **Display** (`font-weight: 700` AR / `400` EN, `clamp(2.25rem, 7vw, 4rem)`, `line-height: 0.9`): hero titles only. The English variant is often set in italic. Always paired with a small eyebrow above in `label` style.
- **Section Title** (`font-weight: 700` AR / `400` EN, ~`3rem`–`4rem`, `line-height: 1.05`): the headline of a marketing section ("Loyalty", "Branches", "Story"). Sits below a section eyebrow, above an italic subtitle if any.
- **Headline** (`font-weight: 700`, `1.875rem`, `line-height: 1.15`): the title of a card cluster or sub-section.
- **Title** (`font-weight: 700`, `1.5rem`, `line-height: 1.25`): the title of an individual card or row.
- **Body** (`font-weight: 400`, `1rem`, `line-height: 1.6`): paragraphs and descriptions. AR uses Almarai; EN uses Satoshi. Max line length 65–75ch on customer surfaces.
- **Label / Eyebrow** (`font-weight: 700`, `0.75rem`, `letter-spacing: 0.3em`, uppercase): the gold-coloured eyebrow above a title, the trust line under a hero, the small caps in a chip. Always tracked wide.

### Named Rules
**The Bilingual-At-Origin Rule.** No design is finished until both languages render correctly. RTL is not an afterthought layout; it is the primary layout, and English is the variant. The Arabic font stack is loaded first in the layout; the English stack is loaded second. Pages that look perfect in English and broken in Arabic ship as broken.

**The No-Em-Dash Rule.** Em dashes are forbidden in body copy and headlines. Use commas, colons, semicolons, periods, or parentheses. This is a project-wide rule and applies equally to English and to copy written across the bilingual divide.

**The Eyebrow Rule.** The gold-coloured uppercase label sits above the section title, never below it, never beside it, and never inside the title. It is the cue that says "we are about to begin a thought."

## 4. Elevation

The system is **flat by default with tonal layering**. Drop shadows do not exist at rest on any surface. Depth on any given screen is read from the stacking of three near-black tones: page (`#0A0A0A`), surface one (`#141210`), surface two (`#1C1A16`). A card above the page is not lifted by shadow; it is lifted by sitting on a slightly lighter charcoal.

Shadows are admitted only as a **response to state**: a focus ring (gold, 2px solid, 2px offset), a hover treatment on a card (a subtle 1px border colour shift, never a shadow), a dialog surfaced over a backdrop (the backdrop is `brand-black at 80% opacity`, not a blur). The system never uses ambient ornamental shadows under cards, hero metrics, or section blocks.

### Shadow Vocabulary (rare)
- **Focus Ring** (`outline: 2px solid #C8922A; outline-offset: 2px; border-radius: 4px`): keyboard focus on any interactive element.
- **Dialog Backdrop** (`background: #0A0A0A / 80%`): the only ambient overlay on the system. Never blurred. Sits between the page and the dialog surface.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. The first reach for depth is a tonal step (move to the next surface tone), not a shadow. Shadows are reserved for state response, not for ambient ornament.

**The No-Glow Rule.** Gold glows, cinematic shadows, and ambient halos around buttons or cards are forbidden. The brand is restrained heritage, not movie poster.

## 5. Components

Every component is generous-and-tactile: comfortable padding, large radii on customer surfaces, satisfying state changes, no decorative motion. Operations components inherit the same primitives and turn the radii smaller, the density tighter, and the motion off.

### Buttons
- **Shape:** pill on customer surfaces (`border-radius: 9999px`); medium radius on dashboard/operations surfaces (`border-radius: 8px`–`12px`).
- **Primary** (gold-on-black): `background: #C8922A; color: #0A0A0A; padding: 16px 32px; font-weight: 700`. Hover lightens the background to `#E8B86D`; pressed state darkens to `#A67C00`. Used for the dominant CTA on any screen: "Order Now", "View Menu", "Confirm".
- **Secondary** (surface-on-black): `background: #141210; color: #F5F5F5; padding: 16px 32px; font-weight: 700`. Hover shifts the background to `#1C1A16` and the text colour to gold. Used for the second CTA in a pair ("View Branches" next to "Order Now").
- **Ghost / Tertiary**: text only, gold colour, no background. Used inline in dense UI (operations).
- **Focus:** every button shows the gold focus ring on `:focus-visible`. Never `outline: none`.

### Cards / Containers
- **Corner Style:** `border-radius: 16px` (`rounded-xl`) on customer surfaces; `border-radius: 12px` (`rounded-lg`) on dashboard cards; `border-radius: 8px` (`rounded-md`) on dense list rows.
- **Background:** `#141210` (Surface One) at rest, optionally `#1C1A16` (Surface Two) when sitting on Surface One.
- **Shadow Strategy:** none at rest. Hover is a 1px gold-tinted border (`border-color: rgba(200, 146, 42, 0.6)`), not a shadow.
- **Border:** 1px solid `#2A2A2A` at rest, or no border on full-bleed cards.
- **Internal Padding:** 24px on customer cards; 16px on dashboard cards; 12px on operations rows.
- **Nesting:** never. A card inside a card is wrong; refactor with a divider, a list, or a section break.

### Inputs / Fields
- **Style:** `background: #141210; color: #F5F5F5; padding: 12px 16px; border-radius: 8px; min-height: 48px; font-size: 16px` (the 16px is mandatory; smaller triggers iOS Safari auto-zoom on focus).
- **Border:** 1px solid `#2A2A2A` at rest; transitions to `#C8922A` on focus.
- **Focus:** gold border + the standard gold focus ring. Never a glow.
- **Error:** border shifts to `#C0392B`; helper text below in the same colour names the field and gives a fix ("Phone must start with +973").
- **RTL:** placeholder and helper text follow the active locale. Input direction follows `dir` on the document.

### Chips / Tags
- **Style:** pill (`border-radius: 9999px`), `padding: 4px 12px`, `font-size: 0.75rem`, `font-weight: 700`, tracked `0.05em–0.1em`.
- **Variants by meaning (not new colour):**
  - `new`: gold background, black text.
  - `popular`: surface-two background, gold-light text.
  - `vegetarian`: success background, black text.
  - `spicy`: error background, white text.
- Each chip variant has a single meaning; chips are never used as decoration.

### Navigation
- **Public floating header**: dark-on-dark with `backdrop-filter: blur(8px)` admitted as a rare exception (the only place glassmorphism is allowed), pinned to the top edge of the page; logo on the inline-start, locale switch on the inline-end, nav links in the middle. Active route shows a thin gold underline.
- **Mobile bottom nav**: dark surface, 5 icons, active state in gold. Touch targets ≥44px.
- **Dashboard side nav**: vertical column, dense, no decoration; active state is a gold left border (1px hairline, exception to the no-stripe rule because it sits inside the operations register) plus gold text.

### Cinematic Button (signature component)
The customer-facing CTA used on the hero and bottom-CTA sections. Pill-shaped, gold background, black text, oversized (`padding: 20px 48px`, `font-size: 1.25rem`). Honors RTL on the icon position. Used sparingly: at most one per visible viewport.

### KDS Order Card (signature component, operations register)
The card used on the kitchen line. Operations register inverts the customer hierarchy: the elapsed timer is the dominant glyph (`text-7xl`, gold), the order number is demoted to a small label, item names are body-weight, and the action surface (bump button) is the only place gold appears at scale. No shadows; depth is tonal. See `src/components/kds/KDSStationOrderCard.tsx`.

## 6. Do's and Don'ts

### Do:
- **Do** use the design tokens from `src/lib/design-tokens.ts` as the single source of truth for raw hex; everywhere else, reach for `bg-brand-*` Tailwind classes.
- **Do** use logical properties (`ps`, `pe`, `ms`, `me`, `border-s`, `border-e`, `rounded-s`, `rounded-e`) for every spatial property. RTL is primary; physical properties (`pl`, `pr`, `ml`, `mr`) break the Arabic layout silently.
- **Do** pair every section with its locale-appropriate font stack: Cairo + Almarai for AR, Editorial New + Satoshi for EN. Never use Almarai in English or Satoshi for Arabic body.
- **Do** keep the gold-coloured surface area at or below 10% of any visible viewport on customer surfaces ("The Jewelry Rule").
- **Do** convey depth by stacking the three charcoal tones (`brand-black` → `brand-surface` → `brand-surface-2`), not with shadows.
- **Do** show the gold focus ring on every interactive element. The keyboard user is a first-class user.
- **Do** size body text at 16px minimum and tap targets at 44×44 minimum on customer surfaces, 56×56 on operations surfaces (KDS, driver, waiter).
- **Do** honor `prefers-reduced-motion` on every animated surface. The hero, the philosophy manifesto, and the scroll-driven sections all collapse to static reveals when motion is reduced.

### Don't:
- **Don't** use the generic SaaS startup gradient (purple/violet, hero-metric template, identical card grids, glassmorphism). If a variant could plausibly belong to a B2B AI tool, the squint test has failed.
- **Don't** dress the brand as a Western fast-casual chain (red-and-cream palette, oversized circular logos, friendly-rounded sans-serifs, "Build your own bowl" patterns). The food is Iraqi; the visual rhetoric must be too.
- **Don't** import tourist Middle-Eastern clichés (arabesque borders, faux-papyrus textures, camel/lamp/genie iconography, calligraphy used as decoration). The brand is from inside the culture, not curating it for outsiders.
- **Don't** use generic delivery-app patterns (bright orange/red, scooter icons, urgency timers, gamified loyalty badges, "spin the wheel"). The delivery surfaces must read as the same restaurant, not as UberEats.
- **Don't** use `#000` or `#fff` anywhere. The chosen black is `#0A0A0A`; the chosen white is `#F5F5F5`.
- **Don't** use a gradient on text (`background-clip: text`). Use a single solid colour. Emphasis lives in weight and size.
- **Don't** use a coloured left-stripe or right-stripe border greater than 1px on cards, callouts, or alerts. The dashboard nav's gold active border is the single defined exception.
- **Don't** add a second chromatic accent. There is one accent, and it is bronze gold.
- **Don't** nest a card inside a card. If you need to communicate hierarchy within a card, use a divider or a label.
- **Don't** add a drop shadow at rest on any surface. Tonal layering does the job. Shadows are state-only.
- **Don't** use Inter, Poppins, Nunito, Montserrat, Raleway, or Roboto anywhere. The four chosen faces are non-negotiable.
- **Don't** use em dashes (`—` or `--`) in body or headline copy. Use commas, colons, semicolons, periods, or parentheses.
- **Don't** hardcode raw hex values outside `src/lib/design-tokens.ts` and the two exempt files listed in CLAUDE.md (`src/lib/delivery/tokens.ts`).
