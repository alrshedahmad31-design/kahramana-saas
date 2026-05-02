import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { headers } from 'next/headers'
import {
  getItemSlugs,
  getMenuItemBySlug,
  getRelatedItems,
  type LocaleCode,
} from '@/lib/menu'
import dynamic from 'next/dynamic'
const ItemDetailHero = dynamic(() => import('@/components/menu/item-detail-hero'), { ssr: true })
import RelatedItems from '@/components/menu/related-items'

import { SITE_URL } from '@/constants/contact'
import {
  generateBreadcrumbSchema,
  generateMenuItemSchema,
} from '@/lib/seo/schema'

type Props = {
  params: Promise<{
    locale: LocaleCode
    slug: string
  }>
}

export function generateStaticParams() {
  return getItemSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const item = getMenuItemBySlug(slug)
  const isAr = locale === 'ar'
  const BASE = SITE_URL
  const url = `${BASE}/ar/menu/item/${slug}`

  if (!item) return { title: "Not Found" }

  const name = isAr ? item.name.ar : item.name.en
  const description = (isAr ? item.description?.ar : item.description?.en) || name
  const category = isAr ? item.categoryName.ar : item.categoryName.en
  const priceText = item.fromPrice
    ? isAr
      ? `${item.hasMultiplePrices ? "من " : ""}${item.fromPrice.toFixed(3)} دينار بحريني`
      : `${item.hasMultiplePrices ? "From " : ""}${item.fromPrice.toFixed(3)} BHD`
    : ""

  return {
    title: isAr
      ? `${name} | كهرمانة بغداد — مطعم عراقي البحرين`
      : `${name} | Kahramana Baghdad — Iraqi Restaurant Bahrain`,
    description: isAr
      ? `${description} — ${priceText}. ${category} في مطعم كهرمانة بغداد العراقي، البحرين.`.slice(0, 155)
      : `${description} — ${priceText}. ${category} at Kahramana Baghdad Iraqi Restaurant, Bahrain.`.slice(0, 155),
    alternates: {
      canonical: url,
      languages: {
        "ar": `${BASE}/ar/menu/item/${slug}`,
        "en": `${BASE}/en/menu/item/${slug}`,
        "x-default": `${BASE}/ar/menu/item/${slug}`,
      },
    },
    openGraph: {
      title: isAr
        ? `${name} — كهرمانة بغداد | مطعم عراقي البحرين`
        : `${name} — Kahramana Baghdad | Iraqi Restaurant Bahrain`,
      description: isAr
        ? `${(description || name).substring(0, 120)}... ${priceText}`
        : `${(description || name).substring(0, 120)}... ${priceText}`,
      url,
      images: [
        {
          url: item.image.startsWith("http")
            ? item.image
            : `${BASE}${item.image}`,
          width: 1200,
          height: 630,
          alt: isAr
            ? `${name} — مطعم كهرمانة بغداد العراقي في البحرين`
            : `${name} — Kahramana Baghdad Iraqi Restaurant Bahrain`,
        },
      ],
    },
  }
}

export default async function MenuItemPage({ params }: Props) {
  const { locale, slug } = await params
  const item = getMenuItemBySlug(slug)
  if (!item) notFound()

  const isRTL = locale === 'ar'
  const t = await getTranslations({ locale, namespace: 'menu' })
  const tCommon = await getTranslations({ locale, namespace: 'common' })
  const nonce = (await headers()).get('x-nonce') ?? undefined
  const relatedItems = getRelatedItems(item.slug, 3)
  const itemSchema = generateMenuItemSchema({
    name_ar: item.name.ar,
    name_en: item.name.en,
    description_ar: item.description?.ar || item.name.ar,
    price: item.fromPrice,
    image_url: item.image,
    slug: item.slug,
    category_ar: item.categoryName.ar,
  })
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'الرئيسية', url: `${SITE_URL}/ar` },
    { name: 'قائمة الطعام', url: `${SITE_URL}/ar/menu` },
    { name: item.categoryName.ar, url: `${SITE_URL}/ar/menu#${item.categorySlug}` },
    { name: item.name.ar, url: `${SITE_URL}/ar/menu/item/${item.slug}` },
  ])

  return (
    <main className="min-h-screen bg-brand-black">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemSchema) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <ItemDetailHero
        item={item}
        backLabel={t('breadcrumbLabel')}
        homeLabel={t('homeLabel')}
        menuLabel={t('title')}
        outOfStockLabel={t('outOfStock')}
        unavailableLabel={t('unavailableDetail')}
        fromLabel={t('priceFrom')}
        currency={tCommon('currency')}
        isRTL={isRTL}
      />
      <RelatedItems
        items={relatedItems}
        title={t('relatedTitle')}
        locale={locale}
      />
    </main>
  )
}
