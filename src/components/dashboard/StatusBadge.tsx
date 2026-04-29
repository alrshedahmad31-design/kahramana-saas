import type { OrderStatus } from '@/lib/supabase/types'

interface Props {
  status: OrderStatus
  label: string
  size?: 'sm' | 'md'
}

const STATUS_STYLES: Record<OrderStatus, string> = {
  new:              'bg-brand-gold/10 text-brand-gold border-brand-gold/30',
  under_review:     'bg-brand-surface-2 text-brand-muted border-brand-border',
  accepted:         'bg-brand-gold-light/10 text-brand-gold-light border-brand-gold-light/30',
  preparing:        'bg-brand-gold-light/10 text-brand-gold-light border-brand-gold-light/30',
  ready:            'bg-brand-success/10 text-brand-success border-brand-success/30',
  out_for_delivery: 'bg-brand-text/5 text-brand-text border-brand-muted/40',
  delivered:        'bg-brand-success/10 text-brand-success border-brand-success/30',
  completed:        'bg-brand-surface-2 text-brand-muted border-brand-border',
  cancelled:        'bg-brand-error/10 text-brand-error border-brand-error/30',
  payment_failed:   'bg-brand-error/15 text-brand-error border-brand-error/40',
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
