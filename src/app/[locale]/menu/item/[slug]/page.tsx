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

import { MenuItemSchema } from '@/components/schema/MenuItemSchema'
import { SITE_URL } from '@/constants/contact'

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
  const url = `${BASE}/${locale}/menu/item/${slug}`

  if (!item) return { title: "Not Found" }

  const name = isAr ? item.name.ar : item.name.en
  const description = isAr ? item.description?.ar : item.description?.en
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
      ? `${description || name} — ${priceText}. ${category} في مطعم كهرمانة بغداد العراقي، البحرين.`
      : `${description || name} — ${priceText}. ${category} at Kahramana Baghdad Iraqi Restaurant, Bahrain.`,
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
  const relatedItems = getRelatedItems(item.slug, 3)

  return (
    <main className="min-h-screen bg-brand-black">
      <MenuItemSchema
        nameAr={item.name.ar}
        nameEn={item.name.en}
        descriptionAr={item.description?.ar || ''}
        descriptionEn={item.description?.en || ''}
        price={item.fromPrice}
        priceFrom={item.hasMultiplePrices}
        imageUrl={item.image}
        categoryNameAr={item.categoryName.ar}
        categoryNameEn={item.categoryName.en}
        categorySlug={item.categorySlug}
        slug={item.slug}
        isAvailable={item.available}
        locale={locale as "ar" | "en"}
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
