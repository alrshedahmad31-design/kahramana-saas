import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

// 'unsafe-eval' is only needed by the Next.js dev runtime / Sanity Studio dev.
// In production we drop it so an injected payload cannot eval() arbitrary JS.
const isDev = process.env.NODE_ENV !== 'production'
const scriptSrcEval = isDev ? "'unsafe-eval'" : ''

const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' ${scriptSrcEval}
    https://www.googletagmanager.com
    https://www.google-analytics.com
    https://www.clarity.ms
    https://cdn.sanity.io;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:
    https://cdn.sanity.io
    https://images.unsplash.com
    https://*.google.com;
  font-src 'self';
  connect-src 'self'
    https://*.supabase.co
    wss://*.supabase.co
    https://api.sanity.io
    https://cdn.sanity.io
    https://www.google-analytics.com
    https://analytics.google.com
    https://www.googletagmanager.com
    https://www.clarity.ms
    https://dc.services.visualstudio.com;
  media-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  frame-src 'self'
    https://www.google.com;
  upgrade-insecure-requests;
`.replace(/\n\s+/g, ' ').trim()

const securityHeaders = [
  { key: 'Content-Security-Policy',   value: ContentSecurityPolicy },
  { key: 'X-Frame-Options',           value: 'DENY' },
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=(self)' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },

  async redirects() {
    return [
      // www → non-www (permanent 301)
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.kahramanat.com' }],
        destination: 'https://kahramanat.com/:path*',
        permanent: true,
      },
    ]
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
        pathname: '/images/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'wwmzuofstyzworukfxkt.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // Vercel: disable source maps in production to reduce bundle size
  productionBrowserSourceMaps: false,
}

export default withNextIntl(nextConfig)
