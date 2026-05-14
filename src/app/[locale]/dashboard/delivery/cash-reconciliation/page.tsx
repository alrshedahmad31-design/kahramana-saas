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
  type NewHandoverRow = {
    id:                string
    driver_id:         string
    expected_amount:   number | string
    actual_amount:     number | string
    difference:        number | string
    manager_confirmed: boolean
    order_ids:         string[] | null
    created_at:        string
    staff_basic:       { name: string | null } | { name: string | null }[] | null
  }
  const pickStaffName = (s: NewHandoverRow['staff_basic']): string | null => {
    const row = Array.isArray(s) ? s[0] : s
    return row?.name ?? null
  }
  const newHandovers: CashHandoverRow[] = (handoversData ?? []).map((h) => {
    const row = h as unknown as NewHandoverRow
    return {
      id:                    row.id,
      driver_id:             row.driver_id,
      driver_name:           pickStaffName(row.staff_basic) ?? row.driver_id.slice(0, 8),
      shift_date:            row.created_at.split('T')[0],
      total_cash:            Number(row.expected_amount),
      order_ids:             row.order_ids ?? [],
      handed_at:             row.created_at,
      verified:              row.manager_confirmed,
      notes:                 null,
      reconciliation_status: row.manager_confirmed ? 'verified' : 'pending',
      actual_received:       Number(row.actual_amount),
      discrepancy:           Number(row.difference),
      manager_notes:         null,
      is_new_system:         true,
    }
  })

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

  type LegacyHandoverRow = {
    id:                    string
    driver_id:             string
    shift_date:            string
    total_cash:            number | string
    order_ids:             string[] | null
    handed_at:             string
    verified:              boolean
    notes:                 string | null
    reconciliation_status: string | null
    actual_received:       number | string | null
    discrepancy:           number | string | null
    manager_notes:         string | null
    staff_basic:           { name: string | null } | { name: string | null }[] | null
  }
  const oldHandovers: CashHandoverRow[] = (raw ?? []).map((entry) => {
    const r = entry as unknown as LegacyHandoverRow
    return {
      id:                    r.id,
      driver_id:             r.driver_id,
      driver_name:           pickStaffName(r.staff_basic) ?? r.driver_id.slice(0, 8),
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
    }
  })

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
