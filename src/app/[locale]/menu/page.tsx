import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import {
  getAllMenuItems,
  getMenuCategories,
  type LocaleCode,
} from '@/lib/menu'
import dynamic from 'next/dynamic'
const MenuExperience = dynamic(() => import('@/components/menu/menu-experience'), { ssr: true })
import MenuHero from '@/components/menu/menu-hero'

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
  const t = await getTranslations({ locale, namespace: 'menu' })

  const categories = getMenuCategories()
  const items = getAllMenuItems()

  return (
    <main className="min-h-screen bg-brand-black">
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
