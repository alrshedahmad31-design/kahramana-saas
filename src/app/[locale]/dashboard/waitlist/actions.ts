'use server'

import { revalidatePath } from 'next/cache'
import { getLocale, getTranslations } from 'next-intl/server'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  assertBranchScope,
  getDashboardGuardErrorMessage,
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

// Maps the RPC's typed { ok=false, code } payload onto the localized
// waitlist.errors.* keys the UI throws to its catch handler.
function mapRpcCode(t: (key: string) => string, code: string, fallback: string): string {
  switch (code) {
    case 'invalid_input':         return t('invalidInput')
    case 'forbidden_role':        return t('forbiddenRole')
    case 'forbidden_branch':      return t('forbiddenBranch')
    case 'forbidden_transition':  return t('forbiddenTransition')
    case 'not_found':             return t('notFound')
    case 'conflict':              return t('conflict')
    default:                      return fallback
  }
}

type RpcOk<T extends object>  = { ok: true } & T
type RpcErr                   = { ok: false; code: string }
type RpcResult<T extends object> = RpcOk<T> | RpcErr

function isRpcResult<T extends object>(v: unknown): v is RpcResult<T> {
  return typeof v === 'object' && v !== null && 'ok' in v
}

export async function addToWaitlist(data: AddWaitlistInput): Promise<void> {
  const t = await getTranslations('waitlist.errors')

  const parsed = addWaitlistSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(t('invalidInput'))
  }

  try {
    await requireWaitlistAccess(parsed.data.branch_id)
  } catch (error) {
    throw new Error(getDashboardGuardErrorMessage(error))
  }

  // Atomic: rpc_add_waitlist_entry (migration 168) re-checks role + branch
  // under SECURITY DEFINER, runs the shape guards mirroring the table CHECKs,
  // and writes audit_logs in the same transaction.
  const supabase = await createClient()
  const { data: rpcRaw, error } = await supabase.rpc('rpc_add_waitlist_entry', {
    p_branch_id:  parsed.data.branch_id,
    p_guest_name: parsed.data.guest_name,
    p_phone:      parsed.data.phone,
    p_party_size: parsed.data.party_size,
    p_notes:      parsed.data.notes?.length ? parsed.data.notes : undefined,
  })

  if (error) {
    Sentry.captureException(error, { tags: { action: 'addToWaitlist' } })
    throw new Error(t('addFailed'))
  }

  const rpc = isRpcResult<{ id: string }>(rpcRaw) ? rpcRaw : null
  if (!rpc) {
    Sentry.captureException(new Error('rpc_add_waitlist_entry unexpected payload'), {
      tags:  { action: 'addToWaitlist' },
      extra: { payload: rpcRaw },
    })
    throw new Error(t('addFailed'))
  }
  if (!rpc.ok) {
    throw new Error(mapRpcCode(t, rpc.code, t('addFailed')))
  }

  const locale = await getLocale()
  revalidatePath(`/${locale}/dashboard/waitlist`)
}

export async function updateStatus(id: string, status: WaitlistStatus): Promise<void> {
  const t = await getTranslations('waitlist.errors')

  const parsedId = z.string().uuid().safeParse(id)
  const parsedStatus = statusSchema.safeParse(status)
  if (!parsedId.success || !parsedStatus.success) {
    throw new Error(t('invalidInput'))
  }

  try {
    await requireWaitlistAccess()
  } catch (error) {
    throw new Error(getDashboardGuardErrorMessage(error))
  }

  // Pre-RPC snapshot used only to derive the expected_status for the CAS
  // predicate inside the RPC. The RPC re-reads + locks the row itself and
  // re-checks role / branch / transition, so this read is purely advisory.
  const service = await createServiceClient()
  const { data: entry, error: fetchError } = await service
    .from('waitlist_entries')
    .select('status')
    .eq('id', parsedId.data)
    .single()

  if (fetchError || !entry) {
    if (fetchError) Sentry.captureException(fetchError, { tags: { action: 'updateWaitlistStatus.fetch' } })
    throw new Error(t('notFound'))
  }
  const expected = normalizeStatus(entry.status)

  const supabase = await createClient()
  const { data: rpcRaw, error } = await supabase.rpc('rpc_update_waitlist_status', {
    p_entry_id:        parsedId.data,
    p_target_status:   parsedStatus.data,
    p_expected_status: expected,
  })

  if (error) {
    Sentry.captureException(error, { tags: { action: 'updateWaitlistStatus' } })
    throw new Error(t('updateFailed'))
  }

  const rpc = isRpcResult<{ status: WaitlistStatus }>(rpcRaw) ? rpcRaw : null
  if (!rpc) {
    Sentry.captureException(new Error('rpc_update_waitlist_status unexpected payload'), {
      tags:  { action: 'updateWaitlistStatus' },
      extra: { payload: rpcRaw },
    })
    throw new Error(t('updateFailed'))
  }
  if (!rpc.ok) {
    throw new Error(mapRpcCode(t, rpc.code, t('updateFailed')))
  }

  const locale = await getLocale()
  revalidatePath(`/${locale}/dashboard/waitlist`)
}

export async function getWaitlist(branchId: string): Promise<WaitlistEntry[]> {
  const t = await getTranslations('waitlist.errors')

  const parsedBranch = z.string().min(1).max(50).safeParse(branchId)
  if (!parsedBranch.success) throw new Error(t('invalidBranch'))

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

  if (error) {
    Sentry.captureException(error, { tags: { action: 'getWaitlist' } })
    throw new Error(t('updateFailed'))
  }

  return (data ?? []).map(normalizeEntry)
}
