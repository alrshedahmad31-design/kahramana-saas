# SKILL: Project Setup — Phase 1 Initialization

## Description
Load this skill at the START of Phase 1 before writing a single component.
Follow every step in order. Do not skip or reorder.

---

## Prerequisites Checklist (before running any command)

- [ ] Phase 0 is `done` in `phase-state.json`
- [ ] `docs/audit/blockers.md` exists and has been reviewed
- [ ] At least: logo placeholder, branch WhatsApp numbers, and basic menu structure are known
- [ ] Human has confirmed: "ابدأ Phase 1"

---

## Step 1 — Create Next.js Project

Run in the **parent directory** (one level above `kahramana/`):

```bash
npx create-next-app@latest kahramana-web \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-turbopack
```

> `--no-turbopack` — avoid unexpected build costs on Vercel (use standard webpack)

---

## Step 2 — Merge Agent System into Project

The `kahramana/` folder (agent system) must be merged with `kahramana-web/`:

```bash
# Copy agent system files into the new Next.js project
cp -r kahramana/.agents       kahramana-web/
cp -r kahramana/.agent        kahramana-web/
cp -r kahramana/docs          kahramana-web/
cp    kahramana/GEMINI.md     kahramana-web/
cp    kahramana/AGENTS.md     kahramana-web/
cp    kahramana/CLAUDE.md     kahramana-web/
cp    kahramana/GUARDRAILS.md kahramana-web/
cp    kahramana/.env.example  kahramana-web/
```

Final project root will contain both Next.js files AND agent files:

```
kahramana-web/               ← project root (open this in Antigravity)
├── .agents/                 ← Antigravity native
├── .agent/                  ← shared state
├── src/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── messages/
├── public/
│   └── fonts/               ← create this
├── docs/
├── GEMINI.md
├── AGENTS.md
├── CLAUDE.md
├── GUARDRAILS.md
├── .env.example
├── .env.local               ← create from .env.example (never commit)
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

---

## Step 3 — Install Dependencies

```bash
cd kahramana-web

# Core
npm install next-intl @supabase/supabase-js @supabase/ssr

# CMS
npm install next-sanity @sanity/image-url

# Animations
npm install framer-motion

# Validation
npm install zod

# Dev
npm install -D @types/node
```

---

## Step 4 — Configure next.config.ts

```typescript
// next.config.ts
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.sanity.io' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  // Prevent accidental Turbopack in production
  experimental: {},
}

export default withNextIntl(nextConfig)
```

---

## Step 5 — Configure Tailwind v4

```css
/* src/app/globals.css */
@import "tailwindcss";

/* Font faces — served from /public/fonts/ */
@font-face {
  font-family: 'Editorial New';
  src: url('/fonts/EditorialNew-Regular.woff2') format('woff2');
  font-weight: 300;
  font-display: swap;
}
@font-face {
  font-family: 'Editorial New';
  src: url('/fonts/EditorialNew-Bold.woff2') format('woff2');
  font-weight: 700;
  font-display: swap;
}
@font-face {
  font-family: 'Satoshi';
  src: url('/fonts/Satoshi-Variable.woff2') format('woff2');
  font-weight: 100 900;
  font-display: swap;
}

/* Design tokens as CSS variables */
:root {
  --color-black:     #0A0A0A;
  --color-surface:   #141210;
  --color-surface2:  #1C1A16;
  --color-gold:      #C8922A;
  --color-gold-light:#E8B86D;
  --color-gold-dark: #A67C00;
  --color-text:      #F5F5F5;
  --color-muted:     #6B6560;
  --color-error:     #C0392B;
  --color-success:   #27AE60;
}

html {
  background-color: var(--color-black);
  color: var(--color-text);
}
```

---

## Step 6 — Folder Structure (create all at once)

```bash
mkdir -p src/app/\(marketing\)
mkdir -p src/app/\(ordering\)/cart
mkdir -p src/app/\(ordering\)/checkout
mkdir -p src/app/\(dashboard\)/orders
mkdir -p src/app/\(dashboard\)/menu
mkdir -p src/app/api/orders
mkdir -p src/components/menu
mkdir -p src/components/cart
mkdir -p src/components/checkout
mkdir -p src/components/ui
mkdir -p src/components/layout
mkdir -p src/lib/supabase
mkdir -p src/lib/sanity
mkdir -p src/lib/utils
mkdir -p src/i18n
mkdir -p src/messages
mkdir -p public/fonts
mkdir -p public/images/placeholder
mkdir -p sanity/schemas
```

---

## Step 7 — i18n Setup (next-intl)

```typescript
// src/i18n/request.ts
import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const locale = cookieStore.get('locale')?.value ?? 'ar'

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
```

```typescript
// src/middleware.ts
import createMiddleware from 'next-intl/middleware'

