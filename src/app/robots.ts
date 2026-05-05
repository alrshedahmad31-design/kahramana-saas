import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/constants/contact'

const PROTECTED_DISALLOW_PATHS: string[] = [
  '/api/',
  '/admin/',
  '/clock',
  '/dashboard/',
  '/ar/dashboard/',
  '/en/dashboard/',
  '/driver/',
  '/ar/driver/',
  '/en/driver/',
  '/account/',
  '/*/account/',
  '/*/account/login',
  '/ar/account/',
  '/en/account/',
  '/forgot-password',
  '/*/forgot-password',
  '/set-password',
  '/*/set-password',
  '/login',
  '/ar/login',
  '/en/login',
  '/checkout',
  '/ar/checkout',
  '/en/checkout',
  '/order/',
  '/ar/order/',
  '/en/order/',
  '/_next/',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: PROTECTED_DISALLOW_PATHS,
      },
      {
        userAgent: [
          'GPTBot',
          'OAI-SearchBot',
          'anthropic-ai',
          'ClaudeBot',
          'Google-Extended',
          'PerplexityBot',
          'Applebot-Extended',
        ],
        allow: '/',
        disallow: PROTECTED_DISALLOW_PATHS,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
