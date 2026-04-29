# Schema Templates — Kahramana Baghdad
# Safe JSON-LD templates — only use confirmed data from src/constants/contact.ts

## CRITICAL RULE
Never fill a field with invented data. If data is missing → use TODO comment, not fake data.

---

## LOCAL_BUSINESS — Active Branch Template

Use this for Riffa and Qallali branches only.
Al-Budayi → use COMING_SOON template below.

```typescript
// Safe LocalBusiness schema — only confirmed fields included
function getBranchSchema(branch: {
  name: string;         // from constants
  namEn: string;        // from constants
  phone: string;        // from constants
  url: string;          // constructed from known route
}) {
  return {
    "@context": "https://schema.org",
    "@type": ["Restaurant", "LocalBusiness"],
    "name": branch.name,                    // e.g. "كهرمانة بغداد - الرفاع"
    "alternateName": branch.nameEn,         // e.g. "Kahramana Baghdad - Riffa"
    "url": branch.url,                      // e.g. "https://kahramanat.com/ar/branches"
    "telephone": branch.phone,              // from constants — never hardcode
    "servesCuisine": ["Iraqi", "عراقي"],
    "priceRange": "$$",                     // TODO: confirm with restaurant
    "currenciesAccepted": "BHD",
    // OMITTED — require confirmation before adding:
    // "address" — not confirmed in codebase
    // "geo" — not confirmed
    // "openingHoursSpecification" — not confirmed
    // "aggregateRating" — never fake
    // "review" — never fake
    // "sameAs" — add only if social URLs confirmed
    "hasMap": null,                         // TODO: add Google Maps URL when confirmed
    "image": null,                          // TODO: add branch photo URL
    "menu": "https://kahramanat.com/ar/menu"
  }
}
```

---

## COMING_SOON — Unconfirmed Branch Template

```typescript
// Al-Budayi branch — Coming Soon, NOT active
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "كهرمانة بغداد - البديع (قريباً)",
  "alternateName": "Kahramana Baghdad - Al-Budayi (Coming Soon)",
  // NO address, NO phone, NO geo — branch not active
  // This signals to Google it exists but is not yet operational
}
```

---

## RESTAURANT — Homepage Organization Schema

```typescript
{
  "@context": "https://schema.org",
  "@type": ["Restaurant", "Organization"],
  "name": "كهرمانة بغداد",
  "alternateName": "Kahramana Baghdad",
  "url": "https://kahramanat.com",
  "logo": "https://kahramanat.com/logo.svg",   // only if confirmed path
  "servesCuisine": ["Iraqi", "عراقي", "Middle Eastern"],
  "hasMenu": "https://kahramanat.com/ar/menu",
  "contactPoint": [
    {
      "@type": "ContactPoint",
      "telephone": "[RIFFA_PHONE from constants]",
      "contactType": "customer service",
      "areaServed": "BH",
      "availableLanguage": ["Arabic", "English"]
    },
    {
      "@type": "ContactPoint",
      "telephone": "[QALLALI_PHONE from constants]",
      "contactType": "customer service",
      "areaServed": "BH",
      "availableLanguage": ["Arabic", "English"]
    }
  ]
  // sameAs: add Instagram URL if confirmed
}
```

---

## BREADCRUMB — Pattern Templates

### Homepage
```json
{ "@context": "https://schema.org", "@type": "BreadcrumbList" }
// No breadcrumb on homepage — it IS the root
```

### Menu Hub
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "الرئيسية", "item": "https://kahramanat.com/ar/" },
    { "@type": "ListItem", "position": 2, "name": "المنيو", "item": "https://kahramanat.com/ar/menu" }
  ]
}
```

### Category Page
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "الرئيسية", "item": "https://kahramanat.com/ar/" },
    { "@type": "ListItem", "position": 2, "name": "المنيو", "item": "https://kahramanat.com/ar/menu" },
    { "@type": "ListItem", "position": 3, "name": "[Category Name]", "item": "https://kahramanat.com/ar/menu/[category-slug]" }
  ]
}
```

### Dish Page
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "الرئيسية", "item": "https://kahramanat.com/ar/" },
    { "@type": "ListItem", "position": 2, "name": "المنيو", "item": "https://kahramanat.com/ar/menu" },
    { "@type": "ListItem", "position": 3, "name": "[Category]", "item": "https://kahramanat.com/ar/menu/[category]" },
    { "@type": "ListItem", "position": 4, "name": "[Dish Name]", "item": "https://kahramanat.com/ar/menu/[dish-slug]" }
  ]
}
```

---

## MENU_ITEM — Dish Page Schema

```typescript
function getDishSchema(dish: {
  nameAr: string;
  nameEn: string;
  slug: string;
  price?: number;
  categoryAr: string;
  categoryEn: string;
  imageUrl?: string;
  descriptionAr?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "MenuItem",
    "name": dish.nameAr,
    "alternateName": dish.nameEn,
    "url": `https://kahramanat.com/ar/menu/${dish.slug}`,
    // Only add offers if price exists in data layer
    ...(dish.price ? {
      "offers": {
        "@type": "Offer",
        "price": dish.price.toString(),
        "priceCurrency": "BHD",
        "availability": "https://schema.org/InStock"
        // availability: only InStock — never invented
      }
    } : {}),
    // Only add image if confirmed URL
    ...(dish.imageUrl ? { "image": dish.imageUrl } : {}),
    // Only add description if exists in data
    ...(dish.descriptionAr ? { "description": dish.descriptionAr } : {}),
    "suitableForDiet": [],   // DO NOT GUESS — leave empty unless restaurant confirms
    "nutrition": null         // DO NOT INVENT nutrition data
  }
}
```

---

## FAQ — AEO Template

Only use questions answerable from confirmed project data.

```typescript
function getFAQSchema(faqs: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  }
}

// Safe FAQ items (Arabic) — from confirmed data only:
const SAFE_FAQS_AR = [
  {
    question: "أين يقع مطعم كهرمانة بغداد؟",
    answer: "يوجد لمطعم كهرمانة بغداد فرعان في البحرين: فرع الرفاع وفرع قلالي."
  },
  {
    question: "كيف يمكنني الطلب من كهرمانة بغداد؟",
    answer: "يمكنك الطلب عبر واتساب، أو من خلال منصتي طلبات وكيتا."
  },
  {
    question: "هل يقدم كهرمانة بغداد خدمة تموين المناسبات؟",
    answer: "نعم، يقدم كهرمانة بغداد خدمة تموين المناسبات. تواصل معنا للمزيد من التفاصيل."
  },
  {
    question: "ما نوع الطعام الذي يقدمه كهرمانة بغداد؟",
    answer: "يتخصص كهرمانة بغداد في المطبخ العراقي الأصيل — مسكوف، مشاوي فحم، قوزي، ودولمة."
  }
];
```

---

## VALIDATION CHECKLIST before adding any schema

```
□ All field values come from src/constants/contact.ts or src/data/menu.json
□ No undefined values
□ No null for required @type fields
□ No invented openingHours
□ No invented address
□ No invented geo
□ No aggregateRating
□ JSON.parse would not throw
□ @context is exactly "https://schema.org"
□ Script tag type is "application/ld+json"
```
