'use client'

import { formatHours } from '@/lib/staff/calculations'
import type { TimeEntryRow } from '@/lib/supabase/types'

interface Props {
  entries: TimeEntryRow[]
  isRTL:  boolean
}

function formatDT(iso: string, isRTL: boolean): string {
  return new Date(iso).toLocaleString(isRTL ? 'ar-BH' : 'en-BH', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

export default function StaffTimesheetTab({ entries, isRTL }: Props) {
  const totalHours    = entries.reduce((s, e) => s + (e.total_hours ?? 0), 0)
  const overtimeHours = entries.reduce((s, e) => s + e.overtime_hours, 0)
  const pendingCount  = entries.filter((e) => e.clock_out && !e.approved_at).length

  return (
    <div className="flex flex-col gap-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label={isRTL ? 'إجمالي الساعات' : 'Total Hours'}
          value={formatHours(totalHours)}
          accent="text-brand-gold"
          isRTL={isRTL}
        />
        <StatCard
          label={isRTL ? 'ساعات إضافية' : 'Overtime'}
          value={overtimeHours > 0 ? formatHours(overtimeHours) : '—'}
          accent={overtimeHours > 0 ? 'text-brand-error' : 'text-brand-muted/40'}
          isRTL={isRTL}
        />
        <StatCard
          label={isRTL ? 'بانتظار الموافقة' : 'Pending Approval'}
          value={String(pendingCount)}
          accent={pendingCount > 0 ? 'text-brand-gold' : 'text-brand-muted/40'}
          isRTL={isRTL}
        />
      </div>

      {/* Entries */}
      {entries.length === 0 ? (
        <div className="flex items-center justify-center py-10 rounded-xl border border-brand-border bg-brand-surface-2">
          <p className={`font-satoshi text-sm text-brand-muted/40 ${isRTL ? 'font-almarai' : ''}`}>
            {isRTL ? 'لا توجد إدخالات وقت بعد' : 'No time entries yet'}
          </p>
        </div>
      ) : (
        <div className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border">
                  {[
                    isRTL ? 'الدخول' : 'Clock In',
                    isRTL ? 'الخروج' : 'Clock Out',
                    isRTL ? 'الساعات' : 'Hours',
                    isRTL ? 'إضافي' : 'OT',
                    isRTL ? 'الحالة' : 'Status',
                  ].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-start font-satoshi font-medium text-brand-muted text-xs uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-brand-border last:border-0 hover:bg-brand-surface-2 transition-colors">
                    <td className="px-4 py-3 font-satoshi text-xs text-brand-text tabular-nums">
                      {formatDT(entry.clock_in, isRTL)}
                    </td>
                    <td className="px-4 py-3 font-satoshi text-xs text-brand-text tabular-nums">
                      {entry.clock_out ? formatDT(entry.clock_out, isRTL) : (
                        <span className="text-brand-success animate-pulse">
                          {isRTL ? 'جارٍ' : 'Active'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-satoshi font-bold text-sm text-brand-text tabular-nums">
                      {entry.total_hours != null ? formatHours(entry.total_hours) : '—'}
                    </td>
                    <td className="px-4 py-3 font-satoshi text-sm tabular-nums">
                      {entry.overtime_hours > 0
                        ? <span className="text-brand-error">+{formatHours(entry.overtime_hours)}</span>
                        : <span className="text-brand-muted/40">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      {entry.approved_at ? (
                        <span className="inline-flex items-center gap-1 text-xs font-satoshi text-brand-success">
                          ✓ {isRTL ? 'موافق عليه' : 'Approved'}
                        </span>
                      ) : entry.clock_out ? (
                        <span className="inline-flex items-center gap-1 text-xs font-satoshi text-brand-gold">
                          {isRTL ? 'بانتظار الموافقة' : 'Pending'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-satoshi text-brand-muted">
                          {isRTL ? 'مفتوح' : 'Active'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, accent, isRTL }: { label: string; value: string; accent: string; isRTL: boolean }) {
  return (
    <div className="rounded-lg bg-brand-surface-2 border border-brand-border px-4 py-3 text-center">
      <p className={`font-satoshi font-black text-xl tabular-nums ${accent}`}>{value}</p>
      <p className={`font-satoshi text-xs text-brand-muted mt-0.5 ${isRTL ? 'font-almarai' : ''}`}>{label}</p>
    </div>
  )
}
