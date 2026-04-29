import type { SecondaryMetricsData } from '@/lib/analytics/queries'
import { colors } from '@/lib/design-tokens'

interface Props {
  data:       SecondaryMetricsData
  totalOrders: number
  isRTL:      boolean
}

interface StatProps {
  label:    string
  value:    string
  sub?:     string
  barPct?:  number
  barColor?: string
  isRTL:    boolean
}

function StatRow({ label, value, sub, barPct, barColor = colors.gold, isRTL }: StatProps) {
  return (
    <div className="py-3 border-b border-brand-border last:border-0">
      <div className="flex items-center justify-between mb-1">
        <span className={`text-sm text-brand-muted ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>{label}</span>
        <span className="text-base font-bold text-brand-text font-satoshi tabular-nums">{value}</span>
      </div>
      {barPct !== undefined && (
        <div className="h-1.5 w-full bg-brand-surface-2 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(barPct, 100)}%`, background: barColor }}
          />
        </div>
      )}
      {sub && (
        <p className={`text-xs text-brand-muted mt-1 ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>{sub}</p>
      )}
    </div>
  )
}

export default function RetentionMetrics({ data, totalOrders, isRTL }: Props) {
  const { newCustomersInPeriod, repeatCustomersInPeriod, repeatRate } = data
  const totalCustomers = newCustomersInPeriod + repeatCustomersInPeriod

  const labels = isRTL
    ? {
        newCust:    'عملاء جدد',
        repeatCust: 'عملاء عائدون',
        repeatRate: 'معدل التكرار',
        totalItems: 'إجمالي الأصناف المباعة',
        target60:   'الهدف: 60%',
        ofTotal:    'من إجمالي العملاء',
      }
    : {
        newCust:    'New Customers',
        repeatCust: 'Returning Customers',
        repeatRate: 'Repeat Rate',
        totalItems: 'Total Items Sold',
        target60:   'Target: 60%',
        ofTotal:    'of identifiable customers',
      }

  return (
    <div>
      <StatRow
        label={labels.newCust}
        value={newCustomersInPeriod.toLocaleString()}
        sub={totalCustomers > 0 ? `${((newCustomersInPeriod / totalCustomers) * 100).toFixed(0)}% ${labels.ofTotal}` : undefined}
        barPct={totalCustomers > 0 ? (newCustomersInPeriod / totalCustomers) * 100 : 0}
        barColor={colors.success}
        isRTL={isRTL}
      />
      <StatRow
        label={labels.repeatCust}
        value={repeatCustomersInPeriod.toLocaleString()}
        sub={totalCustomers > 0 ? `${((repeatCustomersInPeriod / totalCustomers) * 100).toFixed(0)}% ${labels.ofTotal}` : undefined}
        barPct={totalCustomers > 0 ? (repeatCustomersInPeriod / totalCustomers) * 100 : 0}
        barColor={colors.gold}
        isRTL={isRTL}
      />
      <StatRow
        label={labels.repeatRate}
        value={`${repeatRate.toFixed(1)}%`}
        sub={labels.target60}
        barPct={repeatRate}
        barColor={repeatRate >= 60 ? colors.success : repeatRate >= 40 ? colors.gold : colors.error}
        isRTL={isRTL}
      />
      <StatRow
        label={labels.totalItems}
        value={data.totalItemsSold.toLocaleString()}
        sub={totalOrders > 0 ? `${(data.totalItemsSold / totalOrders).toFixed(1)} ${isRTL ? 'صنف/طلب' : 'items/order avg'}` : undefined}
        isRTL={isRTL}
      />
    </div>
  )
}
