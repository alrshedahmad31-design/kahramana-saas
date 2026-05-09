// XSS guard for user-supplied image URLs.
// Accepts:
//   1. Empty string — image_url is optional
//   2. Site-relative path starting with '/' (e.g. '/assets/foo.webp')
//      → browser resolves against own origin; cannot carry hostile schemes
//   3. Absolute URL whose protocol is exactly 'https:'
// Everything else is rejected (notably 'javascript:', 'data:', 'http:',
// 'vbscript:', and any other scheme that could exfiltrate or execute code).

export const IMAGE_URL_ERROR =
  'يجب أن يبدأ الرابط بـ https:// أو بـ / للمسارات المحلية'

export function isSafeImageUrl(value: string | null | undefined): boolean {
  if (!value) return true
  const trimmed = value.trim()
  if (trimmed === '') return true

  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true

  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}
