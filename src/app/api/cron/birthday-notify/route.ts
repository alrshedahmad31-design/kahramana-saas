// Vercel Cron entry point — fires daily at 06:00 UTC = 09:00 Asia/Bahrain,
// one hour after pg_cron's 05:00 UTC `credit_birthday_points()` run
// (migration 158). Reads `birthday_point_credits` rows inserted in the
// prior window and dispatches a customer-facing notification:
//
//   1. Resend email (BirthdayBonus template — bilingual AR + EN body).
//   2. WhatsApp deep-link (wa.me) baked into the email's CTA. Points
//      at the default brand WhatsApp number (Riffa) with a pre-filled
//      bilingual greeting. There's no Cloud-API push: the customer
//      sees the link in the email and taps it to start a chat.
//
// Auth: `Authorization: Bearer <CRON_SECRET>` — Vercel injects this
// header automatically once `CRON_SECRET` is set as a project env var.
// Without the env var, the route refuses every request, including the
// scheduled cron, so an unset secret can never silently leak.
//
// Idempotency: a 2-hour `created_at` window. pg_cron writes at 05:00
// UTC; this route fires at 06:00 UTC. The lookback covers today's
// batch only — yesterday's rows fall outside and never re-fire.
// Manual mid-window re-invocations within 2h of pg_cron will duplicate
// (intentional operator action).
//
// Failure mode: every send is best-effort. A single customer's email
// failure must not abort the batch — the loop catches per-row and
// logs to Sentry, then moves on. The HTTP response always reports
// `notified` + `failed` counts so an operator can see what landed.

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { getTranslations } from 'next-intl/server'
import * as Sentry from '@sentry/nextjs'
import { createServiceClient } from '@/lib/supabase/server'
import { sendBirthdayBonus } from '@/lib/email/send'
import { BRANCHES } from '@/constants/contact'
import type { BirthdayCopy } from '../../../../../emails/templates/BirthdayBonus'

export const dynamic = 'force-dynamic'

const LOOKBACK_MS = 2 * 60 * 60 * 1000

// Default brand WhatsApp surface for the email CTA. Customer profiles
// don't track a preferred branch — Riffa is the live default per BRANCHES.
const DEFAULT_BRAND_WA_PHONE = BRANCHES.riffa.whatsapp.replace(/[^\d]/g, '')

type Locale = 'ar' | 'en'
type TierKey = 'bronze' | 'silver' | 'gold' | 'platinum'

