'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/client'
import CinematicButton from '@/components/ui/CinematicButton'

export default function ForgotPasswordPage() {
  const t    = useTranslations('auth.forgotPassword')
  const tA   = useTranslations('auth')
  const locale = useLocale()
  const isAr = locale === 'ar'

  const [email,     setEmail]     = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase  = createClient()
    const redirectTo = `${window.location.origin}/auth/callback?type=recovery`

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo },
    )

    setLoading(false)

    if (resetError) {
      setError(t('error'))
      return
    }

    setSubmitted(true)
  }

  const inputClass = `min-h-[48px] w-full rounded-lg border border-brand-border
    bg-brand-surface px-4 py-3
    font-satoshi text-base text-brand-text
    placeholder:text-brand-muted/50
    focus:outline-none focus:ring-2 focus:ring-brand-gold/50
    focus:border-brand-gold transition-colors duration-150
    disabled:opacity-50`

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-cairo text-2xl font-black text-brand-gold mb-1">
            {'كهرمانة بغداد'}
          </p>
          <p className="font-satoshi text-sm text-brand-muted">
            {tA('staffOnly')}
          </p>
        </div>

        <div className="bg-brand-surface border border-brand-border rounded-xl p-6 sm:p-8">
          {submitted ? (
            <div className="text-center flex flex-col gap-4">
              <div className="w-12 h-12 rounded-full bg-brand-success/10 border border-brand-success/30 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-brand-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className={`text-brand-text font-bold text-lg ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                {t('successTitle')}
              </h2>
              <p className={`text-brand-muted text-sm ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                {t('successMessage')}
              </p>
              <Link
                href="/login"
                className={`text-brand-gold text-sm hover:underline mt-2 ${isAr ? 'font-almarai' : 'font-satoshi'}`}
              >
                {t('backToLogin')}
              </Link>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              dir={isAr ? 'rtl' : 'ltr'}
              className="flex flex-col gap-5"
              noValidate
            >
              <div className="text-center mb-1">
                <h1 className={`text-brand-text font-bold text-xl mb-1 ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                  {t('title')}
                </h1>
                <p className={`text-brand-muted text-sm ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {t('description')}
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="font-almarai text-sm font-medium text-brand-text">
                  {tA('email')}
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={tA('emailPlaceholder')}
                  className={inputClass}
                  disabled={loading}
                />
              </div>

              {error && (
                <p role="alert" className="rounded-lg bg-brand-error/10 border border-brand-error/30 px-4 py-3 font-satoshi text-sm text-brand-error">
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

              <Link
                href="/login"
                className={`text-center text-brand-muted text-sm hover:text-brand-gold transition-colors ${isAr ? 'font-almarai' : 'font-satoshi'}`}
              >
                {t('backToLogin')}
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
