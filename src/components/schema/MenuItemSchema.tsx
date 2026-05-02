import { SITE_URL } from '@/constants/contact'

interface MenuItemSchemaProps {
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  price: number | null;       // numeric, e.g. 9.000
  priceFrom?: boolean;        // true if "من X BD"
  imageUrl: string;           // full URL
  categoryNameAr: string;
  categoryNameEn: string;
  categorySlug: string;
  slug: string;
  isAvailable: boolean;
  locale: "ar" | "en";
}

export function MenuItemSchema({
  nameAr, nameEn, descriptionAr, descriptionEn,
  price, imageUrl,
  categoryNameAr, categoryNameEn, categorySlug,
  slug, isAvailable, locale
}: MenuItemSchemaProps) {
  const itemUrl = `${SITE_URL}/${locale}/menu/item/${slug}`;
  
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      // ── MENU ITEM ────────────────────────────────────────────────────
      {
        "@type": "MenuItem",
        "@id": `${SITE_URL}/#item-${slug}`,
        "name": locale === "ar" ? nameAr : nameEn,
        "alternateName": locale === "ar" ? nameEn : nameAr,
        "description": locale === "ar" ? descriptionAr : descriptionEn,
        "image": {
          "@type": "ImageObject",
          "url": imageUrl.startsWith('http') ? imageUrl : `${SITE_URL}${imageUrl}`,
          "description": locale === "ar"
            ? `${nameAr} — مطعم كهرمانة بغداد العراقي في البحرين`
            : `${nameEn} — Kahramana Baghdad Iraqi Restaurant Bahrain`
        },
        "offers": price ? {
          "@type": "Offer",
          "price": price.toFixed(3),
          "priceCurrency": "BHD",
          "availability": isAvailable
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          "priceSpecification": {
            "@type": "PriceSpecification",
            "minPrice": price.toFixed(3),
            "priceCurrency": "BHD"
          }
        } : undefined,
        "suitableForDiet": [
          "https://schema.org/HalalDiet"
        ],
        "inMenu": {
          "@type": "Menu",
          "@id": `${SITE_URL}/menu`,
          "url": `${SITE_URL}/menu`
        },
        "inMenuSection": {
          "@type": "MenuSection",
          "name": locale === "ar" ? categoryNameAr : categoryNameEn,
          "url": `${SITE_URL}/${locale}/menu/${categorySlug}`
        },
        "hasMenuSection": {
          "@id": `${SITE_URL}/#restaurant`
        },
        "url": itemUrl
      },

      // ── WEBPAGE ──────────────────────────────────────────────────────
      {
        "@type": "WebPage",
        "@id": `${itemUrl}#webpage`,
        "url": itemUrl,
        "name": locale === "ar"
          ? `${nameAr} — كهرمانة بغداد | مطعم عراقي البحرين`
          : `${nameEn} — Kahramana Baghdad | Iraqi Restaurant Bahrain`,
        "description": locale === "ar" ? descriptionAr : descriptionEn,
        "isPartOf": { "@id": `${SITE_URL}/#website` },
        "breadcrumb": { "@id": `${itemUrl}#breadcrumb` }
      },

      // ── BREADCRUMB ───────────────────────────────────────────────────
      {
        "@type": "BreadcrumbList",
        "@id": `${itemUrl}#breadcrumb`,
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": locale === "ar" ? "الرئيسية" : "Home",
            "item": `${SITE_URL}/${locale}`
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": locale === "ar" ? "قائمة الطعام" : "Menu",
            "item": `${SITE_URL}/${locale}/menu`
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": locale === "ar" ? categoryNameAr : categoryNameEn,
            "item": `${SITE_URL}/${locale}/menu/${categorySlug}`
          },
          {
            "@type": "ListItem",
            "position": 4,
            "name": locale === "ar" ? nameAr : nameEn,
            "item": itemUrl
          }
        ]
      }
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema, null, 0) }}
    />
  );
}
