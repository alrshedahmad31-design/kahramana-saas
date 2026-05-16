// VULN-010: staff-photos bucket holds PII (named-employee faces) and is now
// private. Reads must go through a signed URL with a short TTL — never via
// getPublicUrl, which only works on public buckets and would re-introduce the
// world-readable surface.

import { createClient as createServerClient } from '@/lib/supabase/server'

const BUCKET = 'staff-photos'
const SIGNED_URL_TTL_SECONDS = 3600

// Storage paths look like "profiles/<random>_<ts>.<ext>". Legacy rows in
// staff_basic.profile_photo_url may still hold a full public URL written
// before the bucket was made private. Extract the path component in either
// case so we can re-sign on every render.
export function extractStaffPhotoPath(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!trimmed.includes('://')) return trimmed.replace(/^\/+/, '')
  const marker = `/${BUCKET}/`
  const idx = trimmed.indexOf(marker)
  if (idx === -1) return null
  return trimmed.slice(idx + marker.length).split('?')[0]
}

// Server-side resolver — used by RSC pages before passing rows to client
// components. Returns null on any failure so the consumer falls back to the
// initials placeholder rather than a broken <img>.
export async function resolveStaffPhotoSignedUrl(
  pathOrUrl: string | null | undefined,
): Promise<string | null> {
  const path = extractStaffPhotoPath(pathOrUrl)
  if (!path) return null
  const supabase = await createServerClient()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (error) return null
  return data?.signedUrl ?? null
}

// Client-side counterpart lives in staff-photos-client.ts so this module can
// safely import next/headers without poisoning client bundles.
