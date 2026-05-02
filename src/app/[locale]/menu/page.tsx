import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getMenuData, getFeaturedSlugs, type LocaleCode } from '@/lib/menu'
import MenuPageClient from '@/components/menu/MenuPageClient'

import { FAQSchema } from '@/components/schema/FAQSchema'
import { MenuPageSchema } from '@/components/schema/MenuPageSchema'
import { SITE_URL } from '@/constants/contact'

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> }
): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === "ar";
  const BASE = SITE_URL;
  const url = `${BASE}/${locale}/menu`;

  return {
    title: isAr
      ? "قائمة كهرمانة بغداد | 168 طبقاً عراقياً أصيلاً في البحرين"
      : "Kahramana Baghdad Menu | 168 Authentic Iraqi Dishes in Bahrain",
    description: isAr
      ? "استكشف قائمة كهرمانة بغداد الكاملة: مشاوي على الفحم، مسكوف عراقي، قوزي، فطور بغدادي، دولمة، شاورما عراقية، وأكثر من 168 طبقاً. مطعم عراقي أصيل في الرفاع وقلالي، البحرين."
      : "Explore Kahramana Baghdad's full menu: charcoal grills, Iraqi Masgouf, Quzi, Baghdadi breakfast, Dolma, Iraqi shawarma, and 168+ dishes. Authentic Iraqi restaurant in Riffa and Qalali, Bahrain.",
    alternates: {
      canonical: url,
      languages: {
        "ar": `${BASE}/ar/menu`,
        "en": `${BASE}/en/menu`,
        "x-default": `${BASE}/ar/menu`,
      },
    },
    openGraph: {
      title: isAr
        ? "قائمة كهرمانة بغداد | مطعم عراقي البحرين"
        : "Kahramana Baghdad Menu | Iraqi Restaurant Bahrain",
      description: isAr
        ? "168 طبقاً عراقياً وخليجياً — مشاوي، مسكوف، قوزي، فطور بغدادي، شاورما"
        : "168 Iraqi & Gulf dishes — grills, Masgouf, Quzi, Baghdadi breakfast, shawarma",
      url,
      images: [{ url: `${BASE}/assets/hero/hero-menu.webp`, width: 1200, height: 630 }],
    },
  };
}

export default async function MenuPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const nonce = (await headers()).get('x-nonce') ?? undefined
  
  const [categories, featuredSlugs] = await Promise.all([
    getMenuData(),
    getFeaturedSlugs(),
  ])

  return (
    <>
      <FAQSchema locale={locale as "ar" | "en"} />
      <MenuPageSchema locale={locale as "ar" | "en"} />
      <MenuPageClient categories={categories} locale={locale as LocaleCode} featuredSlugs={featuredSlugs} />
    </>
  )
}
