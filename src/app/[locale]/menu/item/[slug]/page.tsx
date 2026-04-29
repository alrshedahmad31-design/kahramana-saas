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

  const title = locale === 'ar' ? item.name.ar : item.name.en
  const description = item.description
    ? locale === 'ar'
      ? item.description.ar
      : item.description.en
    : undefined

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: item.image }],
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

  const schemaOrg = {
    '@context': 'https://schema.org',
    '@type': 'MenuItem',
    name: item.name.en,
    description: item.description?.en ?? '',
    image: item.image,
    offers: {
      '@type': 'Offer',
      price: item.fromPrice.toFixed(3),
      priceCurrency: 'BHD',
      availability: item.available
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  }

  return (
    <main className="min-h-screen bg-brand-black">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }}
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
