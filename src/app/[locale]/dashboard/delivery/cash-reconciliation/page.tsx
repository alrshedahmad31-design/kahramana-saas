import { redirect }   from 'next/navigation'
import { getSession }  from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import CashReconciliationClient from '@/components/delivery/CashReconciliationClient'

export const dynamic = 'force-dynamic'

const MANAGER_ROLES = new Set(['owner', 'general_manager', 'branch_manager'])

interface Props {
  params:       Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | undefined>>
}

export type ReconciliationStatus = 'pending' | 'verified' | 'discrepancy' | 'disputed'

export type CashHandoverRow = {
  id:                    string
  driver_id:             string
  driver_name:           string
  shift_date:            string
  total_cash:            number
  order_ids:             string[]
  handed_at:             string
  verified:              boolean
  notes:                 string | null
  reconciliation_status: ReconciliationStatus
  actual_received:       number | null
  discrepancy:           number | null
  manager_notes:         string | null
}

export default async function CashReconciliationPage({ params, searchParams: _searchParams }: Props) {
  const { locale } = await params
  const isAr       = locale === 'ar'
  const prefix     = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(`${prefix}/login`)
  if (!MANAGER_ROLES.has(user.role ?? '')) {
    redirect(`${prefix}/dashboard`)
  }

  const supabase = await createClient()

  // Fetch handovers with driver name via join — type assertion needed until
  // supabase types are regenerated after migration 029 is applied.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: raw } = await db
    .from('driver_cash_handovers')
    .select(`
      id, driver_id, shift_date, total_cash, order_ids, handed_at, verified, notes,
      reconciliation_status, actual_received, discrepancy, manager_notes,
      staff_basic!driver_id(name)
    `)
    .order('handed_at', { ascending: false })
    .limit(100)

  const handovers: CashHandoverRow[] = (raw ?? []).map((r: {
    id: string
    driver_id: string
    shift_date: string
    total_cash: number
    order_ids: string[]
    handed_at: string
    verified: boolean
    notes: string | null
    reconciliation_status: string | null
    actual_received: number | null
    discrepancy: number | null
    manager_notes: string | null
    staff_basic: { name: string } | null
  }) => ({
    id:                    r.id,
    driver_id:             r.driver_id,
    driver_name:           r.staff_basic?.name ?? r.driver_id.slice(0, 8),
    shift_date:            r.shift_date,
    total_cash:            Number(r.total_cash),
    order_ids:             r.order_ids ?? [],
    handed_at:             r.handed_at,
    verified:              r.verified,
    notes:                 r.notes,
    reconciliation_status: (r.reconciliation_status ?? 'pending') as ReconciliationStatus,
    actual_received:       r.actual_received != null ? Number(r.actual_received) : null,
    discrepancy:           r.discrepancy != null ? Number(r.discrepancy) : null,
    manager_notes:         r.manager_notes,
  }))

  return (
    <CashReconciliationClient
      handovers={handovers}
      isAr={isAr}
      prefix={prefix}
    />
  )
}
