'use client'

import type { ReactNode } from 'react'

interface Props {
  completedToday:  number
  totalRevenueBD:  number
  avgDeliveryMins: number
  onTimeRate:      number
  isRTL:           boolean
}

export default function DriverPerformanceDashboard({
  completedToday, totalRevenueBD, avgDeliveryMins, onTimeRate, isRTL,
}: Props) {
  if (completedToday === 0) return null

  const onTimeColor =
    onTimeRate >= 80 ? 'text-brand-success' :
    onTimeRate >= 60 ? 'text-orange-400' :
    'text-red-500'

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <MetricCard
        icon={<TruckIcon />}
        value={String(completedToday)}
        labelAr="توصيلات اليوم"
        labelEn="Deliveries"
        valueColor="text-brand-success"
        isRTL={isRTL}
      />
      <MetricCard
        icon={<ClockIcon />}
        value={avgDeliveryMins > 0 ? String(avgDeliveryMins) : '–'}
        unit={isRTL ? 'د' : 'min'}
        labelAr="متوسط الوقت"
        labelEn="Avg Time"
        valueColor="text-brand-muted"
        isRTL={isRTL}
      />
      <MetricCard
        icon={<CoinIcon />}
        value={totalRevenueBD.toFixed(3)}
        unit="BD"
        labelAr="إجمالي الطلبات"
        labelEn="Order Total"
        valueColor="text-brand-gold"
        isRTL={isRTL}
      />
      <MetricCard
        icon={<TargetIcon />}
        value={String(onTimeRate)}
        unit="%"
        labelAr="في الوقت"
        labelEn="On-Time"
        valueColor={onTimeColor}
        isRTL={isRTL}
      />
    </div>
  )
}

// ── Metric card ────────────────────────────────────────────────────────────────

function MetricCard({ icon, value, unit, labelAr, labelEn, valueColor, isRTL }: {
  icon:       ReactNode
  value:      string
  unit?:      string
  labelAr:    string
  labelEn:    string
  valueColor: string
  isRTL:      boolean
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-3">
      <span className="text-brand-muted">{icon}</span>
      <div className="flex items-baseline gap-1">
        <span className={`font-satoshi font-black text-2xl tabular-nums ${valueColor}`}>{value}</span>
        {unit && (
          <span className={`text-xs text-brand-muted ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>{unit}</span>
        )}
      </div>
      <p className={`text-xs text-brand-muted/70 ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
        {isRTL ? labelAr : labelEn}
      </p>
    </div>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function TruckIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
    </svg>
  )
}

function CoinIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function TargetIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}
