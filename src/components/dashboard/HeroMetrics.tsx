import Link from 'next/link'
import { calculateGrowth } from '@/lib/analytics/calculations'
import type { DashboardData } from '@/lib/dashboard/stats'

interface Props {
  data:     DashboardData
  currency: string
  prefix:   string
  isRTL:    boolean
}

// ── Trend badge ───────────────────────────────────────────────────────────────

function TrendBadge({ pct, label }: { pct: number; label: string }) {
  const up    = pct > 0
  const zero  = pct === 0
  const color = zero ? 'text-brand-muted' : up ? 'text-brand-success' : 'text-brand-error'
  const arrow = zero ? '' : up ? '↑' : '↓'
  const sign  = up ? '+' : ''
  return (
    <p className={`font-satoshi text-sm tabular-nums ${color}`}>
      {arrow}{sign}{Math.abs(pct).toFixed(1)}%
      <span className="text-brand-muted/60 ms-1.5 text-xs font-normal">{label}</span>
    </p>
  )
}

// ── Status dots for active orders ─────────────────────────────────────────────

function StatusDots({ counts }: { counts: DashboardData['activeOrders'] }) {
  const dots = [
    { count: counts.new + counts.under_review + counts.accepted, color: 'bg-brand-error',   label: 'pending' },
    { count: counts.preparing,                                    color: 'bg-brand-gold',    label: 'preparing' },
    { count: counts.ready,                                        color: 'bg-brand-success', label: 'ready' },
    { count: counts.out_for_delivery,                             color: 'bg-brand-muted',   label: 'on road' },
  ]
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {dots.map(d => d.count > 0 && (
        <span key={d.label} className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${d.color} shrink-0`} />
          <span className="font-satoshi text-xs text-brand-muted tabular-nums">{d.count}</span>
        </span>
      ))}
      {counts.total === 0 && (
        <span className="font-satoshi text-xs text-brand-muted/40">—</span>
      )}
    </div>
  )
}

// ── Individual card ───────────────────────────────────────────────────────────

interface CardProps {
  icon:       React.ReactNode
  title:      string
  primary:    React.ReactNode
  secondary:  React.ReactNode
  action?:    { label: string; href: string }
  accentBorder?: string
}

function MetricCard({ icon, title, primary, secondary, action, accentBorder }: CardProps) {
  return (
    <div className={`
      relative flex flex-col gap-3 rounded-xl border p-5
      bg-gradient-to-br from-brand-surface to-brand-surface-2
      hover:border-brand-gold/40 transition-all duration-200
      ${accentBorder ?? 'border-brand-border'}
    `}>
      <div className="flex items-start justify-between gap-2">
        <div className="w-9 h-9 rounded-lg bg-brand-surface-2 border border-brand-border flex items-center justify-center text-brand-gold shrink-0">
          {icon}
        </div>
        {action && (
          <Link
            href={action.href}
            className="font-satoshi text-xs text-brand-muted hover:text-brand-gold transition-colors duration-150 shrink-0"
          >
            {action.label} →
          </Link>
        )}
      </div>

      <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wider">{title}</p>

      <div className="font-satoshi font-black text-3xl text-brand-text tabular-nums leading-none">
        {primary}
      </div>

      <div>{secondary}</div>
    </div>
  )
}

// ── Hero section ──────────────────────────────────────────────────────────────

export default function HeroMetrics({ data, currency, prefix, isRTL }: Props) {
  const revGrowth = calculateGrowth(data.todayRevenue, data.yesterdayRevenue)

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {/* Revenue */}
      <MetricCard
        icon={<RevenueIcon />}
        title={isRTL ? 'إيرادات اليوم' : "Today's Revenue"}
        primary={
          <span>
            {data.todayRevenue.toFixed(3)}
            <span className="text-sm font-medium text-brand-muted ms-1.5">{currency}</span>
          </span>
        }
        secondary={
          <TrendBadge pct={revGrowth} label={isRTL ? 'مقارنة بالأمس' : 'vs yesterday'} />
        }
        accentBorder={data.todayRevenue > 0 ? 'border-brand-gold/30' : 'border-brand-border'}
      />

      {/* Active Orders */}
      <MetricCard
        icon={<OrdersIcon />}
        title={isRTL ? 'الطلبات النشطة' : 'Active Orders'}
        primary={
          <span>
            {data.activeOrders.total}
            <span className="text-base font-medium text-brand-muted ms-1.5">
              {isRTL ? 'طلب' : 'orders'}
            </span>
          </span>
        }
        secondary={<StatusDots counts={data.activeOrders} />}
        action={{ label: isRTL ? 'المطبخ' : 'KDS', href: `${prefix}/dashboard/kds` }}
        accentBorder={data.activeOrders.total > 0 ? 'border-brand-error/30' : 'border-brand-border'}
      />

      {/* Completed */}
      <MetricCard
        icon={<CheckIcon />}
        title={isRTL ? 'مكتملة اليوم' : 'Completed Today'}
        primary={
          <span>
            {data.completedToday}
            <span className="text-base font-medium text-brand-muted ms-1.5">
              {isRTL ? 'طلب' : 'orders'}
            </span>
          </span>
        }
        secondary={
          data.avgPrepMins > 0 ? (
            <p className="font-satoshi text-sm text-brand-muted tabular-nums">
              <span className="text-brand-success">{data.avgPrepMins}</span>
              <span className="ms-1">{isRTL ? 'دقيقة متوسط' : 'min avg'}</span>
            </p>
          ) : (
            <p className="font-satoshi text-xs text-brand-muted/40">—</p>
          )
        }
        action={{ label: isRTL ? 'الطلبات' : 'Orders', href: `${prefix}/dashboard/orders` }}
        accentBorder={data.completedToday > 0 ? 'border-brand-success/30' : 'border-brand-border'}
      />

      {/* Total Today */}
      <MetricCard
        icon={<CalendarIcon />}
        title={isRTL ? 'إجمالي اليوم' : "Today's Total"}
        primary={
          <span>
            {data.totalOrdersToday}
            <span className="text-base font-medium text-brand-muted ms-1.5">
              {isRTL ? 'طلب' : 'orders'}
            </span>
          </span>
        }
        secondary={
          <p className="font-satoshi text-sm text-brand-muted">
            {isRTL ? 'حتى الآن' : 'So far today'}
          </p>
        }
      />
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function RevenueIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function OrdersIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}
