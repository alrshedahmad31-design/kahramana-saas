'use client'

import { useState, useEffect, useMemo } from 'react'
import { useLocale } from 'next-intl'
import { createClient } from '@/lib/supabase/client'

interface PaymentMethods {
  cash:    boolean
  benefit: boolean
  tap:     boolean
}

const DEFAULTS: PaymentMethods = { cash: true, benefit: false, tap: false }

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function PaymentSettings() {
  const isAr     = useLocale() === 'ar'
  const supabase = useMemo(() => createClient(), [])
  const font     = isAr ? 'font-almarai' : 'font-satoshi'

  const [methods,   setMethods]   = useState<PaymentMethods>(DEFAULTS)
  const [loading,   setLoading]   = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  useEffect(() => {
    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('system_settings')
        .select('value')
        .eq('key', 'payment_methods')
        .maybeSingle()
      if (data?.value) setMethods({ ...DEFAULTS, ...data.value })
      setLoading(false)
    }
    load()
  }, [supabase])

  async function save() {
    setSaveState('saving')
    const { data: { user } } = await supabase.auth.getUser()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('system_settings')
      .upsert({ key: 'payment_methods', value: methods, updated_by: user?.id ?? null, updated_at: new Date().toISOString() })
    setSaveState(error ? 'error' : 'saved')
    if (!error) setTimeout(() => setSaveState('idle'), 2500)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="w-8 h-8 rounded-full border-2 border-brand-gold/30 border-t-brand-gold animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl flex flex-col gap-8">
      <div>
        <h1 className={`text-2xl font-black text-brand-text ${isAr ? 'font-cairo' : 'font-editorial'}`}>
          {isAr ? 'طرق الدفع' : 'Payment Methods'}
        </h1>
        <p className={`text-sm text-brand-muted mt-1 ${font}`}>
          {isAr ? 'اختر طرق الدفع المتاحة للعملاء' : 'Configure accepted payment methods for customers'}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {/* Cash on Delivery */}
        <PaymentCard
          icon="💵"
          labelAr="الدفع نقداً"
          labelEn="Cash on Delivery"
          descAr="الطريقة الأكثر شيوعاً — متاح دائماً"
          descEn="Most popular method — always available"
          checked={methods.cash}
          onToggle={() => setMethods(p => ({ ...p, cash: !p.cash }))}
          statusAr="نشط"
          statusEn="Active"
          statusType="active"
          font={font}
          isAr={isAr}
        />

        {/* Benefit Pay */}
        <PaymentCard
          icon="🏦"
          labelAr="بنفيت باي (رمز QR)"
          labelEn="Benefit Pay (QR Code)"
          descAr="دفع سريع عبر رمز QR — يتطلب اعتماد التاجر"
          descEn="Fast payment via QR code — requires merchant approval"
          checked={methods.benefit}
          onToggle={() => setMethods(p => ({ ...p, benefit: !p.benefit }))}
          statusAr={methods.benefit ? 'نشط' : 'غير مفعّل'}
          statusEn={methods.benefit ? 'Active' : 'Not configured'}
          statusType={methods.benefit ? 'active' : 'pending'}
          configNote={isAr
            ? 'تقديم طلب اعتماد التاجر عبر البنك الأهلي'
            : 'Apply for merchant approval via National Bank'}
          font={font}
          isAr={isAr}
        />

        {/* Tap Payments (Coming Soon) */}
        <div className="relative rounded-2xl border border-brand-border bg-brand-surface-2 overflow-hidden">
          <div className="absolute inset-0 bg-brand-surface/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <span className={`text-xs font-black uppercase tracking-wider text-brand-muted/80 px-3 py-1.5 rounded-full border border-brand-border bg-brand-surface ${font}`}>
              {isAr ? 'قريباً' : 'Coming Soon'}
            </span>
          </div>
          <div className="flex items-center gap-4 px-5 py-4 opacity-40">
            <span className="text-2xl">💳</span>
            <div className="flex-1">
              <span className={`text-sm font-black text-brand-text block ${font}`}>
                {isAr ? 'بطاقات الدفع (Tap Payments)' : 'Card Payments (Tap Payments)'}
              </span>
              <span className={`text-xs text-brand-muted ${font}`}>
                {isAr ? 'فيزا، ماستركارد، مدى' : 'Visa, Mastercard, Mada'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="h-px bg-brand-border" />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saveState === 'saving'}
          className={`px-6 py-2.5 rounded-xl bg-brand-gold text-brand-black font-black text-sm
            hover:bg-brand-gold-light transition-colors disabled:opacity-50 ${font}`}
        >
          {saveState === 'saving'
            ? (isAr ? 'جاري الحفظ…' : 'Saving…')
            : (isAr ? 'حفظ التغييرات' : 'Save Changes')}
        </button>
        {saveState === 'saved' && (
          <span className={`text-brand-success text-sm font-bold ${font}`}>
            {isAr ? '✓ تم الحفظ' : '✓ Saved'}
          </span>
        )}
        {saveState === 'error' && (
          <span className={`text-brand-error text-sm font-bold ${font}`}>
            {isAr ? 'فشل الحفظ' : 'Save failed'}
          </span>
        )}
      </div>
    </div>
  )
}

function PaymentCard({
  icon, labelAr, labelEn, descAr, descEn,
  checked, onToggle, statusAr, statusEn, statusType, configNote,
  font, isAr,
}: {
  icon:        string
  labelAr:     string
  labelEn:     string
  descAr:      string
  descEn:      string
  checked:     boolean
  onToggle:    () => void
  statusAr:    string
  statusEn:    string
  statusType:  'active' | 'pending'
  configNote?: string
  font:        string
  isAr:        boolean
}) {
  return (
    <div className={`rounded-2xl border transition-all duration-200
      ${checked ? 'border-brand-gold/30 bg-brand-surface' : 'border-brand-border bg-brand-surface-2'}`}>
      <div className="flex items-center gap-4 px-5 py-4">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <span className={`text-sm font-black text-brand-text block ${font}`}>
            {isAr ? labelAr : labelEn}
          </span>
          <span className={`text-xs text-brand-muted ${font}`}>
            {isAr ? descAr : descEn}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold border
            ${statusType === 'active'
              ? 'text-brand-success border-brand-success/30 bg-brand-success/5'
              : 'text-brand-muted border-brand-border bg-brand-surface'} ${font}`}>
            {isAr ? statusAr : statusEn}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={onToggle}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200
              ${checked ? 'bg-brand-gold' : 'bg-brand-border'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-brand-black shadow transition-all duration-200
              ${checked ? 'start-[22px]' : 'start-0.5'}`} />
          </button>
        </div>
      </div>
      {configNote && !checked && (
        <div className="border-t border-brand-border px-5 py-3">
          <p className={`text-xs text-brand-muted/70 ${font}`}>{configNote}</p>
        </div>
      )}
    </div>
  )
}
