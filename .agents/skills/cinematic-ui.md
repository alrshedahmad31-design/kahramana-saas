# SKILL: Cinematic UI Patterns — Kahramana

## Description
Load this skill when building any customer-facing page in Phase 1 (Homepage, Menu, About).
This elevates the design from "functional restaurant website" to "digital instrument."

---

## Core Philosophy (from Role.md)

> **"Do not build a website; build a digital instrument."**
> Every scroll should feel intentional, every animation should feel weighted and professional.
> Eradicate all generic AI patterns.

**What this means for Kahramana:**
- Menu scrolling should feel smooth and deliberate (GSAP momentum scroll)
- Category filter should snap and glide, not just "work"
- Dish cards should have weight — subtle scale/shadow on hover
- Hero section should breathe — parallax background movement
- Loading states should be elegant — skeleton screens with shimmer, not spinners

---

## GSAP Integration — Phase 1

Install:
```bash
npm install gsap@3
```

**Critical animations to implement:**

### 1. Hero Parallax
```tsx
// app/(marketing)/page.tsx — Hero section
useEffect(() => {
  gsap.to('.hero-image', {
    y: '30%',
    ease: 'none',
    scrollTrigger: {
      trigger: '.hero-section',
      start: 'top top',
      end: 'bottom top',
      scrub: true,
    },
  })
}, [])
```

### 2. Category Filter Momentum Scroll
```tsx
// components/menu/CategoryFilter.tsx
import { Draggable } from 'gsap/Draggable'
gsap.registerPlugin(Draggable)

Draggable.create('.category-filter', {
  type: 'x',
  inertia: true,
  bounds: '.category-container',
  dragClickables: true,
})
```

### 3. Menu Item Card Reveal
```tsx
// components/menu/MenuItemCard.tsx
useEffect(() => {
  gsap.from('.menu-card', {
    opacity: 0,
    y: 30,
    stagger: 0.1,
    duration: 0.6,
    ease: 'power2.out',
    scrollTrigger: {
      trigger: '.menu-grid',
      start: 'top 80%',
    },
  })
}, [])
```

### 4. Cart Drawer Slide
```tsx
// components/cart/CartDrawer.tsx
const openCart = () => {
  gsap.to('.cart-drawer', {
    x: 0,
    duration: 0.4,
    ease: 'power3.out',
  })
}

const closeCart = () => {
  gsap.to('.cart-drawer', {
    x: '100%', // RTL: use '-100%'
    duration: 0.4,
    ease: 'power3.in',
  })
}
```

---

## Visual Patterns from Role.md → Kahramana

### Noise Overlay (adds texture like premium magazines)
```css
/* globals.css */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03' /%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 9999;
}
```

### Blur Placeholder for Dish Images
```tsx
// components/menu/MenuItemCard.tsx
<Image
  src={item.image_url}
  alt={item.nameAR}
  fill
  className="object-cover"
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWEREiMxUf/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
/>
```

### "System Operational" Status Indicator (Footer)
```tsx
// components/layout/Footer.tsx
<div className="flex items-center gap-2">
  <div className="relative">
    <div className="w-2 h-2 rounded-full bg-[#27AE60]" />
    <div className="absolute inset-0 w-2 h-2 rounded-full bg-[#27AE60] animate-ping opacity-75" />
  </div>
  <span className="font-['Satoshi'] text-[#6B6560] text-xs">
    النظام نشط — System Operational
  </span>
</div>
```

---

## Anti-Patterns — NEVER DO (from Role.md)

| NO Generic AI Pattern | OK Kahramana Pattern |
|---|---|
| `rounded-full` buttons | `rounded-lg` max |
| Purple gradients | Gold `#C8922A` solid or subtle gold gradient `from-[#C8922A] to-[#A67C00]` |
| Loading spinner | Skeleton screen with shimmer animation |
| Instant state changes | GSAP tween 200-400ms |
| Centered hero text | Offset hero text with asymmetric layout |
| Generic stock photos | Use actual Kahramana dish photos from `public/assets/gallery/` |

