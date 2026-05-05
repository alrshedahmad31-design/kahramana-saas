'use client'

import { useState }         from 'react'
import { submitCashHandover } from '@/app/[locale]/driver/actions'
import type { DriverOrder } from '@/lib/supabase/custom-types'

interface Props {
  cashOrders:  DriverOrder[]
  isPartial?:  boolean
  isRTL:       boolean
  onClose:     () => void
  onConfirmed: () => void
}

export default function CashHandoverModal({ cashOrders, isPartial, isRTL, onClose, onConfirmed }: Props) {
  const totalCash = cashOrders.reduce((s, o) => s + Number(o.total_bhd) + Number(o.tip_bhd ?? 0), 0)

  const [loading,     setLoading]     = useState(false)
  const [done,        setDone]        = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [actualAmount, setActualAmount] = useState(() => totalCash)

  async function handleConfirm() {
    if (loading || done) return
    setLoading(true)
    setError(null)
    // Server recomputes the expected total from DB — actualAmount is what the driver is handing over.
    const result = await submitCashHandover(cashOrders.map(o => o.id), actualAmount)
    setLoading(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    setDone(true)
    setTimeout(onConfirmed, 1_200)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-brand-black/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-sm bg-brand-surface border border-brand-border rounded-3xl overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-brand-border">
          <h2 className={`font-black text-base text-brand-text ${isRTL ? 'font-cairo' : 'font-satoshi'}`}>
            {isRTL
              ? (isPartial ? 'تسليم نقد جزئي' : 'تسليم النقد')
              : (isPartial ? 'Partial Cash Handover' : 'Cash Handover')
            }
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-brand-surface-2 border border-brand-border flex items-center justify-center text-brand-muted hover:text-brand-text transition-colors"
            aria-label={isRTL ? 'إغلاق' : 'Close'}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="px-5 py-5 flex flex-col gap-4">

          <div className="rounded-2xl bg-brand-surface-2 border border-brand-border px-4 py-5 flex flex-col gap-4">
            <div className="text-center">
              <p className={`text-xs font-bold uppercase tracking-wider text-brand-muted mb-2 ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                {isRTL ? 'إجمالي النظام المتوقع' : 'System Expected Total'}
              </p>
              <p className="font-satoshi font-black text-3xl text-brand-text tabular-nums leading-none">
                {totalCash.toFixed(3)}
                <span className="text-sm font-medium text-brand-muted ms-1">BD</span>
              </p>
            </div>

            <div className="pt-4 border-t border-brand-border/60">
              <label className={`block text-center text-xs font-bold uppercase tracking-wider text-red-400 mb-2 ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                {isRTL ? 'المبلغ الفعلي المسلم للمطعم' : 'Actual Cash Handed to Restaurant'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.100"
                  min="0"
                  value={actualAmount || ''}
                  onChange={e => setActualAmount(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="0.000"
                  className="w-full h-14 rounded-xl bg-brand-surface border border-brand-border text-center font-satoshi font-black text-2xl text-red-300 tabular-nums focus:outline-none focus:border-red-500/50"
                  dir="ltr"
                />
                <span className="font-satoshi text-lg text-brand-muted shrink-0">BD</span>
              </div>
            </div>
          </div>

          {/* Order breakdown */}
          {cashOrders.length > 0 && (
            <div className="rounded-2xl bg-brand-surface-2 border border-brand-border overflow-hidden">
              <p className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-brand-muted border-b border-brand-border ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                {isRTL ? 'الطلبات' : 'Orders'}
              </p>
              <div className="px-4 pb-3 pt-2 flex flex-col gap-2">
                {cashOrders.map(o => (
                  <div key={o.id} className="flex items-center justify-between gap-3">
                    <span className="font-satoshi font-black text-sm text-brand-muted tabular-nums">
                      #{o.id.slice(-4).toUpperCase()}
                    </span>
                    {o.customer_name && (
                      <span className={`flex-1 text-xs text-brand-muted/70 truncate ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
                        {o.customer_name}
                      </span>
                    )}
                    <span className="font-satoshi font-black text-sm text-red-300 tabular-nums">
                      {Number(o.total_bhd).toFixed(3)} BD
                      {Number(o.tip_bhd ?? 0) > 0 && (
                        <span className="text-brand-success ms-1 text-xs">
                          +{Number(o.tip_bhd).toFixed(3)}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {cashOrders.length === 0 && (
            <p className={`text-center text-sm text-brand-muted py-2 ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
              {isRTL ? 'لا توجد طلبات نقدية اليوم' : 'No cash orders today'}
            </p>
          )}

          {error && (
            <p className="font-satoshi text-xs text-brand-error text-center">{error}</p>
          )}

          {/* Action */}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || done || cashOrders.length === 0}
            className={`
              w-full min-h-[56px] rounded-2xl font-satoshi font-black text-base
              transition-all duration-150 active:scale-[0.98]
              disabled:opacity-50 disabled:cursor-not-allowed
              ${done
                ? 'bg-brand-success text-brand-black'
                : 'bg-red-500 text-white'
              }
            `}
          >
            {done
              ? (isRTL ? 'تم التسليم ✓' : 'Confirmed ✓')
              : loading
                ? '…'
                : (isRTL ? 'تأكيد التسليم للمطعم' : 'Confirm Handed to Restaurant')
            }
          </button>

        </div>
      </div>
    </div>
  )
}

function CloseIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
