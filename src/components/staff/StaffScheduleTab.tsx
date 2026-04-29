'use client'

import { formatTimeRange } from '@/lib/staff/calculations'
import type { ShiftRow }   from '@/lib/supabase/custom-types'

interface Props {
  shifts: ShiftRow[]
  isRTL:  boolean
}

const STATUS_STYLE: Record<string, string> = {
  scheduled:  'bg-brand-gold/15 text-brand-gold border-brand-gold/20',
  confirmed:  'bg-brand-success/15 text-brand-success border-brand-success/20',
  completed:  'bg-brand-muted/15 text-brand-muted border-brand-border',
  cancelled:  'bg-brand-error/15 text-brand-error border-brand-error/20',
  no_show:    'bg-brand-error/15 text-brand-error border-brand-error/20',
}

const STATUS_LABEL_EN: Record<string, string> = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show:   'No Show',
}
const STATUS_LABEL_AR: Record<string, string> = {
  scheduled: 'مجدول',
  confirmed: 'مؤكد',
  completed: 'مكتمل',
  cancelled: 'ملغي',
  no_show:   'غياب',
}

function formatShiftDate(date: string, isRTL: boolean): string {
  return new Date(date + 'T00:00:00').toLocaleDateString(
    isRTL ? 'ar-BH' : 'en-BH',
    { weekday: 'short', month: 'short', day: 'numeric' },
  )
}

export default function StaffScheduleTab({ shifts, isRTL }: Props) {
  const today       = new Date().toISOString().split('T')[0]
  const upcoming    = shifts.filter((s) => s.shift_date >= today && s.status !== 'cancelled').slice(0, 10)
  const past        = shifts.filter((s) => s.shift_date < today || s.status === 'completed').slice(0, 10)

  return (
    <div className="flex flex-col gap-6">
      {/* Upcoming */}
      <section>
        <h3 className={`font-satoshi font-black text-sm text-brand-muted uppercase tracking-wider mb-3 ${isRTL ? 'font-almarai' : ''}`}>
          {isRTL ? 'الورديات القادمة' : 'Upcoming Shifts'}
        </h3>
        {upcoming.length === 0 ? (
          <EmptyState isRTL={isRTL} msgEn="No upcoming shifts scheduled" msgAr="لا توجد ورديات قادمة" />
        ) : (
          <div className="flex flex-col gap-2">
            {upcoming.map((shift) => (
              <ShiftCard key={shift.id} shift={shift} isRTL={isRTL} />
            ))}
          </div>
        )}
      </section>

      {/* Past */}
      {past.length > 0 && (
        <section>
          <h3 className={`font-satoshi font-black text-sm text-brand-muted uppercase tracking-wider mb-3 ${isRTL ? 'font-almarai' : ''}`}>
            {isRTL ? 'الورديات السابقة' : 'Past Shifts'}
          </h3>
          <div className="flex flex-col gap-2">
            {past.map((shift) => (
              <ShiftCard key={shift.id} shift={shift} isRTL={isRTL} dim />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function ShiftCard({ shift, isRTL, dim = false }: { shift: ShiftRow; isRTL: boolean; dim?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${dim ? 'opacity-60' : ''} border-brand-border bg-brand-surface-2`}>
      <div className="flex flex-col min-w-[96px] shrink-0">
        <span className="font-satoshi font-bold text-sm text-brand-text">
          {formatShiftDate(shift.shift_date, isRTL)}
        </span>
        <span className="font-satoshi text-xs text-brand-muted tabular-nums">
          {formatTimeRange(shift.start_time, shift.end_time)}
        </span>
      </div>

      {shift.position && (
        <span className="font-satoshi text-xs text-brand-muted bg-brand-surface border border-brand-border rounded px-2 py-0.5">
          {shift.position}
        </span>
      )}

      <span className={`ms-auto shrink-0 text-xs font-satoshi font-medium rounded px-2 py-0.5 border ${STATUS_STYLE[shift.status]}`}>
        {isRTL ? STATUS_LABEL_AR[shift.status] : STATUS_LABEL_EN[shift.status]}
      </span>
    </div>
  )
}

function EmptyState({ isRTL, msgEn, msgAr }: { isRTL: boolean; msgEn: string; msgAr: string }) {
  return (
    <div className="flex items-center justify-center py-10 rounded-xl border border-brand-border bg-brand-surface-2">
      <p className={`font-satoshi text-sm text-brand-muted/40 ${isRTL ? 'font-almarai' : ''}`}>
        {isRTL ? msgAr : msgEn}
      </p>
    </div>
  )
}
