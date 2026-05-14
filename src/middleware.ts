import createMiddleware from 'next-intl/middleware'
import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import { routing } from '@/i18n/routing'
import { ROLE_RANK } from '@/lib/auth/rbac'
import type { StaffRole } from '@/lib/supabase/custom-types'

const intlMiddleware = createMiddleware(routing)

const DASHBOARD_PATTERN   = /^(\/(ar|en))?\/dashboard(\/.*)?$/
const ACCOUNT_PATTERN     = /^(\/(ar|en))?\/account(\/.*)?$/
const LOGIN_PATTERN        = /^(\/(ar|en))?\/login$/
const FORGOT_PASSWORD_PATTERN = /^(\/(ar|en))?\/forgot-password$/
const SET_PASSWORD_PATTERN    = /^(\/(ar|en))?\/set-password$/
const STAFF_ROUTE_PATTERN  = /^(\/(ar|en))?\/dashboard\/staff(\/.*)?$/
const DRIVER_PATTERN       = /^(\/(ar|en))?\/driver(\/.*)?$/
const WAITER_PATTERN       = /^(\/(ar|en))?\/waiter(\/.*)?$/
const TABLE_PATTERN        = /^(\/(ar|en))?\/table(\/.*)?$/
const POS_PATTERN          = /^(\/(ar|en))?\/pos(\/.*)?$/
const CHECKOUT_PATTERN     = /^(\/(ar|en))?\/checkout(\/.*)?$/
const PAYMENT_PATTERN      = /^(\/(ar|en))?\/payment(\/.*)?$/
const ORDER_PATTERN        = /^(\/(ar|en))?\/order(\/.*)?$/
// Drivers are mono-locale (Arabic only). This pattern matches the canonical
// unprefixed path so we know when NOT to redirect (avoids an infinite loop
// when forcing /en/driver → /driver).
const ARABIC_DRIVER_PATTERN = /^\/driver($|\/)/

const BRANCH_MANAGER_RANK = ROLE_RANK['branch_manager']

// ── CSP builder (nonce injected per request) ──────────────────────────────────
// Strategy:
//   - Production: nonce-based + 'strict-dynamic'. Modern browsers ignore
//     'unsafe-inline' when a nonce is present, so adding it doesn't weaken
//     prod security but keeps Next.js framework scripts working when the
//     nonce occasionally fails to thread (RSC streaming edge cases).
//   - Development: 'unsafe-inline' is required because Turbopack's HMR
//     runtime injects inline scripts that the nonce mechanism cannot tag.
//   - Both: allow the Vercel SpeedInsights origin va.vercel-scripts.com
//     so client telemetry works.

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== 'production'
  const SCRIPT_HOSTS =
    'https://www.googletagmanager.com https://www.google-analytics.com ' +
    'https://www.clarity.ms https://cdn.sanity.io https://va.vercel-scripts.com ' +
    // Cloudflare Turnstile (CAPTCHA) — script + iframe (frame-src below).
    'https://challenges.cloudflare.com'

  // Dev-only allowance so impeccable live mode (localhost:8400 helper) can load.
  const __impeccableLiveDev = isDev ? ' http://localhost:8400' : ''

  const scriptSrc = isDev
    // Dev: permissive for HMR + inline framework scripts
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${SCRIPT_HOSTS}${__impeccableLiveDev}`
    // Prod: nonce-strict; 'unsafe-inline' is a legacy-browser fallback that
    // modern browsers ignore once a nonce is present.
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' ${SCRIPT_HOSTS}`

  return [
    "default-src 'self'",
    scriptSrc + ' blob:',
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://cdn.sanity.io https://images.unsplash.com https://*.google.com https://*.tile.openstreetmap.org https://*.openstreetmap.org",
    "font-src 'self'",
    "worker-src 'self' blob:",
    // Sentry direct ingest endpoints — primary path as of session 95 (tunnel
    // route removed to save Fluid Active CPU). Wildcards cover both the
    // generic ingest hosts and the US region (current DSN).
    `connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://api.sanity.io https://cdn.sanity.io https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://www.clarity.ms https://dc.services.visualstudio.com https://va.vercel-scripts.com https://vitals.vercel-insights.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://sentry.io${__impeccableLiveDev}`,
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Turnstile renders its challenge UI inside an iframe; without this entry
    // the CAPTCHA widget would render blank in production.
    "frame-src 'self' https://www.google.com https://challenges.cloudflare.com",
    "upgrade-insecure-requests",
  ].join('; ')
}

