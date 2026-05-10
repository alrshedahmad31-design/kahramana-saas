'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createCateringOrder, updateCateringOrder } from '@/app/[locale]/dashboard/inventory/catering/actions'
import type { CateringOrderRow, CateringPackageRow } from '@/lib/supabase/custom-types'
import { useTranslations } from 'next-intl'

interface Props {
  mode:      'create' | 'edit'
  order?:    CateringOrderRow
  branchId:  string
  packages:  Pick<CateringPackageRow, 'id' | 'name_ar' | 'name_en' | 'min_guests' | 'max_guests' | 'price_per_person_bhd'>[]
  prefix:    string
  locale:    string
  onCancel?: () => void
}

type Step = 1 | 2 | 3

export default function CateringOrderForm({ mode, order, branchId, packages, prefix, locale, onCancel }: Props) {
  const t = useTranslations('inventory.catering')
  const tCommon = useTranslations('common')
  const isAr = locale === 'ar'
  const font = isAr ? 'font-almarai' : 'font-satoshi'
  
  const router = useRouter()
  const [step, setStep]         = useState<Step>(1)
  const [error, setError]       = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Step 1: Client info
  const [clientName,  setClientName]  = useState(order?.client_name ?? '')
  const [clientPhone, setClientPhone] = useState(order?.client_phone ?? '')
  const [clientEmail, setClientEmail] = useState(order?.client_email ?? '')

  // Step 2: Event details
  const [eventDate,     setEventDate]     = useState(order?.event_date ?? '')
  const [eventTime,     setEventTime]     = useState(order?.event_time ?? '')
  const [venueName,     setVenueName]     = useState(order?.venue_name ?? '')
  const [venueAddress,  setVenueAddress]  = useState(order?.venue_address ?? '')

  // Step 3: Package & pricing
  const [packageId,    setPackageId]    = useState(order?.package_id ?? '')
  const [guestCount,   setGuestCount]   = useState(order?.guest_count ?? 10)
  const [pricePerPerson, setPricePerPerson] = useState(Number(order?.price_per_person_bhd ?? 0))
  const [depositBhd,   setDepositBhd]   = useState(Number(order?.deposit_bhd ?? 0))
  const [notes,        setNotes]        = useState(order?.notes ?? '')

  function handlePackageChange(pkgId: string) {
    setPackageId(pkgId)
    const pkg = packages.find((p) => p.id === pkgId)
    if (pkg) setPricePerPerson(Number(pkg.price_per_person_bhd))
  }

  const subtotal = pricePerPerson * guestCount

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const payload = {
        package_id:           packageId || null,
        event_date:           eventDate,
        event_time:           eventTime || null,
        venue_name:           venueName || null,
        venue_address:        venueAddress || null,
        guest_count:          guestCount,
        client_name:          clientName,
        client_phone:         clientPhone,
        client_email:         clientEmail || null,
        price_per_person_bhd: pricePerPerson,
        deposit_bhd:          depositBhd,
        notes:                notes || null,
      }

      let resultError: string | undefined
      if (mode === 'edit' && order) {
        const result = await updateCateringOrder(order.id, payload)
        resultError = result.error
      } else {
        const result = await createCateringOrder({ branch_id: branchId, ...payload })
        resultError = result.error
      }

      if (resultError) {
        setError(resultError)
      } else {
        router.push(`${prefix}/dashboard/inventory/catering`)
      }
    })
  }

  const inputClass = `w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2.5 ${font} text-sm text-brand-text focus:border-brand-gold focus:outline-none transition-colors`
  const labelClass = `${font} text-xs text-brand-muted uppercase tracking-wide`

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-6 flex flex-col gap-5 max-w-lg w-full shadow-sm">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {([1, 2, 3] as Step[]).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-satoshi text-xs font-bold
              ${step === s ? 'bg-brand-gold text-brand-black' : step > s ? 'bg-brand-gold/20 text-brand-gold' : 'bg-brand-surface-2 text-brand-muted'}`}>
              {s}
            </div>
            {s < 3 && <div className={`h-px w-8 ${step > s ? 'bg-brand-gold/40' : 'bg-brand-border'}`} />}
          </div>
        ))}
        <span className={`ms-2 ${font} text-sm text-brand-muted`}>
          {step === 1 ? t('clientInfo') : step === 2 ? t('eventDetails') : t('packagePricing')}
        </span>
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t('clientName')} *</label>
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputClass} placeholder={t('placeholderName')} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t('phone')} *</label>
            <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className={inputClass} placeholder="+9647XXXXXXXXX" dir="ltr" />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t('email')}</label>
            <input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className={inputClass} type="email" dir="ltr" />
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t('eventDate')} *</label>
            <input value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={inputClass} type="date" dir="ltr" />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t('time')}</label>
            <input value={eventTime} onChange={(e) => setEventTime(e.target.value)} className={inputClass} type="time" dir="ltr" />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t('venueName')}</label>
            <input value={venueName} onChange={(e) => setVenueName(e.target.value)} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t('venueAddress')}</label>
            <input value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} className={inputClass} />
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t('package')}</label>
            <select value={packageId} onChange={(e) => handlePackageChange(e.target.value)} className={inputClass}>
              <option value="">{t('noPackage')}</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {isAr ? p.name_ar : p.name_en} — {Number(p.price_per_person_bhd).toFixed(3)} {tCommon('currency')}/{t('perPerson')}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t('guestCount')} *</label>
            <input value={guestCount} onChange={(e) => setGuestCount(Number(e.target.value))} className={inputClass} type="number" min={1} dir="ltr" />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t('pricePerPerson')} ({tCommon('currency')})</label>
            <input value={pricePerPerson} onChange={(e) => setPricePerPerson(Number(e.target.value))} className={inputClass} type="number" min={0} step={0.001} dir="ltr" />
          </div>
          <div className="bg-brand-surface-2 rounded-lg px-3 py-2 flex items-center justify-between">
            <span className={`${font} text-sm text-brand-muted`}>{t('subtotal')}</span>
            <span className="font-cairo font-black text-brand-gold">{subtotal.toFixed(3)} {tCommon('currency')}</span>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t('deposit')} ({tCommon('currency')})</label>
            <input value={depositBhd} onChange={(e) => setDepositBhd(Number(e.target.value))} className={inputClass} type="number" min={0} step={0.001} dir="ltr" />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{t('notes')}</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} rows={3} />
          </div>
        </div>
      )}

      {error && (
        <p className={`${font} text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2`}>{error}</p>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-brand-border mt-2">
        <button
          type="button"
          onClick={onCancel ?? (() => {})}
          className={`${font} text-sm text-brand-muted hover:text-brand-text transition-colors`}
        >
          {t('cancel')}
        </button>
        <div className="flex gap-2">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as Step)}
              className={`rounded-lg border border-brand-border px-4 py-2 ${font} text-sm text-brand-muted hover:text-brand-text transition-colors`}
            >
              {t('back')}
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s + 1) as Step)}
              disabled={
                (step === 1 && (!clientName || !clientPhone)) ||
                (step === 2 && !eventDate)
              }
              className={`rounded-lg bg-brand-gold px-4 py-2 ${font} text-sm font-bold text-brand-black hover:bg-brand-goldLight disabled:opacity-50 transition-colors`}
            >
              {t('next')}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || guestCount < 1}
              className={`rounded-lg bg-brand-gold px-4 py-2 ${font} text-sm font-bold text-brand-black hover:bg-brand-goldLight disabled:opacity-50 transition-colors`}
            >
              {isPending
                ? t('saving')
                : mode === 'edit'
                ? t('saveChanges')
                : t('saveOrder')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

