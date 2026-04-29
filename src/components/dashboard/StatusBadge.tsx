import type { OrderStatus } from '@/lib/supabase/types'

interface Props {
  status: OrderStatus
  label: string
  size?: 'sm' | 'md'
}

const STATUS_STYLES: Record<OrderStatus, string> = {
  new:              'bg-sky-500/10 text-sky-400 border-sky-500/20',
  under_review:     'bg-brand-surface-2 text-brand-muted border-brand-border',
  accepted:         'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  preparing:        'bg-orange-500/10 text-orange-400 border-orange-500/20',
  ready:            'bg-green-500/10 text-green-400 border-green-500/20',
  out_for_delivery: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  delivered:        'bg-emerald-600/10 text-emerald-500 border-emerald-600/20',
  completed:        'bg-brand-surface-2 text-brand-muted border-brand-border',
  cancelled:        'bg-red-500/10 text-red-400 border-red-500/20',
  payment_failed:   'bg-red-700/10 text-red-500 border-red-700/20',
}

export default function StatusBadge({ status, label, size = 'sm' }: Props) {
  const styles = STATUS_STYLES[status] ?? STATUS_STYLES.new

  return (
    <span
      className={`inline-flex items-center rounded-lg border font-satoshi font-medium
        ${size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'}
        ${styles}`}
    >
      {label}
    </span>
  )
}
