'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import CinematicButton from '@/components/ui/CinematicButton'

export default function LoginForm() {
  const t      = useTranslations('auth')
  const locale = useLocale()
  const isAr   = locale === 'ar'
  const router = useRouter()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (authError) {
      const isNetwork = authError.message?.toLowerCase().includes('fetch') ||
                        authError.message?.toLowerCase().includes('network')
      setError(isNetwork ? t('networkError') : t('loginError'))
      setLoading(false)
      return
    }

    const dashboardPath = locale === 'en' ? '/en/dashboard' : '/dashboard'
    router.push(dashboardPath)
    router.refresh()
  }

  return (
    <form
      onSubmit={handleSubmit}
      dir={isAr ? 'rtl' : 'ltr'}
      className="w-full max-w-sm mx-auto flex flex-col gap-5"
      noValidate
    >
      {/* Email */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="font-almarai text-sm font-medium text-brand-text"
        >
          {t('email')}
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('emailPlaceholder')}
          className="min-h-[48px] w-full rounded-lg border border-brand-border
                     bg-brand-surface px-4 py-3
                     font-satoshi text-base text-brand-text
                     placeholder:text-brand-muted/50
                     focus:outline-none focus:ring-2 focus:ring-brand-gold/50
                     focus:border-brand-gold transition-colors duration-150
                     disabled:opacity-50"
          disabled={loading}
        />
      </div>

      {/* Password */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="password"
          className="font-almarai text-sm font-medium text-brand-text"
        >
          {t('password')}
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('passwordPlaceholder')}
          className="min-h-[48px] w-full rounded-lg border border-brand-border
                     bg-brand-surface px-4 py-3
                     font-satoshi text-base text-brand-text
                     placeholder:text-brand-muted/50
                     focus:outline-none focus:ring-2 focus:ring-brand-gold/50
                     focus:border-brand-gold transition-colors duration-150
                     disabled:opacity-50"
          disabled={loading}
        />
      </div>

      {/* Error */}
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-brand-error/10 border border-brand-error/30
                     px-4 py-3 font-satoshi text-sm text-brand-error"
        >
          {error}
        </p>
      )}

      {/* Submit */}
      <CinematicButton
        type="submit"
        disabled={loading || !email || !password}
        isRTL={isAr}
        className="w-full py-4 font-bold rounded-2xl"
      >
        {loading ? t('signingIn') : t('login')}
      </CinematicButton>
    </form>
  )
}
