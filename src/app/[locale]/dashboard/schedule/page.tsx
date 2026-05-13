import { redirect }         from 'next/navigation'
import { requireAuth }       from '@/lib/auth/session'
import { canManageSchedule } from '@/lib/auth/rbac'
import { createClient }      from '@/lib/supabase/server'
import ScheduleClient        from '@/components/schedule/ScheduleClient'
import type { StaffBasicRow, ShiftWithStaff } from '@/lib/supabase/custom-types'

const BHR_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bahrain' })

function getMondayOf(date: Date): string {
  const d   = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return BHR_FMT.format(d)
}

function addDays(base: string, n: number): string {
  const d = new Date(base + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return BHR_FMT.format(d)
}

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const user       = await requireAuth()

  if (!canManageSchedule(user)) {
    redirect(locale === 'en' ? '/en/dashboard' : '/dashboard')
  }

  const supabase  = await createClient()
  const weekStart = getMondayOf(new Date())
  const weekEnd   = addDays(weekStart, 6)

  const isGlobalAdmin = user.role === 'owner' || user.role === 'general_manager'

  // Fail-closed: scoped schedule managers (branch_manager) without a
  // branch_id would otherwise read all-branch staff/shifts/leave counts.
  if (!isGlobalAdmin && !user.branch_id) {
    throw new Error('Forbidden: account requires a branch assignment')
  }

  const scopedBranchId = isGlobalAdmin ? null : (user.branch_id as string)

  let staffQ = supabase
    .from('staff_basic')
    .select('id, name, role, branch_id, is_active, created_at')
    .eq('is_active', true)
    .order('name')
  if (scopedBranchId) staffQ = staffQ.eq('branch_id', scopedBranchId)

  let shiftsQ = supabase
    .from('shifts')
    .select('*, staff_basic(name, role)')
    .gte('shift_date', weekStart)
    .lte('shift_date', weekEnd)
    .order('shift_date')
  if (scopedBranchId) shiftsQ = shiftsQ.eq('branch_id', scopedBranchId)

  // leave_requests has no branch_id — scope via inner join on staff_basic.
  const leavesQ = scopedBranchId
    ? supabase
        .from('leave_requests')
        .select('*, staff_basic!inner(branch_id)', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('staff_basic.branch_id', scopedBranchId)
    : supabase
        .from('leave_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

  const [staffResult, shiftsResult, leavesResult] = await Promise.all([
    staffQ,
    shiftsQ,
    leavesQ,
  ])

  return (
    <ScheduleClient
      locale={locale}
      userRole={user.role}
      initialStaff={(staffResult.data ?? []) as StaffBasicRow[]}
      initialShifts={(shiftsResult.data ?? []) as unknown as ShiftWithStaff[]}
      initialWeekStart={weekStart}
      pendingLeaves={leavesResult.count ?? 0}
    />
  )
}
