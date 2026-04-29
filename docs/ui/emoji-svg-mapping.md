# Emoji to SVG Icon Mapping

Scope: active app source, static HTML artifacts, and project documentation.

## Icon System

The app uses `src/components/icons/LuxuryIcon.tsx` as the single inline SVG system for premium UI icons. Icons use:

- `currentColor` for CSS-controlled color
- no inline fill colors
- `1.6` stroke width with rounded line caps
- standardized `14`, `20`, and `40` pixel usage in the current UI

## App Replacements

| Previous symbol | Replacement | Notes |
| --- | --- | --- |
| U+2713 Check mark | `LuxuryIcon` with `name="check"` | Used for success and completed states. |
| U+1F9FE Receipt | Plain Arabic text in WhatsApp message body | SVG cannot be embedded in WhatsApp prefilled text. |
| U+1F3EA Convenience store | Plain Arabic branch label in WhatsApp message body | Preserves meaning without visual clutter. |
| U+1F37D Fork and knife with plate | Plain Arabic order label in WhatsApp message body | Text channel, not UI. |
| U+1F4B0 Money bag | Plain Arabic total label in WhatsApp message body | Avoids playful financial iconography. |
| U+1F522 Input numbers | Plain Arabic order number label in WhatsApp message body | More readable for staff. |
| U+1F464 Bust in silhouette | Plain Arabic customer name label in WhatsApp message body | More formal tone. |
| U+1F4DE Telephone receiver | Plain Arabic phone label in WhatsApp message body | More formal tone. |
| U+1F4DD Memo | Plain Arabic notes label in WhatsApp message body | More formal tone. |
| U+26A0 Warning sign | Text marker in comments/docs | Not part of rendered UI. |

## Static and Documentation Replacements

Markdown and operational documents use text markers such as `OK`, `Blocked`, `Warning`, and `Pending` because SVG icons inside project instructions reduce readability and are not part of the customer-facing interface.

For static HTML artifacts, replacement should prefer the same thin outline vocabulary: check, warning, status dot, receipt, branch, dining, phone, note, user, chart, role, and operations icons.

## Design Decisions

WhatsApp order messages were changed from icon-prefixed lines to clean Arabic labels. This is intentional: the channel is plain text, staff need scan speed, and emoji would undermine the premium tone.

The UI check mark is now an inline SVG instead of a text glyph, which gives consistent sizing, stroke weight, and color inheritance across the contact success state, telemetry feed, and KDS ready state.
