# SEO MIGRATION PLAN — kahramanat.com → Phase 1
> Phase 0 Audit | Date: 2026-04-27
> Goal: Zero ranking loss during rebuild. Every indexed URL must redirect correctly.

---

## 1. Current Site SEO Baseline

| Signal | Current Status |
|---|---|
| Domain | kahramanat.com (established 2018) — domain authority carries over |
| Canonical | Set on all pages OK |
| lang="ar" dir="rtl" | Set correctly OK |
| Title tags | Present on all pages (homepage too long — see site-audit.md) |
| Clean URLs | Working (server strips .html) |
| HTTPS | Active OK |
| Mobile viewport | Set correctly OK |
| Schema.org | NO None — opportunity for Phase 1 |
| Sitemap.xml | Not confirmed — needs verification |
| robots.txt | Not confirmed — needs verification |

---

## 2. URL Redirect Map

All existing URLs must 301 redirect to their Phase 1 equivalents. The current site already serves clean URLs (no .html in browser), but both versions may be indexed.

### 2.1 — Static Page Redirects

| From (current) | To (Phase 1) | Status |
|---|---|---|
| `kahramanat.com/` | `kahramanat.com/` | OK No change |
| `kahramanat.com/index.html` | `kahramanat.com/` | 301 |
| `kahramanat.com/menu` | `kahramanat.com/menu` | OK No change |
| `kahramanat.com/menu.html` | `kahramanat.com/menu` | 301 |
| `kahramanat.com/story` | `kahramanat.com/about` | 301 (rename for SEO) |
| `kahramanat.com/story.html` | `kahramanat.com/about` | 301 |
| `kahramanat.com/gallery` | `kahramanat.com/gallery` | OK No change |
| `kahramanat.com/gallery.html` | `kahramanat.com/gallery` | 301 |
| `kahramanat.com/events` | `kahramanat.com/events` | OK No change |
| `kahramanat.com/events.html` | `kahramanat.com/events` | 301 |
| `kahramanat.com/recipes` | `kahramanat.com/recipes` | OK No change |
| `kahramanat.com/recipes.html` | `kahramanat.com/recipes` | 301 |
| `kahramanat.com/contact` | `kahramanat.com/contact` | OK No change |
| `kahramanat.com/contact.html` | `kahramanat.com/contact` | 301 |

> **Decision confirmed 2026-04-27:** `/story` → `/about` approved by client. 301 redirect active in Phase 1.

### 2.2 — New URLs in Phase 1 (No Redirect Needed)

| New URL | Purpose |
|---|---|
| `/ar` | Arabic homepage (next-intl locale root) |
| `/en` | English homepage |
| `/ar/menu` | Arabic menu |
| `/en/menu` | English menu |
| `/ar/contact` | Arabic contact |
| `/en/contact` | English contact |

> **Locale strategy**: Use `hreflang` tags to tell Google which language version to serve. AR version gets priority for Bahrain searches.

---

## 3. Next.js Redirect Configuration

Add to `next.config.ts` before Phase 1 launch:

```typescript
// next.config.ts
const redirects = async () => [
  // .html → clean
  { source: '/index.html',   destination: '/',        permanent: true },
  { source: '/menu.html',    destination: '/menu',    permanent: true },
  { source: '/story.html',   destination: '/about',   permanent: true },
  { source: '/story',        destination: '/about',   permanent: true },
  { source: '/gallery.html', destination: '/gallery', permanent: true },
  { source: '/events.html',  destination: '/events',  permanent: true },
  { source: '/recipes.html', destination: '/recipes', permanent: true },
  { source: '/contact.html', destination: '/contact', permanent: true },
]
```

---

## 4. Canonical Strategy

### 4.1 — Language Canonicals

```html
<!-- On Arabic pages (default) -->
<link rel="canonical" href="https://kahramanat.com/ar/menu" />
<link rel="alternate" hreflang="ar" href="https://kahramanat.com/ar/menu" />
<link rel="alternate" hreflang="en" href="https://kahramanat.com/en/menu" />
<link rel="alternate" hreflang="x-default" href="https://kahramanat.com/ar/menu" />
```

### 4.2 — next-intl Implementation

