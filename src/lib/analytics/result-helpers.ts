import * as Sentry from '@sentry/nextjs'
import type { AnalyticsError, AnalyticsResult } from './types'

export function captureAnalyticsError(err: AnalyticsError): void {
  Sentry.captureException(new Error(err.message), {
    tags:  { analytics_function: err.function },
    extra: { code: err.code, timestamp: err.timestamp },
  })
}

// Walks the list, captures each failure to Sentry, returns the first failure (or null).
export function firstAnalyticsFailure(
  results: ReadonlyArray<AnalyticsResult<unknown>>,
): AnalyticsError | null {
  let first: AnalyticsError | null = null
  for (const r of results) {
    if (!r.ok) {
      captureAnalyticsError(r.error)
      if (!first) first = r.error
    }
  }
  return first
}
