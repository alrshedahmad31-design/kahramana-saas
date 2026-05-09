'use client'

import { useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { Loader2, Save } from 'lucide-react'
import {
  getLoyaltyConfigForEditor,
  updateLoyaltyConfig,
} from '@/app/[locale]/dashboard/settings/loyalty-actions'
import { DEFAULT_LOYALTY_CONFIG, type LoyaltyConfig } from '@/lib/loyalty/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/lib/toast'

export default function LoyaltySettings() {
  const isAr = useLocale() === 'ar'
  const [cfg, setCfg]         = useState<LoyaltyConfig>(DEFAULT_LOYALTY_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    getLoyaltyConfigForEditor()
      .then((c) => { if (alive) setCfg(c) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  function patch<K extends keyof LoyaltyConfig>(k: K, v: LoyaltyConfig[K]) {
    setCfg((c) => ({ ...c, [k]: v }))
  }

  async function save() {
    setSaving(true)
    const res = await updateLoyaltyConfig(cfg)
    setSaving(false)
    if (res.success) {
      toast.success(isAr ? 'تم حفظ إعدادات الولاء' : 'Loyalty settings saved')
    } else {
      toast.error(res.error ?? (isAr ? 'فشل الحفظ' : 'Save failed'))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-brand-muted">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      <div>
        <h2 className="text-xl font-bold text-brand-text">
          {isAr ? 'إعدادات الولاء' : 'Loyalty settings'}
        </h2>
        <p className="text-sm text-brand-muted">
          {isAr
            ? 'تعديل قواعد كسب النقاط، الاسترداد، وحدود المستويات.'
            : 'Edit point earning, redemption rules, and tier thresholds.'}
        </p>
      </div>

      {/* Earning */}
      <section className="space-y-3 rounded-md border border-brand-border bg-brand-surface-2 p-4">
        <h3 className="text-sm font-semibold text-brand-text">
          {isAr ? 'الكسب والاسترداد' : 'Earning & redemption'}
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label={isAr ? 'نقاط لكل دينار' : 'Points per BHD'}
            type="number"
            min={1}
            step={1}
            value={cfg.pointsPerBhd}
            onChange={(v) => patch('pointsPerBhd', Math.round(v))}
          />
          <Field
            label={isAr ? 'قيمة النقطة (د.ب)' : 'Point value (BHD)'}
            type="number"
            min={0.0001}
            step={0.0001}
            value={cfg.pointValueBhd}
            onChange={(v) => patch('pointValueBhd', v)}
          />
          <Field
            label={isAr ? 'الحد الأدنى للاسترداد (نقاط)' : 'Min redemption (points)'}
            type="number"
            min={0}
            step={1}
            value={cfg.minRedemptionPoints}
            onChange={(v) => patch('minRedemptionPoints', Math.round(v))}
          />
          <Field
            label={isAr ? 'حد الاسترداد (٪ من الإجمالي)' : 'Max redemption (% of order)'}
            type="number"
            min={0}
            max={100}
            step={1}
            value={Math.round(cfg.maxRedemptionRatio * 100)}
            onChange={(v) => patch('maxRedemptionRatio', Math.max(0, Math.min(100, v)) / 100)}
          />
          <Field
            label={isAr ? 'صلاحية النقاط (شهر)' : 'Points expiry (months)'}
            type="number"
            min={1}
            step={1}
            value={cfg.pointsExpiryMonths}
            onChange={(v) => patch('pointsExpiryMonths', Math.round(v))}
          />
        </div>
      </section>

      {/* Tiers */}
      <section className="space-y-3 rounded-md border border-brand-border bg-brand-surface-2 p-4">
        <h3 className="text-sm font-semibold text-brand-text">
          {isAr ? 'مستويات الولاء (نقاط لكل مستوى)' : 'Tier thresholds (points)'}
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field
            label={isAr ? 'الفضي' : 'Silver'}
            type="number"
            min={0}
            step={1}
            value={cfg.tierSilverThreshold}
            onChange={(v) => patch('tierSilverThreshold', Math.round(v))}
          />
          <Field
            label={isAr ? 'الذهبي' : 'Gold'}
            type="number"
            min={0}
            step={1}
            value={cfg.tierGoldThreshold}
            onChange={(v) => patch('tierGoldThreshold', Math.round(v))}
          />
          <Field
            label={isAr ? 'البلاتيني' : 'Platinum'}
            type="number"
            min={0}
            step={1}
            value={cfg.tierPlatinumThreshold}
            onChange={(v) => patch('tierPlatinumThreshold', Math.round(v))}
          />
        </div>
        <p className="text-xs text-brand-muted">
          {isAr
            ? 'يجب أن تكون القيم متصاعدة: الفضي < الذهبي < البلاتيني'
            : 'Values must be strictly increasing: silver < gold < platinum'}
        </p>
      </section>

      <div className="flex items-center justify-end gap-3">
        <Button onClick={save} disabled={saving} className="gap-2 bg-brand-gold text-brand-black hover:bg-brand-gold-light">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isAr ? 'حفظ' : 'Save'}
        </Button>
      </div>
    </div>
  )
}

interface FieldProps {
  label:    string
  value:    number
  type:     'number'
  min?:     number
  max?:     number
  step?:    number
  onChange: (v: number) => void
}

function Field({ label, value, min, max, step, onChange }: FieldProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="tabular-nums"
      />
    </div>
  )
}
