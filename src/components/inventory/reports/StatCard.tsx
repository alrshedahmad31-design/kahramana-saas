interface Props {
  label: string
  value: string | number
  sub?: string
  trend?: 'up' | 'down' | 'neutral'
  highlight?: boolean
}

export default function StatCard({ label, value, sub, trend, highlight }: Props) {
  return (
    <div className={`bg-brand-surface border rounded-xl p-4 ${highlight ? 'border-brand-gold' : 'border-brand-border'}`}>
      <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wide">{label}</p>
      <p className={`font-cairo text-2xl font-black mt-1 ${highlight ? 'text-brand-gold' : 'text-brand-text'}`}>
        {value}
      </p>
      {sub && <p className="font-satoshi text-xs text-brand-muted mt-0.5">{sub}</p>}
      {trend && (
        <span className={`font-satoshi text-xs font-medium ${trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-brand-error' : 'text-brand-muted'}`}>
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—'}
        </span>
      )}
    </div>
  )
}
