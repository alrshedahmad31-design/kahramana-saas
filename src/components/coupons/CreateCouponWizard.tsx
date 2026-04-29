'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { createCoupon, updateCoupon } from '@/app/[locale]/dashboard/coupons/actions'
import CouponTemplatesModal from './CouponTemplatesModal'
import type { CouponRow, BranchRow, CouponTemplateRow } from '@/lib/supabase/types'

interface Props {
  coupon?:  CouponRow
  branches: BranchRow[]
  onClose:  () => void
  onSaved:  () => void
}

type Step = 'type' | 'details' | 'target' | 'restrictions' | 'limits' | 'schedule' | 'review'

const STEPS: Step[] = ['type', 'details', 'target', 'restrictions', 'limits', 'schedule', 'review']

const STEP_LABEL_EN: Record<Step, string> = {
  type:         'Type',
  details:      'Details',
  target:       'Target',
  restrictions: 'Restrictions',
  limits:       'Limits',
  schedule:     'Schedule',
  review:       'Review',
}
const STEP_LABEL_AR: Record<Step, string> = {
  type:         'النوع',
  details:      'التفاصيل',
  target:       'الجمهور',
  restrictions: 'القيود',
  limits:       'الحدود',
  schedule:     'الجدول',
  review:       'المراجعة',
}

