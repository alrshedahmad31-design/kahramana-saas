'use client'

import { useState, useEffect } from 'react'
import { useLocale } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import CouponQRCode from './CouponQRCode'
import type { CouponRow, CouponRedemptionRow } from '@/lib/supabase/types'

interface Props {
  coupon:  CouponRow
  onClose: () => void
}

export default function CouponAnalyticsModal({ coupon, onClose }: Props) {
  const isAr = useLocale() === 'ar'
  const [redemptions, setRedemptions] = useState<CouponRedemptionRow[]>([])
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    const fetchAnalytics = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('coupon_redemptions')
        .select('*')
        .eq('coupon_id', coupon.id)
        .order('redeemed_at', { ascending: false })
      if (data) setRedemptions(data as CouponRedemptionRow[])
      setLoading(false)
    }
    fetchAnalytics()
  }, [coupon.id])

  const totalDiscount = redemptions.reduce((acc, r) => acc + Number(r.discount_amount), 0)
  const avgOrderValue = redemptions.length > 0
    ? redemptions.reduce((acc, r) => acc + Number(r.order_total), 0) / redemptions.length
    : 0

  const currency   = isAr ? 'د.ب' : 'BHD'
  const dateLocale = isAr ? 'ar-BH' : 'en-BH'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div
        dir={isAr ? 'rtl' : 'ltr'}
        className="bg-brand-surface-2 border border-brand-border rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="p-6 border-b border-brand-border flex items-center justify-between bg-brand-surface-2/50">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-black uppercase tracking-widest text-brand-gold bg-brand-gold/10 px-2 py-0.5 rounded border border-brand-gold/20 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                {isAr ? 'التحليلات' : 'Analytics'}
              </span>
              <h2 className="text-xl font-black text-brand-text font-editorial tracking-tight">{coupon.code}</h2>
            </div>
            <p className={`text-xs text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {coupon.campaign_name || (isAr ? 'أداء الحملة' : 'Campaign Performance')}
            </p>
          </div>
          <button onClick={onClose} className="text-brand-muted hover:text-brand-text transition-colors">
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="flex flex-col lg:flex-row gap-10">
            {/* Left: Stats */}
            <div className="flex-1">
              <h3 className={`text-xs font-black uppercase tracking-widest text-brand-muted mb-6 flex items-center gap-2 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 20V10M18 20V4M6 20v-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                {isAr ? 'مؤشرات الأداء الرئيسية' : 'Key Performance Metrics'}
              </h3>

              <div className="grid grid-cols-2 gap-4 mb-10">
                {[
                  { label: isAr ? 'إجمالي الاستخدامات' : 'Total Uses',   value: coupon.usage_count, color: 'text-brand-text' },
                  { label: isAr ? 'إجمالي التوفير'     : 'Total Savings', value: `${totalDiscount.toFixed(2)} ${currency}`, color: 'text-brand-gold' },
                  { label: isAr ? 'متوسط الطلب'        : 'Avg Order',     value: `${avgOrderValue.toFixed(2)} ${currency}`, color: 'text-brand-text' },
                  { label: isAr ? 'الإيرادات'          : 'Revenue',       value: `${Number(coupon.total_revenue_impact).toFixed(2)} ${currency}`, color: 'text-brand-success' },
                ].map((m) => (
                  <div key={m.label} className="bg-brand-surface p-5 rounded-2xl border border-brand-border group hover:border-brand-gold/30 transition-colors">
                    <p className={`text-[10px] font-black uppercase text-brand-muted/60 mb-1 tracking-widest ${isAr ? 'font-almarai' : 'font-satoshi'}`}>{m.label}</p>
                    <p className={`text-2xl font-black ${m.color} font-satoshi`}>{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Recent Redemptions */}
              <div>
                <h3 className={`text-xs font-black uppercase tracking-widest text-brand-muted mb-4 flex items-center gap-2 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {isAr ? 'سجل النشاط' : 'Activity Log'}
                </h3>

                {loading ? (
                  <div className="py-12 flex justify-center">
                    <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-gold" />
                  </div>
                ) : redemptions.length === 0 ? (
                  <div className="py-12 text-center bg-brand-surface rounded-2xl border border-brand-border border-dashed">
                    <p className={`text-sm text-brand-muted italic ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                      {isAr ? 'لا توجد بيانات استخدام حتى الآن.' : 'No redemption data available yet.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {redemptions.slice(0, 5).map(r => (
                      <div key={r.id} className="flex items-center justify-between p-4 bg-brand-surface rounded-xl border border-brand-border hover:bg-brand-surface/50 transition-colors">
                        <div className="flex flex-col">
                          <span className={`text-sm font-bold text-brand-text tracking-wide ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                            {isAr ? `طلب #${r.order_id.slice(0, 8)}` : `Order #${r.order_id.slice(0, 8)}`}
                          </span>
                          <span className={`text-[10px] text-brand-muted uppercase tracking-widest ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                            {new Date(r.redeemed_at).toLocaleString(dateLocale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-end">
                          <p className="text-sm font-black text-brand-gold font-satoshi">-{Number(r.discount_amount).toFixed(2)} {currency}</p>
                          <p className={`text-[10px] font-bold text-brand-muted uppercase ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                            {isAr ? `قيمة الطلب: ${Number(r.order_total).toFixed(2)} ${currency}` : `Cart: ${Number(r.order_total).toFixed(2)} ${currency}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: QR Code */}
            <div className="flex flex-col items-center gap-6 lg:w-72 shrink-0 border-s border-brand-border/30 lg:ps-10">
              <div className="text-center lg:text-start w-full">
                <h3 className={`text-xs font-black uppercase tracking-widest text-brand-muted mb-2 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {isAr ? 'الأصل التسويقي' : 'Marketing Asset'}
                </h3>
                <p className={`text-[10px] text-brand-muted leading-relaxed uppercase ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {isAr
                    ? 'امسح داخل المتجر أو شارك مع العملاء للتطبيق الفوري.'
                    : 'Scan in-store or share with customers for instant application.'}
                </p>
              </div>
              <CouponQRCode code={coupon.code} />
              <div className="flex flex-col w-full gap-2">
                <button
                  onClick={() => window.print()}
                  className={`flex items-center justify-center gap-2 w-full px-4 py-3 rounded-2xl bg-brand-surface border border-brand-border text-xs font-black uppercase tracking-widest text-brand-text hover:bg-brand-surface-2 hover:border-brand-gold transition-all group ${isAr ? 'font-almarai' : 'font-satoshi'}`}
                >
                  <svg className="group-hover:text-brand-gold transition-colors" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2m-2-5H8v9h8v-9z" /></svg>
                  {isAr ? 'طباعة بطاقة الحملة' : 'Print Campaign Card'}
                </button>
                <button
                  className={`flex items-center justify-center gap-2 w-full px-4 py-3 rounded-2xl bg-brand-surface border border-brand-border text-xs font-black uppercase tracking-widest text-brand-text hover:bg-brand-surface-2 hover:border-brand-gold transition-all group ${isAr ? 'font-almarai' : 'font-satoshi'}`}
                >
                  <svg className="group-hover:text-brand-gold transition-colors" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8m-16-4l8-8 8 8m-8-8v16" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  {isAr ? 'تصدير البيانات (CSV)' : 'Export Data (CSV)'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-brand-border bg-brand-surface-2/50 text-center">
          <button
            onClick={onClose}
            className={`px-10 py-3 rounded-2xl bg-brand-gold text-brand-black text-xs font-black uppercase tracking-[0.2em] hover:bg-brand-gold-light transition-all transform active:scale-95 ${isAr ? 'font-almarai' : 'font-satoshi'}`}
          >
            {isAr ? 'إغلاق' : 'Close Insight View'}
          </button>
        </div>
      </div>
    </div>
  )
}
