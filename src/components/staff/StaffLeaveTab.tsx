'use client'

import { useState, useTransition } from 'react'
import { createLeaveRequest }      from '@/app/[locale]/dashboard/staff/[id]/actions'
import type { LeaveRequestRow, LeaveType } from '@/lib/supabase/types'

interface Props {
  staffId:    string
  leaves:     LeaveRequestRow[]
  canRequest: boolean
  isRTL:      boolean
}

const STATUS_STYLE: Record<string, string> = {
  pending:  'text-brand-gold  border-brand-gold/20  bg-brand-gold/10',
  approved: 'text-brand-success border-brand-success/20 bg-brand-success/10',
  rejected: 'text-brand-error  border-brand-error/20  bg-brand-error/10',
  cancelled:'text-brand-muted  border-brand-border    bg-brand-surface-2',
}
const STATUS_EN: Record<string, string> = {
  pending: 'Pending', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled',
}
const STATUS_AR: Record<string, string> = {
  pending: 'بانتظار', approved: 'موافق', rejected: 'مرفوض', cancelled: 'ملغي',
}

const LEAVE_TYPES: { key: LeaveType; en: string; ar: string }[] = [
  { key: 'annual',    en: 'Annual Leave',    ar: 'إجازة سنوية' },
  { key: 'sick',      en: 'Sick Leave',      ar: 'إجازة مرضية' },
  { key: 'emergency', en: 'Emergency Leave', ar: 'إجازة طارئة' },
  { key: 'unpaid',    en: 'Unpaid Leave',    ar: 'إجازة غير مدفوعة' },
  { key: 'other',     en: 'Other',           ar: 'أخرى' },
]

function formatDate(date: string, isRTL: boolean): string {
  return new Date(date + 'T00:00:00').toLocaleDateString(
    isRTL ? 'ar-BH' : 'en-BH',
    { month: 'short', day: 'numeric', year: 'numeric' },
  )
}

