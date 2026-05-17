'use server'

import { revalidatePath } from 'next/cache'
import { getLocale } from 'next-intl/server'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { createServiceClient } from '@/lib/supabase/server'
import {
  assertBranchScope,
  getDashboardGuardErrorMessage,
  isGlobalDashboardAdmin,
  requireDashboardSection,
} from '@/lib/auth/dashboard-guards'
import type { WaitlistEntryRow, WaitlistStatus } from '@/lib/supabase/custom-types'

const WAITLIST_STATUSES: readonly WaitlistStatus[] = ['waiting', 'notified', 'seated', 'cancelled']

const addWaitlistSchema = z.object({
  branch_id:   z.string().min(1).max(50),
  guest_name:  z.string().trim().min(1).max(120),
  phone:       z.string().regex(/^\+973\d{8}$/),
  party_size:  z.number().int().min(1).max(20),
  notes:       z.string().trim().max(500).optional(),
})

const statusSchema = z.enum(['waiting', 'notified', 'seated', 'cancelled'])

// Server-enforced lifecycle for waitlist entries.
const ALLOWED_WAITLIST_TRANSITIONS: Record<WaitlistStatus, readonly WaitlistStatus[]> = {
  waiting:   ['notified', 'seated', 'cancelled'],
  notified:  ['seated', 'cancelled'],
  seated:    [],
  cancelled: [],
}

export type WaitlistEntry = Omit<WaitlistEntryRow, 'status'> & {
  status: WaitlistStatus
}

export type AddWaitlistInput = z.infer<typeof addWaitlistSchema>

function normalizeStatus(status: string): WaitlistStatus {
  return WAITLIST_STATUSES.includes(status as WaitlistStatus)
    ? (status as WaitlistStatus)
    : 'waiting'
}

function normalizeEntry(row: WaitlistEntryRow): WaitlistEntry {
  return {
    ...row,
    status: normalizeStatus(row.status),
  }
}

async function requireWaitlistAccess(branchId?: string) {
  const user = await requireDashboardSection('waitlist')
  if (branchId) assertBranchScope(user, branchId)
  return user
}

export async function addToWaitlist(data: AddWaitlistInput): Promise<void> {
  const parsed = addWaitlistSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid waitlist entry')
  }

  try {
    await requireWaitlistAccess(parsed.data.branch_id)
  } catch (error) {
    throw new Error(getDashboardGuardErrorMessage(error))
  }

  const supabase = createServiceClient()
  const { error } = await supabase.from('waitlist_entries').insert({
    branch_id:   parsed.data.branch_id,
    guest_name:  parsed.data.guest_name,
    phone:       parsed.data.phone,
    party_size:  parsed.data.party_size,
    notes:       parsed.data.notes?.length ? parsed.data.notes : null,
  })

  if (error) {
    Sentry.captureException(error, { tags: { action: 'addToWaitlist' } })
    throw new Error(error.message)
  }

  const locale = await getLocale()
  revalidatePath(`/${locale}/dashboard/waitlist`)
}

export async function updateStatus(id: string, status: WaitlistStatus): Promise<void> {
  const parsedId = z.string().uuid().safeParse(id)
  const parsedStatus = statusSchema.safeParse(status)
  if (!parsedId.success || !parsedStatus.success) {
    throw new Error('Invalid waitlist status update')
  }

  let user
  try {
    user = await requireWaitlistAccess()
  } catch (error) {
    throw new Error(getDashboardGuardErrorMessage(error))
  }

  const supabase = createServiceClient()
  const { data: entry, error: fetchError } = await supabase
    .from('waitlist_entries')
    .select('id, branch_id, status')
    .eq('id', parsedId.data)
    .single()

  if (fetchError || !entry) throw new Error(fetchError?.message ?? 'Waitlist entry not found')
  if (!isGlobalDashboardAdmin(user)) assertBranchScope(user, entry.branch_id)

  const currentStatus = normalizeStatus(entry.status)
  if (currentStatus !== parsedStatus.data) {
    const allowed = ALLOWED_WAITLIST_TRANSITIONS[currentStatus]
    if (!allowed.includes(parsedStatus.data)) {
      throw new Error(`Invalid waitlist transition: ${currentStatus} → ${parsedStatus.data}`)
    }
  }

  const now = new Date().toISOString()
  const patch = {
    status:      parsedStatus.data,
    notified_at: parsedStatus.data === 'notified' ? now : undefined,
    seated_at:   parsedStatus.data === 'seated' ? now : undefined,
  }

  // P1-26 CAS predicate on status — mirrors reservations updateStatus pattern.
  const { data: updated, error } = await supabase
    .from('waitlist_entries')
    .update(patch)
    .eq('id', parsedId.data)
    .eq('status', currentStatus)
    .select('id')
    .single()

  if (error) {
    Sentry.captureException(error, { tags: { action: 'updateWaitlistStatus' } })
    throw new Error(error.message)
  }
  if (!updated) throw new Error('Waitlist status changed concurrently; refresh and try again')

  const locale = await getLocale()
  revalidatePath(`/${locale}/dashboard/waitlist`)
}

export async function getWaitlist(branchId: string): Promise<WaitlistEntry[]> {
  const parsedBranch = z.string().min(1).max(50).safeParse(branchId)
  if (!parsedBranch.success) throw new Error('Invalid branch')

  try {
    await requireWaitlistAccess(parsedBranch.data)
  } catch (error) {
    throw new Error(getDashboardGuardErrorMessage(error))
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('waitlist_entries')
    .select('id, branch_id, guest_name, phone, party_size, status, notes, notified_at, seated_at, created_at')
    .eq('branch_id', parsedBranch.data)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map(normalizeEntry)
}
