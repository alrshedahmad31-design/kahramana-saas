// AUD-V3-008 — typed result wrapper for analytics queries.
// Replaces the previous error-swallowing pattern (return [] / return 0s / return null)
// with explicit { ok: false, error } so callers can render error UI + report to Sentry.

export type AnalyticsError = {
  code: string          // Supabase/PostgREST error code or 'UNKNOWN'
  message: string       // human-readable (not shown to end user)
  function: string      // which analytics function failed
  timestamp: string     // ISO string
}

export type AnalyticsResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: AnalyticsError }

export function analyticsOk<T>(data: T): AnalyticsResult<T> {
  return { ok: true, data }
}

export function analyticsErr<T>(
  fn: string,
  err: { code?: string; message?: string } | null,
): AnalyticsResult<T> {
  return {
    ok: false,
    error: {
      code:      err?.code    ?? 'UNKNOWN',
      message:   err?.message ?? 'Unknown error',
      function:  fn,
      timestamp: new Date().toISOString(),
    },
  }
}
