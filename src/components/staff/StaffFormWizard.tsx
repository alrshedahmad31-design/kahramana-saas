import { useState, useRef }   from 'react'
import Image from 'next/image'
import { BRANCH_LIST }     from '@/constants/contact'
import type { StaffRole, EmploymentType } from '@/lib/supabase/custom-types'
import { createStaffFull } from '@/app/[locale]/dashboard/staff/actions'
import type { CreateStaffFullResult } from '@/app/[locale]/dashboard/staff/actions'
import { createClient }    from '@/lib/supabase/client'

interface Props {
  locale:        string
  callerRole:    StaffRole | null
  onClose:       () => void
  onSuccess:     () => void
}

type Step = 0 | 1 | 2 | 3 | 4

interface FormData {
  // Step 0 – Account
  name:      string
  email:     string
  role:      StaffRole
  branch_id: string
  // Step 1 – Personal
  phone:             string
  date_of_birth:     string
  id_number:         string
  address:           string
  profile_photo_url: string
  // Step 2 – Employment
  hire_date:       string
  employment_type: EmploymentType | ''
  hourly_rate:     string
  // Step 3 – Emergency
  emergency_contact_name:  string
  emergency_contact_phone: string
  // Step 4 – Access
  clock_pin:   string
  staff_notes: string
}

const INITIAL: FormData = {
  name: '', email: '', role: 'cashier', branch_id: '',
  phone: '', date_of_birth: '', id_number: '', address: '', profile_photo_url: '',
  hire_date: '', employment_type: '', hourly_rate: '',
  emergency_contact_name: '', emergency_contact_phone: '',
  clock_pin: '', staff_notes: '',
}

const ROLES: { value: StaffRole; ar: string; en: string }[] = [
  { value: 'owner',           ar: 'المالك',               en: 'Owner'           },
  { value: 'general_manager', ar: 'المدير العام',          en: 'General Manager' },
  { value: 'branch_manager',  ar: 'مدير الفرع',            en: 'Branch Manager'  },
  { value: 'cashier',         ar: 'كاشير',                 en: 'Cashier'         },
  { value: 'kitchen',         ar: 'مطبخ',                  en: 'Kitchen'         },
  { value: 'driver',          ar: 'سائق',                  en: 'Driver'          },
  { value: 'inventory',       ar: 'مستودع',                en: 'Inventory'       },
  { value: 'marketing',       ar: 'تسويق',                 en: 'Marketing'       },
  { value: 'support',         ar: 'دعم',                   en: 'Support'         },
]

const EMP_TYPES: { value: EmploymentType; ar: string; en: string }[] = [
  { value: 'full_time', ar: 'دوام كامل', en: 'Full-time' },
  { value: 'part_time', ar: 'دوام جزئي', en: 'Part-time' },
  { value: 'contract',  ar: 'عقد',       en: 'Contract'  },
  { value: 'temporary', ar: 'مؤقت',      en: 'Temporary' },
]

const STEP_LABELS = [
  { ar: 'الحساب',     en: 'Account'   },
  { ar: 'الشخصية',   en: 'Personal'  },
  { ar: 'التوظيف',   en: 'Employment'},
  { ar: 'طوارئ',     en: 'Emergency' },
  { ar: 'الوصول',    en: 'Access'    },
]

