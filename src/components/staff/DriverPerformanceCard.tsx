import { getTranslations } from 'next-intl/server'
import { Award, Clock, Package, Timer } from 'lucide-react'

export interface DriverPerformanceStats {
  /** Number of orders this driver delivered in the last 30 days. */
  deliveredCount:  number
  /** Average pickup → delivered duration in whole minutes, or null if no
   *  rows had both timestamps. */
  avgDurationMin:  number | null
  /** Percentage of timed deliveries that completed within 45 minutes
   *  (0-100), or null when there are no timed rows. */
  onTimePercent:   number | null
  /** Rows with a delivered_at but no picked_up_at — flagged so the
   *  caller can show "incomplete tracking" copy if needed. */
  untimedCount:    number
}

interface Props {
  stats:  DriverPerformanceStats
  isRTL:  boolean
  locale: string
}

export default async function DriverPerformanceCard({ stats, isRTL, locale }: Props) {
  const t = await getTranslations({ locale, namespace: 'driverPerformance' })

  return (
    <section className="rounded-xl border border-brand-border bg-brand-surface p-5">
      <header className="flex items-center gap-2 border-b border-brand-border/60 pb-3">
        <Award size={16} className="text-brand-gold" aria-hidden="true" />
        <h2 className={`text-sm font-bold uppercase tracking-wider text-brand-text ${isRTL ? 'font-cairo' : 'font-satoshi'}`}>
          {t('title')}
        </h2>
      </header>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat
          icon={<Package size={14} aria-hidden="true" />}
          label={t('deliveredOrders')}
          value={String(stats.deliveredCount)}
          isRTL={isRTL}
        />
        <Stat
          icon={<Timer size={14} aria-hidden="true" />}
          label={t('avgDeliveryTime')}
          value={
            stats.avgDurationMin === null
              ? '—'
              : `${stats.avgDurationMin} ${t('minutesShort')}`
          }
          isRTL={isRTL}
          tone={
            stats.avgDurationMin === null ? 'muted'
            : stats.avgDurationMin <  30  ? 'good'
            : stats.avgDurationMin <= 45  ? 'warn'
            : 'bad'
          }
        />
        <Stat
          icon={<Clock size={14} aria-hidden="true" />}
          label={t('onTimePercent')}
          value={
            stats.onTimePercent === null ? '—' : `${stats.onTimePercent}%`
          }
          isRTL={isRTL}
          tone={
            stats.onTimePercent === null ? 'muted'
            : stats.onTimePercent >= 90  ? 'good'
            : stats.onTimePercent >= 70  ? 'warn'
            : 'bad'
          }
        />
      </div>

      {stats.deliveredCount === 0 && (
        <p className={`mt-4 text-xs text-brand-muted ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
          {t('emptyLast30Days')}
        </p>
      )}
      {stats.deliveredCount > 0 && stats.untimedCount > 0 && (
        <p className={`mt-4 text-xs text-brand-muted ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
          {t('untimedHint', { count: stats.untimedCount })}
        </p>
      )}
    </section>
  )
}

function Stat({
  icon, label, value, isRTL, tone,
}: {
  icon:   React.ReactNode
  label:  string
  value:  string
  isRTL:  boolean
  tone?:  'good' | 'warn' | 'bad' | 'muted'
}) {
  const valueTone =
    tone === 'good' ? 'text-emerald-400'
    : tone === 'warn' ? 'text-orange-400'
    : tone === 'bad'  ? 'text-red-400'
    : 'text-brand-text'

  return (
    <div className="rounded-lg border border-brand-border bg-brand-black/40 p-4">
      <div className="flex items-center gap-2 text-brand-muted">
        {icon}
        <span className={`text-[11px] font-bold uppercase tracking-wider ${isRTL ? 'font-cairo' : 'font-satoshi'}`}>
          {label}
        </span>
      </div>
      <p className={`mt-2 font-satoshi text-2xl font-black tabular-nums ${valueTone}`}>
        {value}
      </p>
    </div>
  )
}
