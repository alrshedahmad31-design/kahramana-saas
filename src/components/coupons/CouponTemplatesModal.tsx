'use client'

import { useState, useEffect } from 'react'
import { useLocale } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import type { CouponTemplateRow } from '@/lib/supabase/types'

interface Props {
  onSelect: (template: CouponTemplateRow) => void
  onClose:  () => void
}

export default function CouponTemplatesModal({ onSelect, onClose }: Props) {
  const isAr = useLocale() === 'ar'
  const [templates, setTemplates] = useState<CouponTemplateRow[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    const fetchTemplates = async () => {
      const supabase = createClient()
      const { data } = await supabase.from('coupon_templates').select('*').order('name')
      if (data) setTemplates(data as CouponTemplateRow[])
      setLoading(false)
    }
    fetchTemplates()
  }, [])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        dir={isAr ? 'rtl' : 'ltr'}
        className="bg-brand-surface-2 border border-brand-border rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-brand-border flex items-center justify-between bg-brand-surface-2/50">
          <h3 className={`text-lg font-black text-brand-text tracking-tight uppercase ${isAr ? 'font-cairo' : 'font-editorial'}`}>
            {isAr ? 'قوالب الحملات' : 'Campaign Templates'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={isAr ? 'إغلاق' : 'Close'}
            className="text-brand-muted hover:text-brand-text transition-colors"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 gap-4 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="py-20 flex justify-center">
              <span className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-gold" />
            </div>
          ) : (
            templates.map(t => (
              <button
                key={t.id}
                onClick={() => onSelect(t)}
                className="flex items-center gap-4 p-4 rounded-2xl border border-brand-border bg-brand-surface hover:border-brand-gold hover:bg-brand-surface-2 transition-all group text-start"
              >
                <div className="w-12 h-12 rounded-xl bg-brand-gold/10 flex items-center justify-center text-brand-gold group-hover:scale-110 transition-transform shrink-0">
                  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M12 2v20m0-20l-4 4m4-4l4 4M12 22l-4-4m4 4l4-4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={`font-bold text-brand-text group-hover:text-brand-gold transition-colors ${isAr ? 'font-almarai' : 'font-satoshi'}`}>{t.name}</h4>
                  <p className={`text-xs text-brand-muted truncate ${isAr ? 'font-almarai' : 'font-satoshi'}`}>{t.description}</p>
                </div>
                <div className="text-end shrink-0">
                  <p className="text-sm font-black text-brand-gold font-satoshi">
                    {Number(t.discount_value)}
                    {t.discount_type === 'percentage' ? '%' : (isAr ? ' د.ب' : ' BD')}
                  </p>
                  <span className={`text-[10px] font-black text-brand-muted uppercase tracking-widest bg-brand-surface-2 px-1.5 py-0.5 rounded border border-brand-border ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    {t.category}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="p-6 bg-brand-surface-2/50 border-t border-brand-border text-center">
          <p className={`text-[10px] font-bold text-brand-muted uppercase tracking-widest ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'اختر قالباً للبدء بإعدادات جاهزة' : 'Select a template to start with pre-configured settings'}
          </p>
        </div>
      </div>
    </div>
  )
}
