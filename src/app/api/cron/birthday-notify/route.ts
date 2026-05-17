// Vercel Cron entry point — fires daily at 06:00 UTC = 09:00 Asia/Bahrain,
// one hour after pg_cron's 05:00 UTC `credit_birthday_points()` run
// (migration 158). Picks up `birthday_point_credits` rows that were
// inserted in the prior window and dispatches customer-facing
// notifications.
//
// Auth: `Authorization: Bearer <CRON_SECRET>` — Vercel injects this
// header automatically once `CRON_SECRET` is set as a project env var.
// Without the env var, the route refuses every request, including the
// scheduled cron, so an unset secret can never silently leak.
//
// Idempotency: a 2-hour `created_at` window. pg_cron writes at 05:00
// UTC; this route fires at 06:00 UTC. The lookback covers today's
// batch only — yesterday's rows fall outside the window and never
// re-fire. Manual mid-window re-invocations (operator curl within 2h
// of pg_cron firing) will duplicate; that's an intentional operator
// action, not a launch concern.
//
// This commit is scaffolding only. Commit 2 wires in the actual
// Resend send + wa.me deep-link generation.

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const LOOKBACK_MS = 2 * 60 * 60 * 1000

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json(
      { error: 'cron_secret_unset' },
      { status: 503 },
    )
  }

  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - LOOKBACK_MS).toISOString()

  const supabase = createServiceClient()
  const { data: rows, error } = await supabase
    .from('birthday_point_credits')
    .select('id, customer_id, year, points_credited, created_at')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: 'select_failed', message: error.message },
      { status: 500 },
    )
  }

  // Commit 2 will iterate `rows` and dispatch email + build wa.me link
  // per customer. For now the scaffold reports the row count so the
  // operator can verify the auth + read path end-to-end before any
  // actual sends go out.
  return NextResponse.json({
    found:    rows?.length ?? 0,
    notified: 0,
    cutoff,
  })
}
