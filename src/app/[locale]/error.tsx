'use client'

import { useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorBoundary({ error, reset }: Props) {
  const locale = useLocale()
  const isAr   = locale === 'ar'
  const t      = useTranslations('errors')

  useEffect(() => {
    // Log to Sentry in Phase 1+
    console.error('[ErrorBoundary]', error)
  }, [error])

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-[70vh] flex flex-col items-center justify-center
                 px-4 sm:px-6 text-center"
    >
      {/* Error icon */}
      <div className="w-16 h-16 rounded-xl bg-brand-error/10 border border-brand-error/30
                      flex items-center justify-center mb-6">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
             width={28} height={28} aria-hidden="true" className="text-brand-error">
          <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>

      <h1 className={`text-2xl font-black text-brand-text mb-2
        ${isAr ? 'font-cairo' : 'font-editorial'}`}>
        {t('generic')}
      </h1>

      <p className="font-almarai text-brand-muted mb-8 max-w-sm">
        {t('tryAgain')}
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center
                     bg-brand-gold text-brand-black
                     font-satoshi font-medium text-base
                     ps-8 pe-8 py-3.5 rounded-lg
                     hover:bg-brand-gold-light active:bg-brand-gold-dark
                     transition-colors duration-150"
        >
          {t('retry')}
        </button>
        <Link
          href="/"
          className="inline-flex items-center justify-center
                     border border-brand-border text-brand-muted
                     font-satoshi font-medium text-base
                     ps-8 pe-8 py-3.5 rounded-lg
                     hover:border-brand-gold hover:text-brand-gold
                     transition-colors duration-150"
        >
          {t('goHome')}
        </Link>
      </div>

      {process.env.NODE_ENV === 'development' && error.digest && (
        <p className="mt-6 font-satoshi text-xs text-brand-muted/50 tabular-nums">
          {error.digest}
        </p>
      )}
    </div>
  )
}
