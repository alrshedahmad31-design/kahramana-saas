import { useLocale, useTranslations } from 'next-intl'
import CateringIcon from '@/components/catering/catering-icon'

export default function FinalCta() {
  const t = useTranslations('catering.finalCta')
  const locale = useLocale()
  const isAr = locale === 'ar'

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-24">
      <div className="relative overflow-hidden rounded-[2rem] border border-brand-gold/25 bg-brand-surface px-5 py-12 sm:px-10 lg:px-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(209,159,81,0.16),transparent_42%)]" />
        <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 lg:items-center">
          <div className="text-start">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-brand-gold/30 text-brand-gold">
              <CateringIcon name="message" className="h-6 w-6" />
            </span>
            <h2 className={`section-title ${isAr ? 'font-cairo' : 'font-editorial'}`}>
              {t('title')}
            </h2>
            <p className={`mt-4 max-w-2xl text-sm sm:text-base leading-8 text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {t('description')}
            </p>
          </div>
          <a
            href="#catering-inquiry"
            aria-label={t('cta')}
            className="inline-flex min-h-12 items-center justify-center rounded-lg bg-brand-gold px-7 py-3 text-sm font-bold text-brand-black transition-transform duration-200 hover:scale-[1.02]"
          >
            {t('cta')}
          </a>
        </div>
      </div>
    </section>
  )
}
