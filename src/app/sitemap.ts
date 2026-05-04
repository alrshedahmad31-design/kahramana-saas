import type { MetadataRoute } from 'next'
import { BRANCH_LIST, SITE_URL } from '@/constants/contact'
import { getMenuCategories, getAllMenuItems } from '@/lib/menu'

const BASE_URL = SITE_URL
const LOCALES = ['ar', 'en'] as const

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const staticRoutes = [
    { path: '',          priority: 1.0,  changeFrequency: 'weekly' as const },
    { path: '/menu',     priority: 0.95, changeFrequency: 'weekly' as const },
    { path: '/branches', priority: 0.85, changeFrequency: 'monthly' as const },
    { path: '/about',    priority: 0.75, changeFrequency: 'monthly' as const },
    { path: '/contact',  priority: 0.75, changeFrequency: 'monthly' as const },
    { path: '/catering', priority: 0.80, changeFrequency: 'monthly' as const },
    { path: '/refund-policy', priority: 0.30, changeFrequency: 'yearly' as const },
  ]

  const staticUrls: MetadataRoute.Sitemap = LOCALES.flatMap((locale) =>
    staticRoutes.map(({ path, priority, changeFrequency }) => ({
      url: locale === 'ar' ? `${BASE_URL}${path}` : `${BASE_URL}/en${path}`,
      lastModified: now,
      changeFrequency,
      priority,
      alternates: {
        languages: {
          ar: `${BASE_URL}${path}`,
          en: `${BASE_URL}/en${path}`,
        },
      },
    }))
  )

  const branchUrls: MetadataRoute.Sitemap = BRANCH_LIST
    .filter((b) => b.status === 'active')
    .flatMap((branch) =>
      LOCALES.map((locale) => ({
        url: locale === 'ar' ? `${BASE_URL}/branches/${branch.id}` : `${BASE_URL}/en/branches/${branch.id}`,
        lastModified: now,
        changeFrequency: 'monthly' as const,
        priority: 0.85,
        alternates: {
          languages: {
            ar: `${BASE_URL}/branches/${branch.id}`,
            en: `${BASE_URL}/en/branches/${branch.id}`,
          },
        },
      }))
    )

  const categories = getMenuCategories()
  const categoryUrls: MetadataRoute.Sitemap = categories.flatMap((cat) =>
    LOCALES.map((locale) => ({
      url: locale === 'ar' ? `${BASE_URL}/menu/${cat.slug}` : `${BASE_URL}/en/menu/${cat.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.75,
      alternates: {
        languages: {
          ar: `${BASE_URL}/menu/${cat.slug}`,
          en: `${BASE_URL}/en/menu/${cat.slug}`,
        },
      },
    }))
  )

  const items = getAllMenuItems()
  const itemUrls: MetadataRoute.Sitemap = items.flatMap((item) =>
    LOCALES.map((locale) => ({
      url: locale === 'ar' ? `${BASE_URL}/menu/item/${item.slug}` : `${BASE_URL}/en/menu/item/${item.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.80,
      alternates: {
        languages: {
          ar: `${BASE_URL}/menu/item/${item.slug}`,
          en: `${BASE_URL}/en/menu/item/${item.slug}`,
        },
      },
    }))
  )

  return [...staticUrls, ...branchUrls, ...categoryUrls, ...itemUrls]
}
