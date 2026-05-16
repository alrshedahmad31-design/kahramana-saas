'use client'

import { useRef, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import CinematicButton from '@/components/ui/CinematicButton'
import Link from 'next/link'
import { forgotPasswordAction } from '@/app/[locale]/forgot-password/actions'

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

export default function ForgotPasswordForm() {
  const t      = useTranslations('auth.forgotPassword')
  const authT  = useTranslations('auth')
  const locale = useLocale()
  const isAr   = locale === 'ar'
  const font   = isAr ? 'font-almarai' : 'font-satoshi'

  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const turnstileRef = useRef<TurnstileInstance | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError(authT('captchaRequired'))
      return
    }

    setLoading(true)
    const result = await forgotPasswordAction(email, turnstileToken)
    setLoading(false)

    if (!result.success) {
      turnstileRef.current?.reset()
      setTurnstileToken('')
      if (result.error === 'rate_limited')   setError(authT('rateLimited'))
      else if (result.error === 'captcha')   setError(authT('captchaRequired'))
      else                                    setError(t('error'))
      return
    }

    setSuccess(true)
  }

  if (success) {
    return (
      <div className="text-center space-y-4" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-brand-gold/10 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-brand-gold"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
        </div>
        <h2 className={`${font} text-xl font-bold text-brand-text`}>
          {t('successTitle')}
        </h2>
        <p className={`${font} text-sm text-brand-muted leading-relaxed`}>
          {t('successMessage')}
        </p>
        <div className="pt-4">
          <Link
            href={`/${locale}/login`}
            className={`${font} text-brand-gold hover:text-brand-gold/80 font-medium transition-colors`}
          >
            {t('backToLogin')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      dir={isAr ? 'rtl' : 'ltr'}
      className="w-full max-w-sm mx-auto flex flex-col gap-5"
      noValidate
    >
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className={`${font} text-sm font-medium text-brand-text`}
        >
          {authT('email')}
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={authT('emailPlaceholder')}
          className={`min-h-[48px] w-full rounded-lg border border-brand-border
                     bg-brand-surface px-4 py-3
                     ${font} text-base text-brand-text
                     placeholder:text-brand-muted/50
                     focus:outline-none focus:ring-2 focus:ring-brand-gold/50
                     focus:border-brand-gold transition-colors duration-150
                     disabled:opacity-50`}
          disabled={loading}
        />
      </div>

      {TURNSTILE_SITE_KEY && (
        <div className="flex justify-center">
          <Turnstile
            ref={turnstileRef}
            siteKey={TURNSTILE_SITE_KEY}
            onSuccess={(token) => {
              setTurnstileToken(token)
              if (error === authT('captchaRequired')) setError(null)
            }}
            onError={() => setTurnstileToken('')}
            onExpire={() => setTurnstileToken('')}
            options={{ theme: 'dark', language: isAr ? 'ar' : 'en' }}
          />
        </div>
      )}

      {error && (
        <p
          role="alert"
          className={`rounded-lg bg-brand-error/10 border border-brand-error/30
                     px-4 py-3 ${font} text-sm text-brand-error`}
        >
          {error}
        </p>
      )}

      <CinematicButton
        type="submit"
        disabled={loading || !email}
        isRTL={isAr}
        className="w-full py-4 font-bold rounded-2xl"
      >
        {loading ? t('submitting') : t('submit')}
      </CinematicButton>

      <div className="text-center mt-2">
        <Link
          href={`/${locale}/login`}
          className={`${font} text-sm text-brand-muted hover:text-brand-text transition-colors`}
        >
          {t('backToLogin')}
        </Link>
      </div>
    </form>
  )
}
