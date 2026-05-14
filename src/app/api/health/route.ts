import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TIMEOUT_MS = 4000

// Public health endpoint. We deliberately do NOT return the underlying DB
// error message or the deployed commit SHA — both are reconnaissance gifts
// that help attackers correlate this build to known CVEs in pinned deps.
// `status` is the only consumer-visible signal; operators can read the full
// error from Sentry / platform logs.
type CheckResult =
  | { ok: true;  latencyMs: number }
  | { ok: false; latencyMs: number }

export async function GET() {
  const startedAt = Date.now()

  const db = await Promise.race<CheckResult>([
    checkDatabase(),
    new Promise<CheckResult>((resolve) =>
      setTimeout(
        () => resolve({ ok: false, latencyMs: TIMEOUT_MS }),
        TIMEOUT_MS,
      ),
    ),
  ])

  const ok = db.ok
  const body = {
    status: ok ? 'ok' : 'error',
    iso: new Date().toISOString(),
    latencyMs: Date.now() - startedAt,
    checks: { db },
  }

  return Response.json(body, {
    status: ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}

async function checkDatabase(): Promise<CheckResult> {
  const startedAt = Date.now()
  try {
    const supabase = createServiceClient()
    const { error } = await supabase
      .from('branches')
      .select('*', { count: 'exact', head: true })
    const latencyMs = Date.now() - startedAt
    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[health] db check failed:', error.message)
      }
      return { ok: false, latencyMs }
    }
    return { ok: true, latencyMs }
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[health] db check threw:', err)
    }
    return { ok: false, latencyMs: Date.now() - startedAt }
  }
}
