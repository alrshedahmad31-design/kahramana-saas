'use client'

import { FormEvent, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { BRANCH_LIST, type BranchId } from '@/constants/contact'
import {
  buildCateringWhatsappLink,
  type CateringInquiryValues,
  type CateringServiceType,
} from '@/lib/whatsapp-catering-message'

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

export default function InquiryForm() {
  const t = useTranslations('catering.form')
  const tWhatsapp = useTranslations('catering.whatsapp')
  const locale = useLocale()
  const isAr = locale === 'ar'
  const [values, setValues] = useState<CateringInquiryValues>(initialValues)

  const activeBranches = useMemo(() => BRANCH_LIST.filter((branch) => branch.status === 'active'), [])

  function updateField(field: keyof CateringInquiryValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const link = buildCateringWhatsappLink(values, {
      title: tWhatsapp('title'),
      emptyValue: tWhatsapp('emptyValue'),
      labels: {
        name: tWhatsapp('labels.name'),
        phone: tWhatsapp('labels.phone'),
        occasionType: tWhatsapp('labels.occasionType'),
        eventDate: tWhatsapp('labels.eventDate'),
        eventTime: tWhatsapp('labels.eventTime'),
        guestCount: tWhatsapp('labels.guestCount'),
        area: tWhatsapp('labels.area'),
        preferredBranch: tWhatsapp('labels.preferredBranch'),
        serviceType: tWhatsapp('labels.serviceType'),
        notes: tWhatsapp('labels.notes'),
        budget: tWhatsapp('labels.budget'),
      },
    })
    window.open(link, '_blank', 'noopener,noreferrer')
  }

  return (
    <section id="catering-inquiry" className="max-w-7xl mx-auto px-4 sm:px-6 py-20 scroll-mt-28">
      <div className="grid grid-cols-1 lg:grid-cols-[0.74fr_1.26fr] gap-10 lg:gap-16">
        <div className="text-start">
          <p className="text-xs font-satoshi font-bold tracking-[0.3em] uppercase text-brand-gold">
            {t('eyebrow')}
          </p>
          <h2 className={`mt-3 text-3xl sm:text-5xl font-black text-brand-text ${isAr ? 'font-cairo' : 'font-editorial'}`}>
            {t('title')}
          </h2>
          <p className={`mt-5 text-sm leading-7 text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
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

          <button
            type="submit"
            aria-label={t('submit')}
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-brand-gold px-6 py-3 text-sm font-bold text-brand-black transition-transform duration-200 hover:scale-[1.01]"
          >
            {t('submit')}
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
