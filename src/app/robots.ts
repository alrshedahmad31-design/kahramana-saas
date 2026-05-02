import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/constants/contact'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard/', '/driver/', '/account/', '/login', '/checkout', '/order/', '/_next/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
