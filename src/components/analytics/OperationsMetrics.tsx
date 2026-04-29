import type { OperationalMetricsData } from '@/lib/analytics/queries'
import { colors } from '@/lib/design-tokens'

interface StatProps {
  label:    string
  value:    string
  sub?:     string
  color?:   string
  isRTL:    boolean
}

function Stat({ label, value, sub, color = colors.text, isRTL }: StatProps) {
  return (
    <div className="bg-brand-surface-2 rounded-xl p-4">
      <p className={`text-xs text-brand-muted mb-2 ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>{label}</p>
      <p className="text-2xl font-bold font-satoshi tabular-nums" style={{ color }}>{value}</p>
      {sub && (
        <p className={`text-xs text-brand-muted mt-1 ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>{sub}</p>
      )}
    </div>
  )
}

interface Props {
  data:  OperationalMetricsData
  isRTL: boolean
}

export default function OperationsMetrics({ data, isRTL }: Props) {
  const {
    totalOrders,
    cancelledOrders,
    cancellationRate,
    avgFulfillmentMinutes,
    ordersWithFulfillmentData,
  } = data

  const deliveredCount = ordersWithFulfillmentData

  const l = isRTL
    ? {
        total:      'إجمالي الطلبات',
        delivered:  'طلبات مكتملة',
        cancelled:  'طلبات ملغاة',
        cancelRate: 'معدل الإلغاء',
        avgTime:    'متوسط وقت التنفيذ',
        targetGood: 'الهدف: أقل من 30 دقيقة',
        targetCancel: 'الهدف: أقل من 5%',
        min:        'دقيقة',
      }
    : {
        total:      'Total Orders',
        delivered:  'Delivered',
        cancelled:  'Cancelled',
        cancelRate: 'Cancellation Rate',
        avgTime:    'Avg Fulfillment Time',
        targetGood: 'Target: <30 min',
        targetCancel: 'Target: <5%',
        min:        'min',
      }

  const avgColor = avgFulfillmentMinutes === 0
    ? colors.muted
    : avgFulfillmentMinutes <= 30 ? colors.success
    : avgFulfillmentMinutes <= 45 ? colors.gold
    : colors.error

  const cancelColor = cancellationRate === 0
    ? colors.muted
    : cancellationRate <= 5 ? colors.success
    : cancellationRate <= 10 ? colors.gold
    : colors.error

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      <Stat
        label={l.total}
        value={totalOrders.toLocaleString()}
        isRTL={isRTL}
      />
      <Stat
        label={l.delivered}
        value={deliveredCount.toLocaleString()}
        sub={totalOrders > 0 ? `${((deliveredCount / totalOrders) * 100).toFixed(0)}% completion` : undefined}
        color={colors.success}
        isRTL={isRTL}
      />
      <Stat
        label={l.cancelled}
        value={cancelledOrders.toLocaleString()}
        sub={`${l.cancelRate}: ${cancellationRate.toFixed(1)}%`}
        color={cancelledOrders > 0 ? colors.error : colors.muted}
        isRTL={isRTL}
      />
      <Stat
        label={l.avgTime}
        value={avgFulfillmentMinutes > 0 ? `${avgFulfillmentMinutes.toFixed(0)} ${l.min}` : '—'}
        sub={avgFulfillmentMinutes > 0 ? l.targetGood : (isRTL ? 'لا توجد طلبات مكتملة' : 'No completed orders yet')}
        color={avgColor}
        isRTL={isRTL}
      />
      <Stat
        label={l.cancelRate}
        value={`${cancellationRate.toFixed(1)}%`}
        sub={l.targetCancel}
        color={cancelColor}
        isRTL={isRTL}
      />
    </div>
  )
}
