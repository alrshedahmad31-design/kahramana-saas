import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { CATERING_REQUEST_STYLES } from '@/lib/catering'
import SectionHeader from '@/components/ui/SectionHeader'

const packageImages = {
  familyOrder: '/assets/catering/style-family-new.png',
  corporateHospitality: '/assets/catering/style-corporate-new.png',
  iraqiFeast: '/assets/catering/style-banquet-new.png',
} as const

export default function CateringPackages() {
  const t = useTranslations('catering.styles')
  const locale = useLocale()
  const isAr = locale === 'ar'

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
      <SectionHeader 
        title={t('title')}
        subtitle={t('eyebrow')}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {CATERING_REQUEST_STYLES.map((style, index) => (
          <article 
            key={style} 
            className="group relative overflow-hidden rounded-2xl border border-brand-border bg-brand-surface/40 backdrop-blur-sm transition-all duration-300 hover:border-brand-gold/40 shadow-xl"
          >
            {/* Background Image */}
            <div className="absolute inset-0 z-0 opacity-20 transition-opacity duration-500 group-hover:opacity-30">
              <Image
                src={packageImages[style as keyof typeof packageImages]}
                alt={t(`items.${style}.title`)}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-110"
                sizes="(max-width: 768px) 100vw, 30vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-brand-black/90 to-transparent" />
            </div>

            <div className="relative z-10 p-8">
              <div className="absolute -top-6 -end-6 h-24 w-24 rounded-full bg-brand-gold/5 blur-2xl transition-all duration-500 group-hover:bg-brand-gold/10" />
              
              <span className="font-satoshi text-6xl font-light text-brand-gold/20 transition-colors duration-300 group-hover:text-brand-gold/30">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className={`mt-8 text-2xl font-black text-brand-text ${isAr ? 'font-cairo' : 'font-editorial'}`}>
                {t(`items.${style}.title`)}
              </h3>
              <p className={`mt-4 min-h-24 text-[15px] leading-8 text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                {t(`items.${style}.description`)}
              </p>
              <a
                href="#catering-inquiry"
                aria-label={t(`items.${style}.cta`)}
                className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-brand-gold/30 bg-brand-black/20 px-6 py-3 text-sm font-bold text-brand-gold transition-all duration-200 hover:bg-brand-gold hover:text-brand-black hover:border-brand-gold"
              >
                {t(`items.${style}.cta`)}
              </a>
            </div>
          </article>
        ))}
      </div>

      <div className={`mt-6 rounded-2xl border border-brand-gold/25 bg-brand-gold/10 px-5 py-4 text-sm leading-7 text-brand-gold-light ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
        {t('note')}
      </div>
    </section>
  )
}
