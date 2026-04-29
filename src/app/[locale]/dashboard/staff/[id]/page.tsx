import { notFound, redirect }   from 'next/navigation'
import Link                       from 'next/link'
import { getSession }             from '@/lib/auth/session'
import { createClient }           from '@/lib/supabase/server'
import { canManageStaff }         from '@/lib/auth/rbac'
import StaffProfileTabs           from '@/components/staff/StaffProfileTabs'
import StaffOverview              from '@/components/staff/StaffOverview'
import StaffScheduleTab           from '@/components/staff/StaffScheduleTab'
import StaffTimesheetTab          from '@/components/staff/StaffTimesheetTab'
import StaffLeaveTab              from '@/components/staff/StaffLeaveTab'
import type { StaffExtendedRow, ShiftRow, TimeEntryRow, LeaveRequestRow } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

interface Props { params: Promise<{ locale: string; id: string }> }

export default async function StaffProfilePage({ params }: Props) {
  const { locale, id } = await params
  const isAr  = locale === 'ar'
  const prefix = locale === 'en' ? '/en' : ''

  const user = await getSession()
  if (!user) redirect(locale === 'en' ? '/en/login' : '/login')

  const supabase = await createClient()

  // Fetch staff member with extended fields
  const { data: staffData } = await supabase
    .from('staff_basic')
    .select(`
      id, name, role, branch_id, is_active, created_at,
      hire_date, employment_type, hourly_rate, phone,
      emergency_contact_name, emergency_contact_phone,
      id_number, date_of_birth, address, profile_photo_url,
      staff_notes, clock_pin
    `)
    .eq('id', id)
    .single()

  if (!staffData) notFound()

  const staff = staffData as unknown as StaffExtendedRow
  const canEdit = canManageStaff(user, { id: staff.id, role: staff.role, branch_id: staff.branch_id ?? null })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Parallel data fetches (new tables — as any until DB type is regenerated after migration)
  const [shiftsRes, entriesRes, leavesRes] = await Promise.all([
    db.from('shifts').select('*').eq('staff_id', id).order('shift_date', { ascending: false }).limit(30),
    db.from('time_entries').select('*').eq('staff_id', id).order('clock_in', { ascending: false }).limit(30),
    db.from('leave_requests').select('*').eq('staff_id', id).order('requested_at', { ascending: false }),
  ])

  const shifts  = (shiftsRes.data  ?? []) as ShiftRow[]
  const entries = (entriesRes.data ?? []) as TimeEntryRow[]
  const leaves  = (leavesRes.data  ?? []) as LeaveRequestRow[]

  return (
    <div className="flex flex-col gap-5" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm font-satoshi text-brand-muted">
        <Link href={`${prefix}/dashboard/staff`} className="hover:text-brand-gold transition-colors duration-150">
          {isAr ? 'الموظفون' : 'Staff'}
        </Link>
        <span>/</span>
        <span className="text-brand-text font-medium">{staff.name}</span>
      </nav>

      {/* Profile tabs */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
        <StaffProfileTabs isRTL={isAr}>
          {(tab) => {
            if (tab === 'overview') return (
              <StaffOverview staff={staff} canEdit={canEdit} isRTL={isAr} />
            )
            if (tab === 'schedule') return (
              <StaffScheduleTab shifts={shifts} isRTL={isAr} />
            )
            if (tab === 'performance') return (
              <StaffTimesheetTab entries={entries} isRTL={isAr} />
            )
            if (tab === 'leave') return (
              <StaffLeaveTab
                staffId={staff.id}
                leaves={leaves}
                canRequest={user.id === staff.id}
                isRTL={isAr}
              />
            )
            return null
          }}
        </StaffProfileTabs>
      </div>
    </div>
  )
}
