'use client'

import { useState }     from 'react'
import Link             from 'next/link'
import type { CashHandoverRow } from '@/app/[locale]/dashboard/delivery/cash-reconciliation/page'

interface Props {
  handovers: CashHandoverRow[]
  isAr:      boolean
  prefix:    string
}

function formatDate(iso: string, isAr: boolean): string {
  return new Date(iso).toLocaleDateString(isAr ? 'ar-BH' : 'en-GB', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  })
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const h = String(d.getHours() % 12 || 12).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m} ${d.getHours() >= 12 ? 'PM' : 'AM'}`
}

export default function CashReconciliationClient({ handovers, isAr, prefix }: Props) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified'>('all')

  const filtered = handovers.filter(h => {
    if (filter === 'verified') return h.verified
    if (filter === 'pending')  return !h.verified
    return true
  })

  const totalPending  = handovers.filter(h => !h.verified).reduce((s, h) => s + h.total_cash, 0)
  const totalVerified = handovers.filter(h =>  h.verified).reduce((s, h) => s + h.total_cash, 0)

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto flex flex-col gap-6" dir={isAr ? 'rtl' : 'ltr'}>

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl font-black text-brand-text ${isAr ? 'font-cairo' : 'font-editorial'}`}>
            {isAr ? 'تسوية النقد' : 'Cash Reconciliation'}
          </h1>
          <p className={`text-sm text-brand-muted mt-0.5 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'تتبع نقد السائقين وتوثيق التسليم' : 'Track driver cash handovers and verify receipt'}
          </p>
        </div>
        <Link
          href={`${prefix}/dashboard/delivery`}
          className={`text-xs text-brand-muted hover:text-brand-gold transition-colors ${isAr ? 'font-almarai' : 'font-satoshi'}`}
        >
          {isAr ? '← لوحة التوصيل' : '← Delivery Board'}
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-red-500/25 bg-red-500/8 px-5 py-4">
          <p className={`text-xs font-bold uppercase tracking-wider text-red-400 mb-1 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'في انتظار التحقق' : 'Pending Verification'}
          </p>
          <p className="font-satoshi font-black text-3xl text-red-300 tabular-nums">
            {totalPending.toFixed(3)} <span className="text-base font-medium text-red-400">BD</span>
          </p>
        </div>
        <div className="rounded-2xl border border-brand-success/25 bg-brand-success/8 px-5 py-4">
          <p className={`text-xs font-bold uppercase tracking-wider text-brand-success mb-1 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'تم التحقق' : 'Verified'}
          </p>
          <p className="font-satoshi font-black text-3xl text-brand-success tabular-nums">
            {totalVerified.toFixed(3)} <span className="text-base font-medium text-brand-success/60">BD</span>
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'pending', 'verified'] as const).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`
              rounded-xl px-4 py-2 text-xs font-bold transition-colors duration-150
              ${filter === f
                ? 'bg-brand-gold text-brand-black'
                : 'bg-brand-surface-2 text-brand-muted border border-brand-border hover:text-brand-text'
              }
              ${isAr ? 'font-almarai' : 'font-satoshi'}
            `}
          >
            {f === 'all'      && (isAr ? 'الكل'          : 'All')}
            {f === 'pending'  && (isAr ? 'قيد الانتظار'  : 'Pending')}
            {f === 'verified' && (isAr ? 'تم التحقق'     : 'Verified')}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-brand-border bg-brand-surface flex items-center justify-center py-16">
          <p className={`text-sm text-brand-muted/40 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'لا توجد سجلات تسليم' : 'No handover records'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-brand-border bg-brand-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border bg-brand-surface-2">
                  {[
                    isAr ? 'السائق'       : 'Driver',
                    isAr ? 'التاريخ'      : 'Date',
                    isAr ? 'وقت التسليم' : 'Handed At',
                    isAr ? 'المبلغ'      : 'Amount',
                    isAr ? 'الطلبات'     : 'Orders',
                    isAr ? 'الحالة'      : 'Status',
                  ].map(h => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-start text-xs font-bold uppercase tracking-wider text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {filtered.map(h => (
                  <tr key={h.id} className="hover:bg-brand-surface-2/50 transition-colors">
                    <td className={`px-4 py-3.5 font-bold text-brand-text ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                      {h.driver_name}
                    </td>
                    <td className="px-4 py-3.5 font-satoshi text-brand-muted tabular-nums">
                      {formatDate(h.shift_date, isAr)}
                    </td>
                    <td className="px-4 py-3.5 font-satoshi text-brand-muted tabular-nums">
                      {formatTime(h.handed_at)}
                    </td>
                    <td className="px-4 py-3.5 font-satoshi font-black text-brand-gold tabular-nums">
                      {h.total_cash.toFixed(3)} BD
                    </td>
                    <td className="px-4 py-3.5 font-satoshi text-brand-muted tabular-nums">
                      {h.order_ids.length}
                    </td>
                    <td className="px-4 py-3.5">
                      {h.verified ? (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold bg-brand-success/15 text-brand-success ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                          ✓ {isAr ? 'تم التحقق' : 'Verified'}
                        </span>
                      ) : (
                        <VerifyButton handoverId={h.id} isAr={isAr} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// Inline verify button with optimistic UI
function VerifyButton({ handoverId, isAr }: { handoverId: string; isAr: boolean }) {
  const [done,    setDone]    = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleVerify() {
    if (loading || done) return
    setLoading(true)
    const { verifyCashHandover } = await import('@/app/[locale]/dashboard/delivery/cash-reconciliation/actions')
    const result = await verifyCashHandover(handoverId)
    setLoading(false)
    if ('success' in result) setDone(true)
  }

  if (done) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold bg-brand-success/15 text-brand-success ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
        ✓ {isAr ? 'تم التحقق' : 'Verified'}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={handleVerify}
      disabled={loading}
      className={`
        inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold
        bg-brand-gold/15 text-brand-gold border border-brand-gold/25
        hover:bg-brand-gold/25 transition-colors disabled:opacity-50
        ${isAr ? 'font-almarai' : 'font-satoshi'}
      `}
    >
      {loading ? '…' : (isAr ? 'تحقق' : 'Verify')}
    </button>
  )
}
