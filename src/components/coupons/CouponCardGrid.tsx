'use client'

import { useLocale } from 'next-intl'
import CouponCard from './CouponCard'
import type { CouponRow } from '@/lib/supabase/types'

interface Props {
  coupons:         CouponRow[]
  onEdit:          (coupon: CouponRow) => void
  onTogglePause:   (coupon: CouponRow) => void
  onCopy:          (code: string) => void
  onViewAnalytics: (coupon: CouponRow) => void
}

export default function CouponCardGrid({ coupons, onEdit, onTogglePause, onCopy, onViewAnalytics }: Props) {
  const isAr = useLocale() === 'ar'

  if (coupons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 bg-brand-surface-2 border border-brand-border border-dashed rounded-3xl">
        <div className="w-16 h-16 rounded-full bg-brand-gold/10 flex items-center justify-center text-brand-gold mb-4">
          <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M15 5l-1.761 4.239a2 2 0 01-1 1L8 12l4.239 1.761a2 2 0 011 1L15 19l1.761-4.239a2 2 0 011-1L22 12l-4.239-1.761a2 2 0 01-1-1L15 5z" />
          </svg>
        </div>
        <h3 className={`text-lg font-bold text-brand-text mb-1 tracking-tight ${isAr ? 'font-cairo' : 'font-editorial'}`}>
          {isAr ? 'لا توجد كوبونات' : 'No coupons found'}
        </h3>
        <p className={`text-sm text-brand-muted text-center max-w-xs leading-relaxed ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {isAr
            ? 'جرب تعديل الفلاتر أو أنشئ حملة جديدة للبدء.'
            : 'Try adjusting your filters or create a new campaign to get started.'}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {coupons.map((coupon) => (
        <CouponCard
          key={coupon.id}
          coupon={coupon}
          onEdit={onEdit}
          onTogglePause={onTogglePause}
          onCopy={onCopy}
          onViewAnalytics={onViewAnalytics}
        />
      ))}
    </div>
  )
}
