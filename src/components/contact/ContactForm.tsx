'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { z } from 'zod'
import { BRANCH_LIST } from '@/constants/contact'
import CinematicButton from '@/components/ui/CinematicButton'
import LuxuryIcon from '@/components/icons/LuxuryIcon'
import { submitContactMessage } from '@/app/[locale]/contact/actions'

const schema = z.object({
  name:      z.string().min(2).max(100),
  email:     z.string().email(),
  phone:     z.string().max(20).optional().or(z.literal('')),
  branch_id: z.string().optional().or(z.literal('')),
  message:   z.string().min(10).max(2000),
})

type FormData   = z.infer<typeof schema>
type FieldErrors = Partial<Record<keyof FormData, string>>

export default function ContactForm() {
  const t    = useTranslations('contact')
  const tC   = useTranslations('common')
  const locale = useLocale()
  const isAr = locale === 'ar'

  const [form, setForm]     = useState<FormData>({
    name: '', email: '', phone: '', branch_id: '', message: '',
  })
  const [honeypot, setHoneypot] = useState('')
  const [errors,   setErrors]   = useState<FieldErrors>({})
  const [status,   setStatus]   = useState<'idle' | 'sending' | 'success' | 'error' | 'rate_limit'>('idle')

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

    const response = await submitContactMessage({
      name:      result.data.name,
      email:     result.data.email,
      phone:     result.data.phone ?? '',
      branch_id: result.data.branch_id ?? '',
      message:   result.data.message,
      website:   honeypot,
    })

    if (!response.success) {
      setStatus(response.error === 'rate_limit' ? 'rate_limit' : 'error')
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
      className="contact-form flex flex-col gap-8"
      noValidate
    >
      {/* Honeypot */}
      <div style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, overflow: 'hidden' }} aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      {/* Name + Email row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
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
          <div className="relative group">
            <select
              value={form.branch_id}
              onChange={(e) => update('branch_id', e.target.value)}
              disabled={status === 'sending'}
              className={`${inputCls(false)} appearance-none`}
            >
              <option value="">{t('branchPlaceholder')}</option>
              {BRANCH_LIST.map((b) => (
                <option key={b.id} value={b.id}>
                  {isAr ? b.nameAr : b.nameEn}
                </option>
              ))}
            </select>
            <div className="absolute top-1/2 end-4 -translate-y-1/2 pointer-events-none transition-colors">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-brand-muted group-hover:text-brand-gold">
                <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </Field>
      </div>

      {/* Message */}
      <Field label={t('message')} error={errors.message}>
        <textarea
          required
          rows={6}
          value={form.message}
          onChange={(e) => update('message', e.target.value)}
          placeholder={t('messagePlaceholder')}
          disabled={status === 'sending'}
          className={`${inputCls(!!errors.message)} resize-none py-4`}
        />
      </Field>

      {/* Server errors */}
      {(status === 'error' || status === 'rate_limit') && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <p
            role="alert"
            className="rounded-xl bg-brand-error/10 border border-brand-error/30
                       px-6 py-4 font-almarai text-sm text-brand-error flex items-center gap-3"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-brand-error animate-pulse" />
            {status === 'rate_limit' ? t('rateLimit') : t('error')}
          </p>
        </div>
      )}

      <div className="mt-4">
        <CinematicButton
          type="submit"
          disabled={status === 'sending'}
          isRTL={isAr}
          className="w-full sm:w-auto px-12 py-5 font-black rounded-full text-lg shadow-xl shadow-brand-gold/10"
        >
          {status === 'sending' ? t('sending') : t('send')}
        </CinematicButton>
      </div>
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
    <div className="flex flex-col gap-2.5">
      <label className="font-almarai text-sm font-bold tracking-wide text-brand-gold/80 uppercase px-1">{label}</label>
      {children}
      {error && (
        <p className="font-almarai text-xs font-bold text-brand-error px-1 flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-brand-error" />
          {error}
        </p>
      )}
    </div>
  )
}

function inputCls(hasError: boolean) {
  return `min-h-[56px] w-full rounded-2xl border bg-brand-surface/40 backdrop-blur-md px-5 py-3
          font-almarai text-base text-brand-text placeholder:text-brand-muted/30
          focus:outline-none focus:ring-4 focus:ring-brand-gold/10 focus:border-brand-gold/60
          transition-all duration-300 disabled:opacity-50
          ${hasError ? 'border-brand-error' : 'border-brand-border hover:border-brand-gold/30'}`
}
