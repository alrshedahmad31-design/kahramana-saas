'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { StaffBasicRow, StaffRole } from '@/lib/supabase/types'
import { canAssignRole } from '@/lib/auth/rbac'
import { createStaff, updateStaff } from '@/app/[locale]/dashboard/staff/actions'

// The full list of roles in display order
const ALL_ROLES: StaffRole[] = [
  'owner', 'general_manager', 'branch_manager',
  'cashier', 'kitchen', 'driver',
  'inventory', 'marketing', 'support',
]

import { BRANCH_LIST } from '@/constants/contact'

type Mode = 'create' | 'edit'

interface Props {
  mode:             Mode
  target?:          StaffBasicRow
  callerRole:       StaffRole | null
  callerBranchId:   string | null
  locale:           string
  onClose:          () => void
  onSuccess:        () => void
}

interface FormErrors {
  name?:     string
  email?:    string
  password?: string
  role?:     string
  branch?:   string
}

function validate(
  mode: Mode,
  name: string,
  email: string,
  password: string,
  role: string,
  callerRole: StaffRole | null,
): FormErrors {
  const errs: FormErrors = {}
  if (!name.trim())  errs.name = 'Required'
  if (mode === 'create') {
    if (!email.trim()) errs.email = 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Invalid email'
    if (!password)   errs.password = 'Required'
    else if (password.length < 8) errs.password = 'Min 8 characters'
  }
  if (!role) {
    errs.role = 'Required'
  } else if (callerRole) {
    // build a fake caller for canAssignRole (it only needs .role)
    const fakeCaller = { id: '', email: '', role: callerRole, branch_id: null, name: null }
    if (!canAssignRole(fakeCaller, role as StaffRole)) errs.role = 'You cannot assign this role'
  }
  return errs
}

export default function StaffForm({
  mode,
  target,
  callerRole,
  callerBranchId,
  locale,
  onClose,
  onSuccess,
}: Props) {
  const t  = useTranslations('dashboard.staff')
  const tR = useTranslations('dashboard.roles')
  const tC = useTranslations('common')
  const isAr = locale === 'ar'

  const isGlobalAdmin = callerRole === 'owner' || callerRole === 'general_manager'

  const [name,     setName]     = useState(target?.name ?? '')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [role,     setRole]     = useState<StaffRole | ''>(target?.role ?? '')
  const [branchId, setBranchId] = useState<string | null>(
    target?.branch_id ?? (isGlobalAdmin ? null : callerBranchId),
  )
  const [errors,   setErrors]   = useState<FormErrors>({})
  const [saving,   setSaving]   = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  // Roles the caller is allowed to assign
  const fakeCaller = { id: '', email: '', role: callerRole, branch_id: callerBranchId, name: null }
  const assignable = ALL_ROLES.filter((r) => canAssignRole(fakeCaller, r))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate(mode, name, email, password, role as string, callerRole)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setErrors({})
    setApiError(null)
    setSaving(true)

    let result
    if (mode === 'create') {
      result = await createStaff({ name, email, password, role: role as StaffRole, branch_id: branchId, locale })
    } else {
      result = await updateStaff({ id: target!.id, name, role: role as StaffRole, branch_id: branchId, is_active: target!.is_active, locale })
    }

    setSaving(false)
    if (result.success) {
      onSuccess()
    } else {
      setApiError(result.error)
    }
  }

  const title = mode === 'create' ? t('addTitle') : t('editTitle')

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(10,10,10,0.75)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-brand-surface border border-brand-border rounded-xl
                   w-full max-w-md shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="staff-form-title"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border">
          <h2 id="staff-form-title" className="font-satoshi font-black text-lg text-brand-text">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-brand-muted hover:text-brand-text transition-colors w-8 h-8 flex items-center justify-center rounded-lg"
            aria-label={tC('close')}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="px-6 py-5 flex flex-col gap-4">

            {/* API error */}
            {apiError && (
              <div className="bg-brand-error/10 border border-brand-error/30 rounded-lg px-4 py-3">
                <p className="font-satoshi text-sm text-brand-error">{apiError}</p>
              </div>
            )}

            {/* Name */}
            <Field label={t('name')} error={errors.name}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass(!!errors.name)}
                autoComplete="name"
              />
            </Field>

            {/* Email — create only */}
            {mode === 'create' && (
              <Field label={t('email')} error={errors.email}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass(!!errors.email)}
                  autoComplete="email"
                />
              </Field>
            )}

            {/* Password — create only */}
            {mode === 'create' && (
              <Field label={t('password')} error={errors.password}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass(!!errors.password)}
                  autoComplete="new-password"
                />
              </Field>
            )}

            {/* Role */}
            <Field label={t('role')} error={errors.role}>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as StaffRole)}
                className={inputClass(!!errors.role)}
              >
                <option value="">—</option>
                {assignable.map((r) => (
                  <option key={r} value={r}>
                    {tR(r as Parameters<typeof tR>[0])}
                  </option>
                ))}
              </select>
            </Field>

            {/* Branch — show for global admins, or if branch_manager creating staff */}
            {(isGlobalAdmin) ? (
              <Field label={t('branch')}>
                <select
                  value={branchId ?? ''}
                  onChange={(e) => setBranchId(e.target.value || null)}
                  className={inputClass(false)}
                >
                  <option value="">{t('branchAll')}</option>
                  {BRANCH_LIST.map((b) => (
                    <option key={b.id} value={b.id}>{locale === 'en' ? b.nameEn : b.nameAr}</option>
                  ))}
                </select>
              </Field>
            ) : (
              /* Branch managers create staff for their own branch — read-only display */
              <Field label={t('branch')}>
                <input
                  type="text"
                  readOnly
                  value={callerBranchId
                    ? (isAr
                      ? BRANCH_LIST.find((b) => b.id === callerBranchId)?.nameAr
                      : BRANCH_LIST.find((b) => b.id === callerBranchId)?.nameEn
                    ) ?? callerBranchId
                    : '—'}
                  className={`${inputClass(false)} opacity-60 cursor-default`}
                />
              </Field>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-brand-border flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="font-satoshi text-sm font-medium text-brand-muted
                         hover:text-brand-text transition-colors duration-150
                         min-h-[40px] px-4"
            >
              {tC('cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-brand-gold text-brand-black font-satoshi font-medium text-sm
                         rounded-lg px-5 py-2.5 min-h-[40px]
                         hover:bg-brand-gold-light active:scale-95
                         disabled:opacity-40 disabled:cursor-not-allowed
                         transition-all duration-150"
            >
              {saving ? '...' : mode === 'create' ? t('add') : t('saveChanges')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function inputClass(hasError: boolean) {
  return `w-full bg-brand-surface-2 border rounded-lg px-3 py-2.5
          font-satoshi text-sm text-brand-text
          placeholder:text-brand-muted
          focus:outline-none focus:ring-2 focus:ring-brand-gold/40
          transition-colors duration-150
          ${hasError ? 'border-brand-error' : 'border-brand-border focus:border-brand-gold'}`
}

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
    <div className="flex flex-col gap-1.5">
      <label className="font-satoshi text-sm font-medium text-brand-muted">{label}</label>
      {children}
      {error && <p className="font-satoshi text-xs text-brand-error">{error}</p>}
    </div>
  )
}
