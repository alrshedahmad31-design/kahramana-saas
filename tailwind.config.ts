import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'brand-gold': '#C8922A',
        'brand-black': '#0A0A0A',
        'brand-surface': '#141210',
        'brand-surface-2': '#1C1A16',
        'brand-border': '#2A2A2A',
        'brand-gold-light': '#E8B86D',
        'brand-gold-dark': '#A67C00',
        'brand-text': '#F5F5F5',
        'brand-muted': '#6B6560',
        'brand-error': '#C0392B',
        'brand-success': '#27AE60',
      },
      fontFamily: {
        cairo:     ['var(--cairo)', 'sans-serif'],
        almarai:   ['var(--almarai)', 'sans-serif'],
        editorial: ['var(--editorial)', 'serif'],
        satoshi:   ['var(--satoshi)', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
