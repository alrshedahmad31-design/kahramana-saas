import { SITE_URL } from '@/constants/contact'

export function MenuPageSchema({ locale }: { locale: "ar" | "en" }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Menu",
    "@id": `${SITE_URL}/menu`,
    "name": locale === "ar"
      ? "قائمة كهرمانة بغداد — 168 طبقاً عراقياً"
      : "Kahramana Baghdad Menu — 168 Iraqi Dishes",
    "description": locale === "ar"
      ? "قائمة كهرمانة بغداد الكاملة: مشويات، فطور بغدادي، مسكوف، قوزي، شاورما عراقية، أطباق رئيسية خليجية وعراقية — مطعم عراقي أصيل في البحرين."
      : "Complete Kahramana Baghdad menu: grills, Baghdadi breakfast, Masgouf, Quzi, Iraqi shawarma, Gulf and Iraqi main dishes — authentic Iraqi restaurant in Bahrain.",
    "url": `${SITE_URL}/${locale}/menu`,
    "inLanguage": locale,
    "provider": {
      "@id": `${SITE_URL}/#restaurant`
    },
    "hasMenuSection": [
      { "@type": "MenuSection", "name": locale === "ar" ? "مختارات كهرمانة" : "Kahramana Specials" },
      { "@type": "MenuSection", "name": locale === "ar" ? "الفطور البغدادي" : "Baghdadi Breakfast" },
      { "@type": "MenuSection", "name": locale === "ar" ? "المقبلات الباردة" : "Cold Appetizers" },
      { "@type": "MenuSection", "name": locale === "ar" ? "المقبلات الساخنة" : "Hot Appetizers" },
      { "@type": "MenuSection", "name": locale === "ar" ? "السلطات" : "Salads" },
      { "@type": "MenuSection", "name": locale === "ar" ? "الشوربات" : "Soups" },
      { "@type": "MenuSection", "name": locale === "ar" ? "الأطباق الرئيسية" : "Main Dishes" },
      { "@type": "MenuSection", "name": locale === "ar" ? "المرق العراقي" : "Iraqi Stews" },
      { "@type": "MenuSection", "name": locale === "ar" ? "الفتّة" : "Fatteh" },
      { "@type": "MenuSection", "name": locale === "ar" ? "المشويات والتنور" : "Grills & Tandoor" },
      { "@type": "MenuSection", "name": locale === "ar" ? "الشاورما العراقية" : "Iraqi Shawarma" },
      { "@type": "MenuSection", "name": locale === "ar" ? "بيتزا كهرمانة" : "Kahramana Pizza" },
      { "@type": "MenuSection", "name": locale === "ar" ? "السندويتشات" : "Sandwiches" },
      { "@type": "MenuSection", "name": locale === "ar" ? "الحلويات" : "Desserts" },
      { "@type": "MenuSection", "name": locale === "ar" ? "العصائر الطازجة" : "Fresh Juices" },
      { "@type": "MenuSection", "name": locale === "ar" ? "الشاي والقهوة" : "Tea & Coffee" }
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema, null, 0) }}
    />
  );
}
