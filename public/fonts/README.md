# Kahramana — Self-Hosted Fonts

All fonts must be self-hosted. Zero Google Fonts CDN calls in production.
Place font files in the appropriate subdirectory below.

## Cairo (Arabic headings)
- **Weight used**: 800 (ExtraBold) ONLY
- **File name**: `cairo/Cairo-ExtraBold.woff2`
- **Source**: https://fonts.google.com/specimen/Cairo
  - Download → select weight 800 → "Download family" → convert TTF→WOFF2 with https://cloudconvert.com/ttf-to-woff2

## Almarai (Arabic body)
- **Weights used**: 400 (Regular), 700 (Bold)
- **File names**: `almarai/Almarai-Regular.woff2`, `almarai/Almarai-Bold.woff2`
- **Source**: https://fonts.google.com/specimen/Almarai
  - Download → select weights 400 + 700 → convert TTF→WOFF2

## Editorial New (English headings)
- **Weights used**: 300 (Light), 700 (Bold)
- **File names**: `editorial-new/EditorialNew-Light.woff2`, `editorial-new/EditorialNew-Bold.woff2`
- **Current location**: Root `/public/fonts/` (move here when reorganizing)
- **Source**: https://pangrampangram.com/products/editorial-new (commercial license required)

## Satoshi (English body + numbers)
- **Weights used**: 400 (Regular), 500 (Medium)
- **File names**: `satoshi/Satoshi-Regular.woff2`, `satoshi/Satoshi-Medium.woff2`
- **Current location**: Root `/public/fonts/` (move here when reorganizing)
- **Source**: https://www.fontshare.com/fonts/satoshi (free for commercial use)

## Loading via next/font/local

```typescript
// app/fonts.ts
import localFont from 'next/font/local'

export const cairo = localFont({
  src: '../public/fonts/cairo/Cairo-ExtraBold.woff2',
  variable: '--font-cairo',
  weight: '800',
  display: 'swap',
})

export const almarai = localFont({
  src: [
    { path: '../public/fonts/almarai/Almarai-Regular.woff2', weight: '400' },
    { path: '../public/fonts/almarai/Almarai-Bold.woff2',    weight: '700' },
  ],
  variable: '--font-almarai',
  display: 'swap',
})
```
