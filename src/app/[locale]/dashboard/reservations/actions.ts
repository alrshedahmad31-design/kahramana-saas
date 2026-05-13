'use server'

import { revalidatePath } from 'next/cache'
import { getLocale } from 'next-intl/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import {
  assertBranchScope,
  getDashboardGuardErrorMessage,
  isGlobalDashboardAdmin,
  requireDashboardSection,
} from '@/lib/auth/dashboard-guards'
import type {
  ReservationRow,
  ReservationSource,
  ReservationStatus,
  SeatingType,
} from '@/lib/supabase/custom-types'

const RESERVATION_STATUSES: readonly ReservationStatus[] = [
  'pending', 'confirmed', 'seated', 'no_show', 'cancelled', 'completed',
]
const RESERVATION_SOURCES: readonly ReservationSource[] = [
  'website', 'phone', 'walk_in', 'staff',
]

const createReservationSchema = z.object({
  branch_id:        z.string().min(1).max(50),
  guest_name:       z.string().trim().min(1).max(120),
  phone:            z.string().trim().min(7).max(30),
  party_size:       z.number().int().min(1).max(50),
  reserved_for:     z.string().datetime(),
  duration_minutes: z.number().int().min(30).max(300).default(90),
  table_id:         z.string().uuid().nullable().optional(),
  special_requests: z.string().trim().max(500).optional(),
  source:           z.enum(['website', 'phone', 'walk_in', 'staff']).default('staff'),
  seating_type:     z.enum(['family_section', 'arabic_seating', 'outdoor', 'indoor']).nullable().optional(),
})

const findAvailableSchema = z.object({
  branch_id:        z.string().min(1).max(50),
  party_size:       z.number().int().min(1).max(50),
  reserved_for:     z.string().datetime(),
  duration_minutes: z.number().int().min(30).max(300),
})

const statusSchema = z.enum(['pending', 'confirmed', 'seated', 'no_show', 'cancelled', 'completed'])

// Server-enforced lifecycle. Staff cannot jump pending → completed or revive
// terminal states (no_show / cancelled / completed). Keep parallel with
// supabase migration if/when a DB-side check is added.
const ALLOWED_RESERVATION_TRANSITIONS: Record<ReservationStatus, readonly ReservationStatus[]> = {
  pending:   ['confirmed', 'cancelled', 'no_show'],
  confirmed: ['seated', 'cancelled', 'no_show'],
  seated:    ['completed', 'cancelled'],
  no_show:   [],
  cancelled: [],
  completed: [],
}

export type Reservation = Omit<ReservationRow, 'status' | 'source' | 'seating_type'> & {
  status: ReservationStatus
  source: ReservationSource
  seating_type?: SeatingType | null
}

export type CreateReservationInput = z.infer<typeof createReservationSchema>
export type FindAvailableInput     = z.infer<typeof findAvailableSchema>

export interface AvailableTable {
  table_id:     string
  table_number: number
  capacity:     number
  label_ar:     string | null
  label_en:     string | null
}

function normalizeStatus(s: string): ReservationStatus {
  return RESERVATION_STATUSES.includes(s as ReservationStatus)
    ? (s as ReservationStatus)
    : 'pending'
}

function normalizeSource(s: string): ReservationSource {
  return RESERVATION_SOURCES.includes(s as ReservationSource)
    ? (s as ReservationSource)
    : 'staff'
}

function normalize(row: ReservationRow): Reservation {
  return {
    ...row,
    status: normalizeStatus(row.status),
    source: normalizeSource(row.source),
  }
}

async function requireReservationsAccess(branchId?: string) {
  const user = await requireDashboardSection('reservations')
  if (branchId) assertBranchScope(user, branchId)
  return user
}

