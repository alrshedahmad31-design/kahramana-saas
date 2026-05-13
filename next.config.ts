import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin()

// Sanitized Sentry release name — must match the `release` set in the three
// Sentry.init() configs (instrumentation-client, sentry.server, sentry.edge)
// so sourcemap uploads bind to the same release ID emitted by runtime events.
// Code-side only: do NOT set SENTRY_RELEASE as a Vercel env var.
const sentryRelease =
  process.env.VERCEL_GIT_COMMIT_REF && process.env.VERCEL_GIT_COMMIT_SHA
    ? `kahramana-${process.env.VERCEL_GIT_COMMIT_REF}-${process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)}`
    : undefined;

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
        // Image optimizer responses: long browser cache
        source: '/_next/image(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=604800' },
        ],
      },
      {
        // Public static assets (logo, hero, gallery, fonts, favicon): immutable browser cache.
        // These are content-stable files — any change gets a new filename.
        source: '/assets/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/fonts/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // All other routes: security headers + daily revalidation for HTML.
        // Exclusions: _next/static (immutable above), driver (no-store in
        // vercel.json — realtime GPS PWA), images (longer SWR in vercel.json
        // for user-uploaded menu images that change occasionally).
        source: '/((?!_next/static|driver|images).*)',
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
      // /privacy consolidated into /privacy-policy (page.tsx removed).
      // CookieBanner used to point at /privacy; both legacy paths resolve here.
      {
        source: '/privacy',
        destination: '/privacy-policy',
        statusCode: 301,
      },
      {
        source: '/:locale(ar|en)/privacy',
        destination: '/:locale/privacy-policy',
        permanent: true,
      },
      // NOTE: kahramana.vercel.app → kahramanat.com redirect intentionally omitted.
      // Add it back at production launch by setting NEXT_PUBLIC_SITE_URL=https://kahramanat.com
      // in Vercel production env vars and re-enabling this redirect.
    ]
  },

  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/branches',
          destination: '/ar/branches',
        },
        {
          source: '/branches/:path*',
          destination: '/ar/branches/:path*',
        },
        {
          source: '/privacy-policy',
          destination: '/ar/privacy-policy',
        },
        {
          source: '/terms',
          destination: '/ar/terms',
        },
        {
          source: '/refund-policy',
          destination: '/ar/refund-policy',
        },
      ],
    }
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
    formats: ['image/webp'],
    qualities: [70, 72, 75, 80, 85, 90],
    minimumCacheTTL: 31536000, // 1 year
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    dangerouslyAllowSVG: true,
  },

  // Emit production sourcemaps so the Sentry build plugin can upload them
  // for symbolicated stack traces. Maps are uploaded to Sentry and then
  // deleted from the deploy bundle by the plugin, so this does not bloat
  // what reaches the client.
  productionBrowserSourceMaps: true,

  experimental: {
    // Tree-shake large packages -- only import used modules into the bundle.
    // Next.js 15 + SWC picks up package.json browserslist automatically,
    // stripping legacy polyfills (Array.at, flat, Object.fromEntries, etc.)
    // without needing browsersListForSwc flag.
    optimizePackageImports: ['gsap', 'framer-motion', 'date-fns', 'lucide-react'],
  },
}

export default withSentryConfig(withNextIntl(nextConfig), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "kahramana-4f",

  project: "javascript-nextjs",

  // Bind uploaded sourcemaps to the same release string used at runtime.
  release: { name: sentryRelease },

  // Read the auth token from the env var explicitly so the upload step
  // fails loudly (rather than silently no-op) if the secret is missing
  // on Vercel.
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Sourcemap upload pipeline — explicit so it can't be accidentally
  // turned off by an upstream default change.
  sourcemaps: {
    disable: false,
  },

  // Explicit glob covering both client (.next/static/**) and server
  // (.next/server/**) chunks. Replaces experimental.serverSourceMaps,
  // which Next.js 15.5 ignored for the UUID-named server chunks.
  unstable_sentryWebpackPluginOptions: {
    sourcemaps: {
      assets: ['.next/**/*.js', '.next/**/*.js.map'],
    },
  },

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // tunnelRoute removed (session 95) — was '/monitoring'. Every captured error
  // was hitting a Next.js function, burning Fluid Active CPU on the free tier.
  // Browser SDK now sends events directly to *.ingest.sentry.io; CSP
  // connect-src already allows those origins (src/middleware.ts:62).
  // Trade-off: aggressive ad-blockers may drop Sentry events. Acceptable
  // for now — restaurant staff aren't using uBlock Origin in the dashboard.

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Disable Sentry's automatic instrumentation that creates a server-side
    // transaction for every App Router page render. The transaction was the
    // source of the <meta name="baggage"> and <meta name="sentry-trace">
    // tags injected into HTML responses, which exposed the git commit SHA
    // (sentry-release) and route name to every visitor.
    //
    // Trade-off: automatic SSR/RSC performance traces are lost. Error
    // capture, manual Sentry.startSpan() calls, and client-side tracing
    // continue to work normally.
    // F-08: baggage/meta leak closed; client router transactions acceptable trade-off
    autoInstrumentAppDirectory:   false,
    autoInstrumentServerFunctions: false,
    autoInstrumentMiddleware:     false,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