```typescript
// app/[locale]/menu/page.tsx
export async function generateMetadata({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'menu' })
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: {
      canonical: `https://kahramanat.com/${params.locale}/menu`,
      languages: {
        'ar': 'https://kahramanat.com/ar/menu',
        'en': 'https://kahramanat.com/en/menu',
      },
    },
  }
}
```

---

## 5. Title Tag Fixes for Phase 1

| Page | Current (too long) | Phase 1 Target (≤60 chars) |
|---|---|---|
| Homepage (AR) | 94 chars | `كهرمانة بغداد — سفير المذاق العراقي في البحرين` (48) |
| Homepage (EN) | — | `Kahramana Baghdad — Iraqi Restaurant in Bahrain` (49) |
| Menu (AR) | 54 OK | `قائمة كهرمانة بغداد — أكثر من ١٠٠ طبق عراقي أصيل` (51) |
| Menu (EN) | — | `Kahramana Baghdad Menu — 100+ Authentic Iraqi Dishes` (53) |
| Contact (AR) | 66 Warning: | `تواصل مع كهرمانة بغداد — فرعا الرفاع والمحرق` (46) |
| Contact (EN) | — | `Contact Kahramana Baghdad — Riffa & Muharraq` (46) |

---

## 6. Schema.org to Add in Phase 1

### 6.1 — Restaurant Schema (Homepage)

```json
{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "كهرمانة بغداد",
  "alternateName": "Kahramana Baghdad",
  "description": "مطعم عراقي أصيل في البحرين",
  "url": "https://kahramanat.com",
  "logo": "https://kahramanat.com/assets/brand/logo.webp",
  "image": "https://kahramanat.com/assets/brand/og-image.webp",
  "servesCuisine": ["Iraqi", "Middle Eastern"],
  "priceRange": "$$",
  "telephone": "+97317131413",
  "email": "info@kahramanat.com",
  "foundingDate": "2018",
  "sameAs": [
    "https://www.instagram.com/kahramanat_b",
    "https://www.tiktok.com/@kahramanat_b",
    "https://www.facebook.com/kahramanat1"
  ],
  "location": [
    {
      "@type": "Place",
      "name": "فرع الرفاع — الحجيات",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "منطقة الحجيات",
        "addressLocality": "الرفاع",
        "addressCountry": "BH"
      },
      "openingHoursSpecification": {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
        "opens": "19:00",
        "closes": "01:00"
      }
    },
    {
      "@type": "Place",
      "name": "فرع المحرق — قلالي",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "الشارع الرئيسي، قلالي",
        "addressLocality": "المحرق",
        "addressCountry": "BH"
      },
      "openingHoursSpecification": {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
        "opens": "12:00",
        "closes": "01:00"
      }
    }
  ]
}
```

---

## 7. Sitemap Strategy

### 7.1 — Next.js Dynamic Sitemap

```typescript
// app/sitemap.ts
export default function sitemap(): MetadataRoute.Sitemap {
  const locales = ['ar', 'en']
  const pages = ['', '/menu', '/about', '/gallery', '/events', '/recipes', '/contact']
  return locales.flatMap(locale =>
    pages.map(page => ({
      url: `https://kahramanat.com/${locale}${page}`,
      lastModified: new Date(),
      alternates: {
        languages: {
          ar: `https://kahramanat.com/ar${page}`,
          en: `https://kahramanat.com/en${page}`,
        },
      },
    }))
  )
}
```

---

## 8. Google Search Console Actions

At Phase 1 launch:

1. Submit new sitemap: `https://kahramanat.com/sitemap.xml`
2. Use "URL Inspection" to request re-crawl of homepage
3. Monitor "Coverage" report for 404 errors (catch any missed redirects)
4. Verify `hreflang` implementation via "International Targeting" report
5. Check Core Web Vitals report after 2 weeks live

---

## 9. SEO Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| 301 redirect chain | Low | Medium | Verify all redirects go direct, not chained |
| Google re-crawl delay | Medium | Low | Submit sitemap immediately at launch |
| Ranking drop during rebuild | Low | High | Keep old site live until Phase 1 fully tested |
| Duplicate content (AR/EN) | Medium | Medium | `hreflang` + canonical on both versions |
| Schema.org errors | Low | Low | Test with Google Rich Results Test before launch |

---

## 10. Pre-Launch SEO Checklist

Before switching DNS to Phase 1:

- [ ] All 301 redirects verified with `curl -I` or similar
- [ ] Canonical tags on every page
- [ ] `hreflang` on every page (AR + EN)
- [ ] `sitemap.xml` accessible at `/sitemap.xml`
- [ ] `robots.txt` allows all crawlers
- [ ] Restaurant schema on homepage validates in Google Rich Results Test
- [ ] Google Search Console verified for new site
- [ ] GA4 tracking confirmed firing on both locales
- [ ] Core Web Vitals baseline measured (aim: LCP < 2.5s on mobile)
- [ ] Old site NOT taken down until Google confirms new indexing
