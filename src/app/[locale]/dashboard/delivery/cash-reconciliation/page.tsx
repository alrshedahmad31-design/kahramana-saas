import { redirect }   from 'next/navigation'
import { requireDashboardRole } from '@/lib/auth/dashboard-guards'
import { createClient } from '@/lib/supabase/server'
import CashReconciliationClient from '@/components/delivery/CashReconciliationClient'

export const dynamic = 'force-dynamic'

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
  is_new_system?:        boolean
}

export default async function CashReconciliationPage({ params, searchParams: _searchParams }: Props) {
  const { locale } = await params
  const isAr       = locale === 'ar'
  const prefix     = locale === 'en' ? '/en' : ''

  let user
  try {
    user = await requireDashboardRole(['owner', 'general_manager', 'branch_manager'])
  } catch {
    redirect(`${prefix}/dashboard`)
  }

  const supabase = await createClient()

  let scopedDriverIds: string[] | null = null
  if (user.role === 'branch_manager') {
    if (!user.branch_id) redirect(`${prefix}/dashboard`)
    const { data: drivers } = await supabase
      .from('staff_basic')
      .select('id')
      .eq('role', 'driver')
      .eq('branch_id', user.branch_id)

    scopedDriverIds = (drivers ?? []).map((driver: { id: string }) => driver.id)
  }

  // ── NEW Table: cash_handovers ───────────────────────────────────────────
  let newQuery = supabase
    .from('cash_handovers')
    .select(`
      id, driver_id, expected_amount, actual_amount, difference, manager_confirmed,
      order_ids, created_at, staff_basic!driver_id(name)
    `)
    .order('created_at', { ascending: false })

  if (scopedDriverIds) {
    newQuery = newQuery.in('driver_id', (scopedDriverIds.length === 0 ? ['00000000-0000-0000-0000-000000000000'] : scopedDriverIds))
  }

  const { data: handoversData } = await newQuery
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newHandovers: CashHandoverRow[] = (handoversData ?? []).map((h: any) => ({
    id:                    h.id,
    driver_id:             h.driver_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    driver_name:           (h.staff_basic as any)?.name ?? h.driver_id.slice(0, 8),
    shift_date:            h.created_at.split('T')[0],
    total_cash:            Number(h.expected_amount),
    order_ids:             h.order_ids ?? [],
    handed_at:             h.created_at,
    verified:              h.manager_confirmed,
    notes:                 null,
    reconciliation_status: h.manager_confirmed ? 'verified' : 'pending',
    actual_received:       Number(h.actual_amount),
    discrepancy:           Number(h.difference),
    manager_notes:         null,
    is_new_system:         true
  }))

  // ── Legacy Table ────────────────────────────────────────────────────────
  let query = supabase
    .from('driver_cash_handovers')
    .select(`
      id, driver_id, shift_date, total_cash, order_ids, handed_at, verified, notes,
      reconciliation_status, actual_received, discrepancy, manager_notes,
      staff_basic!driver_id(name)
    `)
    .order('handed_at', { ascending: false })
    .limit(50)

  if (scopedDriverIds) {
    query = query.in('driver_id', (scopedDriverIds.length === 0 ? ['00000000-0000-0000-0000-000000000000'] : scopedDriverIds))
  }

  const { data: raw } = await query

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const oldHandovers: CashHandoverRow[] = (raw ?? []).map((r: any) => ({
    id:                    r.id,
    driver_id:             r.driver_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    driver_name:           (r.staff_basic as any)?.name ?? r.driver_id.slice(0, 8),
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

  const handovers = [...newHandovers, ...oldHandovers].sort(
    (a, b) => new Date(b.handed_at).getTime() - new Date(a.handed_at).getTime()
  )

  return (
    <CashReconciliationClient
      handovers={handovers}
      isAr={isAr}
      prefix={prefix}
    />
  )
}
