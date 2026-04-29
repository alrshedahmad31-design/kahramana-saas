'use client'

import { useEffect } from 'react'
import { useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function CheckoutError({ error, reset }: Props) {
  const isAr = useLocale() === 'ar'

  useEffect(() => {
    console.error('[CheckoutError]', error)
  }, [error])

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center"
    >
      <p className="text-brand-error font-bold text-lg">
        {isAr ? 'حدث خطأ أثناء إتمام الطلب' : 'Something went wrong during checkout'}
      </p>
      <p className="text-brand-muted text-sm max-w-xs">
        {isAr
          ? 'لم يتم إرسال طلبك. يرجى المحاولة مرة أخرى أو العودة إلى السلة.'
          : 'Your order was not placed. Please try again or go back to your cart.'}
      </p>
      <div className="flex gap-3 mt-2">
        <button
          type="button"
          onClick={reset}
          className="bg-brand-gold text-brand-black font-bold text-sm ps-6 pe-6 py-2.5 rounded-lg hover:bg-brand-gold-light transition-colors"
        >
          {isAr ? 'إعادة المحاولة' : 'Try again'}
        </button>
        <Link
          href="/menu"
          className="border border-brand-border text-brand-muted font-bold text-sm ps-6 pe-6 py-2.5 rounded-lg hover:border-brand-gold hover:text-brand-gold transition-colors"
        >
          {isAr ? 'العودة للمنيو' : 'Back to menu'}
        </Link>
      </div>
      {process.env.NODE_ENV === 'development' && error.digest && (
        <p className="text-xs text-brand-muted/50 tabular-nums">{error.digest}</p>
      )}
    </div>
  )
}
