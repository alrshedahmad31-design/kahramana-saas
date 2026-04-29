// SINGLE SOURCE OF TRUTH — import from here, never hardcode in components.
// Values MUST match tailwind.config.ts so `bg-brand-*` Tailwind classes and
// inline `tokens.color.*` styles render the exact same hue. Update both.
// Only this file may contain raw hex values (exempt from grep check 8)

export const tokens = {
  color: {
    black:     '#110b05', // page background ONLY — never for text
    surface:   '#2d180b', // card backgrounds — first level
    surface2:  '#3a1a08', // nested cards, input fields, dropdowns
    gold:      '#d19f51', // primary accent — CTAs, highlights, active borders
    goldLight: '#dfc9aa', // hover states ONLY — never the default color
    goldDark:  '#a8771c', // pressed/active states, decorative borders
    text:      '#f4ecd8', // all primary text on dark backgrounds
    muted:     '#dfc9aa', // secondary text, placeholders, disabled labels
    border:    '#743417', // dividers, card borders, input outlines
    error:     '#C0392B', // errors, out-of-stock badges, destructive actions
    success:   '#27AE60', // confirmations, available status, checkmarks
    qrInk:     '#110b05', // QR-code foreground — paper-themed printables
    qrPaper:   '#f4ecd8', // QR-code background — paper-themed printables
  },
  font: {
    arHeading: 'Cairo',         // Arabic headings — weight 800 ONLY
    arBody:    'Almarai',       // Arabic body — 400 / 700
    enHeading: 'Editorial New', // English headings — 300 / 700
    enBody:    'Satoshi',       // English body — 400 / 500
    numbers:   'Satoshi',       // prices — tabular-nums always
  },
  fontSize: {
    xs:    '0.75rem',
    sm:    '0.875rem',
    base:  '1rem',
    lg:    '1.125rem',
    xl:    '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    '5xl': '3rem',
    '6xl': '4rem',
  },
  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    // NEVER rounded-full on buttons
  },
  spacing: {
    // RTL-SAFE LOGICAL PROPERTIES ONLY
    // Use: ps pe ms me  —  NEVER pl pr ml mr
    inline: { start: 'ps', end: 'pe' },
    block:  { start: 'pt', end: 'pb' },
  },
  transition: {
    fast:   '150ms ease',
    normal: '250ms ease',
    slow:   '400ms ease',
  },
} as const

// Convenience flat exports for common import patterns
export const colors = tokens.color
export const fonts  = tokens.font

export type ColorToken = keyof typeof tokens.color
export type FontToken  = keyof typeof tokens.font

// Filter tag colors — used in menu item cards
export const TAG_COLORS = {
  vegetarian: { bg: tokens.color.success,  text: tokens.color.black },
  spicy:      { bg: tokens.color.error,    text: tokens.color.text  },
  new:        { bg: tokens.color.gold,     text: tokens.color.black },
  popular:    { bg: tokens.color.surface2, text: tokens.color.goldLight },
} as const

export type TagType = keyof typeof TAG_COLORS
// Protocol section step colors
export const PROTOCOL_COLORS = {
  step1: tokens.color.gold,
  step2: tokens.color.goldDark,
  step3: tokens.color.goldLight,
  step4: tokens.color.text,
} as const

// Loyalty tier colors
export const TIER_COLORS = {
  bronze:   { text: '#CD7F32', border: '#CD7F32', bg: '#CD7F3220' },
  silver:   { text: '#A8A9AD', border: '#A8A9AD', bg: '#A8A9AD20' },
  gold:     { text: '#C8A951', border: '#C8A951', bg: '#C8A95120' },
  platinum: { text: '#E5E4E2', border: '#E5E4E2', bg: '#E5E4E220' },
} as const

export type LoyaltyTierColor = keyof typeof TIER_COLORS
