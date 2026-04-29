import createMiddleware from 'next-intl/middleware'
import { createServerClient, type CookieOptionsWithName } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import { routing } from '@/i18n/routing'
import { ROLE_RANK } from '@/lib/auth/rbac'
import type { StaffRole } from '@/lib/supabase/custom-types'

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

  // ── Auth & RBAC logic ─────────────────────────────────────────────────────

  const isDashboard = DASHBOARD_PATTERN.test(pathname)
  const isLogin     = LOGIN_PATTERN.test(pathname)

  if (isDashboard || isLogin) {
    if (!user) {
      if (isDashboard) {
        const response = NextResponse.redirect(loginUrl(pathname))
        supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
        return response
      }
      // On login page and not authenticated -> fall through to intlMiddleware
    } else {
      // User is authenticated in Supabase Auth. Now check if they are authorized staff.
      const { data: staffRow } = await supabase
        .from('staff_basic')
        .select('role')
        .eq('id', user.id)
        .eq('is_active', true)
        .single()

      if (!staffRow) {
        // Logged in but NO staff profile -> only allowed on /login
        if (isDashboard) {
          const response = NextResponse.redirect(loginUrl())
          supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
          return response
        }
        // If on /login and no profile, stay there (prevents loop)
      } else {
        // Logged in AND has valid staff profile
        if (isLogin) {
          const response = NextResponse.redirect(dashboardUrl())
          supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
          return response
        }

        // Dashboard specific RBAC
        const role = staffRow.role as StaffRole
        if (STAFF_ROUTE_PATTERN.test(pathname) && ROLE_RANK[role] < BRANCH_MANAGER_RANK) {
          const response = NextResponse.redirect(dashboardUrl())
          supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
          return response
        }
      }
    }
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
    // Match all paths except: _next internals, public assets, and auth callbacks
    '/((?!_next/static|_next/image|favicon|public|assets|fonts|icons|images|auth|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|css|js|woff|woff2|ttf|otf)).*)',
  ],
}
