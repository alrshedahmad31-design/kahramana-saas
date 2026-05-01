'use client'

import type { DriverOrder } from '@/lib/supabase/custom-types'

interface Props {
  orders:    DriverOrder[]
  isRTL:     boolean
}

export default function DriverCashSummary({ orders, isRTL }: Props) {
  const cashOrders    = orders.filter(o => o.payments?.method === 'cash')
  const prepaidOrders = orders.filter(o => o.payments?.method && o.payments.method !== 'cash')

  const cashTotal    = cashOrders.reduce((s, o) => s + Number(o.total_bhd), 0)
  const prepaidTotal = prepaidOrders.reduce((s, o) => s + Number(o.total_bhd), 0)

  if (orders.length === 0) return null

  return (
    <div
      className="grid grid-cols-2 rounded-2xl border overflow-hidden"
      style={{ borderColor: 'rgba(211,72,54,0.35)' }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Cash side */}
      <div className="bg-red-500/10 px-4 py-4 border-e border-red-500/20 text-center">
        <p className={`text-xs font-bold uppercase tracking-wider text-red-400 mb-1 ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
          {isRTL ? 'نقداً — اجمع' : 'Cash — Collect'}
        </p>
        <p className="font-satoshi font-black text-2xl text-red-300 tabular-nums leading-none">
          {cashTotal.toFixed(3)}
          <span className="text-sm font-medium text-red-400 ms-1">BD</span>
        </p>
        <p className={`text-xs mt-1 text-red-400/70 ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
          {cashOrders.length} {isRTL ? 'طلب' : cashOrders.length === 1 ? 'order' : 'orders'}
        </p>
      </div>

      {/* Prepaid side */}
      <div className="bg-brand-success/8 px-4 py-4 text-center">
        <p className={`text-xs font-bold uppercase tracking-wider text-brand-success mb-1 ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
          {isRTL ? 'مدفوع مسبقاً' : 'Pre-paid'}
        </p>
        <p className="font-satoshi font-black text-2xl text-brand-success tabular-nums leading-none">
          {prepaidTotal.toFixed(3)}
          <span className="text-sm font-medium text-brand-success/60 ms-1">BD</span>
        </p>
        <p className={`text-xs mt-1 text-brand-success/50 ${isRTL ? 'font-almarai' : 'font-satoshi'}`}>
          {prepaidOrders.length} {isRTL ? 'طلب' : prepaidOrders.length === 1 ? 'order' : 'orders'}
        </p>
      </div>
    </div>
  )
}
