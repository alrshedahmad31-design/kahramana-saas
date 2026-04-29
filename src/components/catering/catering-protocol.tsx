import { useLocale, useTranslations } from 'next-intl'
import { CATERING_PROTOCOL_STEPS } from '@/lib/catering'
import CateringIcon from '@/components/catering/catering-icon'

const stepIcons = ['request', 'review', 'confirm', 'prepare'] as const

export default function CateringProtocol() {
  const t = useTranslations('catering.protocol')
  const locale = useLocale()
  const isAr = locale === 'ar'

  return (
    <section className="bg-brand-surface/45 py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-[0.82fr_1.18fr] gap-10 lg:gap-16">
          <div className="text-start">
            <p className="text-xs font-satoshi font-bold tracking-[0.3em] uppercase text-brand-gold">
              {t('eyebrow')}
            </p>
            <h2 className={`mt-3 text-3xl sm:text-5xl font-black text-brand-text ${isAr ? 'font-cairo' : 'font-editorial'}`}>
              {t('title')}
            </h2>
            <p className={`mt-5 text-sm leading-7 text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {t('description')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CATERING_PROTOCOL_STEPS.map((step, index) => (
              <article key={step} className="rounded-2xl border border-white/10 bg-brand-black/50 p-6">
                <div className="flex items-center justify-between gap-4 text-brand-gold">
                  <CateringIcon name={stepIcons[index]} className="h-6 w-6" />
                  <span className="font-satoshi text-5xl font-light text-brand-gold/35">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className={`mt-6 text-lg font-black text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                  {t(`steps.${step}.title`)}
                </h3>
                <p className={`mt-3 text-sm leading-7 text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {t(`steps.${step}.description`)}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