async function buildCopy(
  locale: Locale,
  customerName: string,
  pointsAwarded: number,
  pointsBalance: number,
  tier: TierKey,
): Promise<BirthdayCopy> {
  const t = await getTranslations({ locale, namespace: 'email.birthday' })
  const formatter = new Intl.NumberFormat(locale === 'ar' ? 'ar-BH' : 'en-GB')
  return {
    heading:       t('heading'),
    subheading:    t('subheading',    { name: customerName }),
    pointsAwarded: t('pointsAwarded', { points:  formatter.format(pointsAwarded)  }),
    balance:       t('balance',       { balance: formatter.format(pointsBalance) }),
    tier:          t('tier',          { tier:    t(`tierNames.${tier}`) }),
    accountCta:    t('accountCta'),
    whatsappCta:   t('whatsappCta'),
    footnote:      t('footnote'),
  }
}

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: 'cron_secret_unset' }, { status: 503 })
  }

  // T2-4: constant-time compare to neutralize early-mismatch timing oracles.
  // Same pattern as src/lib/payments/tap-client.ts:verifyWebhookSignature.
  const auth = req.headers.get('authorization') ?? ''
  const expectedHeader = `Bearer ${expected}`
  const expectedBuf = Buffer.from(expectedHeader)
  const actualBuf   = Buffer.from(auth)
  const lengthsMatch = expectedBuf.length === actualBuf.length
  const valuesMatch  = lengthsMatch && timingSafeEqual(expectedBuf, actualBuf)
  if (!valuesMatch) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - LOOKBACK_MS).toISOString()

  const supabase = createServiceClient()
  // T2-6: filter by `notified_at IS NULL` so a Vercel Cron retry (timeout,
  // transient 5xx) never re-sends to a customer who already got the email
  // in this window. The 2-hour `created_at` lookback still bounds the scan.
  const { data: credits, error } = await supabase
    .from('birthday_point_credits')
    .select('id, customer_id, year, points_credited, created_at')
    .gte('created_at', cutoff)
    .is('notified_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    // T2-5: never echo Postgres error text to the wire — log via Sentry
    // and return a generic code so an attacker probing the route can't
    // map DB internals.
    Sentry.captureException(error, { tags: { stage: 'birthday_notify.select' } })
    return NextResponse.json({ error: 'select_failed' }, { status: 500 })
  }

  const rows = credits ?? []
  if (rows.length === 0) {
    return NextResponse.json({ found: 0, notified: 0, failed: 0, cutoff })
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '')
  const [tAr, tEn] = await Promise.all([
    getTranslations({ locale: 'ar', namespace: 'email.birthday' }),
    getTranslations({ locale: 'en', namespace: 'email.birthday' }),
  ])
  const subject = `${tAr('subject')} · ${tEn('subject')}`

  // wa.me message text — bilingual, identical for every customer this
  // run. Built once outside the loop.
  const waText = encodeURIComponent(`${tAr('whatsappMessage')}\n\n${tEn('whatsappMessage')}`)
  const whatsappUrl = `https://wa.me/${DEFAULT_BRAND_WA_PHONE}?text=${waText}`

  let notified = 0
  let failed   = 0

  for (const credit of rows) {
    try {
      const { data: profile, error: pErr } = await supabase
        .from('customer_profiles')
        .select('id, name, email, points_balance, loyalty_tier')
        .eq('id', credit.customer_id)
        .single()

      if (pErr || !profile) {
        Sentry.captureException(
          new Error(pErr?.message ?? 'profile_not_found'),
          { tags: { stage: 'birthday_notify.profile_fetch' }, extra: { credit_id: credit.id } },
        )
        failed += 1
        continue
      }

      if (!profile.email) {
        // No email on file — there's nothing to send. Not a failure;
        // the points were credited regardless.
        continue
      }

      const customerName = profile.name?.trim() || (profile.email.split('@')[0] ?? '')
      const tier = (profile.loyalty_tier ?? 'bronze') as TierKey

      const [ar, en] = await Promise.all([
        buildCopy('ar', customerName, credit.points_credited, profile.points_balance, tier),
        buildCopy('en', customerName, credit.points_credited, profile.points_balance, tier),
      ])

      const accountUrl = `${siteUrl}/account`

      const result = await sendBirthdayBonus(profile.email, subject, {
        ar, en, accountUrl, whatsappUrl,
      })

      if (result.success) {
        // T2-6: mark this credit row as notified so cron retries skip it.
        // Best-effort UPDATE — the send already succeeded; an UPDATE failure
        // here just means a duplicate is possible on next retry. Logged for
        // observability so an operator can spot it.
        // Cast: notified_at is a fresh column (migration 172); types.ts has
        // not been regenerated. The DB-side schema is the source of truth.
        const { error: stampErr } = await supabase
          .from('birthday_point_credits')
          .update({ notified_at: new Date().toISOString() } as unknown as Record<string, never>)
          .eq('id', credit.id)
        if (stampErr) {
          Sentry.captureException(stampErr, {
            tags: { stage: 'birthday_notify.stamp' },
            extra: { credit_id: credit.id },
          })
        }
        notified += 1
      } else {
        failed += 1
        Sentry.captureMessage('birthday_notify.send_failed', {
          level: 'warning',
          tags:  { stage: 'birthday_notify.send' },
          extra: { credit_id: credit.id, customer_id: profile.id, error: result.error },
        })
      }
    } catch (err) {
      // Per-row catch so one customer's failure can't kill the batch.
      failed += 1
      Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
        tags: { stage: 'birthday_notify.loop' },
        extra: { credit_id: credit.id },
      })
    }
  }

  return NextResponse.json({
    found:    rows.length,
    notified,
    failed,
    cutoff,
  })
}
