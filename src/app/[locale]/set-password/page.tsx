'use client'

import { useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/client'
import CinematicButton from '@/components/ui/CinematicButton'

export default function SetPasswordPage() {
  const t      = useTranslations('auth.setPassword')
  const tA     = useTranslations('auth')
  const locale = useLocale()
  const isAr   = locale === 'ar'
  const router = useRouter()

  const [password,        setPassword]        = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState<string | null>(null)
  const [hasSession,      setHasSession]      = useState<boolean | null>(null)

  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => {
      setHasSession(!!data.session)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError(t('tooShort'))
      return
    }
    if (password !== confirmPassword) {
      setError(t('mismatch'))
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(t('error'))
      return
    }

    await supabase.auth.signOut()
    router.push('/login')
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
          {hasSession === false ? (
            <div className="text-center flex flex-col gap-4">
              <p className={`text-brand-error text-sm ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                {t('sessionExpired')}
              </p>
              <a
                href={locale === 'en' ? '/en/forgot-password' : '/forgot-password'}
                className="text-brand-gold text-sm hover:underline font-satoshi"
              >
                {tA('forgotPassword.submit')}
              </a>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              dir={isAr ? 'rtl' : 'ltr'}
              className="flex flex-col gap-5"
              noValidate
            >
              <div className="text-center mb-1">
                <h1 className={`text-brand-text font-bold text-xl ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                  {t('title')}
                </h1>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="new-password" className="font-almarai text-sm font-medium text-brand-text">
                  {t('newPassword')}
                </label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('newPasswordPlaceholder')}
                  className={inputClass}
                  disabled={loading}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="confirm-password" className="font-almarai text-sm font-medium text-brand-text">
                  {t('confirmPassword')}
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('confirmPasswordPlaceholder')}
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
                disabled={loading || !password || !confirmPassword}
                isRTL={isAr}
                className="w-full py-4 font-bold rounded-full"
              >
                {loading ? t('submitting') : t('submit')}
              </CinematicButton>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
