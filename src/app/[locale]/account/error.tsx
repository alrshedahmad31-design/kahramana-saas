'use client'

import { useEffect } from 'react'
import { useLocale } from 'next-intl'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AccountError({ error, reset }: Props) {
  const isAr = useLocale() === 'ar'

  useEffect(() => {
    console.error('[AccountError]', error)
  }, [error])

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center"
    >
      <p className="text-brand-error font-bold text-lg">
        {isAr ? 'تعذّر تحميل الحساب' : 'Could not load account'}
      </p>
      <p className="text-brand-muted text-sm max-w-xs">
        {isAr ? 'يرجى المحاولة مرة أخرى.' : 'Please try again.'}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 bg-brand-gold text-brand-black font-bold text-sm ps-6 pe-6 py-2.5 rounded-lg hover:bg-brand-gold-light transition-colors"
      >
        {isAr ? 'إعادة المحاولة' : 'Try again'}
      </button>
      {process.env.NODE_ENV === 'development' && error.digest && (
        <p className="text-xs text-brand-muted/50 tabular-nums">{error.digest}</p>
      )}
    </div>
  )
}
