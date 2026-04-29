'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

export function EarningsWidget() {
  const supabase = useMemo(() => createClient(), [])
  const [earnings, setEarnings] = useState({ today: 0, deliveries_today: 0 })

  useEffect(() => {
    async function fetchEarnings() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const today = new Date().toISOString().split('T')[0]

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('orders')
        .select('delivery_fee')
        .eq('driver_id', user.id)
        .eq('status', 'delivered')
        .gte('delivered_at', today)

      if (data) {
        setEarnings({
          today: (data as { delivery_fee: number | null }[])
            .reduce((sum, o) => sum + (Number(o.delivery_fee) || 0), 0),
          deliveries_today: data.length,
        })
      }
    }
    fetchEarnings()
  }, [supabase])

  return (
    <div className="bg-brand-surface/95 backdrop-blur-sm border border-brand-border rounded-xl p-4 shadow-xl">
      <div className="flex items-center gap-2 mb-2">
        <EarningsIcon className="w-5 h-5 text-brand-success" />
        <span className="font-almarai text-brand-muted text-sm">أرباح اليوم</span>
      </div>
      <div className="font-satoshi font-black text-brand-success text-3xl tabular-nums mb-1">
        {earnings.today.toFixed(3)}
        <span className="font-almarai text-brand-muted text-sm font-normal ms-1">د.ب</span>
      </div>
      <div className="font-almarai text-brand-muted text-xs">
        {earnings.deliveries_today} توصيلة اليوم
      </div>
    </div>
  )
}

function EarningsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
