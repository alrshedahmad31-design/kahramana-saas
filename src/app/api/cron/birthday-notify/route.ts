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

  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - LOOKBACK_MS).toISOString()

  const supabase = createServiceClient()
  const { data: credits, error } = await supabase
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
