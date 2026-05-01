'use client'

import { useState, useTransition } from 'react'
import { BRANCHES }                from '@/constants/contact'
import { updateStaffProfile }      from '@/app/[locale]/dashboard/staff/[id]/actions'
import type { StaffExtendedRow, EmploymentType, StaffRole } from '@/lib/supabase/custom-types'

interface Props {
  staff:       StaffExtendedRow
  canEdit:     boolean
  isRTL:       boolean
}

const ROLE_LABEL_EN: Record<StaffRole, string> = {
  owner:             'Owner',
  general_manager:   'General Manager',
  branch_manager:    'Branch Manager',
  cashier:           'Cashier',
  kitchen:           'Kitchen',
  driver:            'Driver',
  inventory:         'Inventory',
  inventory_manager: 'Inventory Manager',
  marketing:         'Marketing',
  support:           'Support',
}

const ROLE_LABEL_AR: Record<StaffRole, string> = {
  owner:             'المالك',
  general_manager:   'مدير عام',
  branch_manager:    'مدير فرع',
  cashier:           'كاشير',
  kitchen:           'مطبخ',
  driver:            'سائق',
  inventory:         'مخزون',
  inventory_manager: 'مدير المخزون',
  marketing:         'تسويق',
  support:           'دعم',
}

const EMP_LABEL: Record<EmploymentType, { en: string; ar: string }> = {
  full_time:  { en: 'Full Time',  ar: 'دوام كامل' },
  part_time:  { en: 'Part Time',  ar: 'دوام جزئي' },
  contract:   { en: 'Contract',   ar: 'عقد' },
  temporary:  { en: 'Temporary',  ar: 'مؤقت' },
}

