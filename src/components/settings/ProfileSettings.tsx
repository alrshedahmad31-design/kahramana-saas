'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useLocale } from 'next-intl'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

interface Profile {
  id:                      string
  restaurant_name_ar:      string
  restaurant_name_en:      string
  logo_url:                string | null
  email:                   string | null
  phone:                   string | null
  commercial_registration: string | null
  tax_number:              string | null
  description_ar:          string | null
  description_en:          string | null
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function ProfileSettings() {
  const isAr     = useLocale() === 'ar'
  const supabase = useMemo(() => createClient(), [])
  const font     = isAr ? 'font-almarai' : 'font-satoshi'
  const fileRef  = useRef<HTMLInputElement>(null)

  const [profile,   setProfile]   = useState<Profile | null>(null)
  const [form,      setForm]      = useState<Omit<Profile, 'id'> | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  useEffect(() => {
    async function load() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await supabase
        .from('restaurant_profile')
        .select('*')
        .limit(1)
        .single()
      if (data) {
        setProfile(data)
        setForm({
          restaurant_name_ar:      data.restaurant_name_ar ?? '',
          restaurant_name_en:      data.restaurant_name_en ?? '',
          logo_url:                data.logo_url ?? null,
          email:                   data.email ?? '',
          phone:                   data.phone ?? '',
          commercial_registration: data.commercial_registration ?? '',
          tax_number:              data.tax_number ?? '',
          description_ar:          data.description_ar ?? '',
          description_en:          data.description_en ?? '',
        })
        if (data.logo_url) setLogoPreview(data.logo_url)
      }
      setLoading(false)
    }
    load()
  }, [supabase])

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    setUploadingLogo(true)
    const ext  = file.name.split('.').pop()
    const path = `logos/${profile.id}.${ext}`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.storage
      .from('restaurant-assets')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (!error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: urlData } = supabase.storage
        .from('restaurant-assets')
        .getPublicUrl(path)
      const url = urlData.publicUrl as string
      setLogoPreview(url)
      setForm(prev => prev ? { ...prev, logo_url: url } : prev)
    }
    setUploadingLogo(false)
  }

  const handleSave = async () => {
    if (!form || !profile) return
    setSaveState('saving')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase
      .from('restaurant_profile')
      .update(form)
      .eq('id', profile.id)
    setSaveState(error ? 'error' : 'saved')
    if (!error) setTimeout(() => setSaveState('idle'), 2500)
  }

  const handleReset = () => {
    if (!profile) return
    setForm({
      restaurant_name_ar:      profile.restaurant_name_ar,
      restaurant_name_en:      profile.restaurant_name_en,
      logo_url:                profile.logo_url,
      email:                   profile.email ?? '',
      phone:                   profile.phone ?? '',
      commercial_registration: profile.commercial_registration ?? '',
      tax_number:              profile.tax_number ?? '',
      description_ar:          profile.description_ar ?? '',
      description_en:          profile.description_en ?? '',
    })
    setLogoPreview(profile.logo_url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="w-8 h-8 rounded-full border-2 border-brand-gold/30 border-t-brand-gold animate-spin" />
      </div>
    )
  }

  if (!form) {
    return (
      <p className={`text-brand-muted text-sm ${font}`}>
        {isAr ? 'تعذر تحميل البيانات' : 'Failed to load profile data'}
      </p>
    )
  }

  return (
    <div className="max-w-2xl flex flex-col gap-8">

      {/* ── Section heading ── */}
      <div>
        <h1 className={`text-2xl font-black text-brand-text ${isAr ? 'font-cairo' : 'font-editorial'}`}>
          {isAr ? 'الملف الشخصي' : 'Restaurant Profile'}
        </h1>
        <p className={`text-sm text-brand-muted mt-1 ${font}`}>
          {isAr
            ? 'المعلومات الأساسية للمطعم تظهر للعملاء'
            : 'Core restaurant information visible to customers'}
        </p>
      </div>

      {/* ── Logo ── */}
      <div className="flex flex-col gap-3">
        <label className={`text-xs font-black uppercase tracking-widest text-brand-muted ${font}`}>
          {isAr ? 'شعار المطعم' : 'Restaurant Logo'}
        </label>
        <div className="flex items-center gap-5">
          <div className="relative w-20 h-20 rounded-2xl bg-brand-surface-2 border border-brand-border overflow-hidden flex items-center justify-center shrink-0">
            {logoPreview
              ? <Image src={logoPreview} alt="logo" fill sizes="80px" className="object-cover" />
              : <span className={`text-brand-muted text-2xl ${font}`}>🏪</span>
            }
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={uploadingLogo}
              onClick={() => fileRef.current?.click()}
              className={`px-4 py-2 rounded-xl bg-brand-surface-2 border border-brand-border
                text-brand-text text-sm font-bold hover:border-brand-gold/40 hover:text-brand-gold
                transition-colors disabled:opacity-50 ${font}`}
            >
              {uploadingLogo
                ? (isAr ? 'جاري الرفع…' : 'Uploading…')
                : (isAr ? 'تغيير الشعار' : 'Change Logo')}
            </button>
            <p className={`text-[11px] text-brand-muted/60 ${font}`}>
              {isAr ? 'PNG أو JPG · حد أقصى 2MB' : 'PNG or JPG · max 2 MB'}
            </p>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleLogoChange}
        />
      </div>

      {/* ── Restaurant name ── */}
      <div className="flex flex-col gap-4">
        <label className={`text-xs font-black uppercase tracking-widest text-brand-muted ${font}`}>
          {isAr ? 'اسم المطعم' : 'Restaurant Name'}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label={isAr ? 'بالعربية' : 'Arabic Name'}
            value={form.restaurant_name_ar}
            onChange={v => setForm(p => p ? { ...p, restaurant_name_ar: v } : p)}
            dir="rtl"
            font={font}
          />
          <Field
            label={isAr ? 'بالإنجليزية' : 'English Name'}
            value={form.restaurant_name_en}
            onChange={v => setForm(p => p ? { ...p, restaurant_name_en: v } : p)}
            dir="ltr"
            font="font-satoshi"
          />
        </div>
      </div>

      {/* ── Contact ── */}
      <div className="flex flex-col gap-4">
        <label className={`text-xs font-black uppercase tracking-widest text-brand-muted ${font}`}>
          {isAr ? 'معلومات التواصل' : 'Contact Information'}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label={isAr ? 'البريد الإلكتروني' : 'Email Address'}
            value={form.email ?? ''}
            onChange={v => setForm(p => p ? { ...p, email: v } : p)}
            type="email"
            dir="ltr"
            font={font}
          />
          <Field
            label={isAr ? 'رقم الهاتف' : 'Phone Number'}
            value={form.phone ?? ''}
            onChange={v => setForm(p => p ? { ...p, phone: v } : p)}
            type="tel"
            dir="ltr"
            font="font-satoshi"
          />
        </div>
      </div>

      {/* ── Legal ── */}
      <div className="flex flex-col gap-4">
        <label className={`text-xs font-black uppercase tracking-widest text-brand-muted ${font}`}>
          {isAr ? 'البيانات القانونية' : 'Legal Details'}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label={isAr ? 'السجل التجاري' : 'Commercial Registration'}
            value={form.commercial_registration ?? ''}
            onChange={v => setForm(p => p ? { ...p, commercial_registration: v } : p)}
            dir="ltr"
            font={font}
          />
          <Field
            label={isAr ? 'الرقم الضريبي' : 'Tax Number'}
            value={form.tax_number ?? ''}
            onChange={v => setForm(p => p ? { ...p, tax_number: v } : p)}
            dir="ltr"
            font={font}
          />
        </div>
      </div>

      {/* ── Description ── */}
      <div className="flex flex-col gap-4">
        <label className={`text-xs font-black uppercase tracking-widest text-brand-muted ${font}`}>
          {isAr ? 'وصف المطعم' : 'Restaurant Description'}
        </label>
        <TextareaField
          label={isAr ? 'بالعربية' : 'Arabic Description'}
          value={form.description_ar ?? ''}
          onChange={v => setForm(p => p ? { ...p, description_ar: v } : p)}
          dir="rtl"
          font={font}
          rows={3}
        />
        <TextareaField
          label={isAr ? 'بالإنجليزية' : 'English Description'}
          value={form.description_en ?? ''}
          onChange={v => setForm(p => p ? { ...p, description_en: v } : p)}
          dir="ltr"
          font="font-satoshi"
          rows={3}
        />
      </div>

      {/* ── Divider ── */}
      <div className="h-px bg-brand-border" />

      {/* ── Save bar ── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saveState === 'saving'}
          className={`px-6 py-2.5 rounded-xl bg-brand-gold text-brand-black font-black text-sm
            hover:bg-brand-gold-light transition-colors disabled:opacity-50 ${font}`}
        >
          {saveState === 'saving'
            ? (isAr ? 'جاري الحفظ…' : 'Saving…')
            : (isAr ? 'حفظ التغييرات' : 'Save Changes')}
        </button>

        <button
          type="button"
          onClick={handleReset}
          className={`px-5 py-2.5 rounded-xl bg-brand-surface-2 border border-brand-border
            text-brand-muted hover:text-brand-text font-bold text-sm transition-colors ${font}`}
        >
          {isAr ? 'إلغاء' : 'Cancel'}
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

// ── Sub-components ─────────────────────────────────────────────────────────────

function Field({
  label, value, onChange, type = 'text', dir, font,
}: {
  label:    string
  value:    string
  onChange: (v: string) => void
  type?:    string
  dir:      'ltr' | 'rtl'
  font:     string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={`text-[11px] text-brand-muted font-bold ${font}`}>{label}</label>
      <input
        type={type}
        value={value}
        dir={dir}
        onChange={e => onChange(e.target.value)}
        className={`w-full px-4 py-2.5 rounded-xl bg-brand-surface-2 border border-brand-border
          text-brand-text text-sm placeholder:text-brand-muted/40 outline-none
          focus:border-brand-gold/50 focus:ring-1 focus:ring-brand-gold/20 transition-colors ${font}`}
      />
    </div>
  )
}

function TextareaField({
  label, value, onChange, dir, font, rows,
}: {
  label:    string
  value:    string
  onChange: (v: string) => void
  dir:      'ltr' | 'rtl'
  font:     string
  rows:     number
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={`text-[11px] text-brand-muted font-bold ${font}`}>{label}</label>
      <textarea
        value={value}
        rows={rows}
        dir={dir}
        onChange={e => onChange(e.target.value)}
        className={`w-full px-4 py-2.5 rounded-xl bg-brand-surface-2 border border-brand-border
          text-brand-text text-sm placeholder:text-brand-muted/40 outline-none resize-none
          focus:border-brand-gold/50 focus:ring-1 focus:ring-brand-gold/20 transition-colors ${font}`}
      />
    </div>
  )
}
