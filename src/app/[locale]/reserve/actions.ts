'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import {
  BRANCHES,
  buildWaLinkForPhone,
  isHiddenBranch,
  type BranchId,
} from '@/constants/contact'

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v1/siteverify'

const createPublicSchema = z.object({
  branch_id:        z.string().min(1).max(50),
  guest_name:       z.string().trim().min(1).max(120),
  phone:            z.string().trim().min(7).max(30),
  party_size:       z.number().int().min(1).max(20),
  reserved_for:     z.string().datetime(),
  duration_minutes: z.number().int().min(30).max(300).default(90),
  special_requests: z.string().trim().max(500).optional(),
  website:          z.string().optional(),   // honeypot
  turnstileToken:   z.string().optional(),
  seating_type:     z.enum(['family_section', 'arabic_seating', 'outdoor', 'indoor']).nullable().optional(),
})

const findAvailableSchema = z.object({
  branch_id:        z.string().min(1).max(50),
  party_size:       z.number().int().min(1).max(20),
  reserved_for:     z.string().datetime(),
  duration_minutes: z.number().int().min(30).max(300).default(90),
})

export type CreatePublicReservationInput = z.infer<typeof createPublicSchema>
export type PublicFindAvailableInput     = z.infer<typeof findAvailableSchema>

export interface PublicAvailableTable {
  table_id:     string
  table_number: number
  capacity:     number
  label_ar:     string | null
  label_en:     string | null
}

export type CreatePublicReservationResult =
  | { success: true;  reservationId: string; waLink: string }
  | { success: false; error: 'rate_limit' | 'captcha' | 'conflict' | 'invalid_phone' | 'invalid_party_size' | 'invalid_branch' | 'invalid_input' | 'server_error' }

function isBranchId(value: string): value is BranchId {
  return value in BRANCHES
}

async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  // Soft-launch: if no secret is configured (e.g. local dev), fall back to
  // honeypot only. Same pattern as src/app/[locale]/contact/actions.ts.
  if (!secret) return true
  if (!token)  return false

  try {
    const headersList = await headers()
    const ip = headersList.get('x-forwarded-for')?.split(',')[0].trim()
            ?? headersList.get('x-real-ip')
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
    list.get('x-forwarded-for')?.split(',')[0].trim()
    ?? list.get('x-real-ip')
    ?? '127.0.0.1'
  )
}

export async function publicFindAvailableTables(
  input: PublicFindAvailableInput,
): Promise<PublicAvailableTable[]> {
  const parsed = findAvailableSchema.safeParse(input)
  if (!parsed.success) return []

  if (!isBranchId(parsed.data.branch_id) || isHiddenBranch(parsed.data.branch_id)) return []

  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('rpc_find_available_tables', {
    p_branch_id:        parsed.data.branch_id,
    p_party_size:       parsed.data.party_size,
    p_reserved_for:     parsed.data.reserved_for,
    p_duration_minutes: parsed.data.duration_minutes,
  })

  if (error) return []
  return (data ?? []) as PublicAvailableTable[]
}

export async function createPublicReservation(
  input: CreatePublicReservationInput,
): Promise<CreatePublicReservationResult> {
  // Honeypot: bots fill `website`; real users leave it blank.
  if (input.website && input.website.trim().length > 0) {
    // Pretend success to confuse bots; nothing is written.
    return { success: false, error: 'invalid_input' }
  }

  // 1. Turnstile (skipped if not configured)
  const captchaOk = await verifyTurnstile(input.turnstileToken ?? '')
  if (!captchaOk) return { success: false, error: 'captcha' }

  // 2. Schema validation
  const parsed = createPublicSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'invalid_input' }
  const data = parsed.data

  if (!isBranchId(data.branch_id) || isHiddenBranch(data.branch_id)) {
    return { success: false, error: 'invalid_branch' }
  }

  // 3. Rate limit: 3 submissions / IP / hour (stricter than contact's 5/h
  //    because reservation writes hit the DB and produce SLA on staff side).
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const [{ Ratelimit }, { Redis }] = await Promise.all([
      import('@upstash/ratelimit'),
      import('@upstash/redis'),
    ])
    const ratelimit = new Ratelimit({
      redis:   Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(3, '1 h'),
    })
    const ip = await getClientIp()
    const { success: allowed } = await ratelimit.limit(`reserve:${ip}`)
    if (!allowed) return { success: false, error: 'rate_limit' }
  }

  // 4. RPC call — service-role bypasses the auth gate inside the function.
  const supabase = createServiceClient()
  const { data: reservationId, error } = await supabase.rpc('rpc_create_reservation', {
    p_branch_id:        data.branch_id,
    p_guest_name:       data.guest_name,
    p_phone:            data.phone,
    p_party_size:       data.party_size,
    p_reserved_for:     data.reserved_for,
    p_duration_minutes: data.duration_minutes,
    p_special_requests: data.special_requests?.length ? data.special_requests : undefined,
    p_source:           'website',
    p_seating_type:     data.seating_type ?? undefined,
  })

  if (error) {
    const message = error.message ?? ''
    if (message.includes('RESERVATION_CONFLICT')) return { success: false, error: 'conflict' }
    if (message.includes('INVALID_PHONE'))         return { success: false, error: 'invalid_phone' }
    if (message.includes('INVALID_PARTY_SIZE'))    return { success: false, error: 'invalid_party_size' }
    return { success: false, error: 'server_error' }
  }

  // 5. WhatsApp confirmation link to the chosen branch's number — opens a
  //    pre-filled message so the guest can confirm with staff. No PII other
  //    than the booking summary is sent through wa.me URL params.
  const branch = BRANCHES[data.branch_id as BranchId]
  const when   = new Date(data.reserved_for)
  const isoDate = when.toISOString().slice(0, 10)
  const isoTime = when.toISOString().slice(11, 16)
  const summary = `Reservation #${String(reservationId).slice(-8).toUpperCase()} — ${data.guest_name} · ${data.party_size}p · ${isoDate} ${isoTime} · ${branch.nameEn}`
  const waLink = buildWaLinkForPhone(branch.phone, summary)

  return { success: true, reservationId: reservationId as unknown as string, waLink }
}
