'use client'

import { useState, useEffect, useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { HIDDEN_BRANCHES } from '@/constants/contact'

interface Stats {
  newCount:       number
  preparingCount: number
  readyCount:     number
  deliveredToday: number
  revenueToday:   number
}

export default function OrderStatsBar() {
  const t        = useTranslations('common')
  const isAr     = useLocale() === 'ar'
  const supabase = useMemo(() => createClient(), [])

  const [stats, setStats] = useState<Stats>({
    newCount: 0, preparingCount: 0, readyCount: 0, deliveredToday: 0, revenueToday: 0,
  })

  useEffect(() => {
    const fetchStats = async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      let q = supabase
        .from('orders')
        .select('status, total_bhd')
        .gte('created_at', today.toISOString())

      if (HIDDEN_BRANCHES.length > 0) {
        q = q.not('branch_id', 'in', `(${HIDDEN_BRANCHES.join(',')})`)
      }

      const { data } = await q

      if (!data) return

      const done = data.filter(o => ['delivered', 'completed'].includes(String(o.status).trim()))
      setStats({
        newCount:       data.filter(o => ['new', 'under_review', 'pending_payment', 'confirmed'].includes(String(o.status).trim())).length,
        preparingCount: data.filter(o => ['accepted', 'preparing'].includes(String(o.status).trim())).length,
        readyCount:     data.filter(o => ['ready', 'out_for_delivery'].includes(String(o.status).trim())).length,
        deliveredToday: done.length,
        revenueToday:   done.reduce((s, o) => s + Number(o.total_bhd || 0), 0),
      })
    }

    fetchStats()

    const ch = supabase
      .channel('order-stats-bar')
      // PII guard — do not read customer fields from realtime payload. Handler refetches.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchStats)
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [supabase])

  const font = isAr ? 'font-almarai' : 'font-satoshi'

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">

      {/* Debug: {JSON.stringify(stats)} */}
      {/* New */}
      <div className={`relative border-2 border-brand-error rounded-xl p-4 overflow-hidden ${stats.newCount > 0 ? 'bg-brand-error/20' : 'bg-brand-surface'}`}>
        <p className={`text-[10px] font-black text-brand-muted uppercase tracking-widest mb-2 ${font}`}>
          {isAr ? 'طلبات جديدة' : 'New Orders'}
        </p>
        <p className={`text-4xl font-black text-brand-text tabular-nums leading-none ${isAr ? 'font-cairo' : 'font-editorial'}`}>
          {stats.newCount}
        </p>
        {stats.newCount > 0 && (
          <span className="absolute top-3 end-3 w-2 h-2 rounded-full bg-brand-error animate-pulse" />
        )}
      </div>

      {/* Preparing */}
      <div className="bg-brand-surface border-2 border-brand-gold rounded-xl p-4">
        <p className={`text-[10px] font-black text-brand-muted uppercase tracking-widest mb-2 ${font}`}>
          {isAr ? 'قيد التحضير' : 'Preparing'}
        </p>
        <p className={`text-4xl font-black text-brand-text tabular-nums leading-none ${isAr ? 'font-cairo' : 'font-editorial'}`}>
          {stats.preparingCount}
        </p>
      </div>

      {/* Ready */}
      <div className="bg-brand-surface border-2 border-brand-success rounded-xl p-4">
        <p className={`text-[10px] font-black text-brand-muted uppercase tracking-widest mb-2 ${font}`}>
          {isAr ? 'جاهزة' : 'Ready'}
        </p>
        <p className={`text-4xl font-black text-brand-text tabular-nums leading-none ${isAr ? 'font-cairo' : 'font-editorial'}`}>
          {stats.readyCount}
        </p>
      </div>

      {/* Done today */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
        <p className={`text-[10px] font-black text-brand-muted uppercase tracking-widest mb-2 ${font}`}>
          {isAr ? 'مكتملة اليوم' : 'Done Today'}
        </p>
        <p className={`text-4xl font-black text-brand-text tabular-nums leading-none ${isAr ? 'font-cairo' : 'font-editorial'}`}>
          {stats.deliveredToday}
        </p>
      </div>

      {/* Revenue */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
        <p className={`text-[10px] font-black text-brand-muted uppercase tracking-widest mb-2 ${font}`}>
          {isAr ? 'الإيرادات' : 'Revenue'}
        </p>
        <p className="font-satoshi font-black text-2xl text-brand-gold tabular-nums leading-none">
          {stats.revenueToday.toFixed(3)}
          <span className={`text-xs text-brand-muted font-normal ms-1 ${font}`}>
            {t('currency')}
          </span>
        </p>
      </div>
    </div>
  )
}
