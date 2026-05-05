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

  const [staffResult, shiftsResult, leavesResult] = await Promise.all([
    supabase
      .from('staff_basic')
      .select('id, name, role, branch_id, is_active, created_at')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('shifts')
      .select('*, staff_basic(name, role)')
      .gte('shift_date', weekStart)
      .lte('shift_date', weekEnd)
      .order('shift_date'),
    supabase
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
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
