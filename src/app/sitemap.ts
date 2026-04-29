import type { MetadataRoute } from 'next'
import { GENERAL_CONTACT } from '@/constants/contact'
import { getCategorySlugs, getItemSlugs } from '@/lib/menu'

const BASE_URL = GENERAL_CONTACT.website

// ── Helpers ───────────────────────────────────────────────────────────────────

function url(path: string): string {
  return `${BASE_URL}${path}`
}

function alternates(arPath: string, enPath: string) {
  return {
    languages: {
      'x-default': url(arPath),
      ar:          url(arPath),
      en:          url(enPath),
    },
  }
}

// ── Sitemap ───────────────────────────────────────────────────────────────────

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  // ── Static pages ──────────────────────────────────────────────────────────

  const staticPages: MetadataRoute.Sitemap = [
    {
      url:             url('/'),
      lastModified:    now,
      changeFrequency: 'weekly',
      priority:        1.0,
      alternates:      alternates('/', '/en'),
    },
    {
      url:             url('/menu'),
      lastModified:    now,
      changeFrequency: 'weekly',
      priority:        0.9,
      alternates:      alternates('/menu', '/en/menu'),
    },
    {
      url:             url('/about'),
      lastModified:    now,
      changeFrequency: 'monthly',
      priority:        0.6,
      alternates:      alternates('/about', '/en/about'),
    },
    {
      url:             url('/branches'),
      lastModified:    now,
      changeFrequency: 'monthly',
      priority:        0.7,
      alternates:      alternates('/branches', '/en/branches'),
    },
    {
      url:             url('/contact'),
      lastModified:    now,
      changeFrequency: 'yearly',
      priority:        0.5,
      alternates:      alternates('/contact', '/en/contact'),
    },
    {
      url:             url('/catering'),
      lastModified:    now,
      changeFrequency: 'monthly',
      priority:        0.7,
      alternates:      alternates('/catering', '/en/catering'),
    },
    {
      url:             url('/privacy'),
      lastModified:    now,
      changeFrequency: 'yearly',
      priority:        0.2,
      alternates:      alternates('/privacy', '/en/privacy'),
    },
    {
      url:             url('/terms'),
      lastModified:    now,
      changeFrequency: 'yearly',
      priority:        0.2,
      alternates:      alternates('/terms', '/en/terms'),
    },
    {
      url:             url('/refund-policy'),
      lastModified:    now,
      changeFrequency: 'yearly',
      priority:        0.2,
      alternates:      alternates('/refund-policy', '/en/refund-policy'),
    },
  ]

  // ── Menu category pages ───────────────────────────────────────────────────

  const categoryPages: MetadataRoute.Sitemap = getCategorySlugs().map((slug) => ({
    url:             url(`/menu/${slug}`),
    lastModified:    now,
    changeFrequency: 'weekly' as const,
    priority:        0.8,
    alternates:      alternates(`/menu/${slug}`, `/en/menu/${slug}`),
  }))

  // ── Dish detail pages — canonical at /menu/item/{slug} ───────────────────

  const dishPages: MetadataRoute.Sitemap = getItemSlugs().map((slug) => ({
    url:             url(`/menu/item/${slug}`),
    lastModified:    now,
    changeFrequency: 'monthly' as const,
    priority:        0.7,
    alternates:      alternates(`/menu/item/${slug}`, `/en/menu/item/${slug}`),
  }))

  return [...staticPages, ...categoryPages, ...dishPages]
}
