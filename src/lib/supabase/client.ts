import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

// Cast bypasses @supabase/ssr 0.5.2 return-type mismatch with supabase-js 2.105.0.
// createBrowserClient returns SupabaseClient<D, SchemaName, Schema> (3-param, old API)
// but SupabaseClient now has 5 params — Schema ends up mapped to SchemaName (3rd param),
// causing the 4th-param Schema to default to never. The cast fixes the resolved type.
export function createClient(): SupabaseClient<Database> {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  
  // Defensive check: if URL incorrectly includes /rest/v1 (common misconfiguration)
  if (url.includes('/rest/v1')) {
    url = url.split('/rest/v1')[0]
  }

  return createBrowserClient<Database>(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ) as unknown as SupabaseClient<Database>
}
