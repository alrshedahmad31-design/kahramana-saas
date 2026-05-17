'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import * as Sentry from '@sentry/nextjs'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('errors')

  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <p className="text-brand-muted text-sm">{t('generic')}</p>
      <button
        onClick={reset}
        className="px-4 py-2 text-xs font-bold text-brand-black bg-brand-gold rounded-full"
      >
        {t('retry')}
      </button>
    </div>
  )
}
