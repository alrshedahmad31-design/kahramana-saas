import type { Metadata } from 'next'
import { getMenuData, getFeaturedSlugs, type LocaleCode } from '@/lib/menu'
import MenuPageClient from '@/components/menu/MenuPageClient'

import { SITE_URL } from '@/constants/contact'
import {
  buildFAQSchema,
  buildFullMenuSchema,
  buildMenuWebPageSchema,
  buildMenuBreadcrumb,
  buildHomepageFAQ,
} from '@/lib/seo/schemas'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ q?: string }>
}

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> }
): Promise<Metadata> {
  const { locale } = await params;
  const isAr = locale === "ar";
  const BASE = SITE_URL;
  const url = isAr ? `${BASE}/menu` : `${BASE}/en/menu`;

  return {
    title: isAr
      ? "منيو مطعم كهرمانة بغداد — قائمة الطعام العراقية الأصيلة"
      : "Kahramana Baghdad Menu — Authentic Iraqi Dishes & Grills",
    description: isAr
      ? "تصفح قائمة الطعام الكاملة: مشويات عراقية، مسكوف، قوزي، وفطور بغدادي. أكثر من 168 طبقاً متوفرة في فروعنا بالبحرين."
      : "Explore our full menu: Iraqi grills, Masgouf, Quzi, and Baghdadi breakfast. Over 168 authentic dishes available at our branches in Bahrain.",
    alternates: {
      canonical: url,
      languages: {
        'ar-BH':     `${BASE}/menu`,
        'en-BH':     `${BASE}/en/menu`,
        'x-default': `${BASE}/menu`,
      },
    },
    openGraph: {
      title: isAr
        ? "قائمة طعام كهرمانة بغداد | المذاق العراقي في البحرين"
        : "Kahramana Baghdad Menu | Authentic Iraqi Taste in Bahrain",
      description: isAr
        ? "اكتشف تشكيلة واسعة من الأطباق العراقية الأصيلة والمشويات على الفحم."
        : "Discover a wide range of authentic Iraqi dishes and charcoal grills.",
      url,
      images: [{ url: `${BASE}/assets/hero/hero-menu.webp`, width: 1200, height: 630 }],
    },
  };
}

export default async function MenuPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { q } = await searchParams
  const localeKey = locale as 'ar' | 'en'
  const [categories, featuredSlugs] = await Promise.all([
    getMenuData(),
    getFeaturedSlugs(),
  ])

  // SEO Schemas
  const faqSchema     = buildFAQSchema(buildHomepageFAQ(localeKey))
  const menuSchema    = buildFullMenuSchema(categories, localeKey)
  const webPageSchema = buildMenuWebPageSchema(localeKey)
  const breadcrumb    = buildMenuBreadcrumb(localeKey)

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(menuSchema) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageSchema) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />

      <MenuPageClient 
        categories={categories} 
        locale={locale as LocaleCode} 
        featuredSlugs={featuredSlugs} 
        initialQuery={q}
      />
    </>
  )
}
