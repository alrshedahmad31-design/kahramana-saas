import { createServerClient, type CookieOptionsWithName } from '@supabase/ssr'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from './types'

// Cast bypasses @supabase/ssr 0.5.2 return-type mismatch with supabase-js 2.105.0.
// Both createServerClient and createBrowserClient return SupabaseClient<D, SchemaName, Schema>
// (old 3-param form) but SupabaseClient now has 5 params — the Schema arg lands on SchemaName
// (3rd position), causing the real Schema param to default to never. Explicit cast fixes it.

// Anon client — uses cookie-based session for RLS and auth.
export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptionsWithName }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  ) as unknown as SupabaseClient<Database>
}

// Service-role client — bypasses RLS. No cookie handling needed.
// Uses createClient from @supabase/supabase-js directly so the Database
// generic resolves correctly (avoids @supabase/ssr return-type mismatch with
// @supabase/supabase-js 2.105.0).
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  console.log('[Supabase Server] URL:', url)
  console.log('[Supabase Server] Key defined:', !!key)
  if (key) console.log('[Supabase Server] Key prefix:', key.substring(0, 10))

  if (!url || !key) {
    throw new Error(
      'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local'
    )
  }
  return createSupabaseClient<Database>(
    url,
    key,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