export default function StaffLeaveTab({ staffId, leaves, canRequest, isRTL }: Props) {
  const [showForm, setShowForm]   = useState(false)
  const [isPending, startTrans]   = useTransition()
  const [error,     setError]     = useState<string | null>(null)
  const [success,   setSuccess]   = useState(false)

  const [form, setForm] = useState({
    leave_type: 'annual' as LeaveType,
    start_date: '',
    end_date:   '',
    reason:     '',
  })

  function handleSubmit() {
    setError(null)
    if (!form.start_date || !form.end_date) {
      setError(isRTL ? 'يرجى تحديد التواريخ' : 'Please select dates')
      return
    }
    startTrans(async () => {
      const result = await createLeaveRequest({
        staff_id:   staffId,
        leave_type: form.leave_type,
        start_date: form.start_date,
        end_date:   form.end_date,
        reason:     form.reason || undefined,
      })
      if (result.success) {
        setShowForm(false)
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
        setForm({ leave_type: 'annual', start_date: '', end_date: '', reason: '' })
      } else {
        setError(result.error)
      }
    })
  }

  const inputCls = `
    w-full min-h-[40px] rounded-lg border border-brand-border bg-brand-surface-2
    px-3 font-satoshi text-sm text-brand-text
    focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold
  `

  return (
    <div className="flex flex-col gap-5">
      {success && (
        <div className="rounded-lg bg-brand-success/10 border border-brand-success/20 px-4 py-2.5 font-satoshi text-sm text-brand-success">
          {isRTL ? 'تم تقديم طلب الإجازة' : 'Leave request submitted'}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-brand-error/10 border border-brand-error/20 px-4 py-2.5 font-satoshi text-sm text-brand-error">
          {error}
        </div>
      )}

      {/* Request button */}
      {canRequest && !showForm && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-gold/10 border border-brand-gold/30 px-4 py-2.5 font-satoshi text-sm text-brand-gold hover:bg-brand-gold/20 transition-colors duration-150 min-h-[40px]"
          >
            <PlusIcon />
            {isRTL ? 'طلب إجازة' : 'Request Leave'}
          </button>
        </div>
      )}

      {/* Request form */}
      {showForm && (
        <div className="rounded-xl border border-brand-gold/20 bg-brand-gold/5 p-4 flex flex-col gap-3">
          <h4 className={`font-satoshi font-black text-sm text-brand-text ${isRTL ? 'font-almarai' : ''}`}>
            {isRTL ? 'طلب إجازة جديدة' : 'New Leave Request'}
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="font-satoshi text-xs text-brand-muted uppercase tracking-wider">
                {isRTL ? 'نوع الإجازة' : 'Leave Type'}
              </label>
              <select
                value={form.leave_type}
                onChange={(e) => setForm((p) => ({ ...p, leave_type: e.target.value as LeaveType }))}
                className={inputCls}
                dir={isRTL ? 'rtl' : 'ltr'}
              >
                {LEAVE_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>{isRTL ? t.ar : t.en}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-satoshi text-xs text-brand-muted uppercase tracking-wider">
                {isRTL ? 'من' : 'Start Date'}
              </label>
              <input type="date" value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} className={inputCls} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-satoshi text-xs text-brand-muted uppercase tracking-wider">
                {isRTL ? 'إلى' : 'End Date'}
              </label>
              <input type="date" value={form.end_date} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} className={inputCls} />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="font-satoshi text-xs text-brand-muted uppercase tracking-wider">
                {isRTL ? 'السبب' : 'Reason'}
              </label>
              <textarea
                rows={2}
                value={form.reason}
                onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                className={`${inputCls} resize-none py-2`}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="flex-1 min-h-[40px] rounded-lg bg-brand-gold text-brand-black font-satoshi font-bold text-sm hover:bg-brand-gold/90 disabled:opacity-50 transition-colors duration-150"
            >
              {isPending ? '…' : (isRTL ? 'إرسال الطلب' : 'Submit Request')}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="min-h-[40px] px-4 rounded-lg border border-brand-border text-brand-muted hover:text-brand-text font-satoshi text-sm transition-colors duration-150"
            >
              {isRTL ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* Leave list */}
      {leaves.length === 0 ? (
        <div className="flex items-center justify-center py-10 rounded-xl border border-brand-border bg-brand-surface-2">
          <p className={`font-satoshi text-sm text-brand-muted/40 ${isRTL ? 'font-almarai' : ''}`}>
            {isRTL ? 'لا توجد طلبات إجازة' : 'No leave requests yet'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {leaves.map((leave) => {
            const leaveLabel = LEAVE_TYPES.find((t) => t.key === leave.leave_type)
            return (
              <div key={leave.id} className="flex items-start gap-3 rounded-lg border border-brand-border bg-brand-surface-2 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-satoshi font-bold text-sm text-brand-text ${isRTL ? 'font-almarai' : ''}`}>
                      {isRTL ? leaveLabel?.ar : leaveLabel?.en}
                    </span>
                    <span className="font-satoshi text-xs text-brand-muted tabular-nums">
                      · {leave.days_count} {isRTL ? 'يوم' : 'days'}
                    </span>
                  </div>
                  <p className="font-satoshi text-xs text-brand-muted">
                    {formatDate(leave.start_date, isRTL)} – {formatDate(leave.end_date, isRTL)}
                  </p>
                  {leave.reason && (
                    <p className={`font-satoshi text-xs text-brand-muted/70 mt-0.5 ${isRTL ? 'font-almarai' : ''}`}>
                      {leave.reason}
                    </p>
                  )}
                </div>
                <span className={`shrink-0 text-xs font-satoshi font-medium rounded px-2 py-0.5 border ${STATUS_STYLE[leave.status]}`}>
                  {isRTL ? STATUS_AR[leave.status] : STATUS_EN[leave.status]}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PlusIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  )
}
