'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { staffLoginAction } from '@/app/[locale]/login/actions'
import CinematicButton from '@/components/ui/CinematicButton'
import Link from 'next/link'

// Open-redirect guard: only honor ?redirect=... when it's a same-origin
// relative path. Reject protocol-relative ("//evil.com"), absolute URLs, and
// anything that doesn't start with a single "/".
function sanitizeRedirect(raw: string | null): string | null {
  if (!raw) return null
  if (!raw.startsWith('/') || raw.startsWith('//')) return null
  return raw
}

export default function LoginForm() {
  const t            = useTranslations('auth')
  const locale       = useLocale()
  const isAr         = locale === 'ar'
  const router       = useRouter()
  const searchParams = useSearchParams()
  const font         = isAr ? 'font-almarai' : 'font-satoshi'

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // T1-4: auth runs through a server action so we can apply per-IP
    // rate-limiting + Zod validation away from a direct-to-Supabase path.
    const result = await staffLoginAction(email, password)
    if (!result.success) {
      setError(
        result.error === 'rate_limited' ? t('rateLimited') :
        result.error === 'network'      ? t('networkError') :
                                           t('loginError'),
      )
      setLoading(false)
      return
    }

    // Honor ?redirect=... when it's a safe same-origin path (set by
    // middleware when bouncing unauthenticated requests off a gated route,
    // e.g. /login?redirect=/driver). Otherwise default to /dashboard — the
    // middleware will then forward drivers to /driver on its own.
    const safeRedirect = sanitizeRedirect(searchParams.get('redirect'))
    const dashboardPath = locale === 'en' ? '/en/dashboard' : '/dashboard'
    router.push(safeRedirect ?? dashboardPath)
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
          className={`${font} text-sm font-medium text-brand-text`}
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

      {/* Password */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center">
          <label
            htmlFor="password"
            className={`${font} text-sm font-medium text-brand-text`}
          >
            {t('password')}
          </label>
          <Link
            href={`/${locale}/forgot-password`}
            className={`${font} text-xs text-brand-gold hover:text-brand-gold/80 transition-colors`}
          >
            {t('forgotPassword.title')}
          </Link>
        </div>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('passwordPlaceholder')}
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

      {/* Error */}
      {error && (
        <p
          role="alert"
          className={`rounded-lg bg-brand-error/10 border border-brand-error/30
                     px-4 py-3 ${font} text-sm text-brand-error`}
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
