'use client'

import { FormEvent, useMemo, useRef, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { Check, Loader2, MessageCircle } from 'lucide-react'
import SectionHeader from '@/components/ui/SectionHeader'
import { BRANCH_LIST, type BranchId } from '@/constants/contact'
import {
  type CateringInquiryValues,
  type CateringServiceType,
} from '@/lib/whatsapp-catering-message'
import { gtag } from '@/lib/gtag'
import { toast } from '@/lib/toast'
import {
  createCateringInquiry,
  type CreateCateringInquiryResult,
} from '@/app/[locale]/catering/actions'

const initialValues: CateringInquiryValues = {
  name: '',
  phone: '',
  occasionType: '',
  eventDate: '',
  eventTime: '',
  guestCount: '',
  area: '',
  preferredBranch: '',
  serviceType: '',
  notes: '',
  budget: '',
}

const occasionOptions = ['familyFeast', 'majlis', 'corporateMeeting', 'privateOccasion', 'other'] as const
const serviceOptions: CateringServiceType[] = ['pickup', 'delivery', 'coordination']

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; inquiryId: string; waLink: string; summary: CateringInquiryValues }

export default function InquiryForm() {
  const t = useTranslations('catering.form')
  const tWhatsapp = useTranslations('catering.whatsapp')
  const locale = useLocale()
  const isAr = locale === 'ar'
  const [values, setValues] = useState<CateringInquiryValues>(initialValues)
  const [submit, setSubmit] = useState<SubmitState>({ kind: 'idle' })
  const [, startTransition] = useTransition()
  const [isPending, setPending] = useState(false)
  const [honeypot, setHoneypot] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const turnstileRef = useRef<TurnstileInstance | null>(null)

  const activeBranches = useMemo(() => BRANCH_LIST.filter((branch) => branch.status === 'active'), [])

  function updateField(field: keyof CateringInquiryValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  function resetForm() {
    setValues(initialValues)
    setSubmit({ kind: 'idle' })
    setTurnstileToken('')
    turnstileRef.current?.reset()
  }

  function openWhatsApp(waLink: string) {
    const popup = window.open(waLink, '_blank', 'noopener,noreferrer')
    if (!popup) {
      // Popup-blocked (common on iOS Safari). Surface the link via toast
      // so the customer can tap it manually.
      toast.error(t('popupBlocked'))
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submit.kind === 'submitting' || isPending) return

    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      toast.error(t('turnstileRequired'))
      return
    }

    setSubmit({ kind: 'submitting' })
    setPending(true)

    const payload = {
      name:             values.name,
      phone:            values.phone,
      occasion_type:    values.occasionType,
      event_date:       values.eventDate,
      event_time:       values.eventTime || '',
      // Coerced to a number on the wire so the action's input type
      // matches (z.coerce.number() reports input type `number` to TS).
      // Invalid digits → NaN, which the server's .int().positive()
      // check rejects with 'invalid_input'.
      guest_count:      Number(values.guestCount),
      area:             values.area,
      service_type:     values.serviceType,
      preferred_branch: values.preferredBranch || undefined,
      budget:           values.budget || '',
      notes:            values.notes,
      website:          honeypot,
      turnstileToken,
      whatsappCopy: {
        title:      tWhatsapp('title'),
        emptyValue: tWhatsapp('emptyValue'),
        labels: {
          name:            tWhatsapp('labels.name'),
          phone:           tWhatsapp('labels.phone'),
          occasionType:    tWhatsapp('labels.occasionType'),
          eventDate:       tWhatsapp('labels.eventDate'),
          eventTime:       tWhatsapp('labels.eventTime'),
          guestCount:      tWhatsapp('labels.guestCount'),
          area:            tWhatsapp('labels.area'),
          preferredBranch: tWhatsapp('labels.preferredBranch'),
          serviceType:     tWhatsapp('labels.serviceType'),
          notes:           tWhatsapp('labels.notes'),
          budget:          tWhatsapp('labels.budget'),
        },
      },
    }

    startTransition(async () => {
      let result: CreateCateringInquiryResult
      try {
        result = await createCateringInquiry(payload)
      } catch {
        setPending(false)
        setSubmit({ kind: 'idle' })
        toast.error(t('errors.generic'))
        return
      }

      if (!result.success) {
        // Tokens are single-use; reset on any failure so the customer
        // can resubmit without a hard refresh.
        turnstileRef.current?.reset()
        setTurnstileToken('')
        setPending(false)
        setSubmit({ kind: 'idle' })

        if (result.error === 'rate_limit') toast.error(t('errors.rateLimit'))
        else if (result.error === 'captcha') toast.error(t('errors.captcha'))
        else if (result.error === 'invalid_input') toast.error(t('errors.invalidInput'))
        else toast.error(t('errors.generic'))
        return
      }

      // Persisted. Keep the wa.me handoff as the conversion path —
      // analytics fire the same way they did before this server-side
      // flow existed.
      gtag.generateLead('catering_inquiry')
      gtag.whatsappClick('catering')

      setPending(false)
      setSubmit({
        kind:      'success',
        inquiryId: result.inquiryId,
        waLink:    result.waLink,
        summary:   values,
      })

      openWhatsApp(result.waLink)
    })
  }

  // ── Success view ─────────────────────────────────────────────────────────
  if (submit.kind === 'success') {
    const shortId = submit.inquiryId.slice(-8).toUpperCase()
    return (
      <section id="catering-inquiry" className="max-w-7xl mx-auto px-4 sm:px-6 py-20 scroll-mt-28">
        <div
          className="mx-auto max-w-2xl rounded-2xl border border-brand-gold/40 bg-brand-surface p-8 sm:p-10 text-center"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full border border-brand-gold/40 bg-brand-gold/10">
            <Check className="h-8 w-8 text-brand-gold" aria-hidden="true" />
          </div>
          <h2 className={`text-3xl font-black text-brand-gold ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
            {t('successTitle')}
          </h2>
          <p className={`mt-3 text-base text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {t('successSubtitle')}
          </p>

          <p className="mt-6 text-xs text-brand-muted tabular-nums">#{shortId}</p>

          <a
            href={submit.waLink}
            target="_blank"
            rel="noopener noreferrer"
            className={`mt-8 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-brand-gold px-6 text-base font-bold text-brand-black transition-colors hover:bg-brand-gold-light ${
              isAr ? 'font-cairo' : 'font-satoshi'
            }`}
          >
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
            {t('whatsappConfirm')}
          </a>

          <button
            type="button"
            onClick={resetForm}
            className={`mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-brand-border bg-transparent px-6 text-sm font-bold text-brand-muted transition-colors hover:border-brand-gold/40 hover:text-brand-gold ${
              isAr ? 'font-almarai' : 'font-satoshi'
            }`}
          >
            {t('submitAnother')}
          </button>
        </div>
      </section>
    )
  }

  // ── Main form ────────────────────────────────────────────────────────────
  return (
    <section id="catering-inquiry" className="max-w-7xl mx-auto px-4 sm:px-6 py-20 scroll-mt-28">
      <SectionHeader
        title={t('title')}
        subtitle={t('eyebrow')}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[0.74fr_1.26fr] gap-10 lg:gap-16">
        <div>
          <p className={`text-center text-sm leading-7 text-brand-muted lg:text-start ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {t('description')}
          </p>
          <div className={`mt-8 rounded-2xl border border-brand-gold/20 bg-brand-gold/10 p-5 text-sm leading-7 text-brand-gold-light ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {t('notice')}
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-brand-border bg-brand-surface p-5 sm:p-7"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          {/* Honeypot — bots fill, humans leave empty */}
          <div className="hidden" aria-hidden="true">
            <label>
              Website
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={t('fields.name.label')} isAr={isAr}>
              <input
                required
                value={values.name}
                onChange={(event) => updateField('name', event.target.value)}
                aria-label={t('fields.name.label')}
                placeholder={t('fields.name.placeholder')}
                className={inputClass(isAr)}
              />
            </Field>

            <Field label={t('fields.phone.label')} isAr={isAr}>
              <input
                required
                type="tel"
                value={values.phone}
                onChange={(event) => updateField('phone', event.target.value)}
                aria-label={t('fields.phone.label')}
                placeholder={t('fields.phone.placeholder')}
                className={inputClass(isAr)}
              />
            </Field>

            <Field label={t('fields.occasionType.label')} isAr={isAr}>
              <select
                required
                value={values.occasionType}
                onChange={(event) => updateField('occasionType', event.target.value)}
                aria-label={t('fields.occasionType.label')}
                className={inputClass(isAr)}
              >
                <option value="">{t('fields.occasionType.placeholder')}</option>
                {occasionOptions.map((option) => (
                  <option key={option} value={t(`occasionOptions.${option}`)}>
                    {t(`occasionOptions.${option}`)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t('fields.eventDate.label')} isAr={isAr}>
              <input
                required
                type="date"
                value={values.eventDate}
                onChange={(event) => updateField('eventDate', event.target.value)}
                aria-label={t('fields.eventDate.label')}
                className={inputClass(isAr)}
              />
            </Field>

            <Field label={t('fields.eventTime.label')} isAr={isAr}>
              <input
                required
                type="time"
                value={values.eventTime}
                onChange={(event) => updateField('eventTime', event.target.value)}
                aria-label={t('fields.eventTime.label')}
                className={inputClass(isAr)}
              />
            </Field>

            <Field label={t('fields.guestCount.label')} isAr={isAr}>
              <input
                required
                inputMode="numeric"
                value={values.guestCount}
                onChange={(event) => updateField('guestCount', event.target.value)}
                aria-label={t('fields.guestCount.label')}
                placeholder={t('fields.guestCount.placeholder')}
                className={inputClass(isAr)}
              />
            </Field>

            <Field label={t('fields.area.label')} isAr={isAr}>
              <input
                required
                value={values.area}
                onChange={(event) => updateField('area', event.target.value)}
                aria-label={t('fields.area.label')}
                placeholder={t('fields.area.placeholder')}
                className={inputClass(isAr)}
              />
            </Field>

            <Field label={t('fields.preferredBranch.label')} isAr={isAr}>
              <select
                value={values.preferredBranch}
                onChange={(event) => updateField('preferredBranch', event.target.value as BranchId | '')}
                aria-label={t('fields.preferredBranch.label')}
                className={inputClass(isAr)}
              >
                <option value="">{t('fields.preferredBranch.placeholder')}</option>
                {activeBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {isAr ? branch.nameAr : branch.nameEn}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t('fields.serviceType.label')} isAr={isAr}>
              <select
                required
                value={values.serviceType}
                onChange={(event) => updateField('serviceType', event.target.value)}
                aria-label={t('fields.serviceType.label')}
                className={inputClass(isAr)}
              >
                <option value="">{t('fields.serviceType.placeholder')}</option>
                {serviceOptions.map((option) => (
                  <option key={option} value={t(`serviceOptions.${option}`)}>
                    {t(`serviceOptions.${option}`)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={t('fields.budget.label')} isAr={isAr}>
              <input
                value={values.budget}
                onChange={(event) => updateField('budget', event.target.value)}
                aria-label={t('fields.budget.label')}
                placeholder={t('fields.budget.placeholder')}
                className={inputClass(isAr)}
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label={t('fields.notes.label')} isAr={isAr}>
              <textarea
                required
                rows={5}
                value={values.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                aria-label={t('fields.notes.label')}
                placeholder={t('fields.notes.placeholder')}
                className={`${inputClass(isAr)} min-h-36 resize-y`}
              />
            </Field>
          </div>

          {TURNSTILE_SITE_KEY && (
            <div className="mt-6 flex justify-center">
              <Turnstile
                ref={turnstileRef}
                siteKey={TURNSTILE_SITE_KEY}
                options={{ theme: 'dark' }}
                onSuccess={(token) => setTurnstileToken(token)}
                onExpire={() => setTurnstileToken('')}
                onError={() => setTurnstileToken('')}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submit.kind === 'submitting' || isPending}
            aria-label={t('submit')}
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-gold px-6 py-3 text-sm font-bold text-brand-black transition-transform duration-200 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
          >
            {(submit.kind === 'submitting' || isPending) && (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            )}
            {(submit.kind === 'submitting' || isPending) ? t('submitting') : t('submit')}
          </button>
        </form>
      </div>
    </section>
  )
}

function Field({
  label,
  isAr,
  children,
}: {
  label: string
  isAr: boolean
  children: React.ReactNode
}) {
  return (
    <label className={`block text-start text-sm font-bold text-brand-text ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
      <span className="mb-2 block">{label}</span>
      {children}
    </label>
  )
}

function inputClass(isAr: boolean): string {
  return [
    'w-full rounded-lg border border-brand-border bg-brand-black/45 px-4 py-3',
    'text-brand-text placeholder:text-brand-muted/70 outline-none transition-colors',
    'focus:border-brand-gold',
    isAr ? 'font-almarai text-start' : 'font-satoshi text-start',
  ].join(' ')
}
