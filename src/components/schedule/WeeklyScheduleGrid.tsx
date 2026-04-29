'use client'

import { useState, useTransition } from 'react'
import { createShift, deleteShift } from '@/app/[locale]/dashboard/schedule/actions'
import { formatTimeRange }          from '@/lib/staff/calculations'
import { BRANCHES }                 from '@/constants/contact'
import type { ShiftWithStaff, StaffBasicRow, ShiftStatus } from '@/lib/supabase/types'

interface Props {
  weekStart:   string  // YYYY-MM-DD (Monday)
  staff:       StaffBasicRow[]
  shifts:      ShiftWithStaff[]
  branchId:    string | null
  isRTL:       boolean
  onWeekChange: (dir: 1 | -1) => void
}

const STATUS_CLS: Record<ShiftStatus, string> = {
  scheduled: 'bg-brand-gold/15 text-brand-gold border-brand-gold/20',
  confirmed: 'bg-brand-success/15 text-brand-success border-brand-success/20',
  completed: 'bg-brand-muted/10 text-brand-muted border-brand-border',
  cancelled: 'bg-brand-error/10 text-brand-error/60 border-brand-error/10 line-through',
  no_show:   'bg-brand-error/10 text-brand-error border-brand-error/20',
}

function addDays(base: string, n: number): string {
  const d = new Date(base + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function dayLabel(dateStr: string, isRTL: boolean): { day: string; date: string } {
  const d = new Date(dateStr + 'T00:00:00')
  return {
    day:  d.toLocaleDateString(isRTL ? 'ar-BH' : 'en-BH', { weekday: 'short' }),
    date: d.toLocaleDateString(isRTL ? 'ar-BH' : 'en-BH', { month: 'short', day: 'numeric' }),
  }
}

export default function WeeklyScheduleGrid({ weekStart, staff, shifts, branchId, isRTL, onWeekChange }: Props) {
  const [addingFor, setAddingFor] = useState<{ staffId: string; date: string } | null>(null)

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const today = new Date().toISOString().split('T')[0]

  function shiftsFor(staffId: string, date: string) {
    return shifts.filter((s) => s.staff_id === staffId && s.shift_date === date)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Week nav */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onWeekChange(-1)}
          className="flex items-center gap-1.5 rounded-lg border border-brand-border px-3 py-2 font-satoshi text-sm text-brand-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors duration-150 min-h-[40px]"
        >
          {isRTL ? '→' : '←'} {isRTL ? 'الأسبوع السابق' : 'Prev Week'}
        </button>

        <span className="font-satoshi font-black text-sm text-brand-text">
          {dayLabel(weekStart, isRTL).date} – {dayLabel(days[6], isRTL).date}
        </span>

        <button
          type="button"
          onClick={() => onWeekChange(1)}
          className="flex items-center gap-1.5 rounded-lg border border-brand-border px-3 py-2 font-satoshi text-sm text-brand-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors duration-150 min-h-[40px]"
        >
          {isRTL ? 'الأسبوع التالي' : 'Next Week'} {isRTL ? '←' : '→'}
        </button>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-xl border border-brand-border bg-brand-surface">
        <table className="w-full min-w-[700px] text-sm border-collapse">
          <thead>
            <tr>
              <th className="sticky start-0 z-10 bg-brand-surface border-e border-b border-brand-border px-4 py-3 text-start font-satoshi font-medium text-brand-muted text-xs uppercase tracking-wider min-w-[140px]">
                {isRTL ? 'الموظف' : 'Staff'}
              </th>
              {days.map((d) => {
                const { day, date } = dayLabel(d, isRTL)
                const isToday = d === today
                return (
                  <th
                    key={d}
                    className={`
                      border-e border-b border-brand-border px-2 py-3 text-center
                      font-satoshi text-xs uppercase tracking-wider min-w-[100px]
                      ${isToday ? 'text-brand-gold bg-brand-gold/5' : 'text-brand-muted'}
                    `}
                  >
                    <div>{day}</div>
                    <div className="font-black text-sm mt-0.5">{date}</div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {staff.map((member) => (
              <tr key={member.id} className="border-b border-brand-border last:border-0 hover:bg-brand-surface-2/30 transition-colors">
                <td className="sticky start-0 z-10 bg-brand-surface border-e border-brand-border px-4 py-3">
                  <p className="font-satoshi font-medium text-sm text-brand-text whitespace-nowrap">{member.name}</p>
                  <p className="font-satoshi text-xs text-brand-muted/60 capitalize">{member.role}</p>
                </td>
                {days.map((d) => {
                  const dayShifts = shiftsFor(member.id, d)
                  const isToday  = d === today
                  return (
                    <td
                      key={d}
                      className={`border-e border-brand-border px-1.5 py-1.5 align-top ${isToday ? 'bg-brand-gold/[0.03]' : ''}`}
                    >
                      {dayShifts.map((shift) => (
                        <ShiftPill key={shift.id} shift={shift} isRTL={isRTL} />
                      ))}
                      <button
                        type="button"
                        onClick={() => setAddingFor({ staffId: member.id, date: d })}
                        className="w-full mt-1 min-h-[28px] rounded border border-dashed border-brand-border/50 text-brand-muted/40 hover:border-brand-gold/40 hover:text-brand-gold text-xs transition-colors duration-150"
                        title={isRTL ? 'إضافة وردية' : 'Add shift'}
                      >
                        +
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add shift modal */}
      {addingFor && (
        <AddShiftModal
          staffId={addingFor.staffId}
          date={addingFor.date}
          staffName={staff.find((s) => s.id === addingFor.staffId)?.name ?? ''}
          branchId={branchId}
          isRTL={isRTL}
          onClose={() => setAddingFor(null)}
        />
      )}
    </div>
  )
}

// ── ShiftPill ─────────────────────────────────────────────────────────────────

function ShiftPill({ shift, isRTL }: { shift: ShiftWithStaff; isRTL: boolean }) {
  const [isPending, startTrans] = useTransition()

  function handleDelete() {
    startTrans(async () => { await deleteShift(shift.id) })
  }

  return (
    <div className={`group relative text-xs rounded border px-1.5 py-1 mb-0.5 ${STATUS_CLS[shift.status]} ${isPending ? 'opacity-40' : ''}`}>
      <p className="font-satoshi font-bold tabular-nums">
        {formatTimeRange(shift.start_time, shift.end_time)}
      </p>
      {shift.position && (
        <p className="font-satoshi opacity-70 truncate">{shift.position}</p>
      )}
      <button
        type="button"
        onClick={handleDelete}
        className="absolute top-0.5 end-0.5 hidden group-hover:flex w-4 h-4 items-center justify-center rounded text-current opacity-60 hover:opacity-100"
        title={isRTL ? 'حذف' : 'Delete'}
      >
        ×
      </button>
    </div>
  )
}

// ── AddShiftModal ─────────────────────────────────────────────────────────────

function AddShiftModal({
  staffId, date, staffName, branchId, isRTL, onClose,
}: {
  staffId: string; date: string; staffName: string; branchId: string | null; isRTL: boolean; onClose: () => void
}) {
  const [form, setForm]     = useState({ start_time: '09:00', end_time: '17:00', position: '', notes: '' })
  const [isPending, startT] = useTransition()
  const [error, setError]   = useState<string | null>(null)

  const inputCls = `
    w-full min-h-[40px] rounded-lg border border-brand-border bg-brand-surface-2
    px-3 font-satoshi text-sm text-brand-text
    focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold
  `

  function handleSave() {
    setError(null)
    startT(async () => {
      const result = await createShift({
        staff_id:   staffId,
        branch_id:  branchId,
        shift_date: date,
        start_time: form.start_time,
        end_time:   form.end_time,
        position:   form.position || undefined,
        notes:      form.notes    || undefined,
      })
      if (result.success) {
        onClose()
      } else {
        setError(result.error)
      }
    })
  }

  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString(
    isRTL ? 'ar-BH' : 'en-BH',
    { weekday: 'long', month: 'long', day: 'numeric' },
  )

  return (
    <>
      <div className="fixed inset-0 z-50 bg-brand-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-4 top-[50%] translate-y-[-50%] z-50 max-w-sm mx-auto bg-brand-surface border border-brand-border rounded-xl shadow-2xl p-5 flex flex-col gap-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className={`font-satoshi font-black text-base text-brand-text ${isRTL ? 'font-almarai' : ''}`}>
              {isRTL ? 'إضافة وردية' : 'Add Shift'}
            </h3>
            <p className="font-satoshi text-xs text-brand-muted mt-0.5">
              {staffName} · {formattedDate}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isRTL ? 'إغلاق' : 'Close'}
            className="text-brand-muted hover:text-brand-text text-xl leading-none"
          >×</button>
        </div>

        {error && (
          <div className="text-xs text-brand-error bg-brand-error/10 border border-brand-error/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="font-satoshi text-xs text-brand-muted uppercase tracking-wider">
              {isRTL ? 'البداية' : 'Start'}
            </label>
            <input type="time" value={form.start_time} onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))} className={inputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-satoshi text-xs text-brand-muted uppercase tracking-wider">
              {isRTL ? 'النهاية' : 'End'}
            </label>
            <input type="time" value={form.end_time} onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))} className={inputCls} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="font-satoshi text-xs text-brand-muted uppercase tracking-wider">
            {isRTL ? 'المنصب' : 'Position'}
          </label>
          <input
            type="text"
            value={form.position}
            onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))}
            placeholder={isRTL ? 'سائق، مطبخ…' : 'Driver, Kitchen…'}
            className={inputCls}
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="flex-1 min-h-[44px] rounded-lg bg-brand-gold text-brand-black font-satoshi font-bold text-sm hover:bg-brand-gold/90 disabled:opacity-50 transition-colors duration-150"
          >
            {isPending ? '…' : (isRTL ? 'حفظ الوردية' : 'Save Shift')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 rounded-lg border border-brand-border text-brand-muted hover:text-brand-text font-satoshi text-sm transition-colors duration-150"
          >
            {isRTL ? 'إلغاء' : 'Cancel'}
          </button>
        </div>
      </div>
    </>
  )
}
