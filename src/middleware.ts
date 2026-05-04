import createMiddleware from 'next-intl/middleware'
import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import { routing } from '@/i18n/routing'
import { ROLE_RANK } from '@/lib/auth/rbac'
import type { StaffRole } from '@/lib/supabase/custom-types'

const intlMiddleware = createMiddleware(routing)

const DASHBOARD_PATTERN   = /^(\/en)?\/dashboard(\/.*)?$/
const LOGIN_PATTERN        = /^(\/en)?\/login$/
const STAFF_ROUTE_PATTERN  = /^(\/en)?\/dashboard\/staff(\/.*)?$/

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
    'https://www.clarity.ms https://cdn.sanity.io https://va.vercel-scripts.com'

  const scriptSrc = isDev
    // Dev: permissive for HMR + inline framework scripts
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${SCRIPT_HOSTS}`
    // Prod: nonce-strict; 'unsafe-inline' is a legacy-browser fallback that
    // modern browsers ignore once a nonce is present.
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' ${SCRIPT_HOSTS}`

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://cdn.sanity.io https://images.unsplash.com https://*.google.com",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.sanity.io https://cdn.sanity.io https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://www.clarity.ms https://dc.services.visualstudio.com https://va.vercel-scripts.com https://vitals.vercel-insights.com",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'self' https://www.google.com",
    "upgrade-insecure-requests",
  ].join('; ')
}

// ── Finalize a "next" response: forward nonce + add CSP + merge cookies ───────

function finalizeResponse(
  headersWithNonce: Headers,
  nonce:            string,
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
      response.headers.set('Content-Security-Policy', buildCsp(nonce))
      return response
    }
  }

  // Create a fresh "next" response that forwards the nonce to Server Components
  // via modified request headers (readable via headers() in Server Components)
  const response = NextResponse.next({ request: { headers: headersWithNonce } })

  // Copy intl response headers (e.g. locale cookie, Link header, x-middleware-rewrite)
  intlResponse.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'content-security-policy') {
      response.headers.set(key, value)
    }
  })

  // Merge cookies from both responses
  supabaseResponse.cookies.getAll().forEach((c) => response.cookies.set(c))
  intlResponse.cookies.getAll().forEach((c)     => response.cookies.set(c))

  response.headers.set('Content-Security-Policy', buildCsp(nonce))
  return response
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const headersWithNonce = new Headers(request.headers)
  headersWithNonce.set('x-nonce', nonce)
  headersWithNonce.set('x-pathname', pathname)

  const isDashboard = DASHBOARD_PATTERN.test(pathname)
  const isLogin     = LOGIN_PATTERN.test(pathname)

  // ── Public routes: skip Supabase entirely ─────────────────────────────────
  if (!isDashboard && !isLogin) {
    const intlResponse = intlMiddleware(request)
    return finalizeResponse(
      headersWithNonce,
      nonce,
      NextResponse.next({ request: { headers: headersWithNonce } }),
      intlResponse,
    )
  }

  // ── Auth routes only ──────────────────────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    const res = intlMiddleware(request)
    res.headers.set('Content-Security-Policy', buildCsp(nonce))
    return res
  }

  let supabaseResponse = NextResponse.next({ request: { headers: headersWithNonce } })
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request: { headers: headersWithNonce } })
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
    if (isDashboard) {
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
      if (isDashboard) {
        const response = NextResponse.redirect(loginUrl())
        supabaseResponse.cookies.getAll().forEach((c) => response.cookies.set(c))
        return response
      }
    } else {
      const role = staffRow.role as StaffRole
      if (role === 'driver') {
        const driverUrl = new URL(locale === 'en' ? '/en/driver' : '/driver', request.url)
        const response = NextResponse.redirect(driverUrl)
        supabaseResponse.cookies.getAll().forEach((c) => response.cookies.set(c))
        return response
      } else if (isLogin) {
        const response = NextResponse.redirect(dashboardUrl())
        supabaseResponse.cookies.getAll().forEach((c) => response.cookies.set(c))
        return response
      }
      if (STAFF_ROUTE_PATTERN.test(pathname) && ROLE_RANK[role] < BRANCH_MANAGER_RANK) {
        const response = NextResponse.redirect(dashboardUrl())
        supabaseResponse.cookies.getAll().forEach((c) => response.cookies.set(c))
        return response
      }
    }
  }

  const intlResponse = intlMiddleware(request)
  return finalizeResponse(headersWithNonce, nonce, supabaseResponse, intlResponse)
}

export const config = {
  matcher: [
    // Match all paths except: _next internals, public assets, SEO files, and auth callbacks
    '/((?!_next/static|_next/image|favicon|public|assets|fonts|icons|images|auth|robots\\.txt|sitemap.*\\.xml|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|css|js|woff|woff2|ttf|otf)).*)',
  ],
}
