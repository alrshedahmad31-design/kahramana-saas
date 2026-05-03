'use client'

import { useState, useEffect, useMemo } from 'react'
import { useLocale } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from '@/i18n/routing'

type Theme      = 'dark'
type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'

interface Prefs {
  language:    string
  theme:       Theme
  timezone:    string
  date_format: DateFormat
}

const DEFAULTS: Prefs = {
  language:    'ar',
  theme:       'dark',
  timezone:    'Asia/Bahrain',
  date_format: 'DD/MM/YYYY',
}

const TIMEZONES = [
  { value: 'Asia/Bahrain',   labelAr: 'البحرين (UTC+3)',        labelEn: 'Bahrain (UTC+3)'        },
  { value: 'Asia/Riyadh',    labelAr: 'الرياض (UTC+3)',         labelEn: 'Riyadh (UTC+3)'         },
  { value: 'Asia/Kuwait',    labelAr: 'الكويت (UTC+3)',         labelEn: 'Kuwait (UTC+3)'         },
  { value: 'Asia/Baghdad',   labelAr: 'بغداد (UTC+3)',          labelEn: 'Baghdad (UTC+3)'        },
  { value: 'Asia/Dubai',     labelAr: 'دبي (UTC+4)',            labelEn: 'Dubai (UTC+4)'          },
  { value: 'Asia/Muscat',    labelAr: 'مسقط (UTC+4)',           labelEn: 'Muscat (UTC+4)'         },
  { value: 'Africa/Cairo',   labelAr: 'القاهرة (UTC+2/+3)',     labelEn: 'Cairo (UTC+2/+3)'       },
  { value: 'Europe/London',  labelAr: 'لندن (UTC+0/+1)',        labelEn: 'London (UTC+0/+1)'      },
]

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function AppearanceSettings() {
  const isAr     = useLocale() === 'ar'
  const supabase = useMemo(() => createClient(), [])
  const router   = useRouter()
  const font     = isAr ? 'font-almarai' : 'font-satoshi'

  const [prefs,     setPrefs]     = useState<Prefs>(DEFAULTS)
  const [loading,   setLoading]   = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await supabase
        .from('user_preferences')
        .select('language, theme, timezone, date_format')
        .eq('user_id', user.id)
        .maybeSingle()
      if (data) setPrefs({ ...DEFAULTS, ...(data as Partial<Prefs>) })
      setLoading(false)
    }
    load()
  }, [supabase])

  async function save() {
    setSaveState('saving')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaveState('error'); return }
    const { error } = await supabase
      .from('user_preferences')
      .upsert({ user_id: user.id, ...prefs, updated_at: new Date().toISOString() })
    if (error) { setSaveState('error'); return }
    setSaveState('saved')
    router.push('/dashboard/settings', { locale: prefs.language as 'ar' | 'en' })
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
          {isAr ? 'المظهر والتفضيلات' : 'Appearance & Preferences'}
        </h1>
        <p className={`text-sm text-brand-muted mt-1 ${font}`}>
          {isAr ? 'تخصيص تجربة استخدام لوحة التحكم' : 'Customize your dashboard experience'}
        </p>
      </div>

      {/* Language */}
      <div className="flex flex-col gap-3">
        <label className={`text-xs font-black uppercase tracking-widest text-brand-muted ${font}`}>
          {isAr ? 'اللغة' : 'Language'}
        </label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'ar', labelAr: 'العربية', labelEn: 'العربية', note: 'RTL' },
            { value: 'en', labelAr: 'English',  labelEn: 'English', note: 'LTR' },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPrefs(p => ({ ...p, language: opt.value }))}
              className={`flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all duration-150
                ${prefs.language === opt.value
                  ? 'bg-brand-gold/10 border-brand-gold text-brand-gold'
                  : 'bg-brand-surface-2 border-brand-border text-brand-muted hover:border-brand-gold/30 hover:text-brand-text'}`}
            >
              <span className={`font-bold text-sm ${opt.value === 'ar' ? 'font-almarai' : 'font-satoshi'}`}>
                {isAr ? opt.labelAr : opt.labelEn}
              </span>
              <span className={`text-[10px] opacity-60 font-satoshi`}>{opt.note}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Theme */}
      <div className="flex flex-col gap-3">
        <label className={`text-xs font-black uppercase tracking-widest text-brand-muted ${font}`}>
          {isAr ? 'نظام الألوان' : 'Color Theme'}
        </label>
        <div className="flex items-center gap-3 px-5 py-4 rounded-xl border border-brand-gold bg-brand-gold/10">
          <span className="text-xl">🌙</span>
          <div className="flex-1">
            <span className={`text-sm font-black text-brand-gold ${font}`}>
              {isAr ? 'داكن' : 'Dark'}
            </span>
            <p className={`text-xs text-brand-muted mt-0.5 ${font}`}>
              {isAr ? 'الوضع الداكن فقط — الوضع الفاتح قريباً' : 'Dark mode only — light mode coming soon'}
            </p>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border border-brand-gold/40 text-brand-gold bg-brand-gold/5 ${font}`}>
            {isAr ? 'نشط' : 'Active'}
          </span>
        </div>
      </div>

      {/* Timezone */}
      <div className="flex flex-col gap-3">
        <label className={`text-xs font-black uppercase tracking-widest text-brand-muted ${font}`}>
          {isAr ? 'المنطقة الزمنية' : 'Timezone'}
        </label>
        <select
          value={prefs.timezone}
          onChange={e => setPrefs(p => ({ ...p, timezone: e.target.value }))}
          dir="ltr"
          className={`w-full px-4 py-2.5 rounded-xl bg-brand-surface-2 border border-brand-border
            text-brand-text text-sm outline-none font-satoshi
            focus:border-brand-gold/50 transition-colors`}
        >
          {TIMEZONES.map(tz => (
            <option key={tz.value} value={tz.value}>
              {isAr ? tz.labelAr : tz.labelEn}
            </option>
          ))}
        </select>
      </div>

      {/* Date format */}
      <div className="flex flex-col gap-3">
        <label className={`text-xs font-black uppercase tracking-widest text-brand-muted ${font}`}>
          {isAr ? 'صيغة التاريخ' : 'Date Format'}
        </label>
        <div className="flex flex-col gap-2">
          {([
            { value: 'DD/MM/YYYY', example: '29/04/2026' },
            { value: 'MM/DD/YYYY', example: '04/29/2026' },
            { value: 'YYYY-MM-DD', example: '2026-04-29' },
          ] as const).map(opt => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-4 h-4 rounded-full border-2 transition-colors flex items-center justify-center shrink-0
                ${prefs.date_format === opt.value ? 'border-brand-gold' : 'border-brand-border group-hover:border-brand-gold/40'}`}>
                {prefs.date_format === opt.value && (
                  <div className="w-2 h-2 rounded-full bg-brand-gold" />
                )}
              </div>
              <input
                type="radio"
                name="date_format"
                value={opt.value}
                checked={prefs.date_format === opt.value}
                onChange={() => setPrefs(p => ({ ...p, date_format: opt.value }))}
                className="sr-only"
              />
              <span className={`text-sm font-bold text-brand-text font-satoshi`}>{opt.value}</span>
              <span className={`text-xs text-brand-muted font-satoshi`}>({opt.example})</span>
            </label>
          ))}
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
