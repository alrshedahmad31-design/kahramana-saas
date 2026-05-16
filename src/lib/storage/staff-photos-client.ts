// VULN-010 client-side counterpart of staff-photos.ts. Kept in a separate
// file so the server-only `next/headers` import in staff-photos.ts doesn't
// bleed into client bundles via the wizard upload flow.

import type { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'staff-photos'
const SIGNED_URL_TTL_SECONDS = 3600

export async function createStaffPhotoSignedUrlClient(
  client: SupabaseClient,
  path: string,
): Promise<string | null> {
  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (error) return null
  return data?.signedUrl ?? null
}
