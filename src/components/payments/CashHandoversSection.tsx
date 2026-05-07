import { formatPrice } from '@/lib/format'

export type CashHandoverItem = {
  id: string
  driver_name: string
  expected_amount: number
  actual_amount: number
  difference: number | null
  manager_confirmed: boolean | null
  order_ids: string[]
  created_at: string | null
}

interface Props {
  handovers: CashHandoverItem[]
  locale: string
  isAr: boolean
}

function formatDate(iso: string, isAr: boolean): string {
  const d = new Date(iso)
  return d.toLocaleDateString(isAr ? 'ar-BH' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function CashHandoversSection({ handovers, locale, isAr }: Props) {
  if (handovers.length === 0) {
    return (
      <section>
        <h2 className={`mb-4 text-lg font-black text-brand-text ${isAr ? 'font-cairo' : 'font-editorial'}`}>
          {isAr ? 'تسليم النقد' : 'Cash Handovers'}
        </h2>
        <div className="rounded-2xl border border-brand-border bg-brand-surface p-10 text-center">
          <p className="font-satoshi text-brand-muted text-sm">
            {isAr ? 'لا توجد تسليمات نقدية مسجلة' : 'No cash handovers recorded'}
          </p>
        </div>
      </section>
    )
  }

  return (
    <section>
      <h2 className={`mb-4 text-lg font-black text-brand-text ${isAr ? 'font-cairo' : 'font-editorial'}`}>
        {isAr ? 'تسليم النقد' : 'Cash Handovers'}
      </h2>
      <div className="rounded-2xl border border-brand-border bg-brand-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-satoshi" dir={isAr ? 'rtl' : 'ltr'}>
            <thead>
              <tr className="border-b border-brand-border bg-brand-surface-2">
                {[
                  isAr ? 'التاريخ'    : 'Date',
                  isAr ? 'السائق'     : 'Driver',
                  isAr ? 'المتوقع'    : 'Expected',
                  isAr ? 'الفعلي'     : 'Actual',
                  isAr ? 'الفرق'      : 'Difference',
                  isAr ? 'الطلبات'   : 'Orders',
                  isAr ? 'الحالة'     : 'Status',
                ].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-start text-xs uppercase tracking-wider text-brand-muted font-bold whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {handovers.map((h, i) => {
                const diff = Number(h.difference ?? 0)
                const isConfirmed = h.manager_confirmed === true
                const diffColor = diff < 0
                  ? 'text-brand-error'
                  : diff > 0
                  ? 'text-brand-success'
                  : 'text-brand-muted'

                return (
                  <tr
                    key={h.id}
                    className={`border-b border-brand-border/50 hover:bg-brand-surface-2 transition-colors ${
                      i % 2 === 1 ? 'bg-brand-surface-2/30' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-brand-muted whitespace-nowrap">
                      {h.created_at ? formatDate(h.created_at, isAr) : '—'}
                    </td>
                    <td className="px-4 py-3 text-brand-text font-medium">
                      {h.driver_name}
                    </td>
                    <td className="px-4 py-3 font-mono text-brand-text whitespace-nowrap">
                      {formatPrice(Number(h.expected_amount), locale)}
                    </td>
                    <td className="px-4 py-3 font-mono text-brand-text whitespace-nowrap">
                      {formatPrice(Number(h.actual_amount), locale)}
                    </td>
                    <td className={`px-4 py-3 font-mono whitespace-nowrap font-bold ${diffColor}`}>
                      {diff !== 0 ? (diff > 0 ? '+' : '') : ''}
                      {formatPrice(Math.abs(diff), locale)}
                    </td>
                    <td className="px-4 py-3 text-brand-muted text-center">
                      {h.order_ids.length}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          isConfirmed
                            ? 'bg-brand-success/10 text-brand-success border-brand-success/20'
                            : 'bg-brand-gold/10 text-brand-gold border-brand-gold/20'
                        }`}
                      >
                        {isConfirmed
                          ? (isAr ? 'مؤكد' : 'Confirmed')
                          : (isAr ? 'قيد الانتظار' : 'Pending')}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
