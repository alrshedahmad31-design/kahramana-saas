// SINGLE SOURCE OF TRUTH — import from here, never hardcode in components.
// Values MUST match tailwind.config.ts so `bg-brand-*` Tailwind classes and
// inline `tokens.color.*` styles render the exact same hue. Update both.
// Only this file may contain raw hex values (exempt from grep check 8)

export const tokens = {
  color: {
    black:      '#0A0A0A',
    surface:    '#141210',
    surface2:   '#1C1A16',
    gold:       '#C8922A',
    goldLight:  '#E8B86D',
    goldDark:   '#A67C00',
    text:       '#F5F5F5',
    muted:      '#6B6560',
    border:     '#2A2A2A',
    error:      '#C0392B',
    success:    '#27AE60',
    kdsOrange:  '#D35400',
    kdsBlue:    '#2980B9',
    kdsRed:     '#E74C3C',
    kdsAmber:   '#D97706',
    kdsIndigo:  '#4F46E5',
    qrInk:      '#0A0A0A',
    qrPaper:    '#F5F5F5',
  },
  font: {
    arHeading: 'Cairo',
    arBody:    'Almarai',
    enHeading: 'Editorial New',
    enBody:    'Satoshi',
    numbers:   'Satoshi',
  },
  fontSize: {
    xs:    '0.75rem',
    sm:    '0.875rem',
    base:  '1rem',
    lg:    '1.125rem',
    xl:    '1.25rem',
    xl2:   '1.5rem',
    xl3:   '1.875rem',
    xl4:   '2.25rem',
    xl5:   '3rem',
    xl6:   '4rem',
  },
  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  },
  spacing: {
    inline: { start: 'ps', end: 'pe' },
    block:  { start: 'pt', end: 'pb' },
  },
  transition: {
    fast:   '150ms ease',
    normal: '250ms ease',
    slow:   '400ms ease',
  },
} as const

export const colors = tokens.color
export const fonts  = tokens.font

export type ColorToken = keyof typeof tokens.color
export type FontToken  = keyof typeof tokens.font

export const TAG_COLORS = {
  vegetarian: { bg: tokens.color.success,  text: tokens.color.black },
  spicy:      { bg: tokens.color.error,    text: tokens.color.text  },
  new:        { bg: tokens.color.gold,     text: tokens.color.black },
  popular:    { bg: tokens.color.surface2, text: tokens.color.goldLight },
} as const

export type TagType = keyof typeof TAG_COLORS

export const PROTOCOL_COLORS = {
  step1: tokens.color.gold,
  step2: tokens.color.goldDark,
  step3: tokens.color.goldLight,
  step4: tokens.color.text,
} as const

export const TIER_COLORS = {
  bronze:   { text: '#CD7F32', border: '#CD7F32', bg: '#CD7F3220' },
  silver:   { text: '#A8A9AD', border: '#A8A9AD', bg: '#A8A9AD20' },
  gold:     { text: '#C8A951', border: '#C8A951', bg: '#C8A95120' },
  platinum: { text: '#E5E4E2', border: '#E5E4E2', bg: '#E5E4E220' },
} as const

export type LoyaltyTierColor  = keyof typeof TIER_COLORS
