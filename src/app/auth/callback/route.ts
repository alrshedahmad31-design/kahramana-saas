import { NextRequest, NextResponse }          from 'next/server'
import { createServerClient, type CookieOptionsWithName } from '@supabase/ssr'
import { cookies }                           from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code        = searchParams.get('code')
  const errorParam  = searchParams.get('error')
  const errorDesc   = searchParams.get('error_description')

  // Supabase returned an error (e.g. expired magic link)
  if (errorParam) {
    const msg = errorDesc ?? errorParam
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(msg)}`
    )
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
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
    console.error('[auth/callback] exchange failed:', exchangeError.message)
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
    )
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
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  // Auth succeeded but no staff profile — send to login with explanation
  return NextResponse.redirect(
    `${origin}/login?error=no_staff_profile`
  )
}
