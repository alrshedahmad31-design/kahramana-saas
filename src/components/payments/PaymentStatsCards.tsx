interface Props {
  total: number
  revenue: number
  successRate: string
  failedCount: number
  isAr: boolean
}

export default function PaymentStatsCards({ total, revenue, successRate, failedCount, isAr }: Props) {
  const currency = isAr ? 'د.ب' : 'BD'

  const cards = [
    {
      label: isAr ? 'إجمالي المعاملات' : 'Total Transactions',
      value: total.toLocaleString(),
      accent: 'text-brand-text',
      border: 'border-brand-border',
    },
    {
      label: isAr ? 'الإيرادات المكتملة' : 'Completed Revenue',
      value: `${currency} ${revenue.toFixed(3)}`,
      accent: 'text-brand-gold',
      border: 'border-brand-gold/20',
    },
    {
      label: isAr ? 'نسبة النجاح' : 'Success Rate',
      value: `${successRate}%`,
      accent: 'text-brand-success',
      border: 'border-brand-success/20',
    },
    {
      label: isAr ? 'المعاملات الفاشلة' : 'Failed Transactions',
      value: failedCount.toLocaleString(),
      accent: failedCount > 0 ? 'text-brand-error' : 'text-brand-muted',
      border: failedCount > 0 ? 'border-brand-error/20' : 'border-brand-border',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-2xl bg-brand-surface border ${card.border} p-5 flex flex-col gap-2`}
        >
          <p className={`font-satoshi text-xs uppercase tracking-wider text-brand-muted`}>
            {card.label}
          </p>
          <p className={`font-satoshi text-2xl font-black ${card.accent}`}>
            {card.value}
          </p>
        </div>
      ))}
    </div>
  )
}
