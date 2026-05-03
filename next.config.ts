import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin()

// CSP is injected per-request with a nonce in src/middleware.ts
const securityHeaders = [
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
        // Static assets: immutable cache (content-hashed filenames)
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Image optimizer responses: long browser cache (Lighthouse: cache TTL fix)
        source: '/_next/image(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=604800' },
        ],
      },
      {
        // All other routes: security headers + daily revalidation for HTML
        source: '/((?!_next/static).*)',
        headers: [
          ...securityHeaders,
          { key: 'Cache-Control', value: 'public, s-maxage=86400, stale-while-revalidate=43200' },
        ],
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
      // vercel.app preview → production domain (prevents canonical pointing to vercel.app)
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'kahramana.vercel.app' }],
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
    minimumCacheTTL: 31536000, // 1 year
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    dangerouslyAllowSVG: true,
  },

  // Vercel: disable source maps in production to reduce bundle size
  productionBrowserSourceMaps: false,
}

export default withNextIntl(nextConfig)
