import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { headers } from 'next/headers'
import {
  getAllMenuItems,
  getMenuCategories,
  type LocaleCode,
} from '@/lib/menu'
import dynamic from 'next/dynamic'
const MenuExperience = dynamic(() => import('@/components/menu/menu-experience'), { ssr: true })
import MenuHero from '@/components/menu/menu-hero'
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
  const isRTL = locale === 'ar'
  const nonce = (await headers()).get('x-nonce') ?? undefined
  const t = await getTranslations({ locale, namespace: 'menu' })

  const categories = getMenuCategories()
  const items = getAllMenuItems()

  const menuSchema = {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    name: locale === 'ar' ? 'منيو كهرمانة بغداد' : 'Kahramana Baghdad Menu',
    inLanguage: locale === 'ar' ? 'ar-BH' : 'en-BH',
    url: `${SITE_URL}/${locale === 'en' ? 'en/' : ''}menu`,
    isPartOf: { '@id': `${SITE_URL}/#organization` },
    hasMenuSection: categories.map((c) => ({
      '@type': 'MenuSection',
      name: locale === 'ar' ? c.name.ar : c.name.en,
      url:  `${SITE_URL}/${locale === 'en' ? 'en/' : ''}menu/${c.slug}`,
    })),
  }

  const breadcrumb = buildMenuBreadcrumb(locale)

  return (
    <main className="min-h-screen bg-brand-black">
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
      <MenuHero
        eyebrow={t('heroEyebrow')}
        title={t('heroTitle')}
        description={t('heroDescription')}
        itemCountLabel={t('heroItemCount', { count: items.length })}
        categoryCountLabel={t('heroCategoryCount', { count: categories.length })}
        imageAlt={t('heroImageAlt')}
        isRTL={isRTL}
      />
      <MenuExperience categories={categories} items={items} isRTL={isRTL} />
    </main>
  )
}
