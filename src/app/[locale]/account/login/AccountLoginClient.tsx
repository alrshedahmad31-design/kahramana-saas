'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import CinematicButton from '@/components/ui/CinematicButton'
import { loginAction, registerAction } from './actions'

type Mode = 'login' | 'register'

const PHONE_PATTERN = /^\+9[0-9]{11}$|^[0-9]{8}$/

type PasswordStrength = 'weak' | 'medium' | 'strong'

function scorePassword(pw: string): PasswordStrength | null {
  if (pw.length === 0) return null
  const longEnough = pw.length >= 8
  const hasDigit   = /[0-9]/.test(pw)
  const hasLetter  = /[A-Za-z]/.test(pw)
  const hasSpecial = /[^A-Za-z0-9]/.test(pw)
  if (!longEnough || !hasDigit || !hasLetter) return 'weak'
  if (hasSpecial) return 'strong'
  return 'medium'
}

export default function AccountLoginClient({ initialMode }: { initialMode?: Mode } = {}) {
  const locale = useLocale()
  const isAr   = locale === 'ar'
  const tAuth  = useTranslations('auth')

  const [mode,     setMode]     = useState<Mode>(initialMode ?? 'login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [phone,    setPhone]    = useState('')
  const [name,     setName]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)

  // M3 — clear form on mode toggle so a half-typed login doesn't leak into
  // the register tab (or vice versa).
  function switchMode(next: Mode) {
    setMode(next)
    setEmail('')
    setPassword('')
    setPhone('')
    setName('')
    setError(null)
    setSuccess(null)
    setPhoneError(null)
  }

  // H5 — inline phone validation, UX-only (server still validates).
  function onPhoneChange(value: string) {
    setPhone(value)
    if (mode !== 'register') {
      setPhoneError(null)
      return
    }
    if (value.trim() === '') {
      setPhoneError(null)
      return
    }
    const cleaned = value.replace(/[\s\-().]/g, '')
    setPhoneError(PHONE_PATTERN.test(cleaned) ? null : tAuth('phoneFormatInvalid'))
  }

  const strength: PasswordStrength | null =
    mode === 'register' ? scorePassword(password) : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      if (mode === 'login') {
        const result = await loginAction(email, password)
        if (!result.success) {
          setError(result.error === 'rate_limited'
            ? tAuth('rateLimited')
            : tAuth('invalidCredentials'))
          return
        }
        window.location.href = isAr ? '/account' : '/en/account'

      } else {
        const result = await registerAction(email, password, phone, name)
        if (!result.success) {
          setError(
            result.error === 'rate_limited'      ? tAuth('rateLimited') :
            result.error === 'invalid_phone'     ? tAuth('invalidPhone') :
            result.error === 'email_exists'      ? tAuth('emailExists') :
            result.error === 'password_too_short'? tAuth('passwordTooShort') :
            result.error === 'password_too_weak' ? tAuth('passwordTooWeak') :
            result.error === 'name_too_long'     ? tAuth('nameTooLong') :
                                                   tAuth('signupError')
          )
          return
        }
        setSuccess(isAr
          ? 'تم إنشاء حسابك. تحقق من بريدك الإلكتروني لتأكيد الحساب.'
          : 'Account created. Check your email to confirm your account.')
      }
    } catch {
      setError(tAuth('networkError'))
    } finally {
      setLoading(false)
    }
  }

  const strengthLabel =
    strength === 'weak'   ? tAuth('passwordStrengthWeak')   :
    strength === 'medium' ? tAuth('passwordStrengthMedium') :
    strength === 'strong' ? tAuth('passwordStrengthStrong') : ''

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-screen bg-brand-black flex items-center justify-center px-4 py-12"
    >
      <div className="w-full max-w-sm">
        <h1 className={`text-3xl font-black text-brand-text mb-2 text-center
          ${isAr ? 'font-cairo' : 'font-editorial'}`}>
          {mode === 'login'
            ? (isAr ? 'تسجيل الدخول' : 'Sign In')
            : (isAr ? 'إنشاء حساب' : 'Create Account')}
        </h1>
        <p className={`text-sm text-brand-muted text-center mb-8
          ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {isAr ? 'برنامج ولاء كهرمانة بغداد' : 'Kahramana Baghdad Loyalty Program'}
        </p>

        {/* Mode toggle */}
        <div className="flex rounded-xl bg-brand-surface-2 border border-brand-border p-1 mb-6">
          {(['login', 'register'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors duration-150
                ${isAr ? 'font-almarai' : 'font-satoshi'}
                ${mode === m
                  ? 'bg-brand-gold text-brand-black'
                  : 'text-brand-muted hover:text-brand-text'
                }`}
            >
              {m === 'login'
                ? (isAr ? 'دخول' : 'Sign In')
                : (isAr ? 'تسجيل' : 'Register')}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'register' && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="auth-name" className={`text-xs font-bold text-brand-muted ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
                {isAr ? 'الاسم (اختياري)' : 'Name (optional)'}
              </label>
              <input
                id="auth-name"
                type="text"
                aria-label={isAr ? 'الاسم (اختياري)' : 'Name (optional)'}
                placeholder={isAr ? 'الاسم (اختياري)' : 'Name (optional)'}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                maxLength={120}
                className="w-full bg-brand-surface-2 border border-brand-border rounded-xl
                           ps-4 pe-4 py-3 text-brand-text font-satoshi placeholder:text-brand-muted
                           focus:border-brand-gold focus:outline-none"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="auth-email" className={`text-xs font-bold text-brand-muted ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
              {isAr ? 'البريد الإلكتروني' : 'Email address'}
            </label>
            <input
              id="auth-email"
              type="email"
              aria-label={isAr ? 'البريد الإلكتروني' : 'Email address'}
              placeholder={isAr ? 'البريد الإلكتروني' : 'Email address'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              dir="ltr"
              autoComplete="email"
              className="w-full bg-brand-surface-2 border border-brand-border rounded-xl
                         ps-4 pe-4 py-3 text-brand-text font-satoshi placeholder:text-brand-muted
                         focus:border-brand-gold focus:outline-none"
            />
          </div>

          {mode === 'register' && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="auth-phone" className={`text-xs font-bold text-brand-muted ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
                {isAr ? 'رقم الهاتف' : 'Phone number'}
              </label>
              <input
                id="auth-phone"
                type="tel"
                aria-label={isAr ? 'رقم الهاتف' : 'Phone number'}
                placeholder={isAr ? 'رقم الهاتف (+973XXXXXXXX)' : 'Phone (+973XXXXXXXX)'}
                value={phone}
                onChange={(e) => onPhoneChange(e.target.value)}
                required
                dir="ltr"
                autoComplete="tel"
                className={`w-full bg-brand-surface-2 border rounded-xl
                           ps-4 pe-4 py-3 text-brand-text font-satoshi placeholder:text-brand-muted
                           focus:border-brand-gold focus:outline-none
                           ${phoneError ? 'border-brand-error' : 'border-brand-border'}`}
              />
              {phoneError && (
                <p className={`text-[11px] text-brand-error ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
                  {phoneError}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="auth-password" className={`text-xs font-bold text-brand-muted ${isAr ? 'font-almarai text-end' : 'font-satoshi text-start'}`}>
              {isAr ? 'كلمة المرور' : 'Password'}
            </label>
            <input
              id="auth-password"
              type="password"
              aria-label={isAr ? 'كلمة المرور' : 'Password'}
              placeholder={isAr ? 'كلمة المرور' : 'Password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              dir="ltr"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              className="w-full bg-brand-surface-2 border border-brand-border rounded-xl
                         ps-4 pe-4 py-3 text-brand-text font-satoshi placeholder:text-brand-muted
                         focus:border-brand-gold focus:outline-none"
            />
            {strength && (
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-brand-surface-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-200 ${
                      strength === 'weak'   ? 'w-1/3 bg-brand-error'   :
                      strength === 'medium' ? 'w-2/3 bg-brand-gold'    :
                                              'w-full bg-brand-success'
                    }`}
                  />
                </div>
                <span className={`text-[10px] font-bold tabular-nums shrink-0 ${
                  strength === 'weak'   ? 'text-brand-error'   :
                  strength === 'medium' ? 'text-brand-gold'    :
                                          'text-brand-success'
                } ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {strengthLabel}
                </span>
              </div>
            )}
          </div>

          <div role="alert" aria-live="polite" aria-atomic="true">
            {error && (
              <p className={`text-sm text-brand-error ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                {error}
              </p>
            )}
            {success && (
              <p className={`text-sm text-brand-success ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                {success}
              </p>
            )}
          </div>

          <CinematicButton type="submit" disabled={loading} isRTL={isAr} className="w-full py-3">
            {loading
              ? (isAr ? 'جاري...' : 'Please wait...')
              : mode === 'login'
                ? (isAr ? 'دخول' : 'Sign In')
                : (isAr ? 'إنشاء الحساب' : 'Create Account')}
          </CinematicButton>
        </form>

        <p className={`mt-6 text-xs text-brand-muted text-center ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {isAr
            ? 'هذا الحساب منفصل عن حساب الموظفين'
            : 'This account is separate from the staff login'}
        </p>
      </div>
    </div>
  )
}