export default function CreateCouponWizard({ coupon, branches, onClose, onSaved }: Props) {
  const locale = useLocale()
  const isAr   = locale === 'ar'
  const isEdit = !!coupon

  const [step, setStep]             = useState<Step>(isEdit ? 'details' : 'type')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)

  const [form, setForm] = useState({
    code:                coupon?.code || '',
    campaign_name:       coupon?.campaign_name || '',
    discount_type:       coupon?.discount_type || coupon?.type || 'percentage',
    value:               coupon?.value || 10,
    min_order_value:     coupon?.min_order_value || coupon?.min_order_value_bhd || 0,
    max_discount_amount: coupon?.max_discount_amount || coupon?.max_discount_bhd || null,
    customer_segment:    coupon?.customer_segment || 'all',
    applicable_branches: coupon?.applicable_branches || [],
    usage_limit:         coupon?.usage_limit || null,
    per_customer_limit:  coupon?.per_customer_limit || 1,
    valid_from:          coupon?.valid_from?.slice(0, 16) || new Date().toISOString().slice(0, 16),
    valid_until:         coupon?.valid_until?.slice(0, 16) || '',
    auto_apply:          coupon?.auto_apply || false,
    description_en:      coupon?.description_en || '',
    description_ar:      coupon?.description_ar || '',
  })

  const update = (patch: Partial<typeof form>) => setForm(prev => ({ ...prev, ...patch }))

  const handleTemplateSelect = (t: CouponTemplateRow) => {
    update({
      campaign_name:   t.name,
      discount_type:   t.discount_type,
      value:           Number(t.discount_value),
      min_order_value: t.suggested_min_order ? Number(t.suggested_min_order) : 0,
      usage_limit:     t.suggested_max_uses ? Number(t.suggested_max_uses) : null,
      description_en:  t.description || '',
    })
    setShowTemplates(false)
    setStep('details')
  }

  const next = () => {
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1])
  }

  const prev = () => {
    const idx = STEPS.indexOf(step)
    if (idx > 0) setStep(STEPS[idx - 1])
  }

  const handleSave = async () => {
    setLoading(true)
    setError(null)
    const payload = {
      ...form,
      type:               (form.discount_type === 'percentage' ? 'percentage' : 'fixed_amount') as 'percentage' | 'fixed_amount',
      min_order_value_bhd: Number(form.min_order_value),
      max_discount_bhd:   form.max_discount_amount ? Number(form.max_discount_amount) : null,
      value:              Number(form.value),
      usage_limit:        form.usage_limit ? Number(form.usage_limit) : null,
      per_customer_limit: Number(form.per_customer_limit),
      is_active:          true,
      locale,
    }
    const res = isEdit ? await updateCoupon(coupon.id, payload) : await createCoupon(payload)
    if (res.success) onSaved()
    else { setError(res.error); setLoading(false) }
  }

  const labelCls = `text-[10px] font-black uppercase tracking-widest text-brand-muted mb-1.5 block ${isAr ? 'font-almarai' : 'font-satoshi'}`
  const inputCls = `w-full bg-brand-surface border border-brand-border rounded-xl px-4 py-2.5 text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors ${isAr ? 'font-almarai' : 'font-satoshi'}`

  const stepIdx = STEPS.indexOf(step)

  const segmentLabel = (s: string) => {
    if (!isAr) return `${s.charAt(0).toUpperCase() + s.slice(1)} Customers`
    const map: Record<string, string> = { all: 'جميع العملاء', new: 'العملاء الجدد', returning: 'العملاء العائدون', vip: 'عملاء VIP' }
    return map[s] ?? s
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div
        dir={isAr ? 'rtl' : 'ltr'}
        className="bg-brand-surface-2 border border-brand-border rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="p-6 border-b border-brand-border flex items-center justify-between bg-brand-surface-2/50">
          <div>
            <h2 className={`text-xl font-black text-brand-text tracking-tight ${isAr ? 'font-cairo' : 'font-editorial'}`}>
              {isEdit ? (isAr ? 'تعديل الحملة' : 'Edit Campaign') : (isAr ? 'إنشاء حملة جديدة' : 'Create New Campaign')}
            </h2>
            <p className={`text-xs text-brand-muted mt-1 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {isAr
                ? `الخطوة ${stepIdx + 1} من 7: ${STEP_LABEL_AR[step]}`
                : `Step ${stepIdx + 1} of 7: ${STEP_LABEL_EN[step].toUpperCase()}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isAr ? 'إغلاق' : 'Close'}
            className="text-brand-muted hover:text-brand-text transition-colors"
          >
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">

          {/* ── Step: Type ─────────────────────────────────────── */}
          {step === 'type' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => { update({ discount_type: 'percentage' }); next() }}
                className="p-6 rounded-2xl border border-brand-border hover:border-brand-gold bg-brand-surface text-start transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-brand-gold/10 flex items-center justify-center text-brand-gold mb-4 group-hover:scale-110 transition-transform">
                  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 5L5 19M10 7a3 3 0 11-6 0 3 3 0 016 0zm10 10a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <h4 className={`font-bold text-brand-text mb-1 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {isAr ? 'خصم نسبي' : 'Percentage Discount'}
                </h4>
                <p className={`text-xs text-brand-muted leading-relaxed ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {isAr ? 'مثالي للتخفيضات الشاملة (مثلاً: 20% خصم على كل شيء).' : 'Perfect for store-wide sales (e.g., 20% OFF everything).'}
                </p>
              </button>

              <button
                onClick={() => { update({ discount_type: 'fixed' }); next() }}
                className="p-6 rounded-2xl border border-brand-border hover:border-brand-gold bg-brand-surface text-start transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-brand-gold/10 flex items-center justify-center text-brand-gold mb-4 group-hover:scale-110 transition-transform">
                  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 1v22m5-18H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H7" /></svg>
                </div>
                <h4 className={`font-bold text-brand-text mb-1 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {isAr ? 'مبلغ ثابت' : 'Fixed Amount'}
                </h4>
                <p className={`text-xs text-brand-muted leading-relaxed ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {isAr ? 'خصم مباشر (مثلاً: 5 د.ب خصم على طلبك).' : 'Direct value off (e.g., BD 5 OFF your order).'}
                </p>
              </button>

              <button
                onClick={() => setShowTemplates(true)}
                className="p-6 rounded-2xl border border-brand-gold/30 hover:border-brand-gold bg-brand-gold/5 text-start transition-all group sm:col-span-2"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-brand-gold flex items-center justify-center text-brand-black group-hover:scale-110 transition-transform shadow-lg shadow-brand-gold/20">
                    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2v20m0-20l-4 4m4-4l4 4M12 22l-4-4m4 4l4-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                  <div>
                    <h4 className={`font-bold text-brand-text group-hover:text-brand-gold transition-colors ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                      {isAr ? 'تصفح القوالب' : 'Browse Templates'}
                    </h4>
                    <p className={`text-xs text-brand-muted leading-relaxed ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                      {isAr ? 'ابدأ من حملات جاهزة (ترحيب، VIP، إلخ).' : 'Start from pre-made campaigns (Welcome, VIP, etc).'}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* ── Step: Details ──────────────────────────────────── */}
          {step === 'details' && (
            <div className="flex flex-col gap-6 max-w-md mx-auto">
              <div>
                <label className={labelCls}>{isAr ? 'اسم الحملة' : 'Campaign Name'}</label>
                <input
                  type="text"
                  value={form.campaign_name}
                  onChange={e => update({ campaign_name: e.target.value })}
                  placeholder={isAr ? 'مثلاً: تخفيضات الصيف 2026' : 'e.g. Summer Sale 2026'}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>{isAr ? 'كود الكوبون' : 'Coupon Code'}</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={e => update({ code: e.target.value.toUpperCase() })}
                  placeholder="SUMMER50"
                  className={`${inputCls} font-black tracking-widest`}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>
                    {isAr
                      ? `قيمة الخصم ${form.discount_type === 'percentage' ? '(%)' : '(د.ب)'}`
                      : `Discount Value ${form.discount_type === 'percentage' ? '(%)' : '(BD)'}`}
                  </label>
                  <input
                    type="number"
                    value={form.value}
                    onChange={e => update({ value: Number(e.target.value) })}
                    className={inputCls}
                  />
                </div>
                {form.discount_type === 'percentage' && (
                  <div>
                    <label className={labelCls}>{isAr ? 'الحد الأقصى للخصم (د.ب)' : 'Max Discount (BD)'}</label>
                    <input
                      type="number"
                      value={form.max_discount_amount || ''}
                      onChange={e => update({ max_discount_amount: e.target.value ? Number(e.target.value) : null })}
                      placeholder={isAr ? 'بلا حد' : 'Unlimited'}
                      className={inputCls}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Step: Target ───────────────────────────────────── */}
          {step === 'target' && (
            <div className="flex flex-col gap-4 max-w-md mx-auto">
              <label className={labelCls}>{isAr ? 'شريحة العملاء' : 'Customer Segment'}</label>
              {(['all', 'new', 'returning', 'vip'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => update({ customer_segment: s })}
                  className={`p-4 rounded-xl border text-start transition-all flex items-center justify-between
                    ${form.customer_segment === s
                      ? 'bg-brand-gold/10 border-brand-gold text-brand-gold'
                      : 'bg-brand-surface border-brand-border text-brand-muted'}`}
                >
                  <span className={`font-bold ${isAr ? 'font-almarai' : 'font-satoshi'}`}>{segmentLabel(s)}</span>
                  {form.customer_segment === s && (
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* ── Step: Restrictions ─────────────────────────────── */}
          {step === 'restrictions' && (
            <div className="flex flex-col gap-6 max-w-md mx-auto">
              <div>
                <label className={labelCls}>{isAr ? 'الحد الأدنى للطلب (د.ب)' : 'Minimum Order Value (BD)'}</label>
                <input
                  type="number"
                  value={form.min_order_value}
                  onChange={e => update({ min_order_value: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>{isAr ? 'الفروع المتاحة' : 'Applicable Branches'}</label>
                <div className="grid grid-cols-1 gap-2">
                  {branches.map(b => (
                    <label key={b.id} className="flex items-center gap-3 p-3 rounded-xl border border-brand-border bg-brand-surface cursor-pointer hover:bg-brand-surface-2 transition-colors">
                      <input
                        type="checkbox"
                        checked={form.applicable_branches.includes(b.id)}
                        onChange={e => {
                          const next = e.target.checked
                            ? [...form.applicable_branches, b.id]
                            : form.applicable_branches.filter(id => id !== b.id)
                          update({ applicable_branches: next })
                        }}
                        className="w-5 h-5 accent-brand-gold"
                      />
                      <span className={`text-sm font-bold text-brand-text ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                        {isAr ? b.name_ar : b.name_en}
                      </span>
                    </label>
                  ))}
                  {branches.length === 0 && (
                    <p className={`text-xs text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                      {isAr ? 'لا توجد فروع متاحة.' : 'No branches available.'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Step: Limits ───────────────────────────────────── */}
          {step === 'limits' && (
            <div className="flex flex-col gap-6 max-w-md mx-auto">
              <div>
                <label className={labelCls}>{isAr ? 'حد الاستخدام الكلي' : 'Total Usage Limit'}</label>
                <input
                  type="number"
                  value={form.usage_limit || ''}
                  onChange={e => update({ usage_limit: e.target.value ? Number(e.target.value) : null })}
                  placeholder={isAr ? 'بلا حد' : 'Unlimited'}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>{isAr ? 'الاستخدام لكل عميل' : 'Usage Per Customer'}</label>
                <input
                  type="number"
                  value={form.per_customer_limit}
                  onChange={e => update({ per_customer_limit: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
              <div className="flex items-center gap-3 p-4 rounded-xl border border-brand-border bg-brand-surface">
                <input
                  type="checkbox"
                  checked={form.auto_apply}
                  onChange={e => update({ auto_apply: e.target.checked })}
                  className="w-5 h-5 accent-brand-gold"
                />
                <div>
                  <span className={`text-sm font-bold text-brand-text block ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    {isAr ? 'تطبيق تلقائي عند الدفع' : 'Auto-apply at checkout'}
                  </span>
                  <span className={`text-[10px] text-brand-muted uppercase ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    {isAr ? 'لا يحتاج العميل إدخال الكود' : 'No code required from customer'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Step: Schedule ─────────────────────────────────── */}
          {step === 'schedule' && (
            <div className="flex flex-col gap-6 max-w-md mx-auto">
              <div>
                <label className={labelCls}>{isAr ? 'تاريخ ووقت البدء' : 'Start Date & Time'}</label>
                <input
                  type="datetime-local"
                  value={form.valid_from}
                  onChange={e => update({ valid_from: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>{isAr ? 'تاريخ ووقت الانتهاء (اختياري)' : 'End Date & Time (Optional)'}</label>
                <input
                  type="datetime-local"
                  value={form.valid_until}
                  onChange={e => update({ valid_until: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {/* ── Step: Review ───────────────────────────────────── */}
          {step === 'review' && (
            <div className="flex flex-col gap-6 max-w-lg mx-auto bg-brand-surface p-6 rounded-2xl border border-brand-border border-dashed">
              <div className="text-center mb-4">
                <span className={`text-[10px] font-black uppercase tracking-widest text-brand-gold bg-brand-gold/10 px-3 py-1 rounded-full border border-brand-gold/20 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {isAr ? 'مراجعة الحملة' : 'Review Campaign'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                {[
                  { labelEn: 'Campaign', labelAr: 'الحملة',   value: form.campaign_name || (isAr ? 'بدون اسم' : 'No Name'), align: '' },
                  { labelEn: 'Code',     labelAr: 'الكود',    value: form.code, align: 'text-end', extraCls: 'text-brand-gold tracking-widest uppercase' },
                  { labelEn: 'Offer',    labelAr: 'العرض',    value: `${form.value}${form.discount_type === 'percentage' ? '%' : (isAr ? ' د.ب' : ' BD')} ${isAr ? 'خصم' : 'OFF'}`, align: '' },
                  { labelEn: 'Segment',  labelAr: 'الشريحة',  value: segmentLabel(form.customer_segment), align: 'text-end' },
                ].map(row => (
                  <div key={row.labelEn} className={row.align}>
                    <p className={`text-[10px] font-black uppercase text-brand-muted/60 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                      {isAr ? row.labelAr : row.labelEn}
                    </p>
                    <p className={`font-bold text-brand-text ${row.extraCls ?? ''} ${isAr ? 'font-almarai' : 'font-satoshi'}`}>{row.value}</p>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-brand-border/30">
                <p className={`text-[10px] font-black uppercase text-brand-muted/60 mb-2 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {isAr ? 'القيود' : 'Restrictions'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className={`text-[10px] font-bold bg-brand-surface-2 px-2 py-1 rounded border border-brand-border ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    {isAr ? `الحد الأدنى: ${form.min_order_value} د.ب` : `Min Order: ${form.min_order_value} BD`}
                  </span>
                  <span className={`text-[10px] font-bold bg-brand-surface-2 px-2 py-1 rounded border border-brand-border ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    {isAr
                      ? `الفروع: ${form.applicable_branches.length || 'الكل'}`
                      : `Branches: ${form.applicable_branches.length || 'All'}`}
                  </span>
                  {form.auto_apply && (
                    <span className={`text-[10px] font-bold bg-brand-success/10 text-brand-success px-2 py-1 rounded border border-brand-success/20 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                      {isAr ? 'تطبيق تلقائي' : 'Auto-Apply'}
                    </span>
                  )}
                </div>
              </div>
              {error && (
                <p className={`text-xs text-brand-error bg-brand-error/10 p-3 rounded-xl border border-brand-error/20 font-bold ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-brand-border bg-brand-surface-2/50 flex items-center justify-between">
          <button
            onClick={step === 'type' ? onClose : prev}
            className={`px-6 py-2.5 rounded-xl border border-brand-border text-sm font-bold text-brand-muted hover:text-brand-text transition-colors ${isAr ? 'font-almarai' : 'font-satoshi'}`}
          >
            {step === 'type'
              ? (isAr ? 'إلغاء' : 'Cancel')
              : (isAr ? 'رجوع'  : 'Back')}
          </button>

          <button
            onClick={step === 'review' ? handleSave : next}
            disabled={loading || (step === 'details' && (!form.code || !form.campaign_name))}
            className={`px-8 py-2.5 rounded-xl bg-brand-gold text-brand-black text-sm font-black uppercase tracking-widest hover:bg-brand-gold-light transition-all disabled:opacity-50 ${isAr ? 'font-almarai' : 'font-satoshi'}`}
          >
            {loading
              ? (isAr ? 'جاري المعالجة...' : 'Processing...')
              : step === 'review'
                ? (isEdit ? (isAr ? 'تحديث الحملة' : 'Update Campaign') : (isAr ? 'إطلاق الحملة' : 'Launch Campaign'))
                : (isAr ? 'التالي' : 'Next Step')}
          </button>
        </div>

        {showTemplates && <CouponTemplatesModal onSelect={handleTemplateSelect} onClose={() => setShowTemplates(false)} />}
      </div>
    </div>
  )
}