---

## Homepage Hero — Cinematic Implementation

```tsx
// app/(marketing)/page.tsx
<section className="hero-section relative h-screen overflow-hidden">
  {/* Parallax background */}
  <div className="hero-image absolute inset-0 -z-10">
    <Image
      src="/assets/hero/hero.webp"
      fill
      className="object-cover"
      priority
      alt="كهرمانة بغداد"
    />
    {/* Dark overlay for text contrast */}
    <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A]/70 via-[#0A0A0A]/50 to-[#0A0A0A]" />
  </div>

  {/* Hero content */}
  <div className="relative h-full flex items-center justify-end pe-8 md:pe-16">
    <div className="max-w-2xl text-end" dir="rtl">
      {/* Brand name — tight tracking like Role.md */}
      <h1 className="font-['Cairo'] font-black text-5xl md:text-7xl text-[#F5F5F5] tracking-tight leading-none mb-4">
        كهرمانة بغداد
      </h1>
      
      {/* Tagline — drama serif italic pattern from Role.md */}
      <p className="font-['Editorial_New'] font-light italic text-2xl md:text-4xl text-[#C8922A] mb-8">
        نكهة الرافدين الأصيلة.
      </p>

      {/* CTA — no rounded-full, weighted feel */}
      <button className="group bg-[#C8922A] text-[#0A0A0A] font-['Satoshi'] font-medium text-lg px-8 py-4 rounded-lg hover:bg-[#E8B86D] transition-all duration-300 active:scale-95">
        اطلب الآن
        <span className="inline-block ms-2 group-hover:translate-x-[-4px] transition-transform duration-300">←</span>
      </button>
    </div>
  </div>
</section>
```

---

## Menu Grid — Staggered Reveal (like Role.md Protocol section)

```tsx
// app/(marketing)/menu/page.tsx
'use client'
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export default function MenuPage() {
  const gridRef = useRef(null)

  useEffect(() => {
    const cards = gridRef.current?.querySelectorAll('.menu-card')
    
    gsap.from(cards, {
      opacity: 0,
      y: 60,
      stagger: 0.08, // staggered like Role.md Features
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: gridRef.current,
        start: 'top 75%',
      },
    })
  }, [])

  return (
    <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
      {menuItems.map(item => (
        <MenuItemCard key={item.id} item={item} className="menu-card" />
      ))}
    </div>
  )
}
```

---

## Acceptance Criteria — Cinematic Quality Check

Before marking Phase 1 complete, verify:
- [ ] Hero parallax scrolls smoothly at 60fps
- [ ] Category filter has momentum scroll (not just static scroll)
- [ ] Menu cards reveal with stagger animation
- [ ] Cart drawer slides with ease curve (not linear)
- [ ] All buttons have `:active` scale feedback
- [ ] No loading spinners — only skeleton screens with shimmer
- [ ] Noise overlay visible on dark backgrounds
- [ ] All transitions use GSAP (200-400ms) not CSS transitions alone
- [ ] No `rounded-full` anywhere
- [ ] No purple/blue gradients

---

## Technical Stack Addition

Add to Phase 1 deliverables:
```
- [ ] lib/animations.ts — Reusable GSAP animation configs
- [ ] components/ui/SkeletonCard.tsx — Loading state for menu items
- [ ] globals.css — Noise overlay + custom GSAP utilities
```

Add to package.json:
```json
{
  "dependencies": {
    "gsap": "^3.12.5"
  }
}
```

---

## Performance Note

GSAP ScrollTrigger is heavy. Use sparingly:
- Hero parallax: YES
- Menu grid reveal: YES
- Category filter momentum: YES
- Every single hover effect: NO (use CSS for simple hovers)

Budget: Max 5-7 ScrollTrigger instances per page.
