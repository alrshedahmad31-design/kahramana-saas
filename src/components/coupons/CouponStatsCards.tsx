'use client'

import { useLocale } from 'next-intl'
import type { CouponRow } from '@/lib/supabase/custom-types'

interface Props {
  coupons: CouponRow[]
}

export default function CouponStatsCards({ coupons }: Props) {
  const isAr = useLocale() === 'ar'
  const now = new Date()

  const activeCount = coupons.filter(c =>
    c.is_active && (!c.valid_until || new Date(c.valid_until) > now) && !c.paused
  ).length

  const totalUses    = coupons.reduce((acc, c) => acc + (c.usage_count || 0), 0)
  const totalRevenue = coupons.reduce((acc, c) => acc + (Number(c.total_revenue_impact) || 0), 0)

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Active Campaigns */}
      <div className="bg-brand-surface-2 border border-brand-border rounded-2xl p-5 relative overflow-hidden group">
        <div className="absolute top-0 end-0 p-4 text-brand-gold/10 group-hover:text-brand-gold/20 transition-colors">
          <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M15 5l-1.761 4.239a2 2 0 01-1 1L8 12l4.239 1.761a2 2 0 011 1L15 19l1.761-4.239a2 2 0 011-1L22 12l-4.239-1.761a2 2 0 01-1-1L15 5z" />
          </svg>
        </div>
        <p className={`text-xs font-bold text-brand-muted uppercase tracking-wider mb-1 relative z-10 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {isAr ? 'الحملات النشطة' : 'Active Campaigns'}
        </p>
        <div className="flex items-end justify-between relative z-10">
          <h3 className="text-4xl font-black text-brand-text font-editorial leading-none tracking-tight">
            {activeCount}
          </h3>
          <span className={`flex items-center gap-1.5 text-brand-success text-[10px] font-black uppercase tracking-widest bg-brand-success/10 px-2.5 py-1 rounded-full border border-brand-success/20 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-brand-success animate-pulse" />
            {isAr ? 'نشط الآن' : 'Live Now'}
          </span>
        </div>
      </div>

      {/* Total Redemptions */}
      <div className="bg-brand-surface-2 border border-brand-border rounded-2xl p-5 relative overflow-hidden group">
        <div className="absolute top-0 end-0 p-4 text-brand-gold/10 group-hover:text-brand-gold/20 transition-colors">
          <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M12 2v20m0-20l-4 4m4-4l4 4M12 22l-4-4m4 4l4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className={`text-xs font-bold text-brand-muted uppercase tracking-wider mb-1 relative z-10 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {isAr ? 'إجمالي الاستخدامات' : 'Total Redemptions'}
        </p>
        <div className="flex items-end justify-between relative z-10">
          <h3 className="text-4xl font-black text-brand-text font-editorial leading-none tracking-tight">
            {totalUses.toLocaleString()}
          </h3>
          <span className={`text-brand-muted text-[10px] font-black uppercase tracking-widest ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'الاستخدام الكلي' : 'Lifetime Usage'}
          </span>
        </div>
      </div>

      {/* Revenue Impact */}
      <div className="bg-brand-surface-2 border border-brand-border rounded-2xl p-5 relative overflow-hidden group">
        <div className="absolute top-0 end-0 p-4 text-brand-gold/10 group-hover:text-brand-gold/20 transition-colors">
          <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M12 1v22m5-18H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className={`text-xs font-bold text-brand-muted uppercase tracking-wider mb-1 relative z-10 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {isAr ? 'تأثير الإيرادات' : 'Revenue Impact'}
        </p>
        <div className="flex items-end justify-between relative z-10">
          <div className="flex items-baseline gap-1">
            <h3 className="text-4xl font-black text-brand-text font-editorial leading-none tracking-tight">
              {totalRevenue.toFixed(2)}
            </h3>
            <span className="text-sm font-black text-brand-gold font-satoshi uppercase">
              {isAr ? 'د.ب' : 'BHD'}
            </span>
          </div>
          <span className={`text-brand-gold text-[10px] font-black uppercase tracking-widest ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'المبيعات المنسوبة' : 'Attributed Sales'}
          </span>
        </div>
      </div>
    </div>
  )
}
