import { BRANCH_LIST, GENERAL_CONTACT, SITE_URL } from '@/constants/contact'

export function RestaurantSchema() {
  const riffa = BRANCH_LIST.find(b => b.id === 'riffa')
  const qallali = BRANCH_LIST.find(b => b.id === 'qallali')

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      // ── PRIMARY ENTITY ──────────────────────────────────────────────
      {
        "@type": "Restaurant",
        "@id": `${SITE_URL}/#restaurant`,
        "name": "كهرمانة بغداد",
        "alternateName": ["Kahramana Baghdad", "Kahramana", "كهرمانة"],
        "description": "مطعم عراقي أصيل في البحرين يقدم أشهى الأطباق البغدادية من مسكوف ومشاوي وقوزي وفطور عراقي وشاورما عراقية. Iraqi restaurant in Bahrain serving authentic Baghdadi cuisine.",
        "url": SITE_URL,
        "telephone": GENERAL_CONTACT.email ? undefined : "+97317131413", // Fallback phone
        "email": GENERAL_CONTACT.email,
        "logo": {
          "@type": "ImageObject",
          "url": `${SITE_URL}/assets/logo.svg`,
          "width": 200,
          "height": 80
        },
        "image": [
          `${SITE_URL}/assets/hero/hero-menu.webp`
        ],
        "servesCuisine": [
          "Iraqi", "Baghdadi", "Middle Eastern", "Arabic", "Grills",
          "مأكولات عراقية", "مشويات", "مأكولات بغدادية", "مأكولات شرق أوسطية",
          "فطور عراقي", "شاورما", "مأكولات خليجية"
        ],
        "priceRange": "$$",
        "currenciesAccepted": "BHD",
        "paymentAccepted": "Cash, Credit Card, Debit Card",
        "hasMenu": {
          "@type": "Menu",
          "@id": `${SITE_URL}/menu`,
          "name": "قائمة كهرمانة بغداد",
          "description": "168 طبقاً عراقياً وخليجياً أصيلاً",
          "url": `${SITE_URL}/menu`
        },
        "areaServed": [
          { "@type": "City", "name": "Manama", "alternateName": "المنامة" },
          { "@type": "City", "name": "Riffa", "alternateName": "الرفاع" },
          { "@type": "City", "name": "Muharraq", "alternateName": "المحرق" },
          { "@type": "Country", "name": "Bahrain", "alternateName": "البحرين" }
        ],
        "sameAs": [
          GENERAL_CONTACT.instagram,
          GENERAL_CONTACT.tiktok,
          GENERAL_CONTACT.facebook,
          "https://wa.me/97317131413"
        ],
        "keywords": "مطعم عراقي البحرين, Iraqi restaurant Bahrain, مسكوف البحرين, مشاوي البحرين, قوزي, فطور بغدادي, شاورما عراقية, مطعم كهرمانة, Kahramana Baghdad Bahrain, food Bahrain, restaurant Bahrain"
      },

      // ── BRANCH 1: RIFFA ─────────────────────────────────────────────
      riffa ? {
        "@type": "Restaurant",
        "@id": `${SITE_URL}/#branch-riffa`,
        "name": "كهرمانة بغداد — فرع الرفاع",
        "alternateName": "Kahramana Baghdad Riffa Branch",
        "parentOrganization": { "@id": `${SITE_URL}/#restaurant` },
        "url": `${SITE_URL}/branches/riffa`,
        "telephone": riffa.phone,
        "address": {
          "@type": "PostalAddress",
          "streetAddress": riffa.addressEn,
          "addressLocality": riffa.cityEn,
          "addressRegion": "Southern Governorate",
          "addressCountry": "BH"
        },
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": riffa.latitude,
          "longitude": riffa.longitude
        },
        "openingHoursSpecification": [
          {
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": [
              "Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"
            ],
            "opens": riffa.hours.opens,
            "closes": riffa.hours.closes
          }
        ],
        "servesCuisine": ["Iraqi", "Middle Eastern", "مأكولات عراقية"],
        "priceRange": "$$",
        "hasMap": riffa.mapsUrl
      } : null,

      // ── BRANCH 2: QALLALI ────────────────────────────────────────────
      qallali ? {
        "@type": "Restaurant",
        "@id": `${SITE_URL}/#branch-qallali`,
        "name": "كهرمانة بغداد — فرع قلالي",
        "alternateName": "Kahramana Baghdad Qallali Branch",
        "parentOrganization": { "@id": `${SITE_URL}/#restaurant` },
        "url": `${SITE_URL}/branches/qallali`,
        "telephone": qallali.phone,
        "address": {
          "@type": "PostalAddress",
          "streetAddress": qallali.addressEn,
          "addressLocality": qallali.cityEn,
          "addressRegion": "Muharraq Governorate",
          "addressCountry": "BH"
        },
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": qallali.latitude,
          "longitude": qallali.longitude
        },
        "openingHoursSpecification": [
          {
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": [
              "Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"
            ],
            "opens": qallali.hours.opens,
            "closes": qallali.hours.closes
          }
        ],
        "servesCuisine": ["Iraqi", "Middle Eastern", "مأكولات عراقية"],
        "priceRange": "$$",
        "hasMap": qallali.mapsUrl
      } : null,

      // ── WEBSITE ENTITY ───────────────────────────────────────────────
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        "url": SITE_URL,
        "name": "كهرمانة بغداد | Kahramana Baghdad",
        "description": "الموقع الرسمي لمطعم كهرمانة بغداد — أصيل مأكولات عراقية في البحرين",
        "inLanguage": ["ar", "en"],
        "publisher": { "@id": `${SITE_URL}/#restaurant` },
        "potentialAction": {
          "@type": "SearchAction",
          "target": {
            "@type": "EntryPoint",
            "urlTemplate": `${SITE_URL}/menu?q={search_term_string}`
          },
          "query-input": "required name=search_term_string"
        }
      }
    ].filter(Boolean)
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema, null, 0) }}
    />
  );
}
