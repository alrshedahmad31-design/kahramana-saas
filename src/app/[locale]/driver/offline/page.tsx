import { getTranslations } from 'next-intl/server'

interface Props { params: Promise<{ locale: string }> }

export default async function DriverOfflinePage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations('driver')
  const isAr = locale === 'ar'

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-[100dvh] bg-brand-black flex flex-col items-center
                 justify-center gap-4 p-8 text-center"
    >
      <div className="w-16 h-16 rounded-xl bg-brand-surface-2 border border-brand-border
                      flex items-center justify-center">
        <svg width={32} height={32} viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth={1.5} className="text-brand-error" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <p className="font-satoshi font-black text-xl text-brand-text">{t('offline')}</p>
      <p className="font-almarai text-sm text-brand-muted">{t('offlineHint')}</p>
    </div>
  )
}
