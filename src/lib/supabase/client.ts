import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL!

  // Defensive check: if URL incorrectly includes /rest/v1 (common misconfiguration)
  if (url.includes('/rest/v1')) {
    url = url.split('/rest/v1')[0]
  }

  return createBrowserClient<Database>(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
