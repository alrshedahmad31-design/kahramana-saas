'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import CinematicButton from '@/components/ui/CinematicButton'
import { toast } from '@/lib/toast'

export default function SetPasswordForm() {
  const t      = useTranslations('auth.setPassword')
  const authT  = useTranslations('auth')
  const locale = useLocale()
  const isAr   = locale === 'ar'
  const router = useRouter()
  const font   = isAr ? 'font-almarai' : 'font-satoshi'

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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
  }, [supabase])

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

    const { error: authError } = await supabase.auth.updateUser({
      password: password,
    })

    if (authError) {
      setError(authError.message.includes('rate limit') ? authT('rateLimited') : t('error'))
      setLoading(false)
      return
    }

    toast.success(t('success'))
    
    // Give the user a moment to see the success state before redirecting
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
        disabled={loading || !password || !confirmPassword}
        isRTL={isAr}
        className="w-full py-4 font-bold rounded-2xl"
      >
        {loading ? t('submitting') : t('submit')}
      </CinematicButton>
    </form>
  )
}
