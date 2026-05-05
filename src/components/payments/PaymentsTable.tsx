import Link from 'next/link'
import type { PaymentMethod, PaymentStatus } from '@/lib/supabase/custom-types'

export type PaymentRow = {
  id: string
  order_id: string
  amount_bhd: number
  method: PaymentMethod | null
  status: PaymentStatus
  gateway_transaction_id: string | null
  paid_at: string | null
  created_at: string
  orders: {
    id: string
    customer_name: string | null
    customer_phone: string | null
    branch_id: string
  } | null
}

interface Props {
  payments: PaymentRow[]
  totalCount: number
  page: number
  pageSize: number
  locale: string
  isAr: boolean
  prefix: string
}

const METHOD_LABEL: Record<PaymentMethod, { en: string; ar: string }> = {
  cash:       { en: 'Cash',       ar: 'نقداً' },
  benefit_qr: { en: 'Benefit QR', ar: 'بنفت QR' },
  tap_card:   { en: 'Tap Card',   ar: 'بطاقة تاب' },
  tap_knet:   { en: 'Tap KNET',   ar: 'تاب كي-نت' },
}

const STATUS_STYLE: Record<PaymentStatus, string> = {
  pending:    'bg-brand-gold/10 text-brand-gold border-brand-gold/20',
  pending_cod: 'bg-brand-gold/10 text-brand-gold border-brand-gold/20',
  awaiting_manual_review: 'bg-brand-gold/10 text-brand-gold border-brand-gold/20',
  processing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  completed:  'bg-brand-success/10 text-brand-success border-brand-success/20',
  failed:     'bg-brand-error/10 text-brand-error border-brand-error/20',
  refunded:   'bg-brand-muted/10 text-brand-muted border-brand-muted/20',
}

const STATUS_LABEL: Record<PaymentStatus, { en: string; ar: string }> = {
  pending:    { en: 'Pending',    ar: 'قيد الانتظار' },
  pending_cod: { en: 'Pending COD', ar: 'نقداً عند الاستلام' },
  awaiting_manual_review: { en: 'Awaiting Review', ar: 'بانتظار المراجعة' },
  processing: { en: 'Processing', ar: 'جارٍ المعالجة' },
  completed:  { en: 'Completed',  ar: 'مكتمل' },
  failed:     { en: 'Failed',     ar: 'فاشل' },
  refunded:   { en: 'Refunded',   ar: 'مُسترد' },
}

function formatDate(iso: string, isAr: boolean): string {
  const d = new Date(iso)
  const now = Date.now()
  const diff = now - d.getTime()
  const mins = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)

  if (mins < 60)  return isAr ? `منذ ${mins} دقيقة`  : `${mins}m ago`
  if (hours < 24) return isAr ? `منذ ${hours} ساعة`  : `${hours}h ago`
  if (days < 7)   return isAr ? `منذ ${days} أيام`   : `${days}d ago`
  return d.toLocaleDateString(isAr ? 'ar-BH' : 'en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function PaymentsTable({ payments, totalCount, page, pageSize, locale: _locale, isAr, prefix }: Props) {
  const currency = isAr ? 'د.ب' : 'BD'
  const totalPages = Math.ceil(totalCount / pageSize)
  const orderPrefix = `${prefix}/dashboard/orders`

  if (payments.length === 0) {
    return (
      <div className="rounded-2xl border border-brand-border bg-brand-surface p-12 text-center">
        <p className="font-satoshi text-brand-muted text-sm">
          {isAr ? 'لا توجد معاملات مطابقة' : 'No transactions found'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-brand-border bg-brand-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-satoshi" dir={isAr ? 'rtl' : 'ltr'}>
            <thead>
              <tr className="border-b border-brand-border bg-brand-surface-2">
                {[
                  isAr ? 'التاريخ'        : 'Date',
                  isAr ? 'رقم الطلب'     : 'Order',
                  isAr ? 'العميل'        : 'Customer',
                  isAr ? 'طريقة الدفع'   : 'Method',
                  isAr ? 'المبلغ'        : 'Amount',
                  isAr ? 'الحالة'        : 'Status',
                  isAr ? 'رمز المعاملة' : 'Transaction',
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
              {payments.map((p, i) => (
                <tr
                  key={p.id}
                  className={`border-b border-brand-border/50 hover:bg-brand-surface-2 transition-colors ${
                    i % 2 === 1 ? 'bg-brand-surface-2/30' : ''
                  }`}
                >
                  <td className="px-4 py-3 text-brand-muted whitespace-nowrap">
                    {formatDate(p.created_at, isAr)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`${orderPrefix}/${p.order_id}`}
                      className="font-mono text-xs text-brand-gold hover:opacity-80 transition-opacity"
                    >
                      #{p.order_id.slice(0, 8).toUpperCase()}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-brand-text">
                    {p.orders?.customer_name ?? p.orders?.customer_phone ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-brand-muted whitespace-nowrap">
                    {p.method ? (isAr ? METHOD_LABEL[p.method].ar : METHOD_LABEL[p.method].en) : (isAr ? 'لم تُحدد' : 'Not selected')}
                  </td>
                  <td className="px-4 py-3 font-mono text-brand-text whitespace-nowrap">
                    {currency} {p.amount_bhd.toFixed(3)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${STATUS_STYLE[p.status]}`}
                    >
                      {isAr ? STATUS_LABEL[p.status].ar : STATUS_LABEL[p.status].en}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-brand-muted">
                    {p.gateway_transaction_id ? (
                      <span title={p.gateway_transaction_id}>
                        {p.gateway_transaction_id.slice(0, 12)}…
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <p className="font-satoshi text-xs text-brand-muted">
            {isAr
              ? `${totalCount} معاملة — صفحة ${page} من ${totalPages}`
              : `${totalCount} transactions — Page ${page} of ${totalPages}`}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`?page=${page - 1}`}
                className="px-3 py-1.5 rounded-lg border border-brand-border bg-brand-surface text-xs font-satoshi text-brand-text hover:border-brand-gold/50 transition-colors"
              >
                {isAr ? 'السابق' : 'Previous'}
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`?page=${page + 1}`}
                className="px-3 py-1.5 rounded-lg border border-brand-border bg-brand-surface text-xs font-satoshi text-brand-text hover:border-brand-gold/50 transition-colors"
              >
                {isAr ? 'التالي' : 'Next'}
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
