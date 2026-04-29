'use client'

import { useEffect } from 'react'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AnalyticsError({ error, reset }: Props) {
  useEffect(() => {
    console.error('Analytics error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center px-4">
      <p className="font-satoshi text-brand-error text-sm">{error.message}</p>
      <button
        onClick={reset}
        className="font-satoshi text-sm text-brand-gold hover:text-brand-gold-light transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
