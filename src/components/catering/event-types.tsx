import { useLocale, useTranslations } from 'next-intl'
import { CATERING_EVENT_TYPES } from '@/lib/catering'
import CateringIcon from '@/components/catering/catering-icon'

const iconNames = ['dining', 'briefcase', 'home', 'spark'] as const

export default function EventTypes() {
  const t = useTranslations('catering.eventTypes')
  const locale = useLocale()
  const isAr = locale === 'ar'

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
      <div className="flex flex-col gap-3 text-start">
        <p className="text-xs font-satoshi font-bold tracking-[0.3em] uppercase text-brand-gold">
          {t('eyebrow')}
        </p>
        <h2 className={`text-3xl sm:text-5xl font-black text-brand-text ${isAr ? 'font-cairo' : 'font-editorial'}`}>
          {t('title')}
        </h2>
      </div>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {CATERING_EVENT_TYPES.map((item, index) => (
          <article
            key={item}
            className="group rounded-2xl border border-brand-border bg-brand-surface/70 p-6 transition-colors duration-200 hover:border-brand-gold/60"
          >
            <div className="flex items-center justify-between gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-brand-gold/30 text-brand-gold">
                <CateringIcon name={iconNames[index]} />
              </span>
              <span className="font-satoshi text-4xl font-light text-brand-gold/30">
                {String(index + 1).padStart(2, '0')}
              </span>
            </div>
            <h3 className={`mt-6 text-xl font-black text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
              {t(`items.${item}.title`)}
            </h3>
            <p className={`mt-3 text-sm leading-7 text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {t(`items.${item}.description`)}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}
