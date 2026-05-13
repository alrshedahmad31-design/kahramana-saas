import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TIMEOUT_MS = 4000

type CheckResult =
  | { ok: true;  latencyMs: number }
  | { ok: false; latencyMs: number; error: string }

export async function GET() {
  const startedAt = Date.now()
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local'

  const db = await Promise.race<CheckResult>([
    checkDatabase(),
    new Promise<CheckResult>((resolve) =>
      setTimeout(
        () => resolve({ ok: false, latencyMs: TIMEOUT_MS, error: 'timeout' }),
        TIMEOUT_MS,
      ),
    ),
  ])

  const ok = db.ok
  const body = {
    status: ok ? 'ok' : 'unhealthy',
    sha,
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
    return error
      ? { ok: false, latencyMs, error: 'Database check failed' }
      : { ok: true,  latencyMs }
  } catch {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: 'Database check failed',
    }
  }
}
