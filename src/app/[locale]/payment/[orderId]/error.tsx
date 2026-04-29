'use client'

import { useTranslations } from 'next-intl'

interface Props {
  error: Error
  reset: () => void
}

export default function PaymentError({ error, reset }: Props) {
  const tCommon = useTranslations('common')

  return (
    <div className="min-h-screen bg-brand-black flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        <p className="text-brand-error font-satoshi text-sm mb-4">
          {error.message || tCommon('error')}
        </p>
        <button
          type="button"
          onClick={reset}
          className="text-brand-gold font-satoshi text-sm hover:underline"
        >
          {tCommon('retry')}
        </button>
      </div>
    </div>
  )
}
