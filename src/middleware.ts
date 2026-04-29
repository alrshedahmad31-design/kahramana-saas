import createMiddleware from 'next-intl/middleware'
import { createServerClient, type CookieOptionsWithName } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import { routing } from '@/i18n/routing'
import { ROLE_RANK } from '@/lib/auth/rbac'
import type { StaffRole } from '@/lib/supabase/types'

const intlMiddleware = createMiddleware(routing)

const DASHBOARD_PATTERN = /^(\/en)?\/dashboard(\/.*)?$/
const LOGIN_PATTERN     = /^(\/en)?\/login$/
// Routes that require branch_manager rank or above
const STAFF_ROUTE_PATTERN = /^(\/en)?\/dashboard\/staff(\/.*)?$/

const BRANCH_MANAGER_RANK = ROLE_RANK['branch_manager']

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip RBAC entirely if Supabase env vars are missing (local dev without Supabase)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return intlMiddleware(request)
  }

  // Collect Supabase auth-cookie updates in a mutable response
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet: { name: string; value: string; options?: CookieOptionsWithName }[]) => {
        cookiesToSet.forEach(({ name, value }: { name: string; value: string }) =>
          request.cookies.set(name, value),
        )
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(
          ({ name, value, options }: { name: string; value: string; options?: CookieOptionsWithName }) =>
            supabaseResponse.cookies.set(name, value, options),
        )
      },
    },
  })

  // Refresh session (must not be skipped — keeps tokens alive)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const locale = pathname.startsWith('/en') ? 'en' : 'ar'

  const loginUrl = (redirectTo?: string): URL => {
    const url = new URL(locale === 'en' ? '/en/login' : '/login', request.url)
    if (redirectTo) url.searchParams.set('redirect', redirectTo)
    return url
  }

  const dashboardUrl = (): URL =>
    new URL(locale === 'en' ? '/en/dashboard' : '/dashboard', request.url)

  // ── Auth guard for /dashboard ─────────────────────────────────────────────

  if (DASHBOARD_PATTERN.test(pathname)) {
    if (!user) {
      return NextResponse.redirect(loginUrl(pathname))
    }

    // Verify the user has a valid, active staff profile
    const { data: staffRow } = await supabase
      .from('staff_basic')
      .select('role')
      .eq('id', user.id)
      .eq('is_active', true)
      .single()

    if (!staffRow) {
      // Authenticated in Supabase Auth but no staff profile — deny access
      return NextResponse.redirect(loginUrl())
    }

    const role = staffRow.role as StaffRole

    // /dashboard/staff requires branch_manager rank or above
    if (STAFF_ROUTE_PATTERN.test(pathname) && ROLE_RANK[role] < BRANCH_MANAGER_RANK) {
      return NextResponse.redirect(dashboardUrl())
    }
  }

  // ── Redirect authenticated users away from /login ─────────────────────────

  if (LOGIN_PATTERN.test(pathname) && user) {
    return NextResponse.redirect(dashboardUrl())
  }

  // ── Run next-intl locale routing ──────────────────────────────────────────

  const intlResponse = intlMiddleware(request)

  // Merge Supabase cookie updates into the intl response
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie)
  })

  return intlResponse
}

export const config = {
  matcher: [
    // Match all paths except: _next/static, _next/image, favicon, public assets
    '/((?!_next/static|_next/image|favicon|public|assets|fonts|icons|images|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|css|js|woff|woff2|ttf|otf)).*)',
  ],
}
