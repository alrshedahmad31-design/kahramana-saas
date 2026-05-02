import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { CATERING_PROTOCOL_STEPS } from '@/lib/catering'
import CateringIcon from '@/components/catering/catering-icon'
import SectionHeader from '@/components/ui/SectionHeader'

const stepIcons = ['request', 'review', 'confirm', 'prepare'] as const

const stepImages = {
  request: '/assets/catering/step-request.webp',
  review: '/assets/catering/step-review.webp',
  confirmation: '/assets/catering/step-confirmation.webp',
  preparation: '/assets/catering/step-preparation.webp',
} as const

export default function CateringProtocol() {
  const t = useTranslations('catering.protocol')
  const locale = useLocale()
  const isAr = locale === 'ar'

  return (
    <section className="bg-brand-surface/45 py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <SectionHeader 
          title={t('title')}
          subtitle={t('eyebrow')}
        />

        <p className={`mx-auto mb-12 max-w-3xl text-center text-sm leading-7 text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
          {t('description')}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CATERING_PROTOCOL_STEPS.map((step, index) => (
            <article key={step} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-brand-black/50 transition-all duration-300 hover:border-brand-gold/40">
              {/* Background Image */}
              <div className="absolute inset-0 z-0 opacity-40 transition-opacity duration-500 group-hover:opacity-60">
                <Image
                  src={stepImages[step as keyof typeof stepImages]}
                  alt={t(`steps.${step}.title`)}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                  sizes="(max-width: 768px) 100vw, 25vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-brand-black/80 to-transparent" />
              </div>

              <div className="relative z-10 p-6">
                <div className="flex items-center justify-between gap-4 text-brand-gold">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-brand-gold/30 bg-brand-black/40 backdrop-blur-sm transition-colors duration-300 group-hover:bg-brand-gold group-hover:text-brand-black">
                    <CateringIcon name={stepIcons[index]} className="h-5 w-5" />
                  </span>
                  <span className="font-satoshi text-5xl font-light text-brand-gold/25 transition-colors duration-300 group-hover:text-brand-gold/40">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className={`mt-8 text-lg font-black text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                  {t(`steps.${step}.title`)}
                </h3>
                <p className={`mt-3 text-sm leading-7 text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                  {t(`steps.${step}.description`)}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