function buildPublicCsp(): string {
  const isDev = process.env.NODE_ENV !== 'production'
  const SCRIPT_HOSTS =
    'https://www.googletagmanager.com https://www.google-analytics.com ' +
    'https://www.clarity.ms https://cdn.sanity.io https://va.vercel-scripts.com ' +
    'https://challenges.cloudflare.com'

  const __impeccableLiveDev = isDev ? ' http://localhost:8400' : ''
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${SCRIPT_HOSTS}${__impeccableLiveDev}`
    : `script-src 'self' 'unsafe-inline' ${SCRIPT_HOSTS}`

  return [
    "default-src 'self'",
    scriptSrc + ' blob:',
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://cdn.sanity.io https://images.unsplash.com https://*.google.com https://*.tile.openstreetmap.org https://*.openstreetmap.org",
    "font-src 'self'",
    "worker-src 'self' blob:",
    `connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://api.sanity.io https://cdn.sanity.io https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://www.clarity.ms https://dc.services.visualstudio.com https://va.vercel-scripts.com https://vitals.vercel-insights.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://sentry.io${__impeccableLiveDev}`,
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'self' https://www.google.com https://challenges.cloudflare.com",
    "upgrade-insecure-requests",
  ].join('; ')
}

// ── Finalize a "next" response: forward nonce + add CSP + merge cookies ───────

function finalizeResponse(
  requestHeaders:   Headers,
  csp:              string,
  supabaseResponse: NextResponse,
  intlResponse:     NextResponse,
): NextResponse {
  // Preserve redirects from intlMiddleware (e.g. /ar → / with as-needed prefix mode).
  // Without this, the redirect is swallowed and Next.js serves a broken locale context.
  if (intlResponse.status >= 300 && intlResponse.status < 400) {
    const location = intlResponse.headers.get('location')
    if (location) {
      const response = NextResponse.redirect(location, intlResponse.status)
      supabaseResponse.cookies.getAll().forEach((c) => response.cookies.set(c))
      intlResponse.cookies.getAll().forEach((c)     => response.cookies.set(c))
      response.headers.set('Content-Security-Policy', csp)
      return response
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  // Copy intl response headers (e.g. locale cookie, Link header, x-middleware-rewrite)
  intlResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'content-security-policy') {
      response.headers.set(key, value)
    }
  })

  // Merge cookies from both responses
  supabaseResponse.cookies.getAll().forEach((c) => response.cookies.set(c))
  intlResponse.cookies.getAll().forEach((c)     => response.cookies.set(c))

  response.headers.set('Content-Security-Policy', csp)
  return response
}

