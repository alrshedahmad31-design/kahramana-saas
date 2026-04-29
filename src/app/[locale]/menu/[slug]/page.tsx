import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { headers } from 'next/headers'
import {
  getCategorySlugs,
  getAllMenuItems,
  getItemsByCategory,
  getItemSlugs,
  getMenuCategories,
  getMenuCategoryBySlug,
  getMenuItemBySlug,
  type LocaleCode,
} from '@/lib/menu'
import dynamic from 'next/dynamic'
const MenuExperience = dynamic(() => import('@/components/menu/menu-experience'), { ssr: true })
import MenuHero from '@/components/menu/menu-hero'
import { buildCategoryBreadcrumb } from '@/lib/seo/schemas'

type Props = {
  params: Promise<{
    locale: LocaleCode
    slug: string
  }>
}

export function generateStaticParams() {
  return [
    ...getCategorySlugs().map((slug) => ({ slug })),
    ...getItemSlugs().map((slug) => ({ slug })),
  ]
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const category = getMenuCategoryBySlug(slug)
  const item = getMenuItemBySlug(slug)

  if (item && !category) {
    const itemPath =
      locale === 'ar' ? `/menu/item/${item.slug}` : `/en/menu/item/${item.slug}`
    return {
      alternates: {
        canonical: itemPath,
      },
      robots: {
        index: false,
        follow: true,
      },
    }
  }

  if (!category) return {}

  const t = await getTranslations({ locale, namespace: 'menu' })
  const title = t('categorySeoTitle', {
    category: locale === 'ar' ? category.name.ar : category.name.en,
  })
  const description =
    category.description?.[locale] ??
    t('categorySeoDescription', {
      category: locale === 'ar' ? category.name.ar : category.name.en,
    })

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: '/assets/hero/hero-menu.webp' }],
    },
    alternates: {
      canonical: locale === 'en' ? `/en/menu/${slug}` : `/menu/${slug}`,
      languages: {
        'x-default': `/menu/${slug}`,
        ar:          `/menu/${slug}`,
        en:          `/en/menu/${slug}`,
      },
    },
  }
}

export default async function MenuCategoryPage({ params }: Props) {
  const { locale, slug } = await params
  const category = getMenuCategoryBySlug(slug)

  if (!category) {
    const item = getMenuItemBySlug(slug)
    if (item) {
      redirect(locale === 'ar' ? `/menu/item/${item.slug}` : `/en/menu/item/${item.slug}`)
    }
    notFound()
  }

  const isRTL = locale === 'ar'
  const nonce = (await headers()).get('x-nonce') ?? undefined
  const t = await getTranslations({ locale, namespace: 'menu' })
  const categoryItems = getItemsByCategory(slug)

  const breadcrumb = buildCategoryBreadcrumb(
    locale,
    isRTL ? category.name.ar : category.name.en,
    slug,
  )

  return (
    <main className="min-h-screen bg-brand-black">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <MenuHero
        eyebrow={t('categoryEyebrow')}
        title={isRTL ? category.name.ar : category.name.en}
        description={
          category.description
            ? isRTL
              ? category.description.ar
              : category.description.en
            : t('categoryFallbackDescription')
        }
        itemCountLabel={t('heroItemCount', { count: categoryItems.length })}
        categoryCountLabel={t('categorySingleLabel')}
        imageAlt={t('heroImageAlt')}
        isRTL={isRTL}
      />
      <MenuExperience
        categories={getMenuCategories()}
        items={getAllMenuItems()}
        initialCategory={slug}
        isRTL={isRTL}
      />
    </main>
  )
}
