'use client'

import StaffProfileTabs from '@/components/staff/StaffProfileTabs'
import StaffOverview from '@/components/staff/StaffOverview'
import StaffScheduleTab from '@/components/staff/StaffScheduleTab'
import StaffTimesheetTab from '@/components/staff/StaffTimesheetTab'
import StaffLeaveTab from '@/components/staff/StaffLeaveTab'
import type {
  LeaveRequestRow,
  ShiftRow,
  StaffExtendedRow,
  TimeEntryRow,
} from '@/lib/supabase/custom-types'

interface Props {
  staff: StaffExtendedRow
  shifts: ShiftRow[]
  entries: TimeEntryRow[]
  leaves: LeaveRequestRow[]
  canEdit: boolean
  canRequestLeave: boolean
  isRTL: boolean
}

export default function StaffProfileClient({
  staff,
  shifts,
  entries,
  leaves,
  canEdit,
  canRequestLeave,
  isRTL,
}: Props) {
  return (
    <StaffProfileTabs isRTL={isRTL}>
      {(tab) => {
        if (tab === 'overview') return (
          <StaffOverview staff={staff} canEdit={canEdit} isRTL={isRTL} />
        )
        if (tab === 'schedule') return (
          <StaffScheduleTab shifts={shifts} isRTL={isRTL} />
        )
        if (tab === 'performance') return (
          <StaffTimesheetTab entries={entries} isRTL={isRTL} />
        )
        if (tab === 'leave') return (
          <StaffLeaveTab
            staffId={staff.id}
            leaves={leaves}
            canRequest={canRequestLeave}
            isRTL={isRTL}
          />
        )
        return null
      }}
    </StaffProfileTabs>
  )
}