function finalizePublicResponse(intlResponse: NextResponse): NextResponse {
  if (intlResponse.status >= 300 && intlResponse.status < 400) {
    intlResponse.headers.set('Content-Security-Policy', buildPublicCsp())
    return intlResponse
  }

  const response = NextResponse.next()

  intlResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'content-security-policy') {
      response.headers.set(key, value)
    }
  })
  intlResponse.cookies.getAll().forEach((c) => response.cookies.set(c))

  response.headers.set('Content-Security-Policy', buildPublicCsp())
  return response
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isDashboard      = DASHBOARD_PATTERN.test(pathname)
  const isAccount        = ACCOUNT_PATTERN.test(pathname)
  const isLogin          = LOGIN_PATTERN.test(pathname)
  const isForgotPassword = FORGOT_PASSWORD_PATTERN.test(pathname)
  const isSetPassword    = SET_PASSWORD_PATTERN.test(pathname)
  const isDriverRoute    = DRIVER_PATTERN.test(pathname)
  const isProtectedRoute =
    isDashboard ||
    isAccount ||
    isLogin ||
    isForgotPassword ||
    isSetPassword ||
    isDriverRoute ||
    WAITER_PATTERN.test(pathname) ||
    TABLE_PATTERN.test(pathname) ||
    POS_PATTERN.test(pathname) ||
    CHECKOUT_PATTERN.test(pathname) ||
    PAYMENT_PATTERN.test(pathname) ||
    ORDER_PATTERN.test(pathname)

  // 1. Always run intl middleware first to handle redirects/cookies
  const intlResponse = intlMiddleware(request)

  if (!isProtectedRoute) {
    return finalizePublicResponse(intlResponse)
  }

  const usesNonceCsp = ORDER_PATTERN.test(pathname)
  const nonce = usesNonceCsp ? Buffer.from(crypto.randomUUID()).toString('base64') : null
  const requestHeaders = new Headers(request.headers)
  const csp = nonce ? buildCsp(nonce) : buildPublicCsp()
  if (nonce) {
    requestHeaders.set('x-nonce', nonce)
  }

  // 2. If it's a redirect (e.g. locale change), return it immediately
  if (intlResponse.status >= 300 && intlResponse.status < 400) {
    intlResponse.headers.set('Content-Security-Policy', csp)
    return intlResponse
  }

  // ── Public routes: skip Supabase entirely ─────────────────────────────────
  // /driver is included because drivers must be forced into Arabic and
  // bounced off /en/driver — that check needs the user's role.
  if (!isDashboard && !isLogin && !isForgotPassword && !isSetPassword && !isDriverRoute) {
    return finalizeResponse(requestHeaders, csp, NextResponse.next(), intlResponse)
  }

  // ── Auth routes: Supabase logic ──────────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return finalizeResponse(requestHeaders, csp, NextResponse.next(), intlResponse)
  }

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        )
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  const locale = pathname.startsWith('/en') ? 'en' : 'ar'

  const loginUrl = (redirectTo?: string): URL => {
    const url = new URL(locale === 'en' ? '/en/login' : '/login', request.url)
    if (redirectTo) url.searchParams.set('redirect', redirectTo)
    return url
  }
  const dashboardUrl = (): URL =>
    new URL(locale === 'en' ? '/en/dashboard' : '/dashboard', request.url)

  if (!user) {
    if (isDashboard || isDriverRoute) {
      const response = NextResponse.redirect(loginUrl(pathname))
      supabaseResponse.cookies.getAll().forEach((c) => response.cookies.set(c))
      return response
    }
  } else {
    const { data: staffRow } = await supabase
      .from('staff_basic')
      .select('role')
      .eq('id', user.id)
      .eq('is_active', true)
      .single()

    if (!staffRow) {
      if (isDashboard || isDriverRoute) {
        const response = NextResponse.redirect(loginUrl())
        supabaseResponse.cookies.getAll().forEach((c) => response.cookies.set(c))
        return response
      }
    } else {
      const role = staffRow.role as StaffRole
      if (role === 'driver') {
        // Drivers always work in Arabic. Force /driver regardless of how
        // they arrived (/en/driver, /dashboard, /en/dashboard, /login,
        // /en/login). Skip the redirect when already on /driver to avoid a
        // loop.
        if (!ARABIC_DRIVER_PATTERN.test(pathname)) {
          const response = NextResponse.redirect(new URL('/driver', request.url))
          supabaseResponse.cookies.getAll().forEach((c) => response.cookies.set(c))
          return response
        }
      } else {
        // Non-drivers don't belong on /driver UNLESS they are branch managers or above (for supervision).
        const roleRank = ROLE_RANK[role] ?? 0
        if (isDriverRoute && roleRank < BRANCH_MANAGER_RANK) {
          const response = NextResponse.redirect(dashboardUrl())
          supabaseResponse.cookies.getAll().forEach((c) => response.cookies.set(c))
          return response
        }
        if (isLogin || isForgotPassword) {
          const response = NextResponse.redirect(dashboardUrl())
          supabaseResponse.cookies.getAll().forEach((c) => response.cookies.set(c))
          return response
        }
        if (STAFF_ROUTE_PATTERN.test(pathname) && roleRank < BRANCH_MANAGER_RANK) {
          const response = NextResponse.redirect(dashboardUrl())
          supabaseResponse.cookies.getAll().forEach((c) => response.cookies.set(c))
          return response
        }
      }
    }
  }

  return finalizeResponse(requestHeaders, csp, supabaseResponse, intlResponse)
}

export const config = {
  matcher: [
    // Match all paths except: API routes, Sentry tunnel, _next internals,
    // public assets, SEO files, and auth callbacks. /api/* and /monitoring
    // must be excluded so next-intl doesn't locale-prefix them (causes 404).
    // /monitoring is the Sentry tunnelRoute set in next.config.ts.
    '/((?!api|monitoring|_next/static|_next/image|favicon|public|assets|fonts|icons|images|auth|robots\\.txt|sitemap.*\\.xml|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|css|js|woff|woff2|ttf|otf)).*)',
  ],
}
