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
        'brand-gold': '#d19f51',
        'brand-black': '#110b05',
        'brand-cream': '#f4ecd8',
        'brand-surface': '#2d180b',
        'brand-surface-2': '#3a1a08',
        'brand-border': '#743417',
        'brand-gold-light': '#dfc9aa',
        'brand-gold-dark': '#a8771c',
        'brand-text': '#f4ecd8',
        'brand-muted': '#dfc9aa',
        'brand-error': '#C0392B',
        'brand-success': '#27AE60',
      },
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
        almarai: ['Almarai', 'sans-serif'],
        editorial: ['Editorial New', 'serif'],
        satoshi: ['Satoshi', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
