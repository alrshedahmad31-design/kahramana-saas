import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import {
  getItemSlugs,
  getMenuItemBySlug,
  getRelatedItems,
  type LocaleCode,
} from '@/lib/menu'
import dynamic from 'next/dynamic'
const ItemDetailHero = dynamic(() => import('@/components/menu/item-detail-hero'), { ssr: true })
import RelatedItems from '@/components/menu/related-items'
import { buildDishSchema, buildDishBreadcrumb } from '@/lib/seo/schemas'

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
  if (!item) return {}

  const dishName     = locale === 'ar' ? item.name.ar    : item.name.en
  const categoryName = locale === 'ar' ? item.categoryName.ar : item.categoryName.en
  const baseDescription = item.description
    ? locale === 'ar' ? item.description.ar : item.description.en
    : undefined

  // Topical-authority titles: dish + category + brand + region
  const title = locale === 'ar'
    ? `${dishName} — كهرمانة بغداد | مطعم عراقي البحرين`
    : `${dishName} — Kahramana Baghdad | Iraqi Restaurant Bahrain`

  const description = baseDescription
    ?? (locale === 'ar'
      ? `${dishName} من ${categoryName} في كهرمانة بغداد — مطعم عراقي أصيل في البحرين. اطلب الآن من الرفاع أو قلالي.`
      : `${dishName} from ${categoryName} at Kahramana Baghdad — authentic Iraqi restaurant in Bahrain. Order now from Riffa or Qallali.`)

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: item.image }],
      type: 'article',
      locale: locale === 'ar' ? 'ar_BH' : 'en_BH',
    },
    alternates: {
      canonical: locale === 'en' ? `/en/menu/item/${slug}` : `/menu/item/${slug}`,
      languages: {
        'x-default': `/menu/item/${slug}`,
        ar:          `/menu/item/${slug}`,
        en:          `/en/menu/item/${slug}`,
      },
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

  const dishSchema = buildDishSchema(
    {
      slug:           item.slug,
      nameAr:         item.name.ar,
      nameEn:         item.name.en,
      descriptionAr:  item.description?.ar,
      descriptionEn:  item.description?.en,
      imageUrl:       item.image,
      fromPrice:      item.fromPrice,
      available:      item.available,
    },
    locale,
  )

  const breadcrumb = buildDishBreadcrumb(
    locale,
    locale === 'ar' ? item.categoryName.ar : item.categoryName.en,
    item.categorySlug,
    locale === 'ar' ? item.name.ar : item.name.en,
    item.slug,
  )

  return (
    <main className="min-h-screen bg-brand-black">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(dishSchema) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
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
        emptyTitle={t('searchNoResults')}
        emptyHint={t('searchNoResultsHint')}
        outOfStockLabel={t('outOfStock')}
        fromLabel={t('priceFrom')}
        currency={tCommon('currency')}
        isRTL={isRTL}
      />
    </main>
  )
}
