import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { headers } from 'next/headers'
import { getMenuData, getFeaturedSlugs, type LocaleCode } from '@/lib/menu'
import MenuPageClient from '@/components/menu/MenuPageClient'
import { buildMenuBreadcrumb } from '@/lib/seo/schemas'
import { SITE_URL } from '@/constants/contact'

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as LocaleCode
  const t = await getTranslations({ locale, namespace: 'menu' })

  return {
    title: t('seoTitle'),
    description: t('seoDescription'),
    openGraph: {
      title: t('seoTitle'),
      description: t('seoDescription'),
      images: [{ url: '/assets/hero/hero-menu.webp' }],
    },
    alternates: {
      canonical: locale === 'en' ? '/en/menu' : '/menu',
      languages: { 'x-default': '/menu', ar: '/menu', en: '/en/menu' },
    },
  }
}

export default async function MenuPage() {
  const locale = (await getLocale()) as LocaleCode
  const nonce = (await headers()).get('x-nonce') ?? undefined
  
  const [categories, featuredSlugs] = await Promise.all([
    getMenuData(),
    getFeaturedSlugs(),
  ])

  // Structured Data
  const menuSchema = {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    name: locale === 'ar' ? 'منيو كهرمانة بغداد' : 'Kahramana Baghdad Menu',
    inLanguage: locale === 'ar' ? 'ar-BH' : 'en-BH',
    url: `${SITE_URL}/${locale === 'en' ? 'en/' : ''}menu`,
    isPartOf: { '@id': `${SITE_URL}/#organization` },
    hasMenuSection: categories.map((c) => ({
      '@type': 'MenuSection',
      name: c.nameAR,
      url: `${SITE_URL}/${locale === 'en' ? 'en/' : ''}menu#section-${c.id}`,
    })),
  }

  const breadcrumb = buildMenuBreadcrumb(locale)

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(menuSchema) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <MenuPageClient categories={categories} locale={locale} featuredSlugs={featuredSlugs} />
    </>
  )
}
