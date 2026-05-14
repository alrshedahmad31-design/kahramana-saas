'use client'

import { useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import CinematicButton from '@/components/ui/CinematicButton'
import { loginAction, registerAction } from './actions'

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

type Mode = 'login' | 'register'

export default function AccountLoginClient({ initialMode }: { initialMode?: Mode } = {}) {
  const locale = useLocale()
  const isAr   = locale === 'ar'
  const tAuth  = useTranslations('auth')

  const [mode,           setMode]           = useState<Mode>(initialMode ?? 'login')
  const [email,          setEmail]          = useState('')
  const [password,       setPassword]       = useState('')
  const [phone,          setPhone]          = useState('')
  const [name,           setName]           = useState('')
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [success,        setSuccess]        = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState('')
  const turnstileRef = useRef<TurnstileInstance | null>(null)

  function resetTurnstile() {
    turnstileRef.current?.reset()
    setTurnstileToken('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError(tAuth('captchaRequired'))
      return
    }

    setLoading(true)

    try {
      if (mode === 'login') {
        const result = await loginAction(email, password, turnstileToken)
        if (!result.success) {
          resetTurnstile()
          setError(
            result.error === 'rate_limited' ? tAuth('rateLimited') :
            result.error === 'captcha'      ? tAuth('captchaRequired') :
                                              tAuth('invalidCredentials'),
          )
          return
        }
        window.location.href = isAr ? '/account' : '/en/account'

      } else {
        const result = await registerAction(email, password, phone, name, turnstileToken)
        if (!result.success) {
          resetTurnstile()
          setError(
            result.error === 'rate_limited'  ? tAuth('rateLimited') :
            result.error === 'captcha'       ? tAuth('captchaRequired') :
            result.error === 'invalid_phone' ? tAuth('invalidPhone') :
                                               tAuth('signupError'),
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
              onClick={() => { setMode(m); setError(null) }}
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
            <input
              type="text"
              aria-label={isAr ? 'الاسم (اختياري)' : 'Name (optional)'}
              placeholder={isAr ? 'الاسم (اختياري)' : 'Name (optional)'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-brand-surface-2 border border-brand-border rounded-xl
                         ps-4 pe-4 py-3 text-brand-text font-satoshi placeholder:text-brand-muted
                         focus:border-brand-gold focus:outline-none"
            />
          )}

          <input
            type="email"
            aria-label={isAr ? 'البريد الإلكتروني' : 'Email address'}
            placeholder={isAr ? 'البريد الإلكتروني' : 'Email address'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            dir="ltr"
            className="w-full bg-brand-surface-2 border border-brand-border rounded-xl
                       ps-4 pe-4 py-3 text-brand-text font-satoshi placeholder:text-brand-muted
                       focus:border-brand-gold focus:outline-none"
          />

          {mode === 'register' && (
            <input
              type="tel"
              aria-label={isAr ? 'رقم الهاتف' : 'Phone number'}
              placeholder={isAr ? 'رقم الهاتف (+973XXXXXXXX)' : 'Phone (+973XXXXXXXX)'}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              dir="ltr"
              className="w-full bg-brand-surface-2 border border-brand-border rounded-xl
                         ps-4 pe-4 py-3 text-brand-text font-satoshi placeholder:text-brand-muted
                         focus:border-brand-gold focus:outline-none"
            />
          )}

          <input
            type="password"
            aria-label={isAr ? 'كلمة المرور' : 'Password'}
            placeholder={isAr ? 'كلمة المرور' : 'Password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            dir="ltr"
            className="w-full bg-brand-surface-2 border border-brand-border rounded-xl
                       ps-4 pe-4 py-3 text-brand-text font-satoshi placeholder:text-brand-muted
                       focus:border-brand-gold focus:outline-none"
          />

          {TURNSTILE_SITE_KEY && (
            <div className="flex justify-center">
              <Turnstile
                ref={turnstileRef}
                siteKey={TURNSTILE_SITE_KEY}
                onSuccess={(token) => {
                  setTurnstileToken(token)
                  if (error === tAuth('captchaRequired')) setError(null)
                }}
                onError={() => setTurnstileToken('')}
                onExpire={() => setTurnstileToken('')}
                options={{ theme: 'dark', language: isAr ? 'ar' : 'en' }}
              />
            </div>
          )}

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
