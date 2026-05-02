import Link from 'next/link'
import type { ExpiryReportRow } from '@/lib/supabase/custom-types'

interface Props {
  rows:   ExpiryReportRow[]
  prefix: string
  isAr?:  boolean
}

function formatExpiry(iso: string, isAr: boolean): string {
  return new Date(iso).toLocaleDateString(isAr ? 'ar-IQ' : 'en-GB', {
    day: '2-digit', month: 'short',
  })
}

export default function ExpiryCalendarWidget({ rows, prefix, isAr = true }: Props) {
  const now    = new Date()
  const today  = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const expired      = rows.filter(r => new Date(r.expires_at) < today)
  const expiringToday = rows.filter(r => {
    const d = new Date(r.expires_at)
    return d >= today && d < new Date(today.getTime() + 86_400_000)
  })
  const thisWeek = rows.filter(r => {
    const d = new Date(r.expires_at)
    return d >= new Date(today.getTime() + 86_400_000)
  })

  const top3 = [...expired, ...expiringToday, ...thisWeek].slice(0, 3)

  if (rows.length === 0) {
    return (
      <div className="bg-brand-surface border border-brand-border rounded-xl p-5 flex flex-col gap-3 h-full">
        <WidgetHeader prefix={prefix} isAr={isAr} />
        <div className="flex-1 flex items-center justify-center">
          <p className="font-satoshi text-sm text-brand-muted text-center py-4">
            {isAr ? '✅ لا توجد أصناف قاربت على الانتهاء' : '✅ No items expiring soon'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-5 flex flex-col gap-4 h-full">
      <WidgetHeader prefix={prefix} isAr={isAr} />

      {/* Counts row */}
      <div className="grid grid-cols-3 gap-2">
        <CountBadge count={expired.length}       color="red"    label={isAr ? 'منتهي' : 'Expired'} />
        <CountBadge count={expiringToday.length} color="orange" label={isAr ? 'اليوم' : 'Today'}   />
        <CountBadge count={thisWeek.length}      color="gold"   label={isAr ? 'هذا الأسبوع' : 'This week'} />
      </div>

      {/* Top 3 most urgent */}
      <div className="flex flex-col gap-2">
        {top3.map(item => {
          const isExpired = new Date(item.expires_at) < today
          const isToday   = expiringToday.includes(item)
          const dotColor  = isExpired ? 'bg-red-400' : isToday ? 'bg-orange-400' : 'bg-brand-gold'
          return (
            <div key={item.lot_id} className="flex items-center justify-between gap-3 py-2 border-b border-brand-border last:border-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                <span className="font-satoshi text-sm text-brand-text truncate">
                  {isAr ? item.name_ar : item.name_en}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-satoshi text-xs text-brand-muted tabular-nums">
                  {item.quantity_remaining.toFixed(2)}
                </span>
                <span className={`font-satoshi text-xs tabular-nums ${isExpired ? 'text-red-400' : isToday ? 'text-orange-400' : 'text-brand-gold'}`}>
                  {formatExpiry(item.expires_at, isAr)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WidgetHeader({ prefix, isAr }: { prefix: string; isAr: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-brand-surface-2 border border-brand-border flex items-center justify-center text-brand-gold shrink-0">
          <CalendarIcon />
        </div>
        <h3 className="font-satoshi font-bold text-sm text-brand-text">
          {isAr ? 'انتهاء الصلاحية' : 'Expiry Calendar'}
        </h3>
      </div>
      <Link
        href={`${prefix}/dashboard/inventory/reports/expiry`}
        className="font-satoshi text-xs text-brand-muted hover:text-brand-gold transition-colors duration-150 shrink-0"
      >
        {isAr ? 'عرض التقرير ←' : 'View report →'}
      </Link>
    </div>
  )
}

function CountBadge({ count, color, label }: { count: number; color: 'red' | 'orange' | 'gold'; label: string }) {
  const styles = {
    red:    'bg-red-500/10 text-red-400 border-red-500/20',
    orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    gold:   'bg-brand-gold/10 text-brand-gold border-brand-gold/20',
  }
  return (
    <div className={`flex flex-col items-center gap-1 rounded-lg border p-2 ${styles[color]}`}>
      <span className="font-satoshi font-black text-xl tabular-nums">{count}</span>
      <span className="font-satoshi text-xs">{label}</span>
    </div>
  )
}

function CalendarIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}