export default createMiddleware({
  locales: ['ar', 'en'],
  defaultLocale: 'ar',
  localePrefix: 'never', // no /ar/ prefix — locale via cookie
})

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
```

```json
// src/messages/ar.json — scaffold (fill as components are built)
{
  "nav": {
    "menu": "القائمة",
    "about": "عن المطعم",
    "contact": "تواصل معنا",
    "cart": "السلة",
    "order": "اطلب الآن"
  },
  "menu": {
    "title": "قائمة الطعام",
    "addToCart": "أضف إلى السلة",
    "outOfStock": "غير متوفر"
  },
  "cart": {
    "title": "سلة الطلبات",
    "empty": "سلتك فارغة",
    "total": "المجموع",
    "checkout": "إتمام الطلب"
  },
  "checkout": {
    "title": "تأكيد الطلب",
    "name": "الاسم",
    "phone": "رقم الهاتف",
    "phoneOptional": "رقم الهاتف (اختياري)",
    "branch": "الفرع",
    "notes": "ملاحظات",
    "submit": "إرسال الطلب",
    "whatsappNote": "سيتم إرسال طلبك عبر واتساب"
  },
  "branches": {
    "riffa": "فرع الرفاع",
    "qallali": "فرع قلالي"
  },
  "currency": "BD"
}
```

```json
// src/messages/en.json — scaffold
{
  "nav": {
    "menu": "Menu",
    "about": "About",
    "contact": "Contact",
    "cart": "Cart",
    "order": "Order Now"
  },
  "menu": {
    "title": "Menu",
    "addToCart": "Add to Cart",
    "outOfStock": "Out of Stock"
  },
  "cart": {
    "title": "Your Order",
    "empty": "Your cart is empty",
    "total": "Total",
    "checkout": "Checkout"
  },
  "checkout": {
    "title": "Confirm Order",
    "name": "Name",
    "phone": "Phone",
    "phoneOptional": "Phone (optional)",
    "branch": "Branch",
    "notes": "Notes",
    "submit": "Send Order",
    "whatsappNote": "Your order will be sent via WhatsApp"
  },
  "branches": {
    "riffa": "Riffa Branch",
    "qallali": "Qallali Branch"
  },
  "currency": "BD"
}
```

---

## Step 8 — design-tokens.ts

```typescript
// src/lib/design-tokens.ts
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
    error:      '#C0392B',
    success:    '#27AE60',
  },
  font: {
    arHeading: 'Cairo',
    arBody:    'Almarai',
    enHeading: 'Editorial New',
    enBody:    'Satoshi',
    numbers:   'Satoshi',
  },
  radius: {
    sm: '4px', md: '8px', lg: '12px', xl: '16px',
  },
  transition: {
    fast: '150ms ease', normal: '250ms ease', slow: '400ms ease',
  },
} as const

export type ColorToken = keyof typeof tokens.color
export type FontToken  = keyof typeof tokens.font
```

---

## Step 9 — Supabase Client Setup

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

```typescript
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

---

## Step 10 — Verify Setup

```bash
# Must pass before writing any component
npm run build
npx tsc --noEmit

# Must return nothing
grep -rn "\bpl-\|\bpr-\|\bml-\|\bmr-" src/

# Must exist
ls public/fonts/        # may be empty — fonts added later
ls src/messages/ar.json
ls src/messages/en.json
ls src/lib/design-tokens.ts
ls src/lib/supabase/client.ts
ls src/lib/supabase/server.ts
```

Only after all pass → update `phase-state.json` setup as complete and begin first component.

---

## Fonts Download Reminder

```
Editorial New → pangram-pangram.com (paid — confirm with Ahmed)
Satoshi       → fontshare.com (free)
Cairo         → next/font/google (free, auto)
Almarai       → next/font/google (free, auto)

Place woff2 files in: public/fonts/
```

If fonts are not yet purchased → use system fallback temporarily and add TODO comment.
