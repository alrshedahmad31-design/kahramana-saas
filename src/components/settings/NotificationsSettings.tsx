'use client'

import { useState, useEffect, useMemo } from 'react'
import { useLocale } from 'next-intl'
import { createClient } from '@/lib/supabase/client'

interface NotifPrefs {
  email_new_order:    boolean
  email_order_update: boolean
  email_low_stock:    boolean
  email_daily_report: boolean
  email_new_review:   boolean
  sms_critical:       boolean
  quiet_start:        string
  quiet_end:          string
}

const DEFAULTS: NotifPrefs = {
  email_new_order:    true,
  email_order_update: true,
  email_low_stock:    false,
  email_daily_report: true,
  email_new_review:   false,
  sms_critical:       false,
  quiet_start:        '23:00',
  quiet_end:          '08:00',
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function NotificationsSettings() {
  const isAr     = useLocale() === 'ar'
  const supabase = useMemo(() => createClient(), [])
  const font     = isAr ? 'font-almarai' : 'font-satoshi'

  const [prefs,     setPrefs]     = useState<NotifPrefs>(DEFAULTS)
  const [loading,   setLoading]   = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await supabase
        .from('user_preferences')
        .select('notification_prefs')
        .eq('user_id', user.id)
        .maybeSingle()
      if (data?.notification_prefs && Object.keys(data.notification_prefs).length > 0) {
        setPrefs({ ...DEFAULTS, ...(data.notification_prefs as Record<string, unknown>) })
      }
      setLoading(false)
    }
    load()
  }, [supabase])

  async function save() {
    setSaveState('saving')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaveState('error'); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase
      .from('user_preferences')
      .upsert({ user_id: user.id, notification_prefs: prefs as never, updated_at: new Date().toISOString() })
    setSaveState(error ? 'error' : 'saved')
    if (!error) setTimeout(() => setSaveState('idle'), 2500)
  }

  function toggle(key: keyof NotifPrefs) {
    setPrefs(p => ({ ...p, [key]: !p[key as keyof Pick<NotifPrefs, 'email_new_order'>] }))
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
          {isAr ? 'الإشعارات' : 'Notifications'}
        </h1>
        <p className={`text-sm text-brand-muted mt-1 ${font}`}>
          {isAr ? 'تحكم في أنواع الإشعارات التي تصلك عبر كل قناة' : 'Control which notifications you receive on each channel'}
        </p>
      </div>

      {/* Email notifications */}
      <Section label={isAr ? 'إشعارات البريد الإلكتروني' : 'Email Notifications'} font={font}>
        <Toggle
          label={isAr ? 'طلب جديد' : 'New Order'}
          desc={isAr ? 'إشعار فوري عند ورود طلب جديد' : 'Instant alert when a new order arrives'}
          checked={prefs.email_new_order}
          onToggle={() => toggle('email_new_order')}
          font={font}
        />
        <Toggle
          label={isAr ? 'تحديث الطلب' : 'Order Status Update'}
          desc={isAr ? 'إشعار عند تغيير حالة الطلب' : 'Alert when an order changes status'}
          checked={prefs.email_order_update}
          onToggle={() => toggle('email_order_update')}
          font={font}
        />
        <Toggle
          label={isAr ? 'مخزون منخفض' : 'Low Stock Alert'}
          desc={isAr ? 'تحذير عند انخفاض مستوى المخزون' : 'Warning when inventory runs low'}
          checked={prefs.email_low_stock}
          onToggle={() => toggle('email_low_stock')}
          font={font}
        />
        <Toggle
          label={isAr ? 'ملخص يومي' : 'Daily Summary'}
          desc={isAr ? 'تقرير مبيعات كل صباح' : 'Daily sales report every morning'}
          checked={prefs.email_daily_report}
          onToggle={() => toggle('email_daily_report')}
          font={font}
        />
        <Toggle
          label={isAr ? 'تقييم جديد' : 'New Review'}
          desc={isAr ? 'إشعار عند كتابة تقييم من عميل' : 'Alert when a customer leaves a review'}
          checked={prefs.email_new_review}
          onToggle={() => toggle('email_new_review')}
          font={font}
        />
      </Section>

      {/* SMS notifications */}
      <Section label={isAr ? 'إشعارات الرسائل النصية' : 'SMS Notifications'} font={font}>
        <Toggle
          label={isAr ? 'التنبيهات الحرجة فقط' : 'Critical Alerts Only'}
          desc={isAr ? 'رسائل SMS للمشاكل العاجلة فقط' : 'SMS for urgent issues only'}
          checked={prefs.sms_critical}
          onToggle={() => toggle('sms_critical')}
          font={font}
        />
      </Section>

      {/* Quiet hours */}
      <Section label={isAr ? 'ساعات الهدوء' : 'Quiet Hours'} font={font}>
        <p className={`text-xs text-brand-muted ${font}`}>
          {isAr ? 'لا تصلك إشعارات خلال هذه الساعات' : 'No notifications during these hours'}
        </p>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex flex-col gap-1.5">
            <label className={`text-[11px] text-brand-muted font-bold ${font}`}>
              {isAr ? 'من' : 'From'}
            </label>
            <input
              type="time"
              value={prefs.quiet_start}
              onChange={e => setPrefs(p => ({ ...p, quiet_start: e.target.value }))}
              className={`px-3 py-2 rounded-xl bg-brand-surface-2 border border-brand-border
                text-brand-text text-sm outline-none font-satoshi
                focus:border-brand-gold/50 transition-colors`}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={`text-[11px] text-brand-muted font-bold ${font}`}>
              {isAr ? 'إلى' : 'To'}
            </label>
            <input
              type="time"
              value={prefs.quiet_end}
              onChange={e => setPrefs(p => ({ ...p, quiet_end: e.target.value }))}
              className={`px-3 py-2 rounded-xl bg-brand-surface-2 border border-brand-border
                text-brand-text text-sm outline-none font-satoshi
                focus:border-brand-gold/50 transition-colors`}
            />
          </div>
        </div>
      </Section>

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
            : (isAr ? 'حفظ التفضيلات' : 'Save Preferences')}
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
      <label className={`text-xs font-black uppercase tracking-widest text-brand-muted ${font}`}>
        {label}
      </label>
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
