'use client'

import { useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import CinematicButton from '@/components/ui/CinematicButton'
import { updateCustomerProfile, type UpdateProfileResult } from './actions'

interface Props {
  initial: {
    name:             string | null
    phone:            string | null
    default_block:    string | null
    default_road:     string | null
    default_building: string | null
    default_flat:     string | null
    default_area:     string | null
    birthday:         string | null
  }
}

export default function ProfileEditForm({ initial }: Props) {
  const locale = useLocale()
  const isAr   = locale === 'ar'
  const t      = useTranslations('account.myInfo')

  const [name,            setName]            = useState(initial.name             ?? '')
  const [phone,           setPhone]           = useState(initial.phone            ?? '')
  const [block,           setBlock]           = useState(initial.default_block    ?? '')
  const [road,            setRoad]            = useState(initial.default_road     ?? '')
  const [building,        setBuilding]        = useState(initial.default_building ?? '')
  const [flat,            setFlat]            = useState(initial.default_flat     ?? '')
  const [area,            setArea]            = useState(initial.default_area     ?? '')
  const [birthday,        setBirthday]        = useState(initial.birthday         ?? '')
  const [savedAt,         setSavedAt]         = useState<number | null>(null)
  const [errorMsg,        setErrorMsg]        = useState<string | null>(null)
  const [errorField,      setErrorField]      = useState<'name' | 'phone' | 'address' | 'birthday' | null>(null)
  const [pending, startTransition] = useTransition()

  function localizeError(code: string): string {
    switch (code) {
      case 'name_too_long':         return t('errors.nameTooLong')
      case 'phone_invalid':         return t('errors.phoneInvalid')
      case 'phone_taken':           return t('errors.phoneTaken')
      case 'birthday_invalid':      return t('errors.birthdayInvalid')
      case 'birthday_out_of_range': return t('errors.birthdayOutOfRange')
      case 'not_authenticated':     return t('errors.notAuthenticated')
      case 'update_failed':         return t('errors.updateFailed')
      default:                      return t('errors.updateFailed')
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setErrorField(null)
    setSavedAt(null)

    startTransition(async () => {
      const res: UpdateProfileResult = await updateCustomerProfile({
        name:             name.trim(),
        phone:            phone.trim() || undefined,
        default_block:    block,
        default_road:     road,
        default_building: building,
        default_flat:     flat,
        default_area:     area,
        birthday:         birthday,
      })
      if (res.success) {
        setSavedAt(Date.now())
      } else {
        setErrorMsg(localizeError(res.error))
        setErrorField(res.field ?? null)
      }
    })
  }

  const inputCls =
    'w-full bg-brand-surface-2 border rounded-xl ps-4 pe-4 py-3 text-sm text-brand-text ' +
    'placeholder:text-brand-muted/40 focus:border-brand-gold focus:outline-none transition-all ' +
    (isAr ? 'font-almarai text-end' : 'font-satoshi text-start')

  return (
    <form onSubmit={handleSubmit} className="bg-brand-surface border border-brand-border rounded-2xl p-6 flex flex-col gap-4">
      <h2 className={`text-sm font-bold text-brand-muted uppercase tracking-wide ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
        {t('heading')}
      </h2>

      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-name" className={`text-xs font-bold text-brand-muted ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
          {t('name')}
        </label>
        <input
          id="profile-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          maxLength={120}
          className={`${inputCls} ${errorField === 'name' ? 'border-brand-error' : 'border-brand-border'}`}
        />
      </div>

      {/* Phone */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-phone" className={`text-xs font-bold text-brand-muted ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
          {t('phone')}
        </label>
        <input
          id="profile-phone"
          type="tel"
          dir="ltr"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          placeholder="+97336XXXXXX"
          className={`${inputCls} ${errorField === 'phone' ? 'border-brand-error' : 'border-brand-border'}`}
        />
      </div>

      {/* Birthday — optional, unlocks birthday-gift countdown card */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-birthday" className={`text-xs font-bold text-brand-muted ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
          {t('birthday')}
        </label>
        <input
          id="profile-birthday"
          type="date"
          dir="ltr"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
          autoComplete="bday"
          max={new Date().toISOString().slice(0, 10)}
          min="1900-01-01"
          className={`${inputCls} ${errorField === 'birthday' ? 'border-brand-error' : 'border-brand-border'}`}
        />
        <p className={`text-[10px] text-brand-muted/60 ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
          {t('birthdayHint')}
        </p>
      </div>

      {/* Default delivery address */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="profile-block" className={`text-xs font-bold text-brand-muted ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
            {t('block')}
          </label>
          <input id="profile-block" type="text" inputMode="numeric" value={block} onChange={(e) => setBlock(e.target.value)} autoComplete="address-level3" maxLength={60} className={`${inputCls} border-brand-border`} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="profile-road" className={`text-xs font-bold text-brand-muted ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
            {t('road')}
          </label>
          <input id="profile-road" type="text" inputMode="numeric" value={road} onChange={(e) => setRoad(e.target.value)} autoComplete="address-line1" maxLength={60} className={`${inputCls} border-brand-border`} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="profile-building" className={`text-xs font-bold text-brand-muted ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
            {t('building')}
          </label>
          <input id="profile-building" type="text" value={building} onChange={(e) => setBuilding(e.target.value)} autoComplete="address-line2" maxLength={60} className={`${inputCls} border-brand-border`} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="profile-flat" className={`text-xs font-bold text-brand-muted ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
            {t('flat')}
          </label>
          <input id="profile-flat" type="text" value={flat} onChange={(e) => setFlat(e.target.value)} autoComplete="address-line3" maxLength={60} className={`${inputCls} border-brand-border`} />
        </div>
        <div className="flex flex-col gap-1.5 col-span-2">
          <label htmlFor="profile-area" className={`text-xs font-bold text-brand-muted ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
            {t('area')}
          </label>
          <input id="profile-area" type="text" value={area} onChange={(e) => setArea(e.target.value)} autoComplete="address-level2" maxLength={60} className={`${inputCls} border-brand-border`} />
        </div>
      </div>

      <div role="alert" aria-live="polite" aria-atomic="true" className="min-h-[1rem]">
        {errorMsg && (
          <p className={`text-xs text-brand-error ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
            {errorMsg}
          </p>
        )}
        {savedAt && !errorMsg && (
          <p className={`text-xs text-brand-success ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
            {t('saved')}
          </p>
        )}
      </div>

      <CinematicButton type="submit" disabled={pending} isRTL={isAr} className="w-full sm:w-auto sm:self-start px-6 py-3 text-sm">
        {pending ? t('saving') : t('save')}
      </CinematicButton>
    </form>
  )
}
