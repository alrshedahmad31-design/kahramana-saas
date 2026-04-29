// SINGLE SOURCE OF TRUTH — import from here, never hardcode in components
// Only this file may contain raw hex values (exempt from grep check 8)

export const tokens = {
  color: {
    black:     '#0A0A0A', // page background ONLY — never for text
    surface:   '#141210', // card backgrounds — first level
    surface2:  '#1C1A16', // nested cards, input fields, dropdowns
    gold:      '#C8922A', // primary accent — CTAs, highlights, active borders
    goldLight: '#E8B86D', // hover states ONLY — never the default color
    goldDark:  '#A67C00', // pressed/active states, decorative borders
    text:      '#F5F5F5', // all primary text on dark backgrounds
    muted:     '#6B6560', // secondary text, placeholders, disabled labels
    error:     '#C0392B', // errors, out-of-stock badges, destructive actions
    success:   '#27AE60', // confirmations, available status, checkmarks
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

// Order status badge colors — centralized here to avoid hardcoding in components
export const STATUS_COLORS = {
  new:              { text: tokens.color.gold,      border: tokens.color.gold      },
  under_review:     { text: tokens.color.goldLight,  border: tokens.color.goldLight },
  accepted:         { text: tokens.color.goldLight,  border: tokens.color.goldLight },
  preparing:        { text: tokens.color.goldLight,  border: tokens.color.goldLight },
  ready:            { text: tokens.color.success,    border: tokens.color.success   },
  out_for_delivery: { text: tokens.color.text,       border: tokens.color.muted     },
  delivered:        { text: tokens.color.success,    border: tokens.color.success   },
  completed:        { text: tokens.color.success,    border: tokens.color.success   },
  cancelled:        { text: tokens.color.error,      border: tokens.color.error     },
  payment_failed:   { text: tokens.color.error,      border: tokens.color.error     },
} as const

export type OrderStatus = keyof typeof STATUS_COLORS

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
