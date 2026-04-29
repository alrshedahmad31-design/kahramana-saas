'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import type { CouponRow } from '@/lib/supabase/custom-types'

interface Props {
  coupon:          CouponRow
  onEdit:          (coupon: CouponRow) => void
  onTogglePause:   (coupon: CouponRow) => void
  onCopy:          (code: string) => void
  onViewAnalytics: (coupon: CouponRow) => void
}

export default function CouponCard({ coupon, onEdit, onTogglePause, onCopy, onViewAnalytics }: Props) {
  const isAr = useLocale() === 'ar'
  const [copying, setCopying] = useState(false)

  const isExpired   = coupon.valid_until && new Date(coupon.valid_until) < new Date()
  const isScheduled = new Date(coupon.valid_from) > new Date()

  let status: 'active' | 'paused' | 'expired' | 'scheduled' = 'active'
  if (coupon.paused)        status = 'paused'
  else if (isExpired)       status = 'expired'
  else if (isScheduled)     status = 'scheduled'
  else if (!coupon.is_active) status = 'paused'

  const statusLabel: Record<typeof status, string> = isAr
    ? { active: 'نشط', paused: 'موقوف', expired: 'منتهي', scheduled: 'مجدول' }
    : { active: 'active', paused: 'paused', expired: 'expired', scheduled: 'scheduled' }

  const statusColors = {
    active:    'text-brand-success bg-brand-success/10 border-brand-success/20',
    paused:    'text-brand-muted bg-brand-muted/10 border-brand-muted/20',
    expired:   'text-brand-error bg-brand-error/10 border-brand-error/20',
    scheduled: 'text-brand-gold bg-brand-gold/10 border-brand-gold/20',
  }

  const usagePercent = coupon.usage_limit ? (coupon.usage_count / coupon.usage_limit) * 100 : 0

  const handleCopy = () => {
    onCopy(coupon.code)
    setCopying(true)
    setTimeout(() => setCopying(false), 2000)
  }

  const campaignName = isAr
    ? (coupon.campaign_name || coupon.description_ar || coupon.description_en || 'حملة بدون اسم')
    : (coupon.campaign_name || coupon.description_en || 'Unnamed Campaign')

  const dateLocale = isAr ? 'ar-BH' : 'en-BH'

  return (
    <div className="bg-brand-surface-2 border border-brand-border rounded-2xl overflow-hidden flex flex-col group hover:border-brand-gold/50 transition-all duration-300">
      {/* Ticket Header */}
      <div className="p-5 border-b border-brand-border border-dashed relative">
        <div className="absolute -bottom-2 -start-2 w-4 h-4 rounded-full bg-brand-black border border-brand-border" />
        <div className="absolute -bottom-2 -end-2 w-4 h-4 rounded-full bg-brand-black border border-brand-border" />

        <div className="flex items-start justify-between mb-3">
          <div className="flex flex-col">
            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border mb-2 w-fit ${statusColors[status]} ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {statusLabel[status]}
            </span>
            <h4 className={`text-sm font-bold text-brand-text truncate max-w-[180px] ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {campaignName}
            </h4>
          </div>
          <button
            onClick={handleCopy}
            className="p-2 rounded-lg bg-brand-surface border border-brand-border text-brand-gold hover:text-brand-gold-light transition-colors"
          >
            {copying ? (
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <rect x="9" y="9" width={13} height={13} rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            )}
          </button>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-brand-gold font-editorial tracking-tight">
            {coupon.type === 'percentage' ? `${coupon.value}%` : `${Number(coupon.value).toFixed(2)}`}
          </span>
          <span className={`text-xs font-bold text-brand-muted uppercase ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {coupon.type === 'percentage'
              ? (isAr ? 'خصم' : 'Discount')
              : (isAr ? 'د.ب خصم' : 'BHD OFF')}
          </span>
        </div>

        {coupon.max_discount_bhd && coupon.type === 'percentage' && (
          <p className={`text-[10px] font-bold text-brand-muted/60 mt-1 uppercase tracking-wide ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr
              ? `حتى ${Number(coupon.max_discount_bhd).toFixed(2)} د.ب كحد أقصى`
              : `UP TO ${Number(coupon.max_discount_bhd).toFixed(2)} BD MAX`}
          </p>
        )}
      </div>

      {/* Info */}
      <div className="p-5 flex-1 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <span className={`text-[10px] font-black uppercase tracking-widest text-brand-muted/60 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {isAr ? 'الحد الأدنى' : 'Min Order'}
            </span>
            <span className={`text-xs font-bold text-brand-text tabular-nums ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {Number(coupon.min_order_value_bhd || 0).toFixed(2)} {isAr ? 'د.ب' : 'BD'}
            </span>
          </div>
          <div className="flex flex-col gap-1 text-end">
            <span className={`text-[10px] font-black uppercase tracking-widest text-brand-muted/60 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {isAr ? 'الفروع' : 'Branches'}
            </span>
            <span className={`text-xs font-bold text-brand-text truncate ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {coupon.applicable_branches && coupon.applicable_branches.length > 0
                ? isAr
                  ? `${coupon.applicable_branches.length} فروع محددة`
                  : `${coupon.applicable_branches.length} Selected`
                : isAr ? 'جميع الفروع' : 'All Branches'}
            </span>
          </div>
        </div>

        {/* Validity */}
        <div className="flex items-center gap-2 text-brand-muted bg-brand-surface/50 p-2 rounded-xl border border-brand-border/50">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="4" width={18} height={18} rx="2" ry="2" /><path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          <span className={`text-[10px] font-bold uppercase tracking-tight ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {new Date(coupon.valid_from).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short' })}
            {' — '}
            {coupon.valid_until
              ? new Date(coupon.valid_until).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short', year: 'numeric' })
              : (isAr ? 'بلا انتهاء' : 'Endless')}
          </span>
        </div>

        {/* Usage Progress */}
        <div className="flex flex-col gap-2">
          <div className={`flex items-center justify-between text-[10px] font-black uppercase tracking-widest ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            <span className="text-brand-muted/60">{isAr ? 'الاستخدام' : 'Usage'}</span>
            <span className="text-brand-text tabular-nums">{coupon.usage_count} / {coupon.usage_limit || '∞'}</span>
          </div>
          <div className="h-1.5 w-full bg-brand-surface rounded-full overflow-hidden border border-brand-border/50">
            <div
              className={`h-full transition-all duration-500 rounded-full ${usagePercent > 90 ? 'bg-brand-error' : 'bg-brand-gold'}`}
              style={{ width: `${coupon.usage_limit ? Math.min(usagePercent, 100) : 100}%` }}
            />
          </div>
        </div>

        {/* Impact + Actions */}
        <div className="mt-auto pt-2 flex items-center justify-between border-t border-brand-border/30">
          <div className="flex flex-col">
            <span className={`text-[9px] font-black uppercase tracking-widest text-brand-muted/40 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {isAr ? 'تأثير الإيرادات' : 'Revenue Impact'}
            </span>
            <span className="text-xs font-black text-brand-gold tabular-nums">
              +{Number(coupon.total_revenue_impact || 0).toFixed(2)} {isAr ? 'د.ب' : 'BD'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onViewAnalytics(coupon)}
              className="p-2 rounded-lg hover:bg-brand-gold/10 text-brand-muted hover:text-brand-gold transition-colors"
              title={isAr ? 'التحليلات' : 'Analytics'}
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M12 20V10M18 20V4M6 20v-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              onClick={() => onEdit(coupon)}
              className="p-2 rounded-lg hover:bg-brand-gold/10 text-brand-muted hover:text-brand-gold transition-colors"
              title={isAr ? 'تعديل' : 'Edit'}
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              onClick={() => onTogglePause(coupon)}
              className="p-2 rounded-lg hover:bg-brand-gold/10 text-brand-muted hover:text-brand-gold transition-colors"
              title={coupon.paused ? (isAr ? 'استئناف' : 'Resume') : (isAr ? 'إيقاف مؤقت' : 'Pause')}
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                {coupon.paused
                  ? <path d="M5 3l14 9-14 9V3z" fill="currentColor" />
                  : <path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor" />
                }
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