export default function StaffOverview({ staff, canEdit, isRTL }: Props) {
  const [editing,    setEditing]    = useState(false)
  const [isPending,  startTransition] = useTransition()
  const [error,      setError]      = useState<string | null>(null)
  const [success,    setSuccess]    = useState(false)

  const branch = staff.branch_id ? BRANCHES[staff.branch_id as keyof typeof BRANCHES] : null

  const [form, setForm] = useState({
    phone:                   staff.phone                   ?? '',
    hire_date:               staff.hire_date               ?? '',
    employment_type:         (staff.employment_type ?? 'full_time') as EmploymentType,
    hourly_rate:             staff.hourly_rate != null ? String(staff.hourly_rate) : '',
    emergency_contact_name:  staff.emergency_contact_name  ?? '',
    emergency_contact_phone: staff.emergency_contact_phone ?? '',
    address:                 staff.address                 ?? '',
    clock_pin:               staff.clock_pin               ?? '',
    staff_notes:             staff.staff_notes             ?? '',
  })

  function handleChange(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await updateStaffProfile({
        id:                      staff.id,
        phone:                   form.phone                   || undefined,
        hire_date:               form.hire_date               || null,
        employment_type:         form.employment_type,
        hourly_rate:             form.hourly_rate ? parseFloat(form.hourly_rate) : null,
        emergency_contact_name:  form.emergency_contact_name  || undefined,
        emergency_contact_phone: form.emergency_contact_phone || undefined,
        address:                 form.address                 || undefined,
        clock_pin:               form.clock_pin               || undefined,
        staff_notes:             form.staff_notes             || undefined,
      })
      if (result.success) {
        setEditing(false)
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } else {
        setError(result.error)
      }
    })
  }

  const inputCls = `
    w-full min-h-[40px] rounded-lg border border-brand-border bg-brand-surface-2
    px-3 font-satoshi text-sm text-brand-text
    focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold
  `

  return (
    <div className="flex flex-col gap-5">
      {/* Toast */}
      {success && (
        <div className="rounded-lg bg-brand-success/10 border border-brand-success/20 px-4 py-2.5 font-satoshi text-sm text-brand-success">
          {isRTL ? 'تم الحفظ بنجاح' : 'Saved successfully'}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-brand-error/10 border border-brand-error/20 px-4 py-2.5 font-satoshi text-sm text-brand-error">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center">
            <span className="font-satoshi font-black text-2xl text-brand-gold">
              {staff.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className={`font-satoshi font-black text-xl text-brand-text ${isRTL ? 'font-almarai' : ''}`}>
              {staff.name}
            </h2>
            <p className="font-satoshi text-sm text-brand-muted">
              {isRTL ? ROLE_LABEL_AR[staff.role] : ROLE_LABEL_EN[staff.role]}
              {branch && (
                <span className="ms-1.5 text-brand-muted/50">
                  · {isRTL ? branch.nameAr : branch.nameEn}
                </span>
              )}
            </p>
          </div>
        </div>

        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 rounded-lg border border-brand-border px-4 py-2 font-satoshi text-sm text-brand-muted hover:text-brand-text hover:border-brand-gold/40 transition-colors duration-150 min-h-[40px]"
          >
            <EditIcon />
            {isRTL ? 'تعديل' : 'Edit'}
          </button>
        )}
      </div>

      {/* Info grid */}
      {!editing ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoCard label={isRTL ? 'الهاتف' : 'Phone'} value={staff.phone} isRTL={isRTL} />
          <InfoCard label={isRTL ? 'تاريخ التعيين' : 'Hire Date'} value={staff.hire_date ?? null} isRTL={isRTL} />
          <InfoCard
            label={isRTL ? 'نوع التوظيف' : 'Employment Type'}
            value={staff.employment_type ? (isRTL ? EMP_LABEL[staff.employment_type as EmploymentType].ar : EMP_LABEL[staff.employment_type as EmploymentType].en) : null}
            isRTL={isRTL}
          />
          <InfoCard
            label={isRTL ? 'الراتب بالساعة' : 'Hourly Rate'}
            value={staff.hourly_rate != null ? `${staff.hourly_rate} BD` : null}
            isRTL={isRTL}
          />
          <InfoCard label={isRTL ? 'جهة الاتصال الطارئ' : 'Emergency Contact'} value={staff.emergency_contact_name} isRTL={isRTL} />
          <InfoCard label={isRTL ? 'هاتف الطوارئ' : 'Emergency Phone'} value={staff.emergency_contact_phone} isRTL={isRTL} />
          <div className="sm:col-span-2">
            <InfoCard label={isRTL ? 'العنوان' : 'Address'} value={staff.address} isRTL={isRTL} />
          </div>
          <InfoCard label={isRTL ? 'PIN التسجيل' : 'Clock PIN'} value={staff.clock_pin ? '••••' : null} isRTL={isRTL} />
          <div className="sm:col-span-2">
            <InfoCard label={isRTL ? 'ملاحظات' : 'Notes'} value={staff.staff_notes} isRTL={isRTL} />
          </div>
        </div>
      ) : (
        /* Edit form */
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-satoshi text-xs text-brand-muted uppercase tracking-wider">
                {isRTL ? 'الهاتف' : 'Phone'}
              </label>
              <input type="tel" value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} className={inputCls} dir="ltr" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-satoshi text-xs text-brand-muted uppercase tracking-wider">
                {isRTL ? 'تاريخ التعيين' : 'Hire Date'}
              </label>
              <input type="date" value={form.hire_date} onChange={(e) => handleChange('hire_date', e.target.value)} className={inputCls} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-satoshi text-xs text-brand-muted uppercase tracking-wider">
                {isRTL ? 'نوع التوظيف' : 'Employment Type'}
              </label>
              <select value={form.employment_type} onChange={(e) => handleChange('employment_type', e.target.value)} className={inputCls}>
                {(Object.entries(EMP_LABEL) as [EmploymentType, { en: string; ar: string }][]).map(([k, v]) => (
                  <option key={k} value={k}>{isRTL ? v.ar : v.en}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-satoshi text-xs text-brand-muted uppercase tracking-wider">
                {isRTL ? 'الراتب بالساعة (BD)' : 'Hourly Rate (BD)'}
              </label>
              <input type="number" step="0.001" value={form.hourly_rate} onChange={(e) => handleChange('hourly_rate', e.target.value)} className={inputCls} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-satoshi text-xs text-brand-muted uppercase tracking-wider">
                {isRTL ? 'جهة الاتصال الطارئ' : 'Emergency Contact'}
              </label>
              <input type="text" value={form.emergency_contact_name} onChange={(e) => handleChange('emergency_contact_name', e.target.value)} className={inputCls} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-satoshi text-xs text-brand-muted uppercase tracking-wider">
                {isRTL ? 'هاتف الطوارئ' : 'Emergency Phone'}
              </label>
              <input type="tel" value={form.emergency_contact_phone} onChange={(e) => handleChange('emergency_contact_phone', e.target.value)} className={inputCls} dir="ltr" />
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label className="font-satoshi text-xs text-brand-muted uppercase tracking-wider">
                {isRTL ? 'العنوان' : 'Address'}
              </label>
              <input type="text" value={form.address} onChange={(e) => handleChange('address', e.target.value)} className={inputCls} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-satoshi text-xs text-brand-muted uppercase tracking-wider">
                {isRTL ? 'PIN التسجيل (4 أرقام)' : 'Clock PIN (4 digits)'}
              </label>
              <input
                type="text"
                maxLength={4}
                pattern="\d{4}"
                placeholder="1234"
                value={form.clock_pin}
                onChange={(e) => handleChange('clock_pin', e.target.value.replace(/\D/g, ''))}
                className={inputCls}
                dir="ltr"
              />
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label className="font-satoshi text-xs text-brand-muted uppercase tracking-wider">
                {isRTL ? 'ملاحظات' : 'Notes'}
              </label>
              <textarea
                rows={3}
                value={form.staff_notes}
                onChange={(e) => handleChange('staff_notes', e.target.value)}
                className={`${inputCls} resize-none py-2`}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="flex-1 min-h-[44px] rounded-lg bg-brand-gold text-brand-black font-satoshi font-bold text-sm hover:bg-brand-gold/90 transition-colors duration-150 disabled:opacity-50"
            >
              {isPending ? (isRTL ? 'جارٍ الحفظ…' : 'Saving…') : (isRTL ? 'حفظ التغييرات' : 'Save Changes')}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="min-h-[44px] px-5 rounded-lg border border-brand-border text-brand-muted hover:text-brand-text font-satoshi text-sm transition-colors duration-150"
            >
              {isRTL ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function InfoCard({ label, value, isRTL }: { label: string; value: string | null | undefined; isRTL: boolean }) {
  return (
    <div className="rounded-lg bg-brand-surface-2 border border-brand-border px-4 py-3">
      <p className="font-satoshi text-xs text-brand-muted uppercase tracking-wider mb-1">{label}</p>
      <p className={`font-satoshi font-medium text-sm text-brand-text ${isRTL ? 'font-almarai' : ''}`}>
        {value ?? <span className="text-brand-muted/40">—</span>}
      </p>
    </div>
  )
}

function EditIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )
}
