'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import CinematicButton from '@/components/ui/CinematicButton'
import { toast } from '@/lib/toast'
import { setPasswordAction } from '@/app/[locale]/set-password/actions'

type Props = { isRecovery: boolean }

export default function SetPasswordForm({ isRecovery }: Props) {
  const t      = useTranslations('auth.setPassword')
  const authT  = useTranslations('auth')
  const locale = useLocale()
  const isAr   = locale === 'ar'
  const router = useRouter()
  const font   = isAr ? 'font-almarai' : 'font-satoshi'

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError(t('sessionExpired'))
      }
      setCheckingSession(false)
    }
    checkSession()
  }, [supabase, t])

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

    if (!isRecovery && !currentPassword) {
      setError(authT('reauthFailed'))
      return
    }

    setLoading(true)

    const result = await setPasswordAction(password, isRecovery ? undefined : currentPassword)

    if (!result.success) {
      setLoading(false)
      if (result.error === 'reauth_required' || result.error === 'reauth_failed') {
        setError(authT('reauthFailed'))
      } else if (result.error === 'too_short') {
        setError(t('tooShort'))
      } else if (result.error === 'no_session') {
        setError(t('sessionExpired'))
      } else {
        setError(t('error'))
      }
      return
    }

    toast.success(t('success'))

    // Sign out of the now-rotated session and bounce to login so the user
    // (or attacker) has to authenticate fresh with the new credential.
    await supabase.auth.signOut()
    setTimeout(() => {
      router.push(`/${locale}/login`)
    }, 2000)
  }

  if (checkingSession) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-8 h-8 border-4 border-brand-gold border-t-transparent rounded-full animate-spin"></div>
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
      {/* Current password — only when this isn't a recovery-link landing.
          Forces normal logged-in users to re-prove their identity before
          rotating the credential (VULN-AUTH-06). */}
      {!isRecovery && (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="currentPassword"
            className={`${font} text-sm font-medium text-brand-text`}
          >
            {authT('currentPassword')}
          </label>
          <input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder={authT('currentPasswordPlaceholder')}
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
      )}

      {/* New Password */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className={`${font} text-sm font-medium text-brand-text`}
        >
          {t('newPassword')}
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('newPasswordPlaceholder')}
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

      {/* Confirm Password */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="confirmPassword"
          className={`${font} text-sm font-medium text-brand-text`}
        >
          {t('confirmPassword')}
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder={t('confirmPasswordPlaceholder')}
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
        disabled={loading || !password || !confirmPassword || (!isRecovery && !currentPassword)}
        isRTL={isAr}
        className="w-full py-4 font-bold rounded-2xl"
      >
        {loading ? t('submitting') : t('submit')}
      </CinematicButton>
    </form>
  )
}
