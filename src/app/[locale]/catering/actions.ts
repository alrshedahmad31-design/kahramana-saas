'use server'

import { headers } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import {
  BRANCHES,
  type BranchId,
} from '@/constants/contact'
import {
  buildCateringWhatsappLink,
  CATERING_OCCASION_TYPES,
  CATERING_SERVICE_TYPES,
  type CateringInquiryValues,
  type CateringWhatsappCopy,
} from '@/lib/whatsapp-catering-message'

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v1/siteverify'

// Mirrors CateringInquiryValues. Two distinctions vs the wa.me payload:
//   1. guest_count is coerced from the form's free-text string to int
//      so the DB column (INT) and any analytics can rely on a number.
//   2. event_date / event_time are taken as-is (HTML5 date/time pickers
//      already produce YYYY-MM-DD / HH:mm). event_time is optional at
//      the DB level so we accept empty here and write NULL.
const occasionTypeEnum = z.enum(CATERING_OCCASION_TYPES)
const serviceTypeEnum  = z.enum(CATERING_SERVICE_TYPES)

// z.object over the enum keys (vs z.record) so the inferred type is a
// full Record<K, string> instead of Partial<Record<K, string>>. The form
// always supplies every key; missing keys are a client bug, not user input.
const occasionTypesSchema = z.object(
  Object.fromEntries(
    CATERING_OCCASION_TYPES.map((k) => [k, z.string().min(1)]),
  ) as Record<(typeof CATERING_OCCASION_TYPES)[number], z.ZodString>,
)
const serviceTypesSchema = z.object(
  Object.fromEntries(
    CATERING_SERVICE_TYPES.map((k) => [k, z.string().min(1)]),
  ) as Record<(typeof CATERING_SERVICE_TYPES)[number], z.ZodString>,
)

const PHONE_RE = /^[\d +\-()+]{7,30}$/

const submitSchema = z.object({
  name:             z.string().trim().min(1).max(200),
  phone:            z.string().trim().min(8).max(30).regex(PHONE_RE),
  occasion_type:    occasionTypeEnum,
  event_date:       z.string().refine((val) => !Number.isNaN(Date.parse(val)), {
                      message: 'invalid_event_date',
                    }),
  event_time:       z.string().trim().regex(/^\d{2}:\d{2}$/).optional().or(z.literal('')),
  guest_count:      z.coerce.number().int().positive().max(1000),
  area:             z.string().trim().min(1).max(300),
  service_type:     serviceTypeEnum,
  preferred_branch: z.string().optional(),
  budget:           z.string().trim().max(100).optional().or(z.literal('')),
  notes:            z.string().trim().min(1).max(2000),
  website:          z.string().optional(),   // honeypot
  turnstileToken:   z.string().optional(),
  // i18n copy for the wa.me message body — passed from the client so
  // the message body matches the user's locale without bundling the
  // catering i18n namespace into a 'use server' module.
  whatsappCopy:     z.object({
                      title:      z.string().min(1),
                      emptyValue: z.string().min(1),
                      labels:     z.object({
                        name:            z.string().min(1),
                        phone:           z.string().min(1),
                        occasionType:    z.string().min(1),
                        eventDate:       z.string().min(1),
                        eventTime:       z.string().min(1),
                        guestCount:      z.string().min(1),
                        area:            z.string().min(1),
                        preferredBranch: z.string().min(1),
                        serviceType:     z.string().min(1),
                        notes:           z.string().min(1),
                        budget:          z.string().min(1),
                      }),
                      occasionTypes: occasionTypesSchema,
                      serviceTypes:  serviceTypesSchema,
                    }),
})

export type CreateCateringInquiryInput = z.input<typeof submitSchema>

export type CreateCateringInquiryResult =
  | { success: true;  inquiryId: string; waLink: string }
  | { success: false; error: 'rate_limit' | 'captcha' | 'invalid_input' | 'server_error' }

async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  // Production fails closed when the secret isn't configured. Dev/preview
  // fall through to honeypot-only so local testing isn't blocked. Same
  // pattern as contact/reserve.
  if (!secret) {
    if (process.env.NODE_ENV === 'production') return false
    return true
  }
  if (!token)  return false

  try {
    const headersList = await headers()
    const ip = headersList.get('x-real-ip')
            ?? headersList.get('x-forwarded-for')?.split(',')[0].trim()
            ?? undefined

    const body = new URLSearchParams({ secret, response: token })
    if (ip) body.set('remoteip', ip)

    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!res.ok) return false
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch {
    return false
  }
}

