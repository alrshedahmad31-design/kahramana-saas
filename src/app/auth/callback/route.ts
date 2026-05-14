import { NextRequest, NextResponse }          from 'next/server'
import { createServerClient, type CookieOptionsWithName } from '@supabase/ssr'
import { cookies }                           from 'next/headers'

// Pin redirects to the env-configured site URL. Deriving from `request.url`
// (`origin`) is vulnerable to Host-header confusion via a misrouted proxy +
// a Supabase recovery link — landing the user on a clone post-auth. The env
// var is required at runtime (not module-load — build collects page data
// without prod env present).
function safeRedirect(path: string): NextResponse {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (!siteUrl) {
    throw new Error('NEXT_PUBLIC_SITE_URL is required for /auth/callback redirects')
  }
  return NextResponse.redirect(new URL(path, siteUrl))
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code        = searchParams.get('code')
  const type        = searchParams.get('type')
  const errorParam  = searchParams.get('error')
  const errorDesc   = searchParams.get('error_description')

  // Supabase returned an error (e.g. expired magic link)
  if (errorParam) {
    const msg = errorDesc ?? errorParam
    return safeRedirect(`/login?error=${encodeURIComponent(msg)}`)
  }

  if (!code) {
    return safeRedirect('/login?error=missing_code')
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options?: CookieOptionsWithName }[]) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    // Log the full reason for ops, but never reflect it into the redirect
    // URL — the message may contain JWT internals, code-verifier hints, or
    // user-existence signals that aid recon. The /login page handles the
    // generic 'exchange_failed' sentinel.
    console.error('[auth/callback] exchange failed:', exchangeError.message)
    return safeRedirect('/login?error=exchange_failed')
  }

  // Password reset flow — send to set-password page.
  // Mark this session as having arrived via recovery so set-password can
  // distinguish a reset-token landing from a normal logged-in user changing
  // their password. Without this marker any active session would pass for
  // reset proof (VULN-AUTH-06). Short TTL — recovery should complete fast.
  if (type === 'recovery') {
    cookieStore.set('kah_recovery_flow', '1', {
      httpOnly: true,
      sameSite: 'lax',
      secure:   process.env.NODE_ENV === 'production',
      path:     '/',
      maxAge:   60 * 10,
    })
    return safeRedirect('/set-password')
  }

  // Verify the user has an active staff profile before letting them in
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: staffRow } = await supabase
      .from('staff_basic')
      .select('role')
      .eq('id', user.id)
      .eq('is_active', true)
      .single()

    if (staffRow) {
      return safeRedirect('/dashboard')
    }
  }

  // Auth succeeded but no staff profile — send to login with explanation
  return safeRedirect('/login?error=no_staff_profile')
}
