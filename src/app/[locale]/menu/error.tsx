'use client'

import { useTranslations } from 'next-intl'

export default function MenuError({ reset }: { reset: () => void }) {
  const t = useTranslations('errors')

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-black ps-4 pe-4 pt-20 pb-20">
      <div className="max-w-md rounded-lg border border-brand-border bg-brand-surface ps-6 pe-6 pt-6 pb-6 text-center">
        <h1 className="font-cairo text-2xl font-black text-brand-text">{t('generic')}</h1>
        <p className="mt-2 font-almarai text-sm leading-6 text-brand-muted">{t('tryAgain')}</p>
        <button
          type="button"
          onClick={reset}
          aria-label={t('retry')}
          className="mt-5 min-h-11 rounded-lg bg-brand-gold ps-5 pe-5 font-almarai text-sm font-bold text-brand-black"
        >
          {t('retry')}
        </button>
      </div>
    </main>
  )
}