async function getClientIp(): Promise<string> {
  const list = await headers()
  return (
    list.get('x-real-ip')
    ?? list.get('x-forwarded-for')?.split(',')[0].trim()
    ?? '127.0.0.1'
  )
}

function isBranchId(value: string): value is BranchId {
  return value in BRANCHES
}

export async function createCateringInquiry(
  input: CreateCateringInquiryInput,
): Promise<CreateCateringInquiryResult> {
  // 1. Honeypot — bots fill `website`, real users leave it blank.
  if (input.website && input.website.trim().length > 0) {
    return { success: false, error: 'invalid_input' }
  }

  // 2. Turnstile (no-op in dev when the secret isn't set)
  const captchaOk = await verifyTurnstile(input.turnstileToken ?? '')
  if (!captchaOk) return { success: false, error: 'captcha' }

  // 3. Schema validation
  const parsed = submitSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'invalid_input' }
  const data = parsed.data

  // 4. Rate limit: 3 submissions / IP / hour — matches reserve action.
  //    Production fails closed when Upstash is missing or the call
  //    throws — no silent bypass. Dev/preview share 127.0.0.1 so the
  //    gate stays skipped there.
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      Sentry.captureMessage('catering.rate_limit_unconfigured', { level: 'warning' })
      return { success: false, error: 'rate_limit' }
    }
    try {
      const [{ Ratelimit }, { Redis }] = await Promise.all([
        import('@upstash/ratelimit'),
        import('@upstash/redis'),
      ])
      const ratelimit = new Ratelimit({
        redis:   Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(3, '1 h'),
      })
      const ip = await getClientIp()
      const { success: allowed } = await ratelimit.limit(`catering:${ip}`)
      if (!allowed) return { success: false, error: 'rate_limit' }
    } catch (err) {
      Sentry.captureException(err, { tags: { stage: 'catering.rate_limit' } })
      return { success: false, error: 'rate_limit' }
    }
  }

  // 5. Persist. service_role bypasses RLS — the table has no policies
  //    for anon/authenticated, so this is the only intended write path.
  const preferredBranch = data.preferred_branch && isBranchId(data.preferred_branch)
    ? data.preferred_branch
    : null

  const supabase = createServiceClient()
  const { data: inserted, error } = await supabase
    .from('catering_inquiries')
    .insert({
      name:             data.name,
      phone:            data.phone,
      occasion_type:    data.occasion_type,
      event_date:       data.event_date,
      event_time:       data.event_time && data.event_time.length > 0 ? data.event_time : null,
      guest_count:      data.guest_count,
      area:             data.area,
      service_type:     data.service_type,
      preferred_branch: preferredBranch,
      budget:           data.budget && data.budget.length > 0 ? data.budget : null,
      notes:            data.notes,
    })
    .select('id')
    .single()

  if (error || !inserted) {
    return { success: false, error: 'server_error' }
  }

  // 6. WhatsApp handoff — kept as the UX layer on top of the persisted
  //    inquiry. The branch's number is resolved the same way the
  //    client-only path used to: form preference or default branch.
  const waValues: CateringInquiryValues = {
    name:             data.name,
    phone:            data.phone,
    occasionType:     data.occasion_type,
    eventDate:        data.event_date,
    eventTime:        data.event_time ?? '',
    guestCount:       String(data.guest_count),
    area:             data.area,
    preferredBranch:  preferredBranch ?? '',
    serviceType:      data.service_type,
    notes:            data.notes,
    budget:           data.budget ?? '',
  }
  const copy: CateringWhatsappCopy = data.whatsappCopy
  // Append the inquiry id so staff can correlate WA messages with rows
  // in catering_inquiries.
  const shortId = inserted.id.slice(-8).toUpperCase()
  const copyWithRef: CateringWhatsappCopy = {
    ...copy,
    title: `${copy.title} #${shortId}`,
  }
  const waLink = buildCateringWhatsappLink(waValues, copyWithRef)

  return { success: true, inquiryId: inserted.id, waLink }
}
