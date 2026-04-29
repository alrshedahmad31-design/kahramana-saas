'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { BRANCH_LIST } from '@/constants/contact'
import CinematicButton from '@/components/ui/CinematicButton'
import LuxuryIcon from '@/components/icons/LuxuryIcon'

const schema = z.object({
  name:      z.string().min(2).max(100),
  email:     z.string().email(),
  phone:     z.string().max(20).optional().or(z.literal('')),
  branch_id: z.string().optional().or(z.literal('')),
  message:   z.string().min(10).max(2000),
})

type FormData = z.infer<typeof schema>
type FieldErrors = Partial<Record<keyof FormData, string>>

export default function ContactForm() {
  const t    = useTranslations('contact')
  const tC   = useTranslations('common')
  const locale = useLocale()
  const isAr = locale === 'ar'

  const [form, setForm]     = useState<FormData>({
    name: '', email: '', phone: '', branch_id: '', message: '',
  })
  const [errors,   setErrors]   = useState<FieldErrors>({})
  const [status,   setStatus]   = useState<'idle' | 'sending' | 'success' | 'error'>('idle')

  function update(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    const result = schema.safeParse(form)
    if (!result.success) {
      const fieldErrors: FieldErrors = {}
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof FormData
        if (!fieldErrors[field]) fieldErrors[field] = tC('required')
      })
      setErrors(fieldErrors)
      return
    }

    setStatus('sending')

    const supabase = createClient()
    const { error } = await supabase.from('contact_messages').insert({
      name:      result.data.name,
      email:     result.data.email,
      phone:     result.data.phone || null,
      branch_id: result.data.branch_id || null,
      message:   result.data.message,
    })

    if (error) {
      setStatus('error')
      return
    }

    setStatus('success')
    setForm({ name: '', email: '', phone: '', branch_id: '', message: '' })
  }

  if (status === 'success') {
    return (
      <div
        dir={isAr ? 'rtl' : 'ltr'}
        className="rounded-xl border border-green-500/30 bg-green-500/5 px-6 py-10 text-center"
      >
        <LuxuryIcon name="check" size={40} className="mx-auto mb-4 text-brand-success" />
        <p className="font-almarai text-lg font-semibold text-brand-text">{t('success')}</p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      dir={isAr ? 'rtl' : 'ltr'}
      className="flex flex-col gap-5"
      noValidate
    >
      {/* Name + Email row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label={t('name')} error={errors.name}>
          <input
            type="text"
            autoComplete="name"
            required
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder={t('namePlaceholder')}
            disabled={status === 'sending'}
            className={inputCls(!!errors.name)}
          />
        </Field>

        <Field label={t('email')} error={errors.email}>
          <input
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            placeholder={t('emailPlaceholder')}
            disabled={status === 'sending'}
            className={inputCls(!!errors.email)}
          />
        </Field>
      </div>

      {/* Phone + Branch row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label={`${t('phone')} (${tC('optional')})`} error={errors.phone}>
          <input
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            placeholder={t('phonePlaceholder')}
            disabled={status === 'sending'}
            className={inputCls(false)}
            dir="ltr"
          />
        </Field>

        <Field label={`${t('branch')} (${tC('optional')})`} error={errors.branch_id}>
          <select
            value={form.branch_id}
            onChange={(e) => update('branch_id', e.target.value)}
            disabled={status === 'sending'}
            className={inputCls(false)}
          >
            <option value="">{t('branchPlaceholder')}</option>
            {BRANCH_LIST.map((b) => (
              <option key={b.id} value={b.id}>
                {isAr ? b.nameAr : b.nameEn}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Message */}
      <Field label={t('message')} error={errors.message}>
        <textarea
          required
          rows={5}
          value={form.message}
          onChange={(e) => update('message', e.target.value)}
          placeholder={t('messagePlaceholder')}
          disabled={status === 'sending'}
          className={`${inputCls(!!errors.message)} resize-none`}
        />
      </Field>

      {/* Server error */}
      {status === 'error' && (
        <p
          role="alert"
          className="rounded-lg bg-brand-error/10 border border-brand-error/30
                     px-4 py-3 font-satoshi text-sm text-brand-error"
        >
          {t('error')}
        </p>
      )}

      <CinematicButton
        type="submit"
        disabled={status === 'sending'}
        isRTL={isAr}
        className="w-full py-4 font-bold rounded-full"
      >
        {status === 'sending' ? t('sending') : t('send')}
      </CinematicButton>
    </form>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-almarai text-sm font-medium text-brand-text">{label}</label>
      {children}
      {error && (
        <p className="font-satoshi text-xs text-brand-error">{error}</p>
      )}
    </div>
  )
}

function inputCls(hasError: boolean) {
  return `min-h-[48px] w-full rounded-lg border bg-brand-surface px-4 py-3
          font-satoshi text-base text-brand-text placeholder:text-brand-muted/50
          focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold
          transition-colors duration-150 disabled:opacity-50
          ${hasError ? 'border-brand-error' : 'border-brand-border'}`
}
