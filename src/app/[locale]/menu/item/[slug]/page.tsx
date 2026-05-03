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
  buildDishSchema,
  buildBreadcrumb,
} from '@/lib/seo/schemas'

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
  const url = locale === 'ar'
    ? `${BASE}/menu/item/${slug}`
    : `${BASE}/en/menu/item/${slug}`

  if (!item) return { title: "Not Found" }

  const name = isAr ? item.name.ar : item.name.en
  const description = (isAr ? item.description?.ar : item.description?.en) || name
  const category = isAr ? item.categoryName.ar : item.categoryName.en
  const priceText = item.fromPrice
    ? isAr
      ? `${item.hasMultiplePrices ? "من " : ""}${item.fromPrice.toFixed(3)} دينار بحريني`
      : `${item.hasMultiplePrices ? "From " : ""}${item.fromPrice.toFixed(3)} BHD`
    : ""

  const title = isAr
    ? `${name} — كهرمانة بغداد | أفضل مطعم عراقي البحرين`
    : `${name} — Kahramana Baghdad | Best Iraqi Restaurant Bahrain`

  return {
    title,
    description: isAr
      ? `${description} — ${priceText}. ${category} في مطعم كهرمانة بغداد العراقي، البحرين.`.slice(0, 155)
      : `${description} — ${priceText}. ${category} at Kahramana Baghdad Iraqi Restaurant, Bahrain.`.slice(0, 155),
    alternates: {
      canonical: url,
      languages: {
        'ar-BH':     `${BASE}/menu/item/${slug}`,
        'en-BH':     `${BASE}/en/menu/item/${slug}`,
        'x-default': `${BASE}/menu/item/${slug}`,
      },
    },
    openGraph: {
      title,
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
  
  const itemSchema = buildDishSchema({
    slug: item.slug,
    nameAr: item.name.ar,
    nameEn: item.name.en,
    descriptionAr: item.description?.ar,
    descriptionEn: item.description?.en,
    imageUrl: item.image.startsWith('http') ? item.image : `${SITE_URL}${item.image}`,
    fromPrice: item.fromPrice,
    available: item.available,
  }, locale)

  const breadcrumbSchema = buildBreadcrumb([
    { name: isRTL ? 'الرئيسية' : 'Home', url: isRTL ? '/' : '/en' },
    { name: isRTL ? 'قائمة الطعام' : 'Menu', url: isRTL ? '/menu' : '/en/menu' },
    { name: isRTL ? item.categoryName.ar : item.categoryName.en, url: isRTL ? `/menu/${item.categorySlug}` : `/en/menu/${item.categorySlug}` },
    { name: isRTL ? item.name.ar : item.name.en, url: isRTL ? `/menu/item/${item.slug}` : `/en/menu/item/${item.slug}` },
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
