'use client'

import { useState, useEffect, useMemo } from 'react'
import { useLocale } from 'next-intl'
import { createClient } from '@/lib/supabase/client'

interface MenuDisplaySettings {
  auto_disable_out_of_stock: boolean
  show_new_badge:            boolean
  show_popular_badge:        boolean
  prices_3_decimals:         boolean
  show_starting_from:        boolean
}

const DEFAULTS: MenuDisplaySettings = {
  auto_disable_out_of_stock: false,
  show_new_badge:            true,
  show_popular_badge:        true,
  prices_3_decimals:         true,
  show_starting_from:        true,
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function MenuSettings() {
  const isAr     = useLocale() === 'ar'
  const supabase = useMemo(() => createClient(), [])
  const font     = isAr ? 'font-almarai' : 'font-satoshi'

  const [settings,  setSettings]  = useState<MenuDisplaySettings>(DEFAULTS)
  const [loading,   setLoading]   = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  useEffect(() => {
    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('system_settings')
        .select('value')
        .eq('key', 'menu_display')
        .maybeSingle()
      if (data?.value) setSettings({ ...DEFAULTS, ...data.value })
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
      .upsert({ key: 'menu_display', value: settings, updated_by: user?.id ?? null, updated_at: new Date().toISOString() })
    setSaveState(error ? 'error' : 'saved')
    if (!error) setTimeout(() => setSaveState('idle'), 2500)
  }

  function toggle(key: keyof MenuDisplaySettings) {
    setSettings(p => ({ ...p, [key]: !p[key] }))
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
          {isAr ? 'إعدادات القائمة' : 'Menu Configuration'}
        </h1>
        <p className={`text-sm text-brand-muted mt-1 ${font}`}>
          {isAr ? 'تحكم في عرض وتنظيم القائمة للعملاء' : 'Control menu display and availability for customers'}
        </p>
      </div>

      {/* Availability */}
      <Section label={isAr ? 'توفر الأصناف' : 'Item Availability'} font={font}>
        <Toggle
          label={isAr ? 'تعطيل الأصناف المنتهية تلقائياً' : 'Auto-disable out-of-stock items'}
          desc={isAr ? 'أخفِ الأصناف المنتهية من القائمة تلقائياً' : 'Automatically hide unavailable items from the menu'}
          checked={settings.auto_disable_out_of_stock}
          onToggle={() => toggle('auto_disable_out_of_stock')}
          font={font}
        />
      </Section>

      {/* Badges */}
      <Section label={isAr ? 'شارات الأصناف' : 'Item Badges'} font={font}>
        <Toggle
          label={isAr ? 'شارة "جديد"' : '"New" Badge'}
          desc={isAr ? 'عرض شارة جديد للأصناف المضافة خلال آخر 7 أيام' : 'Show "New" badge for items added in the last 7 days'}
          checked={settings.show_new_badge}
          onToggle={() => toggle('show_new_badge')}
          font={font}
        />
        <Toggle
          label={isAr ? 'شارة "الأكثر طلباً"' : '"Popular" Badge'}
          desc={isAr ? 'عرض شارة الشعبية على أكثر 10 أصناف طلباً' : 'Show "Popular" badge on the top 10 ordered items'}
          checked={settings.show_popular_badge}
          onToggle={() => toggle('show_popular_badge')}
          font={font}
        />
      </Section>

      {/* Pricing display */}
      <Section label={isAr ? 'عرض الأسعار' : 'Pricing Display'} font={font}>
        <Toggle
          label={isAr ? 'الأسعار بثلاثة أرقام عشرية' : '3 Decimal Places'}
          desc={isAr ? 'عرض الأسعار بصيغة X.XXX' : 'Display prices in X.XXX format'}
          checked={settings.prices_3_decimals}
          onToggle={() => toggle('prices_3_decimals')}
          font={font}
        />
        <Toggle
          label={isAr ? 'عرض "يبدأ من"' : '"Starting From" Text'}
          desc={isAr ? 'عرض "يبدأ من" للأصناف ذات الأحجام المتعددة' : 'Show "Starting from" for items with size variants'}
          checked={settings.show_starting_from}
          onToggle={() => toggle('show_starting_from')}
          font={font}
        />
      </Section>

      {/* Category order — coming soon */}
      <div className="flex flex-col gap-3">
        <label className={`text-xs font-black uppercase tracking-widest text-brand-muted ${font}`}>
          {isAr ? 'ترتيب الفئات' : 'Category Order'}
        </label>
        <div className="flex flex-col items-center justify-center py-10 gap-3 rounded-xl border border-brand-border border-dashed">
          <p className={`text-brand-muted text-sm font-bold ${font}`}>
            {isAr ? 'ترتيب الفئات بالسحب — قريباً' : 'Drag-to-reorder categories — Coming Soon'}
          </p>
          <p className={`text-brand-muted/50 text-xs ${font}`}>
            {isAr ? 'يمكن حالياً إدارة الترتيب من صفحة القائمة' : 'Manage order from the Menu page for now'}
          </p>
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
            : (isAr ? 'حفظ الإعدادات' : 'Save Settings')}
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

function Section({ label, font, children }: { label: string; font: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <label className={`text-xs font-black uppercase tracking-widest text-brand-muted ${font}`}>{label}</label>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

function Toggle({
  label, desc, checked, onToggle, font,
}: {
  label:    string
  desc:     string
  checked:  boolean
  onToggle: () => void
  font:     string
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5 rounded-xl bg-brand-surface-2 border border-brand-border">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className={`text-sm font-bold text-brand-text ${font}`}>{label}</span>
        <span className={`text-xs text-brand-muted ${font}`}>{desc}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        className={`relative w-11 h-6 rounded-full shrink-0 transition-colors duration-200
          ${checked ? 'bg-brand-gold' : 'bg-brand-border'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-brand-black shadow transition-all duration-200
          ${checked ? 'start-[22px]' : 'start-0.5'}`} />
      </button>
    </div>
  )
}
