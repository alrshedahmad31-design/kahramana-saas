'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { Check, Loader2, MessageCircle } from 'lucide-react'
import {
  createPublicReservation,
  type CreatePublicReservationInput,
  type CreatePublicReservationResult,
} from '@/app/[locale]/reserve/actions'

interface BranchOption {
  id:     string
  nameAr: string
  nameEn: string
}

interface Props {
  locale:   'ar' | 'en'
  branches: BranchOption[]
}

type FormState = {
  branch_id:        string
  reserved_date:    string
  reserved_time:    string
  party_size:       number
  guest_name:       string
  phone:            string                  // includes +973 prefix
  special_requests: string
  seating_type:     'family_section' | 'arabic_seating' | 'outdoor' | 'indoor' | null
}

type FieldError = 'branch' | 'date' | 'time' | 'partySize' | 'name' | 'phone'

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; reservationId: string; waLink: string; summary: FormState }
  | { kind: 'error'; message: string }

const TIME_SLOTS = ['12:00', '13:00', '14:00', '19:00', '20:00', '21:00', '22:00', '23:00', '00:00'] as const

const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

function todayISODate(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm   = String(d.getMonth() + 1).padStart(2, '0')
  const dd   = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function maxISODate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 60)
  const yyyy = d.getFullYear()
  const mm   = String(d.getMonth() + 1).padStart(2, '0')
  const dd   = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function combineDateTimeToISO(date: string, time: string): string | null {
  if (!date || !time) return null
  const parsed = new Date(`${date}T${time}:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

const initialForm: FormState = {
  branch_id:        '',
  reserved_date:    '',
  reserved_time:    '',
  party_size:       2,
  guest_name:       '',
  phone:            '',
  special_requests: '',
  seating_type:     null,
}

export default function ReserveForm({ locale, branches }: Props) {
  const t  = useTranslations('reserve')
  const isAr = locale === 'ar'

  const [form, setForm] = useState<FormState>(() => ({
    ...initialForm,
    branch_id:     branches[0]?.id ?? '',
    reserved_date: todayISODate(),
  }))
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldError, string>>>({})
  const [submit, setSubmit] = useState<SubmitState>({ kind: 'idle' })
  const [isPending, startTransition] = useTransition()
  const [honeypot, setHoneypot] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const turnstileRef = useRef<TurnstileInstance | null>(null)

  const minDate = useMemo(() => todayISODate(), [])
  const maxDate = useMemo(() => maxISODate(), [])

  const seatingOptions: ('family_section' | 'arabic_seating' | 'outdoor' | 'indoor')[] = useMemo(() => {
    if (form.branch_id === 'qallali') return ['outdoor', 'indoor']
    return ['family_section', 'arabic_seating', 'outdoor', 'indoor']
  }, [form.branch_id])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setSubmit({ kind: 'idle' })
  }

  function validate(): boolean {
    const errs: Partial<Record<FieldError, string>> = {}
    if (!form.branch_id) errs.branch = t('selectBranch')
    if (!form.reserved_date) errs.date = t('selectDate')
    if (!form.reserved_time) errs.time = t('selectTime')
    if (form.party_size < 1 || form.party_size > 20) errs.partySize = t('selectPartySize')
    if (!form.guest_name.trim()) errs.name = t('errorGeneric')
    const phoneTrimmed = form.phone.trim()
    if (phoneTrimmed.length < 7 || phoneTrimmed.length > 30) {
      errs.phone = t('errorInvalidPhone')
    }
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!validate()) return

    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setSubmit({ kind: 'error', message: t('errorGeneric') })
      return
    }

    const iso = combineDateTimeToISO(form.reserved_date, form.reserved_time)
    if (!iso) {
      setFieldErrors((current) => ({ ...current, date: t('selectDate'), time: t('selectTime') }))
      return
    }

    const payload: CreatePublicReservationInput = {
      branch_id:        form.branch_id,
      guest_name:       form.guest_name.trim(),
      phone:            form.phone,
      party_size:       form.party_size,
      reserved_for:     iso,
      duration_minutes: 90,
      special_requests: form.special_requests.trim() || undefined,
      website:          honeypot,
      turnstileToken,
      seating_type:     form.seating_type,
    }

    setSubmit({ kind: 'submitting' })

    startTransition(async () => {
      let result: CreatePublicReservationResult
      try {
        result = await createPublicReservation(payload)
      } catch {
        setSubmit({ kind: 'error', message: t('errorGeneric') })
        return
      }

      if (!result.success) {
        // Reset Turnstile token on any failure — tokens are single-use.
        turnstileRef.current?.reset()
        setTurnstileToken('')

        if (result.error === 'conflict') {
          setSubmit({ kind: 'error', message: t('errorConflict') })
        } else if (result.error === 'rate_limit') {
          setSubmit({ kind: 'error', message: t('errorRateLimit') })
        } else if (result.error === 'invalid_phone') {
          setSubmit({ kind: 'error', message: t('errorInvalidPhone') })
        } else {
          setSubmit({ kind: 'error', message: t('errorGeneric') })
        }
        return
      }

      setSubmit({
        kind:          'success',
        reservationId: result.reservationId,
        waLink:        result.waLink,
        summary:       form,
      })
    })
  }

  // ── Success view ─────────────────────────────────────────────────────────
  if (submit.kind === 'success') {
    const branch = branches.find((b) => b.id === submit.summary.branch_id)
    const branchLabel = branch ? (isAr ? branch.nameAr : branch.nameEn) : submit.summary.branch_id
    const shortId = submit.reservationId.slice(-8).toUpperCase()
    return (
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

        <dl className="mx-auto mt-8 grid max-w-md grid-cols-2 gap-3 text-start">
          <SummaryRow label={t('branch')} value={branchLabel} isAr={isAr} />
          <SummaryRow label={t('date')} value={submit.summary.reserved_date} isAr={isAr} />
          <SummaryRow label={t('time')} value={submit.summary.reserved_time} isAr={isAr} />
          <SummaryRow label={t('partySize')} value={String(submit.summary.party_size)} isAr={isAr} />
        </dl>

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
      </div>
    )
  }

  // ── Main form ────────────────────────────────────────────────────────────
  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      dir={isAr ? 'rtl' : 'ltr'}
      className="mx-auto max-w-2xl rounded-2xl border border-brand-border bg-brand-surface p-6 sm:p-8"
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

      {/* A. Branch */}
      <Section label={t('branch')} error={fieldErrors.branch} isAr={isAr}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {branches.map((b) => {
            const selected = b.id === form.branch_id
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => update('branch_id', b.id)}
                aria-pressed={selected}
                className={`min-h-[64px] rounded-xl border px-4 py-3 text-start transition-colors ${
                  selected
                    ? 'border-brand-gold bg-brand-gold/5 text-brand-text'
                    : 'border-brand-border bg-brand-black/40 text-brand-text hover:border-brand-gold/40'
                }`}
              >
                <span className={`block text-base font-bold ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                  {isAr ? b.nameAr : b.nameEn}
                </span>
              </button>
            )
          })}
        </div>
      </Section>

      {/* B. Date */}
      <Section label={t('date')} error={fieldErrors.date} isAr={isAr}>
        <input
          type="date"
          name="reserved_date"
          required
          min={minDate}
          max={maxDate}
          value={form.reserved_date}
          onChange={(e) => update('reserved_date', e.target.value)}
          className={inputClass(isAr)}
        />
      </Section>

      {/* C. Time */}
      <Section label={t('time')} error={fieldErrors.time} isAr={isAr}>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {TIME_SLOTS.map((slot) => {
            const selected = slot === form.reserved_time
            return (
              <button
                key={slot}
                type="button"
                onClick={() => update('reserved_time', slot)}
                aria-pressed={selected}
                className={`min-h-[48px] rounded-lg border px-2 text-sm font-bold tabular-nums transition-colors ${
                  selected
                    ? 'border-brand-gold bg-brand-gold/10 text-brand-gold'
                    : 'border-brand-border bg-brand-black/40 text-brand-text hover:border-brand-gold/40'
                }`}
              >
                {slot}
              </button>
            )
          })}
        </div>
      </Section>

      {/* D. Party size */}
      <Section label={t('partySize')} error={fieldErrors.partySize} isAr={isAr}>
        <div className="flex flex-wrap gap-2">
          {PARTY_SIZES.map((n) => {
            const selected = n === form.party_size
            return (
              <button
                key={n}
                type="button"
                onClick={() => update('party_size', n)}
                aria-pressed={selected}
                className={`min-h-[44px] min-w-[44px] rounded-full border px-4 text-sm font-bold tabular-nums transition-colors ${
                  selected
                    ? 'border-brand-gold bg-brand-gold text-brand-black'
                    : 'border-brand-border bg-brand-black/40 text-brand-text hover:border-brand-gold/40'
                }`}
              >
                {n === 10 ? `${n}+` : n}
              </button>
            )
          })}
        </div>
      </Section>

      {/* D2. Seating Type */}
      <Section label={t('seatingType.label')} isAr={isAr}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => update('seating_type', null)}
            aria-pressed={form.seating_type === null}
            className={`min-h-[48px] rounded-lg border px-3 text-sm font-bold transition-colors ${
              form.seating_type === null
                ? 'border-brand-gold bg-brand-gold/10 text-brand-gold'
                : 'border-brand-border bg-brand-black/40 text-brand-text hover:border-brand-gold/40'
            }`}
          >
            {t('seatingType.any')}
          </button>
          {seatingOptions.map((opt) => {
            const selected = opt === form.seating_type
            return (
              <button
                key={opt}
                type="button"
                onClick={() => update('seating_type', opt)}
                aria-pressed={selected}
                className={`min-h-[48px] rounded-lg border px-3 text-sm font-bold transition-colors ${
                  selected
                    ? 'border-brand-gold bg-brand-gold/10 text-brand-gold'
                    : 'border-brand-border bg-brand-black/40 text-brand-text hover:border-brand-gold/40'
                }`}
              >
                {t(`seatingType.${opt}`)}
              </button>
            )
          })}
        </div>
      </Section>

      {/* E. Guest name */}
      <Section label={t('guestName')} error={fieldErrors.name} isAr={isAr}>
        <input
          type="text"
          name="guest_name"
          required
          autoComplete="name"
          maxLength={120}
          value={form.guest_name}
          onChange={(e) => update('guest_name', e.target.value)}
          className={inputClass(isAr)}
        />
      </Section>

      {/* F. Phone */}
      <Section label={t('phone')} error={fieldErrors.phone} isAr={isAr}>
        <input
          type="tel"
          name="phone"
          required
          inputMode="tel"
          dir="ltr"
          autoComplete="tel"
          maxLength={30}
          value={form.phone}
          onChange={(e) => update('phone', e.target.value)}
          className={`${inputClass(isAr)} tabular-nums`}
          placeholder="+973 3300 0000"
        />
      </Section>

      {/* G. Special requests */}
      <Section label={t('specialRequests')} isAr={isAr}>
        <textarea
          name="special_requests"
          rows={4}
          maxLength={500}
          value={form.special_requests}
          onChange={(e) => update('special_requests', e.target.value)}
          placeholder={t('specialRequestsPlaceholder')}
          className={`${inputClass(isAr)} min-h-[120px] resize-y`}
        />
      </Section>

      {/* H. Turnstile */}
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

      {/* Form-level error */}
      {submit.kind === 'error' && (
        <div
          role="alert"
          className={`mt-6 rounded-lg border border-brand-error/40 bg-brand-error/10 px-4 py-3 text-sm text-brand-error ${
            isAr ? 'font-almarai' : 'font-satoshi'
          }`}
        >
          {submit.message}
        </div>
      )}

      {/* I. Submit */}
      <button
        type="submit"
        disabled={isPending || submit.kind === 'submitting'}
        className={`mt-8 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-brand-gold px-6 text-base font-bold text-brand-black transition-colors hover:bg-brand-gold-light disabled:cursor-not-allowed disabled:opacity-60 ${
          isAr ? 'font-cairo' : 'font-satoshi'
        }`}
      >
        {(isPending || submit.kind === 'submitting') && (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        )}
        {(isPending || submit.kind === 'submitting') ? t('submitting') : t('submit')}
      </button>
    </form>
  )
}

