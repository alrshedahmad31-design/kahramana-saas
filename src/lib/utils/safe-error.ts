// Public-facing error sanitizer. In development we surface the underlying
// error so the engineer can debug; in production we collapse to a single
// generic string to prevent schema/secret leakage via error.message.
export function toSafeError(err: unknown): string {
  if (process.env.NODE_ENV === 'development') return String(err)
  return 'An unexpected error occurred.'
}
