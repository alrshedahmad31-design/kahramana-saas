'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createCateringOrder, updateCateringOrder } from '@/app/[locale]/dashboard/inventory/catering/actions'
import type { CateringOrderRow, CateringPackageRow } from '@/lib/supabase/custom-types'

interface Props {
  mode:      'create' | 'edit'
  order?:    CateringOrderRow
  branchId:  string
  packages:  Pick<CateringPackageRow, 'id' | 'name_ar' | 'name_en' | 'min_guests' | 'max_guests' | 'price_per_person_bhd'>[]
  prefix:    string
  isAr?:     boolean
  onCancel?: () => void
}

type Step = 1 | 2 | 3

export default function CateringOrderForm({ mode, order, branchId, packages, prefix, isAr = true, onCancel }: Props) {
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

  const inputClass = 'w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2.5 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none'
  const labelClass = 'font-satoshi text-xs text-brand-muted uppercase tracking-wide'

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-6 flex flex-col gap-5 max-w-lg w-full">
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
        <span className="ms-2 font-satoshi text-sm text-brand-muted">
          {step === 1 ? (isAr ? 'بيانات العميل' : 'Client Info')
            : step === 2 ? (isAr ? 'تفاصيل الفعالية' : 'Event Details')
            : (isAr ? 'الباقة والتسعير' : 'Package & Pricing')}
        </span>
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{isAr ? 'اسم العميل *' : 'Client Name *'}</label>
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputClass} placeholder={isAr ? 'أحمد محمد' : 'Ahmed Mohammed'} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{isAr ? 'رقم الهاتف *' : 'Phone *'}</label>
            <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className={inputClass} placeholder="+9647XXXXXXXXX" dir="ltr" />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{isAr ? 'البريد الإلكتروني' : 'Email'}</label>
            <input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className={inputClass} type="email" dir="ltr" />
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{isAr ? 'تاريخ الفعالية *' : 'Event Date *'}</label>
            <input value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={inputClass} type="date" dir="ltr" />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{isAr ? 'الوقت' : 'Time'}</label>
            <input value={eventTime} onChange={(e) => setEventTime(e.target.value)} className={inputClass} type="time" dir="ltr" />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{isAr ? 'اسم المكان' : 'Venue Name'}</label>
            <input value={venueName} onChange={(e) => setVenueName(e.target.value)} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{isAr ? 'عنوان المكان' : 'Venue Address'}</label>
            <input value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} className={inputClass} />
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{isAr ? 'الباقة' : 'Package'}</label>
            <select value={packageId} onChange={(e) => handlePackageChange(e.target.value)} className={inputClass}>
              <option value="">{isAr ? '— بدون باقة —' : '— No package —'}</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {isAr ? p.name_ar : p.name_en} — {Number(p.price_per_person_bhd).toFixed(3)} BD/شخص
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{isAr ? 'عدد الضيوف *' : 'Guest Count *'}</label>
            <input value={guestCount} onChange={(e) => setGuestCount(Number(e.target.value))} className={inputClass} type="number" min={1} dir="ltr" />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{isAr ? 'السعر للشخص (BD)' : 'Price/Person (BD)'}</label>
            <input value={pricePerPerson} onChange={(e) => setPricePerPerson(Number(e.target.value))} className={inputClass} type="number" min={0} step={0.001} dir="ltr" />
          </div>
          <div className="bg-brand-surface-2 rounded-lg px-3 py-2 flex items-center justify-between">
            <span className="font-satoshi text-sm text-brand-muted">{isAr ? 'الإجمالي' : 'Subtotal'}</span>
            <span className="font-cairo font-black text-brand-gold">{subtotal.toFixed(3)} BD</span>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{isAr ? 'العربون (BD)' : 'Deposit (BD)'}</label>
            <input value={depositBhd} onChange={(e) => setDepositBhd(Number(e.target.value))} className={inputClass} type="number" min={0} step={0.001} dir="ltr" />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass}>{isAr ? 'ملاحظات' : 'Notes'}</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} rows={3} />
          </div>
        </div>
      )}

      {error && (
        <p className="font-satoshi text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel ?? (() => {})}
          className="font-satoshi text-sm text-brand-muted hover:text-brand-text transition-colors"
        >
          {isAr ? 'إلغاء' : 'Cancel'}
        </button>
        <div className="flex gap-2">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as Step)}
              className="rounded-lg border border-brand-border px-4 py-2 font-satoshi text-sm text-brand-muted hover:text-brand-text transition-colors"
            >
              {isAr ? 'السابق' : 'Back'}
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
              className="rounded-lg bg-brand-gold px-4 py-2 font-satoshi text-sm font-bold text-brand-black hover:bg-brand-goldLight disabled:opacity-50 transition-colors"
            >
              {isAr ? 'التالي' : 'Next'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || guestCount < 1}
              className="rounded-lg bg-brand-gold px-4 py-2 font-satoshi text-sm font-bold text-brand-black hover:bg-brand-goldLight disabled:opacity-50 transition-colors"
            >
              {isPending
                ? (isAr ? 'جارٍ الحفظ...' : 'Saving...')
                : mode === 'edit'
                ? (isAr ? 'حفظ التغييرات' : 'Save Changes')
                : (isAr ? 'حفظ الطلب' : 'Save Order')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