function Section({
  label, error, isAr, children,
}: {
  label:    string
  error?:   string
  isAr:     boolean
  children: React.ReactNode
}) {
  return (
    <div className="mb-6 last:mb-0">
      <span
        className={`mb-3 block text-xs font-bold uppercase tracking-[0.3em] text-brand-gold ${
          isAr ? 'font-cairo' : 'font-satoshi'
        }`}
      >
        {label}
      </span>
      {children}
      {error && (
        <p
          className={`mt-2 text-xs text-brand-error ${
            isAr ? 'font-almarai' : 'font-satoshi'
          }`}
        >
          {error}
        </p>
      )}
    </div>
  )
}

function SummaryRow({ label, value, isAr }: { label: string; value: string; isAr: boolean }) {
  return (
    <>
      <dt
        className={`text-xs uppercase tracking-[0.2em] text-brand-muted ${
          isAr ? 'font-cairo' : 'font-satoshi'
        }`}
      >
        {label}
      </dt>
      <dd
        className={`text-sm font-bold text-brand-text text-end tabular-nums ${
          isAr ? 'font-almarai' : 'font-satoshi'
        }`}
      >
        {value}
      </dd>
    </>
  )
}

function inputClass(isAr: boolean): string {
  return [
    'w-full rounded-lg border border-brand-border bg-brand-black/45 px-4 py-3',
    'text-base text-brand-text placeholder:text-brand-muted/70 outline-none transition-colors',
    'focus:border-brand-gold',
    'min-h-[48px]',
    isAr ? 'font-almarai text-start' : 'font-satoshi text-start',
  ].join(' ')
}