export default function StaffFormWizard({ locale, callerRole: _callerRole, onClose, onSuccess }: Props) {
  const isAr = locale === 'ar'
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step,          setStep]          = useState<Step>(0)
  const [data,          setData]          = useState<FormData>(INITIAL)
  const [error,         setError]         = useState<string | null>(null)
  const [loading,       setLoading]       = useState(false)
  const [uploadPending, setUploadPending] = useState(false)
  const [submitted,     setSubmitted]     = useState<Extract<CreateStaffFullResult, { success: true }> | null>(null)

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setData(prev => ({ ...prev, [key]: value }))
    setError(null)
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadPending(true)
    setError(null)

    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).slice(2)}_${Date.now()}.${ext}`
      const filePath = `profiles/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('staff-photos')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('staff-photos')
        .getPublicUrl(filePath)

      set('profile_photo_url', publicUrl)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadPending(false)
    }
  }

  function validateStep(): string | null {
    if (step === 0) {
      if (!data.name.trim())  return isAr ? 'الاسم مطلوب'  : 'Name is required'
      if (!data.email.trim()) return isAr ? 'البريد مطلوب' : 'Email is required'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()))
        return isAr ? 'البريد الإلكتروني غير صحيح' : 'Invalid email address'
    }
    if (step === 4) {
      if (data.clock_pin && !/^\d{4}$/.test(data.clock_pin))
        return isAr ? 'الرقم السري ٤ أرقام' : 'PIN must be 4 digits'
    }
    return null
  }

  function next() {
    const err = validateStep()
    if (err) { setError(err); return }
    setError(null)
    setStep(s => (s < 4 ? (s + 1) as Step : s))
  }

  function prev() {
    setError(null)
    setStep(s => (s > 0 ? (s - 1) as Step : s))
  }

  async function submit() {
    const err = validateStep()
    if (err) { setError(err); return }

    setLoading(true)
    const result = await createStaffFull({
      name:      data.name.trim(),
      email:     data.email.trim(),
      role:      data.role,
      branch_id: data.branch_id || null,
      locale,
      phone:                   data.phone         || undefined,
      date_of_birth:           data.date_of_birth || undefined,
      id_number:               data.id_number     || undefined,
      address:                 data.address       || undefined,
      profile_photo_url:       data.profile_photo_url || undefined,
      hire_date:               data.hire_date     || undefined,
      employment_type:         (data.employment_type as EmploymentType) || undefined,
      hourly_rate:             data.hourly_rate   ? Number(data.hourly_rate) : undefined,
      emergency_contact_name:  data.emergency_contact_name  || undefined,
      emergency_contact_phone: data.emergency_contact_phone || undefined,
      clock_pin:               data.clock_pin     || undefined,
      staff_notes:             data.staff_notes   || undefined,
    })
    setLoading(false)

    if (!result.success) {
      setError(result.error)
      return
    }
    setSubmitted(result)
  }

  const fieldCls = `w-full bg-brand-surface-2 border border-brand-border rounded-xl
    px-4 py-3 text-brand-text font-almarai text-sm placeholder:text-brand-muted
    focus:outline-none focus:border-brand-gold transition-colors`

  const labelCls = `block font-almarai font-bold text-brand-muted text-xs mb-1.5`

  // ── Success screen ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4
                   bg-brand-black/80 backdrop-blur-sm"
        onClick={e => { if (e.target === e.currentTarget) { onSuccess(); onClose() } }}
      >
        <div
          className="w-full max-w-sm bg-brand-surface border border-brand-border rounded-2xl
                     flex flex-col items-center gap-5 px-8 py-10 shadow-2xl text-center"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div className="w-16 h-16 rounded-2xl bg-brand-success/15 border border-brand-success/30
                          flex items-center justify-center">
            <CheckCircleIcon />
          </div>

          <div className="flex flex-col gap-2">
            <h3 className={`font-black text-xl text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
              {isAr ? 'تم إضافة الموظف بنجاح!' : 'Staff member added!'}
            </h3>
            <p className={`text-sm text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              <span className="text-brand-text font-bold">{submitted.staffName}</span>
            </p>
          </div>

          <div className={`w-full rounded-xl border px-4 py-3 text-sm
            ${submitted.inviteSent
              ? 'bg-brand-success/8 border-brand-success/25 text-brand-success'
              : 'bg-brand-gold/8 border-brand-gold/25 text-brand-gold'
            }`}>
            {submitted.inviteSent ? (
              <>
                <p className={`font-bold mb-1 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {isAr ? 'تم إرسال رسالة الدعوة' : 'Invitation email sent'}
                </p>
                <p className={`text-xs opacity-80 break-all ${isAr ? 'font-almarai' : 'font-satoshi'}`}
                   dir="ltr">
                  {submitted.staffEmail}
                </p>
                <p className={`text-xs opacity-70 mt-1.5 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {isAr
                    ? 'يجب على الموظف فتح الإيميل والضغط على الرابط لإنشاء كلمة المرور'
                    : 'Staff must open the email and click the link to set their password'}
                </p>
              </>
            ) : (
              <>
                <p className={`font-bold mb-1 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {isAr ? 'تعذّر إرسال الدعوة' : 'Invitation email failed'}
                </p>
                <p className={`text-xs opacity-80 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {isAr
                    ? 'يمكن إعادة إرسال الدعوة من قائمة الموظفين'
                    : 'You can resend the invitation from the staff list'}
                </p>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => { onSuccess(); onClose() }}
            className="w-full min-h-[48px] rounded-xl bg-brand-gold text-brand-black
                       font-cairo font-black text-base
                       hover:bg-brand-gold-light transition-colors active:scale-[0.98]"
          >
            {isAr ? 'إغلاق' : 'Done'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4
                 bg-brand-black/80 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-xl bg-brand-surface border border-brand-border rounded-2xl
                   flex flex-col max-h-[90vh] shadow-2xl"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border shrink-0">
          <h2 className={`font-black text-brand-text text-lg ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
            {isAr ? 'إضافة موظف جديد' : 'Add New Staff'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-brand-muted
                       hover:text-brand-text hover:bg-brand-surface-2 transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-1 px-6 py-4 border-b border-brand-border shrink-0 overflow-x-auto">
          {STEP_LABELS.map((s, i) => (
            <div key={i} className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => { if (i < step) { setError(null); setStep(i as Step) } }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-almarai font-bold
                  transition-colors whitespace-nowrap
                  ${i === step
                    ? 'bg-brand-gold text-brand-black'
                    : i < step
                      ? 'bg-brand-success/20 text-brand-success cursor-pointer'
                      : 'bg-brand-surface-2 text-brand-muted cursor-default'}`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-black
                  ${i === step ? 'bg-brand-black/20' : i < step ? 'bg-brand-success/20' : 'bg-brand-border'}`}>
                  {i < step ? '✓' : i + 1}
                </span>
                {isAr ? s.ar : s.en}
              </button>
              {i < 4 && <ChevronIcon className="text-brand-border" />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">

          {/* Step 0: Account */}
          {step === 0 && (
            <div className="flex flex-col gap-4">
              <div>
                <label className={labelCls}>{isAr ? 'الاسم الكامل *' : 'Full Name *'}</label>
                <input
                  type="text"
                  value={data.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder={isAr ? 'أحمد محمد' : 'Ahmed Mohammed'}
                  className={fieldCls}
                />
              </div>
              <div>
                <label className={labelCls}>{isAr ? 'البريد الإلكتروني *' : 'Email *'}</label>
                <input
                  type="email"
                  value={data.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="staff@kahramana.com"
                  className={fieldCls}
                  dir="ltr"
                />
                <p className={`mt-1.5 text-xs text-brand-muted/70 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {isAr
                    ? 'سيتلقى الموظف رابط تفعيل على هذا البريد لإنشاء كلمة مروره'
                    : 'Staff will receive an activation link at this email to set their password'}
                </p>
              </div>
              <div>
                <label className={labelCls}>{isAr ? 'الدور *' : 'Role *'}</label>
                <select
                  value={data.role}
                  onChange={e => set('role', e.target.value as StaffRole)}
                  className={fieldCls}
                >
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>
                      {isAr ? r.ar : r.en}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>{isAr ? 'الفرع' : 'Branch'}</label>
                <select
                  value={data.branch_id}
                  onChange={e => set('branch_id', e.target.value)}
                  className={fieldCls}
                >
                  <option value="">{isAr ? 'جميع الفروع' : 'All Branches'}</option>
                  {BRANCH_LIST.map(b => (
                    <option key={b.id} value={b.id}>
                      {isAr ? b.nameAr : b.nameEn}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Step 1: Personal */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              {/* Photo Upload */}
              <div className="flex flex-col items-center gap-3 mb-2">
                <div 
                  className="w-24 h-24 rounded-full bg-brand-surface-2 border-2 border-dashed border-brand-border
                             flex items-center justify-center overflow-hidden relative group cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {data.profile_photo_url ? (
                    <Image src={data.profile_photo_url} alt="Profile" fill sizes="96px" className="object-cover" />
                  ) : (
                    <PhotoIcon className="w-8 h-8 text-brand-muted group-hover:text-brand-gold transition-colors" />
                  )}
                  {uploadPending && (
                    <div className="absolute inset-0 bg-brand-black/40 flex items-center justify-center">
                      <SpinnerIcon className="text-brand-gold" />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-almarai font-bold text-brand-gold hover:underline"
                >
                  {isAr ? 'تحميل صورة شخصية' : 'Upload Profile Photo'}
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  accept="image/*"
                  className="hidden"
                />
              </div>

              <div>
                <label className={labelCls}>{isAr ? 'رقم الهاتف' : 'Phone'}</label>
                <input
                  type="tel"
                  value={data.phone}
                  onChange={e => set('phone', e.target.value)}
                  placeholder="+97336XXXXXX"
                  className={fieldCls}
                  dir="ltr"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{isAr ? 'تاريخ الميلاد' : 'Date of Birth'}</label>
                  <input
                    type="date"
                    value={data.date_of_birth}
                    onChange={e => set('date_of_birth', e.target.value)}
                    className={fieldCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>{isAr ? 'رقم الهوية' : 'ID Number'}</label>
                  <input
                    type="text"
                    value={data.id_number}
                    onChange={e => set('id_number', e.target.value)}
                    className={fieldCls}
                    dir="ltr"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>{isAr ? 'العنوان' : 'Address'}</label>
                <textarea
                  value={data.address}
                  onChange={e => set('address', e.target.value)}
                  rows={3}
                  className={`${fieldCls} resize-none`}
                />
              </div>
            </div>
          )}

          {/* Step 2: Employment */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div>
                <label className={labelCls}>{isAr ? 'تاريخ التوظيف' : 'Hire Date'}</label>
                <input
                  type="date"
                  value={data.hire_date}
                  onChange={e => set('hire_date', e.target.value)}
                  className={fieldCls}
                />
              </div>
              <div>
                <label className={labelCls}>{isAr ? 'نوع التوظيف' : 'Employment Type'}</label>
                <select
                  value={data.employment_type}
                  onChange={e => set('employment_type', e.target.value as EmploymentType | '')}
                  className={fieldCls}
                >
                  <option value="">{isAr ? 'اختر' : 'Select'}</option>
                  {EMP_TYPES.map(t => (
                    <option key={t.value} value={t.value}>
                      {isAr ? t.ar : t.en}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>{isAr ? 'الأجر بالساعة (د.ب)' : 'Hourly Rate (د.ب)'}</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={data.hourly_rate}
                  onChange={e => set('hourly_rate', e.target.value)}
                  placeholder="0.000"
                  className={fieldCls}
                  dir="ltr"
                />
              </div>
            </div>
          )}

          {/* Step 3: Emergency */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <p className="font-almarai text-sm text-brand-muted">
                {isAr
                  ? 'بيانات جهة الاتصال في حالات الطوارئ'
                  : 'Emergency contact information'}
              </p>
              <div>
                <label className={labelCls}>{isAr ? 'اسم جهة الاتصال' : 'Contact Name'}</label>
                <input
                  type="text"
                  value={data.emergency_contact_name}
                  onChange={e => set('emergency_contact_name', e.target.value)}
                  className={fieldCls}
                />
              </div>
              <div>
                <label className={labelCls}>{isAr ? 'رقم هاتف الطوارئ' : 'Emergency Phone'}</label>
                <input
                  type="tel"
                  value={data.emergency_contact_phone}
                  onChange={e => set('emergency_contact_phone', e.target.value)}
                  placeholder="+97336XXXXXX"
                  className={fieldCls}
                  dir="ltr"
                />
              </div>
            </div>
          )}

          {/* Step 4: Access */}
          {step === 4 && (
            <div className="flex flex-col gap-4">
              <div>
                <label className={labelCls}>
                  {isAr ? 'الرقم السري للحضور (٤ أرقام)' : 'Clock-in PIN (4 digits)'}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={data.clock_pin}
                  onChange={e => set('clock_pin', e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="1234"
                  className={`${fieldCls} tracking-[0.5em] text-center`}
                  dir="ltr"
                />
              </div>
              <div>
                <label className={labelCls}>{isAr ? 'ملاحظات' : 'Notes'}</label>
                <textarea
                  value={data.staff_notes}
                  onChange={e => set('staff_notes', e.target.value)}
                  rows={4}
                  className={`${fieldCls} resize-none`}
                />
              </div>

              {/* Summary */}
              <div className="p-4 bg-brand-surface-2 rounded-xl border border-brand-border">
                <p className="font-almarai font-bold text-brand-text text-sm mb-3">
                  {isAr ? 'ملخص' : 'Summary'}
                </p>
                <div className="flex flex-col gap-1.5 text-xs font-almarai text-brand-muted">
                  <div className="flex justify-between">
                    <span>{isAr ? 'الاسم' : 'Name'}</span>
                    <span className="text-brand-text font-bold">{data.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{isAr ? 'البريد' : 'Email'}</span>
                    <span className="text-brand-text font-bold dir-ltr">{data.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{isAr ? 'الدور' : 'Role'}</span>
                    <span className="text-brand-gold font-bold">{data.role}</span>
                  </div>
                  {data.phone && (
                    <div className="flex justify-between">
                      <span>{isAr ? 'الهاتف' : 'Phone'}</span>
                      <span className="text-brand-text">{data.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 rounded-xl bg-brand-error/10 border border-brand-error/30">
              <p className="font-almarai text-brand-error text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-brand-border shrink-0">
          {step > 0 && (
            <button
              type="button"
              onClick={prev}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-brand-border
                         text-brand-muted font-almarai font-bold text-sm
                         hover:text-brand-text hover:border-brand-gold/50 transition-colors
                         disabled:opacity-50"
            >
              {isAr ? <ChevronRightIcon /> : <ChevronLeftIcon />}
              {isAr ? 'السابق' : 'Back'}
            </button>
          )}

          <div className="flex-1" />

          {step < 4 ? (
            <button
              type="button"
              onClick={next}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-gold
                         text-brand-black font-cairo font-black text-sm
                         hover:bg-brand-gold-light transition-colors active:scale-[0.98]"
            >
              {isAr ? 'التالي' : 'Next'}
              {isAr ? <ChevronLeftIcon /> : <ChevronRightIcon />}
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={loading || uploadPending}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-gold
                         text-brand-black font-cairo font-black text-sm
                         hover:bg-brand-gold-light transition-colors active:scale-[0.98]
                         disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading && <SpinnerIcon />}
              {isAr ? 'إضافة الموظف' : 'Create Staff'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function CheckCircleIcon() {
  return <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-brand-success" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
}

function CloseIcon() {
  return <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
}
function ChevronIcon({ className }: { className?: string }) {
  return <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
}
function ChevronRightIcon() {
  return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
}
function ChevronLeftIcon() {
  return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
}
function SpinnerIcon({ className }: { className?: string }) {
  return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`animate-spin ${className ?? ''}`} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
}
function PhotoIcon({ className }: { className?: string }) {
  return <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15a2.25 2.25 0 002.25-2.25V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" /></svg>
}