export async function getReservations(branchId: string): Promise<Reservation[]> {
  const parsedBranch = z.string().min(1).max(50).safeParse(branchId)
  if (!parsedBranch.success) throw new Error('Invalid branch')

  try {
    await requireReservationsAccess(parsedBranch.data)
  } catch (error) {
    throw new Error(getDashboardGuardErrorMessage(error))
  }

  // Show today (UTC) and future. Past reservations from today still appear
  // so staff can mark walk-ins as completed / no-show retroactively.
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('branch_id', parsedBranch.data)
    .gte('reserved_for', start.toISOString())
    .order('reserved_for', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map(normalize)
}

export async function findAvailableTables(input: FindAvailableInput): Promise<AvailableTable[]> {
  const parsed = findAvailableSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid availability query')
  }

  try {
    await requireReservationsAccess(parsed.data.branch_id)
  } catch (error) {
    throw new Error(getDashboardGuardErrorMessage(error))
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('rpc_find_available_tables', {
    p_branch_id:        parsed.data.branch_id,
    p_party_size:       parsed.data.party_size,
    p_reserved_for:     parsed.data.reserved_for,
    p_duration_minutes: parsed.data.duration_minutes,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as AvailableTable[]
}

export async function createReservation(input: CreateReservationInput): Promise<string> {
  const parsed = createReservationSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid reservation')
  }

  try {
    await requireReservationsAccess(parsed.data.branch_id)
  } catch (error) {
    throw new Error(getDashboardGuardErrorMessage(error))
  }

  const d = parsed.data
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('rpc_create_reservation', {
    p_branch_id:        d.branch_id,
    p_guest_name:       d.guest_name,
    p_phone:            d.phone,
    p_party_size:       d.party_size,
    p_reserved_for:     d.reserved_for,
    p_duration_minutes: d.duration_minutes,
    p_table_id:         d.table_id ?? undefined,
    p_special_requests: d.special_requests?.length ? d.special_requests : undefined,
    p_source:           d.source,
    p_seating_type:     d.seating_type ?? undefined,
  })

  if (error) throw new Error(error.message)

  const locale = await getLocale()
  revalidatePath(`/${locale}/dashboard/reservations`)
  return data as unknown as string
}

export async function updateReservationStatus(
  id: string,
  status: ReservationStatus,
): Promise<void> {
  const parsedId = z.string().uuid().safeParse(id)
  const parsedStatus = statusSchema.safeParse(status)
  if (!parsedId.success || !parsedStatus.success) {
    throw new Error('Invalid reservation status update')
  }

  let user
  try {
    user = await requireReservationsAccess()
  } catch (error) {
    throw new Error(getDashboardGuardErrorMessage(error))
  }

  const supabase = createServiceClient()
  const { data: row, error: fetchError } = await supabase
    .from('reservations')
    .select('id, branch_id, status')
    .eq('id', parsedId.data)
    .single()

  if (fetchError || !row) throw new Error(fetchError?.message ?? 'Reservation not found')
  if (!isGlobalDashboardAdmin(user)) assertBranchScope(user, row.branch_id)

  const currentStatus = normalizeStatus(row.status)
  if (currentStatus !== parsedStatus.data) {
    const allowed = ALLOWED_RESERVATION_TRANSITIONS[currentStatus]
    if (!allowed.includes(parsedStatus.data)) {
      throw new Error(`Invalid reservation transition: ${currentStatus} → ${parsedStatus.data}`)
    }
  }

  const now = new Date().toISOString()
  const patch: {
    status:        ReservationStatus
    confirmed_at?: string
    seated_at?:    string
    cancelled_at?: string
    completed_at?: string
  } = { status: parsedStatus.data }
  if (parsedStatus.data === 'confirmed') patch.confirmed_at = now
  if (parsedStatus.data === 'seated')    patch.seated_at    = now
  if (parsedStatus.data === 'cancelled') patch.cancelled_at = now
  if (parsedStatus.data === 'completed') patch.completed_at = now

  const { error } = await supabase
    .from('reservations')
    .update(patch)
    .eq('id', parsedId.data)

  if (error) throw new Error(error.message)

  const locale = await getLocale()
  revalidatePath(`/${locale}/dashboard/reservations`)
}
