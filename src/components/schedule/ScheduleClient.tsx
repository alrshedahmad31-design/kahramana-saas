'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient }   from '@/lib/supabase/client'
import WeeklyScheduleGrid from '@/components/schedule/WeeklyScheduleGrid'
import type { ShiftWithStaff, StaffBasicRow, StaffRole } from '@/lib/supabase/custom-types'

function addDays(base: string, n: number): string {
  const d = new Date(base + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

interface Props {
  locale:           string
  userRole:         StaffRole | null
  initialStaff:     StaffBasicRow[]
  initialShifts:    ShiftWithStaff[]
  initialWeekStart: string
  pendingLeaves:    number
}

export default function ScheduleClient({
  locale,
  userRole:         _userRole,
  initialStaff,
  initialShifts,
  initialWeekStart,
  pendingLeaves,
}: Props) {
  const isAr = locale === 'ar'

  const [weekStart, setWeekStart] = useState(initialWeekStart)
  const [staff,     setStaff]     = useState<StaffBasicRow[]>(initialStaff)
  const [shifts,    setShifts]    = useState<ShiftWithStaff[]>(initialShifts)
  const [loading,   setLoading]   = useState(initialStaff.length === 0)

  // Skip the initial load when the server already provided data for the current week
  const skipInitialLoad = useRef(initialStaff.length > 0)

  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (skipInitialLoad.current) {
      skipInitialLoad.current = false
      return
    }

    async function load() {
      setLoading(true)
      const weekEnd = addDays(weekStart, 6)

      const [staffRes, shiftsRes] = await Promise.all([
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
      ])

      setStaff((staffRes.data ?? []) as StaffBasicRow[])
      setShifts((shiftsRes.data ?? []) as unknown as ShiftWithStaff[])
      setLoading(false)
    }

    load()
  }, [weekStart, supabase])

  function handleWeekChange(dir: 1 | -1) {
    setWeekStart((prev) => addDays(prev, dir * 7))
  }

  return (
    <div className="flex flex-col gap-5" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className={`font-black text-2xl text-brand-text ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'جدول الورديات' : 'Schedule'}
          </h1>
          <p className="font-satoshi text-sm text-brand-muted mt-0.5">
            {isAr ? 'إدارة ورديات الموظفين الأسبوعية' : 'Manage weekly staff shifts'}
          </p>
        </div>

        {pendingLeaves > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-brand-gold/10 border border-brand-gold/20 px-3 py-2">
            <span className="font-satoshi font-black text-sm text-brand-gold">{pendingLeaves}</span>
            <span className="font-satoshi text-xs text-brand-gold/70">
              {isAr ? 'طلب إجازة بانتظار الموافقة' : 'leave requests pending'}
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center rounded-xl border border-brand-border bg-brand-surface">
          <div className="flex items-center gap-2 text-brand-muted">
            <div className="w-4 h-4 rounded-full border-2 border-brand-gold border-t-transparent animate-spin" />
            <span className="font-satoshi text-sm">{isAr ? 'جارٍ التحميل…' : 'Loading…'}</span>
          </div>
        </div>
      ) : (
        <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
          <WeeklyScheduleGrid
            weekStart={weekStart}
            staff={staff}
            shifts={shifts}
            branchId={null}
            isRTL={isAr}
            onWeekChange={handleWeekChange}
          />
        </div>
      )}

      {!loading && staff.length > 0 && (
        <div className="flex items-center gap-4 text-xs font-satoshi text-brand-muted">
          <span>{staff.length} {isAr ? 'موظف نشط' : 'active staff'}</span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-brand-gold/15 border border-brand-gold/20" />
            {isAr ? 'مجدول' : 'Scheduled'}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-brand-success/15 border border-brand-success/20" />
            {isAr ? 'مؤكد' : 'Confirmed'}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-brand-muted/10 border border-brand-border" />
            {isAr ? 'مكتمل' : 'Completed'}
          </span>
        </div>
      )}
    </div>
  )
}
