import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { CATERING_EVENT_TYPES } from '@/lib/catering'
import CateringIcon from '@/components/catering/catering-icon'
import SectionHeader from '@/components/ui/SectionHeader'

const iconNames = ['dining', 'briefcase', 'home', 'spark'] as const

const eventImages = {
  familyFeasts: '/assets/catering/family-feasts.webp',
  businessMeetings: '/assets/catering/business-meetings.webp',
  majlis: '/assets/catering/majlis.webp',
  privateOccasions: '/assets/catering/special-occasions.webp',
} as const

export default function EventTypes() {
  const t = useTranslations('catering.eventTypes')
  const locale = useLocale()
  const isAr = locale === 'ar'

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
      <SectionHeader 
        title={t('title')}
        subtitle={t('eyebrow')}
        align="start"
      />

      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {CATERING_EVENT_TYPES.map((item, index) => (
          <article
            key={item}
            className="group relative overflow-hidden rounded-2xl border border-brand-border bg-brand-surface/70 transition-all duration-300 hover:border-brand-gold/60"
          >
            {/* Background Image */}
            <div className="absolute inset-0 z-0">
              <Image
                src={eventImages[item as keyof typeof eventImages]}
                alt={t(`items.${item}.title`)}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-110"
                sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-brand-black/80 to-brand-black/40" />
            </div>

            <div className="relative z-10 flex flex-col h-full p-6">
              <div className="flex items-center justify-between gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-brand-gold/30 bg-brand-black/40 backdrop-blur-sm text-brand-gold transition-colors duration-300 group-hover:border-brand-gold group-hover:bg-brand-gold group-hover:text-brand-black">
                  <CateringIcon name={iconNames[index]} />
                </span>
                <span className="font-satoshi text-4xl font-light text-brand-gold/30 transition-colors duration-300 group-hover:text-brand-gold/50">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>
              <div className="mt-auto pt-16">
                <h3 className={`text-xl font-black text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                  {t(`items.${item}.title`)}
                </h3>
                <p className={`mt-3 text-sm leading-7 text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {t(`items.${item}.description`)}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
