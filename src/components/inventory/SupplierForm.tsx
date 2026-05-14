'use client'

import { useTransition, useState } from 'react'
import { useTranslations } from 'next-intl'

interface SupplierRow {
  id: string
  name_ar: string
  name_en: string | null
  phone: string | null
  email: string | null
  lead_time_days: number | null
  reliability_pct: number | null
  payment_terms: string | null
  is_active: boolean
  notes?: string | null
  created_at: string
}

interface Props {
  supplier?: SupplierRow
  action: (formData: FormData) => Promise<{ error?: string }>
  onClose: () => void
  locale: string
}

export default function SupplierForm({ supplier, action, onClose, locale }: Props) {
  const t = useTranslations('inventory.suppliers')
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    if (supplier) fd.set('id', supplier.id)
    startTransition(async () => {
      const result = await action(fd)
      if (result.error) {
        setError(result.error)
      } else {
        onClose()
      }
    })
  }

  const paymentTerms = ['cash', 'net7', 'net14', 'net30', 'net60']
  const inputClass = `w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 ${font} text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors`
  const labelClass = `${font} text-sm font-medium text-brand-text`

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        dir={isAr ? 'rtl' : 'ltr'}
        className="bg-brand-surface border border-brand-border rounded-xl w-full max-w-lg flex flex-col gap-5 p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-brand-border pb-4">
          <h2 className="font-cairo text-xl font-black text-brand-text">
            {supplier ? t('editTitle') : t('addTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-brand-surface-2 text-brand-muted hover:text-brand-text transition-colors"
          >
            x
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="rounded-lg border border-brand-error/30 bg-brand-error/10 px-4 py-3">
              <p className={`${font} text-sm text-brand-error`}>{error}</p>
            </div>
          )}

          {/* Names */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>{t('nameAr')} *</label>
              <input
                name="name_ar"
                type="text"
                required
                defaultValue={supplier?.name_ar ?? ''}
                className={inputClass}
                dir="rtl"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>{t('nameEn')}</label>
              <input
                name="name_en"
                type="text"
                defaultValue={supplier?.name_en ?? ''}
                className={inputClass}
                dir="ltr"
              />
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>{t('phone')}</label>
              <input
                name="phone"
                type="tel"
                defaultValue={supplier?.phone ?? ''}
                className={inputClass}
                dir="ltr"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>{t('email')}</label>
              <input
                name="email"
                type="email"
                defaultValue={supplier?.email ?? ''}
                className={inputClass}
                dir="ltr"
              />
            </div>
          </div>

          {/* Logistics & Payment */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>{t('leadTime')}</label>
              <input
                name="lead_time_days"
                type="number"
                min={1}
                defaultValue={supplier?.lead_time_days ?? 1}
                className={inputClass}
                dir="ltr"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>{t('paymentTerms')}</label>
              <select
                name="payment_terms"
                defaultValue={supplier?.payment_terms ?? ''}
                className={inputClass}
              >
                <option value="">{t('select')}</option>
                {paymentTerms.map((v) => (
                  <option key={v} value={v}>
                    {t(`paymentTermsList.${v}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>{t('active')}</label>
            <select
              name="is_active"
              defaultValue={supplier?.is_active === false ? 'false' : 'true'}
              className={inputClass}
            >
              <option value="true">{t('active')}</option>
              <option value="false">{t('inactive')}</option>
            </select>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>{t('notes')}</label>
            <textarea
              name="notes"
              defaultValue={supplier?.notes ?? ''}
              rows={2}
              className={inputClass + ' resize-none'}
            />
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t border-brand-border">
            <button
              type="button"
              onClick={onClose}
              className={`rounded-lg border border-brand-border px-4 py-2 ${font} text-sm font-medium text-brand-muted hover:border-brand-gold hover:text-brand-gold transition-colors`}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className={`rounded-lg bg-brand-gold px-6 py-2 ${font} text-sm font-semibold text-brand-black hover:bg-brand-gold/90 transition-colors disabled:opacity-50`}
            >
              {isPending ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

