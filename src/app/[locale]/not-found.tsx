'use client'

import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import CinematicButton from '@/components/ui/CinematicButton'

export default function NotFound() {
  const locale = useLocale()
  const isAr   = locale === 'ar'
  const t      = useTranslations('errors')

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-[70vh] flex flex-col items-center justify-center
                 px-4 sm:px-6 text-center"
    >
      {/* 404 number */}
      <p className="font-satoshi font-black text-[120px] sm:text-[160px] leading-none
                   text-brand-gold/20 tabular-nums select-none">
        404
      </p>

      <h1 className={`text-2xl sm:text-3xl font-black text-brand-text -mt-6 mb-3
        ${isAr ? 'font-cairo' : 'font-editorial'}`}>
        {t('notFound')}
      </h1>

      <p className="font-almarai text-brand-muted mb-8 max-w-sm">
        {t('notFoundHint')}
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <CinematicButton
          href="/menu"
          isRTL={isAr}
          className="px-8 py-3.5 text-base font-bold rounded-lg"
        >
          {isAr ? 'تصفح المنيو' : 'Browse Menu'}
        </CinematicButton>
        <Link
          href="/ar"
          aria-label={t('goHome')}
          className="inline-flex items-center justify-center rounded-lg border border-white/10 px-8 py-3.5 text-base font-bold text-brand-text backdrop-blur-md transition-all hover:scale-105 hover:bg-white/5 active:scale-95"
        >
          {t('goHome')}
        </Link>
      </div>
    </div>
  )
}
