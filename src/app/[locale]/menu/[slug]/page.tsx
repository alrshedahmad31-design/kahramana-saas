import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { headers } from 'next/headers'
import {
  getCategorySlugs,
  getAllMenuItems,
  getMenuCategories,
  getMenuCategoryBySlug,
  getMenuItemBySlug,
  type LocaleCode,
} from '@/lib/menu'
import { getMenuAvailabilityMap } from '@/lib/menu.server'
import nextDynamic from 'next/dynamic'
const MenuExperience = nextDynamic(() => import('@/components/menu/menu-experience'), { ssr: true })
import MenuHero from '@/components/menu/menu-hero'
import { buildCategoryBreadcrumb } from '@/lib/seo/schemas'

type Props = {
  params: Promise<{
    locale: LocaleCode
    slug: string
  }>
}

// Force dynamic rendering so the customer menu reflects the dashboard's
// is_available toggle without waiting for a redeploy. The page payload is
// small; a fresh DB read per request is acceptable here.
export const dynamic = 'force-dynamic'

export function generateStaticParams() {
  return getCategorySlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const category = getMenuCategoryBySlug(slug)

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
        'ar-BH':     `/menu/${slug}`,
        'en-BH':     `/en/menu/${slug}`,
      },
    },
  }
}

async function mergeAvailability<T extends { slug: string; available: boolean }>(
  items: T[],
): Promise<T[]> {
  const map = await getMenuAvailabilityMap()
  if (map.size === 0) return items
  return items.map((item) =>
    map.has(item.slug) ? { ...item, available: map.get(item.slug)! } : item,
  )
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
  const categoryName = isRTL ? category.name.ar : category.name.en


  const breadcrumb = buildCategoryBreadcrumb(
    locale,
    categoryName,
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
        titleOverride={categoryName}
        descriptionOverride={
          category.description
            ? isRTL
              ? category.description.ar
              : category.description.en
            : t('categoryFallbackDescription', { category: categoryName })
        }
      />
      <MenuExperience
        categories={getMenuCategories()}
        items={await mergeAvailability(getAllMenuItems())}
        initialCategory={slug}
        isRTL={isRTL}
      />
    </main>
  )
}
