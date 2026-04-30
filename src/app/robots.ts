import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/constants/contact'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard/',
          '/ar/dashboard/',
          '/en/dashboard/',
          '/driver/',
          '/ar/driver/',
          '/en/driver/',
          '/account/',
          '/ar/account/',
          '/en/account/',
          '/login',
          '/ar/login',
          '/en/login',
          '/checkout',
          '/ar/checkout',
          '/en/checkout',
          '/order/',
          '/ar/order/',
          '/en/order/',
          '/api/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host:    SITE_URL,
  }
}
